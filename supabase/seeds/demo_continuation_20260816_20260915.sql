-- Laba Poultry Farms: idempotent demo-data continuation through 2026-09-15.
--
-- This is fixture data, not a schema migration. It preserves manually entered
-- rows, fills only absent deterministic demo identities, and can be retried.
-- Run with psql --single-transaction or an explicit BEGIN/COMMIT wrapper.

do $$
begin
  if not exists (select 1 from public.organizations where id='27e24583-0df0-415a-8815-d8d57fb49674') then
    raise exception 'Demo continuation stopped: Laba Poultry Farms was not found.';
  end if;
  if (select count(*) from public.flocks where id::text like 'de400000-%' and org_id='27e24583-0df0-415a-8815-d8d57fb49674' and status='active')<>4 then
    raise exception 'Demo continuation stopped: the four active demo flocks were not found.';
  end if;
  if not exists (select 1 from public.warehouses where id='de500000-0000-4000-8000-000000000001' and status='active') then
    raise exception 'Demo continuation stopped: the demo warehouse is unavailable.';
  end if;
end $$;

create temp table demo_flocks on commit drop as
select
  f.id flock_id,f.batch_id,f.house_id,f.farm_id,f.placement_date,f.initial_count,
  f.flock_code,f.flock_type::text,
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
  case when f.flock_type='layer' then true else false end layer,
  case f.id
    when 'de400000-0000-4000-8000-000000000001' then 'de600000-0000-4000-8000-000000000001'::uuid
    when 'de400000-0000-4000-8000-000000000002' then 'de600000-0000-4000-8000-000000000001'::uuid
    when 'de400000-0000-4000-8000-000000000003' then 'de600000-0000-4000-8000-000000000002'::uuid
    else 'de600000-0000-4000-8000-000000000003'::uuid
  end feed_item_id,
  (select closing_birds from public.daily_farm_records d where d.flock_id=f.id and d.record_date='2026-08-15') prior_closing
from public.flocks f
where f.id::text like 'de400000-%'
  and f.org_id='27e24583-0df0-415a-8815-d8d57fb49674';

do $$ begin
  if exists(select 1 from demo_flocks where prior_closing is null) then
    raise exception 'Demo continuation stopped: August 15 bird custody is incomplete.';
  end if;
end $$;

create temp table demo_daily on commit drop as
with days as (
  select f.*,d::date record_date,(d::date-date '2026-04-22')::int day_no
  from demo_flocks f cross join generate_series(date '2026-08-16',date '2026-09-15',interval '1 day') d
), events as (
  select *,case when day_no%17=0 then 2 when day_no%7=0 then 1 else 0 end deaths,
    case when day_no in (119,149) then 2 else 0 end culls
  from days
), population as (
  select *,prior_closing-coalesce(sum(deaths+culls) over(partition by flock_id order by record_date rows between unbounded preceding and 1 preceding),0)::int opening_birds
  from events
), metrics as (
  select *,opening_birds-deaths-culls closing_birds,
    round(opening_birds*feed_g_per_bird*(1+0.025*sin(day_no/6.0))/10.0)*10 feed_grams,
    case when layer then greatest(0,round(opening_birds*least(0.955,greatest(0.82,0.91+0.035*sin(day_no/8.0))))::int) end total_eggs_calc
  from population
), eggs as (
  select *,case when layer then round(total_eggs_calc*0.966)::int end normal_calc,
    case when layer then round(total_eggs_calc*(0.017+0.004*abs(sin(day_no))))::int end broken_calc
  from metrics
)
select *,case when layer then total_eggs_calc-normal_calc-broken_calc end dirty_calc,
  round((feed_grams/1000.0)::numeric,2) actual_feed_kg,
  round((opening_birds*feed_g_per_bird/1000.0)::numeric,2) planned_feed_kg
from eggs;

-- Daily Records are inserted with realistic historical timestamps. The count
-- trigger is temporarily disabled because custody values are already calculated
-- sequentially and the final flock balance is set from the latest row.
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
  deaths,round(deaths*100.0/opening_birds,4),
  case when deaths>0 then case when day_no%17=0 then 'Heat stress / natural loss' else 'Natural loss' end end,
  case when record_date=date '2026-08-28' then 'Administered per schedule' else 'No vaccination due' end,
  case when day_no%30=5 then 'Multivitamin electrolyte support' end,
  opening_birds,closing_birds,culls,0,0,0,
  round((actual_feed_kg*(case when flock_type='broiler' then 1.78 else 1.92 end)*(1+0.03*sin(day_no/5.0)))::numeric,2),
  'f0265096-a7b4-449b-aa0c-55047dcb7db6',true,
  (record_date::timestamp+time '18:00') at time zone 'Africa/Addis_Ababa',
  (record_date::timestamp+time '18:30') at time zone 'Africa/Addis_Ababa'
