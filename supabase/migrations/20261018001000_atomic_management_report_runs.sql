-- Service-only retry claims; saved runs remain immutable. No historical rewrite.
create table public.management_report_operations (
  org_id uuid not null references public.organizations(id),
  operation_key text not null check (length(operation_key) between 8 and 180),
  actor_id uuid not null references public.profiles(id),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  request jsonb not null,
  actor_role text not null,
  status text not null check (status in ('pending','completed','failed')),
  claim_token uuid not null default gen_random_uuid(),
  lease_until timestamptz not null,
  run_id uuid references public.management_report_runs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id,operation_key)
);
alter table public.management_report_operations enable row level security;
revoke all on public.management_report_operations from public,anon,authenticated;
grant all on public.management_report_operations to service_role;

create function public.assert_management_report_authority(p_org uuid,p_actor uuid,p_request jsonb)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_role text; v_recipient uuid; v_recipient_role text; v_schedule public.management_report_schedules;
  v_farm uuid:=nullif(p_request->'scope'->>'farmId','')::uuid;
begin
  select role into v_role from public.profiles where id=p_actor and org_id=p_org and is_active for share;
  if v_role is null or v_role not in ('ceo','farm_manager') then raise exception 'Current report authority is required.' using errcode='42501'; end if;
  if jsonb_typeof(p_request->'recipientIds') is distinct from 'array'
    or not (p_request->'recipientIds' @> jsonb_build_array(p_actor::text)) then
    raise exception 'The report creator must be a recipient.' using errcode='22023'; end if;
  if v_farm is not null and not exists(select 1 from public.farms where id=v_farm and org_id=p_org) then
    raise exception 'Report farm is unavailable.' using errcode='42501'; end if;
  for v_recipient in select value::uuid from jsonb_array_elements_text(p_request->'recipientIds') loop
    select role into v_recipient_role from public.profiles where id=v_recipient and org_id=p_org and is_active for share;
    if v_recipient_role is null or v_recipient_role not in ('ceo','farm_manager') then
      raise exception 'Every report recipient must retain current access.' using errcode='42501'; end if;
    if v_recipient_role='farm_manager' then
      if v_farm is null then raise exception 'Choose one assigned farm for a Farm Manager report.' using errcode='42501'; end if;
      perform 1 from public.user_farm_access where org_id=p_org and profile_id=v_recipient and farm_id=v_farm
        and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()) for share;
      if not found then raise exception 'Report farm assignment changed.' using errcode='42501'; end if;
    end if;
  end loop;
  if p_request->>'scheduleId' is not null then
    select * into v_schedule from public.management_report_schedules where id=(p_request->>'scheduleId')::uuid and org_id=p_org for update;
    if not found or not v_schedule.is_active or v_schedule.created_by<>p_actor or v_role<>'ceo'
      or v_schedule.scope is distinct from p_request->'scope'
      or not (to_jsonb(v_schedule.recipient_ids) @> (p_request->'recipientIds') and (p_request->'recipientIds') @> to_jsonb(v_schedule.recipient_ids)) then
      raise exception 'Report schedule authority or recipients changed.' using errcode='42501'; end if;
    if p_request->>'scheduleRevision' is not null and (p_request->>'scheduleRevision')::timestamptz is distinct from v_schedule.updated_at then
      raise exception 'Report schedule changed; retry with its current settings.' using errcode='40001'; end if;
  end if;
  return v_role;
end $$;

