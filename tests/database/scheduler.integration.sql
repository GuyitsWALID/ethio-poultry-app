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

create temporary table scheduler_fixture(kind text,rule_id uuid);
do $$ declare spec jsonb; r jsonb; day date:=(now() at time zone 'Africa/Addis_Ababa')::date; actor uuid:='22000000-0000-4000-8000-000000000011'; k text; before_count integer; begin
 spec:=jsonb_build_object('farm_id','22000000-0000-4000-8000-000000000014','flock_ids',jsonb_build_array('22000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000002'),'title','Measured flock work','kind','weight','frequency','daily','start_date',day,'active',true);
 r:=public.save_scheduled_work_rule(actor,'22000000-0000-4000-8000-000000000801',null,null,spec);
 insert into scheduler_fixture values('weight',(r->>'id')::uuid);
 if (select count(*) from public.scheduled_work_occurrences where rule_id=(r->>'id')::uuid)<>180 then raise exception '90-day generation differs'; end if;
 perform public.save_scheduled_work_rule(actor,'22000000-0000-4000-8000-000000000801',null,null,spec);
 if (select count(*) from public.scheduled_work_rules where org_id='22000000-0000-4000-8000-000000000010')<>1 then raise exception 'Rule retry duplicated'; end if;
 before_count:=(select count(*) from public.notifications where org_id='22000000-0000-4000-8000-000000000010');
 perform public.generate_scheduled_work('22000000-0000-4000-8000-000000000010','22000000-0000-4000-8000-000000000014',day);
 if (select count(*) from public.notifications where org_id='22000000-0000-4000-8000-000000000010')<>before_count then raise exception 'Notification retry duplicated'; end if;
 perform public.save_scheduled_work_rule(actor,gen_random_uuid(),(r->>'id')::uuid,1,spec||'{"title":"Revised future work"}');
 if exists(select 1 from public.scheduled_work_occurrences where rule_id=(r->>'id')::uuid and due_date=day and plan_revision<>1) then raise exception 'Edit rewrote today'; end if;
 if exists(select 1 from public.scheduled_work_occurrences where rule_id=(r->>'id')::uuid and due_date>day and status='pending' and plan_revision<>2) then raise exception 'Future revision missing'; end if;
 begin perform public.save_scheduled_work_rule(actor,gen_random_uuid(),(r->>'id')::uuid,1,spec);raise exception 'Stale plan applied';exception when serialization_failure then null;end;
 foreach k in array array['cleaning','vaccination','treatment'] loop
  r:=public.save_scheduled_work_rule(actor,gen_random_uuid(),null,null,spec||jsonb_build_object('kind',k,'frequency','once','title',k||' planned'));
  insert into scheduler_fixture values(k,(r->>'id')::uuid);
 end loop;
 r:=public.save_scheduled_work_rule('22000000-0000-4000-8000-000000000012',gen_random_uuid(),null,null,spec||jsonb_build_object('title','CEO controlled plan','start_date',day+1,'frequency','once'));
 begin perform public.save_scheduled_work_rule(actor,gen_random_uuid(),(r->>'id')::uuid,1,spec);raise exception 'Manager edited CEO plan';exception when insufficient_privilege then null;end;
 -- Model a former CEO whose account now has a manager role: original creator role still controls the plan.
 update public.scheduled_work_rules set created_by=actor where id=(r->>'id')::uuid;
 begin perform public.save_scheduled_work_rule(actor,gen_random_uuid(),(r->>'id')::uuid,1,spec);raise exception 'Demoted CEO edited a CEO-created plan';exception when insufficient_privilege then null;end;
 begin perform public.save_scheduled_work_rule(actor,gen_random_uuid(),null,null,spec||'{"farm_id":"22000000-0000-4000-8000-000000000015"}');raise exception 'Cross-farm plan accepted';exception when insufficient_privilege then null;end;
 insert into public.warehouses(id,org_id,branch_id,farm_id,name,type,status) values('22000000-0000-4000-8000-000000000810','22000000-0000-4000-8000-000000000010','22000000-0000-4000-8000-000000000013','22000000-0000-4000-8000-000000000014','Scheduler store','farm_store','active');
 insert into public.inventory_items(id,org_id,name,category,unit,unit_cost,reorder_level) values('22000000-0000-4000-8000-000000000811','22000000-0000-4000-8000-000000000010','Scheduler vaccine','vaccine','dose',1,0),('22000000-0000-4000-8000-000000000812','22000000-0000-4000-8000-000000000010','Scheduler medicine','medicine','ml',1,0);
 insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date,recorded_by)
 select '22000000-0000-4000-8000-000000000010',x,'22000000-0000-4000-8000-000000000810','receipt',10,1,day,actor from unnest(array['22000000-0000-4000-8000-000000000811'::uuid,'22000000-0000-4000-8000-000000000812'::uuid]) x;
