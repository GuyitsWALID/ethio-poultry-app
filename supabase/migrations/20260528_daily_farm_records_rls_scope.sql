-- Ensure daily_farm_records can be read/written by authorized org users
alter table if exists public.daily_farm_records enable row level security;

drop policy if exists "daily_farm_records_select_scope" on public.daily_farm_records;
create policy "daily_farm_records_select_scope"
on public.daily_farm_records
for select
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = daily_farm_records.flock_id
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
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

drop policy if exists "daily_farm_records_insert_scope" on public.daily_farm_records;
create policy "daily_farm_records_insert_scope"
on public.daily_farm_records
for insert
with check (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = daily_farm_records.flock_id
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
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

drop policy if exists "daily_farm_records_update_scope" on public.daily_farm_records;
create policy "daily_farm_records_update_scope"
on public.daily_farm_records
for update
using (
  exists (
    select 1
    from public.profiles p
    join public.flocks fl on fl.id = daily_farm_records.flock_id
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
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
    join public.flocks fl on fl.id = daily_farm_records.flock_id
    where p.id = auth.uid()
      and p.org_id = daily_farm_records.org_id
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
