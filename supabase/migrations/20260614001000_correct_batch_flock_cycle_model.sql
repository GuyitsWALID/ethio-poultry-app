-- Make public.batches the canonical parent cycle and link flocks to it.

alter table public.flocks
add column if not exists batch_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'flocks_batch_id_fkey'
  ) then
    alter table public.flocks
    add constraint flocks_batch_id_fkey
    foreign key (batch_id)
    references public.batches(id)
    on delete set null;
  end if;
end $$;

create index if not exists idx_flocks_batch_id on public.flocks(batch_id);

update public.flocks fl
set batch_id = b.id
from public.branch_intake_batches bib
join public.batches b
  on b.org_id = bib.org_id
 and b.batch_code = bib.batch_code
where fl.batch_id is null
  and fl.intake_batch_id = bib.id;

update public.flocks fl
set batch_id = b.id
from public.batches b
where fl.batch_id is null
  and b.flock_id = fl.id;

drop policy if exists "feeding_schedules_select_scope" on public.feeding_schedules;
create policy "feeding_schedules_select_scope"
on public.feeding_schedules
for select
using (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = feeding_schedules.batch_id
    where p.id = auth.uid()
      and p.org_id = feeding_schedules.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or exists (
          select 1
          from public.flocks fl
          join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
          where fl.batch_id = b.id
            and ufa.profile_id = p.id
        )
        or exists (
          select 1
          from public.flocks fl
          join public.farms f on f.id = fl.farm_id
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where fl.batch_id = b.id
            and uba.profile_id = p.id
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
    where p.id = auth.uid()
      and p.org_id = feeding_schedules.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or exists (
          select 1
          from public.flocks fl
          join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
          where fl.batch_id = b.id
            and ufa.profile_id = p.id
        )
        or exists (
          select 1
          from public.flocks fl
          join public.farms f on f.id = fl.farm_id
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where fl.batch_id = b.id
            and uba.profile_id = p.id
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
    where p.id = auth.uid()
      and p.org_id = feeding_schedules.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or exists (
          select 1
          from public.flocks fl
          join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
          where fl.batch_id = b.id
            and ufa.profile_id = p.id
        )
        or exists (
          select 1
          from public.flocks fl
          join public.farms f on f.id = fl.farm_id
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where fl.batch_id = b.id
            and uba.profile_id = p.id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = feeding_schedules.batch_id
    where p.id = auth.uid()
      and p.org_id = feeding_schedules.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or exists (
          select 1
          from public.flocks fl
          join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
          where fl.batch_id = b.id
            and ufa.profile_id = p.id
        )
        or exists (
          select 1
          from public.flocks fl
          join public.farms f on f.id = fl.farm_id
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where fl.batch_id = b.id
            and uba.profile_id = p.id
        )
      )
  )
);

drop policy if exists "batch_feed_templates_select_scope" on public.batch_feed_templates;
create policy "batch_feed_templates_select_scope"
on public.batch_feed_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = batch_feed_templates.batch_id
    where p.id = auth.uid()
      and p.org_id = batch_feed_templates.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or exists (
          select 1 from public.flocks fl
          join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
          where fl.batch_id = b.id and ufa.profile_id = p.id
        )
        or exists (
          select 1 from public.flocks fl
          join public.farms f on f.id = fl.farm_id
          join public.user_branch_access uba on uba.branch_id = f.branch_id
          where fl.batch_id = b.id and uba.profile_id = p.id
        )
      )
  )
);

drop policy if exists "batch_feed_templates_write_scope" on public.batch_feed_templates;
create policy "batch_feed_templates_write_scope"
on public.batch_feed_templates
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = batch_feed_templates.batch_id
    where p.id = auth.uid()
      and p.org_id = batch_feed_templates.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (
              select 1 from public.flocks fl
              join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
              where fl.batch_id = b.id and ufa.profile_id = p.id
            )
            or exists (
              select 1 from public.flocks fl
              join public.farms f on f.id = fl.farm_id
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where fl.batch_id = b.id and uba.profile_id = p.id
            )
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.batches b on b.id = batch_feed_templates.batch_id
    where p.id = auth.uid()
      and p.org_id = batch_feed_templates.org_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (
              select 1 from public.flocks fl
              join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
              where fl.batch_id = b.id and ufa.profile_id = p.id
            )
            or exists (
              select 1 from public.flocks fl
              join public.farms f on f.id = fl.farm_id
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where fl.batch_id = b.id and uba.profile_id = p.id
            )
          )
        )
      )
  )
);

