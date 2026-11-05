\set ON_ERROR_STOP on
begin;
do $$
declare o uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid();
  farm uuid:=gen_random_uuid(); house uuid:=gen_random_uuid(); batch uuid:=gen_random_uuid(); flock uuid:=gen_random_uuid();
  breed uuid:=gen_random_uuid(); a uuid; result jsonb; metric jsonb;
  today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
begin
  insert into public.organizations(id,name) values(o,'Performance test');
  insert into public.profiles(id,org_id,full_name,role,is_active) values(actor,o,'CEO','ceo',true);
  insert into public.branches(id,org_id,name) values(branch,o,'Branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Farm');
  insert into public.houses(id,org_id,branch_id,farm_id,name,house_type) values(house,o,branch,farm,'House','layer');
  insert into public.breeds(id,org_id,name,type) values(breed,o,'Layer','layer');
  insert into public.breed_standards(org_id,breed_id,week_number,target_hdep_pct,target_mortality_pct)
    select o,breed,w,85,0.5 from generate_series(0,20) w;
  insert into public.batches(id,org_id,branch_id,farm_id,house_id,batch_code,source,placement_date,age_at_placement_days,total_count,status)
    values(batch,o,branch,farm,house,'PERFORMANCE','external_purchase',today-100,0,200,'active');
  insert into public.flocks(id,org_id,farm_id,house_id,batch_id,breed_id,flock_code,flock_type,source,placement_date,
    initial_count,current_count,age_at_placement_days,status)
    values(flock,o,farm,house,batch,breed,'PERFORMANCE','layer','external_purchase',today-100,200,50,0,'active');
  insert into public.daily_farm_records(org_id,flock_id,record_date,opening_birds,closing_birds,deaths,culls,total_eggs,recorded_by)
    select o,flock,today-n,100+100*(n%2),99+100*(n%2),1,0,80+80*(n%2),actor from generate_series(0,29) n;
  select value into metric from jsonb_array_elements(public.operational_performance_warnings(o,flock,today)) where value->>'kind'='production';
  if metric->>'actual'<>'80.00' or metric->>'target'<>'85.00' or metric->>'state'<>'active'
    or metric->>'severity'<>'medium' or metric->>'evidence_days'<>'30' then
    raise exception 'Bird-day production mismatch: %',metric; end if;
  select value into metric from jsonb_array_elements(public.operational_performance_warnings(o,flock,today)) where value->>'kind'='mortality';
  if (metric->>'actual')::numeric<>0.67 or metric->>'state'<>'active' then raise exception 'Mortality bird-days mismatch: %',metric; end if;
  insert into public.operational_actions(org_id,source_key,source_name,source_route,title,context,severity,farm_id,
    status,due_at,source_first_seen_at,source_last_seen_at)
    values(o,'performance-production-'||flock::text,'Test','/app/alerts','Warning','Test','medium',farm,
      'awaiting_verification',now()+interval '1 day',now(),now()) returning id into a;
  if public.operational_action_source_state(o,a)->>'state'<>'active' then raise exception 'Exact performance checker disagrees'; end if;
  result:=public.apply_operational_action_transition(actor,o,a,0,'{"status":"resolved"}','system_verified');
  if result->'event'->>'event_type'<>'verification_failed' then raise exception 'Active performance falsely verified'; end if;
  -- Age-specific target is weighted by recorded birds, not an average of rates.
  update public.breed_standards set target_hdep_pct=90 where breed_id=breed and week_number=14;
  select value into metric from jsonb_array_elements(public.operational_performance_warnings(o,flock,today)) where value->>'kind'='production';
  if (metric->>'target')::numeric<>85.44 then raise exception 'Age target not bird-day weighted: %',metric; end if;
  -- Missing evidence cannot be interpreted as zero or as a successfully fixed issue.
  update public.daily_farm_records set total_eggs=null where flock_id=flock;
  if public.operational_action_source_state(o,a)->>'state'<>'unavailable' then raise exception 'Missing eggs treated as zero/clear'; end if;
  update public.daily_farm_records set total_eggs=0 where flock_id=flock;
  if public.operational_action_source_state(o,a)->>'state'<>'active' then raise exception 'Real zero eggs not warned'; end if;
  update public.breed_standards set target_hdep_pct=null where breed_id=breed and week_number=14;
  if public.operational_action_source_state(o,a)->>'state'<>'unavailable' then raise exception 'Missing age target guessed'; end if;
  update public.flocks set flock_type='broiler' where id=flock;
  if public.operational_action_source_state(o,a)->>'state'<>'clear' then raise exception 'Broilers counted as laying hens'; end if;
  update public.flocks set flock_type='parent_stock' where id=flock;
  update public.breed_standards set target_hdep_pct=85 where breed_id=breed;
  update public.daily_farm_records set total_eggs=coalesce(opening_birds,closing_birds) where flock_id=flock;
  if public.operational_action_source_state(o,a)->>'state'<>'clear' then raise exception 'Parent stock healthy result not clear'; end if;
  update public.daily_farm_records set total_eggs=null where flock_id=flock and record_date=today;
  select value into metric from jsonb_array_elements(public.operational_performance_warnings(o,flock,today)) where value->>'kind'='production';
  if (metric->>'actual')::numeric<>100 or metric->>'evidence_days'<>'29' or metric->>'expected_days'<>'30' then
    raise exception 'Missing numerator diluted rate or hid coverage: %',metric; end if;
  update public.daily_farm_records set voided_at=now() where flock_id=flock;
  if public.operational_action_source_state(o,a)->>'state'<>'unavailable' then raise exception 'Voided evidence used'; end if;
  if public.operational_performance_warnings(gen_random_uuid(),flock,today)<>'[]'::jsonb then raise exception 'Tenant isolation failed'; end if;
  update public.operational_actions set source_key='kpi-production-rate' where id=a;
  if public.operational_action_source_state(o,a)->>'state'<>'superseded' then raise exception 'Legacy KPI not retired safely'; end if;
  if has_function_privilege('authenticated','public.operational_performance_warnings(uuid,uuid,date)','execute') then
    raise exception 'Performance reader exposed to browser'; end if;
end $$;
rollback;
