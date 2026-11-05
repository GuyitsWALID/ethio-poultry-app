-- Schedule definition changes and semantic audit evidence commit together.
create function public.create_management_report_schedule(p_org uuid,p_actor uuid,p_values jsonb,p_next_run timestamptz)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text; v_row public.management_report_schedules;
begin
  v_role:=public.assert_management_report_authority(p_org,p_actor,p_values);
  if v_role<>'ceo' then raise exception 'Only the tenant CEO can schedule management reports.' using errcode='42501'; end if;
  if p_values->>'cadence' not in ('weekly','monthly')
    or (p_values->>'runDay')::integer not between 1 and (case when p_values->>'cadence'='weekly' then 7 else 28 end)
    or (p_values->>'runHour')::integer not between 0 and 23
    or (p_values->>'lookbackDays')::integer not between 1 and 366
    or jsonb_typeof(p_values->'scope') is distinct from 'object'
    or jsonb_array_length(p_values->'recipientIds')>26
    or p_next_run is null or p_next_run<=clock_timestamp() then
    raise exception 'Invalid report schedule settings.' using errcode='22023'; end if;
  insert into public.management_report_schedules(org_id,created_by,name,cadence,run_day,run_hour,lookback_days,scope,recipient_ids,next_run_at)
  values(p_org,p_actor,trim(p_values->>'name'),p_values->>'cadence',(p_values->>'runDay')::smallint,
    (p_values->>'runHour')::smallint,(p_values->>'lookbackDays')::smallint,p_values->'scope',
    array(select distinct value::uuid from jsonb_array_elements_text(p_values->'recipientIds')),p_next_run)
  returning * into v_row;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,operation,source,entity_table,entity_id,reason,after_values)
  values(p_org,p_actor,v_role,'management_report.schedule_created','insert','semantic','management_report_schedules',v_row.id::text,
    'Created a management report schedule.',to_jsonb(v_row));
  return to_jsonb(v_row);
end $$;

create function public.set_management_report_schedule_active(p_org uuid,p_actor uuid,p_id uuid,p_active boolean,p_expected_revision timestamptz,p_next_run timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_before public.management_report_schedules; v_after public.management_report_schedules; v_role text;
begin
  -- Match generation's profile-before-schedule lock order.
  select role into v_role from public.profiles where id=p_actor and org_id=p_org and is_active for share;
  if v_role is distinct from 'ceo' then raise exception 'Only the tenant CEO can change report schedules.' using errcode='42501'; end if;
  select * into v_before from public.management_report_schedules where id=p_id and org_id=p_org for update;
  if not found then raise exception 'Report schedule not found.' using errcode='42501'; end if;
  if p_expected_revision is null or v_before.updated_at is distinct from p_expected_revision then
    raise exception 'Report schedule changed; refresh before trying again.' using errcode='40001'; end if;
  if p_active is null then raise exception 'Choose whether the schedule is active.' using errcode='22023'; end if;
  if v_before.is_active=p_active then return to_jsonb(v_before); end if;
  if p_active then
    perform public.assert_management_report_authority(p_org,v_before.created_by,
      jsonb_build_object('scope',v_before.scope,'recipientIds',to_jsonb(v_before.recipient_ids)));
    if not exists(select 1 from public.profiles where id=v_before.created_by and org_id=p_org and role='ceo' and is_active) then
      raise exception 'The schedule creator must retain current CEO authority.' using errcode='42501'; end if;
    if p_next_run is null or p_next_run<=clock_timestamp() then raise exception 'Invalid next report time.' using errcode='22023'; end if;
  end if;
  update public.management_report_schedules set is_active=p_active,
    next_run_at=case when p_active then p_next_run else next_run_at end,
    updated_at=greatest(clock_timestamp(),v_before.updated_at+interval '1 microsecond')
    where id=p_id returning * into v_after;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,operation,source,entity_table,entity_id,reason,before_values,after_values)
  values(p_org,p_actor,v_role,case when p_active then 'management_report.schedule_resumed' else 'management_report.schedule_paused' end,
    'update','semantic','management_report_schedules',p_id::text,
    case when p_active then 'Resumed the report schedule.' else 'Paused the report schedule.' end,to_jsonb(v_before),to_jsonb(v_after));
  return to_jsonb(v_after);
end $$;

revoke all on function public.create_management_report_schedule(uuid,uuid,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.set_management_report_schedule_active(uuid,uuid,uuid,boolean,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.create_management_report_schedule(uuid,uuid,jsonb,timestamptz) to service_role;
grant execute on function public.set_management_report_schedule_active(uuid,uuid,uuid,boolean,timestamptz,timestamptz) to service_role;
revoke insert,update,delete on public.management_report_schedules from service_role;