drop policy if exists "batch_feed_template_rows_write_scope" on public.batch_feed_template_rows;
create policy "batch_feed_template_rows_write_scope"
on public.batch_feed_template_rows
for all
to authenticated
using (
  exists (
    select 1
    from public.batch_feed_templates t
    join public.profiles p on p.id = auth.uid() and p.org_id = t.org_id
    join public.batches b on b.id = t.batch_id
    where t.id = batch_feed_template_rows.template_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (
              select 1 from public.flocks fl
              join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
              where fl.batch_id = b.id and ufa.profile_id = p.id
            )
            or exists (
              select 1 from public.flocks fl
              join public.farms f on f.id = fl.farm_id
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where fl.batch_id = b.id and uba.profile_id = p.id
            )
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.batch_feed_templates t
    join public.profiles p on p.id = auth.uid() and p.org_id = t.org_id
    join public.batches b on b.id = t.batch_id
    where t.id = batch_feed_template_rows.template_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (
              select 1 from public.flocks fl
              join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
              where fl.batch_id = b.id and ufa.profile_id = p.id
            )
            or exists (
              select 1 from public.flocks fl
              join public.farms f on f.id = fl.farm_id
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where fl.batch_id = b.id and uba.profile_id = p.id
            )
          )
        )
      )
  )
);

drop policy if exists "batch_feed_template_milestones_write_scope" on public.batch_feed_template_milestones;
create policy "batch_feed_template_milestones_write_scope"
on public.batch_feed_template_milestones
for all
to authenticated
using (
  exists (
    select 1
    from public.batch_feed_templates t
    join public.profiles p on p.id = auth.uid() and p.org_id = t.org_id
    join public.batches b on b.id = t.batch_id
    where t.id = batch_feed_template_milestones.template_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (
              select 1 from public.flocks fl
              join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
              where fl.batch_id = b.id and ufa.profile_id = p.id
            )
            or exists (
              select 1 from public.flocks fl
              join public.farms f on f.id = fl.farm_id
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where fl.batch_id = b.id and uba.profile_id = p.id
            )
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.batch_feed_templates t
    join public.profiles p on p.id = auth.uid() and p.org_id = t.org_id
    join public.batches b on b.id = t.batch_id
    where t.id = batch_feed_template_milestones.template_id
      and (
        p.role in ('ceo', 'system_admin', 'super_admin')
        or (
          p.role = 'farm_manager'
          and (
            exists (
              select 1 from public.flocks fl
              join public.user_farm_access ufa on ufa.farm_id = fl.farm_id
              where fl.batch_id = b.id and ufa.profile_id = p.id
            )
            or exists (
              select 1 from public.flocks fl
              join public.farms f on f.id = fl.farm_id
              join public.user_branch_access uba on uba.branch_id = f.branch_id
              where fl.batch_id = b.id and uba.profile_id = p.id
            )
          )
        )
      )
  )
);

