-- Laba Poultry Farms: idempotent demo operations for 2026-09-16.
--
-- Fixture data only. Existing operational rows win: every insert uses a
-- deterministic identity and never replaces manually entered evidence.

do $$
begin
  if (select count(*) from public.flocks
      where id::text like 'de400000-%'
        and org_id='27e24583-0df0-415a-8815-d8d57fb49674'
        and status='active') <> 4 then
    raise exception 'September 16 demo load stopped: four active demo flocks were not found.';
  end if;

  if (select count(*) from public.daily_farm_records
      where flock_id::text like 'de400000-%' and record_date='2026-09-15') <> 4 then
    raise exception 'September 16 demo load stopped: September 15 custody is incomplete.';
  end if;
end $$;

create temp table demo_today_flocks on commit drop as
select
  f.id flock_id, f.batch_id, f.house_id, f.farm_id, f.placement_date,
  f.flock_code, f.flock_type::text,
  case f.id
    when 'de400000-0000-4000-8000-000000000001' then 'layer_feed'::public.feed_type
    when 'de400000-0000-4000-8000-000000000002' then 'layer_feed'::public.feed_type
    when 'de400000-0000-4000-8000-000000000003' then 'grower_pullet_feed'::public.feed_type
    else 'broiler_feed'::public.feed_type
  end feed_type,
  case f.id
    when 'de400000-0000-4000-8000-000000000001' then 115::numeric
    when 'de400000-0000-4000-8000-000000000002' then 114::numeric
    when 'de400000-0000-4000-8000-000000000003' then 72::numeric
    else 96::numeric
  end feed_g_per_bird,
  (f.flock_type='layer') layer,
  case f.id
    when 'de400000-0000-4000-8000-000000000001' then 'de600000-0000-4000-8000-000000000001'::uuid
    when 'de400000-0000-4000-8000-000000000002' then 'de600000-0000-4000-8000-000000000001'::uuid
    when 'de400000-0000-4000-8000-000000000003' then 'de600000-0000-4000-8000-000000000002'::uuid
    else 'de600000-0000-4000-8000-000000000003'::uuid
  end feed_item_id,
  d.closing_birds prior_closing
from public.flocks f
join public.daily_farm_records d on d.flock_id=f.id and d.record_date='2026-09-15'
where f.id::text like 'de400000-%'
  and f.org_id='27e24583-0df0-415a-8815-d8d57fb49674';

create temp table demo_today on commit drop as
with base as (
  select f.*, date '2026-09-16' record_date, 147 day_no,
    1 deaths, 0 culls, f.prior_closing opening_birds
  from demo_today_flocks f
), metrics as (
  select *, opening_birds-deaths-culls closing_birds,
    round(opening_birds*feed_g_per_bird*(1+0.025*sin(day_no/6.0))/10.0)*10 feed_grams,
    case when layer then greatest(0,round(opening_birds*least(0.955,greatest(0.82,0.91+0.035*sin(day_no/8.0))))::int) end total_eggs_calc
  from base
), eggs as (
  select *, case when layer then round(total_eggs_calc*0.966)::int end normal_calc,
    case when layer then round(total_eggs_calc*(0.017+0.004*abs(sin(day_no))))::int end broken_calc
  from metrics
)
select *, case when layer then total_eggs_calc-normal_calc-broken_calc end dirty_calc,
  round((feed_grams/1000.0)::numeric,2) actual_feed_kg,
  round((opening_birds*feed_g_per_bird/1000.0)::numeric,2) planned_feed_kg
from eggs;

alter table public.daily_farm_records disable trigger apply_daily_farm_record_counts;

insert into public.daily_farm_records(
  id,org_id,flock_id,record_date,flock_age_weeks,flock_age_days,
  feed_intake_grams,feed_intake_quantity,feed_leftover_grams,feed_type,
  normal_eggs,broken_eggs,dirty_eggs,total_eggs,average_egg_weight_g,
  production_percentage,deaths,mortality_percentage,deaths_cause,
  vaccination_status,medication_vitamins,opening_birds,closing_birds,culls,
  transfers_in,transfers_out,other_removals,water_consumed_liters,recorded_by,synced,
  created_at,updated_at
)
select
  md5('laba-demo-daily-'||flock_id||'-'||record_date)::uuid,
  '27e24583-0df0-415a-8815-d8d57fb49674',flock_id,record_date,
  ((record_date-placement_date)/7)::int,(record_date-placement_date)::int,
  feed_grams,actual_feed_kg,round(feed_grams*.012)::int,feed_type,
  normal_calc,broken_calc,dirty_calc,total_eggs_calc,
  case when layer then round((59.2+1.2*sin(day_no/10.0))::numeric,2) end,
  case when layer then round(total_eggs_calc*100.0/opening_birds,2) end,
  deaths,round(deaths*100.0/opening_birds,4),'Natural loss',
  'No vaccination due',null,opening_birds,closing_birds,culls,0,0,0,
  round((actual_feed_kg*(case when flock_type='broiler' then 1.78 else 1.92 end)*(1+0.03*sin(day_no/5.0)))::numeric,2),
  'f0265096-a7b4-449b-aa0c-55047dcb7db6',true,
  '2026-09-16 18:00+03','2026-09-16 18:30+03'
