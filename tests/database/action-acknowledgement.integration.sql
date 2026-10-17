\set ON_ERROR_STOP on
begin;
create function pg_temp.reject_action_history() returns trigger language plpgsql as $$
begin raise exception 'test history failure'; end $$;

do $$
declare
  o uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); ceo uuid:=gen_random_uuid();
  branch uuid:=gen_random_uuid(); farm uuid:=gen_random_uuid(); action uuid:=gen_random_uuid();
  revision timestamptz; result jsonb;
begin
  insert into public.organizations(id,name) values(o,'Action acknowledgement test');
  insert into public.profiles(id,org_id,full_name,role,is_active) values
    (manager,o,'Manager','farm_manager',true),(ceo,o,'CEO','ceo',true);
  insert into public.branches(id,org_id,name) values(branch,o,'Branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Farm');
  insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values(o,manager,farm,now()-interval '1 day');
  insert into public.operational_actions(id,org_id,source_key,source_name,source_route,title,context,severity,
    farm_id,owner_id,status,due_at,source_first_seen_at,source_last_seen_at)
  values(action,o,'ack-test','Record Checks','/app/reconciliation','Check records','Test','low',farm,manager,
    'assigned',now()+interval '1 day',now(),now()) returning updated_at into revision;

  -- A history failure must roll back the earlier status write.
  execute 'create trigger test_reject_action_history before insert on public.operational_action_events
    for each row execute function pg_temp.reject_action_history()';
  begin
    perform public.acknowledge_operational_action(manager,o,action,revision,'assigned',manager,'I have seen this');
    raise exception 'Expected history failure was not raised';
  exception when raise_exception then
    if sqlerrm<>'test history failure' then raise; end if;
  end;
  if (select status from public.operational_actions where id=action)<>'assigned'
    or exists(select 1 from public.operational_action_events where action_id=action) then
    raise exception 'Failed acknowledgement partially saved';
  end if;
  execute 'drop trigger test_reject_action_history on public.operational_action_events';

  result:=public.acknowledge_operational_action(manager,o,action,revision,'assigned',manager,'I have seen this');
  if result->'action'->>'status'<>'acknowledged' or result->'event'->>'event_type'<>'acknowledged'
    or (select count(*) from public.operational_action_events where action_id=action)<>1
    or not exists(select 1 from public.governance_audit_events where org_id=o
      and event_type='operational_action.acknowledged' and entity_id=action::text) then
    raise exception 'Acknowledgement evidence missing';
  end if;
  begin
    perform public.acknowledge_operational_action(manager,o,action,revision,'assigned',manager,'Repeated request');
    raise exception 'Stale acknowledgement was accepted';
  exception when serialization_failure then null; end;
  if (select count(*) from public.operational_action_events where action_id=action)<>1 then
    raise exception 'Stale request duplicated history';
  end if;
  update public.operational_actions set status='assigned',updated_at=clock_timestamp() where id=action returning updated_at into revision;
  update public.user_farm_access set revoked_at=now() where farm_id=farm;
  begin
    perform public.acknowledge_operational_action(manager,o,action,revision,'assigned',manager,'Revoked request');
    raise exception 'Revoked farm access was accepted';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('authenticated','public.acknowledge_operational_action(uuid,uuid,uuid,timestamptz,text,uuid,text,uuid)','execute') then
    raise exception 'Browser can invoke privileged acknowledgement';
  end if;
end $$;
rollback;
