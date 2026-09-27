-- Add monthly physical counts to the Today command boundary without creating
-- a second inventory mutation path. The command delegates to the existing
-- authoritative record_inventory_count_session function and wraps it in the
-- same receipt, assignment, date-window, and dependency guarantees as Today.

alter function public.dispatch_today_command_v1(uuid, jsonb)
  rename to dispatch_today_command_v1_pre_stock_count_v1;

revoke all on function public.dispatch_today_command_v1_pre_stock_count_v1(uuid, jsonb)
  from public, anon, authenticated;

create function public.execute_today_stock_count_v1(
  p_actor_id uuid,
  p_command jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_org_id uuid;
  v_command_id uuid := nullif(p_command->>'command_id', '')::uuid;
  v_farm_id uuid := nullif(p_command->>'farm_id', '')::uuid;
  v_work_date date := nullif(p_command->>'work_date', '')::date;
  v_payload jsonb := coalesce(p_command->'payload', '{}'::jsonb);
  v_warehouse_id uuid;
  v_rows jsonb;
  v_hash text;
  v_receipt public.client_operation_receipts;
  v_domain_result jsonb;
  v_result jsonb;
begin
  select org_id into v_org_id
  from public.profiles
  where id = p_actor_id and is_active and role = 'farm_manager';
  if v_org_id is null then
    raise exception 'Only an active Farm Manager can submit Today work.' using errcode = '42501';
  end if;

  v_warehouse_id := nullif(v_payload->>'warehouse_id', '')::uuid;
  v_rows := coalesce((
    select jsonb_agg(jsonb_build_object(
      'itemId', row_value->>'item_id',
      'countedQuantity', (row_value->>'counted_quantity')::numeric
    ))
    from jsonb_array_elements(coalesce(v_payload->'rows', '[]'::jsonb)) row_value
  ), '[]'::jsonb);
  if v_warehouse_id is null or jsonb_array_length(v_rows) = 0 then
    raise exception 'Choose a warehouse and count every stocked item.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.warehouses w
    join public.farms f on f.id = v_farm_id and f.org_id = v_org_id
    where w.id = v_warehouse_id and w.org_id = v_org_id and w.status = 'active'
      and (w.farm_id = v_farm_id or (w.farm_id is null and w.branch_id = f.branch_id))
  ) then
    raise exception 'The warehouse is outside the selected farm.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('today-command:' || v_command_id::text, 0));
  v_hash := public.canonical_today_payload_hash(p_command);
  select * into v_receipt
  from public.client_operation_receipts
  where org_id = v_org_id and actor_id = p_actor_id and command_id = v_command_id
  for update;
  if found then
    if v_receipt.payload_hash <> v_hash then
      raise exception 'This command ID was already used with a different payload.' using errcode = '22023';
    end if;
    if v_receipt.result is not null then return v_receipt.result; end if;
  else
    insert into public.client_operation_receipts(
      org_id, actor_id, command_id, schema_version, command_type, payload_hash
    ) values (v_org_id, p_actor_id, v_command_id, 1, 'record_stock_count', v_hash)
    returning * into v_receipt;
  end if;

  v_domain_result := public.record_inventory_count_session(
    p_actor_id,
    v_warehouse_id,
    v_work_date,
    v_rows,
    nullif(btrim(v_payload->>'notes'), ''),
    v_command_id::text
  );
  v_result := jsonb_build_object(
    'command_id', v_command_id,
    'status', 'applied',
    'source_ref', 'inventory_count_sessions/' || (v_domain_result->>'session_id'),
    'resource_revision', public.canonical_today_payload_hash(v_domain_result),
    'operating_day_revision', public.today_resource_revision('operating_day', v_farm_id, v_work_date)
  );
  update public.client_operation_receipts
  set result = v_result, completed_at = now()
  where id = v_receipt.id;
  return v_result;
end
$$;

create function public.dispatch_today_command_v1(
  p_actor_id uuid,
  p_command jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_org_id uuid;
  v_role text;
  v_enabled boolean;
  v_lock_time time;
  v_grace_days integer;
  v_farm_id uuid;
  v_work_date date;
  v_today date := (now() at time zone 'Africa/Addis_Ababa')::date;
  v_now_time time := (now() at time zone 'Africa/Addis_Ababa')::time;
  v_cutoff date;
begin
  if p_command->>'type' <> 'record_stock_count' then
    return public.dispatch_today_command_v1_pre_stock_count_v1(p_actor_id, p_command);
  end if;
  if coalesce((p_command->>'schema_version')::integer, 0) <> 1 then
    raise exception 'Unsupported Today command version.' using errcode = '22023';
  end if;
  v_farm_id := nullif(p_command->>'farm_id', '')::uuid;
  v_work_date := nullif(p_command->>'work_date', '')::date;
  if nullif(p_command->>'command_id', '') is null or v_farm_id is null or v_work_date is null then
    raise exception 'Command ID, type, farm, and work date are required.' using errcode = '22023';
  end if;

  select p.org_id, p.role::text, o.today_workspace_enabled,
    o.operational_day_lock_time, o.operational_day_lock_grace_days
  into v_org_id, v_role, v_enabled, v_lock_time, v_grace_days
  from public.profiles p
  join public.organizations o on o.id = p.org_id
  where p.id = p_actor_id and p.is_active;
  if auth.uid() is distinct from p_actor_id or v_org_id is null or v_role <> 'farm_manager' then
    raise exception 'Only the signed-in Farm Manager can submit Today work.' using errcode = '42501';
  end if;
  if not v_enabled then
    raise exception 'The Today workspace is not enabled for this organization.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.farms f where f.id = v_farm_id and f.org_id = v_org_id
  ) or not exists (
    select 1 from public.user_farm_access a
    where a.org_id = v_org_id and a.profile_id = p_actor_id and a.farm_id = v_farm_id
      and a.revoked_at is null and a.starts_at <= now()
      and (a.expires_at is null or a.expires_at > now())
  ) then
    raise exception 'An active farm assignment is required.' using errcode = '42501';
  end if;

  if v_work_date > v_today then
    raise exception 'Future operating work cannot be recorded from Today.' using errcode = '22023';
  end if;
  v_cutoff := v_today - case when v_now_time >= v_lock_time then v_grace_days else v_grace_days + 1 end;
  if v_work_date <= v_cutoff then
    raise exception 'This date is outside the operating window and has expired.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.farm_operating_days d
    where d.org_id = v_org_id and d.farm_id = v_farm_id and d.operating_date = v_work_date
      and d.status in ('closed', 'locked')
  ) then
    raise exception 'This operating day is not open.' using errcode = '55000';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_command->'depends_on', '[]'::jsonb)) dependency(command_id)
    where not exists (
      select 1 from public.client_operation_receipts r
      where r.org_id = v_org_id and r.actor_id = p_actor_id
        and r.command_id = dependency.command_id::uuid
        and r.result->>'status' = 'applied'
    )
  ) then
    raise exception 'A required earlier command is not complete.' using errcode = '23514';
  end if;
  return public.execute_today_stock_count_v1(p_actor_id, p_command);
end
$$;

revoke all on function public.execute_today_stock_count_v1(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.dispatch_today_command_v1(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.execute_today_stock_count_v1(uuid, jsonb) to service_role;
grant execute on function public.dispatch_today_command_v1(uuid, jsonb) to authenticated;

comment on function public.dispatch_today_command_v1(uuid, jsonb) is
  'Authenticated Today command seam including idempotent physical stock counts.';
