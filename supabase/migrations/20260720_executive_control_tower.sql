-- Executive control tower: auditable daily inputs, broader revenue capture, and management targets.
alter table public.daily_farm_records
  add column if not exists opening_birds integer,
  add column if not exists closing_birds integer,
  add column if not exists culls integer default 0,
  add column if not exists transfers_in integer default 0,
  add column if not exists transfers_out integer default 0,
  add column if not exists other_removals integer default 0,
  add column if not exists dirty_eggs integer,
  add column if not exists average_egg_weight_g numeric(8,2),
  add column if not exists water_consumed_liters numeric(12,2);

alter table public.daily_farm_records
  drop constraint if exists daily_farm_records_executive_inputs_non_negative,
  add constraint daily_farm_records_executive_inputs_non_negative check (
    (opening_birds is null or opening_birds >= 0) and
    (closing_birds is null or closing_birds >= 0) and
    coalesce(culls, 0) >= 0 and coalesce(transfers_in, 0) >= 0 and
    coalesce(transfers_out, 0) >= 0 and coalesce(other_removals, 0) >= 0 and
    (dirty_eggs is null or dirty_eggs >= 0) and
    (average_egg_weight_g is null or average_egg_weight_g > 0) and
    (water_consumed_liters is null or water_consumed_liters >= 0)
  );

alter table public.daily_sales_records drop constraint if exists daily_sales_records_product_category_check;
alter table public.daily_sales_records add constraint daily_sales_records_product_category_check
  check (product_category in ('egg', 'bird', 'training', 'equipment_medicine', 'consultancy', 'package'));
alter table public.daily_sales_records drop constraint if exists daily_sales_scope_present;
alter table public.daily_sales_records add constraint daily_sales_scope_present check (
  product_category not in ('egg', 'bird') or farm_id is not null or flock_id is not null or batch_id is not null
);

create table if not exists public.management_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  scope_type text not null check (scope_type in ('organization', 'branch', 'farm')),
  scope_id uuid,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  revenue_target_etb numeric(14,2) check (revenue_target_etb is null or revenue_target_etb >= 0),
  operating_margin_target_pct numeric(7,2),
  cash_collection_target_pct numeric(7,2),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope_type = 'organization' and scope_id is null) or (scope_type <> 'organization' and scope_id is not null))
);
create unique index if not exists management_targets_scope_month_uidx
  on public.management_targets (org_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), period_month);
create index if not exists management_targets_org_month_idx on public.management_targets(org_id, period_month);
alter table public.management_targets enable row level security;
create policy "management_targets_org_select" on public.management_targets for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.org_id = management_targets.org_id)
);
create policy "management_targets_admin_write" on public.management_targets for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.org_id = management_targets.org_id and p.role in ('ceo','system_admin','super_admin'))
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.org_id = management_targets.org_id and p.role in ('ceo','system_admin','super_admin'))
);
