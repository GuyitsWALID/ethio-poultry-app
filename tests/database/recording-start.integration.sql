\set ON_ERROR_STOP on
begin;
do $$
declare
  org uuid := '19000000-0000-4000-8000-000000000001';
  manager uuid := '19000000-0000-4000-8000-000000000002';
  branch uuid := '19000000-0000-4000-8000-000000000003';
  farm uuid := '19000000-0000-4000-8000-000000000004';
  house uuid := '19000000-0000-4000-8000-000000000005';
  batch uuid := '19000000-0000-4000-8000-000000000006';
  flock uuid := '19000000-0000-4000-8000-000000000007';
  day date := (now() at time zone 'Africa/Addis_Ababa')::date;
begin
  insert into public.organizations(id,name,today_workspace_enabled) values(org,'Opening source fixture',true);
  insert into public.profiles(id,org_id,full_name,role,is_active) values(manager,org,'Opening manager','farm_manager',true);
  insert into public.branches(id,org_id,name) values(branch,org,'Opening branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,org,branch,'Opening farm');
  insert into public.houses(id,org_id,branch_id,farm_id,name,house_type) values(house,org,branch,farm,'Opening house','layer');
  insert into public.batches(id,org_id,branch_id,farm_id,house_id,batch_code,source,placement_date,age_at_placement_days,total_count,status)
    values(batch,org,branch,farm,house,'OPENING-BATCH','external_purchase',day,0,100,'active');
  insert into public.flocks(id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,initial_count,current_count,age_at_placement_days,status)
    values(flock,org,farm,house,batch,'OPENING-FLOCK','layer','external_purchase',day,100,100,0,'active');
  insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at) values(org,manager,farm,now()-interval '1 day');
end $$;
insert into public.profiles(id,org_id,full_name,role,is_active)
values('19000000-0000-4000-8000-000000000008','19000000-0000-4000-8000-000000000001','Starting CEO','ceo',true);
update public.flocks set placement_date=placement_date-30 where id='19000000-0000-4000-8000-000000000007';
update public.batches set placement_date=placement_date-30 where id='19000000-0000-4000-8000-000000000006';
insert into public.governance_requests(id,org_id,request_type,farm_id,source_table,source_id,source_version,changed_fields,
 proposed_values,reason,requested_by,intent,requester_name_snapshot,requester_role_snapshot,latest_submitted_at)
select '19000000-0000-4000-8000-000000000200',org_id,'recording_start',farm_id,'flocks',id,updated_at,
 array['effective_date','live_birds','opening_eggs','supporting_reference'],
 jsonb_build_object('flock_id',id,'effective_date',(now() at time zone 'Africa/Addis_Ababa')::date,
 'live_birds',98,'opening_eggs',0,'supporting_reference','Physical count sheet',
 'expected_revision',public.recording_start_revision(org_id,id)),
 'Earlier records genuinely unavailable.','19000000-0000-4000-8000-000000000002','recording_start','Opening manager','farm_manager',now()
from public.flocks where id='19000000-0000-4000-8000-000000000007';

set local role authenticated;
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000008',true);
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000008","role":"authenticated"}',true);
select public.decide_governance_request('19000000-0000-4000-8000-000000000200','approved','Physical counts reviewed.');
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
savepoint before_source_change;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
update public.flocks set notes='Source changed after approval' where id='19000000-0000-4000-8000-000000000007';
set local role authenticated;
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 begin
  perform public.apply_recording_start_request('19000000-0000-4000-8000-000000000200');
  raise exception 'Stale approved source was accepted';
 exception when serialization_failure then null; end;
 if exists(select 1 from public.flock_recording_starts where flock_id='19000000-0000-4000-8000-000000000007') then
  raise exception 'Failed approval left partial baseline evidence'; end if;
end $$;
rollback to before_source_change;
do $$
declare result public.governance_requests; f public.flocks; command jsonb; reply jsonb;
begin
 result:=public.apply_recording_start_request('19000000-0000-4000-8000-000000000200');
 if result.status<>'applied' then raise exception 'Starting counts did not apply'; end if;
 perform public.apply_recording_start_request(result.id);
 if (select count(*) from public.flock_recording_starts where request_id=result.id)<>1 then raise exception 'Repeated baseline duplicated evidence'; end if;
 if (select count(*) from public.egg_custody_opening_balances where governance_request_id=result.id and quantity=0)<>1 then raise exception 'Explicit zero egg stock lost'; end if;
 select * into f from public.flocks where id='19000000-0000-4000-8000-000000000007';
 if f.current_count<>98 or f.initial_count<>100 or f.placement_date<>(now() at time zone 'Africa/Addis_Ababa')::date-30 then raise exception 'Baseline rewrote placement or failed count synchronization'; end if;
 if exists(select 1 from public.mortality_events where flock_id=f.id) then raise exception 'Baseline manufactured mortality'; end if;
 begin
  update public.flock_recording_starts set live_birds=99 where flock_id=f.id;
  raise exception 'Baseline was editable';
 exception when insufficient_privilege then null; end;
 command:=jsonb_build_object('schema_version',1,'command_id','19000000-0000-4000-8000-000000000201',
 'type','save_daily_record','farm_id',f.farm_id,'flock_id',f.id,'work_date',(now() at time zone 'Africa/Addis_Ababa')::date,
 'payload',jsonb_build_object('daily_record_id',null,'usages',null,'record',jsonb_build_object(
 'record_date',(now() at time zone 'Africa/Addis_Ababa')::date,'opening_birds',98,'closing_birds',98,
 '_today_opening',jsonb_build_object('source','baseline','count',98))));
 reply:=public.dispatch_today_command_v1(auth.uid(),command);
 if reply->>'status'<>'applied' then raise exception 'Approved baseline cannot start Today: %',reply; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
insert into public.daily_farm_records(org_id,flock_id,record_date,opening_birds,closing_birds,deaths,recorded_by)
values('19000000-0000-4000-8000-000000000001','19000000-0000-4000-8000-000000000007',
 (now() at time zone 'Africa/Addis_Ababa')::date-5,100,97,3,'19000000-0000-4000-8000-000000000002');
do $$ begin
 if (select current_count from public.flocks where id='19000000-0000-4000-8000-000000000007')<>98 then
  raise exception 'Pre-baseline loss correction was deducted again from the physical starting count'; end if;
end $$;
update public.user_farm_access set revoked_at=now() where profile_id='19000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"19000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.flock_recording_starts) then raise exception 'Revoked manager can still read baseline'; end if;
 begin
  perform public.apply_recording_start_request('19000000-0000-4000-8000-000000000200');
  raise exception 'Revoked manager can replay baseline';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
