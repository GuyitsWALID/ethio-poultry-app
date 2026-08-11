create table if not exists public.feeding_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  schedule_date date not null,
  feed_type text not null,
  planned_feed_kg numeric(10,2) not null,
  target_grams_per_bird numeric(10,2),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feeding_schedules_org_batch_date_unique unique (org_id, batch_id, schedule_date),
  constraint feeding_schedules_planned_feed_positive check (planned_feed_kg > 0),
  constraint feeding_schedules_target_grams_non_negative check (target_grams_per_bird is null or target_grams_per_bird >= 0)
);

create index if not exists idx_feeding_schedules_org_id on public.feeding_schedules(org_id);
create index if not exists idx_feeding_schedules_batch_id on public.feeding_schedules(batch_id);
create index if not exists idx_feeding_schedules_schedule_date on public.feeding_schedules(schedule_date);

alter table public.feeding_schedules enable row level security;

drop policy if exists "feeding_schedules_select_scope" on public.feeding_schedules;
create policy "feeding_schedules_select_scope"
on public.feeding_schedules
for select
using (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = feeding_schedules.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where p.id = auth.uid()
      and p.org_id = feeding_schedules.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = fl.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = fl.farm_id
        )
      )
  )
);

drop policy if exists "feeding_schedules_insert_scope" on public.feeding_schedules;
create policy "feeding_schedules_insert_scope"
on public.feeding_schedules
for insert
with check (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = feeding_schedules.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where p.id = auth.uid()
      and p.org_id = feeding_schedules.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = fl.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = fl.farm_id
        )
      )
  )
);

drop policy if exists "feeding_schedules_update_scope" on public.feeding_schedules;
create policy "feeding_schedules_update_scope"
on public.feeding_schedules
for update
using (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = feeding_schedules.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where p.id = auth.uid()
      and p.org_id = feeding_schedules.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = fl.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = fl.farm_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = feeding_schedules.batch_id
    join public.flocks fl on fl.id = b.flock_id
    where p.id = auth.uid()
      and p.org_id = feeding_schedules.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = fl.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = fl.farm_id
        )
      )
  )
);
