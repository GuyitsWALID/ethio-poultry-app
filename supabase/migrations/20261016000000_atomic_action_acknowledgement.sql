-- Alerts acknowledgement must not save a status without its history.
create function public.acknowledge_operational_action(
  p_actor_id uuid, p_org_id uuid, p_action_id uuid, p_expected_updated_at timestamptz,
  p_expected_status text, p_expected_owner_id uuid, p_note text, p_support_session_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_actor public.profiles;
  v_before public.operational_actions;
  v_after public.operational_actions;
  v_event public.operational_action_events;
  v_support boolean := false;
begin
  select * into v_actor from public.profiles where id=p_actor_id and is_active;
  if not found then raise exception 'An active account is required.' using errcode='42501'; end if;
  if v_actor.role::text='system_admin' and p_support_session_id is not null then
    select exists(select 1 from public.break_glass_sessions where id=p_support_session_id
      and administrator_id=p_actor_id and target_org_id=p_org_id and revoked_at is null
      and started_at<=now() and expires_at>now()) into v_support;
  end if;
  if not v_support and (v_actor.org_id is distinct from p_org_id or coalesce(v_actor.role::text,'') not in ('ceo','farm_manager')) then
    raise exception 'This action is outside your active assignment.' using errcode='42501';
  end if;
  if p_note is null or length(btrim(p_note)) not between 4 and 1000 then
    raise exception 'Enter a work note of 4 to 1000 characters.' using errcode='22023';
  end if;
  select * into v_before from public.operational_actions where id=p_action_id and org_id=p_org_id for update;
  if not found then raise exception 'Action not found.' using errcode='P0002'; end if;
  if v_actor.role::text='farm_manager' then
    if v_before.owner_id is distinct from p_actor_id then
      raise exception 'This action must be assigned to you before you can update it.' using errcode='42501';
    end if;
    if not (exists(select 1 from public.user_farm_access where org_id=p_org_id and profile_id=p_actor_id
      and farm_id=v_before.farm_id and revoked_at is null and starts_at<=now()
      and (expires_at is null or expires_at>now()))
      or coalesce(public.manager_has_effective_warehouse_access(p_actor_id,v_before.warehouse_id),false)) then
      raise exception 'This action is outside your active assignment.' using errcode='42501';
    end if;
  end if;
  if v_before.updated_at is distinct from p_expected_updated_at
    or v_before.status is distinct from p_expected_status
    or v_before.owner_id is distinct from p_expected_owner_id then
    raise exception 'Action changed. Refresh before continuing.' using errcode='40001';
  end if;
  if v_before.status not in ('assigned','escalated') then
    raise exception 'This action cannot be acknowledged in its current status.' using errcode='40001';
  end if;
  update public.operational_actions set status='acknowledged', acknowledged_by=p_actor_id,
    acknowledged_at=now(),updated_at=clock_timestamp() where id=p_action_id returning * into v_after;
  insert into public.operational_action_events(org_id,action_id,event_type,actor_id,actor_name_snapshot,
    actor_role_snapshot,note,before_status,after_status,support_session_id)
  values(p_org_id,p_action_id,'acknowledged',p_actor_id,coalesce(v_actor.full_name,'Farm Manager'),
    v_actor.role::text,btrim(p_note),v_before.status,v_after.status,p_support_session_id) returning * into v_event;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,
    operation,source,entity_table,entity_id,reason,farm_id,warehouse_id,before_values,after_values,metadata)
  values(p_org_id,p_actor_id,v_actor.role::text,p_support_session_id,'operational_action.acknowledged',
    'update','semantic','operational_actions',p_action_id::text,btrim(p_note),v_before.farm_id,v_before.warehouse_id,
    to_jsonb(v_before),to_jsonb(v_after),jsonb_build_object('sourceKey',v_before.source_key));
  return jsonb_build_object('action',to_jsonb(v_after),'event',to_jsonb(v_event));
end $$;
revoke all on function public.acknowledge_operational_action(uuid,uuid,uuid,timestamptz,text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.acknowledge_operational_action(uuid,uuid,uuid,timestamptz,text,uuid,text,uuid) to service_role;
