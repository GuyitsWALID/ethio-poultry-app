do $$
begin
  create type public.feed_type as enum (
    'starter_feed',
    'grower_pullet_feed',
    'layer_feed',
    'broiler_feed',
    'medicated_feed'
  );
exception
  when duplicate_object then null;
end $$;

alter table if exists public.daily_farm_records
  add column if not exists flock_age_weeks integer,
  add column if not exists flock_age_days integer,
  add column if not exists feed_intake_grams numeric(12,2),
  add column if not exists feed_intake_quantity numeric(12,2),
  add column if not exists feed_leftover_grams numeric(12,2),
  add column if not exists feed_type public.feed_type,
  add column if not exists normal_eggs integer,
  add column if not exists broken_eggs integer,
  add column if not exists total_eggs integer,
  add column if not exists production_percentage numeric(6,2),
  add column if not exists deaths integer,
  add column if not exists mortality_percentage numeric(6,2),
  add column if not exists deaths_cause text,
  add column if not exists vaccination_status text,
  add column if not exists medication_vitamins text;

alter table if exists public.daily_farm_records
  alter column feed_type type public.feed_type
  using (
    case lower(replace(coalesce(feed_type::text, ''), ' ', '_'))
      when 'starter_feed' then 'starter_feed'::public.feed_type
      when 'grower_feed' then 'grower_pullet_feed'::public.feed_type
      when 'grower_pullet_feed' then 'grower_pullet_feed'::public.feed_type
      when 'pullet_feed' then 'grower_pullet_feed'::public.feed_type
      when 'layer_feed' then 'layer_feed'::public.feed_type
      when 'broiler_feed' then 'broiler_feed'::public.feed_type
      when 'medicated_feed' then 'medicated_feed'::public.feed_type
      else null
    end
  );

alter table if exists public.daily_farm_records
  drop constraint if exists daily_farm_records_feed_given_non_negative,
  drop constraint if exists daily_farm_records_feed_leftover_non_negative,
  drop constraint if exists daily_farm_records_egg_counts_non_negative,
  drop constraint if exists daily_farm_records_feed_intake_non_negative,
  drop constraint if exists daily_farm_records_feed_leftover_non_negative_v2,
  drop constraint if exists daily_farm_records_deaths_non_negative;

alter table if exists public.daily_farm_records
  add constraint daily_farm_records_feed_intake_non_negative check (
    (feed_intake_grams is null or feed_intake_grams >= 0) and
    (feed_intake_quantity is null or feed_intake_quantity >= 0)
  ),
  add constraint daily_farm_records_feed_leftover_non_negative_v2 check (
    feed_leftover_grams is null or feed_leftover_grams >= 0
  ),
  add constraint daily_farm_records_egg_counts_non_negative check (
    (normal_eggs is null or normal_eggs >= 0) and
    (broken_eggs is null or broken_eggs >= 0) and
    (total_eggs is null or total_eggs >= 0)
  ),
  add constraint daily_farm_records_deaths_non_negative check (deaths is null or deaths >= 0);

create or replace function public.apply_daily_farm_record_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live_birds integer;
begin
  select current_count
  into live_birds
  from public.flocks
  where id = new.flock_id
  for update;

  if live_birds is not null and live_birds > 0 then
    if new.total_eggs is not null then
      new.production_percentage = round(((new.total_eggs::numeric / live_birds::numeric) * 100), 2);
    end if;

    if new.deaths is not null then
      new.mortality_percentage = round(((new.deaths::numeric / live_birds::numeric) * 100), 2);
    end if;
  end if;

  if coalesce(new.deaths, 0) > 0 then
    update public.flocks
    set current_count = greatest(current_count - new.deaths, 0),
        updated_at = now()
    where id = new.flock_id;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_daily_farm_record_counts on public.daily_farm_records;
create trigger apply_daily_farm_record_counts
before insert on public.daily_farm_records
for each row
execute function public.apply_daily_farm_record_counts();

alter table if exists public.daily_farm_records
  drop column if exists live_count,
  drop column if exists culls,
  drop column if exists feed_consumed_kg,
  drop column if exists feed_given_kg,
  drop column if exists feed_leftover_kg,
  drop column if exists feed_leftover_quantity,
  drop column if exists water_liters,
  drop column if exists temperature_c,
  drop column if exists humidity_pct;
