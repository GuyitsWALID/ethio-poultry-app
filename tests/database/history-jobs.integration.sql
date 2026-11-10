\set ON_ERROR_STOP on
begin;
do $$
declare o uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 br uuid:=gen_random_uuid(); farm uuid:=gen_random_uuid(); h uuid; b uuid; f uuid; fs uuid[]:='{}';
 day date:=(now() at time zone 'Africa/Addis_Ababa')::date; result jsonb; row jsonb; a uuid; e bigint; n uuid;
 claim jsonb; claims jsonb[]; schedule public.management_report_schedules; last_time timestamptz; last_id uuid; i integer;
begin
 insert into organizations(id,name,today_workspace_enabled) values(o,'History jobs fixture',true);
 insert into profiles(id,org_id,full_name,role,is_active) values(c,o,'CEO','ceo',true),(m,o,'Manager','farm_manager',true),(outsider,o,'Other manager','farm_manager',true);
 insert into branches(id,org_id,name) values(br,o,'Branch');
 insert into farms(id,org_id,branch_id,name) values(farm,o,br,'Farm');
 perform public.change_farm_manager_assignment(c,farm,m,now(),null,null,null,'Fixture assignment','grant');
 for i in 1..12 loop
   h:=gen_random_uuid();b:=gen_random_uuid();f:=gen_random_uuid();fs:=array_append(fs,f);
   insert into houses(id,org_id,branch_id,farm_id,name,house_type) values(h,o,br,farm,'House '||i,'layer');
   insert into batches(id,org_id,branch_id,farm_id,house_id,batch_code,source,placement_date,age_at_placement_days,total_count,status)
     values(b,o,br,farm,h,'JOBS-'||i,'external_purchase',day,10,100,'active');
   insert into flocks(id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,age_at_placement_days,initial_count,current_count,status)
     values(f,o,farm,h,b,'Jobs '||i,'layer','external_purchase',day,10,100,100,'active');
 end loop;
 result:=public.today_farm_resource_tokens(m,farm,day,fs,'{}');
 if jsonb_array_length(result->'flocks')<>12 or result->>'operating_revision'<>public.today_resource_revision('operating_day',farm,day) then raise exception 'Farm token snapshot incomplete'; end if;
 for row in select value from jsonb_array_elements(result->'flocks') loop
   if row->>'health_fingerprint'<>public.today_source_fingerprint(farm,(row->>'flock_id')::uuid,day,'health_deaths')
     or row->>'feed_revision'<>public.today_resource_revision('feed_day',(row->>'flock_id')::uuid,day) then raise exception 'Canonical token changed'; end if;
 end loop;
 begin perform public.today_farm_resource_tokens(outsider,farm,day,fs,'{}');raise exception 'Unassigned reader allowed';exception when insufficient_privilege then null;end;
 begin perform public.today_farm_resource_tokens(m,farm,day,array_append(fs,gen_random_uuid()),'{}');raise exception 'Wrong flock allowed';exception when serialization_failure then null;end;
 begin perform public.today_farm_resource_tokens(m,farm,day,array_append(fs,fs[1]),'{}');raise exception 'Duplicate flock allowed';exception when serialization_failure then null;end;

 insert into notification_preferences(profile_id,org_id,email_enabled,email_minimum_severity,updated_at,updated_by) values(m,o,true,'low',now()-interval '1 year',m);
 insert into operational_actions(org_id,source_key,source_name,source_route,title,context,severity,farm_id,owner_id,status,due_at,source_first_seen_at,source_last_seen_at)
 values(o,'jobs-fixture','Daily Records','/app/today','Task','Fixture','high',farm,m,'assigned',now(),now(),now()) returning id into a;
 -- One old unsent notice stays reachable behind over 250 newer completed deliveries.
 for i in 1..302 loop
   insert into operational_action_events(org_id,action_id,event_type,actor_id,actor_role_snapshot,actor_name_snapshot)
     values(o,a,'assigned',c,'ceo','CEO') returning id into e;
   insert into notifications(org_id,recipient_id,action_id,action_event_id,event_type,severity,title,message,route,created_at)
     values(o,m,a,e,'assigned','high','Task','Fixture','/app/alerts',now()-interval '1 day'+i*interval '1 second') returning id into n;
   if i=1 then claim:=jsonb_build_object('id',n);elsif i>2 then
     insert into notification_delivery_attempts(org_id,notification_id,channel,attempt_number,status,provider) values(o,n,'email',1,'sent','fixture');
   end if;
 end loop;
 select array_agg(value) into claims from public.claim_notification_emails(25) value;
 if cardinality(claims)<>2 or claims[1]->>'id'<>claim->>'id' then raise exception 'Old pending notice starved'; end if;
 if exists(select 1 from public.claim_notification_emails(25)) then raise exception 'Active claims duplicated'; end if;
 claim:=claims[1];
 if public.record_notification_email_phase((claim->>'id')::uuid,(claim->>'claim_token')::uuid,'sending')<>'sending' then raise exception 'Claim not started';end if;
 if public.record_notification_email_phase((claim->>'id')::uuid,(claim->>'claim_token')::uuid,'sending')<>'already_sending' then raise exception 'Repeated sending allowed';end if;
 perform public.record_notification_email_phase((claim->>'id')::uuid,(claim->>'claim_token')::uuid,'uncertain',null,'TIMEOUT');
 perform public.record_notification_email_phase((claims[2]->>'id')::uuid,(claims[2]->>'claim_token')::uuid,'failed',null,'TEMPORARY',true);
 if exists(select 1 from public.claim_notification_emails(25)) then raise exception 'Uncertain or delayed delivery retried'; end if;
 begin update notification_delivery_attempts set provider='changed' where notification_id=(claim->>'id')::uuid;raise exception 'Delivery evidence mutable';exception when insufficient_privilege then null;end;
 for i in 1..21 loop
   insert into management_report_schedules(org_id,created_by,name,cadence,run_day,run_hour,lookback_days,scope,recipient_ids,next_run_at)
     values(o,c,'Schedule '||i,'weekly',1,7,30,'{}',array[c],now()-interval '1 day');
 end loop;
 if (select count(*) from public.due_management_report_schedules(now()))<>20 then raise exception 'Due page not bounded';end if;
 select * into schedule from public.due_management_report_schedules(now()) order by next_run_at desc,id desc limit 1;
 last_time:=schedule.next_run_at;last_id:=schedule.id;
 if(select count(*) from public.due_management_report_schedules(now(),last_time,last_id))<>1 then raise exception 'Due cursor skipped schedule';end if;
 if not public.record_report_schedule_failure(schedule.id,schedule.updated_at,0,'GENERATION_FAILED') then raise exception 'Failure not stored';end if;
 if public.record_report_schedule_failure(schedule.id,schedule.updated_at,0,'GENERATION_FAILED') then raise exception 'Concurrent failure counted twice';end if;
 if exists(select 1 from public.due_management_report_schedules(now()) where id=schedule.id) then raise exception 'Retry not delayed';end if;
 if not public.record_report_schedule_failure(schedule.id,schedule.updated_at,1,'CREATOR_AUTHORITY') then raise exception 'Creator failure not stored';end if;
 if exists(select 1 from management_report_schedules where id=schedule.id and is_active) then raise exception 'Invalid creator not paused';end if;
 if exists(select 1 from pg_proc p where pronamespace='public'::regnamespace and proname in ('today_farm_resource_tokens','claim_notification_emails','record_notification_email_phase','record_report_schedule_failure','due_management_report_schedules') and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))) then raise exception 'Private jobs exposed';end if;
end $$;
rollback;
