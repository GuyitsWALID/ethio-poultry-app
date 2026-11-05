-- A new Today day-start must recheck dated evidence while holding the flock
-- lock. Old queued commands and governed legacy writers retain their contract.
alter function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb)
  rename to save_daily_record_with_usage_before_opening_source;

create function public.save_daily_record_with_usage(
  p_actor_id uuid, p_daily_record_id uuid, p_flock_id uuid,
  p_record jsonb, p_usages jsonb default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  actor public.profiles;
  flock public.flocks;
  prior public.daily_farm_records;
  work_date date;
  expected_count integer;
  expected_source text;
  start_evidence jsonb := p_record->'_today_opening';
begin
  if start_evidence is not null then
    if jsonb_typeof(start_evidence)<>'object' or p_daily_record_id is not null then
      raise exception 'Invalid bird-day start evidence.' using errcode='22023';
    end if;
    select * into actor from public.profiles where id=p_actor_id and is_active;
    if not found or actor.role::text<>'farm_manager' then
      raise exception 'An active Farm Manager is required.' using errcode='42501';
    end if;
    select * into flock from public.flocks
      where id=p_flock_id and org_id=actor.org_id for update;
    if not found or not exists (
      select 1 from public.user_farm_access a
      where a.org_id=actor.org_id and a.profile_id=p_actor_id and a.farm_id=flock.farm_id
        and a.revoked_at is null and a.starts_at<=now()
        and (a.expires_at is null or a.expires_at>now())
    ) then
      raise exception 'An active farm assignment is required.' using errcode='42501';
    end if;
    work_date := nullif(p_record->>'record_date','')::date;
    if work_date is null then raise exception 'Work date is required.' using errcode='22023'; end if;
    if exists(select 1 from public.daily_farm_records
      where org_id=actor.org_id and flock_id=p_flock_id and record_date=work_date) then
      raise exception 'The bird record changed. Refresh before starting the day.' using errcode='40001';
    end if;
    select * into prior from public.daily_farm_records
      where org_id=actor.org_id and flock_id=p_flock_id and record_date<work_date and voided_at is null
      order by record_date desc limit 1;
    if found and prior.record_date=work_date-1 and prior.closing_birds is not null then
      expected_count := prior.closing_birds;
      expected_source := 'previous_close';
    elsif prior.id is null and flock.placement_date=work_date then
      expected_count := flock.initial_count;
      expected_source := 'placement';
    end if;
    if expected_count is null or expected_count<0 then
      raise exception 'A reliable opening source is missing. Establish the recording starting point.' using errcode='23514';
    end if;
    if start_evidence->>'source' is distinct from expected_source
      or (start_evidence->>'count')::integer is distinct from expected_count
      or (p_record->>'opening_birds')::integer is distinct from expected_count
      or (p_record->>'closing_birds')::integer is distinct from expected_count
      or coalesce((p_record->>'deaths')::integer,0)<>0
      or coalesce((p_record->>'culls')::integer,0)<>0
      or coalesce((p_record->>'transfers_in')::integer,0)<>0
      or coalesce((p_record->>'transfers_out')::integer,0)<>0
      or coalesce((p_record->>'other_removals')::integer,0)<>0 then
      raise exception 'The opening source changed. Refresh before starting the day.' using errcode='40001';
    end if;
  end if;
  return public.save_daily_record_with_usage_before_opening_source(
    p_actor_id,p_daily_record_id,p_flock_id,p_record-'_today_opening',p_usages);
end $$;

revoke all on function public.save_daily_record_with_usage_before_opening_source(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_daily_record_with_usage_before_opening_source(uuid,uuid,uuid,jsonb,jsonb) to service_role;
revoke all on function public.save_daily_record_with_usage(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_daily_record_with_usage(uuid,uuid,uuid,jsonb,jsonb) to service_role;
