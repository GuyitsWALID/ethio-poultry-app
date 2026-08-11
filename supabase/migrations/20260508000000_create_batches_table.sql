create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  farm_id uuid not null references public.farms(id) on delete restrict,
  house_id uuid not null references public.houses(id) on delete restrict,
  flock_id uuid not null references public.flocks(id) on delete cascade,
  batch_code text not null,
  source public.flock_source not null,
  supplier_name text,
  purchase_date date,
  placement_date date not null,
  age_at_placement_days integer,
  male_count integer default 0,
  female_count integer default 0,
  total_count integer not null,
  purchase_cost_per_bird numeric(12,2),
  transport_cost numeric(12,2) default 0,
  other_cost numeric(12,2) default 0,
  total_batch_cost numeric(14,2),
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_batch_code_org_unique unique(org_id, batch_code),
  constraint batches_total_count_positive check (total_count > 0),
  constraint batches_male_count_non_negative check (coalesce(male_count, 0) >= 0),
  constraint batches_female_count_non_negative check (coalesce(female_count, 0) >= 0),
  constraint batches_age_non_negative check (age_at_placement_days is null or age_at_placement_days >= 0),
  constraint batches_costs_non_negative check (
    coalesce(purchase_cost_per_bird, 0) >= 0 and
    coalesce(transport_cost, 0) >= 0 and
    coalesce(other_cost, 0) >= 0 and
    coalesce(total_batch_cost, 0) >= 0
  )
);

create index if not exists idx_batches_org_id on public.batches(org_id);
create index if not exists idx_batches_branch_id on public.batches(branch_id);
create index if not exists idx_batches_farm_id on public.batches(farm_id);
create index if not exists idx_batches_house_id on public.batches(house_id);
create index if not exists idx_batches_flock_id on public.batches(flock_id);
create index if not exists idx_batches_placement_date on public.batches(placement_date);

create or replace function public.set_batch_total_cost_default()
returns trigger
language plpgsql
as $$
begin
  if new.total_batch_cost is null then
    new.total_batch_cost :=
      coalesce(new.purchase_cost_per_bird, 0) * new.total_count +
      coalesce(new.transport_cost, 0) +
      coalesce(new.other_cost, 0);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_batches_set_total_cost_default on public.batches;
create trigger trg_batches_set_total_cost_default
before insert on public.batches
for each row
execute function public.set_batch_total_cost_default();