create or replace function public.create_branch_batch_cycle(
  p_org_id uuid,
  p_branch_id uuid,
  p_batch jsonb,
  p_flock_slots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_batch_id uuid;
  v_batch_code text;
  v_source public.flock_source;
  v_placement_date date;
  v_age_days integer;
  v_total_count integer := 0;
  v_purchase_cost numeric(12,2);
  v_transport_cost numeric(12,2);
  v_other_cost numeric(12,2);
  v_first_slot jsonb;
  v_slot jsonb;
  v_farm_id uuid;
  v_house_id uuid;
  v_flock_code text;
  v_flock_type public.flock_type;
  v_slot_count integer;
  v_created_flock_ids uuid[] := '{}'::uuid[];
  v_new_flock_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id
    and org_id = p_org_id;

  if v_profile.id is null then
    raise exception 'Organization profile was not found';
  end if;

  if v_profile.role not in ('ceo', 'system_admin', 'super_admin', 'farm_manager') then
    raise exception 'Not allowed to create batch cycles';
  end if;

  if v_profile.role = 'farm_manager'
    and not exists (
      select 1
      from public.user_branch_access uba
      where uba.profile_id = v_user_id
        and uba.branch_id = p_branch_id
    )
    and not exists (
      select 1
      from public.user_farm_access ufa
      join public.farms f on f.id = ufa.farm_id
      where ufa.profile_id = v_user_id
        and f.branch_id = p_branch_id
    )
  then
    raise exception 'Not allowed to create a batch for this branch';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.org_id = p_org_id
  ) then
    raise exception 'Branch does not belong to this organization';
  end if;

  if p_flock_slots is null or jsonb_typeof(p_flock_slots) <> 'array' or jsonb_array_length(p_flock_slots) = 0 then
    raise exception 'At least one flock slot is required';
  end if;

  v_batch_code := nullif(trim(coalesce(p_batch->>'batch_code', '')), '');
  if v_batch_code is null then
    v_batch_code := public.generate_batch_code();
  end if;

  v_source := coalesce(nullif(p_batch->>'source', ''), 'external_purchase')::public.flock_source;
  v_placement_date := nullif(p_batch->>'placement_date', '')::date;
  v_age_days := nullif(p_batch->>'age_at_placement_days', '')::integer;
  v_purchase_cost := nullif(p_batch->>'purchase_cost_per_bird', '')::numeric(12,2);
  v_transport_cost := coalesce(nullif(p_batch->>'transport_cost', '')::numeric(12,2), 0);
  v_other_cost := coalesce(nullif(p_batch->>'other_cost', '')::numeric(12,2), 0);

  if v_placement_date is null then
    raise exception 'placement_date is required';
  end if;

  if v_age_days is null or v_age_days < 0 then
    raise exception 'age_at_placement_days is required and must be non-negative';
  end if;

  v_first_slot := p_flock_slots->0;
  v_farm_id := (v_first_slot->>'farm_id')::uuid;
  v_house_id := (v_first_slot->>'house_id')::uuid;

  for v_slot in select value from jsonb_array_elements(p_flock_slots)
  loop
    v_slot_count := nullif(v_slot->>'initial_count', '')::integer;
    if v_slot_count is null or v_slot_count <= 0 then
      raise exception 'Each flock slot must have a positive initial_count';
    end if;
    v_total_count := v_total_count + v_slot_count;

    if not exists (
      select 1
      from public.houses h
      join public.farms f on f.id = h.farm_id
      where h.id = (v_slot->>'house_id')::uuid
        and f.id = (v_slot->>'farm_id')::uuid
        and f.branch_id = p_branch_id
        and f.org_id = p_org_id
        and h.org_id = p_org_id
    ) then
      raise exception 'A flock slot is outside the selected branch';
    end if;
  end loop;

  update public.flocks fl
  set status = 'archived'::public.flock_status,
      updated_at = now()
  from public.farms f
  where fl.farm_id = f.id
    and f.branch_id = p_branch_id
    and fl.org_id = p_org_id
    and fl.status = 'active';

  update public.batches
  set status = 'archived',
      updated_at = now()
  where org_id = p_org_id
    and branch_id = p_branch_id
    and status = 'active';

  insert into public.batches (
    org_id,
    branch_id,
    farm_id,
    house_id,
    batch_code,
    source,
    supplier_name,
    purchase_date,
    placement_date,
    age_at_placement_days,
    male_count,
    female_count,
    total_count,
    purchase_cost_per_bird,
    transport_cost,
    other_cost,
    total_batch_cost,
    status,
    notes
  )
  values (
    p_org_id,
    p_branch_id,
    v_farm_id,
    v_house_id,
    v_batch_code,
    v_source,
    nullif(p_batch->>'supplier_name', ''),
    nullif(p_batch->>'purchase_date', '')::date,
    v_placement_date,
    v_age_days,
    coalesce(nullif(p_batch->>'male_count', '')::integer, 0),
    coalesce(nullif(p_batch->>'female_count', '')::integer, 0),
    v_total_count,
    v_purchase_cost,
    v_transport_cost,
    v_other_cost,
    coalesce(
      nullif(p_batch->>'total_batch_cost', '')::numeric(14,2),
      coalesce(v_purchase_cost, 0) * v_total_count + v_transport_cost + v_other_cost
    ),
    'active',
    nullif(p_batch->>'notes', '')
  )
  returning id into v_batch_id;

  for v_slot in select value from jsonb_array_elements(p_flock_slots)
  loop
    v_farm_id := (v_slot->>'farm_id')::uuid;
    v_house_id := (v_slot->>'house_id')::uuid;
    v_flock_code := nullif(trim(coalesce(v_slot->>'flock_code', '')), '');
    v_flock_type := coalesce(nullif(v_slot->>'flock_type', ''), 'broiler')::public.flock_type;
    v_slot_count := nullif(v_slot->>'initial_count', '')::integer;

    insert into public.flocks (
      flock_code,
      flock_type,
      source,
      placement_date,
      initial_count,
      current_count,
      age_at_placement_days,
      purchase_cost_per_bird,
      batch_id,
      house_id,
      farm_id,
      org_id,
      status,
      notes
    )
    values (
      coalesce(v_flock_code, 'FLK-' || upper(substring(md5(random()::text), 1, 5))),
      v_flock_type,
      v_source,
      v_placement_date,
      v_slot_count,
      v_slot_count,
      coalesce(v_age_days, 0),
      v_purchase_cost,
      v_batch_id,
      v_house_id,
      v_farm_id,
      p_org_id,
      'active',
      nullif(v_slot->>'notes', '')
    )
    returning id into v_new_flock_id;

    v_created_flock_ids := array_append(v_created_flock_ids, v_new_flock_id);
  end loop;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'batch_code', v_batch_code,
    'flock_ids', to_jsonb(v_created_flock_ids),
    'total_count', v_total_count
  );
