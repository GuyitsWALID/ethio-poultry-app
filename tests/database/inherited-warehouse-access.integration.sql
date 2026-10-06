\set ON_ERROR_STOP on
begin;
do $$
declare
  o uuid:='18000000-0000-4000-8000-000000000001';
  ceo uuid:='18000000-0000-4000-8000-000000000002';
  old_manager uuid:='18000000-0000-4000-8000-000000000003';
  replacement uuid:='18000000-0000-4000-8000-000000000004';
  branch uuid:='18000000-0000-4000-8000-000000000005';
  farm uuid:='18000000-0000-4000-8000-000000000006';
  store uuid:='18000000-0000-4000-8000-000000000007';
  shared uuid:='18000000-0000-4000-8000-000000000008';
  action uuid:='18000000-0000-4000-8000-000000000009';
  submitted uuid:='18000000-0000-4000-8000-000000000010';
  shared_action uuid:='18000000-0000-4000-8000-000000000011';
  preview jsonb; result jsonb; assignment uuid; due timestamptz:=now()-interval '1 day';
begin
  insert into public.organizations(id,name) values(o,'Inherited warehouse tests');
  insert into public.profiles(id,org_id,full_name,role,is_active) values
    (ceo,o,'CEO','ceo',true),(old_manager,o,'Outgoing','farm_manager',true),(replacement,o,'Replacement','farm_manager',true);
  insert into public.branches(id,org_id,name) values(branch,o,'Branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Farm');
  result:=public.change_farm_manager_assignment(ceo,farm,old_manager,now()-interval '1 day',null,null,null,'Initial test assignment','grant');
  assignment:=(result->'assignment'->>'id')::uuid;
  insert into public.warehouses(id,org_id,branch_id,farm_id,name,type,status) values
    (store,o,branch,farm,'Owned store','farm_store','active'),(shared,o,branch,null,'Shared store','central_warehouse','active');
  if not public.manager_has_effective_warehouse_access(old_manager,store)
    or public.manager_has_effective_warehouse_access(old_manager,shared)
    or public.manager_has_effective_warehouse_access(replacement,store) then raise exception 'Effective access failed'; end if;
  if (select access_source from public.manager_warehouse_access_scope(old_manager,o) where id=store)<>'farm_assignment' then
    raise exception 'Access source missing'; end if;
  begin
    insert into public.user_warehouse_access(org_id,profile_id,warehouse_id) values(o,old_manager,store);
    raise exception 'Separate farm-store grant accepted';
  exception when invalid_parameter_value then null; end;
  begin
    insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values(o,replacement,farm,now());
    raise exception 'Second active farm manager accepted';
  exception when exclusion_violation then null; end;
  insert into public.user_warehouse_access(org_id,profile_id,warehouse_id) values(o,old_manager,shared);
  if not public.manager_has_effective_warehouse_access(old_manager,shared) then raise exception 'Shared grant failed'; end if;
  update public.warehouses set status='inactive' where id=store;
  if public.manager_has_effective_warehouse_access(old_manager,store) then raise exception 'Inactive store accepted'; end if;
  update public.warehouses set status='active' where id=store;
  update public.profiles set is_active=false where id=old_manager;
  if public.manager_has_effective_warehouse_access(old_manager,store) then raise exception 'Inactive manager accepted'; end if;
  update public.profiles set is_active=true where id=old_manager;
  update public.user_warehouse_access set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where warehouse_id=shared;
  if public.manager_has_effective_warehouse_access(old_manager,shared) then raise exception 'Expired shared grant accepted'; end if;
  update public.user_warehouse_access set expires_at=null where warehouse_id=shared;
  if jsonb_array_length((select jsonb_agg(s) from public.manager_warehouse_access_scope(old_manager,'18000000-0000-4000-8000-000000000099') s))>0 then raise exception 'Other organization scope accepted'; end if;
  if result->'assignment'->>'assignment_status'<>'Active' or result->'scope'->>'name'<>'Farm' then raise exception 'Assignment response compatibility lost'; end if;
  insert into public.operational_actions(id,org_id,source_key,source_name,source_route,title,context,severity,farm_id,warehouse_id,
    owner_id,status,due_at,source_first_seen_at,source_last_seen_at,resolution_evidence,acknowledged_by,acknowledged_at)
  values(action,o,'handover-fix','Record Checks','/app/reconciliation?finding=test','Fix','Evidence','low',farm,store,
    old_manager,'in_progress',due,now(),now(),'Keep this evidence',old_manager,now()),
    (submitted,o,'handover-submitted','Record Checks','/app/reconciliation','Submitted','Evidence','medium',farm,null,
    old_manager,'awaiting_verification',due,now(),now(),'Submitted evidence',old_manager,now()),
    (shared_action,o,'shared-only','Inventory','/app/inventory','Shared-only','Evidence','medium',null,shared,
    old_manager,'assigned',due,now(),now(),null,null,null);
  preview:=public.farm_manager_handover_preview(ceo,farm,replacement);
  if jsonb_array_length(preview->'unfinished_actions')<>1 then raise exception 'Handover selected submitted/shared work'; end if;
  update public.operational_actions set updated_at=now()+interval '1 second' where id=action;
  begin
    perform public.change_farm_manager_assignment(ceo,farm,replacement,now(),null,assignment,preview->>'revision','Replace test manager','handover');
    raise exception 'Stale handover accepted';
  exception when serialization_failure then null; end;
  if not public.manager_has_effective_warehouse_access(old_manager,store) then raise exception 'Stale handover partially revoked access'; end if;
  preview:=public.farm_manager_handover_preview(ceo,farm,replacement);
  result:=public.change_farm_manager_assignment(ceo,farm,replacement,now(),null,assignment,preview->>'revision','Replace test manager','handover');
  if public.manager_has_effective_warehouse_access(old_manager,store)
    or not public.manager_has_effective_warehouse_access(replacement,store)
    or public.manager_has_effective_warehouse_access(replacement,shared)
    or not public.manager_has_effective_warehouse_access(old_manager,shared) then raise exception 'Handover warehouse access incorrect'; end if;
  if not exists(select 1 from public.operational_actions where id=action and owner_id=replacement
    and status='escalated' and due_at=due and resolution_evidence='Keep this evidence' and acknowledged_at is null) then
    raise exception 'Task transfer lost evidence, deadline, escalation or acknowledgement requirement'; end if;
  if not exists(select 1 from public.operational_actions where id=submitted and owner_id=old_manager and status='awaiting_verification')
    or not exists(select 1 from public.operational_actions where id=shared_action and owner_id=old_manager) then
    raise exception 'Submitted/shared-only work changed'; end if;
  if not exists(select 1 from public.notifications where recipient_id=replacement and action_id=action and event_type='assigned')
    or exists(select 1 from public.notifications where recipient_id=old_manager and action_id=action) then
    raise exception 'Mandatory notification recipient incorrect'; end if;
  if not exists(select 1 from public.governance_audit_events where farm_id=farm and event_type='assignment.farm.handover') then raise exception 'Handover audit missing'; end if;
  insert into public.warehouses(org_id,branch_id,farm_id,name,type,status) values(o,branch,farm,'New store','pharmacy','active');
  if (select count(*) from public.manager_warehouse_access_scope(replacement,o))<>2 then raise exception 'New store failed to inherit'; end if;
  perform public.change_farm_manager_assignment(ceo,farm,null,null,null,(result->'assignment'->>'id')::uuid,null,'End farm assignment','revoke');
  if public.manager_has_effective_warehouse_access(replacement,store) or exists(select 1 from public.operational_actions where id=action and owner_id is not null) then
    raise exception 'Revocation retained farm access or orphan owner'; end if;
  if not exists(select 1 from public.notifications where recipient_id=ceo and action_id=action and event_type='escalated') then raise exception 'Reassignment notification missing'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  if public.has_active_warehouse_access('18000000-0000-4000-8000-000000000007')
    or exists(select 1 from public.warehouses where id='18000000-0000-4000-8000-000000000007')
    or exists(select 1 from public.operational_actions where id='18000000-0000-4000-8000-000000000010') then
    raise exception 'RLS retained revoked farm access or owner-only task visibility'; end if;
  if not public.has_active_warehouse_access('18000000-0000-4000-8000-000000000008') then
    raise exception 'RLS did not preserve explicit shared-store permission'; end if;
end $$;
reset role;
rollback;
