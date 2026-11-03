\set ON_ERROR_STOP on
begin;
do $$
declare org uuid:='22000000-0000-4000-8000-000000000010'; farm uuid:='22000000-0000-4000-8000-000000000014';
 branch uuid:='22000000-0000-4000-8000-000000000013'; day date:=(now() at time zone 'Africa/Addis_Ababa')::date; n integer;
begin
 insert into public.organizations(id,name,today_workspace_enabled) values(org,'Egg allocation fixture',true);
 insert into public.profiles(id,org_id,full_name,role,is_active) values
 ('22000000-0000-4000-8000-000000000011',org,'Egg manager','farm_manager',true),
 ('22000000-0000-4000-8000-000000000012',org,'Egg CEO','ceo',true);
 insert into public.branches(id,org_id,name) values(branch,org,'Egg branch');
 insert into public.farms(id,org_id,branch_id,name) values(farm,org,branch,'Egg farm'),('22000000-0000-4000-8000-000000000015',org,branch,'Other farm');
 insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values(org,'22000000-0000-4000-8000-000000000011',farm,now()-interval '1 day');
 for n in 1..2 loop
  insert into public.houses(id,org_id,branch_id,farm_id,name,house_type) values(('22000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,org,branch,farm,'Egg house '||n,'layer');
  insert into public.batches(id,org_id,branch_id,farm_id,house_id,batch_code,source,placement_date,age_at_placement_days,total_count,status)
  values(('22000000-0000-4000-8000-'||lpad((200+n)::text,12,'0'))::uuid,org,branch,farm,('22000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,'EGG-'||n,'external_purchase',day-1,120,100,'active');
  insert into public.flocks(id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,age_at_placement_days,initial_count,current_count,status)
  values(('22000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,org,farm,('22000000-0000-4000-8000-'||lpad((100+n)::text,12,'0'))::uuid,
   ('22000000-0000-4000-8000-'||lpad((200+n)::text,12,'0'))::uuid,'EGG-FLOCK-'||n,'layer','external_purchase',day-1,120,100,100,'active');
  insert into public.daily_farm_records(org_id,flock_id,record_date,opening_birds,closing_birds,normal_eggs,broken_eggs,dirty_eggs,deaths,culls,recorded_by)
  values(org,('22000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,day-1,100,100,100,0,0,0,0,'22000000-0000-4000-8000-000000000011');
 end loop;
 -- Simulate an existing pre-release sale, without guessing its source.
 perform set_config('app.egg_sale_write','true',true);
 insert into public.daily_sales_records(id,org_id,branch_id,farm_id,sale_date,product_category,product_label,quantity,unit,unit_price,gross_amount,paid_amount,balance_due,recorded_by)
 values('22000000-0000-4000-8000-000000000300',org,branch,farm,day,'egg','Legacy eggs',5,'egg',1,5,2,3,'22000000-0000-4000-8000-000000000011');
 perform set_config('app.egg_sale_write','',true);
end $$;
-- END EGG FIXTURE

set local role authenticated;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claims','{"sub":"22000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
do $$ declare cmd jsonb; reply jsonb; s public.daily_sales_records; begin
 cmd:=jsonb_build_object('schema_version',1,'command_id','22000000-0000-4000-8000-000000000301','type','record_sale',
  'farm_id','22000000-0000-4000-8000-000000000014','work_date',(now() at time zone 'Africa/Addis_Ababa')::date,'payload',jsonb_build_object(
  'product_category','egg','product_label','Combined eggs','quantity',3,'unit','tray','unit_price',33.67,'paid_amount',50.01,
  'egg_sources',jsonb_build_array(jsonb_build_object('flock_id','22000000-0000-4000-8000-000000000001','egg_quantity',30),
  jsonb_build_object('flock_id','22000000-0000-4000-8000-000000000002','egg_quantity',60))));
 reply:=public.dispatch_today_command_v1(auth.uid(),cmd);
 if reply->>'status'<>'applied' then raise exception 'Combined sale failed: %',reply; end if;
 perform public.dispatch_today_command_v1(auth.uid(),cmd);
 if (select count(*) from public.daily_sales_records where product_label='Combined eggs')<>1 or (select count(*) from public.egg_sale_sources)<>2 then raise exception 'Replay sale/source counts: % / %; role %, org %',
  (select count(*) from public.daily_sales_records where product_label='Combined eggs'),(select count(*) from public.egg_sale_sources),public.current_active_role(),public.current_org_id(); end if;
 select * into s from public.daily_sales_records where product_label='Combined eggs';
 if s.flock_id is not null or s.gross_amount<>101.01 or s.paid_amount<>50.01 or s.balance_due<>51 or s.egg_conversion_multiplier<>30 or s.egg_source_version<>1 then raise exception 'Combined sale financial identity changed'; end if;
 begin update public.daily_sales_records set flock_id='22000000-0000-4000-8000-000000000001' where id=s.id;
  if exists(select 1 from public.daily_sales_records where id=s.id and flock_id is not null) then raise exception 'Direct source correction accepted'; end if;
 exception when check_violation then null; end;
 begin update public.egg_sale_sources set egg_quantity=1 where sale_id=s.id; raise exception 'Immutable source changed'; exception when insufficient_privilege then null; end;
 cmd:=jsonb_set(cmd,'{command_id}','"22000000-0000-4000-8000-000000000302"');
 cmd:=jsonb_set(cmd,'{payload,quantity}','8');
 cmd:=jsonb_set(cmd,'{payload,egg_sources}', '[{"flock_id":"22000000-0000-4000-8000-000000000001","egg_quantity":120},{"flock_id":"22000000-0000-4000-8000-000000000002","egg_quantity":120}]');
 begin
  reply:=public.dispatch_today_command_v1(auth.uid(),cmd);
  if reply->>'status'='applied' then raise exception 'Oversold custody'; end if;
 exception when check_violation then null; end;
 if (select count(*) from public.egg_sale_sources)<>2 then raise exception 'Partial source write'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $$ declare payload jsonb; actor uuid:='22000000-0000-4000-8000-000000000011'; farm uuid:='22000000-0000-4000-8000-000000000014'; day date:=(now() at time zone 'Africa/Addis_Ababa')::date; bad jsonb; begin
 begin update public.daily_sales_records set flock_id='22000000-0000-4000-8000-000000000001' where product_label='Combined eggs'; raise exception 'Privileged source write bypassed guard'; exception when check_violation then null; end;
 payload:='{"product_category":"egg","product_label":"Invalid","quantity":1,"unit":"tray","unit_price":1,"egg_sources":[{"flock_id":"22000000-0000-4000-8000-000000000001","egg_quantity":30}]}';
 foreach bad in array array[
  jsonb_set(payload,'{egg_sources}','[]'),
  jsonb_set(payload,'{egg_sources}','[{"flock_id":"22000000-0000-4000-8000-000000000001","egg_quantity":15},{"flock_id":"22000000-0000-4000-8000-000000000001","egg_quantity":15}]'),
  jsonb_set(payload,'{egg_sources,0,egg_quantity}','29'),
  jsonb_set(payload,'{quantity}','0.333'),
  jsonb_set(payload,'{unit}','"unknown unit"'),
  jsonb_set(payload,'{egg_sources,0,egg_quantity}','"NaN"')
 ] loop
  begin perform public.record_egg_sale(actor,farm,day,bad,gen_random_uuid()); raise exception 'Invalid source evidence accepted'; exception when check_violation then null; end;
 end loop;
 begin perform public.record_egg_sale(actor,'22000000-0000-4000-8000-000000000015',day,payload,gen_random_uuid()); raise exception 'Unassigned farm accepted'; exception when insufficient_privilege then null; end;
 begin perform public.record_egg_sale(actor,farm,day+1,payload,gen_random_uuid()); raise exception 'Future sale accepted'; exception when object_not_in_prerequisite_state then null; end;
 if exists(select 1 from public.daily_sales_records where product_label='Invalid') then raise exception 'Rejected sale persisted'; end if;
 -- Reviewed correction of the exact legacy sale; the financial record is retained.
 insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,source_version,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
 select '22000000-0000-4000-8000-000000000400',org_id,'egg_sale_sources',farm_id,'daily_sales_records',id,updated_at,array['egg_sources'],
 jsonb_build_object('sale_revision',public.lifecycle_sale_revision(id,org_id),'sale_date',sale_date,'egg_sources',public.egg_sale_source_evidence(org_id,farm_id,sale_date,quantity,unit,
 '[{"flock_id":"22000000-0000-4000-8000-000000000001","egg_quantity":5}]')),'Confirmed from original collection sheet.',actor,'egg_sale_sources','Egg manager','farm_manager',now()
 from public.daily_sales_records where id='22000000-0000-4000-8000-000000000300';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000012',true);
select public.decide_governance_request('22000000-0000-4000-8000-000000000400','approved','Reviewed source sheet and egg quantities.');
savepoint before_sale_revision_change;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
update public.daily_sales_records set notes='Changed after CEO source review' where id='22000000-0000-4000-8000-000000000300';
set local role authenticated;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000011',true);
do $$ declare result public.governance_requests; begin
 result:=public.apply_egg_sale_sources_request('22000000-0000-4000-8000-000000000400');
 if result.status<>'conflict' then raise exception 'Stale source approval accepted'; end if;
 if exists(select 1 from public.egg_sale_sources where sale_id='22000000-0000-4000-8000-000000000300') then raise exception 'Stale approval left partial allocation'; end if;
end $$;
rollback to before_sale_revision_change;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000011',true);
select public.apply_egg_sale_sources_request('22000000-0000-4000-8000-000000000400');
select public.apply_egg_sale_sources_request('22000000-0000-4000-8000-000000000400');
do $$ declare s public.daily_sales_records; begin
 select * into s from public.daily_sales_records where id='22000000-0000-4000-8000-000000000300';
 if s.gross_amount<>5 or s.paid_amount<>2 or s.balance_due<>3 or s.egg_source_version<>1 then raise exception 'Source correction changed money or replayed twice'; end if;
 if (select count(*) from public.egg_sale_sources where sale_id=s.id)<>1 then raise exception 'Legacy source correction duplicated'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
create function pg_temp.reject_egg_audit() returns trigger language plpgsql as $$ begin
 if new.event_type='egg_sale.recorded' then raise exception 'Injected egg audit rejection'; end if; return new;
end $$;
create trigger test_egg_audit_failure before insert on public.governance_audit_events for each row execute function pg_temp.reject_egg_audit();
do $$ begin
 begin
  perform public.record_egg_sale('22000000-0000-4000-8000-000000000011','22000000-0000-4000-8000-000000000014',(now() at time zone 'Africa/Addis_Ababa')::date,
   '{"product_category":"egg","product_label":"Audit failure eggs","quantity":1,"unit":"egg","unit_price":1,"egg_sources":[{"flock_id":"22000000-0000-4000-8000-000000000001","egg_quantity":1}]}',gen_random_uuid());
  raise exception 'Sale survived audit failure';
 exception when raise_exception then if sqlerrm<>'Injected egg audit rejection' then raise; end if; end;
 if exists(select 1 from public.daily_sales_records where product_label='Audit failure eggs') or (select count(*) from public.egg_sale_sources)<>3 then raise exception 'Audit failure left partial sale/source evidence'; end if;
end $$;
drop trigger test_egg_audit_failure on public.governance_audit_events;
update public.user_farm_access set revoked_at=now() where profile_id='22000000-0000-4000-8000-000000000011';
set local role authenticated;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000011',true);
do $$ begin
 if exists(select 1 from public.egg_sale_sources) then raise exception 'Revoked assignment still reads source evidence'; end if;
 begin perform public.apply_egg_sale_sources_request('22000000-0000-4000-8000-000000000400'); raise exception 'Revoked replay accepted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
