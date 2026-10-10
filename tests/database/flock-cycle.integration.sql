\set ON_ERROR_STOP on
begin;
-- Every assertion and fixture rolls back. No platform or farm data is retained.
insert into public.organizations(id,name,today_workspace_enabled) values ('17000000-0000-4000-8000-000000000001','Cycle integration',true);
insert into public.profiles(id,org_id,full_name,role,is_active) values
 ('17000000-0000-4000-8000-000000000002','17000000-0000-4000-8000-000000000001','Cycle manager','farm_manager',true),
 ('17000000-0000-4000-8000-000000000003','17000000-0000-4000-8000-000000000001','Cycle CEO','ceo',true);
insert into public.branches(id,org_id,name) values ('17000000-0000-4000-8000-000000000004','17000000-0000-4000-8000-000000000001','Cycle branch');
insert into public.farms(id,org_id,branch_id,name) values ('17000000-0000-4000-8000-000000000005','17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000004','Cycle farm');
insert into public.houses(id,org_id,branch_id,farm_id,name,house_type) values
 ('17000000-0000-4000-8000-000000000006','17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000004','17000000-0000-4000-8000-000000000005','Cycle house A','layer'),
 ('17000000-0000-4000-8000-000000000007','17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000004','17000000-0000-4000-8000-000000000005','Cycle house B','layer');
insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values ('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000002','17000000-0000-4000-8000-000000000005',now()-interval '1 day');
insert into public.governance_requests(id,org_id,request_type,farm_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
values ('17000000-0000-4000-8000-000000000010','17000000-0000-4000-8000-000000000001','batch_cycle_create','17000000-0000-4000-8000-000000000005',array['placements'],jsonb_build_object(
  'farm_id','17000000-0000-4000-8000-000000000005','cycle_code','SHARED-TEST','production_purpose','layer','source','external_purchase',
  'placed_at',now()-interval '3 hours','actual_date_confirmed',true,'age_at_placement_days',120,'placement_total',200,
  'placements',jsonb_build_array(
    jsonb_build_object('house_id','17000000-0000-4000-8000-000000000006','starting_birds',100,'batch_code','HOUSE-A-TEST','flock_code','FLOCK-A-TEST','expected_revision',public.lifecycle_house_revision('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000006')),
    jsonb_build_object('house_id','17000000-0000-4000-8000-000000000007','starting_birds',100,'batch_code','HOUSE-B-TEST','flock_code','FLOCK-B-TEST','expected_revision',public.lifecycle_house_revision('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000007')))),
 'Actual birds arrived together.','17000000-0000-4000-8000-000000000002','batch_cycle_create','Cycle manager','farm_manager',now());

set local role authenticated;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin perform public.decide_governance_request('17000000-0000-4000-8000-000000000010','approved','Reviewed the actual placements.'); end $$;
do $$ begin
  begin perform public.apply_governance_request('17000000-0000-4000-8000-000000000010'); raise exception 'CEO applied a manager-only lifecycle change'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare r public.governance_requests; begin
  r:=public.apply_governance_request('17000000-0000-4000-8000-000000000010');
  if r.status<>'applied' then raise exception 'Creation did not apply'; end if;
  if (select count(*) from public.flocks where org_id=r.org_id)<>2 or
    (select count(*) from public.batches where batch_cycle_id=r.source_id)<>2 then raise exception 'Canonical house placements were not preserved'; end if;
  perform public.apply_governance_request(r.id);
  if (select count(*) from public.batch_cycles where org_id=r.org_id)<>1 then raise exception 'Repeated application duplicated a cycle'; end if;
  if exists(select 1 from public.batch_cycles where org_id<>r.org_id) or exists(select 1 from public.flocks where org_id<>r.org_id) then raise exception 'Lifecycle RLS leaked another organization'; end if;
  begin perform public.create_branch_batch_cycle(r.org_id,'17000000-0000-4000-8000-000000000004','{}','[]'); raise exception 'Unsafe branch replacement was permitted';
  exception when feature_not_supported then null; end;
  if has_function_privilege('authenticated','public.apply_batch_cycle_close_v1(public.governance_requests)','execute') then raise exception 'Internal mutation exposed to browser'; end if;
  begin
    insert into public.governance_requests(org_id,request_type,status,farm_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
    values(r.org_id,'batch_cycle_create','approved',r.farm_id,array['placements'],r.proposed_values,'Bypass attempted approval',auth.uid(),'manufactured_approval','Cycle manager','farm_manager',now());
    raise exception 'Manager manufactured CEO approval through a direct insert';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);

-- A natural death and a cull are already deducted by the existing Daily Record
-- trigger. Closing a flock sale must never deduct those losses a second time.
insert into public.daily_farm_records(org_id,flock_id,record_date,opening_birds,closing_birds,deaths,culls,today_cull_baseline,
  normal_eggs,broken_eggs,dirty_eggs,total_eggs,water_consumed_liters,recorded_by)
select org_id,id,(now() at time zone 'Africa/Addis_Ababa')::date,100,97,2,1,0,80,0,0,80,20,'17000000-0000-4000-8000-000000000002' from public.flocks where org_id='17000000-0000-4000-8000-000000000001';
insert into public.feed_day_closures(org_id,batch_id,flock_id,record_date,status,actual_feed_kg,closed_at,closed_by)
select org_id,batch_id,id,(now() at time zone 'Africa/Addis_Ababa')::date,'closed',10,now(),'17000000-0000-4000-8000-000000000002' from public.flocks where org_id='17000000-0000-4000-8000-000000000001';
-- Force a real pre-close revision difference instead of relying on now()'s
-- same-transaction timestamp. Zero confirmations must remain usable at close.
update public.daily_farm_records set updated_at=now()-interval '5 minutes' where org_id='17000000-0000-4000-8000-000000000001';
insert into public.daily_task_attestations(org_id,farm_id,flock_id,work_date,task_code,source_fingerprint,confirmed_by)
select org_id,farm_id,id,(now() at time zone 'Africa/Addis_Ababa')::date,'routine_supplies',public.today_source_fingerprint(farm_id,id,(now() at time zone 'Africa/Addis_Ababa')::date,'routine_supplies'),'17000000-0000-4000-8000-000000000002' from public.flocks where org_id='17000000-0000-4000-8000-000000000001';
insert into public.daily_sales_records(id,org_id,branch_id,farm_id,sale_date,product_category,product_label,quantity,unit,unit_price,gross_amount,recorded_by)
values ('17000000-0000-4000-8000-000000000020','17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000004','17000000-0000-4000-8000-000000000005',(now() at time zone 'Africa/Addis_Ababa')::date,'bird','End-cycle birds',194,'bird',100,19400,'17000000-0000-4000-8000-000000000002');
insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,source_version,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
select '17000000-0000-4000-8000-000000000030',c.org_id,'batch_cycle_close',c.farm_id,'batch_cycles',c.id,c.updated_at,array['completion','dispositions'],jsonb_build_object(
 'cycle_id',c.id,'mode','close','completed_at',now()-interval '1 hour','expected_revision',public.lifecycle_cycle_revision(c.org_id,c.id,(now() at time zone 'Africa/Addis_Ababa')::date),
 'dispositions',(select jsonb_agg(jsonb_build_object('flock_id',f.id,'kind','sale','quantity',97,'sale_id','17000000-0000-4000-8000-000000000020','sale_revision',public.lifecycle_sale_revision('17000000-0000-4000-8000-000000000020',c.org_id))) from public.flocks f join public.batches b on b.id=f.batch_id where b.batch_cycle_id=c.id)),
 'All remaining birds were sold.','17000000-0000-4000-8000-000000000002','batch_cycle_close','Cycle manager','farm_manager',now()
from public.batch_cycles c where c.org_id='17000000-0000-4000-8000-000000000001';

-- An insufficient sale must fail after the first member could have been
-- cleared. The entire request, including that first member, must roll back.
insert into public.daily_sales_records(id,org_id,branch_id,farm_id,sale_date,product_category,product_label,quantity,unit,unit_price,gross_amount,recorded_by)
values ('17000000-0000-4000-8000-000000000021','17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000004','17000000-0000-4000-8000-000000000005',(now() at time zone 'Africa/Addis_Ababa')::date,'bird','Insufficient physical birds',100,'bird',100,10000,'17000000-0000-4000-8000-000000000002');
insert into public.governance_requests(id,org_id,request_type,farm_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
select '17000000-0000-4000-8000-000000000031',org_id,request_type,farm_id,changed_fields,
 jsonb_set(proposed_values,'{dispositions}',(select jsonb_agg(jsonb_set(jsonb_set(x,'{sale_id}','"17000000-0000-4000-8000-000000000021"'),'{sale_revision}',to_jsonb(public.lifecycle_sale_revision('17000000-0000-4000-8000-000000000021',r.org_id)))) from jsonb_array_elements(proposed_values->'dispositions') x)),
 reason,requested_by,'capacity_failure',requester_name_snapshot,requester_role_snapshot,latest_submitted_at
from public.governance_requests r where id='17000000-0000-4000-8000-000000000030';

-- Kilograms never imply a head count. Explicit physical evidence can establish
-- capacity, but all allocations must still fit that capacity. Roll this case
-- back so the independent bird-unit regression below remains unchanged.
do $$ declare v_org uuid:='17000000-0000-4000-8000-000000000001'; v_payload jsonb; begin
  begin
    insert into public.daily_sales_records(id,org_id,branch_id,farm_id,sale_date,product_category,product_label,quantity,unit,unit_price,gross_amount,recorded_by)
    select '17000000-0000-4000-8000-000000000022',org_id,branch_id,farm_id,sale_date,product_category,'Physical count regression',400,'kg',100,40000,recorded_by from public.daily_sales_records where id='17000000-0000-4000-8000-000000000021';
    select jsonb_set(r.proposed_values,'{dispositions}',(select jsonb_agg(x||jsonb_build_object('sale_id','17000000-0000-4000-8000-000000000022','sale_revision',public.lifecycle_sale_revision('17000000-0000-4000-8000-000000000022',v_org))) from jsonb_array_elements(r.proposed_values->'dispositions') x)) into v_payload
    from public.governance_requests r where id='17000000-0000-4000-8000-000000000030';
    insert into public.governance_requests(id,org_id,request_type,farm_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
    select '17000000-0000-4000-8000-000000000034',org_id,request_type,farm_id,changed_fields,v_payload,reason,requested_by,'kg_capacity',requester_name_snapshot,requester_role_snapshot,latest_submitted_at from public.governance_requests where id='17000000-0000-4000-8000-000000000030';
    perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
    perform public.decide_governance_request('17000000-0000-4000-8000-000000000034','approved','Review kilogram sale without physical evidence.');
    perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
    begin perform public.apply_governance_request('17000000-0000-4000-8000-000000000034'); raise exception 'Birds inferred from kilograms';
    exception when check_violation then if sqlerrm not like 'A non-bird-unit sale needs%' then raise; end if; end;
    if exists(select 1 from public.batch_cycle_closures where org_id=v_org) then raise exception 'Failed physical evidence left partial closure'; end if;
    select jsonb_set(v_payload,'{dispositions}',(select jsonb_agg(x||jsonb_build_object('physical_head_count',194,'supporting_reference','Signed physical count sheet')) from jsonb_array_elements(v_payload->'dispositions') x)) into v_payload;
    update public.governance_requests set proposed_values=v_payload,status='pending',decided_by=null,decided_at=null,approval_expires_at=null where id='17000000-0000-4000-8000-000000000034';
    perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
    perform public.decide_governance_request('17000000-0000-4000-8000-000000000034','approved','Reviewed exact physical head-count sheet.');
    perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
    perform public.apply_governance_request('17000000-0000-4000-8000-000000000034');
    if (select head_count from public.bird_sale_head_count_attestations where sale_id='17000000-0000-4000-8000-000000000022')<>194 then raise exception 'Physical capacity evidence not stored'; end if;
    if (select sum(quantity) from public.batch_cycle_dispositions where sale_id='17000000-0000-4000-8000-000000000022')<>194 then raise exception 'Physical allocations disagree'; end if;
    raise exception 'rollback successful physical fixture';
  exception when raise_exception then if sqlerrm<>'rollback successful physical fixture' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','',true);

-- Stale reviewed tokens are rejected at CEO decision, before authorization.
insert into public.governance_requests(id,org_id,request_type,farm_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
select '17000000-0000-4000-8000-000000000032',org_id,request_type,farm_id,changed_fields,jsonb_set(proposed_values,'{expected_revision}',to_jsonb(repeat('0',64))),reason,requested_by,'stale_revision',requester_name_snapshot,requester_role_snapshot,latest_submitted_at
from public.governance_requests where id='17000000-0000-4000-8000-000000000030';

-- Final feeding is a hard prerequisite, and a failed close is all-or-nothing.
do $$ declare v_cycle uuid; v_org uuid:='17000000-0000-4000-8000-000000000001'; v_day date:=(now() at time zone 'Africa/Addis_Ababa')::date; begin
  select id into v_cycle from public.batch_cycles where org_id=v_org;
  update public.feed_day_closures set status='reopened' where org_id=v_org;
  insert into public.governance_requests(id,org_id,request_type,farm_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
  select '17000000-0000-4000-8000-000000000033',org_id,request_type,farm_id,changed_fields,
    jsonb_set(proposed_values,'{expected_revision}',to_jsonb(public.lifecycle_cycle_revision(v_org,v_cycle,v_day))),reason,requested_by,'open_feed_failure',requester_name_snapshot,requester_role_snapshot,latest_submitted_at
  from public.governance_requests where id='17000000-0000-4000-8000-000000000030';
  perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
  perform public.decide_governance_request('17000000-0000-4000-8000-000000000033','approved','Open feed regression approval.');
  perform set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
  begin perform public.apply_governance_request('17000000-0000-4000-8000-000000000033'); raise exception 'Open feeding was accepted';
  exception when check_violation then if sqlerrm not like 'Finish feeding for every%' then raise; end if; end;
  if exists(select 1 from public.batch_cycle_closures where org_id=v_org) or exists(select 1 from public.flocks where org_id=v_org and current_count<>97) then raise exception 'Open-feed rejection left partial lifecycle changes'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  update public.feed_day_closures set status='closed' where org_id=v_org;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  begin perform public.decide_governance_request('17000000-0000-4000-8000-000000000032','approved','Stale approval must fail.'); raise exception 'CEO authorized stale evidence';
  exception when serialization_failure then null; end;
  perform public.decide_governance_request('17000000-0000-4000-8000-000000000030','approved','Reviewed all houses and sale capacity.');
  perform public.decide_governance_request('17000000-0000-4000-8000-000000000031','approved','Capacity rejection regression fixture.');
end $$;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare r public.governance_requests; begin
  begin perform public.apply_governance_request('17000000-0000-4000-8000-000000000031'); raise exception 'Insufficient sale capacity was accepted';
  exception when check_violation then if sqlerrm not like 'This sale has insufficient%' then raise; end if; end;
  if exists(select 1 from public.batch_cycle_closures where org_id='17000000-0000-4000-8000-000000000001') or
    exists(select 1 from public.flocks where org_id='17000000-0000-4000-8000-000000000001' and current_count<>97) then raise exception 'Failed closure left a partial mutation'; end if;
  r:=public.apply_governance_request('17000000-0000-4000-8000-000000000030');
  if r.status<>'applied' then raise exception 'Closure did not apply'; end if;
  if exists(select 1 from public.flocks where org_id=r.org_id and (current_count<>0 or status<>'archived')) then raise exception 'Not every member was archived'; end if;
  if exists(select 1 from public.daily_farm_records where org_id=r.org_id and (closing_birds<>0 or deaths<>2 or culls<>1 or other_removals<>97)) then raise exception 'Final-day balance or pre-existing losses were changed incorrectly'; end if;
  if (select count(*) from public.batch_cycle_clearances where org_id=r.org_id)<>2 or
    (select sum(quantity) from public.batch_cycle_dispositions where org_id=r.org_id)<>194 then raise exception 'Missing immutable clearance evidence'; end if;
  if (select count(*) from public.daily_task_attestations a where org_id=r.org_id and superseded_at is null and governance_request_id=r.id and derived_from_id is not null)<>2 then raise exception 'Approved final-record change lacks linked zero-supplies evidence'; end if;
  perform public.apply_governance_request(r.id);
  if (select count(*) from public.batch_cycle_closures where org_id=r.org_id)<>1 then raise exception 'Repeated application duplicated closure'; end if;
  if not exists(select 1 from public.flocks f where f.org_id=r.org_id and public.flock_operates_on(f,(now() at time zone 'Africa/Addis_Ababa')::date)) then raise exception 'Turnover-day old identities disappeared from required work'; end if;
  if exists(select 1 from public.flocks f where f.org_id=r.org_id and public.flock_operates_on(f,(now() at time zone 'Africa/Addis_Ababa')::date+1)) then raise exception 'Completed identities still apply after completion day'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);

do $$ declare v_daily uuid; v_before timestamptz; v_after timestamptz; begin
  if (select count(*) from public.daily_task_attestations a where org_id='17000000-0000-4000-8000-000000000001' and superseded_at is null and governance_request_id='17000000-0000-4000-8000-000000000030' and source_fingerprint=public.today_source_fingerprint(a.farm_id,a.flock_id,a.work_date,a.task_code))<>2 then raise exception 'Approved final-record change stranded previously confirmed zero supplies'; end if;
  begin update public.daily_sales_records set quantity=200 where id='17000000-0000-4000-8000-000000000020'; raise exception 'Allocated sale was silently changed'; exception when insufficient_privilege then null; end;
  begin update public.daily_farm_records set deaths=10 where org_id='17000000-0000-4000-8000-000000000001'; raise exception 'Archived final counts were silently changed'; exception when insufficient_privilege or serialization_failure then null; end;
  begin update public.batch_cycle_dispositions set quantity=1 where org_id='17000000-0000-4000-8000-000000000001'; raise exception 'Immutable disposition was changed'; exception when insufficient_privilege then null; end;
  if (select gross_amount from public.daily_sales_records where id='17000000-0000-4000-8000-000000000020')<>19400 then raise exception 'Closure changed revenue'; end if;
  if (select count(*) from public.exact_lifecycle_corrections('17000000-0000-4000-8000-000000000001'))<>2 then raise exception 'Approved final record revisions were not recognized'; end if;
  select id,updated_at into v_daily,v_before from public.daily_farm_records where org_id='17000000-0000-4000-8000-000000000001' order by id limit 1;
  perform set_config('app.governance_apply','true',true);
  begin update public.batches set total_count=total_count+1 where org_id='17000000-0000-4000-8000-000000000001'; raise exception 'Original archived batch count was editable'; exception when insufficient_privilege then null; end;
  begin update public.batches set batch_cycle_id=null where org_id='17000000-0000-4000-8000-000000000001'; raise exception 'Archived membership was editable'; exception when insufficient_privilege then null; end;
  begin update public.flocks set placed_at=placed_at-interval '1 hour' where org_id='17000000-0000-4000-8000-000000000001'; raise exception 'Original archived arrival was editable'; exception when insufficient_privilege then null; end;
  begin update public.flocks set age_at_placement_days=age_at_placement_days+1 where org_id='17000000-0000-4000-8000-000000000001'; raise exception 'Original archived age was editable'; exception when insufficient_privilege then null; end;
  begin
    insert into public.daily_farm_records(org_id,flock_id,record_date,opening_birds,closing_birds,deaths,culls,water_consumed_liters,recorded_by)
      select org_id,flock_id,record_date-1,100,100,0,0,20,recorded_by from public.daily_farm_records where id=v_daily;
    raise exception 'Historical count inserted behind verified clearance';
  exception when insufficient_privilege then if sqlerrm not like 'This bird history supports an archived cycle.%' then raise; end if; end;
  begin
    insert into public.mortality_events(org_id,flock_id,record_date,cause,count,observed_by)
      select org_id,flock_id,record_date,'unknown',1,recorded_by from public.daily_farm_records where id=v_daily;
    raise exception 'Historical loss inserted behind verified clearance';
  exception when insufficient_privilege then if sqlerrm not like 'This bird history supports an archived cycle.%' then raise; end if; end;
  update public.daily_farm_records set water_consumed_liters=21,updated_at=now() where id=v_daily returning updated_at into v_after;
  perform set_config('app.governance_apply','false',true);
  if v_before is distinct from v_after then raise exception 'Revision-collision fixture must share its transaction timestamp'; end if;
  if exists(select 1 from public.exact_lifecycle_corrections('17000000-0000-4000-8000-000000000001') where source_id=v_daily) then raise exception 'Closure approval granted blanket permission to later changed content'; end if;
end $$;

-- A new placement using the same houses later on the same date is valid;
-- counts come from the new proposal, never from the old remaining population.
insert into public.governance_requests(id,org_id,request_type,farm_id,changed_fields,proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
values ('17000000-0000-4000-8000-000000000040','17000000-0000-4000-8000-000000000001','batch_cycle_create','17000000-0000-4000-8000-000000000005',array['placements'],jsonb_build_object(
 'farm_id','17000000-0000-4000-8000-000000000005','cycle_code','REPLACEMENT-TEST','production_purpose','layer','source','external_purchase','placed_at',now()-interval '30 minutes','actual_date_confirmed',true,'age_at_placement_days',0,'placement_total',150,
 'placements',jsonb_build_array(jsonb_build_object('house_id','17000000-0000-4000-8000-000000000006','starting_birds',150,'batch_code','HOUSE-A-REPLACEMENT','flock_code','FLOCK-A-REPLACEMENT','expected_revision',public.lifecycle_house_revision('17000000-0000-4000-8000-000000000001','17000000-0000-4000-8000-000000000006')))),
 'Actual same-day replacement.','17000000-0000-4000-8000-000000000002','batch_cycle_create','Cycle manager','farm_manager',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin perform public.decide_governance_request('17000000-0000-4000-8000-000000000040','approved','Reviewed completion before replacement.'); end $$;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  perform public.apply_governance_request('17000000-0000-4000-8000-000000000040');
  if (select count(*) from public.flocks f where org_id='17000000-0000-4000-8000-000000000001' and public.flock_operates_on(f,(now() at time zone 'Africa/Addis_Ababa')::date))<>3 then raise exception 'Today must retain both old identities plus the new placement'; end if;
  if not exists(select 1 from public.flocks where flock_code='FLOCK-A-REPLACEMENT' and initial_count=150 and current_count=150) then raise exception 'New starting population was cloned from the old flock'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
update public.user_farm_access set revoked_at=now(),revoked_by='17000000-0000-4000-8000-000000000003' where profile_id='17000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','17000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"17000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  begin perform public.apply_governance_request('17000000-0000-4000-8000-000000000040'); raise exception 'Revoked farm access was accepted'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.batch_cycles where org_id='17000000-0000-4000-8000-000000000001') then raise exception 'Revoked assignment retained lifecycle visibility'; end if;
end $$;
rollback;
