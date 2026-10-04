\set ON_ERROR_STOP on
begin;

do $$
declare
  v_org uuid := '16000000-0000-4000-8000-000000000001';
  v_actor uuid := '16000000-0000-4000-8000-000000000002';
  v_branch uuid := '16000000-0000-4000-8000-000000000003';
  v_farm uuid := '16000000-0000-4000-8000-000000000004';
  v_house uuid := '16000000-0000-4000-8000-000000000005';
  v_batch uuid := '16000000-0000-4000-8000-000000000006';
  v_flock uuid := '16000000-0000-4000-8000-000000000007';
  v_store uuid := '16000000-0000-4000-8000-000000000008';
  v_feed uuid := '16000000-0000-4000-8000-000000000009';
begin
  insert into public.organizations(id, name, today_workspace_enabled) values (v_org, 'Feed warehouse regression', true);
  insert into public.profiles(id, org_id, full_name, role, is_active) values (v_actor, v_org, 'Feed Manager', 'farm_manager', true);
  insert into public.branches(id, org_id, name) values
    (v_branch, v_org, 'Feed branch'), ('16000000-0000-4000-8000-000000000010', v_org, 'Other branch');
  insert into public.farms(id, org_id, branch_id, name) values (v_farm, v_org, v_branch, 'Feed farm');
  insert into public.houses(id, org_id, branch_id, farm_id, name, house_type) values (v_house, v_org, v_branch, v_farm, 'Feed house', 'layer');
  insert into public.batches(id, org_id, branch_id, farm_id, house_id, batch_code, source, placement_date, age_at_placement_days, total_count, status)
    values (v_batch, v_org, v_branch, v_farm, v_house, 'WAREHOUSE-FEED-BATCH', 'external_purchase', current_date - 1, 0, 100, 'active');
  insert into public.flocks(id, org_id, farm_id, house_id, batch_id, flock_code, flock_type, source, placement_date, initial_count, current_count, age_at_placement_days, status)
    values (v_flock, v_org, v_farm, v_house, v_batch, 'WAREHOUSE-FEED-FLOCK', 'layer', 'external_purchase', current_date - 1, 100, 100, 0, 'active');
  insert into public.user_farm_access(org_id, profile_id, farm_id, starts_at) values (v_org, v_actor, v_farm, now() - interval '1 day');
  -- Deliberately no user_warehouse_access rows: feeding uses the assigned farm.
  insert into public.warehouses(id, org_id, branch_id, farm_id, name, type, status) values
    (v_store, v_org, v_branch, v_farm, 'Farm feed store', 'farm_store', 'active'),
    ('16000000-0000-4000-8000-000000000011', v_org, '16000000-0000-4000-8000-000000000010', null, 'Other branch store', 'central_warehouse', 'active');
  insert into public.inventory_items(id, org_id, name, category, unit, unit_cost, reorder_level) values (v_feed, v_org, 'Feed kg', 'feed', 'kg', 10, 0);
  insert into public.stock_ledger(org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost, transaction_date, branch_id, farm_id, recorded_by)
    values (v_org, v_feed, v_store, 'receipt', 100, 10, current_date, v_branch, v_farm, v_actor);
  insert into public.daily_farm_records(org_id, flock_id, record_date, opening_birds, closing_birds, recorded_by)
    values (v_org, v_flock, current_date, 100, 100, v_actor);
end $$;

create temporary table feed_warehouse_revision as
select public.today_resource_revision('feed_day', '16000000-0000-4000-8000-000000000007', current_date) as revision;
grant select on feed_warehouse_revision to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '16000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"16000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  v_actor uuid := '16000000-0000-4000-8000-000000000002';
  v_farm uuid := '16000000-0000-4000-8000-000000000004';
  v_flock uuid := '16000000-0000-4000-8000-000000000007';
  v_store uuid := '16000000-0000-4000-8000-000000000008';
  v_feed uuid := '16000000-0000-4000-8000-000000000009';
  v_command jsonb;
  v_result jsonb;
  v_revision text;
