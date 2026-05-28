alter table if exists public.daily_farm_records
  add column if not exists flock_age_weeks integer,
  add column if not exists flock_age_days integer,
  add column if not exists feed_given_kg numeric(10,2),
  add column if not exists feed_leftover_kg numeric(10,2),
  add column if not exists normal_eggs integer,
  add column if not exists broken_eggs integer,
  add column if not exists total_eggs integer,
  add column if not exists production_percentage numeric(6,2),
  add column if not exists mortality_percentage numeric(6,2),
  add column if not exists vaccination_status text,
  add column if not exists medication_vitamins text;

alter table if exists public.daily_farm_records
  drop constraint if exists daily_farm_records_feed_given_non_negative,
  drop constraint if exists daily_farm_records_feed_leftover_non_negative,
  drop constraint if exists daily_farm_records_egg_counts_non_negative;

alter table if exists public.daily_farm_records
  add constraint daily_farm_records_feed_given_non_negative check (feed_given_kg is null or feed_given_kg >= 0),
  add constraint daily_farm_records_feed_leftover_non_negative check (feed_leftover_kg is null or feed_leftover_kg >= 0),
  add constraint daily_farm_records_egg_counts_non_negative check (
    (normal_eggs is null or normal_eggs >= 0) and
    (broken_eggs is null or broken_eggs >= 0) and
    (total_eggs is null or total_eggs >= 0)
  );
