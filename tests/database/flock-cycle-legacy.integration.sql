\set ON_ERROR_STOP on
begin;
do $$ declare
 v_org uuid:=gen_random_uuid(); v_manager uuid:=gen_random_uuid(); v_ceo uuid:=gen_random_uuid();
 v_branch uuid:=gen_random_uuid(); v_farm uuid:=gen_random_uuid(); v_house uuid:=gen_random_uuid();
 v_cycle uuid:=gen_random_uuid(); v_batch uuid:=gen_random_uuid(); v_flock uuid:=gen_random_uuid(); v_request uuid:=gen_random_uuid();
 v_time timestamptz:=now()-interval '1 day';
begin
 insert into public.organizations(id,name) values(v_org,'Legacy attestation regression');
 insert into public.profiles(id,org_id,full_name,role,is_active) values(v_manager,v_org,'Legacy manager','farm_manager',true),(v_ceo,v_org,'Legacy CEO','ceo',true);
 insert into public.branches(id,org_id,name) values(v_branch,v_org,'Legacy branch');
 insert into public.farms(id,org_id,branch_id,name) values(v_farm,v_org,v_branch,'Legacy farm');
 insert into public.houses(id,org_id,branch_id,farm_id,name,house_type) values(v_house,v_org,v_branch,v_farm,'Legacy house','layer');
 insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values(v_org,v_manager,v_farm,now()-interval '1 day');
 insert into public.batch_cycles(id,org_id,farm_id,cycle_code,production_purpose,status,placement_date,legacy_singleton) values(v_cycle,v_org,v_farm,'Legacy cycle','layer','archived',current_date-100,true);
 insert into public.batches(id,org_id,branch_id,farm_id,house_id,batch_cycle_id,batch_code,source,placement_date,age_at_placement_days,total_count,status) values(v_batch,v_org,v_branch,v_farm,v_house,v_cycle,'Legacy batch','external_purchase',current_date-100,0,100,'archived');
 insert into public.flocks(id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,age_at_placement_days,initial_count,current_count,status) values(v_flock,v_org,v_farm,v_house,v_batch,'Historical count is not live','layer','external_purchase',current_date-100,0,100,90,'archived');
 insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
 values(v_request,v_org,'batch_cycle_close',v_farm,'batch_cycles',v_cycle,array['completion'],jsonb_build_object('cycle_id',v_cycle,'mode','legacy_attestation','completed_at',v_time,'supporting_reference','CEO witnessed empty house','dispositions','[]'::jsonb,'expected_revision',public.lifecycle_cycle_revision(v_org,v_cycle,(v_time at time zone 'Africa/Addis_Ababa')::date)),'Verify historical empty-house evidence.',v_manager,'legacy_clearance','Legacy manager','farm_manager',now());
 perform set_config('request.jwt.claim.sub',v_ceo::text,true);
 perform public.decide_governance_request(v_request,'approved','Reviewed actual time and empty-house evidence.');
 perform set_config('request.jwt.claim.sub',v_manager::text,true);
 perform public.apply_governance_request(v_request);
 perform public.apply_governance_request(v_request);
 if not exists(select 1 from public.flocks where id=v_flock and initial_count=100 and current_count=90 and completed_at=v_time) then raise exception 'Legacy completion rewrote historical populations'; end if;
 if (select count(*) from public.batch_cycle_clearances where flock_id=v_flock)<>1 then raise exception 'Legacy completion duplicated evidence'; end if;
 if exists(select 1 from public.batch_cycle_dispositions where org_id=v_org) then raise exception 'Legacy completion invented final outflows'; end if;
 if not exists(select 1 from public.batch_cycles where id=v_cycle and completion_verified) then raise exception 'Legacy completion remained unverified'; end if;
 if not exists(select 1 from public.lifecycle_record_changes where request_id=v_request and source_id=v_flock and before_values->>'current_count'='90' and after_values->>'current_count'='90') then raise exception 'Legacy completion lacks target-specific audit'; end if;
end $$;
rollback;
