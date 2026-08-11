-- Ensure batches.batch_code is always populated explicitly in CEO setup RPC.
-- Some environments may not have a default on public.batches.batch_code.

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
  v_batch_code text;
  v_farm_id uuid;
  v_house_id uuid;
  v_flock_id uuid;
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
  values (
    p_branch->>'name',
    p_branch->>'location',
    p_org_id
  )
  returning id into v_branch_id;

  insert into public.branch_intake_batches (
    org_id,
    branch_id,
    source,
    supplier_name,
    purchase_date,
    placement_date,
    total_count,
    purchase_cost_per_bird,
    transport_cost,
    other_cost,
    total_cost,
    status,
    notes
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

  for v_farm in
    select value from jsonb_array_elements(coalesce(p_farms, '[]'::jsonb))
  loop
    insert into public.farms (name, branch_id, org_id)
    values (
      v_farm->>'name',
      v_branch_id,
      p_org_id
    )
    returning id into v_farm_id;

    v_created_farm_ids := array_append(v_created_farm_ids, v_farm_id);

    for v_house in
      select value from jsonb_array_elements(coalesce(v_farm->'houses', '[]'::jsonb))
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

      for v_flock in
        select value from jsonb_array_elements(coalesce(v_house->'flocks', '[]'::jsonb))
      loop
        insert into public.flocks (
          flock_code,
          flock_type,
          source,
          placement_date,
          initial_count,
          current_count,
          age_at_placement_days,
          purchase_cost_per_bird,
          house_id,
          farm_id,
          org_id
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
          v_house_id,
          v_farm_id,
          p_org_id
        )
        returning id into v_flock_id;

        insert into public.batches (
          org_id,
          branch_id,
          farm_id,
          house_id,
          flock_id,
          batch_code,
          source,
          supplier_name,
          purchase_date,
          placement_date,
          total_count,
          purchase_cost_per_bird,
          transport_cost,
          other_cost,
          status
        )
        values (
          p_org_id,
          v_branch_id,
          v_farm_id,
          v_house_id,
          v_flock_id,
          public.generate_batch_code(),
          (p_intake_batch->>'source')::public.flock_source,
          nullif(p_intake_batch->>'supplier_name', ''),
          nullif(p_intake_batch->>'purchase_date', '')::date,
          v_placement_date,
          v_total_count,
          v_cost_per_bird,
          coalesce(nullif(p_intake_batch->>'transport_cost', '')::numeric(12,2), 0),
          coalesce(nullif(p_intake_batch->>'other_cost', '')::numeric(12,2), 0),
          'active'
        );
      end loop;
    end loop;
  end loop;

  insert into public.profiles (
    id,
    org_id,
    role,
    full_name,
    email
  )
  values (
    (p_manager->>'user_id')::uuid,
    p_org_id,
    'farm_manager',
    p_manager->>'full_name',
    p_manager->>'email'
  );

  insert into public.user_branch_access (profile_id, branch_id)
  values ((p_manager->>'user_id')::uuid, v_branch_id);

  return jsonb_build_object(
    'branchId', v_branch_id,
    'bibId', v_bib_id,
    'farmIds', to_jsonb(v_created_farm_ids)
  );
end;
$$;

