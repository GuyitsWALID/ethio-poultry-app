\set ON_ERROR_STOP on
begin;

do $$ declare r record; begin
 for r in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in
 ('apply_daily_farm_record_counts','apply_egg_opening_balance_request','apply_monthly_cost_period_totals','apply_sales_unit_conversion_request',
 'ceo_initialize_branch_hierarchy','close_farm_operating_day','close_feed_day','create_branch_batch_cycle','record_feed_milestone','record_feed_weight',
 'record_support_access','reopen_feed_day','save_feed_template','edit_legacy_health_schedule') loop
   if has_function_privilege('anon',r.signature,'execute') then raise exception 'Anonymous mutation remains: %',r.signature; end if;
 end loop;
 for r in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname in
 ('ceo_initialize_branch_hierarchy','record_feed_weight','record_feed_milestone','close_feed_day','reopen_feed_day','save_feed_template','edit_legacy_health_schedule') loop
   if has_function_privilege('authenticated',r.signature,'execute') or not has_function_privilege('service_role',r.signature,'execute') then raise exception 'Incorrect API-only grant: %',r.signature; end if;
 end loop;
 if not has_function_privilege('authenticated','public.close_farm_operating_day(uuid,date,jsonb)','execute') then raise exception 'Authorized operating-day caller lost'; end if;
 if has_table_privilege('authenticated','public.cost_entries','insert') then raise exception 'Direct expense write remains'; end if;
end $$;

do $$ declare
 o uuid:='88000000-0000-4000-8000-000000000001'; m uuid:='88000000-0000-4000-8000-000000000002';
 c uuid:='88000000-0000-4000-8000-000000000003'; br uuid:='88000000-0000-4000-8000-000000000004';
 f uuid:='88000000-0000-4000-8000-000000000005'; other_f uuid:='88000000-0000-4000-8000-000000000006';
 h uuid:='88000000-0000-4000-8000-000000000007'; other_h uuid:='88000000-0000-4000-8000-000000000008';
 b uuid:='88000000-0000-4000-8000-000000000009'; other_b uuid:='88000000-0000-4000-8000-000000000010';
 fl uuid:='88000000-0000-4000-8000-000000000011'; other_fl uuid:='88000000-0000-4000-8000-000000000012';
 store uuid:='88000000-0000-4000-8000-000000000013'; shared uuid:='88000000-0000-4000-8000-000000000014';
 event_id bigint; action uuid; i integer;