begin
  select revision into v_revision from feed_warehouse_revision;
  v_command := jsonb_build_object('schema_version', 1, 'command_id', '16000000-0000-4000-8000-000000000101',
    'type', 'save_feed_session', 'farm_id', v_farm, 'flock_id', v_flock, 'work_date', current_date,
    'expected_resource_revision', v_revision,
    'payload', jsonb_build_object('session', jsonb_build_object('session_name', 'Feeding 1', 'session_time', '07:00',
      'feeders_count', 1, 'planned_feed_kg', 5, 'actual_feed_kg', 5, 'feed_item_id', v_feed,
      'warehouse_id', v_store, 'feed_type', 'layer_feed', 'status', 'completed')));
  v_result := public.dispatch_today_command_v1(v_actor, v_command);
  if v_result->>'status' <> 'applied' or public.dispatch_today_command_v1(v_actor, v_command) <> v_result then
    raise exception 'Farm-scoped feed save or replay failed.';
  end if;
  v_revision := v_result->>'resource_revision';

  begin
    perform public.dispatch_today_command_v1(v_actor,
      jsonb_set(jsonb_set(jsonb_set(v_command, '{command_id}', '"16000000-0000-4000-8000-000000000102"'),
        '{expected_resource_revision}', to_jsonb(v_revision)),
        '{payload,session,warehouse_id}', '"16000000-0000-4000-8000-000000000011"'));
    raise exception 'Out-of-branch feeding warehouse was accepted.';
  exception when insufficient_privilege then null;
  end;

  v_command := jsonb_build_object('schema_version', 1, 'command_id', '16000000-0000-4000-8000-000000000103',
    'type', 'close_feed_day', 'farm_id', v_farm, 'flock_id', v_flock, 'work_date', current_date,
    'expected_resource_revision', v_revision, 'payload', '{}'::jsonb);
  v_result := public.dispatch_today_command_v1(v_actor, v_command);
  if v_result->>'status' <> 'applied' or public.dispatch_today_command_v1(v_actor, v_command) <> v_result then
    raise exception 'Feed close or replay failed.';
  end if;

  begin
    perform public.dispatch_today_command_v1(v_actor, jsonb_build_object('schema_version', 1,
      'command_id', '16000000-0000-4000-8000-000000000104', 'type', 'record_stock_receipt',
      'farm_id', v_farm, 'work_date', current_date, 'payload', jsonb_build_object(
        'warehouse_id', v_store, 'item_id', v_feed, 'quantity', 10, 'unit_cost', 10,
        'details', jsonb_build_object('procurement_type', 'miscellaneous'))));
    raise exception 'Stock receipt bypassed independent warehouse assignment.';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$
begin
  if (select count(*) from public.feeding_session_records where org_id = '16000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Feed replay duplicated the session.';
  end if;
  if (select count(*) from public.stock_ledger where org_id = '16000000-0000-4000-8000-000000000001' and source_kind = 'feed_day_close') <> 1
    or (select sum(quantity) from public.stock_ledger where org_id = '16000000-0000-4000-8000-000000000001' and source_kind = 'feed_day_close') <> 5 then
    raise exception 'Feed close did not deduct exactly once.';
  end if;
  if not exists(select 1 from public.daily_farm_records where org_id = '16000000-0000-4000-8000-000000000001' and feed_intake_quantity = 5) then
    raise exception 'Feed close did not synchronize the Daily Record.';
  end if;
  if exists(select 1 from public.client_operation_receipts where command_id in (
      '16000000-0000-4000-8000-000000000102', '16000000-0000-4000-8000-000000000104')) then
    raise exception 'Rejected warehouse commands left a receipt.';
  end if;
  raise notice 'Feed save, close, replay, stock deduction, and independent warehouse authorization checks passed.';
end $$;
rollback;