create function public.claim_management_report(p_org uuid,p_actor uuid,p_key text,p_hash text,p_request jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare op public.management_report_operations; v_role text; v_token uuid:=gen_random_uuid();
begin
  -- The operation row is always locked before profiles/schedules, including finalization.
  insert into public.management_report_operations(org_id,operation_key,actor_id,payload_hash,request,actor_role,status,claim_token,lease_until)
    values(p_org,p_key,p_actor,p_hash,p_request,'pending','pending',v_token,clock_timestamp()+interval '5 minutes')
    on conflict do nothing;
  select * into op from public.management_report_operations where org_id=p_org and operation_key=p_key for update;
  if op.actor_id<>p_actor then raise exception 'Report operation is outside your access.' using errcode='42501'; end if;
  if op.payload_hash<>p_hash or op.request is distinct from p_request then raise exception 'Report retry payload changed.' using errcode='22023'; end if;
  v_role:=public.assert_management_report_authority(p_org,p_actor,case when op.status='completed' then p_request-'scheduleRevision' else p_request end);
  if op.status='completed' then return jsonb_build_object('status','completed','run_id',op.run_id); end if;
  if op.claim_token<>v_token and op.lease_until>clock_timestamp() then return jsonb_build_object('status','busy'); end if;
  if p_request->>'scheduleId' is not null and exists(select 1 from public.management_report_schedules
    where id=(p_request->>'scheduleId')::uuid and next_run_at>now()) then
    raise exception 'Report schedule is not due.' using errcode='22023'; end if;
  update public.management_report_operations set status='pending',actor_role=v_role,claim_token=v_token,
    lease_until=clock_timestamp()+interval '5 minutes',updated_at=now() where org_id=p_org and operation_key=p_key;
  return jsonb_build_object('status','claimed','claim_token',v_token);
end $$;

create function public.finish_management_report(p_org uuid,p_actor uuid,p_key text,p_token uuid,p_snapshot jsonb,p_snapshot_hash text,p_organization text,p_next_run timestamptz default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare op public.management_report_operations; v_role text; v_id uuid; r jsonb;
begin
  select * into op from public.management_report_operations where org_id=p_org and operation_key=p_key for update;
  if not found or op.actor_id<>p_actor then raise exception 'Report operation unavailable.' using errcode='42501'; end if;
  v_role:=public.assert_management_report_authority(p_org,p_actor,case when op.status='completed' then op.request-'scheduleRevision' else op.request end);
  if op.status='completed' then return op.run_id; end if;
  if op.claim_token<>p_token or op.status<>'pending' or op.lease_until<=clock_timestamp() then
    raise exception 'Report claim expired or changed; retry.' using errcode='40001'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or p_snapshot_hash is null or p_snapshot_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid report snapshot.' using errcode='22023'; end if;
  r:=op.request;
  insert into public.management_report_runs(org_id,schedule_id,requested_by,requested_role,report_name,period_from,period_to,
    scope,recipient_ids,organization_name,report_snapshot,snapshot_sha256,report_version,status,generated_at)
  values(p_org,(r->>'scheduleId')::uuid,p_actor,v_role,r->>'name',(r->>'periodFrom')::date,(r->>'periodTo')::date,
    r->'scope',array(select value::uuid from jsonb_array_elements_text(r->'recipientIds')),p_organization,p_snapshot,p_snapshot_hash,r->>'version','completed',now())
  returning id into v_id;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,operation,source,entity_table,entity_id,reason,metadata)
  values(p_org,p_actor,v_role,'management_report.generated','execute','semantic','management_report_runs',v_id::text,
    'Generated an immutable management report.',jsonb_build_object('snapshotSha256',p_snapshot_hash,'reportVersion',r->>'version','operationKey',p_key));
  update public.management_report_operations set status='completed',run_id=v_id,updated_at=now() where org_id=p_org and operation_key=p_key;
  if r->>'scheduleId' is not null then
    if p_next_run is null or p_next_run<=now() then raise exception 'Invalid next report time.' using errcode='22023'; end if;
    update public.management_report_schedules set last_run_at=now(),next_run_at=p_next_run,updated_at=now() where id=(r->>'scheduleId')::uuid;
  end if;
  return v_id;
end $$;

create function public.fail_management_report(p_org uuid,p_actor uuid,p_key text,p_token uuid,p_message text,p_organization text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare op public.management_report_operations; r jsonb; v_id uuid;
begin
  select * into op from public.management_report_operations where org_id=p_org and operation_key=p_key for update;
  if not found or op.actor_id<>p_actor then raise exception 'Report operation unavailable.' using errcode='42501'; end if;
  -- A lost successful response must not append a contradictory failed report.
  if op.status='completed' then return jsonb_build_object('status','completed','run_id',op.run_id); end if;
  if op.claim_token<>p_token or op.status<>'pending' then return jsonb_build_object('status','superseded'); end if;
  r:=op.request;
  insert into public.management_report_runs(org_id,schedule_id,requested_by,requested_role,report_name,period_from,period_to,scope,
    recipient_ids,organization_name,report_version,status,failure_message)
  values(p_org,(r->>'scheduleId')::uuid,p_actor,op.actor_role,r->>'name',(r->>'periodFrom')::date,(r->>'periodTo')::date,r->'scope',
    array(select value::uuid from jsonb_array_elements_text(r->'recipientIds')),p_organization,r->>'version','failed',left(p_message,500)) returning id into v_id;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,operation,source,entity_table,entity_id,reason)
  values(p_org,p_actor,op.actor_role,'management_report.failed','execute','semantic','management_report_runs',v_id::text,'Management report generation failed.');
  update public.management_report_operations set status='failed',lease_until=case when r->>'scheduleId' is null then clock_timestamp() else clock_timestamp()+interval '1 hour' end,updated_at=now()
    where org_id=p_org and operation_key=p_key;
  return jsonb_build_object('status','failed','run_id',v_id);
end $$;

revoke all on function public.assert_management_report_authority(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.claim_management_report(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.finish_management_report(uuid,uuid,text,uuid,jsonb,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.fail_management_report(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_management_report(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.finish_management_report(uuid,uuid,text,uuid,jsonb,text,text,timestamptz) to service_role;
grant execute on function public.fail_management_report(uuid,uuid,text,uuid,text,text) to service_role;
