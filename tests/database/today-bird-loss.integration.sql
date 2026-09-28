\set ON_ERROR_STOP on

-- Run against a database with the bird-loss migration applied. Every fixture
-- and assertion is rolled back by the shared integration-test harness.
begin;

do $$
declare
  v_org uuid := '14000000-0000-4000-8000-000000000001';
  v_manager uuid := '14000000-0000-4000-8000-000000000002';
  v_branch uuid := '14000000-0000-4000-8000-000000000003';
  v_farm uuid := '14000000-0000-4000-8000-000000000004';
  v_house uuid := '14000000-0000-4000-8000-000000000005';
  v_batch uuid := '14000000-0000-4000-8000-000000000006';
  v_flock uuid := '14000000-0000-4000-8000-000000000007';
begin
  insert into public.organizations(id, name, today_workspace_enabled)
  values (v_org, 'Today bird loss test', true);
  insert into public.profiles(id, org_id, full_name, role, is_active)
  values (v_manager, v_org, 'Bird Loss Manager', 'farm_manager', true);
  insert into public.branches(id, org_id, name) values (v_branch, v_org, 'Bird branch');
  insert into public.farms(id, org_id, branch_id, name) values (v_farm, v_org, v_branch, 'Bird farm');
  insert into public.houses(id, org_id, branch_id, farm_id, name, house_type)
  values (v_house, v_org, v_branch, v_farm, 'Bird house', 'layer');
  insert into public.batches(id, org_id, branch_id, farm_id, house_id, batch_code, source,
    placement_date, age_at_placement_days, total_count, status)
  values (v_batch, v_org, v_branch, v_farm, v_house, 'BIRD-LOSS-BATCH',
    'external_purchase', current_date - 1, 0, 100, 'active');
  insert into public.flocks(id, org_id, farm_id, house_id, batch_id, flock_code, flock_type,
    source, placement_date, initial_count, current_count, age_at_placement_days, status)
  values (v_flock, v_org, v_farm, v_house, v_batch, 'BIRD-LOSS-FLOCK',
    'layer', 'external_purchase', current_date - 1, 100, 100, 0, 'active');
  insert into public.user_farm_access(org_id, profile_id, farm_id, starts_at)
  values (v_org, v_manager, v_farm, now() - interval '1 day');
  insert into public.daily_farm_records(
    org_id, flock_id, record_date, opening_birds, closing_birds,
    normal_eggs, total_eggs, water_consumed_liters, recorded_by
  ) values (
    v_org, v_flock, (now() at time zone 'Africa/Addis_Ababa')::date,
    100, 100, 40, 40, 20, v_manager
  );
end;
$$;

create temporary table today_bird_loss_revision(revision text not null) on commit drop;
insert into today_bird_loss_revision(revision)
select public.today_resource_revision('daily_record', d.id, null)
from public.daily_farm_records d
where d.flock_id = '14000000-0000-4000-8000-000000000007'
  and d.record_date = (now() at time zone 'Africa/Addis_Ababa')::date;
grant select on today_bird_loss_revision to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '14000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"14000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

do $$
declare
  v_actor uuid := '14000000-0000-4000-8000-000000000002';
  v_farm uuid := '14000000-0000-4000-8000-000000000004';
  v_flock uuid := '14000000-0000-4000-8000-000000000007';
  v_day date := (now() at time zone 'Africa/Addis_Ababa')::date;
  v_record uuid;
  v_revision text;
  v_fresh_revision text;
  v_command jsonb;
  v_result jsonb;
  v_row public.daily_farm_records;
  v_count integer;
