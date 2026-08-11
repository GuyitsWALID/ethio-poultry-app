-- Allow health scheduling writes for authorized org users (CEO + assigned farm managers)

alter table if exists public.biosecurity_checks enable row level security;
alter table if exists public.vaccination_events enable row level security;

drop policy if exists "biosecurity_checks_select_scope" on public.biosecurity_checks;
create policy "biosecurity_checks_select_scope"
on public.biosecurity_checks
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = biosecurity_checks.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = biosecurity_checks.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = biosecurity_checks.farm_id
        )
      )
  )
);

drop policy if exists "biosecurity_checks_insert_scope" on public.biosecurity_checks;
create policy "biosecurity_checks_insert_scope"
on public.biosecurity_checks
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = biosecurity_checks.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = biosecurity_checks.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = biosecurity_checks.farm_id
        )
      )
  )
);

drop policy if exists "biosecurity_checks_update_scope" on public.biosecurity_checks;
create policy "biosecurity_checks_update_scope"
on public.biosecurity_checks
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = biosecurity_checks.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = biosecurity_checks.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = biosecurity_checks.farm_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = biosecurity_checks.org_id
      and (
        p.role = 'ceo'
        or exists (
          select 1
          from public.user_farm_access ufa
          where ufa.profile_id = p.id
            and ufa.farm_id = biosecurity_checks.farm_id
        )
        or exists (
          select 1
          from public.farms f
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where uba.profile_id = p.id
            and f.id = biosecurity_checks.farm_id
        )
      )
  )
);

drop policy if exists "vaccination_events_select_scope" on public.vaccination_events;
create policy "vaccination_events_select_scope"
on public.vaccination_events
for select
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

drop policy if exists "vaccination_events_insert_scope" on public.vaccination_events;
create policy "vaccination_events_insert_scope"
on public.vaccination_events
for insert
with check (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = vaccination_events.flock_id
    where p.id = auth.uid()
      and p.org_id = vaccination_events.org_id
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

drop policy if exists "vaccination_events_update_scope" on public.vaccination_events;
create policy "vaccination_events_update_scope"
on public.vaccination_events
for update
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
    join public.flocks fl on fl.id = vaccination_events.flock_id
    where p.id = auth.uid()
      and p.org_id = vaccination_events.org_id
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
