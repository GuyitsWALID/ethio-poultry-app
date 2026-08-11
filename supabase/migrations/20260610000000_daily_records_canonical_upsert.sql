-- Canonical daily records: one record per org/flock/date with delta-safe flock counts.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_farm_records_org_flock_date_unique'
  ) then
    if exists (
      select 1
      from public.daily_farm_records
      group by org_id, flock_id, record_date
      having count(*) > 1
    ) then
      raise exception 'Cannot add daily_farm_records_org_flock_date_unique while duplicate org/flock/date rows exist.';
    end if;

    alter table public.daily_farm_records
      add constraint daily_farm_records_org_flock_date_unique
      unique (org_id, flock_id, record_date);
  end if;
end $$;

create or replace function public.apply_daily_farm_record_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live_birds integer;
  old_deaths integer := 0;
  new_deaths integer := 0;
  death_delta integer := 0;
begin
  if tg_op = 'DELETE' then
    if coalesce(old.deaths, 0) > 0 then
      update public.flocks
      set current_count = current_count + coalesce(old.deaths, 0),
          updated_at = now()
      where id = old.flock_id;
    end if;

    return old;
  end if;

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

  old_deaths := case when tg_op = 'UPDATE' then coalesce(old.deaths, 0) else 0 end;
  new_deaths := coalesce(new.deaths, 0);
  death_delta := new_deaths - old_deaths;

  if death_delta <> 0 then
    update public.flocks
    set current_count = greatest(current_count - death_delta, 0),
        updated_at = now()
    where id = new.flock_id;
  end if;

  return new;
end;
$$;

drop trigger if exists apply_daily_farm_record_counts on public.daily_farm_records;
create trigger apply_daily_farm_record_counts
before insert or update or delete on public.daily_farm_records
for each row
execute function public.apply_daily_farm_record_counts();
