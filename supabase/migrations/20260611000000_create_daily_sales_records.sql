create table if not exists public.daily_sales_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete restrict,
  farm_id uuid references public.farms(id) on delete restrict,
  house_id uuid references public.houses(id) on delete restrict,
  flock_id uuid references public.flocks(id) on delete restrict,
  batch_id uuid references public.batches(id) on delete restrict,
  sale_date date not null,
  product_category text not null check (product_category in ('egg', 'bird')),
  product_label text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit text not null,
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  gross_amount numeric(14, 2) not null check (gross_amount >= 0),
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0),
  balance_due numeric(14, 2) not null default 0 check (balance_due >= 0),
  payment_method text,
  customer_name text,
  customer_phone text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_sales_paid_not_above_gross check (paid_amount <= gross_amount),
  constraint daily_sales_scope_present check (farm_id is not null or flock_id is not null or batch_id is not null)
);

create index if not exists idx_daily_sales_records_org_date on public.daily_sales_records(org_id, sale_date desc);
create index if not exists idx_daily_sales_records_branch on public.daily_sales_records(branch_id);
create index if not exists idx_daily_sales_records_farm on public.daily_sales_records(farm_id);
create index if not exists idx_daily_sales_records_house on public.daily_sales_records(house_id);
create index if not exists idx_daily_sales_records_flock on public.daily_sales_records(flock_id);
create index if not exists idx_daily_sales_records_batch on public.daily_sales_records(batch_id);
create index if not exists idx_daily_sales_records_product on public.daily_sales_records(product_category, product_label);

alter table public.daily_sales_records enable row level security;

drop policy if exists "daily_sales_records_org_role_select" on public.daily_sales_records;
create policy "daily_sales_records_org_role_select"
on public.daily_sales_records
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = daily_sales_records.org_id
      and p.role in ('ceo', 'system_admin', 'super_admin', 'store_keeper')
  )
);

drop policy if exists "daily_sales_records_manager_select" on public.daily_sales_records;
create policy "daily_sales_records_manager_select"
on public.daily_sales_records
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = daily_sales_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = daily_sales_records.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = daily_sales_records.farm_id
        )
      )
  )
);

drop policy if exists "daily_sales_records_manager_insert" on public.daily_sales_records;
create policy "daily_sales_records_manager_insert"
on public.daily_sales_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = daily_sales_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = daily_sales_records.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = daily_sales_records.farm_id
        )
      )
  )
);

drop policy if exists "daily_sales_records_manager_update" on public.daily_sales_records;
create policy "daily_sales_records_manager_update"
on public.daily_sales_records
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = daily_sales_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = daily_sales_records.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = daily_sales_records.farm_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = daily_sales_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = daily_sales_records.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = daily_sales_records.farm_id
        )
      )
  )
);

drop policy if exists "daily_sales_records_manager_delete" on public.daily_sales_records;
create policy "daily_sales_records_manager_delete"
on public.daily_sales_records
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = daily_sales_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = daily_sales_records.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = daily_sales_records.farm_id
        )
      )
  )
);
