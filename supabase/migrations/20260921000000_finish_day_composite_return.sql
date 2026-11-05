-- Correct Finish Day's delegation to the existing close RPC. PostgreSQL
-- composite-returning functions must be selected as rows rather than assigned
-- as one scalar composite value.

create or replace function public.finish_farm_operating_day_v1(
  p_actor_id uuid,
  p_command_id uuid,
  p_schema_version integer,
  p_payload jsonb,
  p_farm_id uuid,
  p_operating_date date,
  p_expected_revision text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_hash text;
  v_current_revision text;
  v_receipt public.client_operation_receipts;
  v_flock record;
  v_fingerprint text;
  v_day public.farm_operating_days;
  v_result jsonb;
begin
  if p_schema_version <> 1 then
    raise exception 'Unsupported Today command version.' using errcode = '22023';
  end if;
  select org_id, role::text into v_org_id, v_role
  from public.profiles where id = p_actor_id and is_active;
  if v_org_id is null or v_role <> 'farm_manager' or auth.uid() is distinct from p_actor_id then
    raise exception 'Only the signed-in Farm Manager can finish the day.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.farms where id = p_farm_id and org_id = v_org_id
  ) or not exists (
    select 1 from public.user_farm_access a
    where a.org_id = v_org_id and a.profile_id = p_actor_id and a.farm_id = p_farm_id
      and a.revoked_at is null and a.starts_at <= now()
      and (a.expires_at is null or a.expires_at > now())
  ) then
    raise exception 'An active farm assignment is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_farm_id::text || ':' || p_operating_date::text, 0));
  v_hash := public.canonical_today_payload_hash(p_payload);
  select * into v_receipt from public.client_operation_receipts
  where org_id = v_org_id and actor_id = p_actor_id and command_id = p_command_id
  for update;
  if found then
    if v_receipt.payload_hash <> v_hash then
      raise exception 'This command ID was already used with a different payload.' using errcode = '22023';
    end if;
    if v_receipt.result is not null then return v_receipt.result; end if;
  else
    insert into public.client_operation_receipts(
      org_id, actor_id, command_id, schema_version, command_type, payload_hash
    ) values (
      v_org_id, p_actor_id, p_command_id, p_schema_version, 'finish_operating_day', v_hash
    ) returning * into v_receipt;
  end if;

  v_current_revision := public.today_resource_revision('operating_day', p_farm_id, p_operating_date);
  if v_current_revision <> p_expected_revision then
    raise exception 'The operating day changed. Refresh before finishing.' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.farm_operating_days
    where farm_id = p_farm_id and operating_date = p_operating_date and status = 'closed'
  ) then
    raise exception 'This operating day is already closed.' using errcode = '23505';
  end if;

  for v_flock in
    select f.id
    from public.flocks f
    where f.org_id = v_org_id and f.farm_id = p_farm_id
      and f.status = 'active' and f.placement_date <= p_operating_date
  loop
    if not exists (
      select 1 from public.daily_farm_records d
      where d.org_id = v_org_id and d.flock_id = v_flock.id
        and d.record_date = p_operating_date and d.voided_at is null
    ) then
      raise exception 'A Daily Record is still missing.' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.feed_day_closures c
      where c.org_id = v_org_id and c.flock_id = v_flock.id
        and c.record_date = p_operating_date and c.status = 'closed'
    ) then
      raise exception 'A feeding day is still open.' using errcode = '23514';
    end if;

    v_fingerprint := public.today_source_fingerprint(p_farm_id, v_flock.id, p_operating_date, 'health_deaths');
    if not exists (
      select 1 from public.mortality_events m
      where m.org_id = v_org_id and m.flock_id = v_flock.id and m.record_date = p_operating_date
    ) and not exists (
      select 1 from public.health_events h
      where h.org_id = v_org_id and h.flock_id = v_flock.id and h.event_date = p_operating_date
        and h.voided_at is null
    ) and not exists (
      select 1 from public.daily_farm_records d
      where d.org_id = v_org_id and d.flock_id = v_flock.id and d.record_date = p_operating_date
        and d.voided_at is null and coalesce(d.deaths, 0) > 0
    ) and not exists (
      select 1 from public.daily_task_attestations a
      where a.org_id = v_org_id and a.farm_id = p_farm_id and a.flock_id = v_flock.id
        and a.work_date = p_operating_date and a.task_code = 'health_deaths'
        and a.superseded_at is null and a.source_fingerprint = v_fingerprint
    ) then
      raise exception 'Confirm health and deaths for every flock.' using errcode = '23514';
    end if;

    v_fingerprint := public.today_source_fingerprint(p_farm_id, v_flock.id, p_operating_date, 'routine_supplies');
    if not exists (
      select 1 from public.stock_ledger s
      where s.org_id = v_org_id and s.farm_id = p_farm_id and s.flock_id = v_flock.id
        and s.transaction_date = p_operating_date and s.source_kind = 'daily_record_usage'
    ) and not exists (
      select 1 from public.daily_task_attestations a
      where a.org_id = v_org_id and a.farm_id = p_farm_id and a.flock_id = v_flock.id
        and a.work_date = p_operating_date and a.task_code = 'routine_supplies'
        and a.superseded_at is null and a.source_fingerprint = v_fingerprint
    ) then
      raise exception 'Confirm routine supplies for every flock.' using errcode = '23514';
    end if;
  end loop;

  select * into v_day
  from public.close_farm_operating_day(p_farm_id, p_operating_date, '[]'::jsonb);
  v_result := jsonb_build_object(
    'command_id', p_command_id,
    'status', 'applied',
    'source_ref', 'farm_operating_days/' || v_day.id::text,
    'resource_revision', public.today_resource_revision('operating_day', p_farm_id, p_operating_date),
    'operating_day_revision', public.today_resource_revision('operating_day', p_farm_id, p_operating_date)
  );
  update public.client_operation_receipts
  set result = v_result, completed_at = now()
  where id = v_receipt.id;
  return v_result;
end
$$;

revoke all on function public.finish_farm_operating_day_v1(uuid, uuid, integer, jsonb, uuid, date, text)
  from public, anon, authenticated;
grant execute on function public.finish_farm_operating_day_v1(uuid, uuid, integer, jsonb, uuid, date, text)
  to authenticated;