begin
 insert into organizations(id,name) values(o,'Security containment'),('88000000-0000-4000-8000-000000000099','Other tenant');
 insert into profiles(id,org_id,full_name,role,is_active) values(m,o,'Manager','farm_manager',true),(c,o,'CEO','ceo',true);
 insert into branches(id,org_id,name) values(br,o,'Branch');
 insert into farms(id,org_id,branch_id,name) values(f,o,br,'Assigned'),(other_f,o,br,'Unassigned');
 insert into houses(id,org_id,branch_id,farm_id,name,house_type) values(h,o,br,f,'Assigned house','layer'),(other_h,o,br,other_f,'Other house','layer');
 insert into batches(id,org_id,branch_id,farm_id,house_id,batch_code,source,placement_date,age_at_placement_days,total_count,status) values
 (b,o,br,f,h,'SEC-A','external_purchase',current_date-1,0,100,'active'),(other_b,o,br,other_f,other_h,'SEC-B','external_purchase',current_date-1,0,100,'active');
 insert into flocks(id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,age_at_placement_days,initial_count,current_count,status) values
 (fl,o,f,h,b,'SEC-A','layer','external_purchase',current_date-1,0,100,100,'active'),(other_fl,o,other_f,other_h,other_b,'SEC-B','layer','external_purchase',current_date-1,0,100,100,'active');
 insert into user_farm_access(org_id,profile_id,farm_id,starts_at) values(o,m,f,now()-interval '1 day');
 insert into user_branch_access(profile_id,branch_id) values(m,br);
 insert into warehouses(id,org_id,branch_id,farm_id,name,type,status) values(store,o,br,f,'Inherited','farm_store','active'),(shared,o,br,null,'Explicit only','central_warehouse','active');
 insert into daily_farm_records(org_id,flock_id,record_date,opening_birds,closing_birds,recorded_by) values(o,fl,current_date,100,100,m),(o,other_fl,current_date,100,100,m);
 insert into health_events(org_id,flock_id,event_date,event_type,description) values(o,fl,current_date,'observation','Assigned evidence'),(o,other_fl,current_date,'observation','Protected evidence');
 insert into weight_records(org_id,flock_id,record_date,sample_count,average_weight_g) values(o,fl,current_date,5,100),(o,other_fl,current_date,5,100);
 insert into inventory_items(id,org_id,name,category,unit) values('88000000-0000-4000-8000-000000000015',o,'Feed','feed','kg');
 insert into feeding_session_records(org_id,batch_id,flock_id,record_date,session_name,feeders_count,planned_feed_kg,warehouse_id,feed_item_id,status,recorded_by)
 values(o,b,fl,current_date,'Owned store session',1,1,store,'88000000-0000-4000-8000-000000000015','planned',m),(o,b,fl,current_date,'Shared store session',1,1,shared,'88000000-0000-4000-8000-000000000015','planned',m);
 insert into daily_sales_records(org_id,branch_id,farm_id,flock_id,batch_id,sale_date,product_category,product_label,quantity,unit,unit_price,gross_amount,recorded_by)
 values(o,br,f,fl,b,current_date,'bird','Authorized sale',1,'bird',10,10,m),(o,br,other_f,other_fl,other_b,current_date,'bird','Protected sale',1,'bird',10,10,m);
 insert into cost_entries(org_id,farm_id,warehouse_id,entry_date,category,description,amount,recorded_by) values(o,f,store,current_date,'transport','Owned expense',10,m),(o,f,shared,current_date,'transport','Shared expense',20,m),(o,other_f,null,current_date,'transport','Other expense',30,m);
 insert into biosecurity_checks(id,org_id,farm_id,checklist_date,notes) values('88000000-0000-4000-8000-000000000020',o,f,current_date,'SCHEDULE|cleanup'),('88000000-0000-4000-8000-000000000021',o,other_f,current_date,'SCHEDULE|cleanup');
 insert into vaccination_events(id,org_id,flock_id,event_date,vaccine_name,dosage,route) values('88000000-0000-4000-8000-000000000022',o,fl,current_date,'Scheduled vaccine','1 ml','water');
 insert into health_events(org_id,flock_id,event_date,event_type,description) values(o,fl,current_date,'observation','SCHEDULE_TARGET|88000000-0000-4000-8000-000000000020|'||f||'|'||h||'|'||fl);
 -- Durable notices remain stored; current access controls every read and send.
 for i in 1..2 loop
   insert into operational_actions(org_id,source_key,source_name,source_route,title,context,severity,farm_id,warehouse_id,owner_id,status,due_at,source_first_seen_at,source_last_seen_at)
     values(o,'security-'||i,'Inventory','/app/inventory','Task','Protected context','high',f,case when i=2 then shared end,m,'assigned',now()+interval '1 day',now(),now()) returning id into action;
   insert into operational_action_events(org_id,action_id,event_type,actor_id,actor_role_snapshot,actor_name_snapshot)
     values(o,action,'assigned',c,'ceo','CEO') returning id into event_id;
   insert into notifications(org_id,recipient_id,action_id,action_event_id,event_type,severity,title,message,route)
     values(o,m,action,event_id,'assigned','high','Task','Protected context','/app/alerts');
 end loop;
 if public.actor_has_operational_scope(m,'88000000-0000-4000-8000-000000000099',f,null) then raise exception 'Cross-tenant access'; end if;
 begin
   perform public.save_feed_template(m,b,'Bypass','manual','[]'); raise exception 'Unapproved template applied';
 exception when insufficient_privilege then null; end;
 insert into governance_requests(id,org_id,request_type,status,farm_id,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at,approval_expires_at,decided_by,decided_at,changed_fields,proposed_values)
 values('88000000-0000-4000-8000-000000000030',o,'feed_template','approved',f,'Approved template regression',m,'feed_template','Manager','farm_manager',now(),now()+interval '1 day',c,now(),array['name','source_type','rows'],
 jsonb_build_object('batch_id',b,'name','Approved template','source_type','manual','rows',jsonb_build_array(jsonb_build_object('week_number',0,'age_day_start',0,'age_day_end',6,'feed_intake_recommended_g_per_head',20,'target_weight_min_g',50,'target_weight_max_g',70,'feed_type_plan','Starter'))));
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','88000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"88000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare t text; n int; begin
 foreach t in array array['daily_farm_records','weight_records','cost_entries','notifications','feeding_session_records','daily_sales_records'] loop
   execute format('select count(*) from public.%I where org_id=''88000000-0000-4000-8000-000000000001''',t) into n;
   if n<>1 then raise exception 'Assigned/inherited read mismatch on %: %',t,n; end if;
 end loop;
 if (select count(*) from health_events where org_id='88000000-0000-4000-8000-000000000001')<>2 then raise exception 'Health access mismatch'; end if;
 if (public.apply_governance_request('88000000-0000-4000-8000-000000000030')).status<>'applied' then raise exception 'Approved template path failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
