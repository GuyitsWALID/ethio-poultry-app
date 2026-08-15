\set ON_ERROR_STOP on

begin;

do $$
declare
  v_org uuid := '11000000-0000-4000-8000-000000000001';
  v_manager uuid := '11000000-0000-4000-8000-000000000002';
  v_branch uuid := '11000000-0000-4000-8000-000000000003';
  v_farm uuid := '11000000-0000-4000-8000-000000000004';
  v_house uuid := '11000000-0000-4000-8000-000000000005';
  v_batch uuid := '11000000-0000-4000-8000-000000000006';
  v_flock uuid := '11000000-0000-4000-8000-000000000007';
  v_warehouse uuid := '11000000-0000-4000-8000-000000000008';
  v_feed_item uuid := '11000000-0000-4000-8000-000000000009';
  v_health_item uuid := '11000000-0000-4000-8000-000000000010';
  v_day date := date '2099-01-15';
  v_daily uuid;
  v_result jsonb;
  v_count integer;
  v_number numeric;
begin
  insert into public.organizations(id, name) values (v_org, 'Item 1 transactional integration fixture');
  insert into public.profiles(id, org_id, full_name, role, is_active)
  values (v_manager, v_org, 'Integration Farm Manager', 'farm_manager', true);
  insert into public.branches(id, org_id, name) values (v_branch, v_org, 'Integration Branch');
  insert into public.farms(id, org_id, branch_id, name) values (v_farm, v_org, v_branch, 'Integration Farm');
  insert into public.houses(id, org_id, branch_id, farm_id, name, house_type)
  values (v_house, v_org, v_branch, v_farm, 'Integration House', 'layer');
  insert into public.batches(
    id, org_id, branch_id, farm_id, house_id, batch_code, source,
    placement_date, age_at_placement_days, total_count, status
  ) values (
    v_batch, v_org, v_branch, v_farm, v_house, 'ITEM1-BATCH', 'external_purchase',
    date '2098-12-01', 0, 1000, 'active'
  );
  insert into public.flocks(
    id, org_id, farm_id, house_id, batch_id, flock_code, flock_type, source,
    placement_date, initial_count, current_count, age_at_placement_days, status
  ) values (
    v_flock, v_org, v_farm, v_house, v_batch, 'ITEM1-FLOCK', 'layer', 'external_purchase',
    date '2098-12-01', 1000, 1000, 0, 'active'
  );
  insert into public.user_farm_access(org_id, profile_id, farm_id, starts_at)
  values (v_org, v_manager, v_farm, now() - interval '1 day');
  insert into public.warehouses(id, org_id, branch_id, farm_id, name, type, status)
  values (v_warehouse, v_org, v_branch, v_farm, 'Integration Store', 'farm_store', 'active');
  insert into public.user_warehouse_access(org_id, profile_id, warehouse_id, starts_at)
  values (v_org, v_manager, v_warehouse, now() - interval '1 day');
  insert into public.inventory_items(id, org_id, name, category, unit, unit_cost)
  values
    (v_feed_item, v_org, 'Integration Layer Feed', 'feed', 'kg', 20),
    (v_health_item, v_org, 'Integration Vitamin', 'vitamin', 'kg', 40);
  insert into public.stock_ledger(
    org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
    transaction_date, branch_id, farm_id, recorded_by, notes
  ) values
    (v_org, v_feed_item, v_warehouse, 'receipt', 100, 20, v_day, v_branch, v_farm, v_manager, 'Integration feed receipt'),
    (v_org, v_health_item, v_warehouse, 'receipt', 20, 40, v_day, v_branch, v_farm, v_manager, 'Integration health receipt');
  select coalesce(sum(public.stock_movement_delta(transaction_type, quantity)), 0) into v_number
  from public.stock_ledger where org_id = v_org and item_id = v_health_item and warehouse_id = v_warehouse;
  if v_number <> 20 then raise exception 'Fixture health stock balance is %, expected 20.', v_number; end if;
end;
$$;

do $$
declare
  v_org uuid := '11000000-0000-4000-8000-000000000001';
  v_manager uuid := '11000000-0000-4000-8000-000000000002';
  v_batch uuid := '11000000-0000-4000-8000-000000000006';
  v_flock uuid := '11000000-0000-4000-8000-000000000007';
  v_warehouse uuid := '11000000-0000-4000-8000-000000000008';
  v_feed_item uuid := '11000000-0000-4000-8000-000000000009';
  v_health_item uuid := '11000000-0000-4000-8000-000000000010';
  v_day date := date '2099-01-15';
  v_daily uuid;
  v_result jsonb;
  v_count integer;
  v_number numeric;
