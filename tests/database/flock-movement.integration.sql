begin;
do $$
declare o uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); ceo uuid:=gen_random_uuid();
  branch uuid:=gen_random_uuid(); farm uuid:=gen_random_uuid(); destination_farm uuid:=gen_random_uuid();
  a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); occupied uuid:=gen_random_uuid();
  cycle uuid:=gen_random_uuid(); batch uuid:=gen_random_uuid(); flock uuid:=gen_random_uuid();
  request uuid:=gen_random_uuid(); bad uuid:=gen_random_uuid(); p jsonb; result public.governance_requests;
  moved timestamptz:=now()-interval '1 hour'; arrival timestamptz:=now()-interval '2 hours';
begin
  insert into public.organizations(id,name,today_workspace_enabled) values(o,'Movement regression',true);
  insert into public.profiles(id,org_id,full_name,role,is_active) values(manager,o,'Manager','farm_manager',true),(ceo,o,'CEO','ceo',true);
  insert into public.branches(id,org_id,name) values(branch,o,'Movement branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Source farm'),(destination_farm,o,branch,'Destination farm');
  insert into public.houses(id,org_id,branch_id,farm_id,name,house_type) values
    (a,o,branch,farm,'Original house','broiler'),(b,o,branch,destination_farm,'Empty destination','broiler'),(occupied,o,branch,farm,'Quarantined destination','broiler');
  insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values(o,manager,farm,now()-interval '1 day'),(o,manager,destination_farm,now()-interval '1 day');
  insert into public.batch_cycles(id,org_id,farm_id,cycle_code,production_purpose,status,placement_date,placed_at)
    values(cycle,o,farm,'Original cohort','broiler','active',(arrival at time zone 'Africa/Addis_Ababa')::date,arrival);
  insert into public.batches(id,org_id,branch_id,farm_id,house_id,batch_cycle_id,batch_code,source,placement_date,age_at_placement_days,total_count,status)
    values(batch,o,branch,farm,a,cycle,'Original placement','external_purchase',(arrival at time zone 'Africa/Addis_Ababa')::date,0,100,'active');
  insert into public.flocks(id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,placed_at,age_at_placement_days,initial_count,current_count,status)
    values(flock,o,farm,a,batch,'Moved whole flock','broiler','external_purchase',(arrival at time zone 'Africa/Addis_Ababa')::date,arrival,0,100,100,'active');
  insert into public.flocks(org_id,farm_id,house_id,flock_code,flock_type,source,placement_date,placed_at,age_at_placement_days,initial_count,current_count,status)
    values(o,farm,occupied,'Quarantined birds','broiler','external_purchase',(arrival at time zone 'Africa/Addis_Ababa')::date,arrival,0,10,10,'quarantined');
  p:=jsonb_build_object('flock_id',flock,'from_house_id',a,'farm_id',destination_farm,'house_id',b,'bird_count',100,'moved_at',moved,
    'expected_revision',public.lifecycle_flock_revision(o,flock),'destination_revision',public.lifecycle_house_revision(o,b));
  insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
    values(request,o,'flock_transfer',farm,'flocks',flock,array['house_id','farm_id'],p,'Approved whole flock move',manager,'whole_move','Manager','farm_manager',now());
  insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
    values(bad,o,'flock_transfer',farm,'flocks',flock,array['house_id','farm_id'],p||jsonb_build_object('bird_count',99),'Reject partial top-up',manager,'partial_move','Manager','farm_manager',now());
  perform set_config('request.jwt.claim.sub',ceo::text,true);
  begin perform public.decide_governance_request(bad,'approved','Review partial transfer'); raise exception 'Partial move accepted';
  exception when serialization_failure then null; end;
  update public.governance_requests set proposed_values=p||jsonb_build_object('farm_id',farm,'house_id',occupied,'destination_revision',public.lifecycle_house_revision(o,occupied)) where id=bad;
  begin perform public.decide_governance_request(bad,'approved','Reject occupied house'); raise exception 'Quarantined house accepted';
  exception when check_violation then null; end;
  update public.governance_requests set proposed_values=p||jsonb_build_object('destination_revision',repeat('0',64)) where id=bad;
  begin perform public.decide_governance_request(bad,'approved','Reject stale house'); raise exception 'Stale destination accepted';
  exception when serialization_failure then null; end;
  perform public.decide_governance_request(request,'approved','Reviewed source and empty destination');
  perform set_config('request.jwt.claim.sub',manager::text,true);
  update public.user_farm_access set revoked_at=now() where profile_id=manager and farm_id=destination_farm;
  begin perform public.apply_governance_request(request); raise exception 'Revoked destination accepted';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.flock_transfers where flock_id=flock) or (select house_id from public.flocks where id=flock)<>a then raise exception 'Denied move left partial changes'; end if;
  update public.user_farm_access set revoked_at=null where profile_id=manager and farm_id=destination_farm;
  result:=public.apply_governance_request(request);
  if result.status<>'applied' or not public.valid_flock_movement_chain(o,flock) then raise exception 'Approved movement chain invalid'; end if;
  if not exists(select 1 from public.flocks where id=flock and farm_id=destination_farm and house_id=b and batch_id=batch and placed_at=arrival and current_count=100)
    or not exists(select 1 from public.batches where id=batch and farm_id=farm and house_id=a and batch_cycle_id=cycle) then raise exception 'Original placement was rewritten'; end if;
  perform public.apply_governance_request(request);
  if (select count(*) from public.flock_transfers where flock_id=flock)<>1 then raise exception 'Repeated application duplicated movement'; end if;
  if (select count(*) from public.lifecycle_record_changes where request_id=request)<>2 then raise exception 'Per-record movement audit missing'; end if;
  begin update public.flock_transfers set bird_count=1 where flock_id=flock; raise exception 'Movement evidence editable'; exception when insufficient_privilege then null; end;
  begin perform public.assert_lifecycle_house_available(o,farm,a,now(),null); raise exception 'Moved-out house reused before cycle completion'; exception when check_violation then null; end;
  -- Completion must be later than the move. Roll back a successful closure
  -- fixture too, leaving the original movement assertions independent.
  begin
    insert into public.daily_farm_records(org_id,flock_id,record_date,opening_birds,closing_birds,deaths,culls,water_consumed_liters,recorded_by)
      values(o,flock,(moved at time zone 'Africa/Addis_Ababa')::date,100,100,0,0,20,manager);
    insert into public.feed_day_closures(org_id,batch_id,flock_id,record_date,status,actual_feed_kg,closed_at,closed_by)
      values(o,batch,flock,(moved at time zone 'Africa/Addis_Ababa')::date,'closed',10,now(),manager);
    insert into public.daily_task_attestations(org_id,farm_id,flock_id,work_date,task_code,source_fingerprint,confirmed_by)
      select o,destination_farm,flock,(moved at time zone 'Africa/Addis_Ababa')::date,task,
        public.today_source_fingerprint(destination_farm,flock,(moved at time zone 'Africa/Addis_Ababa')::date,task),manager
      from unnest(array['health_deaths','routine_supplies']) task;
    update public.governance_requests set request_type='batch_cycle_close',farm_id=farm,source_table='batch_cycles',source_id=cycle,
      proposed_values=jsonb_build_object('cycle_id',cycle,'mode','close','completed_at',moved,
        'expected_revision',public.lifecycle_cycle_revision(o,cycle,(moved at time zone 'Africa/Addis_Ababa')::date),
        'dispositions',jsonb_build_array(jsonb_build_object('flock_id',flock,'kind','other','quantity',100,'reason','All remaining birds departed','supporting_reference','Signed physical departure sheet')))
      where id=bad;
    perform set_config('request.jwt.claim.sub',ceo::text,true);
    perform public.decide_governance_request(bad,'approved','Reviewed closure with actual movement');
    perform set_config('request.jwt.claim.sub',manager::text,true);
    begin perform public.apply_governance_request(bad); raise exception 'Closure at movement time accepted';
    exception when check_violation then
      if sqlerrm<>'Cycle completion must follow its verified whole-flock movement chain.' then raise; end if;
    end;
    if exists(select 1 from public.batch_cycle_closures where cycle_id=cycle)
      or (select current_count from public.flocks where id=flock)<>100 then raise exception 'Rejected close left partial changes'; end if;
    update public.governance_requests set status='pending',decided_by=null,decided_at=null,approval_expires_at=null,
      proposed_values=jsonb_set(proposed_values,'{completed_at}',to_jsonb(moved+interval '1 second')) where id=bad;
    perform set_config('request.jwt.claim.sub',ceo::text,true);
    perform public.decide_governance_request(bad,'approved','Reviewed completion after movement');
    perform set_config('request.jwt.claim.sub',manager::text,true);
    perform public.apply_governance_request(bad);
    if (select current_count from public.flocks where id=flock)<>0
      or not exists(select 1 from public.batch_cycle_clearances where flock_id=flock and house_id=b) then raise exception 'Moved flock not cleared in current house'; end if;
    raise exception 'rollback moved-cycle closure fixture';
  exception when raise_exception then if sqlerrm<>'rollback moved-cycle closure fixture' then raise; end if; end;
  if has_function_privilege('authenticated','public.validate_whole_flock_move(public.governance_requests,boolean)','execute')
    or has_table_privilege('authenticated','public.flock_transfers','insert') then raise exception 'Movement bypass exposed'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  raise notice 'Whole-flock movement, stale approval, quarantine, revoked access, immutable history and replay checks passed.';
end $$;
rollback;
