\set ON_ERROR_STOP on

begin;

do $$
declare
  v_org uuid := '13000000-0000-4000-8000-000000000001';
  v_manager uuid := '13000000-0000-4000-8000-000000000002';
  v_unassigned uuid := '13000000-0000-4000-8000-000000000003';
  v_branch uuid := '13000000-0000-4000-8000-000000000004';
  v_farm uuid := '13000000-0000-4000-8000-000000000005';
  v_locked_farm uuid := '13000000-0000-4000-8000-000000000006';
  v_house uuid := '13000000-0000-4000-8000-000000000007';
  v_batch uuid := '13000000-0000-4000-8000-000000000008';
  v_flock uuid := '13000000-0000-4000-8000-000000000009';
  v_warehouse uuid := '13000000-0000-4000-8000-000000000010';
begin
  insert into public.organizations(id, name, today_workspace_enabled)
  values (v_org, 'Today command boundary tenant', true);
  insert into public.profiles(id, org_id, full_name, role, is_active) values
    (v_manager, v_org, 'Today Command Manager', 'farm_manager', true),
    (v_unassigned, v_org, 'Unassigned Today Manager', 'farm_manager', true);
  insert into public.branches(id, org_id, name)
  values (v_branch, v_org, 'Today command branch');
  insert into public.farms(id, org_id, branch_id, name) values
    (v_farm, v_org, v_branch, 'Today command farm'),
    (v_locked_farm, v_org, v_branch, 'Locked Today command farm');
  insert into public.houses(id, org_id, branch_id, farm_id, name, house_type)
  values (v_house, v_org, v_branch, v_farm, 'Today command house', 'layer');
  insert into public.batches(
    id, org_id, branch_id, farm_id, house_id, batch_code, source,
    placement_date, age_at_placement_days, total_count, status
  ) values (
    v_batch, v_org, v_branch, v_farm, v_house, 'TODAY-COMMAND-BATCH',
    'external_purchase', current_date - 1, 0, 100, 'active'
  );
  insert into public.flocks(
    id, org_id, farm_id, house_id, batch_id, flock_code, flock_type, source,
    placement_date, initial_count, current_count, age_at_placement_days, status
  ) values (
    v_flock, v_org, v_farm, v_house, v_batch, 'TODAY-COMMAND-FLOCK',
    'layer', 'external_purchase', current_date - 1, 100, 100, 0, 'active'
  );
  insert into public.user_farm_access(org_id, profile_id, farm_id, starts_at) values
    (v_org, v_manager, v_farm, now() - interval '1 day'),
    (v_org, v_manager, v_locked_farm, now() - interval '1 day');
  insert into public.warehouses(id, org_id, branch_id, farm_id, name, type, status)
  values (v_warehouse, v_org, v_branch, v_farm, 'Today command store', 'farm_store', 'active');
  insert into public.user_warehouse_access(org_id, profile_id, warehouse_id, starts_at)
  values (v_org, v_manager, v_warehouse, now() - interval '1 day');
  insert into public.inventory_items(id, org_id, name, category, unit, reorder_level, unit_cost) values
    ('13000000-0000-4000-8000-000000000011', v_org, 'Today command vitamin', 'vitamin', 'bottle', 0, 10),
    ('13000000-0000-4000-8000-000000000012', v_org, 'Today command medicine', 'medicine', 'bottle', 0, 10);
  insert into public.farm_operating_days(org_id, farm_id, operating_date, status, locked_at)
  values (v_org, v_locked_farm, current_date, 'locked', now());
end;
$$;

create temporary table today_command_test_revisions(
  resource text primary key,
  revision text not null
) on commit drop;
insert into today_command_test_revisions(resource, revision)
values (
  'empty_feed_day',
  public.today_resource_revision(
    'feed_day', '13000000-0000-4000-8000-000000000009', current_date
  )
);
grant select on today_command_test_revisions to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

