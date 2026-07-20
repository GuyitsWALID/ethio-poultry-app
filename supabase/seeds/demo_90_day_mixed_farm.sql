-- Laba Poultry Farms: comprehensive 90-day mixed-farm demo dataset
-- Range: 2026-04-22 through 2026-07-20 (Africa/Addis_Ababa reporting dates)
-- Safe to rerun: demo-owned rows use stable UUIDs/upserts. Existing non-demo rows are preserved.
-- Prerequisite: run all migrations through 20260720_executive_control_tower.sql first.

begin;

do $$
begin
  if not exists (select 1 from public.organizations where id = '27e24583-0df0-415a-8815-d8d57fb49674') then
    raise exception 'Demo seed stopped: organization 27e24583-0df0-415a-8815-d8d57fb49674 was not found';
  end if;
  if not exists (select 1 from public.branches where id = '731b34c1-9e8d-4337-a5ee-20aa05b48663' and org_id = '27e24583-0df0-415a-8815-d8d57fb49674') then
    raise exception 'Demo seed stopped: Laba Addis Ababa branch was not found in the organization';
  end if;
  if (select count(*) from public.farms where id in ('29023388-3500-42f5-8d4a-75df3d44dcbe','9c8c7c72-d994-4758-8a63-0195b3c12a8b') and org_id = '27e24583-0df0-415a-8815-d8d57fb49674') <> 2 then
    raise exception 'Demo seed stopped: Uno and/or Duo farm identifiers are missing or belong to another organization';
  end if;
  if not exists (select 1 from public.profiles where id = 'f0265096-a7b4-449b-aa0c-55047dcb7db6' and org_id = '27e24583-0df0-415a-8815-d8d57fb49674') then
    raise exception 'Demo seed stopped: farm manager profile was not found';
  end if;
end $$;

create temp table demo_flocks (
  flock_id uuid primary key, batch_id uuid not null, house_id uuid not null, breed_id uuid not null,
  farm_id uuid not null, flock_code text not null, batch_code text not null, flock_type text not null,
  feed_type text not null, initial_count integer not null, placement_date date not null,
  feed_g_per_bird numeric not null, layer boolean not null
) on commit drop;

insert into demo_flocks values
  ('de400000-0000-4000-8000-000000000001','de300000-0000-4000-8000-000000000001','de100000-0000-4000-8000-000000000001','de200000-0000-4000-8000-000000000001','9c8c7c72-d994-4758-8a63-0195b3c12a8b','DEMO-UNO-LAYER-A','DEMO-UNO-2026-LA','layer','layer_feed',1500,'2025-11-10',115,true),
  ('de400000-0000-4000-8000-000000000002','de300000-0000-4000-8000-000000000002','de100000-0000-4000-8000-000000000002','de200000-0000-4000-8000-000000000001','29023388-3500-42f5-8d4a-75df3d44dcbe','DEMO-DUO-LAYER-B','DEMO-DUO-2026-LB','layer','layer_feed',1300,'2025-12-01',114,true),
  ('de400000-0000-4000-8000-000000000003','de300000-0000-4000-8000-000000000003','de100000-0000-4000-8000-000000000003','de200000-0000-4000-8000-000000000002','9c8c7c72-d994-4758-8a63-0195b3c12a8b','DEMO-UNO-PULLET-C','DEMO-UNO-2026-PC','rearing','grower_pullet_feed',1200,'2026-03-20',72,false),
  ('de400000-0000-4000-8000-000000000004','de300000-0000-4000-8000-000000000004','de100000-0000-4000-8000-000000000004','de200000-0000-4000-8000-000000000003','29023388-3500-42f5-8d4a-75df3d44dcbe','DEMO-DUO-BROILER-D','DEMO-DUO-2026-BD','broiler','broiler_feed',1800,'2026-04-15',96,false);

update public.farms set capacity_birds = coalesce(capacity_birds, 5000), updated_at = now()
where id in ('29023388-3500-42f5-8d4a-75df3d44dcbe','9c8c7c72-d994-4758-8a63-0195b3c12a8b');

insert into public.houses (id,org_id,branch_id,farm_id,name,house_type,capacity)
values
 ('de100000-0000-4000-8000-000000000001','27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663','9c8c7c72-d994-4758-8a63-0195b3c12a8b','DEMO Uno Layer House A','layer',1800),
 ('de100000-0000-4000-8000-000000000002','27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663','29023388-3500-42f5-8d4a-75df3d44dcbe','DEMO Duo Layer House B','layer',1600),
 ('de100000-0000-4000-8000-000000000003','27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663','9c8c7c72-d994-4758-8a63-0195b3c12a8b','DEMO Uno Pullet House C','rearing',1500),
 ('de100000-0000-4000-8000-000000000004','27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663','29023388-3500-42f5-8d4a-75df3d44dcbe','DEMO Duo Broiler House D','broiler',2200)
on conflict (id) do update set name=excluded.name, house_type=excluded.house_type, capacity=excluded.capacity, updated_at=now();

insert into public.breeds (id,org_id,name,type,breeder)
values
 ('de200000-0000-4000-8000-000000000001','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Lohmann Brown Classic','layer','Lohmann Breeders'),
 ('de200000-0000-4000-8000-000000000002','27e24583-0df0-415a-8815-d8d57fb49674','DEMO ISA Brown Pullet','rearing','Hendrix Genetics'),
 ('de200000-0000-4000-8000-000000000003','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Ross 308 AP','broiler','Aviagen')
on conflict (id) do update set name=excluded.name,type=excluded.type,breeder=excluded.breeder,updated_at=now();

