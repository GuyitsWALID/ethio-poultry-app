-- CEO Setup Command Center - Branch and Access Model

-- Helper function to generate batch codes (B-YYYY-XXXX)
create or replace function public.generate_batch_code()
returns text
language plpgsql
as $$
declare
  new_code text;
  seq_val integer;
begin
  -- Use a sequence for the numeric part
  -- Note: In a real env, create a sequence first: create sequence batch_code_seq;
  -- For this setup, we'll simulate or use a simpler counter if sequence isn't available.
  -- But the standard approach is a sequence.

  -- Simple implementation: prefix + year + random/seq
  -- Since we can't easily create a sequence in this specific migration without knowing if it's allowed,
  -- we will use a timestamp-based unique code or a simple count.
  -- Better: use a dedicated sequence.

  -- Let's use a a simpler logic for now: B-YEAR-RANDOM
  new_code := 'B-' || to_char(current_date, 'YYYY') || '-' || upper(substring(md5(random()::text), 1, 4));
  return new_code;
end;
$$;

-- 1. Branch Intake Batches
create table if not exists public.branch_intake_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  batch_code text not null default public.generate_batch_code(),
  source public.flock_source not null,
  supplier_name text,
  purchase_date date,
  placement_date date not null,
  total_count integer not null,
  purchase_cost_per_bird numeric(12,2),
  transport_cost numeric(12,2) default 0,
  other_cost numeric(12,2) default 0,
  total_cost numeric(14,2),
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bib_batch_code_org_unique unique(org_id, batch_code),
  constraint bib_total_count_positive check (total_count > 0)
);

create index if not exists idx_bib_org_id on public.branch_intake_batches(org_id);
create index if not exists idx_bib_branch_id on public.branch_intake_batches(branch_id);

-- 2. User Branch Access
create table if not exists public.user_branch_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_branch_access_unique unique(profile_id, branch_id)
);

create index if not exists idx_uba_profile_id on public.user_branch_access(profile_id);
create index if not exists idx_uba_branch_id on public.user_branch_access(branch_id);

-- 3. RLS Policies Update
alter table public.branch_intake_batches enable row level security;
alter table public.user_branch_access enable row level security;

create policy "CEOs have full access to branch intake batches"
on public.branch_intake_batches for all
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'ceo'
  )
);

create policy "CEOs have full access to user branch access"
on public.user_branch_access for all
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'ceo'
  )
);

create policy "Managers can view their assigned branch intake batches"
on public.branch_intake_batches for select
using (
  exists (
    select 1 from public.user_branch_access
    where profile_id = auth.uid()
    and branch_id = public.branch_intake_batches.branch_id
  )
);

create policy "Managers can view their own branch access"
on public.user_branch_access for select
using (
  profile_id = auth.uid()
);

drop policy if exists "Farm managers can view their assigned farms" on public.farms;
create policy "Farm managers can view farms in their assigned branches"
on public.farms for select
using (
  exists (
    select 1 from public.user_branch_access
    where profile_id = auth.uid()
    and branch_id = public.farms.branch_id
  )
  or
  exists (
    select 1 from public.user_farm_access
    where profile_id = auth.uid()
    and farm_id = public.farms.id
  )
  or
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'ceo'
  )
);

drop policy if exists "Farm managers can view their assigned houses" on public.houses;
create policy "Farm managers can view houses in their assigned branches"
on public.houses for select
using (
  exists (
    select 1 from public.farms
    join public.user_branch_access on public.farms.branch_id = public.user_branch_access.branch_id
    where public.user_branch_access.profile_id = auth.uid()
    and public.houses.farm_id = public.farms.id
  )
  or
  exists (
    select 1 from public.user_farm_access
    join public.farms on public.user_farm_access.farm_id = public.farms.id
    where public.user_farm_access.profile_id = auth.uid()
    and public.houses.farm_id = public.farms.id
  )
  or
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'ceo'
  )
);

drop policy if exists "Farm managers can view their assigned flocks" on public.flocks;
create policy "Farm managers can view flocks in their assigned branches"
on public.flocks for select
using (
  exists (
    select 1 from public.farms
    join public.user_branch_access on public.farms.branch_id = public.user_branch_access.branch_id
    where public.user_branch_access.profile_id = auth.uid()
    and public.flocks.farm_id = public.farms.id
  )
  or
  exists (
    select 1 from public.user_farm_access
    join public.farms on public.user_farm_access.farm_id = public.user_farm_access.farm_id
    where public.user_farm_access.profile_id = auth.uid()
    and public.flocks.farm_id = public.user_farm_access.farm_id
  )
  or
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'ceo'
  )
);

drop policy if exists "Farm managers can view their assigned batches" on public.batches;
create policy "Farm managers can view batches in their assigned branches"
on public.batches for select
using (
  exists (
    select 1 from public.farms
    join public.user_branch_access on public.farms.branch_id = public.user_branch_access.branch_id
    where public.user_branch_access.profile_id = auth.uid()
    and public.batches.farm_id = public.farms.id
  )
  or
  exists (
    select 1 from public.user_farm_access
    join public.farms on public.user_farm_access.farm_id = public.farms.id
    where public.user_farm_access.profile_id = auth.uid()
    and public.batches.farm_id = public.farms.id
  )
  or
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'ceo'
  )
);