do $$
declare
  v_actor uuid := '13000000-0000-4000-8000-000000000002';
  v_farm uuid := '13000000-0000-4000-8000-000000000005';
  v_locked_farm uuid := '13000000-0000-4000-8000-000000000006';
  v_flock uuid := '13000000-0000-4000-8000-000000000009';
  v_warehouse uuid := '13000000-0000-4000-8000-000000000010';
  v_day text := current_date::text;
  v_command jsonb;
  v_result jsonb;
  v_replay jsonb;
  v_revision text;
begin
  v_command := jsonb_build_object(
    'schema_version', 1,
    'command_id', '13000000-0000-4000-8000-000000000101',
    'type', 'record_sale',
    'farm_id', v_farm,
    'work_date', v_day,
    'payload', jsonb_build_object(
      'product_category', 'egg', 'product_label', 'Test tray',
      'quantity', 2, 'unit_price', 100, 'paid_amount', 200, 'unit', 'tray'
    )
  );
  v_result := public.dispatch_today_command_v1(v_actor, v_command);
  v_replay := public.dispatch_today_command_v1(v_actor, v_command);
  if v_result is distinct from v_replay or v_result->>'status' <> 'applied' then
    raise exception 'Identical command replay did not return the stored result.';
  end if;
  begin
    perform public.dispatch_today_command_v1(
      v_actor,
      jsonb_set(v_command, '{payload,quantity}', '3'::jsonb)
    );
    raise exception 'A command ID was reused with a changed payload.';
  exception when sqlstate '22023' then
    if sqlerrm not like 'This command ID was already used%' then raise; end if;
  end;

  select revision into v_revision
  from today_command_test_revisions
  where resource = 'empty_feed_day';
  v_command := jsonb_build_object(
    'schema_version', 1,
    'command_id', '13000000-0000-4000-8000-000000000108',
    'type', 'save_feed_session',
    'farm_id', v_farm,
    'flock_id', v_flock,
    'work_date', v_day,
    'expected_resource_revision', v_revision,
    'payload', jsonb_build_object(
      'session', jsonb_build_object(
        'session_name', 'Morning', 'feeders_count', 2,
        'planned_feed_kg', 5, 'feed_type', 'layer_feed', 'status', 'planned'
      )
    )
  );
  v_result := public.dispatch_today_command_v1(v_actor, v_command);
  v_replay := public.dispatch_today_command_v1(v_actor, v_command);
  if v_result is distinct from v_replay
     or v_result->>'resource_revision' is null
     or v_result->>'resource_revision' = v_revision then
    raise exception 'Feed command did not return and persist the next authoritative revision.';
  end if;

  begin
    perform public.dispatch_today_command_v1(
      v_actor,
      jsonb_build_object(
        'schema_version', 1, 'command_id', '13000000-0000-4000-8000-000000000102',
        'type', 'record_expense', 'farm_id', v_locked_farm, 'work_date', v_day,
        'payload', jsonb_build_object('category', 'transport', 'description', 'Locked delivery', 'amount', 10)
      )
    );
    raise exception 'A locked operating day accepted a command.';
  exception when sqlstate '55000' then
    if sqlerrm not like 'This operating day is not open%' then raise; end if;
  end;

  begin
    perform public.dispatch_today_command_v1(
      v_actor,
      jsonb_build_object(
        'schema_version', 1, 'command_id', '13000000-0000-4000-8000-000000000103',
        'type', 'record_expense', 'farm_id', v_farm, 'work_date', v_day,
        'depends_on', jsonb_build_array('13000000-0000-4000-8000-000000000199'),
        'payload', jsonb_build_object('category', 'transport', 'description', 'Dependent delivery', 'amount', 10)
      )
    );
    raise exception 'A command with an incomplete dependency was accepted.';
  exception when check_violation then
    if sqlerrm not like 'A required earlier command%' then raise; end if;
  end;

  v_result := public.dispatch_today_command_v1(
    v_actor,
    jsonb_build_object(
      'schema_version', 1, 'command_id', '13000000-0000-4000-8000-000000000104',
      'type', 'confirm_no_activity', 'farm_id', v_farm, 'flock_id', v_flock,
      'work_date', v_day,
      'payload', jsonb_build_object('task_code', 'health_deaths', 'source_fingerprint', repeat('0', 64))
    )
  );
  if v_result->>'status' <> 'conflict'
     or v_result->>'error_code' <> 'RESOURCE_CONFLICT'
     or v_result->'conflict'->>'server_value' is null then
    raise exception 'A stale source fingerprint did not return a structured conflict.';
  end if;
  if exists (
    select 1 from public.client_operation_receipts
    where command_id = '13000000-0000-4000-8000-000000000104'
  ) then
    raise exception 'A rejected revision left a partial receipt.';
  end if;

  begin
    perform public.dispatch_today_command_v1(
      v_actor,
      jsonb_build_object(
        'schema_version', 1, 'command_id', '13000000-0000-4000-8000-000000000105',
        'type', 'record_health_event', 'farm_id', v_farm, 'flock_id', v_flock,
        'work_date', v_day,
        'payload', jsonb_build_object(
          'event_type', 'treatment', 'event', jsonb_build_object('description', 'Treatment'),
          'inventory_usage', jsonb_build_object(
            'item_id', '13000000-0000-4000-8000-000000000011',
            'warehouse_id', v_warehouse, 'quantity', 1
          )
        )
      )
    );
    raise exception 'Treatment accepted a non-medicine item.';
  exception when sqlstate '22023' then
    if sqlerrm not like 'Treatments may issue medicine items only%' then raise; end if;
  end;

  begin
    perform public.dispatch_today_command_v1(
      v_actor,
      jsonb_build_object(
        'schema_version', 1, 'command_id', '13000000-0000-4000-8000-000000000106',
        'type', 'record_health_event', 'farm_id', v_farm, 'flock_id', v_flock,
        'work_date', v_day,
        'payload', jsonb_build_object(
          'event_type', 'treatment', 'event', jsonb_build_object('description', 'Treatment'),
          'inventory_usage', jsonb_build_object(
            'item_id', '13000000-0000-4000-8000-000000000012',
            'warehouse_id', v_warehouse, 'quantity', 1
          )
        )
      )
    );
    raise exception 'Treatment accepted insufficient medicine stock.';
  exception when sqlstate '22023' then
    if sqlerrm not like 'Insufficient medicine stock%' then raise; end if;
  end;