end;
$$;

create or replace function public.ceo_initialize_branch_hierarchy(
  p_org_id uuid,
  p_branch jsonb,
  p_intake_batch jsonb,
  p_farms jsonb,
  p_manager jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_id uuid;
  v_bib_id uuid;
  v_batch_id uuid;
  v_batch_code text;
  v_farm_id uuid;
  v_house_id uuid;
  v_flock_id uuid;
  v_primary_farm_id uuid;
  v_primary_house_id uuid;
  v_created_farm_ids uuid[] := '{}'::uuid[];
  v_farm jsonb;
  v_house jsonb;
  v_flock jsonb;
  v_total_count integer;
  v_cost_per_bird numeric(12,2);
  v_placement_date date;
begin
  if p_org_id is null then
    raise exception 'org_id is required';
  end if;

  if p_branch is null or coalesce(trim(p_branch->>'name'), '') = '' then
    raise exception 'branch.name is required';
  end if;

  if p_intake_batch is null then
    raise exception 'intakeBatch is required';
  end if;

  if p_manager is null or coalesce(trim(p_manager->>'user_id'), '') = '' then
    raise exception 'manager.user_id is required';
  end if;

  v_total_count := nullif(p_intake_batch->>'total_count', '')::integer;
  v_cost_per_bird := nullif(p_intake_batch->>'purchase_cost_per_bird', '')::numeric(12,2);
  v_placement_date := nullif(p_intake_batch->>'placement_date', '')::date;

  if v_total_count is null or v_total_count <= 0 then
    raise exception 'intakeBatch.total_count must be greater than 0';
  end if;

  if v_placement_date is null then
    raise exception 'intakeBatch.placement_date is required';
  end if;

  insert into public.branches (name, location, org_id)
  values (p_branch->>'name', p_branch->>'location', p_org_id)
  returning id into v_branch_id;

  insert into public.branch_intake_batches (
    org_id, branch_id, source, supplier_name, purchase_date, placement_date,
    total_count, purchase_cost_per_bird, transport_cost, other_cost, total_cost,
    status, notes
  )
  values (
    p_org_id,
    v_branch_id,
    (p_intake_batch->>'source')::public.flock_source,
    nullif(p_intake_batch->>'supplier_name', ''),
    nullif(p_intake_batch->>'purchase_date', '')::date,
    v_placement_date,
    v_total_count,
    v_cost_per_bird,
    coalesce(nullif(p_intake_batch->>'transport_cost', '')::numeric(12,2), 0),
    coalesce(nullif(p_intake_batch->>'other_cost', '')::numeric(12,2), 0),
    nullif(p_intake_batch->>'total_cost', '')::numeric(14,2),
    'pending',
    nullif(p_intake_batch->>'notes', '')
  )
  returning id, batch_code into v_bib_id, v_batch_code;

  for v_farm in select value from jsonb_array_elements(coalesce(p_farms, '[]'::jsonb))
  loop
    insert into public.farms (name, branch_id, org_id)
    values (v_farm->>'name', v_branch_id, p_org_id)
    returning id into v_farm_id;

    v_created_farm_ids := array_append(v_created_farm_ids, v_farm_id);

    for v_house in select value from jsonb_array_elements(coalesce(v_farm->'houses', '[]'::jsonb))
    loop
      insert into public.houses (name, capacity, house_type, branch_id, farm_id, org_id)
      values (
        v_house->>'name',
        coalesce(nullif(v_house->>'capacity', '')::integer, 0),
        'broiler'::public.house_type,
        v_branch_id,
        v_farm_id,
        p_org_id
      )
      returning id into v_house_id;

      if v_primary_farm_id is null then
        v_primary_farm_id := v_farm_id;
        v_primary_house_id := v_house_id;
      end if;
    end loop;
  end loop;

  if v_primary_farm_id is null or v_primary_house_id is null then
    raise exception 'At least one house is required to initialize a batch';
  end if;

  insert into public.batches (
    org_id, branch_id, farm_id, house_id, batch_code, source, supplier_name,
    purchase_date, placement_date, total_count, purchase_cost_per_bird,
    transport_cost, other_cost, status
  )
  values (
    p_org_id,
    v_branch_id,
    v_primary_farm_id,
    v_primary_house_id,
    v_batch_code,
    (p_intake_batch->>'source')::public.flock_source,
    nullif(p_intake_batch->>'supplier_name', ''),
    nullif(p_intake_batch->>'purchase_date', '')::date,
    v_placement_date,
    v_total_count,
    v_cost_per_bird,
    coalesce(nullif(p_intake_batch->>'transport_cost', '')::numeric(12,2), 0),
    coalesce(nullif(p_intake_batch->>'other_cost', '')::numeric(12,2), 0),
    'active'
  )
  returning id into v_batch_id;

  for v_farm in select value from jsonb_array_elements(coalesce(p_farms, '[]'::jsonb))
  loop
    select id into v_farm_id
    from public.farms
    where org_id = p_org_id
      and branch_id = v_branch_id
      and name = v_farm->>'name'
    order by created_at desc
    limit 1;

    for v_house in select value from jsonb_array_elements(coalesce(v_farm->'houses', '[]'::jsonb))
    loop
      select id into v_house_id
      from public.houses
      where org_id = p_org_id
        and farm_id = v_farm_id
        and name = v_house->>'name'
      order by created_at desc
      limit 1;

      for v_flock in select value from jsonb_array_elements(coalesce(v_house->'flocks', '[]'::jsonb))
      loop
        insert into public.flocks (
          flock_code, flock_type, source, placement_date, initial_count, current_count,
          age_at_placement_days, purchase_cost_per_bird, intake_batch_id, batch_id,
          house_id, farm_id, org_id
        )
        values (
          'FLK-' || upper(substring(md5(random()::text), 1, 5)),
          'broiler'::public.flock_type,
          (p_intake_batch->>'source')::public.flock_source,
          v_placement_date,
          greatest(coalesce(nullif(v_house->>'capacity', '')::integer, v_total_count, 1), 1),
          greatest(coalesce(nullif(v_house->>'capacity', '')::integer, v_total_count, 1), 1),
          0,
          v_cost_per_bird,
          v_bib_id,
          v_batch_id,
          v_house_id,
          v_farm_id,
          p_org_id
        )
        returning id into v_flock_id;
      end loop;
    end loop;
  end loop;

  insert into public.profiles (id, org_id, role, full_name, phone)
  values (
    (p_manager->>'user_id')::uuid,
    p_org_id,
    'farm_manager',
    p_manager->>'full_name',
    nullif(p_manager->>'phone', '')
  );

  insert into public.user_branch_access (profile_id, branch_id)
  values ((p_manager->>'user_id')::uuid, v_branch_id);

  return jsonb_build_object(
    'branchId', v_branch_id,
    'bibId', v_bib_id,
    'batchId', v_batch_id,
    'farmIds', to_jsonb(v_created_farm_ids)
  );
end;
$$;

drop index if exists public.idx_batches_flock_id;

alter table public.batches
drop constraint if exists batches_flock_id_fkey;

alter table public.batches
drop column if exists flock_id;
