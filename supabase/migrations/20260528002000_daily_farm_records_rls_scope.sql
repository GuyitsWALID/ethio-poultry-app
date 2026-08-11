-- Ensure daily_farm_records can be read by org users and written only by scoped farm managers
alter table if exists public.daily_farm_records enable row level security;

drop policy if exists "daily_farm_records_org_access" on public.daily_farm_records;
create policy "daily_farm_records_org_access"
on public.daily_farm_records
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
  )
);

drop policy if exists "daily_farm_records_select_scope" on public.daily_farm_records;
create policy "daily_farm_records_select_scope"
on public.daily_farm_records
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = daily_farm_records.flock_id
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
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

drop policy if exists "daily_farm_records_insert_scope" on public.daily_farm_records;
create policy "daily_farm_records_insert_scope"
on public.daily_farm_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = daily_farm_records.flock_id
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
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

drop policy if exists "daily_farm_records_update_scope" on public.daily_farm_records;
create policy "daily_farm_records_update_scope"
on public.daily_farm_records
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = daily_farm_records.flock_id
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
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
    join public.flocks fl on fl.id = daily_farm_records.flock_id
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
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

drop policy if exists "daily_farm_records_delete_scope" on public.daily_farm_records;
create policy "daily_farm_records_delete_scope"
on public.daily_farm_records
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = daily_farm_records.flock_id
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
      and p.role = 'farm_manager'
      and (
        exists (
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