select set_config('app.governance_apply','false',true);

-- Real single-transaction schedule edit, original target checks, locks and stale revisions.
do $$ declare o uuid:='88000000-0000-4000-8000-000000000001'; m uuid:='88000000-0000-4000-8000-000000000002';
 f uuid:='88000000-0000-4000-8000-000000000005'; h uuid:='88000000-0000-4000-8000-000000000007'; fl uuid:='88000000-0000-4000-8000-000000000011';
 schedule uuid:='88000000-0000-4000-8000-000000000020'; revision timestamptz; result jsonb;
begin
 select updated_at into revision from biosecurity_checks where id=schedule;
 begin
   perform edit_legacy_health_schedule(m,o,'88000000-0000-4000-8000-000000000021','cleanup',revision,current_date,f,h,fl,'{}');
   raise exception 'Unassigned original moved into assigned farm';
 exception when insufficient_privilege then null; end;
 begin
   perform edit_legacy_health_schedule(m,o,schedule,'cleanup',revision-interval '1 second',current_date,f,h,fl,'{}');
   raise exception 'Stale schedule accepted';
 exception when serialization_failure then null; end;
 begin
   perform edit_legacy_health_schedule(m,o,schedule,'cleanup',revision,current_date,f,'88000000-0000-4000-8000-000000000008',fl,'{}');
   raise exception 'Contradictory location accepted';
 exception when invalid_parameter_value then null; end;
 result:=edit_legacy_health_schedule(m,o,schedule,'cleanup',revision,current_date+1,f,h,fl,'{"notes":"SCHEDULE|atomic"}');
 if jsonb_array_length(result->'events')<>1 or (select checklist_date from biosecurity_checks where id=schedule)<>current_date+1
   or not exists(select 1 from health_events where description like 'SCHEDULE_TARGET|'||schedule||'|%' and event_date=current_date+1)
   or not exists(select 1 from governance_audit_events where entity_id=schedule::text and event_type='health_schedule.evidence_updated') then raise exception 'Atomic schedule/evidence/audit missing'; end if;
 select updated_at into revision from vaccination_events where id='88000000-0000-4000-8000-000000000022';
 perform edit_legacy_health_schedule(m,o,'88000000-0000-4000-8000-000000000022','vaccination',revision,current_date+1,f,h,fl,'{"route":"injection"}');
 update vaccination_events set birds_vaccinated=100 where id='88000000-0000-4000-8000-000000000022';
 select updated_at into revision from vaccination_events where id='88000000-0000-4000-8000-000000000022';
 begin
   perform edit_legacy_health_schedule(m,o,'88000000-0000-4000-8000-000000000022','vaccination',revision,current_date+2,f,h,fl,'{}');
   raise exception 'Recorded vaccination edited as a schedule';
 exception when object_not_in_prerequisite_state then null; end;
 insert into farm_operating_days(org_id,farm_id,operating_date,status) values(o,f,current_date+1,'closed');
 select updated_at into revision from biosecurity_checks where id=schedule;
 begin
   perform edit_legacy_health_schedule(m,o,schedule,'cleanup',revision,current_date+2,f,h,fl,'{}');
   raise exception 'Closed original day edited';
 exception when object_not_in_prerequisite_state then null; end;
 delete from farm_operating_days where org_id=o;
