\set ON_ERROR_STOP on
begin;
create function pg_temp.fail_started_history() returns trigger language plpgsql as $$
begin if new.event_type='work_started' then raise exception 'test transition history failure'; end if; return new; end $$;
do $$
declare o uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); ceo uuid:=gen_random_uuid();
  branch uuid:=gen_random_uuid(); farm uuid:=gen_random_uuid(); store uuid:=gen_random_uuid();
  task uuid:=gen_random_uuid(); daily_task uuid:=gen_random_uuid(); rev bigint; result jsonb; command jsonb; replay jsonb;
begin
  insert into public.organizations(id,name,today_workspace_enabled) values(o,'Action transition test',true);
  insert into public.profiles(id,org_id,full_name,role,is_active) values
    (a,o,'Manager A','farm_manager',true),(b,o,'Manager B','farm_manager',true),(ceo,o,'CEO','ceo',true);
  insert into public.branches(id,org_id,name) values(branch,o,'Branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Farm');
  insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values(o,a,farm,now()-interval '1 day');
  insert into public.warehouses(id,org_id,branch_id,name,type,status) values(store,o,branch,'Shared','central_warehouse','active');
  insert into public.user_warehouse_access(org_id,profile_id,warehouse_id) values(o,a,store),(o,b,store);
  insert into public.operational_actions(id,org_id,source_key,source_name,source_route,title,context,severity,warehouse_id,
    status,due_at,source_first_seen_at,source_last_seen_at) values(task,o,'claim-test','Inventory','/app/inventory','Fix stock','Test','low',
    store,'open',now()+interval '1 day',now(),now());
  result:=public.apply_operational_action_transition(a,o,task,0,
    jsonb_build_object('status','assigned','owner_id',a,'assigned_by',a,'assigned_at',now()),'claimed');
  if result->'action'->>'revision'<>'1' then raise exception 'Claim did not advance revision'; end if;
  -- Both clients loaded revision 0. Only the first claim can commit.
  begin
    perform public.apply_operational_action_transition(b,o,task,0,
      jsonb_build_object('status','assigned','owner_id',b),'claimed');
    raise exception 'Second claim overwrote the first';
  exception when serialization_failure then null; end;
  if (select owner_id from public.operational_actions where id=task)<>a
    or (select count(*) from public.operational_action_events where action_id=task)<>1 then
    raise exception 'Conflicting claim changed ownership or evidence'; end if;
  -- Polling changes no workflow version.
  perform public.apply_operational_action_transition(ceo,o,task,1,
    jsonb_build_object('source_last_seen_at',clock_timestamp()),null,null,null,true);
  if (select revision from public.operational_actions where id=task)<>1 then raise exception 'Polling invalidated form'; end if;
  -- A reassignment invalidates an already-open manager form.
  perform public.apply_operational_action_transition(ceo,o,task,1,
    jsonb_build_object('status','assigned','owner_id',b,'assigned_by',ceo,'assigned_at',clock_timestamp()),'assigned','Please investigate stock');
  begin
    perform public.apply_operational_action_transition(a,o,task,1,'{"status":"in_progress"}','work_started','Starting now');
    raise exception 'Stale manager overwrote reassignment';
  exception when serialization_failure then null; end;
  begin
    perform public.apply_operational_action_transition(a,o,task,2,'{"status":"in_progress"}','work_started','Starting now');
    raise exception 'Previous owner retained update access';
  exception when insufficient_privilege then null; end;
  -- Generic transitions retain step one's all-or-nothing history guarantee.
  execute 'create trigger test_fail_started_history before insert on public.operational_action_events for each row execute function pg_temp.fail_started_history()';
  begin
    perform public.apply_operational_action_transition(b,o,task,2,'{"status":"in_progress"}','work_started','Starting now');
    raise exception 'Expected history failure missing';
  exception when raise_exception then if sqlerrm<>'test transition history failure' then raise; end if; end;
  execute 'drop trigger test_fail_started_history on public.operational_action_events';
  if (select status from public.operational_actions where id=task)<>'assigned'
    or (select revision from public.operational_actions where id=task)<>2 then raise exception 'History failure partially saved'; end if;
  -- Extending a deadline prevents a stale automatic escalation.
  perform public.apply_operational_action_transition(ceo,o,task,2,
    jsonb_build_object('due_at',now()+interval '2 days'),'due_date_changed','Extend the deadline');
  begin
    perform public.apply_operational_action_transition(ceo,o,task,2,'{"status":"escalated"}','escalated','Overdue',null,true);
    raise exception 'Stale escalation overwrote the new deadline';
  exception when serialization_failure then null; end;

  insert into public.operational_actions(id,org_id,source_key,source_name,source_route,title,context,severity,farm_id,
    owner_id,status,due_at,source_first_seen_at,source_last_seen_at) values(daily_task,o,'today-test','Record Checks','/app/reconciliation',
    'Fix records','Test','low',farm,a,'assigned',now()+interval '1 day',now(),now());
  perform set_config('request.jwt.claim.sub',a::text,true);
  command:=jsonb_build_object('schema_version',1,'command_id',gen_random_uuid(),'type','update_assigned_action',
    'farm_id',farm,'work_date',(now() at time zone 'Africa/Addis_Ababa')::date,'expected_resource_revision','0',
    'payload',jsonb_build_object('action_id',daily_task,'event_type','acknowledged','note','I have seen this task'));
  result:=public.dispatch_today_command_v1(a,command);
  if result->>'status'<>'applied' then raise exception 'Today acknowledgement failed: %',result; end if;
  replay:=public.dispatch_today_command_v1(a,command);
  if replay is distinct from result or (select count(*) from public.operational_action_events where action_id=daily_task)<>1 then
    raise exception 'Today replay duplicated history'; end if;
  result:=public.dispatch_today_command_v1(a,jsonb_set(jsonb_set(command,'{command_id}',to_jsonb(gen_random_uuid())),
    '{payload,event_type}','"started"'));
  if result->>'status'<>'conflict' then raise exception 'Stale queued update did not conflict: %',result; end if;
  select revision into rev from public.operational_actions where id=daily_task;
  perform public.apply_operational_action_transition(a,o,daily_task,rev,'{"status":"awaiting_verification","resolution_summary":"Corrected records"}',
    'resolution_submitted','Corrected records');
  select revision into rev from public.operational_actions where id=daily_task;
  begin
    perform public.apply_operational_action_transition(a,o,daily_task,rev,'{"status":"in_progress"}','work_started','Starting again');
    raise exception 'Submitted task regressed to started';
  exception when serialization_failure then null; end;
  if has_function_privilege('authenticated','public.apply_operational_action_transition(uuid,uuid,uuid,bigint,jsonb,text,text,text,boolean,uuid)','execute') then
    raise exception 'Browser can invoke privileged transition'; end if;
end $$;
rollback;
