alter table public.operational_actions add column revision bigint not null default 0;
create function public.advance_operational_action_revision() returns trigger language plpgsql as $$
begin
  -- Polling freshness alone must not invalidate the manager's open form.
  new.revision:=old.revision + case when
    (to_jsonb(new)-array['revision','updated_at','source_last_seen_at']) is distinct from
    (to_jsonb(old)-array['revision','updated_at','source_last_seen_at']) then 1 else 0 end;
  return new;
end $$;
create trigger operational_action_revision before update on public.operational_actions
for each row execute function public.advance_operational_action_revision();

create function public.apply_operational_action_transition(
  p_actor_id uuid,p_org_id uuid,p_action_id uuid,p_expected_revision bigint,
  p_changes jsonb,p_event_type text,p_note text default null,p_evidence text default null,
  p_automated boolean default false,p_support_session_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_actor public.profiles; v_before public.operational_actions; v_after public.operational_actions;
  v_event public.operational_action_events; v_support boolean:=false; v_status text; v_owner uuid;
begin
  select * into v_actor from public.profiles where id=p_actor_id and is_active;
  if not found then raise exception 'An active account is required.' using errcode='42501'; end if;
  if v_actor.role::text='system_admin' and p_support_session_id is not null then
    select exists(select 1 from public.break_glass_sessions where id=p_support_session_id
      and administrator_id=p_actor_id and target_org_id=p_org_id and revoked_at is null
      and started_at<=now() and expires_at>now()) into v_support;
  end if;
  if not v_support and (v_actor.org_id is distinct from p_org_id or coalesce(v_actor.role::text,'') not in ('ceo','farm_manager')) then
    raise exception 'This action is outside your active assignment.' using errcode='42501'; end if;
  select * into v_before from public.operational_actions where id=p_action_id and org_id=p_org_id for update;
  if not found then raise exception 'Action not found.' using errcode='P0002'; end if;
  if p_expected_revision is null or v_before.revision<>p_expected_revision then
    raise exception 'Action changed. Refresh before continuing.' using errcode='40001'; end if;
  if jsonb_typeof(p_changes) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_changes) k
    where k not in ('status','owner_id','assigned_by','assigned_at','due_at','acknowledged_by','acknowledged_at',
      'resolution_summary','resolution_evidence','resolution_submitted_by','resolution_submitted_at',
      'escalated_at','escalation_reason','source_resolved_at','source_last_seen_at','source_name','source_route',
      'title','context','severity','farm_id','warehouse_id','updated_at')) then
    raise exception 'Invalid action fields.' using errcode='22023'; end if;
  v_status:=coalesce(p_changes->>'status',v_before.status);
  if p_automated then
    if p_event_type is not null and p_event_type not in ('reopened','escalated') then
      raise exception 'Unsupported automatic action update.' using errcode='22023'; end if;
    if p_event_type is null and p_changes ? 'status' then
      raise exception 'Status changes require history.' using errcode='22023'; end if;
    if p_event_type='reopened' and (v_before.status<>'resolved' or v_status<>(case when v_before.owner_id is null then 'open' else 'assigned' end)) then
      raise exception 'Action changed. Refresh before continuing.' using errcode='40001'; end if;
    if p_event_type='escalated' and (v_before.status not in ('open','assigned','acknowledged','in_progress')
      or v_before.due_at>=now() or v_status<>'escalated') then
      raise exception 'Action changed. Refresh before continuing.' using errcode='40001'; end if;
  else
    if v_actor.role::text='farm_manager' then
      if not (exists(select 1 from public.user_farm_access where org_id=p_org_id and profile_id=p_actor_id
        and farm_id=v_before.farm_id and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()))
        or public.manager_has_effective_warehouse_access(p_actor_id,v_before.warehouse_id)) then
        raise exception 'This action is outside your active assignment.' using errcode='42501'; end if;
      if p_event_type<>'claimed' and v_before.owner_id is distinct from p_actor_id then
        raise exception 'This action must be assigned to you before you can update it.' using errcode='42501'; end if;
    end if;
    if v_before.status='resolved' then raise exception 'This action has already been verified and resolved.' using errcode='40001'; end if;
    if p_event_type in ('assigned','due_date_changed','verification_failed','system_verified') and v_actor.role::text<>'ceo' then
      raise exception 'Only the CEO can assign, change deadlines or verify actions.' using errcode='42501'; end if;
    if p_event_type='claimed' and (v_actor.role::text<>'farm_manager' or v_before.owner_id is not null
      or v_before.status not in ('open','escalated') or p_changes->>'owner_id' is distinct from p_actor_id::text) then
      raise exception 'Only an unassigned in-scope action can be claimed.' using errcode='40001'; end if;
    if p_event_type in ('assigned','claimed') then
      v_owner:=(p_changes->>'owner_id')::uuid;
      if v_status<>'assigned' or (v_before.farm_id is null and v_before.warehouse_id is null)
        or not exists(select 1 from public.profiles where id=v_owner and org_id=p_org_id and is_active and role::text='farm_manager')
        or (v_before.farm_id is not null and not exists(select 1 from public.user_farm_access where profile_id=v_owner
          and org_id=p_org_id and farm_id=v_before.farm_id and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now())))
        or (v_before.warehouse_id is not null and not public.manager_has_effective_warehouse_access(v_owner,v_before.warehouse_id)) then
        raise exception 'Choose a Farm Manager with an active assignment to the affected source.' using errcode='42501'; end if;
    elsif p_event_type='acknowledged' then
      if v_before.status not in ('assigned','escalated') or v_status<>'acknowledged' then
        raise exception 'Action changed. Refresh before continuing.' using errcode='40001'; end if;
    elsif p_event_type='work_started' then
      if v_before.status not in ('assigned','acknowledged','escalated') or v_status<>'in_progress' then
        raise exception 'Action changed. Refresh before continuing.' using errcode='40001'; end if;
    elsif p_event_type='resolution_submitted' then
      if v_before.status not in ('assigned','acknowledged','in_progress','escalated') or v_status<>'awaiting_verification' then
        raise exception 'Action changed. Refresh before continuing.' using errcode='40001'; end if;
    elsif p_event_type in ('verification_failed','system_verified') then
      if v_before.status<>'awaiting_verification' or v_status<>(case when p_event_type='system_verified' then 'resolved' else 'in_progress' end) then
        raise exception 'Action changed. Refresh before continuing.' using errcode='40001'; end if;
    elsif p_event_type<>'due_date_changed' or p_event_type is null then
      raise exception 'Unsupported action transition.' using errcode='22023';
    end if;
    if p_event_type in ('acknowledged','work_started','resolution_submitted','due_date_changed') and
      (p_note is null or length(btrim(p_note)) not between (case when p_event_type='resolution_submitted' then 8 else 4 end) and 2000) then
      raise exception 'A work note is required.' using errcode='22023'; end if;
  end if;
  select * into v_after from jsonb_populate_record(v_before,p_changes);
  update public.operational_actions set status=v_after.status,owner_id=v_after.owner_id,assigned_by=v_after.assigned_by,
    assigned_at=v_after.assigned_at,due_at=v_after.due_at,acknowledged_by=v_after.acknowledged_by,acknowledged_at=v_after.acknowledged_at,
    resolution_summary=v_after.resolution_summary,resolution_evidence=v_after.resolution_evidence,
    resolution_submitted_by=v_after.resolution_submitted_by,resolution_submitted_at=v_after.resolution_submitted_at,
    escalated_at=v_after.escalated_at,escalation_reason=v_after.escalation_reason,source_resolved_at=v_after.source_resolved_at,
    source_last_seen_at=v_after.source_last_seen_at,source_name=v_after.source_name,source_route=v_after.source_route,
    title=v_after.title,context=v_after.context,severity=v_after.severity,farm_id=v_after.farm_id,warehouse_id=v_after.warehouse_id,
    updated_at=clock_timestamp() where id=p_action_id returning * into v_after;
  if p_event_type is not null then
    insert into public.operational_action_events(org_id,action_id,event_type,actor_id,actor_name_snapshot,
      actor_role_snapshot,note,evidence,before_status,after_status,support_session_id)
    values(p_org_id,p_action_id,p_event_type,case when p_automated then null else p_actor_id end,
      case when p_automated then 'System' else coalesce(v_actor.full_name,v_actor.role::text) end,
      case when p_automated then 'system' else v_actor.role::text end,p_note,p_evidence,v_before.status,v_after.status,p_support_session_id)
    returning * into v_event;
    insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,operation,source,
      entity_table,entity_id,reason,farm_id,warehouse_id,before_values,after_values,metadata)
    values(p_org_id,case when p_automated then null else p_actor_id end,case when p_automated then 'system' else v_actor.role::text end,
      p_support_session_id,'operational_action.'||p_event_type,case when p_event_type='assigned' then 'decision' else 'update' end,
      'semantic','operational_actions',p_action_id::text,coalesce(p_note,'Action '||p_event_type),v_before.farm_id,v_before.warehouse_id,
      to_jsonb(v_before),to_jsonb(v_after),jsonb_build_object('sourceKey',v_before.source_key));
  end if;
  return jsonb_build_object('action',to_jsonb(v_after)||jsonb_build_object('owner',
    (select jsonb_build_object('full_name',full_name) from public.profiles where id=v_after.owner_id)),
    'event',case when p_event_type is not null then to_jsonb(v_event) else null end);