from demo_daily
on conflict (org_id,flock_id,record_date) do nothing;

alter table public.daily_farm_records enable trigger apply_daily_farm_record_counts;

update public.flocks f set current_count=latest.closing_birds,updated_at=now()
from (
  select distinct on (flock_id) flock_id,closing_birds
  from public.daily_farm_records
  where flock_id in(select flock_id from demo_flocks)
  order by flock_id,record_date desc
) latest
where f.id=latest.flock_id and f.current_count is distinct from latest.closing_birds;

-- Feed plan, two completed sessions, daily closure, and canonical stock issue.
insert into public.feeding_schedules(id,org_id,batch_id,schedule_date,feed_type,planned_feed_kg,target_grams_per_bird,notes,created_by,created_at,updated_at)
select md5('laba-demo-feed-plan-'||batch_id||'-'||record_date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',batch_id,record_date,feed_type,
  planned_feed_kg,feed_g_per_bird,'DEMO-SEED: daily ration plan','f0265096-a7b4-449b-aa0c-55047dcb7db6',
  (record_date::timestamp+time '06:00') at time zone 'Africa/Addis_Ababa',(record_date::timestamp+time '06:00') at time zone 'Africa/Addis_Ababa'
from demo_daily
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
  'de500000-0000-4000-8000-000000000001',d.feed_type,'completed',
  (d.record_date::timestamp+time '16:00') at time zone 'Africa/Addis_Ababa','f0265096-a7b4-449b-aa0c-55047dcb7db6',
  (d.record_date::timestamp+s.at_time) at time zone 'Africa/Addis_Ababa',(d.record_date::timestamp+time '16:00') at time zone 'Africa/Addis_Ababa'
from demo_daily d cross join(values('Morning'::text,'07:00'::time),('Afternoon','15:30'::time)) s(name,at_time)
on conflict (org_id,flock_id,record_date,session_name) do nothing;

insert into public.feed_day_closures(
  id,org_id,batch_id,flock_id,record_date,status,planned_feed_kg,actual_feed_kg,variance_kg,
  closed_by,closed_at,created_at,updated_at
)
select md5('laba-demo-feed-close-'||flock_id||'-'||record_date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',batch_id,flock_id,record_date,'closed',
  planned_feed_kg,actual_feed_kg,actual_feed_kg-planned_feed_kg,'f0265096-a7b4-449b-aa0c-55047dcb7db6',
  (record_date::timestamp+time '18:20') at time zone 'Africa/Addis_Ababa',
  (record_date::timestamp+time '18:20') at time zone 'Africa/Addis_Ababa',(record_date::timestamp+time '18:20') at time zone 'Africa/Addis_Ababa'
from demo_daily
on conflict (org_id,flock_id,record_date) do nothing;

-- Replenishment keeps every automatic deduction backed by positive stock.
insert into public.stock_ledger(
  id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,
  branch_id,batch_number,expiry_date,invoice_number,notes,procurement_type,recorded_by,
  reference_doc,supplier_name,source_kind,source_key,created_at,updated_at
)
values
  (md5('laba-demo-continuation-receipt-layer')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000001','de500000-0000-4000-8000-000000000001',10000,'receipt',41.50,'2026-08-16','731b34c1-9e8d-4337-a5ee-20aa05b48663','DEMO-LAYER-0826','2027-05-31','DEMO-FEED-0826-01','DEMO-SEED: continuation feed replenishment','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-0826-01','DEMO Addis Poultry Supply','demo_continuation_receipt','feed-layer-20260816','2026-08-16 06:00+03','2026-08-16 06:00+03'),
  (md5('laba-demo-continuation-receipt-pullet')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000002','de500000-0000-4000-8000-000000000001',5000,'receipt',39.00,'2026-08-16','731b34c1-9e8d-4337-a5ee-20aa05b48663','DEMO-PULLET-0826','2027-05-31','DEMO-FEED-0826-02','DEMO-SEED: continuation feed replenishment','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-0826-02','DEMO Addis Poultry Supply','demo_continuation_receipt','feed-pullet-20260816','2026-08-16 06:00+03','2026-08-16 06:00+03'),
  (md5('laba-demo-continuation-receipt-broiler')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000003','de500000-0000-4000-8000-000000000001',7000,'receipt',43.00,'2026-08-16','731b34c1-9e8d-4337-a5ee-20aa05b48663','DEMO-BROILER-0826','2027-05-31','DEMO-FEED-0826-03','DEMO-SEED: continuation feed replenishment','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-0826-03','DEMO Addis Poultry Supply','demo_continuation_receipt','feed-broiler-20260816','2026-08-16 06:00+03','2026-08-16 06:00+03'),
  (md5('laba-demo-continuation-receipt-vaccine')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000004','de500000-0000-4000-8000-000000000001',7000,'receipt',5.50,'2026-08-16','731b34c1-9e8d-4337-a5ee-20aa05b48663','DEMO-VAC-0826','2027-08-31','DEMO-VAC-0826','DEMO-SEED: vaccination stock replenishment','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-VAC-0826','DEMO Veterinary Supply','demo_continuation_receipt','vaccine-20260816','2026-08-16 06:00+03','2026-08-16 06:00+03'),
  (md5('laba-demo-continuation-receipt-medicine')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000005','de500000-0000-4000-8000-000000000001',24,'receipt',680,'2026-08-16','731b34c1-9e8d-4337-a5ee-20aa05b48663','DEMO-MED-0826','2027-08-31','DEMO-MED-0826','DEMO-SEED: treatment stock replenishment','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-MED-0826','DEMO Veterinary Supply','demo_continuation_receipt','medicine-20260816','2026-08-16 06:00+03','2026-08-16 06:00+03')
on conflict (id) do nothing;

insert into public.stock_ledger(
  id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,
  branch_id,farm_id,house_id,flock_id,batch_id,notes,recorded_by,reference_doc,
  source_kind,source_key,created_at,updated_at
)
select md5('laba-demo-feed-issue-'||flock_id||'-'||record_date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',feed_item_id,
  'de500000-0000-4000-8000-000000000001',actual_feed_kg,'issue',i.unit_cost,record_date,
  '731b34c1-9e8d-4337-a5ee-20aa05b48663',farm_id,house_id,flock_id,batch_id,'Feed Control daily close',
  'f0265096-a7b4-449b-aa0c-55047dcb7db6','FEED_CLOSE:'||flock_id||':'||record_date,
  'feed_day_close',flock_id||':'||record_date,
  (record_date::timestamp+time '18:20') at time zone 'Africa/Addis_Ababa',(record_date::timestamp+time '18:20') at time zone 'Africa/Addis_Ababa'
from demo_daily join public.inventory_items i on i.id=feed_item_id
on conflict (id) do nothing;

-- Reconciled mortality evidence for every Daily Record death.
insert into public.mortality_events(id,org_id,flock_id,record_date,count,cause,diagnosis,notes,observed_by,recorded_time,created_at,updated_at)
select md5('laba-demo-mortality-'||flock_id||'-'||record_date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',flock_id,record_date,deaths,
  case when day_no%17=0 then 'Heat stress / natural loss' else 'Natural loss' end,'Routine post-mortem review','DEMO-SEED: reconciled to Daily Record',
  'f0265096-a7b4-449b-aa0c-55047dcb7db6','08:10',
  (record_date::timestamp+time '08:15') at time zone 'Africa/Addis_Ababa',(record_date::timestamp+time '08:15') at time zone 'Africa/Addis_Ababa'
from demo_daily where deaths>0
on conflict (id) do nothing;

-- Daily egg sales fill the earlier sales gap from July 21 onward.
with sales as (
  select r.*,f.farm_id,f.house_id,f.batch_id,f.flock_code,
    greatest(1,floor(r.normal_eggs*.90/30.0)) quantity,
    round((285+12*sin((r.record_date-date '2026-04-22')/8.0))::numeric,2) price
  from public.daily_farm_records r join demo_flocks f on f.flock_id=r.flock_id
  where f.layer and r.record_date between date '2026-07-21' and date '2026-09-15' and r.normal_eggs>0
), amounts as (
  select *,round(quantity*price,2) gross from sales
)
insert into public.daily_sales_records(
  id,org_id,branch_id,farm_id,house_id,flock_id,batch_id,sale_date,product_category,product_label,
  quantity,unit,unit_price,gross_amount,paid_amount,balance_due,payment_method,customer_name,customer_phone,
  notes,recorded_by,created_at,updated_at
)
select md5('laba-demo-egg-sale-'||flock_id||'-'||record_date)::uuid,org_id,'731b34c1-9e8d-4337-a5ee-20aa05b48663',farm_id,house_id,flock_id,batch_id,record_date,
  'egg','Grade A table eggs',quantity,'tray',price,gross,
  round(gross*(case when extract(day from record_date)::int%5=0 then .80 else .96 end),2),
  gross-round(gross*(case when extract(day from record_date)::int%5=0 then .80 else .96 end),2),
  case when extract(day from record_date)::int%3=0 then 'Bank transfer' else 'Cash' end,
  case when farm_id='9c8c7c72-d994-4758-8a63-0195b3c12a8b' then 'Addis Fresh Market' else 'Merkato Food Distributors' end,
  '+251911000101','DEMO-SEED: daily dispatch','f0265096-a7b4-449b-aa0c-55047dcb7db6',
  (record_date::timestamp+time '16:45') at time zone 'Africa/Addis_Ababa',(record_date::timestamp+time '16:45') at time zone 'Africa/Addis_Ababa'
from amounts
on conflict (id) do nothing;

-- Routine packaging use is linked to each layer Daily Record.
insert into public.stock_ledger(
  id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,
  branch_id,farm_id,house_id,flock_id,batch_id,notes,reference_doc,daily_record_id,recorded_by,
  source_kind,source_key,created_at,updated_at
)
select md5('laba-demo-packaging-use-'||r.id)::uuid,r.org_id,'de600000-0000-4000-8000-000000000008','de500000-0000-4000-8000-000000000001',
  greatest(1,floor(r.normal_eggs*.90/30.0)),'issue',8.50,r.record_date,'731b34c1-9e8d-4337-a5ee-20aa05b48663',f.farm_id,f.house_id,r.flock_id,f.batch_id,
  'Egg trays used for daily dispatch','DAILY_RECORD:'||r.id,r.id,'f0265096-a7b4-449b-aa0c-55047dcb7db6',
  'daily_record_usage',r.id||':de600000-0000-4000-8000-000000000008',
  (r.record_date::timestamp+time '16:30') at time zone 'Africa/Addis_Ababa',(r.record_date::timestamp+time '16:30') at time zone 'Africa/Addis_Ababa'
from public.daily_farm_records r join demo_flocks f on f.flock_id=r.flock_id
where f.layer and r.record_date between date '2026-08-16' and date '2026-09-15'
on conflict (id) do nothing;

-- Periodic weights restore the missing fortnightly measurement series.
insert into public.weight_records(id,org_id,flock_id,record_date,sample_count,average_weight_g,min_weight_g,max_weight_g,uniformity_pct,created_at,updated_at)
select md5('laba-demo-weight-'||f.flock_id||'-'||d::date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',f.flock_id,d::date,60,
  round((case when f.flock_type='layer' then 1845+30*sin(n) when f.flock_type='rearing' then least(1550,1320+n*8) else least(3260,3100+n*5) end)::numeric,1),
  round((case when f.flock_type='layer' then 1600+20*sin(n) when f.flock_type='rearing' then least(1420,1180+n*7) else least(3000,2820+n*5) end)::numeric,1),
  round((case when f.flock_type='layer' then 2050+25*sin(n) when f.flock_type='rearing' then least(1700,1450+n*9) else least(3550,3380+n*4) end)::numeric,1),
  round((87+3*sin(n/2.0))::numeric,1),
  (d::date::timestamp+time '10:00') at time zone 'Africa/Addis_Ababa',(d::date::timestamp+time '10:00') at time zone 'Africa/Addis_Ababa'
from demo_flocks f cross join generate_series(date '2026-07-29',date '2026-09-09',interval '14 days') with ordinality g(d,n)
on conflict (id) do nothing;

-- Routine health observations plus two evidenced medicine treatments.
insert into public.health_events(id,org_id,flock_id,event_date,event_type,description,diagnosis,treatment,vet_id,created_at,updated_at)
select md5('laba-demo-health-'||f.flock_id||'-'||d::date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',f.flock_id,d::date,'observation',
  'Routine flock health and welfare inspection','Clinically normal','No treatment required','f0265096-a7b4-449b-aa0c-55047dcb7db6',
  (d::date::timestamp+time '09:00') at time zone 'Africa/Addis_Ababa',(d::date::timestamp+time '09:00') at time zone 'Africa/Addis_Ababa'
from demo_flocks f cross join (values(date '2026-08-07'),(date '2026-08-22'),(date '2026-09-06')) dates(d)
on conflict (id) do nothing;

insert into public.health_events(id,org_id,flock_id,event_date,event_type,description,diagnosis,treatment,vet_id,created_at,updated_at)
select md5('laba-demo-continuation-treatment-'||flock_id)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',flock_id,date '2026-09-02','treatment',
  'Mild respiratory signs identified during routine inspection','Mild environmental respiratory irritation','Ventilation adjusted and prescribed medicine administered',
  'f0265096-a7b4-449b-aa0c-55047dcb7db6','2026-09-02 09:00+03','2026-09-02 09:00+03'
from demo_flocks where flock_id in('de400000-0000-4000-8000-000000000001','de400000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

insert into public.stock_ledger(
  id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,
  recorded_by,source_kind,source_key,reference_doc,notes,created_at,updated_at
)
select md5('laba-demo-continuation-treatment-stock-'||f.flock_id)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000005',
  'de500000-0000-4000-8000-000000000001',1,'issue',680,date '2026-09-02','731b34c1-9e8d-4337-a5ee-20aa05b48663',f.farm_id,f.house_id,f.flock_id,f.batch_id,
  'f0265096-a7b4-449b-aa0c-55047dcb7db6','health_treatment',md5('laba-demo-continuation-treatment-'||f.flock_id)::uuid::text,
  'TREATMENT:'||md5('laba-demo-continuation-treatment-'||f.flock_id)::uuid,'Medicine administered with treatment record','2026-09-02 09:05+03','2026-09-02 09:05+03'
from demo_flocks f
where f.flock_id in('de400000-0000-4000-8000-000000000001','de400000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

-- Scheduled August booster and its completed administration evidence.
insert into public.vaccination_events(id,org_id,flock_id,event_date,vaccine_name,batch_number,birds_vaccinated,dosage,route,expiry_date,vet_id,created_at,updated_at)
select md5('laba-demo-vaccine-'||flock_id||'-2026-08-28')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',flock_id,date '2026-08-28',
  'Newcastle Disease Booster','DEMO-VAC-0828',closing_birds,'1 dose/bird','water','2027-08-31','f0265096-a7b4-449b-aa0c-55047dcb7db6',
  '2026-08-28 08:00+03','2026-08-28 08:00+03'
from demo_daily where record_date=date '2026-08-28'
on conflict (id) do nothing;

insert into public.stock_ledger(
  id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,
  recorded_by,source_kind,source_key,reference_doc,notes,created_at,updated_at
)
select md5('laba-demo-vaccine-stock-'||flock_id||'-2026-08-28')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000004',
  'de500000-0000-4000-8000-000000000001',closing_birds,'issue',5.50,date '2026-08-28','731b34c1-9e8d-4337-a5ee-20aa05b48663',farm_id,house_id,flock_id,batch_id,
  'f0265096-a7b4-449b-aa0c-55047dcb7db6','vaccination_completion',md5('laba-demo-vaccine-'||flock_id||'-2026-08-28')::uuid::text,
  'VACCINATION:'||md5('laba-demo-vaccine-'||flock_id||'-2026-08-28')::uuid,'Vaccine administered on schedule completion','2026-08-28 08:30+03','2026-08-28 08:30+03'
from demo_daily where record_date=date '2026-08-28'
on conflict (id) do nothing;

-- Sensor continuity for every demo house and measurement type.
with generated as (
  select s.id sensor_id,
    round((case s.sensor_type::text
      when 'temperature' then 24.5+3.1*sin(day_no/5.0)
      when 'humidity' then 61+8*sin(day_no/7.0)
      when 'ammonia' then 10+4*abs(sin(day_no/8.0))
      else 1.8+.3*sin(day_no/4.0) end)::numeric,2) reading_value,
    (d::date+t.at_time) at time zone 'Africa/Addis_Ababa' captured_at
  from public.sensors s cross join generate_series(date '2026-07-21',date '2026-09-15',interval '1 day') d
  cross join(values('06:00'::time),('12:00'::time),('18:00'::time),('23:00'::time)) t(at_time)
  cross join lateral(select(d::date-date '2026-04-22') day_no) x
  where s.external_id like 'DEMO-%'
)
insert into public.sensor_readings(sensor_id,reading_value,captured_at)
select generated.sensor_id,generated.reading_value,generated.captured_at
from generated
where not exists(
  select 1 from public.sensor_readings existing
  where existing.sensor_id=generated.sensor_id and existing.captured_at=generated.captured_at
);

update public.sensors set status='online',last_seen='2026-09-15 20:00+03',updated_at=now()
where external_id like 'DEMO-%' and last_seen<'2026-09-15 20:00+03';

-- August and September recurring operating expenses and management targets.
insert into public.cost_entries(
  id,org_id,branch_id,farm_id,warehouse_id,entry_date,category,description,amount,allocation_method,
  supplier_name,invoice_number,reference_doc,recorded_by,entry_kind,confirmation_month,created_at,updated_at
)
select md5('laba-demo-cost-'||farm_id||'-'||m::date||'-'||c.category)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663',farm_id,
  'de500000-0000-4000-8000-000000000001',m::date,c.category::public.cost_entry_category,c.description,c.amount,'direct',c.supplier,
  'DEMO-'||to_char(m,'YYYYMM')||'-'||upper(left(c.category,3)),'DEMO-SEED','f0265096-a7b4-449b-aa0c-55047dcb7db6','monthly',date_trunc('month',m)::date,
  (m::date::timestamp+time '09:00') at time zone 'Africa/Addis_Ababa',(m::date::timestamp+time '09:00') at time zone 'Africa/Addis_Ababa'
from (values('9c8c7c72-d994-4758-8a63-0195b3c12a8b'::uuid),('29023388-3500-42f5-8d4a-75df3d44dcbe'::uuid)) farms(farm_id)
cross join generate_series(date '2026-08-01',date '2026-09-01',interval '1 month') m
cross join(values
  ('payroll','Monthly farm labor and supervision',54000::numeric,'DEMO Payroll'),
  ('utility','Electricity and water',18500,'Addis Utility'),
  ('biosecurity','Disinfection and PPE',7600,'DEMO Biosecurity Supply'),
  ('maintenance','House and equipment maintenance',9500,'DEMO Farm Engineering'),
  ('transport','Distribution and procurement transport',12500,'DEMO Logistics')
) c(category,description,amount,supplier)
on conflict (id) do nothing;

insert into public.management_targets(id,org_id,scope_type,scope_id,period_month,revenue_target_etb,operating_margin_target_pct,cash_collection_target_pct,created_by)
values
  (md5('laba-demo-target-org-2026-08-01')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','organization',null,'2026-08-01',1250000,24,94,'179947e0-339c-47b9-8fa6-b09155863940'),
  (md5('laba-demo-target-org-2026-09-01')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','organization',null,'2026-09-01',1300000,25,95,'179947e0-339c-47b9-8fa6-b09155863940'),
  (md5('laba-demo-target-uno-2026-08-01')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','farm','9c8c7c72-d994-4758-8a63-0195b3c12a8b','2026-08-01',620000,24,94,'179947e0-339c-47b9-8fa6-b09155863940'),
  (md5('laba-demo-target-duo-2026-08-01')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','farm','29023388-3500-42f5-8d4a-75df3d44dcbe','2026-08-01',580000,23,93,'179947e0-339c-47b9-8fa6-b09155863940'),
  (md5('laba-demo-target-uno-2026-09-01')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','farm','9c8c7c72-d994-4758-8a63-0195b3c12a8b','2026-09-01',650000,25,95,'179947e0-339c-47b9-8fa6-b09155863940'),
  (md5('laba-demo-target-duo-2026-09-01')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','farm','29023388-3500-42f5-8d4a-75df3d44dcbe','2026-09-01',610000,24,94,'179947e0-339c-47b9-8fa6-b09155863940')
on conflict do nothing;

-- One complete physical shelf count per month. Every stocked item is counted
-- at its ledger balance, producing explicit evidence with zero variance.
insert into public.inventory_count_sessions(id,org_id,warehouse_id,count_month,counted_on,status,idempotency_key,notes,submitted_by,created_at)
values
  (md5('laba-demo-count-session-2026-08')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de500000-0000-4000-8000-000000000001','2026-08-01','2026-08-31','reviewed','demo-count-2026-08','DEMO-SEED: complete month-end shelf count','f0265096-a7b4-449b-aa0c-55047dcb7db6','2026-08-31 17:00+03'),
  (md5('laba-demo-count-session-2026-09')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de500000-0000-4000-8000-000000000001','2026-09-01','2026-09-15','reviewed','demo-count-2026-09','DEMO-SEED: complete current shelf count','f0265096-a7b4-449b-aa0c-55047dcb7db6','2026-09-15 17:00+03')
on conflict do nothing;

with sessions as (
  select id,warehouse_id,counted_on from public.inventory_count_sessions
  where org_id='27e24583-0df0-415a-8815-d8d57fb49674' and idempotency_key in('demo-count-2026-08','demo-count-2026-09')
), balances as (
  select s.id session_id,s.warehouse_id,s.counted_on,i.id item_id,i.unit_cost,
    sum(public.stock_movement_delta(l.transaction_type,l.quantity)) ledger_quantity
  from sessions s join public.stock_ledger l on l.warehouse_id=s.warehouse_id and l.transaction_date::date<=s.counted_on
  join public.inventory_items i on i.id=l.item_id and i.org_id='27e24583-0df0-415a-8815-d8d57fb49674'
  group by s.id,s.warehouse_id,s.counted_on,i.id,i.unit_cost
)
insert into public.inventory_physical_counts(
  id,org_id,warehouse_id,item_id,count_date,ledger_quantity,counted_quantity,unit_cost,counted_by,notes,evidence,reviewed_by,reviewed_at,session_id,created_at,updated_at
)
select md5('laba-demo-count-'||session_id||'-'||item_id)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',warehouse_id,item_id,counted_on,ledger_quantity,ledger_quantity,
  unit_cost,'f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-SEED: physical count matched system balance',
  jsonb_build_array(jsonb_build_object('type','monthly_count_session','sessionId',session_id)),
  '179947e0-339c-47b9-8fa6-b09155863940',
  (counted_on::timestamp+time '17:30') at time zone 'Africa/Addis_Ababa',session_id,
  (counted_on::timestamp+time '17:00') at time zone 'Africa/Addis_Ababa',(counted_on::timestamp+time '17:30') at time zone 'Africa/Addis_Ababa'
from balances
on conflict (org_id,warehouse_id,item_id,count_date) do nothing;

-- Data-only maintenance event for traceability.
insert into public.governance_audit_events(
  org_id,actor_role,event_type,entity_table,entity_id,reason,after_values,metadata,occurred_at
)
select
  '27e24583-0df0-415a-8815-d8d57fb49674','database_maintenance',
  'demo_fixture.continuation_loaded','organizations','27e24583-0df0-415a-8815-d8d57fb49674',
  'Loaded deterministic test data through September 15, 2026.',
  jsonb_build_object('daily_records_through','2026-09-15','sales_through','2026-09-15','fixture_only',true),
  jsonb_build_object('seed','demo_continuation_20260816_20260915.sql','idempotent',true),now()
where not exists(
  select 1 from public.governance_audit_events
  where org_id='27e24583-0df0-415a-8815-d8d57fb49674'
    and event_type='demo_fixture.continuation_loaded'
    and metadata->>'seed'='demo_continuation_20260816_20260915.sql'
);

-- Verification summary.
select source,rows,first_date,last_date from (
  select 'daily_farm_records' source,count(*) rows,min(record_date)::date first_date,max(record_date)::date last_date
    from public.daily_farm_records where flock_id in(select flock_id from demo_flocks)
  union all select 'feed_day_closures',count(*),min(record_date),max(record_date)
    from public.feed_day_closures where flock_id in(select flock_id from demo_flocks)
  union all select 'daily_sales_records',count(*),min(sale_date),max(sale_date)
    from public.daily_sales_records where notes like 'DEMO-SEED:%'
  union all select 'stock_ledger',count(*),min(transaction_date)::date,max(transaction_date)::date
    from public.stock_ledger where org_id='27e24583-0df0-415a-8815-d8d57fb49674'
  union all select 'health_events',count(*),min(event_date),max(event_date)
    from public.health_events where flock_id in(select flock_id from demo_flocks)
  union all select 'vaccination_events',count(*),min(event_date),max(event_date)
    from public.vaccination_events where flock_id in(select flock_id from demo_flocks)
  union all select 'inventory_counts',count(*),min(count_date),max(count_date)
    from public.inventory_physical_counts where warehouse_id='de500000-0000-4000-8000-000000000001'
) summary order by source;
