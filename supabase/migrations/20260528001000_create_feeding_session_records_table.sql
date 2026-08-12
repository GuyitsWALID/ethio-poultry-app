create table if not exists public.feeding_session_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  flock_id uuid not null references public.flocks(id) on delete cascade,
  record_date date not null,
  session_name text not null,
  session_time time,
  feeders_count integer not null,
  planned_feed_kg numeric(10,2) not null,
  actual_feed_kg numeric(10,2),
  notes text,
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feeding_session_records_unique unique (org_id, flock_id, record_date, session_name),
  constraint feeding_session_records_feeders_positive check (feeders_count > 0),
  constraint feeding_session_records_planned_positive check (planned_feed_kg > 0),
  constraint feeding_session_records_actual_non_negative check (actual_feed_kg is null or actual_feed_kg >= 0)
);

create index if not exists idx_feeding_session_records_org_id on public.feeding_session_records(org_id);
create index if not exists idx_feeding_session_records_batch_id on public.feeding_session_records(batch_id);
create index if not exists idx_feeding_session_records_flock_id on public.feeding_session_records(flock_id);
create index if not exists idx_feeding_session_records_record_date on public.feeding_session_records(record_date);

alter table public.feeding_session_records enable row level security;

drop policy if exists "feeding_session_records_select_scope" on public.feeding_session_records;
create policy "feeding_session_records_select_scope"
on public.feeding_session_records
for select
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = feeding_session_records.flock_id
    where p.id = auth.uid()
      and p.org_id = feeding_session_records.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1 from public.user_farm_access ufa
          where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id and f.id = fl.farm_id
        )
      )
  )
);

drop policy if exists "feeding_session_records_insert_scope" on public.feeding_session_records;
create policy "feeding_session_records_insert_scope"
on public.feeding_session_records
for insert
with check (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = feeding_session_records.flock_id
    where p.id = auth.uid()
      and p.org_id = feeding_session_records.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1 from public.user_farm_access ufa
          where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id and f.id = fl.farm_id
        )
      )
  )
);

drop policy if exists "feeding_session_records_update_scope" on public.feeding_session_records;
create policy "feeding_session_records_update_scope"
on public.feeding_session_records
for update
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = feeding_session_records.flock_id
    where p.id = auth.uid()
      and p.org_id = feeding_session_records.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1 from public.user_farm_access ufa
          where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id and f.id = fl.farm_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = feeding_session_records.flock_id
    where p.id = auth.uid()
      and p.org_id = feeding_session_records.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1 from public.user_farm_access ufa
          where ufa.profile_id = p.id and ufa.farm_id = fl.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id and f.id = fl.farm_id
        )
      )
  )
);