end;
$$;

reset role;
do $$
begin
  if (select count(*) from public.daily_sales_records where org_id = '13000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Identical command replay duplicated the sale.';
  end if;
  if exists (select 1 from public.health_events where org_id = '13000000-0000-4000-8000-000000000001')
     or exists (
       select 1 from public.client_operation_receipts
       where command_id in (
         '13000000-0000-4000-8000-000000000105',
         '13000000-0000-4000-8000-000000000106'
       )
     ) then
    raise exception 'Rejected category or stock commands left partial data.';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"13000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.dispatch_today_command_v1(
      '13000000-0000-4000-8000-000000000003',
      jsonb_build_object(
        'schema_version', 1, 'command_id', '13000000-0000-4000-8000-000000000107',
        'type', 'record_sale', 'farm_id', '13000000-0000-4000-8000-000000000005',
        'work_date', current_date,
        'payload', jsonb_build_object(
          'product_category', 'egg', 'product_label', 'Unauthorized tray',
          'quantity', 1, 'unit_price', 100, 'paid_amount', 100, 'unit', 'tray'
        )
      )
    );
    raise exception 'A stale or absent farm assignment was accepted.';
  exception when insufficient_privilege then
    if sqlerrm not like 'An active farm assignment is required%' then raise; end if;
  end;
end;
$$;

reset role;

do $$
begin
  raise notice 'Today command boundary retry, assignment, lock, dependency, stock, category, and revision checks passed.';
end;
$$;

rollback;