insert into public.breed_standards (id,org_id,breed_id,week_number,target_feed_g,target_hdep_pct,target_mortality_pct,target_weight_g)
select md5('laba-demo-standard-'||b.id||'-'||w)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',b.id,w,
 case when b.type='layer' then 110+least(w,30)*0.18 when b.type='rearing' then 18+w*4.2 else 25+least(w,8)*14 end,
 case when b.type='layer' and w>=19 then least(96,65+(w-19)*3.2) else null end,
 case when b.type='broiler' then 0.12 else 0.08 end,
 case when b.type='layer' then least(1950,40+w*54) when b.type='rearing' then least(1550,45+w*75) else least(3300,42+w*470) end
from public.breeds b cross join generate_series(1,60) w
where b.id in ('de200000-0000-4000-8000-000000000001','de200000-0000-4000-8000-000000000002','de200000-0000-4000-8000-000000000003')
on conflict (id) do update set target_feed_g=excluded.target_feed_g,target_hdep_pct=excluded.target_hdep_pct,target_mortality_pct=excluded.target_mortality_pct,target_weight_g=excluded.target_weight_g,updated_at=now();

insert into public.batches (id,org_id,branch_id,farm_id,house_id,batch_code,source,supplier_name,purchase_date,placement_date,age_at_placement_days,male_count,female_count,total_count,purchase_cost_per_bird,transport_cost,other_cost,total_batch_cost,status,notes)
select batch_id,'27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663',farm_id,house_id,batch_code,'external_purchase','DEMO Ethiopian Poultry Genetics',placement_date-3,placement_date,0,
 case when flock_type='broiler' then initial_count/2 else 0 end,case when flock_type='broiler' then initial_count-initial_count/2 else initial_count end,initial_count,
 case when flock_type='layer' then 185 when flock_type='rearing' then 130 else 95 end,12500,7500,
 initial_count*(case when flock_type='layer' then 185 when flock_type='rearing' then 130 else 95 end)+20000,'active','DEMO-SEED: mixed-farm test batch'
from demo_flocks
on conflict (id) do update set total_count=excluded.total_count,status='active',notes=excluded.notes,updated_at=now();

insert into public.flocks (id,org_id,farm_id,house_id,batch_id,breed_id,flock_code,flock_type,source,placement_date,initial_count,current_count,age_at_placement_days,purchase_cost_per_bird,status,notes)
select flock_id,'27e24583-0df0-415a-8815-d8d57fb49674',farm_id,house_id,batch_id,breed_id,flock_code,flock_type::public.flock_type,'external_purchase',placement_date,initial_count,initial_count,0,
 case when flock_type='layer' then 185 when flock_type='rearing' then 130 else 95 end,'active','DEMO-SEED: complete 90-day operating history'
from demo_flocks
on conflict (id) do update set batch_id=excluded.batch_id,breed_id=excluded.breed_id,current_count=excluded.current_count,status='active',notes=excluded.notes,updated_at=now();

-- Daily flock records: complete bird-days, population reconciliation, eggs, feed and water.
with days as (
 select f.*,d::date record_date,(d::date-'2026-04-22'::date) day_no
 from demo_flocks f cross join generate_series('2026-04-22'::date,'2026-07-20'::date,'1 day') d
), events as (
 select *,case when day_no%17=0 then 2 when day_no%7=0 then 1 else 0 end deaths,
   case when day_no in (29,59) then 2 else 0 end culls
 from days
), pop as (
 select *,initial_count-coalesce(sum(deaths+culls) over(partition by flock_id order by record_date rows between unbounded preceding and 1 preceding),0)::int opening_birds
 from events
), metrics as (
 select *,opening_birds-deaths-culls closing_birds,
   round(opening_birds*feed_g_per_bird*(1+0.025*sin(day_no/6.0)))::int feed_grams,
   case when layer then greatest(0,round(opening_birds*least(0.955,greatest(0.82,0.91+0.035*sin(day_no/8.0)-case when day_no between 47 and 51 then 0.07 else 0 end)))::int) else null end total_eggs_calc
 from pop
), eggs as (
 select *,case when layer then round(total_eggs_calc*0.966)::int end normal_calc,
   case when layer then round(total_eggs_calc*(0.017+0.004*abs(sin(day_no))))::int end broken_calc
 from metrics
)
insert into public.daily_farm_records
 (id,org_id,flock_id,record_date,flock_age_weeks,flock_age_days,feed_intake_grams,feed_intake_quantity,feed_leftover_grams,feed_type,normal_eggs,broken_eggs,dirty_eggs,total_eggs,average_egg_weight_g,production_percentage,deaths,mortality_percentage,deaths_cause,vaccination_status,medication_vitamins,opening_birds,closing_birds,culls,transfers_in,transfers_out,other_removals,water_consumed_liters,recorded_by,synced)