end $$;
grant select on scheduler_fixture to authenticated;
do $$ declare n integer;begin
 insert into public.scheduled_work_occurrences(org_id,rule_id,farm_id,flock_id,due_date,title,kind,plan_revision)
 select '22000000-0000-4000-8000-000000000010',rule_id,'22000000-0000-4000-8000-000000000014','22000000-0000-4000-8000-000000000001',
  (now() at time zone 'Africa/Addis_Ababa')::date-1,'Overdue measured work','weight',1 from scheduler_fixture where kind='weight';
 perform public.generate_scheduled_work('22000000-0000-4000-8000-000000000010','22000000-0000-4000-8000-000000000014',(now() at time zone 'Africa/Addis_Ababa')::date);
 n:=(select count(*) from public.operational_action_events where org_id='22000000-0000-4000-8000-000000000010' and event_type='escalated');
 if n<>1 then raise exception 'Overdue work did not escalate exactly once';end if;
 perform public.generate_scheduled_work('22000000-0000-4000-8000-000000000010','22000000-0000-4000-8000-000000000014',(now() at time zone 'Africa/Addis_Ababa')::date);
 if (select count(*) from public.operational_action_events where org_id='22000000-0000-4000-8000-000000000010' and event_type='escalated')<>n then raise exception 'Escalation replay duplicated';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claims','{"sub":"22000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
do $$ declare o public.scheduled_work_occurrences; cmd jsonb; result jsonb; k text; source_count integer; day date:=(now() at time zone 'Africa/Addis_Ababa')::date; begin
 begin update public.scheduled_work_occurrences set status='completed';raise exception 'Direct outcome write allowed';exception when insufficient_privilege then null;end;
 begin perform public.finish_farm_operating_day_v1(auth.uid(),gen_random_uuid(),1,'{}','22000000-0000-4000-8000-000000000014',day,'stale');raise exception 'Day closed with pending work';exception when check_violation then if sqlerrm not like 'Scheduled work%' then raise;end if;end;
 foreach k in array array['weight','cleaning','vaccination','treatment'] loop
  select x.* into o from public.scheduled_work_occurrences x join scheduler_fixture f on f.rule_id=x.rule_id and f.kind=k
   where x.due_date=day and x.flock_id='22000000-0000-4000-8000-000000000001';
  cmd:=jsonb_build_object('schema_version',1,'command_id',gen_random_uuid(),'type','complete_scheduled_work','farm_id',o.farm_id,'flock_id',o.flock_id,'work_date',day,
   'payload',jsonb_build_object('occurrence_id',o.id,'occurrence_revision',o.revision,'outcome','completed','notes','Actual work completed','sample_count',10,'average_weight_g',1500,'min_weight_g',1400,'max_weight_g',1600,'uniformity_pct',90,'vaccination_route','water')||
   case when k in ('vaccination','treatment') then jsonb_build_object('inventory_usage',jsonb_build_object('item_id',case when k='vaccination' then '22000000-0000-4000-8000-000000000811' else '22000000-0000-4000-8000-000000000812' end,'warehouse_id','22000000-0000-4000-8000-000000000810','quantity',2)) else '{}'::jsonb end);
  result:=public.dispatch_today_command_v1(auth.uid(),cmd);
  if result->>'status'<>'applied' then raise exception 'Scheduled % completion failed: %',k,result;end if;
  if public.dispatch_today_command_v1(auth.uid(),cmd) is distinct from result then raise exception 'Outcome retry changed';end if;
  if (select status from public.scheduled_work_occurrences where id=o.id)<>'completed' then raise exception 'Outcome not persisted';end if;
  if (select source_id from public.scheduled_work_occurrences where id=o.id) is null then raise exception 'No authoritative evidence';end if;
  result:=public.dispatch_today_command_v1(auth.uid(),jsonb_set(cmd,'{command_id}',to_jsonb(gen_random_uuid())));
  if result->>'status'='applied' then raise exception 'Second completion duplicated actual work';end if;
 end loop;
 select x.* into o from public.scheduled_work_occurrences x join scheduler_fixture f on f.rule_id=x.rule_id and f.kind='cleaning' where x.due_date=day and x.flock_id='22000000-0000-4000-8000-000000000002';
 cmd:=jsonb_build_object('schema_version',1,'command_id',gen_random_uuid(),'type','complete_scheduled_work','farm_id',o.farm_id,'flock_id',o.flock_id,'work_date',day,'payload',jsonb_build_object('occurrence_id',o.id,'occurrence_revision',o.revision,'outcome','deferred','reason','House access delayed','deferred_to',day+1));
 result:=public.dispatch_today_command_v1(auth.uid(),cmd);
 if result->>'status'<>'applied' or not exists(select 1 from public.scheduled_work_occurrences where rule_id=o.rule_id and flock_id=o.flock_id and due_date=day+1 and status='pending') then raise exception 'Reasoned deferral failed: %',result;end if;
end $$;
reset role;
create function pg_temp.scheduler_fail_audit() returns trigger language plpgsql as $$begin if new.event_type='scheduler.outcome_recorded' then raise exception 'Forced Scheduler audit failure';end if;return new;end $$;
create trigger scheduler_fixture_audit_failure before insert on public.governance_audit_events for each row execute function pg_temp.scheduler_fail_audit();
set local role authenticated;
do $$declare o public.scheduled_work_occurrences;cmd jsonb;result jsonb;begin
 select x.* into o from public.scheduled_work_occurrences x join scheduler_fixture f on f.rule_id=x.rule_id and f.kind='treatment'
  where x.flock_id='22000000-0000-4000-8000-000000000002';
 cmd:=jsonb_build_object('schema_version',1,'command_id',gen_random_uuid(),'type','complete_scheduled_work','farm_id',o.farm_id,'flock_id',o.flock_id,'work_date',(now() at time zone 'Africa/Addis_Ababa')::date,
 'payload',jsonb_build_object('occurrence_id',o.id,'occurrence_revision',o.revision,'outcome','completed','notes','Actual medicine administered','inventory_usage',jsonb_build_object('item_id','22000000-0000-4000-8000-000000000812','warehouse_id','22000000-0000-4000-8000-000000000810','quantity',2)));
 begin
  result:=public.dispatch_today_command_v1(auth.uid(),cmd);
  raise exception 'Expected audit failure did not abort the command';
 exception when raise_exception then if sqlerrm<>'Forced Scheduler audit failure' then raise;end if;end;
 if (select status from public.scheduled_work_occurrences where id=o.id)<>'pending' then raise exception 'Failed audit left a completed outcome';end if;
end $$;
reset role;
drop trigger scheduler_fixture_audit_failure on public.governance_audit_events;
do $$ begin
 if (select count(*) from public.weight_records where org_id='22000000-0000-4000-8000-000000000010')<>1 then raise exception 'Weight duplicated';end if;
 if (select count(*) from public.stock_ledger where org_id='22000000-0000-4000-8000-000000000010' and transaction_type='issue')<>2 then raise exception 'Stock deduction duplicated';end if;
end $$;
do $$declare o public.scheduled_work_occurrences;action uuid;original_source uuid;state text;begin
 for o in select * from public.scheduled_work_occurrences where org_id='22000000-0000-4000-8000-000000000010' and status in ('completed','deferred') loop
  select id into action from public.operational_actions where org_id=o.org_id and source_key='scheduled-work-'||o.id::text;
  state:=public.operational_action_source_state(o.org_id,action)->>'state';
  if state<>'clear' then raise exception 'Scheduled outcome is not source-verified: %',state;end if;
  if o.status='completed' then
   original_source:=o.source_id;
   update public.scheduled_work_occurrences set source_id=gen_random_uuid() where id=o.id;
   if public.operational_action_source_state(o.org_id,action)->>'state'<>'unavailable' then raise exception 'Missing evidence cleared a scheduled warning';end if;
   update public.scheduled_work_occurrences set source_id=original_source where id=o.id;
  end if;
 end loop;
end $$;
update public.user_farm_access set revoked_at=now() where org_id='22000000-0000-4000-8000-000000000010';
set local role authenticated;
do $$begin if exists(select 1 from public.scheduled_work_occurrences) or exists(select 1 from public.scheduled_work_rules) then raise exception 'Revoked assignment retained Scheduler reads';end if;end $$;
reset role;
rollback;