begin

  -- Daily Records owns non-feed observations and health usage.
  v_result := public.save_daily_record_with_usage(
    v_manager,
    null,
    v_flock,
    jsonb_build_object(
      'record_date', v_day,
      'opening_birds', 1000,
      'closing_birds', 998,
      'deaths', 2,
      'deaths_cause', 'Natural loss',
      'normal_eggs', 850,
      'broken_eggs', 10,
      'dirty_eggs', 5,
      'total_eggs', 865,
      'feed_leftover_grams', 750,
      'water_consumed_liters', 220
    ),
    jsonb_build_array(jsonb_build_object(
      'item_id', v_health_item,
      'warehouse_id', v_warehouse,
      'quantity', 2,
      'unit_cost', 40,
      'notes', 'Daily vitamin usage'
    ))
  );
  v_daily := (v_result->>'daily_record_id')::uuid;

  if v_daily is null then raise exception 'Daily Record RPC did not return an identifier.'; end if;
  select count(*) into v_count from public.stock_ledger
  where org_id = v_org and source_kind = 'daily_record_usage' and source_key = v_daily::text;
  if v_count <> 1 then raise exception 'Expected one non-feed Daily Record issue, found %.', v_count; end if;

  -- Manual feed fields must be rejected by the database boundary.
  begin
    perform public.save_daily_record_with_usage(
      v_manager, v_daily, v_flock,
      jsonb_build_object('record_date', v_day, 'feed_intake_grams', 12000),
      null
    );
    raise exception 'Manual Daily Record feed input was accepted.';
  exception when sqlstate '22023' then
    if sqlerrm not like 'Record feed intake%' then raise; end if;
  end;

  insert into public.feeding_session_records(
    org_id, batch_id, flock_id, record_date, session_name, session_time,
    feeders_count, planned_feed_kg, actual_feed_kg, feed_item_id, warehouse_id,
    feed_type, status, completed_at, completed_by, recorded_by
  ) values (
    v_org, v_batch, v_flock, v_day, 'Morning', time '08:00',
    10, 10, 12, v_feed_item, v_warehouse,
    'layer_feed', 'completed', now(), v_manager, v_manager
  );

  -- Feed Control claims the day and synchronizes its total without replacing
  -- eggs, mortality, leftovers, water, or Daily Records health usage.
  perform public.close_feed_day(v_manager, v_flock, v_day, null);
  select feed_intake_grams into v_number from public.daily_farm_records where id = v_daily;
  if v_number <> 12000 then raise exception 'Expected synchronized feed of 12000 g, found %.', v_number; end if;
  if not exists (
    select 1 from public.daily_farm_records
    where id = v_daily and synced and total_eggs = 865 and deaths = 2
      and feed_leftover_grams = 750 and water_consumed_liters = 220
  ) then raise exception 'Feed close replaced Daily Record-owned observations.'; end if;
  if not exists (
    select 1 from public.stock_ledger
    where org_id = v_org and source_kind = 'daily_record_usage' and source_key = v_daily::text
  ) then raise exception 'Feed close removed non-feed Daily Record usage.'; end if;

  -- Repeated closes are idempotent: one canonical feed issue remains.
  perform public.close_feed_day(v_manager, v_flock, v_day, null);
  select count(*) into v_count from public.stock_ledger
  where org_id = v_org and source_kind = 'feed_day_close' and source_key = v_flock::text || ':' || v_day::text;
  if v_count <> 1 then raise exception 'Repeated feed close produced % canonical issues.', v_count; end if;

  -- A Daily Record edit with null usages preserves both synchronized feed and
  -- existing health usage.
  perform public.save_daily_record_with_usage(
    v_manager, v_daily, v_flock,
    jsonb_build_object(
      'record_date', v_day,
      'opening_birds', 1000,
      'closing_birds', 998,
      'deaths', 2,
      'deaths_cause', 'Reviewed natural loss',
      'normal_eggs', 852,
      'broken_eggs', 8,
      'dirty_eggs', 5,
      'total_eggs', 865,
      'feed_leftover_grams', 700,
      'water_consumed_liters', 225
    ),
    null
  );
  if not exists (select 1 from public.daily_farm_records where id = v_daily and feed_intake_grams = 12000 and synced)
    then raise exception 'Daily Record edit overwrote Feed Control fields.'; end if;
  if not exists (
    select 1 from public.stock_ledger
    where org_id = v_org and source_kind = 'daily_record_usage' and source_key = v_daily::text
  ) then raise exception 'Daily Record edit silently removed existing health usage.'; end if;

  -- Reopen removes only Feed Control evidence and preserves the rest.
  perform public.reopen_feed_day(v_manager, v_flock, v_day, 'Integration reopen verification');
  if not exists (
    select 1 from public.daily_farm_records
    where id = v_daily and feed_intake_grams is null and feed_type is null and not synced
      and total_eggs = 865 and deaths = 2 and feed_leftover_grams = 700 and water_consumed_liters = 225
  ) then raise exception 'Reopen did not preserve the Daily Record correctly.'; end if;
  select count(*) into v_count from public.stock_ledger
  where org_id = v_org and source_kind = 'feed_day_close' and source_key = v_flock::text || ':' || v_day::text;
  if v_count <> 0 then raise exception 'Reopen left % Feed Control inventory issues.', v_count; end if;
  if not exists (
    select 1 from public.stock_ledger
    where org_id = v_org and source_kind = 'daily_record_usage' and source_key = v_daily::text
  ) then raise exception 'Reopen removed non-feed Daily Record usage.'; end if;

  -- Reclose restores one feed issue and synchronized totals.
  perform public.close_feed_day(v_manager, v_flock, v_day, null);
  select count(*) into v_count from public.stock_ledger
  where org_id = v_org and source_kind = 'feed_day_close' and source_key = v_flock::text || ':' || v_day::text;
  if v_count <> 1 then raise exception 'Reclose did not restore exactly one feed issue.'; end if;

  raise notice 'Feed close/reopen and Daily Record synchronization integration checks passed.';
end;
$$;

rollback;
