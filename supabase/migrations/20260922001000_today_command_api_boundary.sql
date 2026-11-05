-- Give the Today HTTP adapter one authenticated, atomic database seam. The
-- dispatcher owns replay, feature, assignment, date-window, dependency, and
-- conflict checks before delegating to the existing authoritative mutations.

create or replace function public.today_resource_revision(
  p_resource_type text,
  p_resource_id uuid,
  p_work_date date default null
) returns text
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
begin
  if p_resource_type = 'daily_record' then
    select to_jsonb(d) into v_payload
    from public.daily_farm_records d
    where d.id = p_resource_id;
  elsif p_resource_type = 'feed_day' then
    select jsonb_build_object(
      'sessions', coalesce((
        select jsonb_agg(to_jsonb(s) order by s.id)
        from public.feeding_session_records s
        where s.flock_id = p_resource_id and s.record_date = p_work_date
      ), '[]'::jsonb),
      'closures', coalesce((
        select jsonb_agg(to_jsonb(c) order by c.id)
        from public.feed_day_closures c
        where c.flock_id = p_resource_id and c.record_date = p_work_date
      ), '[]'::jsonb)
    ) into v_payload;
  elsif p_resource_type = 'operating_day' then
    select jsonb_build_object(
      'day', coalesce((
        select to_jsonb(d) from public.farm_operating_days d
        where d.farm_id = p_resource_id and d.operating_date = p_work_date
      ), jsonb_build_object('farm_id', p_resource_id, 'operating_date', p_work_date, 'status', 'missing')),
      'flocks', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'status', f.status, 'updated_at', f.updated_at) order by f.id)
        from public.flocks f where f.farm_id = p_resource_id and f.placement_date <= p_work_date
      ), '[]'::jsonb),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('id', d.id, 'updated_at', d.updated_at, 'voided_at', d.voided_at) order by d.id)
        from public.daily_farm_records d join public.flocks f on f.id = d.flock_id
        where f.farm_id = p_resource_id and d.record_date = p_work_date
      ), '[]'::jsonb),
      'feed', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'status', c.status, 'updated_at', c.updated_at) order by c.id)
        from public.feed_day_closures c join public.flocks f on f.id = c.flock_id
        where f.farm_id = p_resource_id and c.record_date = p_work_date
      ), '[]'::jsonb),
      'attestations', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'fingerprint', a.source_fingerprint, 'updated_at', a.updated_at, 'superseded_at', a.superseded_at) order by a.id)
        from public.daily_task_attestations a
        where a.farm_id = p_resource_id and a.work_date = p_work_date
      ), '[]'::jsonb)
    ) into v_payload;
  elsif p_resource_type = 'flock' then
    select to_jsonb(f) into v_payload from public.flocks f where f.id = p_resource_id;
  else
    raise exception 'Unsupported revision resource type.' using errcode = '22023';
  end if;
  if v_payload is null then
    raise exception 'Revision resource not found.' using errcode = 'P0002';
  end if;
  return public.canonical_today_payload_hash(v_payload);
end
$$;

