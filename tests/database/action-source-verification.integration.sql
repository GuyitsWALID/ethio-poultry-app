\set ON_ERROR_STOP on
begin;
create function pg_temp.warning(o uuid,k text,f uuid default null,w uuid default null) returns uuid language plpgsql as $$
declare a uuid;
begin
  insert into public.operational_actions(org_id,source_key,source_name,source_route,title,context,severity,farm_id,warehouse_id,
    status,due_at,source_first_seen_at,source_last_seen_at)
  values(o,k,'Test','/app/alerts','Warning','Test','low',f,w,'awaiting_verification',now()+interval '1 day',now(),now()) returning id into a;
  return a;
end $$;
do $$
declare o uuid:=gen_random_uuid(); ceo uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid();
  farm uuid:=gen_random_uuid(); house uuid:=gen_random_uuid(); batch uuid:=gen_random_uuid(); flock uuid:=gen_random_uuid();
  store uuid:=gen_random_uuid(); other_store uuid:=gen_random_uuid(); item uuid:=gen_random_uuid(); request uuid:=gen_random_uuid();
  rule uuid:=gen_random_uuid(); finding uuid:=gen_random_uuid(); a uuid; legacy uuid; result jsonb; rev bigint; definition text;
  today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
begin
  insert into public.organizations(id,name) values(o,'Exact warning test');
  insert into public.profiles(id,org_id,full_name,role,is_active) values(ceo,o,'CEO','ceo',true),(manager,o,'Manager','farm_manager',true);
  insert into public.branches(id,org_id,name) values(branch,o,'Branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Farm');
  insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values(o,manager,farm,now()-interval '1 day');
  insert into public.warehouses(id,org_id,branch_id,farm_id,name,type,status) values
    (store,o,branch,farm,'Farm store','farm_store','active'),(other_store,o,branch,null,'Shared store','central_warehouse','active');
  insert into public.inventory_items(id,org_id,name,category,unit,reorder_level) values(item,o,'Feed','feed','kg',10);
  insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date) values
    (o,item,store,'receipt',5,1,today),(o,item,other_store,'receipt',1000,1,today);
  a:=pg_temp.warning(o,'inv-'||store::text||'-'||item::text,farm,store);
  if public.operational_action_source_state(o,a)->>'state'<>'active' then raise exception 'Other-store stock hid shortage'; end if;
  -- Even a caller claiming "verified" cannot bypass the final source read.
  result:=public.apply_operational_action_transition(ceo,o,a,0,'{"status":"resolved"}','system_verified');
  if result->'action'->>'status'<>'in_progress' or result->'event'->>'event_type'<>'verification_failed' then
    raise exception 'Active source was falsely verified'; end if;
  select revision into rev from public.operational_actions where id=a;
  begin
    perform public.apply_operational_action_transition(ceo,o,a,rev,jsonb_build_object('source_resolved_at',now()),null,null,null,true);
    raise exception 'Automatic refresh falsely marked active source clear';
  exception when serialization_failure then null; end;
  insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date)
    values(o,item,store,'receipt',10,1,today);
  if public.operational_action_source_state(o,a)->>'state'<>'clear' then raise exception 'Restocked store not clear'; end if;

  insert into public.governance_requests(id,org_id,request_type,status,farm_id,reason,requested_by,intent,
    requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
  values(request,o,'feed_template','approved',farm,'Test exact approval',manager,'test','Manager','farm_manager',now());
  a:=pg_temp.warning(o,'governance-'||request::text,farm);
  if public.operational_action_source_state(o,a)->>'state'<>'active' then raise exception 'Approval incorrectly means applied'; end if;
  update public.governance_requests set status='applied',applied_at=now() where id=request;
  result:=public.apply_operational_action_transition(ceo,o,a,0,'{"status":"resolved"}','system_verified');
  if result->'action'->>'status'<>'resolved' then raise exception 'Applied correction not verified'; end if;

  insert into public.alerts(id,org_id,message,category,priority,status,created_at) values(rule,o,'Older rule','health','high','open',now()-interval '1 day');
  insert into public.alerts(org_id,message,category,priority,status) select o,'Newer rule','health','high','open' from generate_series(1,25);
  a:=pg_temp.warning(o,'db-'||rule::text);
  if public.operational_action_source_state(o,a)->>'state'<>'active' then raise exception 'Hidden list entry treated as resolved'; end if;

  insert into public.reconciliation_findings(id,org_id,fingerprint,rule_code,domain,severity,status,title,explanation,recommended_action,farm_id)
    values(finding,o,'exact-test','TEST','birds','high','cleared','Test','Test','Check',farm);
  a:=pg_temp.warning(o,'reconciliation-'||finding::text,farm);
  if public.operational_action_source_state(o,a)->>'state'<>'clear' then raise exception 'System-cleared finding not recognized'; end if;

  insert into public.houses(id,org_id,branch_id,farm_id,name,house_type) values(house,o,branch,farm,'House','layer');
  insert into public.batches(id,org_id,branch_id,farm_id,house_id,batch_code,source,placement_date,age_at_placement_days,total_count,status)
    values(batch,o,branch,farm,house,'EXACT','external_purchase',today-10,0,100,'active');
  insert into public.flocks(id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,
    initial_count,current_count,age_at_placement_days,status)
    values(flock,o,farm,house,batch,'EXACT','layer','external_purchase',today-10,100,100,0,'active');
  a:=pg_temp.warning(o,'daily-missing-'||flock::text||'-'||today::text,farm);
  if public.operational_action_source_state(o,a)->>'state'<>'active' then raise exception 'Missing exact flock record not found'; end if;
  insert into public.daily_farm_records(org_id,flock_id,record_date,opening_birds,closing_birds,deaths,culls,recorded_by)
    values(o,flock,today,100,100,0,0,manager);
  if public.operational_action_source_state(o,a)->>'state'<>'clear' then raise exception 'Exact daily record not recognized'; end if;
  insert into public.mortality_events(org_id,flock_id,record_date,count,cause) values(o,flock,today,20,'Natural death');
  a:=pg_temp.warning(o,'mortality-spike-'||flock::text,farm);
  if public.operational_action_source_state(o,a)->>'state'<>'active' then raise exception 'Exact mortality source not recognized'; end if;
  update public.mortality_events set record_date=today-7 where org_id=o and flock_id=flock;
  if public.operational_action_source_state(o,a)->>'state'<>'clear' then raise exception 'Mortality window includes eighth day'; end if;
  update public.mortality_events set record_date=today-6 where org_id=o and flock_id=flock;
  if public.operational_action_source_state(o,a)->>'state'<>'active' then raise exception 'Mortality window excludes seventh day'; end if;
  a:=pg_temp.warning(o,'schedule-missed-'||flock::text,farm);
  insert into public.health_events(org_id,flock_id,event_date,event_type,description,created_at) values
    (o,flock,today,'observation','SCHEDULE_STATUS|schedule|missed|vaccination',now()-interval '1 minute');
  if public.operational_action_source_state(o,a)->>'state'<>'active' then raise exception 'Missed schedule missing'; end if;
  insert into public.health_events(org_id,flock_id,event_date,event_type,description) values
    (o,flock,today,'observation','SCHEDULE_STATUS|schedule|completed|vaccination');
  if public.operational_action_source_state(o,a)->>'state'<>'clear' then raise exception 'Completion did not replace missed state'; end if;

  a:=pg_temp.warning(o,'db-'||gen_random_uuid()::text);
  begin
    perform public.apply_operational_action_transition(ceo,o,a,0,'{"status":"resolved"}','system_verified');
    raise exception 'Missing source verified';
  exception when object_not_in_prerequisite_state then null; end;
  if (select status from public.operational_actions where id=a)<>'awaiting_verification'
    or exists(select 1 from public.operational_action_events where action_id=a) then raise exception 'Unavailable check partially saved'; end if;
  -- A real database-read failure must also leave status/history unchanged.
  definition:=pg_get_functiondef('public.operational_action_source_state(uuid,uuid)'::regprocedure);
  execute $replace$create or replace function public.operational_action_source_state(p_org_id uuid,p_action_id uuid)
    returns jsonb language plpgsql security definer set search_path=public as $body$ begin raise exception 'test source read failure'; end $body$ $replace$;
  begin
    perform public.apply_operational_action_transition(ceo,o,a,0,'{"status":"resolved"}','system_verified');
    raise exception 'Failed source read verified';
  exception when raise_exception then if sqlerrm<>'test source read failure' then raise; end if; end;
  execute definition;
  if (select status from public.operational_actions where id=a)<>'awaiting_verification' then raise exception 'Read failure changed status'; end if;

  legacy:=pg_temp.warning(o,'daily-missing');
  begin
    perform public.apply_operational_action_transition(manager,o,legacy,0,'{"status":"resolved"}','legacy_retired','Replaced by scoped checks');
    raise exception 'Manager retired a CEO-only warning';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_operational_action_transition(ceo,o,legacy,0,'{"status":"resolved"}','system_verified');
    raise exception 'Legacy warning claimed verified correction';
  exception when object_not_in_prerequisite_state then null; end;
  result:=public.apply_operational_action_transition(ceo,o,legacy,0,'{"status":"resolved"}','legacy_retired','Replaced by scoped daily checks');
  if result->'event'->>'event_type'<>'legacy_retired' or result->'action'->>'status'<>'resolved'
    or not exists(select 1 from public.governance_audit_events where org_id=o and entity_id=legacy::text
      and event_type='operational_action.legacy_retired') then raise exception 'Retirement evidence missing'; end if;
  if has_function_privilege('authenticated','public.operational_action_source_state(uuid,uuid)','execute') then
    raise exception 'Exact source checker exposed to browser'; end if;
end $$;
rollback;