end $$;

-- A late metadata failure must roll back the already-executed canonical write.
create function pg_temp.fail_security_metadata() returns trigger language plpgsql as $$ begin raise exception 'test metadata failure' using errcode='23514'; end $$;
create trigger security_test_failure before update on public.health_events for each row when (old.description like 'SCHEDULE_TARGET|88000000-%') execute function pg_temp.fail_security_metadata();
do $$ declare revision timestamptz; begin
 select updated_at into revision from biosecurity_checks where id='88000000-0000-4000-8000-000000000020';
 begin
   perform edit_legacy_health_schedule('88000000-0000-4000-8000-000000000002','88000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000020','cleanup',revision,current_date+2,'88000000-0000-4000-8000-000000000005','88000000-0000-4000-8000-000000000007','88000000-0000-4000-8000-000000000011','{}');
   raise exception 'Expected injected failure';
 exception when check_violation then null; end;
 if (select checklist_date from biosecurity_checks where id='88000000-0000-4000-8000-000000000020')<>current_date+1 then raise exception 'Canonical partial write survived'; end if;
end $$;
drop trigger security_test_failure on health_events;

-- Explicit shared access changes notification and expense visibility immediately.
insert into user_warehouse_access(org_id,profile_id,warehouse_id) values('88000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000002','88000000-0000-4000-8000-000000000014');
do $$ begin
 if (select count(*) from authorized_notifications where org_id='88000000-0000-4000-8000-000000000001')<>2 then raise exception 'Shared notification grant missing'; end if;
end $$;
update user_warehouse_access set revoked_at=now() where org_id='88000000-0000-4000-8000-000000000001';
update user_farm_access set revoked_at=now() where org_id='88000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','88000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"88000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare t text; n int; begin
 foreach t in array array['daily_farm_records','health_events','weight_records','cost_entries','notifications','biosecurity_checks','vaccination_events','feeding_session_records','daily_sales_records'] loop
   execute format('select count(*) from public.%I where org_id=''88000000-0000-4000-8000-000000000001''',t) into n;
   if n<>0 then raise exception 'Revoked read retained on %',t; end if;
 end loop;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
update user_farm_access set revoked_at=null where org_id='88000000-0000-4000-8000-000000000001';
update user_farm_access set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where org_id='88000000-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from authorized_notifications where org_id='88000000-0000-4000-8000-000000000001') then raise exception 'Expired recipient still authorized'; end if;
end $$;
update user_farm_access set expires_at=null where org_id='88000000-0000-4000-8000-000000000001';
update profiles set is_active=false where id='88000000-0000-4000-8000-000000000002';
do $$ begin
 if exists(select 1 from authorized_notifications where org_id='88000000-0000-4000-8000-000000000001') then raise exception 'Inactive recipient still authorized'; end if;
 if (select count(*) from notifications where org_id='88000000-0000-4000-8000-000000000001')<>2 then raise exception 'History destroyed'; end if;
 if public.actor_has_operational_scope('88000000-0000-4000-8000-000000000002','88000000-0000-4000-8000-000000000001','88000000-0000-4000-8000-000000000005',null) then raise exception 'Inactive farm authority'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','88000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"88000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from health_events where org_id='88000000-0000-4000-8000-000000000001') then raise exception 'Inactive direct read'; end if;
end $$;
select set_config('request.jwt.claim.sub','88000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"88000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
 if (select count(*) from cost_entries where org_id='88000000-0000-4000-8000-000000000001')<>3 then raise exception 'CEO authorized reads lost'; end if;
end $$;
reset role;
rollback;
