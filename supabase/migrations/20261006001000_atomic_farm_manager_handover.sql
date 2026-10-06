-- Farm handovers, task history and durable notifications commit together.
create function public.farm_manager_handover_preview(p_actor_id uuid,p_farm_id uuid,p_replacement_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_farm text; v_manager public.profiles; v_assignment public.user_farm_access;
  v_stores jsonb; v_tasks jsonb; v_snapshot jsonb;
begin
  select org_id into v_org from public.profiles where id=p_actor_id and is_active and role::text='ceo';
  if v_org is null then raise exception 'Only an active CEO can replace a Farm Manager.' using errcode='42501'; end if;
  select name into v_farm from public.farms where id=p_farm_id and org_id=v_org;
  if not found then raise exception 'Farm is outside this organization.' using errcode='42501'; end if;
  select * into v_manager from public.profiles where id=p_replacement_id and org_id=v_org and is_active and role::text='farm_manager';
  if not found then raise exception 'Choose an active Farm Manager in this organization.' using errcode='22023'; end if;
  select * into v_assignment from public.user_farm_access where farm_id=p_farm_id and org_id=v_org
    and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now());
  if not found then raise exception 'No current farm assignment. Grant farm access instead.' using errcode='40001'; end if;
  if v_assignment.profile_id=p_replacement_id then raise exception 'This manager already operates the farm.' using errcode='22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'status',w.status) order by w.id),'[]')
    into v_stores from public.warehouses w where w.org_id=v_org and w.farm_id=p_farm_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'status',a.status,'due_at',a.due_at,
    'updated_at',a.updated_at,'source_route',a.source_route) order by a.id),'[]') into v_tasks
  from public.operational_actions a where a.org_id=v_org and a.owner_id=v_assignment.profile_id
    and a.status in ('open','assigned','acknowledged','in_progress','escalated')
    and (a.farm_id=p_farm_id or a.warehouse_id in (select id from public.warehouses where farm_id=p_farm_id and org_id=v_org));
  v_snapshot:=jsonb_build_object('assignment',to_jsonb(v_assignment),'stores',v_stores,'tasks',v_tasks,
    'replacement_id',v_manager.id);
  return jsonb_build_object('farm',jsonb_build_object('id',p_farm_id,'name',v_farm),
    'current_manager',jsonb_build_object('id',v_assignment.profile_id,'name',(select full_name from public.profiles where id=v_assignment.profile_id)),
    'replacement_manager',jsonb_build_object('id',v_manager.id,'name',v_manager.full_name),
    'assignment_id',v_assignment.id,'revision',md5(v_snapshot::text),'warehouses',v_stores,'unfinished_actions',v_tasks);