create or replace function public.dispatch_today_command_v1(
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
  v_command_id uuid;
  v_command_type text;
  v_farm_id uuid;
  v_flock_id uuid;
  v_work_date date;
  v_payload jsonb;
  v_hash text;
  v_receipt public.client_operation_receipts;
  v_today date := (now() at time zone 'Africa/Addis_Ababa')::date;
  v_now_time time := (now() at time zone 'Africa/Addis_Ababa')::time;
  v_cutoff date;
  v_result jsonb;
  v_tablet_value text;
  v_server_value text;
  v_destination text;
begin
  if coalesce((p_command->>'schema_version')::integer, 0) <> 1 then
    raise exception 'Unsupported Today command version.' using errcode = '22023';
  end if;
  v_command_id := nullif(p_command->>'command_id', '')::uuid;
  v_command_type := nullif(btrim(p_command->>'type'), '');
  v_farm_id := nullif(p_command->>'farm_id', '')::uuid;
  v_flock_id := nullif(p_command->>'flock_id', '')::uuid;
  v_work_date := nullif(p_command->>'work_date', '')::date;
  v_payload := coalesce(p_command->'payload', '{}'::jsonb);
  if v_command_id is null or v_command_type is null or v_farm_id is null or v_work_date is null then
    raise exception 'Command ID, type, farm, and work date are required.' using errcode = '22023';
  end if;
  if v_command_type not in (
    'save_daily_record', 'save_feed_session', 'close_feed_day',
    'record_mortality_event', 'record_health_event', 'complete_vaccination',
    'confirm_no_activity', 'record_stock_receipt', 'record_sale',
    'record_expense', 'update_assigned_action', 'finish_operating_day'
  ) then
    raise exception 'Unsupported Today command type.' using errcode = '22023';
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

  -- A completed receipt is returned before mutable-state checks. This makes a
  -- network retry deterministic even if the original command closed the day.
  v_hash := public.canonical_today_payload_hash(p_command);
  select * into v_receipt
  from public.client_operation_receipts
  where org_id = v_org_id and actor_id = p_actor_id and command_id = v_command_id;
  if found then
    if v_receipt.payload_hash <> v_hash then
      raise exception 'This command ID was already used with a different payload.' using errcode = '22023';
    end if;
    if v_receipt.result is not null then return v_receipt.result; end if;
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

  begin
    if v_command_type = 'confirm_no_activity' then
      v_result := public.apply_daily_task_attestation_v1(
        p_actor_id, v_command_id, 1, v_command_type, p_command,
        v_farm_id, v_flock_id, v_work_date,
        v_payload->>'task_code', v_payload->>'source_fingerprint'
      );
    elsif v_command_type = 'finish_operating_day' then
      v_result := public.finish_farm_operating_day_v1(
        p_actor_id, v_command_id, 1, p_command, v_farm_id, v_work_date,
        p_command->>'expected_resource_revision'
      );
    else
      v_result := public.execute_today_command_v1(p_actor_id, p_command);
    end if;

    -- Return the revision the next edit must present, not a hash of an
    -- internal mutation result. Persist the normalized result so retries are
    -- byte-for-byte identical to the first response.
    if v_result->>'status' = 'applied' and v_command_type = 'save_daily_record' then
      v_server_value := public.today_resource_revision(
        'daily_record', split_part(v_result->>'source_ref', '/', 2)::uuid, null
      );
      v_result := jsonb_set(v_result, '{resource_revision}', to_jsonb(v_server_value), true);
    elsif v_result->>'status' = 'applied'
      and v_command_type in ('save_feed_session', 'close_feed_day') then
      v_server_value := public.today_resource_revision('feed_day', v_flock_id, v_work_date);
      v_result := jsonb_set(v_result, '{resource_revision}', to_jsonb(v_server_value), true);
    end if;
    if v_result->>'status' = 'applied' then
      update public.client_operation_receipts
      set result = v_result, completed_at = coalesce(completed_at, now())
      where org_id = v_org_id and actor_id = p_actor_id and command_id = v_command_id;
    end if;
    return v_result;
  exception when sqlstate '40001' then
    if v_command_type = 'confirm_no_activity' then
      v_tablet_value := v_payload->>'source_fingerprint';
      v_server_value := public.today_source_fingerprint(
        v_farm_id, v_flock_id, v_work_date, v_payload->>'task_code'
      );
      v_destination := '/app/today?farm_id=' || v_farm_id::text || '&date=' || v_work_date::text;
    elsif v_command_type = 'save_daily_record' and nullif(v_payload->>'daily_record_id', '') is not null then
      v_tablet_value := p_command->>'expected_resource_revision';
      v_server_value := public.today_resource_revision(
        'daily_record', (v_payload->>'daily_record_id')::uuid, null
      );
      v_destination := '/app/daily-records?date=' || v_work_date::text;
    elsif v_command_type in ('save_feed_session', 'close_feed_day') and v_flock_id is not null then
      v_tablet_value := p_command->>'expected_resource_revision';
      v_server_value := public.today_resource_revision('feed_day', v_flock_id, v_work_date);
      v_destination := '/app/feeding-log?date=' || v_work_date::text;
    elsif v_command_type = 'finish_operating_day' then
      v_tablet_value := p_command->>'expected_resource_revision';
      v_server_value := public.today_resource_revision('operating_day', v_farm_id, v_work_date);
      v_destination := '/app/today?farm_id=' || v_farm_id::text || '&date=' || v_work_date::text;
    else
      v_tablet_value := p_command->>'expected_resource_revision';
      v_server_value := null;
      v_destination := '/app/today?farm_id=' || v_farm_id::text || '&date=' || v_work_date::text;
    end if;
    return jsonb_build_object(
      'command_id', v_command_id,
      'status', 'conflict',
      'error_code', 'RESOURCE_CONFLICT',
      'conflict', jsonb_build_object(
        'tablet_value', v_tablet_value,
        'server_value', v_server_value,
        'correction_destination', v_destination
      )
    );
  end;
end
$$;

revoke all on function public.dispatch_today_command_v1(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.dispatch_today_command_v1(uuid, jsonb) to authenticated;

comment on function public.dispatch_today_command_v1(uuid, jsonb) is
  'Authenticated atomic seam for version-one Today commands, replay, authorization, dependencies, and structured conflicts.';