select md5('laba-demo-daily-'||flock_id||'-'||record_date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',flock_id,record_date,
 ((record_date-placement_date)/7)::int,(record_date-placement_date)::int,feed_grams,round(feed_grams/1000.0,2),round(feed_grams*0.012)::int,feed_type::public.feed_type,
 normal_calc,broken_calc,case when layer then total_eggs_calc-normal_calc-broken_calc end,total_eggs_calc,
 case when layer then round((59.2+1.2*sin(day_no/10.0))::numeric,2) end,
 case when layer then round((total_eggs_calc*100.0/opening_birds)::numeric,2) end,
 deaths,round((deaths*100.0/opening_birds)::numeric,4),case when deaths>0 then case when day_no%17=0 then 'Heat stress / natural loss' else 'Natural loss' end end,
 case when day_no in (10,40,70) then 'Administered per schedule' else 'No vaccination due' end,
 case when day_no%30=5 then 'Multivitamin electrolyte support' end,opening_birds,closing_birds,culls,0,0,0,
 round(((feed_grams/1000.0)*(case when flock_type='broiler' then 1.78 else 1.92 end)*(1+0.03*sin(day_no/5.0)))::numeric,2),
 'f0265096-a7b4-449b-aa0c-55047dcb7db6',true
from eggs
on conflict (org_id,flock_id,record_date) do update set
 opening_birds=excluded.opening_birds,closing_birds=excluded.closing_birds,culls=excluded.culls,deaths=excluded.deaths,
 feed_intake_grams=excluded.feed_intake_grams,feed_intake_quantity=excluded.feed_intake_quantity,feed_leftover_grams=excluded.feed_leftover_grams,
 normal_eggs=excluded.normal_eggs,broken_eggs=excluded.broken_eggs,dirty_eggs=excluded.dirty_eggs,total_eggs=excluded.total_eggs,
 average_egg_weight_g=excluded.average_egg_weight_g,production_percentage=excluded.production_percentage,mortality_percentage=excluded.mortality_percentage,
 water_consumed_liters=excluded.water_consumed_liters,updated_at=now();

update public.flocks f set current_count=x.closing_birds,updated_at=now()
from (select distinct on (flock_id) flock_id,closing_birds from public.daily_farm_records where flock_id in (select flock_id from demo_flocks) order by flock_id,record_date desc) x
where f.id=x.flock_id;

-- Daily plans and two actual feeding sessions per flock/day.
insert into public.feeding_schedules (id,org_id,batch_id,schedule_date,feed_type,planned_feed_kg,target_grams_per_bird,notes,created_by)
select md5('laba-demo-feed-plan-'||f.batch_id||'-'||d::date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',f.batch_id,d::date,f.feed_type,
 round(f.initial_count*f.feed_g_per_bird/1000.0,2),f.feed_g_per_bird,'DEMO-SEED: daily ration plan','f0265096-a7b4-449b-aa0c-55047dcb7db6'
from demo_flocks f cross join generate_series('2026-04-22'::date,'2026-07-20'::date,'1 day') d
on conflict (org_id,batch_id,schedule_date) do update set planned_feed_kg=excluded.planned_feed_kg,target_grams_per_bird=excluded.target_grams_per_bird,updated_at=now();

insert into public.feeding_session_records (id,org_id,batch_id,flock_id,record_date,session_name,session_time,feeders_count,planned_feed_kg,actual_feed_kg,notes,recorded_by)
select md5('laba-demo-feed-session-'||f.flock_id||'-'||d::date||'-'||s.name)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',f.batch_id,f.flock_id,d::date,s.name,s.at_time,2,
 round(f.initial_count*f.feed_g_per_bird/2000.0,2),round((f.initial_count*f.feed_g_per_bird/2000.0*(1+0.02*sin((d::date-'2026-04-22'::date)+s.n)))::numeric,2),
 'DEMO-SEED: feeder check complete','f0265096-a7b4-449b-aa0c-55047dcb7db6'
from demo_flocks f cross join generate_series('2026-04-22'::date,'2026-07-20'::date,'1 day') d
cross join (values ('Morning'::text,'07:00'::time,1),('Afternoon','15:30'::time,2)) s(name,at_time,n)
on conflict (org_id,flock_id,record_date,session_name) do update set actual_feed_kg=excluded.actual_feed_kg,notes=excluded.notes,updated_at=now();

-- Fortnightly growth and uniformity samples.
insert into public.weight_records (id,org_id,flock_id,record_date,sample_count,average_weight_g,min_weight_g,max_weight_g,uniformity_pct)
select md5('laba-demo-weight-'||f.flock_id||'-'||d::date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',f.flock_id,d::date,60,
 round((case when f.flock_type='layer' then 1845+30*sin(n) when f.flock_type='rearing' then 720+n*13.5 else least(3260,900+n*31) end)::numeric,1),
 round((case when f.flock_type='layer' then 1600+20*sin(n) when f.flock_type='rearing' then 620+n*12 else least(2900,760+n*28) end)::numeric,1),
 round((case when f.flock_type='layer' then 2050+25*sin(n) when f.flock_type='rearing' then 820+n*15 else least(3600,1020+n*34) end)::numeric,1),
 round((87+3*sin(n/2.0))::numeric,1)
from demo_flocks f cross join generate_series('2026-04-22'::date,'2026-07-15'::date,'14 days') with ordinality g(d,n)
on conflict (id) do update set average_weight_g=excluded.average_weight_g,min_weight_g=excluded.min_weight_g,max_weight_g=excluded.max_weight_g,uniformity_pct=excluded.uniformity_pct,updated_at=now();

-- Branch-level warehouse (no farm_id exists on warehouses); ledger movements carry farm/flock scope.
insert into public.warehouses (id,org_id,branch_id,name,type)
values ('de500000-0000-4000-8000-000000000001','27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663','DEMO Addis Central Farm Store','central_warehouse')
on conflict (id) do update set name=excluded.name,type=excluded.type,updated_at=now();

insert into public.inventory_items (id,org_id,name,category,unit,unit_cost,reorder_level)
values
 ('de600000-0000-4000-8000-000000000001','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Premium Layer Mash','feed','kg',41.50,1200),
 ('de600000-0000-4000-8000-000000000002','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Pullet Grower Mash','feed','kg',39.00,700),
 ('de600000-0000-4000-8000-000000000003','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Broiler Finisher','feed','kg',43.00,900),
 ('de600000-0000-4000-8000-000000000004','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Newcastle Vaccine','vaccine','dose',5.50,500),
 ('de600000-0000-4000-8000-000000000005','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Broad Spectrum Poultry Medicine','medicine','bottle',680,12),
 ('de600000-0000-4000-8000-000000000006','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Multivitamin Electrolyte','vitamin','kg',950,15),
 ('de600000-0000-4000-8000-000000000007','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Biosecurity Disinfectant','supplement','liter',310,25),
 ('de600000-0000-4000-8000-000000000008','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Egg Trays','packaging','piece',8.50,1500),
 ('de600000-0000-4000-8000-000000000009','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Drinker Valve Spare','spare_parts','piece',220,20)
on conflict (id) do update set unit_cost=excluded.unit_cost,reorder_level=excluded.reorder_level,updated_at=now();

insert into public.stock_ledger (id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,batch_number,expiry_date,invoice_number,notes,procurement_type,recorded_by,reference_doc,supplier_name)
select md5('laba-demo-stock-receipt-'||i.id)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',i.id,'de500000-0000-4000-8000-000000000001',
 case i.category when 'feed' then 18000 when 'packaging' then 12000 when 'vaccine' then 9000 when 'medicine' then 60 when 'vitamin' then 80 when 'supplement' then 120 else 70 end,
 'receipt',i.unit_cost,'2026-04-18','731b34c1-9e8d-4337-a5ee-20aa05b48663',null,null,null,null,'DEMO-LOT-0426','2027-03-31','DEMO-INV-0426','DEMO-SEED: opening inventory','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-001','DEMO Addis Poultry Supply'
from public.inventory_items i where i.id between 'de600000-0000-4000-8000-000000000004' and 'de600000-0000-4000-8000-000000000009'
on conflict (id) do update set quantity=excluded.quantity,unit_cost=excluded.unit_cost,notes=excluded.notes,updated_at=now();

insert into public.stock_ledger (id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,batch_number,expiry_date,invoice_number,notes,procurement_type,recorded_by,reference_doc,supplier_name)
values
 (md5('laba-demo-feed-receipt-uno-layer')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000001','de500000-0000-4000-8000-000000000001',18000,'receipt',41.50,'2026-04-18','731b34c1-9e8d-4337-a5ee-20aa05b48663','9c8c7c72-d994-4758-8a63-0195b3c12a8b','DEMO-LAYER-UNO','2026-12-31','DEMO-FEED-001','DEMO-SEED: Uno layer feed opening stock','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-F01','DEMO Addis Poultry Supply'),
 (md5('laba-demo-feed-receipt-duo-layer')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000001','de500000-0000-4000-8000-000000000001',18000,'receipt',41.50,'2026-04-18','731b34c1-9e8d-4337-a5ee-20aa05b48663','29023388-3500-42f5-8d4a-75df3d44dcbe','DEMO-LAYER-DUO','2026-12-31','DEMO-FEED-002','DEMO-SEED: Duo layer feed opening stock','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-F02','DEMO Addis Poultry Supply'),
 (md5('laba-demo-feed-receipt-uno-pullet')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000002','de500000-0000-4000-8000-000000000001',9000,'receipt',39.00,'2026-04-18','731b34c1-9e8d-4337-a5ee-20aa05b48663','9c8c7c72-d994-4758-8a63-0195b3c12a8b','DEMO-PULLET-UNO','2026-12-31','DEMO-FEED-003','DEMO-SEED: Uno pullet feed opening stock','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-F03','DEMO Addis Poultry Supply'),
 (md5('laba-demo-feed-receipt-duo-broiler')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000003','de500000-0000-4000-8000-000000000001',18000,'receipt',43.00,'2026-04-18','731b34c1-9e8d-4337-a5ee-20aa05b48663','29023388-3500-42f5-8d4a-75df3d44dcbe','DEMO-BROILER-DUO','2026-12-31','DEMO-FEED-004','DEMO-SEED: Duo broiler feed opening stock','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-GRN-F04','DEMO Addis Poultry Supply')
on conflict (id) do update set quantity=excluded.quantity,unit_cost=excluded.unit_cost,notes=excluded.notes,updated_at=now();

insert into public.stock_ledger (id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,batch_number,notes,procurement_type,recorded_by,reference_doc,supplier_name)
select md5('laba-demo-feed-issue-'||f.flock_id||'-'||d::date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',
 case f.feed_type when 'layer_feed' then 'de600000-0000-4000-8000-000000000001'::uuid when 'grower_pullet_feed' then 'de600000-0000-4000-8000-000000000002'::uuid else 'de600000-0000-4000-8000-000000000003'::uuid end,
 'de500000-0000-4000-8000-000000000001',round(f.initial_count*f.feed_g_per_bird*7/1000.0,2),'issue',
 case f.feed_type when 'layer_feed' then 41.5 when 'grower_pullet_feed' then 39 else 43 end,d::date,'731b34c1-9e8d-4337-a5ee-20aa05b48663',f.farm_id,f.house_id,f.flock_id,f.batch_id,
 'DEMO-FEED-LOT','DEMO-SEED: seven-day feed issue','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-FEED-'||to_char(d,'YYYYMMDD'),'DEMO Addis Poultry Supply'
from demo_flocks f cross join generate_series('2026-04-22'::date,'2026-07-14'::date,'7 days') d
on conflict (id) do update set quantity=excluded.quantity,unit_cost=excluded.unit_cost,updated_at=now();

insert into public.stock_ledger (id,org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,batch_number,notes,procurement_type,recorded_by,reference_doc)
values
 (md5('laba-demo-vaccine-issue')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000004','de500000-0000-4000-8000-000000000001',8700,'issue',5.50,'2026-07-01','731b34c1-9e8d-4337-a5ee-20aa05b48663','DEMO-VAC-ISSUE','DEMO-SEED: vaccination program consumption','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-VAC-USE'),
 (md5('laba-demo-medicine-issue')::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','de600000-0000-4000-8000-000000000005','de500000-0000-4000-8000-000000000001',52,'issue',680,'2026-07-05','731b34c1-9e8d-4337-a5ee-20aa05b48663','DEMO-MED-ISSUE','DEMO-SEED: treatment and preventive health consumption','monthly','f0265096-a7b4-449b-aa0c-55047dcb7db6','DEMO-MED-USE')
on conflict (id) do update set quantity=excluded.quantity,unit_cost=excluded.unit_cost,updated_at=now();

-- Health observations, vaccination schedule and detailed mortality log.
insert into public.health_events (id,org_id,flock_id,event_date,event_type,description,diagnosis,treatment,vet_id)
select md5('laba-demo-health-'||f.flock_id||'-'||d::date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',f.flock_id,d::date,
 case when n=4 then 'treatment'::public.health_event_type else 'observation'::public.health_event_type end,
 case when n=4 then 'Mild respiratory signs detected during routine inspection' else 'Routine flock health and welfare inspection' end,
 case when n=4 then 'Suspected mild environmental respiratory irritation' else 'Clinically normal' end,
 case when n=4 then 'Ventilation adjustment and vitamin support; monitor 72 hours' else 'No treatment required' end,'f0265096-a7b4-449b-aa0c-55047dcb7db6'
from demo_flocks f cross join generate_series('2026-04-24'::date,'2026-07-18'::date,'15 days') with ordinality g(d,n)
on conflict (id) do update set description=excluded.description,diagnosis=excluded.diagnosis,treatment=excluded.treatment,updated_at=now();

insert into public.vaccination_events (id,org_id,flock_id,event_date,vaccine_name,batch_number,birds_vaccinated,dosage,route,expiry_date,vet_id)
select md5('laba-demo-vaccine-'||f.flock_id||'-'||d::date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',f.flock_id,d::date,
 case when n%2=0 then 'Newcastle Disease Booster' else 'Infectious Bronchitis Booster' end,'DEMO-VAC-'||to_char(d,'MMDD'),
 greatest(0,f.initial_count-(n*4)),'1 dose/bird','water','2027-02-28','f0265096-a7b4-449b-aa0c-55047dcb7db6'
from demo_flocks f cross join generate_series('2026-04-30'::date,'2026-07-29'::date,'30 days') with ordinality g(d,n)
on conflict (id) do update set birds_vaccinated=excluded.birds_vaccinated,updated_at=now();

insert into public.mortality_events (id,org_id,flock_id,record_date,count,cause,diagnosis,notes,observed_by,recorded_time)
select md5('laba-demo-mortality-'||r.flock_id||'-'||r.record_date)::uuid,r.org_id,r.flock_id,r.record_date,r.deaths,
 coalesce(r.deaths_cause,'Natural loss'),'Routine post-mortem review','DEMO-SEED: reconciled to daily flock record','f0265096-a7b4-449b-aa0c-55047dcb7db6','08:10'
from public.daily_farm_records r where r.flock_id in (select flock_id from demo_flocks) and r.deaths>0
on conflict (id) do update set count=excluded.count,cause=excluded.cause,updated_at=now();

-- Sensor fleet and 4 readings per sensor/day. Only demo-sensor readings are refreshed.
insert into public.sensors (id,org_id,house_id,sensor_type,status,external_id,last_seen)
select md5('laba-demo-sensor-'||f.house_id||'-'||s.t)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',f.house_id,s.t::public.sensor_type,'online','DEMO-'||upper(left(s.t,4))||'-'||right(f.flock_code,1),'2026-07-20 20:00+03'
from demo_flocks f cross join (values ('temperature'),('humidity'),('ammonia'),('water_flow')) s(t)
on conflict (id) do update set status='online',last_seen=excluded.last_seen,updated_at=now();

delete from public.sensor_readings where sensor_id in (select id from public.sensors where external_id like 'DEMO-%') and captured_at>='2026-04-22 00:00+03' and captured_at<'2026-07-21 00:00+03';

insert into public.sensor_readings (sensor_id,reading_value,captured_at)
select s.id,
 round((case s.sensor_type::text when 'temperature' then 24.5+3.1*sin(day_no/5.0)+case when day_no in (48,49) then 6 else 0 end
 when 'humidity' then 61+8*sin(day_no/7.0) when 'ammonia' then 10+4*abs(sin(day_no/8.0))+case when day_no=49 then 14 else 0 end
 else 1.8+0.3*sin(day_no/4.0) end)::numeric,2),
 (d::date+t.at_time) at time zone 'Africa/Addis_Ababa'
from public.sensors s cross join generate_series('2026-04-22'::date,'2026-07-20'::date,'1 day') d
cross join (values ('06:00'::time),('12:00'::time),('18:00'::time),('23:00'::time)) t(at_time)
cross join lateral (select d::date-'2026-04-22'::date day_no) x
where s.external_id like 'DEMO-%';

-- Sales: daily eggs, periodic birds, and company-wide service categories.
insert into public.daily_sales_records (id,org_id,branch_id,farm_id,house_id,flock_id,batch_id,sale_date,product_category,product_label,quantity,unit,unit_price,gross_amount,paid_amount,balance_due,payment_method,customer_name,customer_phone,notes,recorded_by)
select md5('laba-demo-egg-sale-'||r.flock_id||'-'||r.record_date)::uuid,r.org_id,'731b34c1-9e8d-4337-a5ee-20aa05b48663',f.farm_id,f.house_id,r.flock_id,f.batch_id,r.record_date,'egg','Grade A table eggs',
 greatest(1,floor(r.normal_eggs*0.90/30.0)), 'tray',round((285+12*sin((r.record_date-'2026-04-22'::date)/8.0))::numeric,2),
 round(greatest(1,floor(r.normal_eggs*0.90/30.0))*(285+12*sin((r.record_date-'2026-04-22'::date)/8.0))::numeric,2),
 round((greatest(1,floor(r.normal_eggs*0.90/30.0))*(285+12*sin((r.record_date-'2026-04-22'::date)/8.0))*(case when extract(day from r.record_date)::int%5=0 then .80 else .96 end))::numeric,2),
 round((greatest(1,floor(r.normal_eggs*0.90/30.0))*(285+12*sin((r.record_date-'2026-04-22'::date)/8.0))*(case when extract(day from r.record_date)::int%5=0 then .20 else .04 end))::numeric,2),
 case when extract(day from r.record_date)::int%3=0 then 'Bank transfer' else 'Cash' end,
 case when f.farm_id='9c8c7c72-d994-4758-8a63-0195b3c12a8b' then 'Addis Fresh Market' else 'Merkato Food Distributors' end,'+251911000101','DEMO-SEED: daily dispatch','f0265096-a7b4-449b-aa0c-55047dcb7db6'
from public.daily_farm_records r join demo_flocks f on f.flock_id=r.flock_id where f.layer and r.normal_eggs>0
on conflict (id) do update set quantity=excluded.quantity,unit_price=excluded.unit_price,gross_amount=excluded.gross_amount,paid_amount=excluded.paid_amount,balance_due=excluded.balance_due,updated_at=now();

insert into public.daily_sales_records (id,org_id,branch_id,farm_id,house_id,flock_id,batch_id,sale_date,product_category,product_label,quantity,unit,unit_price,gross_amount,paid_amount,balance_due,payment_method,customer_name,customer_phone,notes,recorded_by)
select md5('laba-demo-bird-sale-'||f.flock_id||'-'||d::date)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663',f.farm_id,f.house_id,f.flock_id,f.batch_id,d::date,'bird',
 case when f.flock_type='broiler' then 'Finished broiler birds' else 'Point-of-lay pullets' end,case when f.flock_type='broiler' then 120 else 45 end,'bird',case when f.flock_type='broiler' then 720 else 980 end,
 case when f.flock_type='broiler' then 86400 else 44100 end,case when n=1 then (case when f.flock_type='broiler' then 69120 else 35280 end) else (case when f.flock_type='broiler' then 86400 else 44100 end) end,
 case when n=1 then (case when f.flock_type='broiler' then 17280 else 8820 end) else 0 end,'Bank transfer','DEMO Institutional Buyer','+251911000202','DEMO-SEED: scheduled bird sale','f0265096-a7b4-449b-aa0c-55047dcb7db6'
from demo_flocks f cross join generate_series('2026-05-15'::date,'2026-07-14'::date,'30 days') with ordinality g(d,n)
where not f.layer
on conflict (id) do update set paid_amount=excluded.paid_amount,balance_due=excluded.balance_due,updated_at=now();

insert into public.daily_sales_records (id,org_id,branch_id,sale_date,product_category,product_label,quantity,unit,unit_price,gross_amount,paid_amount,balance_due,payment_method,customer_name,customer_phone,notes,recorded_by)
select md5('laba-demo-company-sale-'||d::date||'-'||p.category)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663',d::date,p.category,p.label,p.qty,p.unit,p.price,p.qty*p.price,
 round(p.qty*p.price*(case when n%3=0 then .75 else 1 end),2),round(p.qty*p.price*(case when n%3=0 then .25 else 0 end),2),'Bank transfer','DEMO Agribusiness Client','+251911000303','DEMO-SEED: company-wide commercial revenue','179947e0-339c-47b9-8fa6-b09155863940'
from generate_series('2026-04-25'::date,'2026-07-14'::date,'10 days') with ordinality g(d,n)
cross join lateral (values
 (case when n%4=1 then 'training' when n%4=2 then 'equipment_medicine' when n%4=3 then 'consultancy' else 'package' end,
  case when n%4=1 then 'Commercial poultry management course' when n%4=2 then 'Starter equipment and medicine kit' when n%4=3 then 'Farm advisory visit' else 'Turnkey layer starter package' end,
  case when n%4=1 then 8 when n%4=2 then 3 else 1 end,
  case when n%4=1 then 'participant' when n%4=2 then 'kit' else 'service' end,
  case when n%4=1 then 3500 when n%4=2 then 18500 when n%4=3 then 22000 else 65000 end)) p(category,label,qty,unit,price)
on conflict (id) do update set gross_amount=excluded.gross_amount,paid_amount=excluded.paid_amount,balance_due=excluded.balance_due,updated_at=now();

-- Recurring operating expenses. Feed cost is supplied by scoped inventory issues, avoiding double counting.
insert into public.cost_entries (id,org_id,branch_id,farm_id,entry_date,category,description,amount,allocation_method,supplier_name,invoice_number,reference_doc,recorded_by)
select md5('laba-demo-cost-'||f.farm_id||'-'||m::date||'-'||c.category)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','731b34c1-9e8d-4337-a5ee-20aa05b48663',f.farm_id,m::date,c.category::public.cost_entry_category,
 c.description,c.amount,'direct',c.supplier,'DEMO-'||to_char(m,'YYYYMM')||'-'||upper(left(c.category,3)),'DEMO-SEED','f0265096-a7b4-449b-aa0c-55047dcb7db6'
from (values ('9c8c7c72-d994-4758-8a63-0195b3c12a8b'::uuid),('29023388-3500-42f5-8d4a-75df3d44dcbe'::uuid)) f(farm_id)
cross join generate_series('2026-05-01'::date,'2026-07-01'::date,'1 month') m
cross join (values ('payroll','Monthly farm labor and supervision',54000::numeric,'DEMO Payroll'),('utility','Electricity and water',18500,'Addis Utility'),('biosecurity','Disinfection and PPE',7600,'DEMO Biosecurity Supply'),('maintenance','House and equipment maintenance',9500,'DEMO Farm Engineering'),('transport','Distribution and procurement transport',12500,'DEMO Logistics')) c(category,description,amount,supplier)
on conflict (id) do update set amount=excluded.amount,description=excluded.description,updated_at=now();

-- Management targets: organization fallback plus farm-specific current-month targets.
insert into public.management_targets (id,org_id,scope_type,scope_id,period_month,revenue_target_etb,operating_margin_target_pct,cash_collection_target_pct,created_by)
values
 ('dec00000-0000-4000-8000-000000000001','27e24583-0df0-415a-8815-d8d57fb49674','organization',null,'2026-05-01',1050000,22,92,'179947e0-339c-47b9-8fa6-b09155863940'),
 ('dec00000-0000-4000-8000-000000000002','27e24583-0df0-415a-8815-d8d57fb49674','organization',null,'2026-06-01',1120000,23,93,'179947e0-339c-47b9-8fa6-b09155863940'),
 ('dec00000-0000-4000-8000-000000000003','27e24583-0df0-415a-8815-d8d57fb49674','organization',null,'2026-07-01',1200000,24,94,'179947e0-339c-47b9-8fa6-b09155863940'),
 ('dec00000-0000-4000-8000-000000000004','27e24583-0df0-415a-8815-d8d57fb49674','farm','9c8c7c72-d994-4758-8a63-0195b3c12a8b','2026-07-01',590000,23,94,'179947e0-339c-47b9-8fa6-b09155863940'),
 ('dec00000-0000-4000-8000-000000000005','27e24583-0df0-415a-8815-d8d57fb49674','farm','29023388-3500-42f5-8d4a-75df3d44dcbe','2026-07-01',530000,22,92,'179947e0-339c-47b9-8fa6-b09155863940')
on conflict do nothing;

-- CRM pipeline, activities, orders and training delivery.
insert into public.leads (id,org_id,full_name,email,phone,location,lead_source,source_detail,pipeline_stage,farm_size_interest,assigned_to,last_activity)
select md5('laba-demo-lead-'||n)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','DEMO Prospect '||n,'prospect'||n||'@example.test','+25191110'||lpad(n::text,4,'0'),
 (array['Addis Ababa','Adama','Bishoftu','Debre Zeit'])[1+(n%4)],(array['referral','facebook','training','walk_in'])[1+(n%4)]::public.lead_source,'DEMO campaign',
 (array['new','contacted','proposal_sent','proforma_issued','deposit_received','prep','delivery_scheduled','delivered','follow_up','closed','training_registered','training_completed'])[n]::public.lead_stage,
 500+n*250,'179947e0-339c-47b9-8fa6-b09155863940','2026-07-20'::date-(n*3)
from generate_series(1,12) n
on conflict (id) do update set pipeline_stage=excluded.pipeline_stage,last_activity=excluded.last_activity,updated_at=now();

insert into public.lead_activities (id,lead_id,activity_type,description,outcome,next_action,next_action_date,recorded_by)
select md5('laba-demo-lead-activity-'||n)::uuid,md5('laba-demo-lead-'||n)::uuid,(array['call','visit','message','email'])[1+(n%4)]::public.lead_activity_type,
 'DEMO-SEED: qualification and needs assessment','Customer interest confirmed',case when n<=7 then 'Send updated proposal and confirm volume' else 'Post-delivery follow-up' end,
 case when n<=7 then '2026-07-20'::date+n else null end,'179947e0-339c-47b9-8fa6-b09155863940'
from generate_series(1,12) n
on conflict (id) do update set outcome=excluded.outcome,next_action=excluded.next_action,next_action_date=excluded.next_action_date,updated_at=now();

insert into public.sales_orders (id,org_id,order_number,lead_id,customer_name,customer_phone,customer_address,order_date,delivery_date,status,subtotal,vat_amount,total,deposit_amount,balance_due,assigned_to,notes)
select md5('laba-demo-order-'||n)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674','DEMO-SO-2026-'||lpad(n::text,3,'0'),md5('laba-demo-lead-'||n)::uuid,'DEMO Prospect '||n,'+25191110'||lpad(n::text,4,'0'),'Addis Ababa',
 '2026-07-20'::date-(n*5),'2026-07-20'::date+(10-n),(array['draft','proforma_sent','deposit_paid','in_preparation','ready','delivered','completed','completed'])[n]::public.sales_order_status,
 45000+n*9000,round((45000+n*9000)*.15,2),round((45000+n*9000)*1.15,2),case when n between 3 and 5 then round((45000+n*9000)*.50,2) when n>=6 then round((45000+n*9000)*1.15,2) else 0 end,
 case when n between 3 and 5 then round((45000+n*9000)*.65,2) when n>=6 then 0 else round((45000+n*9000)*1.15,2) end,'179947e0-339c-47b9-8fa6-b09155863940','DEMO-SEED: pipeline order'
from generate_series(1,8) n
on conflict (id) do update set status=excluded.status,total=excluded.total,deposit_amount=excluded.deposit_amount,balance_due=excluded.balance_due,updated_at=now();

insert into public.training_programs (id,org_id,name,description,start_date,end_date,facilitator_id,fee_etb,max_capacity,status)
values
 ('de800000-0000-4000-8000-000000000001','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Commercial Layer Management','Three-day practical layer production and records course','2026-06-10','2026-06-12','f0265096-a7b4-449b-aa0c-55047dcb7db6',3500,25,'completed'),
 ('de800000-0000-4000-8000-000000000002','27e24583-0df0-415a-8815-d8d57fb49674','DEMO Poultry Farm Biosecurity','Upcoming practical biosecurity course','2026-07-25','2026-07-26','f0265096-a7b4-449b-aa0c-55047dcb7db6',2800,30,'open')
on conflict (id) do update set status=excluded.status,fee_etb=excluded.fee_etb,updated_at=now();

insert into public.training_enrollments (id,program_id,attendance,assessment_score,passed,payment_status)
select md5('laba-demo-enrollment-'||n)::uuid,case when n<=8 then 'de800000-0000-4000-8000-000000000001'::uuid else 'de800000-0000-4000-8000-000000000002'::uuid end,
 case when n<=8 then '{"day1":true,"day2":true,"day3":true}'::jsonb else '{}'::jsonb end,case when n<=8 then 72+n*2 else null end,case when n<=8 then true else null end,
 case when n<=8 then 'paid'::public.payment_status when n<=11 then 'partial'::public.payment_status else 'pending'::public.payment_status end
from generate_series(1,14) n
on conflict (id) do update set attendance=excluded.attendance,assessment_score=excluded.assessment_score,passed=excluded.passed,payment_status=excluded.payment_status,updated_at=now();

insert into public.visitor_logs (id,org_id,farm_id,visitor_name,visit_date,purpose)
select md5('laba-demo-visitor-'||n)::uuid,'27e24583-0df0-415a-8815-d8d57fb49674',case when n%2=0 then '29023388-3500-42f5-8d4a-75df3d44dcbe'::uuid else '9c8c7c72-d994-4758-8a63-0195b3c12a8b'::uuid end,
 'DEMO Visitor '||n,'2026-04-22'::date+n*7,case when n%3=0 then 'Veterinary and welfare inspection' when n%3=1 then 'Customer farm tour' else 'Supplier technical support' end
from generate_series(1,12) n
on conflict (id) do update set purpose=excluded.purpose,updated_at=now();

insert into public.alerts (id,org_id,message,category,priority,status,triggered_at,triggered_value,assigned_to,resolved_at)
values
 ('deb00000-0000-4000-8000-000000000001','27e24583-0df0-415a-8815-d8d57fb49674','DEMO: Ammonia spike detected in Duo Broiler House D','environmental','high','open','2026-07-20 12:10+03',28,'f0265096-a7b4-449b-aa0c-55047dcb7db6',null),
 ('deb00000-0000-4000-8000-000000000002','27e24583-0df0-415a-8815-d8d57fb49674','DEMO: Newcastle booster due within 9 days','health','medium','open','2026-07-20 08:00+03',9,'f0265096-a7b4-449b-aa0c-55047dcb7db6',null),
 ('deb00000-0000-4000-8000-000000000003','27e24583-0df0-415a-8815-d8d57fb49674','DEMO: Receivable follow-up required for institutional buyer','financial','medium','acknowledged','2026-07-19 09:00+03',26100,'179947e0-339c-47b9-8fa6-b09155863940',null),
 ('deb00000-0000-4000-8000-000000000004','27e24583-0df0-415a-8815-d8d57fb49674','DEMO: Layer feed reorder review','inventory','low','resolved','2026-07-01 08:00+03',980,'f0265096-a7b4-449b-aa0c-55047dcb7db6','2026-07-02 11:30+03')
on conflict (id) do update set message=excluded.message,priority=excluded.priority,status=excluded.status,triggered_value=excluded.triggered_value,assigned_to=excluded.assigned_to,resolved_at=excluded.resolved_at,updated_at=now();

commit;

-- Verification summary (run after the transaction if your SQL editor only displays the final result set).
select 'daily_farm_records' source,count(*) rows,min(record_date)::text first_date,max(record_date)::text last_date from public.daily_farm_records where flock_id::text like 'de400000-%'
union all select 'daily_sales_records',count(*),min(sale_date)::text,max(sale_date)::text from public.daily_sales_records where notes like 'DEMO-SEED:%'
union all select 'stock_ledger',count(*),min(transaction_date)::text,max(transaction_date)::text from public.stock_ledger where notes like 'DEMO-SEED:%'
union all select 'health_events',count(*),min(event_date)::text,max(event_date)::text from public.health_events where flock_id::text like 'de400000-%'
union all select 'sensor_readings',count(*),min(captured_at)::date::text,max(captured_at)::date::text from public.sensor_readings where sensor_id in (select id from public.sensors where external_id like 'DEMO-%')
union all select 'leads',count(*),min(created_at)::date::text,max(created_at)::date::text from public.leads where full_name like 'DEMO Prospect %'
order by source;