end $$;
revoke all on function public.apply_operational_action_transition(uuid,uuid,uuid,bigint,jsonb,text,text,text,boolean,uuid) from public,anon,authenticated;
grant execute on function public.apply_operational_action_transition(uuid,uuid,uuid,bigint,jsonb,text,text,text,boolean,uuid) to service_role;

-- Keep the step-one interface as a guarded compatibility adapter, not a second
-- implementation of acknowledgement rules.
create or replace function public.acknowledge_operational_action(
  p_actor_id uuid,p_org_id uuid,p_action_id uuid,p_expected_updated_at timestamptz,
  p_expected_status text,p_expected_owner_id uuid,p_note text,p_support_session_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_action public.operational_actions;
begin
  select * into v_action from public.operational_actions where id=p_action_id and org_id=p_org_id for update;
  if not found then raise exception 'Action not found.' using errcode='P0002'; end if;
  if v_action.updated_at is distinct from p_expected_updated_at or v_action.status is distinct from p_expected_status
    or v_action.owner_id is distinct from p_expected_owner_id then raise exception 'Action changed. Refresh before continuing.' using errcode='40001'; end if;
  return public.apply_operational_action_transition(p_actor_id,p_org_id,p_action_id,v_action.revision,
    jsonb_build_object('status','acknowledged','acknowledged_by',p_actor_id,'acknowledged_at',now()),'acknowledged',p_note,null,false,p_support_session_id);
end $$;

-- Replace only the assigned-action branch of the existing authoritative Today
-- executor. Receipt claim/result and operating-day authorization stay intact.
do $$
declare v_definition text; v_start integer; v_end integer; v_replacement text;
begin
  v_definition:=pg_get_functiondef('public.execute_today_command_v1(uuid,jsonb)'::regprocedure);
  v_start:=strpos(v_definition,'    v_before_status := v_action.status;');
  v_end:=strpos(v_definition,'    v_source_ref := ''operational_actions/'' || v_action.id::text;');
  if v_start=0 or v_end<=v_start then raise exception 'Today action branch changed; review migration.'; end if;
  v_replacement:=$branch$
    if nullif(p_command->>'expected_resource_revision','') is null then
      raise exception 'Action revision required. Refresh before continuing.' using errcode='40001'; end if;
    v_event_type:=case v_payload->>'event_type' when 'acknowledged' then 'acknowledged'
      when 'started' then 'work_started' when 'completion_submitted' then 'resolution_submitted' end;
    v_after_status:=case v_event_type when 'acknowledged' then 'acknowledged' when 'work_started' then 'in_progress'
      when 'resolution_submitted' then 'awaiting_verification' end;
    if v_event_type is null then raise exception 'Unsupported assigned action update.' using errcode='22023'; end if;
    v_domain_result:=public.apply_operational_action_transition(p_actor_id,v_org_id,v_action.id,
      (p_command->>'expected_resource_revision')::bigint,
      jsonb_build_object('status',v_after_status)||case v_event_type
        when 'acknowledged' then jsonb_build_object('acknowledged_by',p_actor_id,'acknowledged_at',now())
        when 'resolution_submitted' then jsonb_build_object('resolution_summary',btrim(v_payload->>'note'),
          'resolution_submitted_by',p_actor_id,'resolution_submitted_at',now()) else '{}'::jsonb end,
      v_event_type,btrim(v_payload->>'note'));
    v_domain_result:=jsonb_build_object('action_id',v_action.id,'status',v_after_status,
      'revision',v_domain_result->'action'->'revision');
$branch$;
  execute substring(v_definition from 1 for v_start-1)||v_replacement||substring(v_definition from v_end);
end $$;