from demo_today
on conflict (org_id,flock_id,record_date) do nothing;

alter table public.daily_farm_records enable trigger apply_daily_farm_record_counts;

update public.flocks f set current_count=d.closing_birds,updated_at=now()
from public.daily_farm_records d
where f.id=d.flock_id and d.record_date='2026-09-16'
  and f.id in(select flock_id from demo_today_flocks)
  and f.current_count is distinct from d.closing_birds;

insert into public.feeding_schedules(id,org_id,batch_id,schedule_date,feed_type,planned_feed_kg,target_grams_per_bird,notes,created_by,created_at,updated_at)
select md5('laba-demo-feed-plan-'||batch_id||'-'||record_date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',batch_id,record_date,feed_type,
  planned_feed_kg,feed_g_per_bird,'DEMO-SEED: daily ration plan','f0265096-a7b4-449b-aa0c-55047dcb7db6','2026-09-16 06:00+03','2026-09-16 06:00+03'
from demo_today
on conflict (org_id,batch_id,schedule_date) do nothing;

insert into public.feeding_session_records(
  id,org_id,batch_id,flock_id,record_date,session_name,session_time,feeders_count,
  planned_feed_kg,actual_feed_kg,notes,recorded_by,feed_item_id,warehouse_id,feed_type,status,
  completed_at,completed_by,created_at,updated_at
)
select md5('laba-demo-feed-session-'||d.flock_id||'-'||d.record_date||'-'||s.name)::uuid,
  '27e24583-0df0-415a-8815-d8d57fb49674',d.batch_id,d.flock_id,d.record_date,s.name,s.at_time,2,
  round(d.planned_feed_kg/2.0,2),
  case when s.name='Morning' then round(d.actual_feed_kg/2.0,2) else d.actual_feed_kg-round(d.actual_feed_kg/2.0,2) end,
  'DEMO-SEED: feeder check complete','f0265096-a7b4-449b-aa0c-55047dcb7db6',d.feed_item_id,
  'de500000-0000-4000-8000-000000000001',d.feed_type,'completed','2026-09-16 16:00+03',
  'f0265096-a7b4-449b-aa0c-55047dcb7db6',
  (d.record_date::timestamp+s.at_time) at time zone 'Africa/Addis_Ababa','2026-09-16 16:00+03'
from demo_today d cross join(values('Morning'::text,'07:00'::time),('Afternoon','15:30'::time)) s(name,at_time)
on conflict (org_id,flock_id,record_date,session_name) do nothing;

insert into public.feed_day_closures(
  id,org_id,batch_id,flock_id,record_date,status,planned_feed_kg,actual_feed_kg,variance_kg,
  closed_by,closed_at,created_at,updated_at
)
select md5('laba-demo-feed-close-'||flock_id||'-'||record_date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',batch_id,flock_id,record_date,'closed',
  planned_feed_kg,actual_feed_kg,actual_feed_kg-planned_feed_kg,'f0265096-a7b4-449b-aa0c-55047dcb7db6',
  '2026-09-16 18:20+03','2026-09-16 18:20+03','2026-09-16 18:20+03'
from demo_today
on conflict (org_id,flock_id,record_date) do nothing;

insert into public.stock_ledger(
  id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,
  branch_id,farm_id,house_id,flock_id,batch_id,notes,recorded_by,reference_doc,
  source_kind,source_key,created_at,updated_at
)
select md5('laba-demo-feed-issue-'||d.flock_id||'-'||d.record_date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',d.feed_item_id,
  'de500000-0000-4000-8000-000000000001',d.actual_feed_kg,'issue',i.unit_cost,d.record_date,
  '731b34c1-9e8d-4337-a5ee-20aa05b48663',d.farm_id,d.house_id,d.flock_id,d.batch_id,'Feed Control daily close',
  'f0265096-a7b4-449b-aa0c-55047dcb7db6','FEED_CLOSE:'||d.flock_id||':'||d.record_date,
  'feed_day_close',d.flock_id||':'||d.record_date,'2026-09-16 18:20+03','2026-09-16 18:20+03'
from demo_today d join public.inventory_items i on i.id=d.feed_item_id
on conflict (id) do nothing;

insert into public.mortality_events(id,org_id,flock_id,record_date,count,cause,diagnosis,notes,observed_by,recorded_time,created_at,updated_at)
select md5('laba-demo-mortality-'||flock_id||'-'||record_date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',flock_id,record_date,deaths,
  'Natural loss','Routine post-mortem review','DEMO-SEED: reconciled to Daily Record','f0265096-a7b4-449b-aa0c-55047dcb7db6','08:10',
  '2026-09-16 08:15+03','2026-09-16 08:15+03'
from demo_today where deaths>0
on conflict (id) do nothing;

with sales as (
  select r.*,f.farm_id,f.house_id,f.batch_id,
    greatest(1,floor(r.normal_eggs*.90/30.0)) quantity,
    round((285+12*sin((r.record_date-date '2026-04-22')/8.0))::numeric,2) price
  from public.daily_farm_records r join demo_today_flocks f on f.flock_id=r.flock_id
  where f.layer and r.record_date='2026-09-16' and r.normal_eggs>0
)
insert into public.daily_sales_records(
  id,org_id,branch_id,farm_id,house_id,flock_id,batch_id,sale_date,product_category,product_label,
  quantity,unit,unit_price,gross_amount,paid_amount,balance_due,payment_method,customer_name,customer_phone,
  notes,recorded_by,created_at,updated_at
)
select md5('laba-demo-egg-sale-'||flock_id||'-'||record_date)::uuid,org_id,'731b34c1-9e8d-4337-a5ee-20aa05b48663',farm_id,house_id,flock_id,batch_id,record_date,
  'egg','Grade A table eggs',quantity,'tray',price,round(quantity*price,2),round(quantity*price*.96,2),round(quantity*price*.04,2),
  'Cash',case when farm_id='9c8c7c72-d994-4758-8a63-0195b3c12a8b' then 'Addis Fresh Market' else 'Merkato Food Distributors' end,
  '+251911000101','DEMO-SEED: daily dispatch','f0265096-a7b4-449b-aa0c-55047dcb7db6','2026-09-16 16:45+03','2026-09-16 16:45+03'
from sales
on conflict (id) do nothing;

insert into public.stock_ledger(
  id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,
  branch_id,farm_id,house_id,flock_id,batch_id,notes,reference_doc,daily_record_id,recorded_by,
  source_kind,source_key,created_at,updated_at
)
select md5('laba-demo-packaging-use-'||r.id)::uuid,r.org_id,'de600000-0000-4000-8000-000000000008','de500000-0000-4000-8000-000000000001',
  greatest(1,floor(r.normal_eggs*.90/30.0)),'issue',8.50,r.record_date,'731b34c1-9e8d-4337-a5ee-20aa05b48663',f.farm_id,f.house_id,r.flock_id,f.batch_id,
  'Egg trays used for daily dispatch','DAILY_RECORD:'||r.id,r.id,'f0265096-a7b4-449b-aa0c-55047dcb7db6',
  'daily_record_usage',r.id||':de600000-0000-4000-8000-000000000008','2026-09-16 16:30+03','2026-09-16 16:30+03'
from public.daily_farm_records r join demo_today_flocks f on f.flock_id=r.flock_id
where f.layer and r.record_date='2026-09-16'
on conflict (id) do nothing;

-- This second September measurement makes month-to-date growth FCR calculable.
insert into public.weight_records(id,org_id,flock_id,record_date,sample_count,average_weight_g,min_weight_g,max_weight_g,uniformity_pct,created_at,updated_at)
select md5('laba-demo-weight-'||flock_id||'-2026-09-16')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',flock_id,'2026-09-16',60,
  case flock_id
    when 'de400000-0000-4000-8000-000000000001' then 1860
    when 'de400000-0000-4000-8000-000000000002' then 1855
    when 'de400000-0000-4000-8000-000000000003' then 1510
    else 3440
  end,
  case when flock_type='layer' then 1620 when flock_type='rearing' then 1370 else 3150 end,
  case when flock_type='layer' then 2070 when flock_type='rearing' then 1660 else 3690 end,
  89.2,'2026-09-16 10:00+03','2026-09-16 10:00+03'
from demo_today_flocks
on conflict (id) do nothing;

insert into public.health_events(id,org_id,flock_id,event_date,event_type,description,diagnosis,treatment,vet_id,created_at,updated_at)
select md5('laba-demo-health-'||flock_id||'-2026-09-16')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',flock_id,'2026-09-16','observation',
  'Routine flock health and welfare inspection','Clinically normal','No treatment required','f0265096-a7b4-449b-aa0c-55047dcb7db6',
  '2026-09-16 09:00+03','2026-09-16 09:00+03'
from demo_today_flocks
on conflict (id) do nothing;

with generated as (
  select s.id sensor_id,
    round((case s.sensor_type::text when 'temperature' then 24.5+3.1*sin(147/5.0)
      when 'humidity' then 61+8*sin(147/7.0) when 'ammonia' then 10+4*abs(sin(147/8.0))
      else 1.8+.3*sin(147/4.0) end)::numeric,2) reading_value,
    (date '2026-09-16'+t.at_time) at time zone 'Africa/Addis_Ababa' captured_at
  from public.sensors s cross join(values('06:00'::time),('12:00'::time),('18:00'::time),('23:00'::time)) t(at_time)
  where s.external_id like 'DEMO-%'
)
insert into public.sensor_readings(sensor_id,reading_value,captured_at)
select g.sensor_id,g.reading_value,g.captured_at from generated g
where not exists(select 1 from public.sensor_readings r where r.sensor_id=g.sensor_id and r.captured_at=g.captured_at);

update public.sensors set status='online',last_seen='2026-09-16 23:00+03',updated_at=now()
where external_id like 'DEMO-%' and (last_seen is null or last_seen<'2026-09-16 23:00+03');

insert into public.governance_audit_events(org_id,actor_role,event_type,entity_table,entity_id,reason,after_values,metadata,occurred_at)
select '27e24583-0df0-415a-8815-d8d57fb49674','database_maintenance','demo_fixture.daily_loaded','organizations',
  '27e24583-0df0-415a-8815-d8d57fb49674','Loaded deterministic test data for September 16, 2026.',
  jsonb_build_object('record_date','2026-09-16','fixture_only',true),
  jsonb_build_object('seed','demo_today_20260916.sql','idempotent',true),now()
where not exists(select 1 from public.governance_audit_events
  where org_id='27e24583-0df0-415a-8815-d8d57fb49674'
    and event_type='demo_fixture.daily_loaded' and metadata->>'seed'='demo_today_20260916.sql');

do $$
declare growth_ready integer;
begin
  if (select count(*) from public.daily_farm_records where flock_id in(select flock_id from demo_today_flocks) and record_date='2026-09-16') <> 4
     or (select count(*) from public.feed_day_closures where flock_id in(select flock_id from demo_today_flocks) and record_date='2026-09-16') <> 4
     or (select count(*) from public.weight_records where flock_id in(select flock_id from demo_today_flocks) and record_date='2026-09-16') <> 4 then
    raise exception 'September 16 demo verification failed: core operating evidence is incomplete.';
  end if;

  select count(*) into growth_ready from (
    select f.id
    from public.flocks f join public.weight_records w on w.flock_id=f.id
    where f.id in('de400000-0000-4000-8000-000000000003','de400000-0000-4000-8000-000000000004')
      and w.record_date between '2026-09-01' and '2026-09-16'
    group by f.id having count(*)>=2 and max(w.average_weight_g)>min(w.average_weight_g)
  ) ready;
  if growth_ready<>2 then
    raise exception 'September 16 demo verification failed: growth FCR evidence is incomplete.';
  end if;
end $$;

select 'daily_farm_records' source,count(*) rows from public.daily_farm_records where flock_id in(select flock_id from demo_today_flocks) and record_date='2026-09-16'
union all select 'feed_sessions',count(*) from public.feeding_session_records where flock_id in(select flock_id from demo_today_flocks) and record_date='2026-09-16'
union all select 'feed_closures',count(*) from public.feed_day_closures where flock_id in(select flock_id from demo_today_flocks) and record_date='2026-09-16'
union all select 'sales',count(*) from public.daily_sales_records where flock_id in(select flock_id from demo_today_flocks) and sale_date='2026-09-16'
union all select 'weights',count(*) from public.weight_records where flock_id in(select flock_id from demo_today_flocks) and record_date='2026-09-16'
union all select 'health',count(*) from public.health_events where flock_id in(select flock_id from demo_today_flocks) and event_date='2026-09-16';
