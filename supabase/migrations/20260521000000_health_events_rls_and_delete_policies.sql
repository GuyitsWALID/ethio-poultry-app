-- Health scheduler permissions: add delete support + health_events RLS

alter table if exists public.health_events enable row level security;

-- Add delete policies for schedule source tables
drop policy if exists "biosecurity_checks_delete_scope" on public.biosecurity_checks;
create policy "biosecurity_checks_delete_scope"
on public.biosecurity_checks
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = biosecurity_checks.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1 from public.user_farm_access ufa
          where ufa.profile_id = p.id and ufa.farm_id = biosecurity_checks.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id and f.id = biosecurity_checks.farm_id
        )
      )
  )
);

drop policy if exists "vaccination_events_delete_scope" on public.vaccination_events;
create policy "vaccination_events_delete_scope"
on public.vaccination_events
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = vaccination_events.flock_id
    where p.id = auth.uid()
      and p.org_id = vaccination_events.org_id
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

-- health_events policies for schedule metadata writes
drop policy if exists "health_events_select_scope" on public.health_events;
create policy "health_events_select_scope"
on public.health_events
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.org_id = health_events.org_id
  )
);

drop policy if exists "health_events_insert_scope" on public.health_events;
create policy "health_events_insert_scope"
on public.health_events
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.org_id = health_events.org_id
  )
);

drop policy if exists "health_events_update_scope" on public.health_events;
create policy "health_events_update_scope"
on public.health_events
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.org_id = health_events.org_id
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.org_id = health_events.org_id
  )
);

drop policy if exists "health_events_delete_scope" on public.health_events;
create policy "health_events_delete_scope"
on public.health_events
for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.org_id = health_events.org_id
  )
);
