\set ON_ERROR_STOP on
begin;
do $$
declare org uuid:=gen_random_uuid(); ceo uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid(); farm uuid:=gen_random_uuid();
 house uuid:=gen_random_uuid(); batch uuid:=gen_random_uuid(); flock uuid:=gen_random_uuid(); legacy uuid:=gen_random_uuid(); request uuid:=gen_random_uuid();
 day date:=(now() at time zone 'Africa/Addis_Ababa')::date; response jsonb; template uuid; rule public.scheduled_work_rules; revision timestamptz; decision jsonb;
 rows jsonb:='[{"week_number":2,"age_day_start":14,"age_day_end":20,"feed_intake_recommended_g_per_head":100,"target_weight_min_g":200,"target_weight_max_g":300,"feed_type_plan":"broiler_feed"},{"week_number":20,"age_day_start":140,"age_day_end":146,"feed_intake_recommended_g_per_head":120,"target_weight_min_g":1000,"target_weight_max_g":1500,"feed_type_plan":"broiler_feed"}]';
begin
 insert into public.organizations(id,name,today_workspace_enabled) values(org,'Template Scheduler fixture',true);
 insert into public.profiles(id,org_id,full_name,role,is_active) values(ceo,org,'CEO','ceo',true),(manager,org,'Manager','farm_manager',true);
 insert into public.branches(id,org_id,name) values(branch,org,'Branch');
 insert into public.farms(id,org_id,branch_id,name) values(farm,org,branch,'Farm');
 perform public.change_farm_manager_assignment(ceo,farm,manager,now(),null,null,null,'Template test assignment','grant');
 insert into public.houses(id,org_id,branch_id,farm_id,name,house_type) values(house,org,branch,farm,'House','broiler');
 insert into public.batches(id,org_id,branch_id,farm_id,house_id,batch_code,source,placement_date,age_at_placement_days,total_count,status)
 values(batch,org,branch,farm,house,'TEMPLATE','external_purchase',day,14,100,'active');
 insert into public.flocks(id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,age_at_placement_days,initial_count,current_count,status)
 values(flock,org,farm,house,batch,'Template flock','broiler','external_purchase',day,14,100,100,'active');
 begin perform public.save_feed_template(manager,batch,'Plan','manual',rows); raise exception 'Approval bypass accepted'; exception when insufficient_privilege then null; end;
 perform set_config('app.governance_apply','true',true);
 response:=public.save_feed_template(manager,batch,'Plan','manual',rows); template:=(response->>'template_id')::uuid;
 perform set_config('app.governance_apply','false',true);
 if exists(select 1 from public.batch_weight_check_tasks where org_id=org) then raise exception 'New legacy tasks generated for Today'; end if;
 if (select count(*) from public.scheduled_work_rules where org_id=org and feed_template_row_id is not null)<>2 then raise exception 'Template rules missing'; end if;
 if not exists(select 1 from public.scheduled_work_occurrences where org_id=org and flock_id=flock and due_date=day and status='pending') then raise exception 'Today template work missing'; end if;
 if not exists(select 1 from public.scheduled_work_rules where org_id=org and start_date=day+126 and active) then raise exception 'Future work was lost at 90-day horizon'; end if;
 begin perform public.finish_farm_operating_day_v1(manager,gen_random_uuid(),1,'{}',farm,day,null); raise exception 'Finished without template check'; exception when check_violation then if sqlerrm<>'Scheduled work is still missing an outcome.' then raise; end if; end;
 select * into rule from public.scheduled_work_rules where org_id=org and start_date=day;
 begin perform public.save_scheduled_work_rule(manager,gen_random_uuid(),rule.id,rule.revision,jsonb_build_object('farm_id',farm,'flock_ids',jsonb_build_array(flock),'start_date',day,'frequency','once','kind','weight','title','Edit','active',false)); raise exception 'Template-owned work edited outside approval'; exception when insufficient_privilege then null; end;
 -- Only this explicitly identified legacy check is mapped; no match by name/date.
 insert into public.batch_weight_check_tasks(id,org_id,batch_id,flock_id,template_row_id,due_week_number,due_date,status,created_by)
 select legacy,org,batch,flock,id,2,day-7,'scheduled',manager from public.batch_feed_template_rows where template_id=template and week_number=2 returning updated_at into revision;
 begin perform public.reschedule_legacy_template_weight(manager,legacy,revision,day+1,'Reviewed legacy requirement',request); raise exception 'Manager made CEO mapping decision'; exception when insufficient_privilege then null; end;
 begin perform public.reschedule_legacy_template_weight(ceo,legacy,revision+interval '1 second',day+1,'Reviewed legacy requirement',gen_random_uuid()); raise exception 'Stale source mapped'; exception when serialization_failure then null; end;
 decision:=public.reschedule_legacy_template_weight(ceo,legacy,revision,day+1,'Reviewed legacy requirement',request);
 if decision<>public.reschedule_legacy_template_weight(ceo,legacy,revision,day+1,'Reviewed legacy requirement',request) then raise exception 'Mapping retry duplicated'; end if;
 if not exists(select 1 from public.batch_weight_check_tasks where id=legacy and due_date=day-7 and status='scheduled' and weight_record_id is null) then raise exception 'Legacy evidence rewritten'; end if;
 if exists(select 1 from public.scheduler_legacy_preflight(org,array[farm]) where legacy_id=legacy) then raise exception 'Mapped legacy check still offered for conversion'; end if;
 if not exists(select 1 from public.scheduled_work_occurrences where rule_id=(decision->>'id')::uuid and due_date=day+1 and status='pending') then raise exception 'Mapped work not required in Scheduler'; end if;
 begin perform public.reschedule_legacy_template_weight(ceo,legacy,revision,day+2,'Changed mapping decision',request); raise exception 'Changed mapping retry accepted'; exception when serialization_failure then null; end;
 -- Disabled organizations keep one legacy model, not two concurrent task systems.
 perform set_config('request.jwt.claim.sub',ceo::text,true);
 perform public.ceo_toggle_today_workspace(ceo,false,'Verify disabled rollout compatibility');
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('app.governance_apply','true',true);
 response:=public.save_feed_template(manager,batch,'Legacy-compatible plan','manual',rows);
 perform set_config('app.governance_apply','false',true);
 if exists(select 1 from public.scheduled_work_rules r join public.batch_feed_template_rows target on target.id=r.feed_template_row_id where target.template_id=(response->>'template_id')::uuid)
  or not exists(select 1 from public.batch_weight_check_tasks where org_id=org) then raise exception 'Disabled rollout behavior changed'; end if;
 if exists(select 1 from public.scheduled_work_rules where org_id=org and feed_template_row_id is not null and active) then raise exception 'Superseded template kept generating future checks'; end if;
 if not exists(select 1 from public.scheduled_work_occurrences where org_id=org and due_date=day and status='pending') then raise exception 'Today promised work disappeared on template revision'; end if;
end $$;
rollback;
