\set ON_ERROR_STOP on
begin;
do $$
declare
  org uuid := '18000000-0000-4000-8000-000000000001';
  manager uuid := '18000000-0000-4000-8000-000000000002';
  branch uuid := '18000000-0000-4000-8000-000000000003';
  farm uuid := '18000000-0000-4000-8000-000000000004';
  house uuid := '18000000-0000-4000-8000-000000000005';
  batch uuid := '18000000-0000-4000-8000-000000000006';
  flock uuid := '18000000-0000-4000-8000-000000000007';
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

set local role authenticated;
select set_config('request.jwt.claim.sub','18000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"18000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$
declare
  actor uuid := '18000000-0000-4000-8000-000000000002';
  flock uuid := '18000000-0000-4000-8000-000000000007';
  farm uuid := '18000000-0000-4000-8000-000000000004';
  day date := (now() at time zone 'Africa/Addis_Ababa')::date;
  command jsonb;
  result jsonb;
  saved public.daily_farm_records;
begin
  command := jsonb_build_object('schema_version',1,'command_id','18000000-0000-4000-8000-000000000101',
    'type','save_daily_record','farm_id',farm,'flock_id',flock,'work_date',day,
    'payload',jsonb_build_object('daily_record_id',null,'usages',null,'record',
      jsonb_build_object('record_date',day,'opening_birds',99,'closing_birds',99,
        '_today_opening',jsonb_build_object('source','placement','count',99))));
  result := public.dispatch_today_command_v1(actor,command);
  if result->>'status'<>'conflict' then raise exception 'Stale opening source accepted: %',result; end if;
  if exists(select 1 from public.daily_farm_records where flock_id=flock) then raise exception 'Rejected start left a record'; end if;
  command := jsonb_set(command,'{command_id}','"18000000-0000-4000-8000-000000000102"');
  command := jsonb_set(command,'{payload,record,opening_birds}','100');
  command := jsonb_set(command,'{payload,record,closing_birds}','100');
  command := jsonb_set(command,'{payload,record,_today_opening,count}','100');
  result := public.dispatch_today_command_v1(actor,command);
  if result->>'status'<>'applied' then raise exception 'Placement source failed: %',result; end if;
  if public.dispatch_today_command_v1(actor,command) is distinct from result then raise exception 'Start retry is not idempotent'; end if;
  select * into saved from public.daily_farm_records where flock_id=flock;
  if saved.opening_birds<>100 or saved.closing_birds<>100 or coalesce(saved.deaths,0)<>0 then
    raise exception 'Placement source did not preserve count';
  end if;
  command := jsonb_set(command,'{command_id}','"18000000-0000-4000-8000-000000000103"');
  result := public.dispatch_today_command_v1(actor,command);
  if result->>'status'<>'conflict' then raise exception 'Second command overwrote an existing day'; end if;
end $$;
rollback;