end $$;
revoke all on function public.farm_manager_handover_preview(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.farm_manager_handover_preview(uuid,uuid,uuid) to service_role;

create function public.change_farm_manager_assignment(
  p_actor_id uuid,p_farm_id uuid,p_manager_id uuid,p_starts_at timestamptz,p_expires_at timestamptz,
  p_assignment_id uuid,p_expected_revision text,p_reason text,p_operation text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_actor text; v_before public.user_farm_access; v_after public.user_farm_access;
  v_preview jsonb; v_action public.operational_actions; v_event bigint; v_next_status text; v_count integer:=0;
begin
  select org_id,coalesce(full_name,'CEO') into v_org,v_actor from public.profiles
    where id=p_actor_id and is_active and role::text='ceo';
  if v_org is null then raise exception 'Only an active CEO can change farm assignments.' using errcode='42501'; end if;
  if p_operation not in ('grant','handover','revoke') or p_reason is null or length(btrim(p_reason)) not between 8 and 2000 then
    raise exception 'A valid operation and reason of 8 to 2000 characters are required.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('farm-assignment:'||p_farm_id::text,0));
  perform 1 from public.farms where id=p_farm_id and org_id=v_org for update;
  if not found then raise exception 'Farm is outside this organization.' using errcode='42501'; end if;
  if p_operation<>'revoke' then
    perform 1 from public.profiles where id=p_manager_id and org_id=v_org and is_active and role::text='farm_manager' for share;
    if not found then raise exception 'Choose an active Farm Manager in this organization.' using errcode='22023'; end if;
    if p_starts_at is null or (p_expires_at is not null and p_expires_at<=p_starts_at) then
      raise exception 'Valid assignment dates are required.' using errcode='22023'; end if;
  end if;
  select * into v_before from public.user_farm_access where org_id=v_org and farm_id=p_farm_id
    and id=p_assignment_id and revoked_at is null for update;
  if p_operation in ('handover','revoke') and not found then
    raise exception 'Assignment changed. Refresh before confirming.' using errcode='40001'; end if;
  if p_operation='grant' then
    if exists(select 1 from public.user_farm_access where farm_id=p_farm_id and revoked_at is null
      and (expires_at is null or expires_at>now())) then
      raise exception 'This farm has a manager or scheduled assignment. Review a handover instead.' using errcode='40001'; end if;
    if p_starts_at>now() and exists(select 1 from public.user_farm_access where farm_id=p_farm_id
      and profile_id<>p_manager_id) then
      raise exception 'Scheduled manager replacements are not supported. Use immediate handover.' using errcode='22023'; end if;
  else
    -- Prevent concurrent task edits from changing the confirmed handover snapshot.
    perform 1 from public.operational_actions a where a.org_id=v_org and a.owner_id=v_before.profile_id
      and (a.farm_id=p_farm_id or a.warehouse_id in(select id from public.warehouses where farm_id=p_farm_id)) for update;
    if p_operation='handover' then
      if p_starts_at>now() or v_before.starts_at>now() or (v_before.expires_at is not null and v_before.expires_at<=now()) then
        raise exception 'Only an immediate handover of the current assignment is supported.' using errcode='22023'; end if;
      v_preview:=public.farm_manager_handover_preview(p_actor_id,p_farm_id,p_manager_id);
      if p_expected_revision is null or v_preview->>'revision'<>p_expected_revision then
        raise exception 'Handover details changed. Review the preview again.' using errcode='40001'; end if;
    end if;
    update public.user_farm_access set revoked_at=now(),revoked_by=p_actor_id,revocation_reason=btrim(p_reason)
      where id=v_before.id returning * into v_after;
  end if;
  if p_operation<>'revoke' then
    insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at,expires_at,granted_by)
    values(v_org,p_manager_id,p_farm_id,p_starts_at,p_expires_at,p_actor_id)
    on conflict(profile_id,farm_id) do update set starts_at=excluded.starts_at,expires_at=excluded.expires_at,
      granted_by=excluded.granted_by,revoked_at=null,revoked_by=null,revocation_reason=null
    returning * into v_after;
  end if;
  if p_operation in ('handover','revoke') then
    for v_action in select * from public.operational_actions a where a.org_id=v_org and a.owner_id=v_before.profile_id
      and a.status in ('open','assigned','acknowledged','in_progress','escalated')
      and (a.farm_id=p_farm_id or a.warehouse_id in(select id from public.warehouses where farm_id=p_farm_id and org_id=v_org))
      order by a.id for update
    loop
      v_next_status:=case when v_action.status='escalated' or v_action.due_at<now() then 'escalated'
        when p_operation='revoke' then 'open' else 'assigned' end;
      update public.operational_actions set owner_id=case when p_operation='handover' then p_manager_id else null end,
        assigned_by=p_actor_id,assigned_at=now(),acknowledged_at=null,acknowledged_by=null,status=v_next_status,
        escalated_at=case when v_next_status='escalated' then coalesce(escalated_at,now()) else escalated_at end,
        escalation_reason=case when p_operation='revoke' then 'Farm access revoked; CEO reassignment required.' else escalation_reason end,
        updated_at=now() where id=v_action.id;
      insert into public.operational_action_events(org_id,action_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,
        note,before_status,after_status)
      values(v_org,v_action.id,case when p_operation='handover' then 'assigned' else 'escalated' end,
        p_actor_id,v_actor,'ceo',case when p_operation='handover' then 'Immediate farm handover. Acknowledgement required. '
          else 'Farm assignment revoked. CEO reassignment required. ' end||btrim(p_reason),v_action.status,v_next_status)
      returning id into v_event;
      insert into public.notifications(org_id,recipient_id,action_id,action_event_id,event_type,severity,title,message,route)
      select v_org,p.id,v_action.id,v_event,case when p_operation='handover' then 'assigned' else 'escalated' end,
        v_action.severity,v_action.title,case when p_operation='handover' then 'This work was transferred to you. Review and acknowledge it.'
          else 'Farm access ended. Assign this unfinished work to a manager.' end,
        v_action.source_route
      from public.profiles p where p.org_id=v_org and p.is_active
        and ((p_operation='handover' and p.id=p_manager_id) or (p_operation='revoke' and p.role::text='ceo'));
      v_count:=v_count+1;
    end loop;
  end if;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,operation,source,entity_table,entity_id,
    reason,farm_id,before_values,after_values,metadata)
  values(v_org,p_actor_id,'ceo','assignment.farm.'||p_operation,'access','semantic','user_farm_access',v_after.id::text,
    btrim(p_reason),p_farm_id,to_jsonb(v_before),to_jsonb(v_after),jsonb_build_object('transferred_or_flagged_actions',v_count));
  return jsonb_build_object('assignment',to_jsonb(v_after)||jsonb_build_object('assignment_status',
    case when v_after.revoked_at is not null then 'Revoked' when v_after.starts_at>now() then 'Scheduled'
      when v_after.expires_at<=now() then 'Expired' else 'Active' end),
    'scope',jsonb_build_object('id',p_farm_id,'name',(select name from public.farms where id=p_farm_id)),
    'affected_actions',v_count);
end $$;
revoke all on function public.change_farm_manager_assignment(uuid,uuid,uuid,timestamptz,timestamptz,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.change_farm_manager_assignment(uuid,uuid,uuid,timestamptz,timestamptz,uuid,text,text,text) to service_role;

create function public.guard_farm_manager_assignment() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('farm-assignment:'||new.farm_id::text,0));
  if not exists(select 1 from public.farms f join public.profiles p on p.id=new.profile_id
    where f.id=new.farm_id and f.org_id=new.org_id and p.org_id=new.org_id
    and (new.revoked_at is not null or (p.is_active and p.role::text='farm_manager'))) then
    raise exception 'Assign an active Farm Manager from the same organization.' using errcode='42501'; end if;
  if new.revoked_at is null and new.starts_at>now() and exists(select 1 from public.user_farm_access a
    where a.farm_id=new.farm_id and a.id<>new.id and a.profile_id<>new.profile_id) then
    raise exception 'Scheduled manager replacements are not supported.' using errcode='22023'; end if;
  return new;
end $$;
create trigger guard_farm_manager_assignment before insert or update on public.user_farm_access
for each row execute function public.guard_farm_manager_assignment();
-- Browser writes may not bypass the audited assignment boundary.
revoke insert,update,delete on public.user_farm_access,public.user_warehouse_access from authenticated,anon;