begin
  select id into v_record from public.daily_farm_records
  where flock_id = v_flock and record_date = v_day;
  if v_record is null then raise exception 'Could not create the opening bird check'; end if;

  select revision into v_revision from today_bird_loss_revision;
  v_command := jsonb_build_object(
    'schema_version', 1, 'command_id', '14000000-0000-4000-8000-000000000101',
    'type', 'save_daily_record', 'farm_id', v_farm, 'flock_id', v_flock,
    'work_date', v_day, 'expected_resource_revision', v_revision,
    'payload', jsonb_build_object('daily_record_id', v_record, 'usages', 'null'::jsonb,
      'record', jsonb_build_object('record_date', v_day,
        '_today_bird_loss', jsonb_build_object('deaths', 2, 'culls', 1,
          'cause', 'Illness', 'cull_reason', 'Severe injury', 'expected_revision', v_revision))));
  v_result := public.dispatch_today_command_v1(v_actor, v_command);
  if v_result->>'status' <> 'applied' or
    public.dispatch_today_command_v1(v_actor, v_command) is distinct from v_result then
    raise exception 'Bird-loss command did not apply idempotently: %', v_result;
  end if;
  v_fresh_revision := v_result->>'resource_revision';
  select * into v_row from public.daily_farm_records where id = v_record;
  if v_row.deaths <> 2 or v_row.culls <> 1 or v_row.closing_birds <> 97
    or v_row.opening_birds <> 100 or v_row.normal_eggs <> 40
    or v_row.total_eggs <> 40 or v_row.water_consumed_liters <> 20 then
    raise exception 'Bird loss changed unrelated Daily Record values';
  end if;
  select count(*) into v_count from public.mortality_events
  where flock_id = v_flock and record_date = v_day and count = 2;
  if v_count <> 1 then raise exception 'Mortality event was not written once'; end if;
  v_result := public.dispatch_today_command_v1(v_actor, jsonb_build_object(
    'schema_version', 1, 'command_id', '14000000-0000-4000-8000-000000000103',
    'type', 'save_daily_record', 'farm_id', v_farm, 'flock_id', v_flock,
    'work_date', v_day, 'expected_resource_revision', v_revision,
    'payload', jsonb_build_object('daily_record_id', v_record, 'usages', 'null'::jsonb,
      'record', jsonb_build_object('record_date', v_day,
        '_today_bird_loss', jsonb_build_object('deaths', 1, 'cause', 'Natural',
          'expected_revision', v_revision)))));
  if v_result->>'status' <> 'conflict' then
    raise exception 'Stale loss revision was accepted: %', v_result;
  end if;

  v_result := public.dispatch_today_command_v1(v_actor, jsonb_build_object(
    'schema_version', 1, 'command_id', '14000000-0000-4000-8000-000000000104',
    'type', 'save_daily_record', 'farm_id', v_farm, 'flock_id', v_flock,
    'work_date', v_day, 'expected_resource_revision', v_fresh_revision,
    'payload', jsonb_build_object('daily_record_id', v_record, 'usages', 'null'::jsonb,
      'record', jsonb_build_object('record_date', v_day,
        '_today_bird_loss', jsonb_build_object('deaths', 0, 'culls', 1,
          'cull_reason', 'Severe injury', 'expected_revision', v_fresh_revision)))));
  if v_result->>'status' <> 'applied' then
    raise exception 'Cull-only follow-up did not apply: %', v_result;
  end if;
  select * into v_row from public.daily_farm_records where id = v_record;
  if v_row.deaths <> 2 or v_row.culls <> 2 or v_row.closing_birds <> 96 then
    raise exception 'Cull-only follow-up did not preserve death count';
  end if;

end;
$$;

set local role postgres;
do $$
begin
  if (select count(*) from public.flock_cull_events
      where flock_id = '14000000-0000-4000-8000-000000000007'
        and record_date = (now() at time zone 'Africa/Addis_Ababa')::date
        and count = 1) <> 2 then
    raise exception 'Cull events were not written once per command';
  end if;
  if (select current_count from public.flocks
      where id = '14000000-0000-4000-8000-000000000007') <> 96 then
    raise exception 'Flock master count did not include deaths and culls';
  end if;
  begin
    insert into public.daily_task_attestations(
      org_id, farm_id, flock_id, work_date, task_code, source_fingerprint, confirmed_by
    ) values (
      '14000000-0000-4000-8000-000000000001',
      '14000000-0000-4000-8000-000000000004',
      '14000000-0000-4000-8000-000000000007',
      (now() at time zone 'Africa/Addis_Ababa')::date,
      'health_deaths', repeat('a', 64),
      '14000000-0000-4000-8000-000000000002'
    );
    raise exception 'False none-today confirmation was accepted';
  exception when sqlstate '23514' then null;
  end;
end;
$$;

rollback;
