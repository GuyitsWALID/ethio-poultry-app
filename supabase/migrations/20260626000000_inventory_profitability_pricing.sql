-- Inventory-led poultry profitability and pricing guidance.
-- This migration is additive so it can run whether inventory tables already exist
-- in the remote project or are being created from this repository.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'monthly_cost_status') then
    create type public.monthly_cost_status as enum ('draft', 'locked');
  end if;

  if not exists (select 1 from pg_type where typname = 'cost_entry_category') then
    create type public.cost_entry_category as enum (
      'feed',
      'medicine',
      'vaccine',
      'vitamin',
      'supplement',
      'payroll',
      'utility',
      'biosecurity',
      'transport',
      'maintenance',
      'labor',
      'rent',
      'packaging',
      'miscellaneous'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'cost_allocation_method') then
    create type public.cost_allocation_method as enum (
      'direct',
      'bird_count',
      'egg_count',
      'feed_consumption',
      'manual_percent'
    );
  end if;
end $$;

create table if not exists public.monthly_cost_periods (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  farm_id uuid references public.farms(id) on delete set null,
  house_id uuid references public.houses(id) on delete set null,
  flock_id uuid references public.flocks(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  period_start date not null,
  period_end date not null,
  status public.monthly_cost_status not null default 'draft',
  total_normal_eggs integer not null default 0 check (total_normal_eggs >= 0),
  total_broken_eggs integer not null default 0 check (total_broken_eggs >= 0),
  total_revenue numeric(14,2) not null default 0 check (total_revenue >= 0),
  total_absorbed_cost numeric(14,2) not null default 0 check (total_absorbed_cost >= 0),
  base_cost_per_egg numeric(12,4),
  target_margin_per_egg numeric(12,4) not null default 0,
  locked_at timestamptz,
  locked_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_cost_period_range check (period_end >= period_start),
  constraint monthly_cost_period_base_cost_check check (base_cost_per_egg is null or base_cost_per_egg >= 0)
);

create unique index if not exists monthly_cost_periods_scope_unique
on public.monthly_cost_periods (
  org_id,
  coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(farm_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(house_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(flock_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(batch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  period_start,
  period_end
);

create index if not exists idx_monthly_cost_periods_org_period
on public.monthly_cost_periods(org_id, period_start desc, period_end desc);

create table if not exists public.cost_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid references public.monthly_cost_periods(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  farm_id uuid references public.farms(id) on delete set null,
  house_id uuid references public.houses(id) on delete set null,
  flock_id uuid references public.flocks(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  entry_date date not null default current_date,
  category public.cost_entry_category not null,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  allocation_method public.cost_allocation_method not null default 'direct',
  supplier_name text,
  invoice_number text,
  reference_doc text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cost_entries_org_date on public.cost_entries(org_id, entry_date desc);
create index if not exists idx_cost_entries_period on public.cost_entries(period_id);
create index if not exists idx_cost_entries_scope on public.cost_entries(org_id, branch_id, farm_id, house_id, flock_id, batch_id);

create table if not exists public.cost_allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  cost_entry_id uuid not null references public.cost_entries(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  farm_id uuid references public.farms(id) on delete set null,
  house_id uuid references public.houses(id) on delete set null,
  flock_id uuid references public.flocks(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  allocation_method public.cost_allocation_method not null default 'direct',
  allocation_percent numeric(7,4) check (allocation_percent is null or (allocation_percent >= 0 and allocation_percent <= 100)),
  allocated_amount numeric(14,2) not null check (allocated_amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_cost_allocations_entry on public.cost_allocations(cost_entry_id);
create index if not exists idx_cost_allocations_scope on public.cost_allocations(org_id, branch_id, farm_id, house_id, flock_id, batch_id);

do $$
begin
  if to_regclass('public.stock_ledger') is not null then
    alter table public.stock_ledger
      add column if not exists branch_id uuid references public.branches(id) on delete set null,
      add column if not exists farm_id uuid references public.farms(id) on delete set null,
      add column if not exists house_id uuid references public.houses(id) on delete set null,
      add column if not exists batch_id uuid references public.batches(id) on delete set null,
      add column if not exists supplier_name text,
      add column if not exists invoice_number text,
      add column if not exists cost_method text not null default 'weighted_average';

    create index if not exists idx_stock_ledger_scope
    on public.stock_ledger(org_id, branch_id, farm_id, house_id, flock_id, batch_id);
  end if;
end $$;

create or replace function public.apply_monthly_cost_period_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.total_normal_eggs > 0 then
    new.base_cost_per_egg = round(new.total_absorbed_cost / new.total_normal_eggs, 4);
  else
    new.base_cost_per_egg = null;
  end if;

  if new.status = 'locked' and new.locked_at is null then
    new.locked_at = now();
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists apply_monthly_cost_period_totals on public.monthly_cost_periods;
create trigger apply_monthly_cost_period_totals
before insert or update on public.monthly_cost_periods
for each row
execute function public.apply_monthly_cost_period_totals();

alter table public.monthly_cost_periods enable row level security;
alter table public.cost_entries enable row level security;
alter table public.cost_allocations enable row level security;

drop policy if exists "monthly_cost_periods_org_select" on public.monthly_cost_periods;
create policy "monthly_cost_periods_org_select"
on public.monthly_cost_periods
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = monthly_cost_periods.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin', 'store_keeper')
        or (
          p.role = 'farm_manager'
          and (
            exists (
              select 1 from public.user_farm_access ufa
              where ufa.profile_id = p.id and ufa.farm_id = monthly_cost_periods.farm_id
            )
            or exists (
              select 1 from public.user_branch_access uba
              where uba.profile_id = p.id and uba.branch_id = monthly_cost_periods.branch_id
            )
          )
        )
      )
  )
);

drop policy if exists "monthly_cost_periods_admin_write" on public.monthly_cost_periods;
create policy "monthly_cost_periods_admin_write"
on public.monthly_cost_periods
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = monthly_cost_periods.org_id
      and p.role in ('ceo', 'system_admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = monthly_cost_periods.org_id
      and p.role in ('ceo', 'system_admin', 'super_admin')
  )
);

drop policy if exists "cost_entries_org_select" on public.cost_entries;
create policy "cost_entries_org_select"
on public.cost_entries
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = cost_entries.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin', 'store_keeper')
        or (
          p.role = 'farm_manager'
          and (
            exists (
              select 1 from public.user_farm_access ufa
              where ufa.profile_id = p.id and ufa.farm_id = cost_entries.farm_id
            )
            or exists (
              select 1 from public.user_branch_access uba
              where uba.profile_id = p.id and uba.branch_id = cost_entries.branch_id
            )
          )
        )
      )
  )
);

drop policy if exists "cost_entries_ops_write" on public.cost_entries;
create policy "cost_entries_ops_write"
on public.cost_entries
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = cost_entries.org_id
      and p.role in ('ceo', 'system_admin', 'super_admin', 'store_keeper')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = cost_entries.org_id
      and p.role in ('ceo', 'system_admin', 'super_admin', 'store_keeper')
  )
);

drop policy if exists "cost_allocations_org_select" on public.cost_allocations;
create policy "cost_allocations_org_select"
on public.cost_allocations
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = cost_allocations.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin', 'store_keeper')
        or (
          p.role = 'farm_manager'
          and (
            exists (
              select 1 from public.user_farm_access ufa
              where ufa.profile_id = p.id and ufa.farm_id = cost_allocations.farm_id
            )
            or exists (
              select 1 from public.user_branch_access uba
              where uba.profile_id = p.id and uba.branch_id = cost_allocations.branch_id
            )
          )
        )
      )
  )
);

drop policy if exists "cost_allocations_admin_write" on public.cost_allocations;
create policy "cost_allocations_admin_write"
on public.cost_allocations
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = cost_allocations.org_id
      and p.role in ('ceo', 'system_admin', 'super_admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.org_id = cost_allocations.org_id
      and p.role in ('ceo', 'system_admin', 'super_admin')
  )
);
