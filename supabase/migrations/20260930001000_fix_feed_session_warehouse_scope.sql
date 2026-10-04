create or replace function public.execute_today_command_v1(
  p_actor_id uuid,
  p_command jsonb
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_command_id uuid;
  v_command_type text;
  v_farm_id uuid;
  v_flock_id uuid;
  v_work_date date;
  v_payload jsonb;
  v_hash text;
  v_receipt public.client_operation_receipts;
  v_domain_result jsonb;
  v_source_ref text;
  v_row_id uuid;
  v_batch_id uuid;
  v_branch_id uuid;
  v_house_id uuid;
  v_warehouse_id uuid;
  v_item_id uuid;
  v_scope record;
  v_action public.operational_actions;
  v_before_status text;
  v_after_status text;
  v_event_type text;
  v_actor_name text;
  v_expected_revision text;
  v_current_revision text;
  v_result jsonb;
begin
  if coalesce((p_command->>'schema_version')::integer, 0) <> 1 then
    raise exception 'Unsupported Today command version.' using errcode = '22023';
  end if;
  v_command_id := nullif(p_command->>'command_id', '')::uuid;
  v_command_type := nullif(btrim(p_command->>'type'), '');
  v_farm_id := nullif(p_command->>'farm_id', '')::uuid;
  v_flock_id := nullif(p_command->>'flock_id', '')::uuid;
  v_work_date := nullif(p_command->>'work_date', '')::date;
  v_payload := coalesce(p_command->'payload', '{}'::jsonb);
  if v_command_id is null or v_command_type is null or v_farm_id is null or v_work_date is null then
    raise exception 'Command ID, type, farm, and work date are required.' using errcode = '22023';
  end if;
  if v_command_type not in (
    'save_daily_record', 'save_feed_session', 'close_feed_day',
    'record_mortality_event', 'record_health_event', 'complete_vaccination',
    'record_stock_receipt', 'record_sale', 'record_expense', 'update_assigned_action'
  ) then
    raise exception 'Unsupported Today command type.' using errcode = '22023';
  end if;

  select org_id, role::text, coalesce(nullif(btrim(full_name), ''), 'Farm Manager')
  into v_org_id, v_role, v_actor_name
  from public.profiles where id = p_actor_id and is_active;
  if v_org_id is null or v_role <> 'farm_manager' then
    raise exception 'Only an active Farm Manager can submit Today work.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.farms where id = v_farm_id and org_id = v_org_id
  ) or not exists (
    select 1 from public.user_farm_access a
    where a.org_id = v_org_id and a.profile_id = p_actor_id and a.farm_id = v_farm_id
      and a.revoked_at is null and a.starts_at <= now()
      and (a.expires_at is null or a.expires_at > now())
  ) then
    raise exception 'An active farm assignment is required.' using errcode = '42501';
  end if;
  if v_flock_id is not null then
    select f.batch_id, f.house_id, h.branch_id into v_batch_id, v_house_id, v_branch_id
    from public.flocks f join public.houses h on h.id = f.house_id
    where f.id = v_flock_id and f.org_id = v_org_id and f.farm_id = v_farm_id;
    if not found then raise exception 'The flock is outside the selected farm.' using errcode = '42501'; end if;
  else
    select branch_id into v_branch_id from public.farms where id = v_farm_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('today-command:' || v_command_id::text, 0));
  v_hash := public.canonical_today_payload_hash(p_command);
  select * into v_receipt from public.client_operation_receipts
  where org_id = v_org_id and actor_id = p_actor_id and command_id = v_command_id
  for update;
  if found then
    if v_receipt.payload_hash <> v_hash then
      raise exception 'This command ID was already used with a different payload.' using errcode = '22023';
    end if;
    if v_receipt.result is not null then return v_receipt.result; end if;
  else
    insert into public.client_operation_receipts(
      org_id, actor_id, command_id, schema_version, command_type, payload_hash
    ) values (v_org_id, p_actor_id, v_command_id, 1, v_command_type, v_hash)
    returning * into v_receipt;
  end if;

  if v_command_type not in ('record_stock_receipt', 'record_sale', 'record_expense') and exists (
    select 1 from public.farm_operating_days
    where farm_id = v_farm_id and operating_date = v_work_date and status in ('closed', 'locked')
  ) then
    raise exception 'This operating day is not open.' using errcode = '55000';
  end if;

  v_expected_revision := nullif(p_command->>'expected_resource_revision', '');
  if v_expected_revision is not null then
    if v_command_type = 'save_daily_record' and nullif(v_payload->>'daily_record_id', '') is not null then
      v_current_revision := public.today_resource_revision('daily_record', (v_payload->>'daily_record_id')::uuid, null);
    elsif v_command_type in ('save_feed_session', 'close_feed_day') and v_flock_id is not null then
      v_current_revision := public.today_resource_revision('feed_day', v_flock_id, v_work_date);
    end if;
    if v_current_revision is not null and v_current_revision <> v_expected_revision then
      raise exception 'The source record changed. Refresh before saving.' using errcode = '40001';
    end if;
  end if;

  if v_command_type = 'save_daily_record' then
    if v_flock_id is null then raise exception 'A flock is required.' using errcode = '22023'; end if;
    v_domain_result := public.save_daily_record_with_usage(
      p_actor_id,
      nullif(v_payload->>'daily_record_id', '')::uuid,
      v_flock_id,
      coalesce(v_payload->'record', '{}'::jsonb),
      coalesce(v_payload->'usages', '[]'::jsonb)
    );
    v_source_ref := 'daily_farm_records/' || coalesce(v_domain_result->>'daily_record_id', v_domain_result->>'record_id');

  elsif v_command_type = 'save_feed_session' then
    if v_flock_id is null then raise exception 'A flock is required.' using errcode = '22023'; end if;
    if coalesce((v_payload->'session'->>'planned_feed_kg')::numeric, 0) <= 0
       or coalesce((v_payload->'session'->>'feeders_count')::integer, 0) <= 0
       or nullif(btrim(v_payload->'session'->>'session_name'), '') is null then
      raise exception 'Session name, positive plan, and feeder count are required.' using errcode = '22023';
    end if;
    if coalesce(v_payload->'session'->>'status', 'planned') = 'completed' then
      v_warehouse_id := nullif(v_payload->'session'->>'warehouse_id', '')::uuid;
      v_item_id := nullif(v_payload->'session'->>'feed_item_id', '')::uuid;
      if v_warehouse_id is null or v_item_id is null or (v_payload->'session'->>'actual_feed_kg') is null then
        raise exception 'Completed sessions require actual feed, a feed item, and warehouse.' using errcode = '22023';
      end if;
      if not exists (
           select 1 from public.inventory_items where id = v_item_id and org_id = v_org_id and category = 'feed'
         )
         or not exists (
           select 1 from public.warehouses where id = v_warehouse_id and org_id = v_org_id and status = 'active'
             and (farm_id = v_farm_id or (farm_id is null and branch_id = v_branch_id))
         ) then
        raise exception 'Choose a valid warehouse and feed inventory item.' using errcode = '42501';
      end if;
    end if;
    insert into public.feeding_session_records(
      org_id, batch_id, flock_id, record_date, session_name, session_time, feeders_count,
      planned_feed_kg, actual_feed_kg, notes, feed_item_id, warehouse_id, feed_type,
      status, completed_at, completed_by, recorded_by, updated_at
    ) values (
      v_org_id, v_batch_id, v_flock_id, v_work_date,
      v_payload->'session'->>'session_name', nullif(v_payload->'session'->>'session_time', '')::time,
      (v_payload->'session'->>'feeders_count')::integer,
      (v_payload->'session'->>'planned_feed_kg')::numeric,
      nullif(v_payload->'session'->>'actual_feed_kg', '')::numeric,
      nullif(btrim(v_payload->'session'->>'notes'), ''),
      nullif(v_payload->'session'->>'feed_item_id', '')::uuid,
      nullif(v_payload->'session'->>'warehouse_id', '')::uuid,
      (v_payload->'session'->>'feed_type')::public.feed_type,
      coalesce(v_payload->'session'->>'status', 'planned'),
      case when v_payload->'session'->>'status' = 'completed' then now() else null end,
      case when v_payload->'session'->>'status' = 'completed' then p_actor_id else null end,
      p_actor_id, now()
    ) on conflict (org_id, flock_id, record_date, session_name)
    do update set session_time = excluded.session_time, feeders_count = excluded.feeders_count,
      planned_feed_kg = excluded.planned_feed_kg, actual_feed_kg = excluded.actual_feed_kg,
      notes = excluded.notes, feed_item_id = excluded.feed_item_id, warehouse_id = excluded.warehouse_id,
      feed_type = excluded.feed_type, status = excluded.status, completed_at = excluded.completed_at,
      completed_by = excluded.completed_by, updated_at = now()
    returning id into v_row_id;
    v_domain_result := jsonb_build_object('session_id', v_row_id);
    v_source_ref := 'feeding_session_records/' || v_row_id::text;

  elsif v_command_type = 'close_feed_day' then
    if v_flock_id is null then raise exception 'A flock is required.' using errcode = '22023'; end if;
    v_domain_result := public.close_feed_day(p_actor_id, v_flock_id, v_work_date, nullif(btrim(v_payload->>'override_reason'), ''));
    v_source_ref := 'feed_day_closures/' || v_flock_id::text || ':' || v_work_date::text;

  elsif v_command_type = 'record_mortality_event' then
    if v_flock_id is null or coalesce((v_payload->>'count')::integer, 0) <= 0 or nullif(btrim(v_payload->>'cause'), '') is null then
      raise exception 'Flock, positive death count, and cause are required.' using errcode = '22023';
    end if;
    insert into public.mortality_events(
      org_id, flock_id, record_date, count, cause, recorded_time, diagnosis, notes, observed_by
    ) values (
      v_org_id, v_flock_id, v_work_date, (v_payload->>'count')::integer,
      btrim(v_payload->>'cause'), nullif(v_payload->>'recorded_time', '')::time,
      nullif(btrim(v_payload->>'diagnosis'), ''), nullif(btrim(v_payload->>'notes'), ''), p_actor_id
    ) returning id into v_row_id;
    v_domain_result := jsonb_build_object('event_id', v_row_id);
    v_source_ref := 'mortality_events/' || v_row_id::text;

  elsif v_command_type = 'record_health_event' then
    if v_flock_id is null then raise exception 'A flock is required.' using errcode = '22023'; end if;
    v_domain_result := public.record_health_event_with_inventory(
      p_actor_id, v_flock_id, v_work_date,
      (v_payload->>'event_type')::public.health_event_type,
      coalesce(v_payload->'event', '{}'::jsonb),
      nullif(v_payload->'inventory_usage'->>'item_id', '')::uuid,
      nullif(v_payload->'inventory_usage'->>'warehouse_id', '')::uuid,
      nullif(v_payload->'inventory_usage'->>'quantity', '')::numeric
    );
    v_source_ref := 'health_events/' || (v_domain_result->>'event_id');

  elsif v_command_type = 'complete_vaccination' then
    v_domain_result := public.complete_vaccination_with_inventory(
      p_actor_id,
      (v_payload->>'schedule_id')::uuid,
      (v_payload->>'item_id')::uuid,
      (v_payload->>'warehouse_id')::uuid,
      (v_payload->>'quantity')::numeric,
      v_work_date
    );
    v_source_ref := 'vaccination_events/' || (v_payload->>'schedule_id');

  elsif v_command_type = 'record_stock_receipt' then
    v_domain_result := public.receive_inventory_stock(
      p_actor_id,
      (v_payload->>'warehouse_id')::uuid,
      nullif(v_payload->>'item_id', '')::uuid,
      v_payload->'item',
      (v_payload->>'quantity')::numeric,
      (v_payload->>'unit_cost')::numeric,
      v_work_date,
      coalesce(nullif(v_payload->'details'->>'procurement_type', ''), 'local')::public.procurement_type,
      nullif(btrim(v_payload->'details'->>'supplier_name'), ''),
      nullif(btrim(v_payload->'details'->>'invoice_number'), ''),
      nullif(btrim(v_payload->'details'->>'notes'), ''),
      v_command_id::text
    );
    v_source_ref := 'stock_ledger/' || (v_domain_result->>'movement_id');

  elsif v_command_type = 'record_sale' then
    if coalesce((v_payload->>'quantity')::numeric, 0) <= 0
       or coalesce((v_payload->>'unit_price')::numeric, -1) < 0
       or nullif(btrim(v_payload->>'product_label'), '') is null
       or coalesce(v_payload->>'product_category', '') not in ('egg','bird','training','equipment_medicine','consultancy','package') then
      raise exception 'A supported product, positive quantity, and valid price are required.' using errcode = '22023';
    end if;
    insert into public.daily_sales_records(
      org_id, branch_id, farm_id, house_id, flock_id, batch_id, sale_date,
      product_category, product_label, quantity, unit, unit_price, gross_amount,
      paid_amount, balance_due, payment_method, customer_name, customer_phone, notes, recorded_by
    ) values (
      v_org_id, v_branch_id, v_farm_id, v_house_id, v_flock_id, v_batch_id, v_work_date,
      v_payload->>'product_category', btrim(v_payload->>'product_label'),
      (v_payload->>'quantity')::numeric, coalesce(nullif(btrim(v_payload->>'unit'), ''), 'unit'),
      (v_payload->>'unit_price')::numeric,
      round((v_payload->>'quantity')::numeric * (v_payload->>'unit_price')::numeric, 2),
      coalesce((v_payload->>'paid_amount')::numeric, 0),
      round(((v_payload->>'quantity')::numeric * (v_payload->>'unit_price')::numeric) - coalesce((v_payload->>'paid_amount')::numeric, 0), 2),
      nullif(btrim(v_payload->>'payment_method'), ''), nullif(btrim(v_payload->>'customer_name'), ''),
      nullif(btrim(v_payload->>'customer_phone'), ''), nullif(btrim(v_payload->>'notes'), ''), p_actor_id
    ) returning id into v_row_id;
    v_domain_result := jsonb_build_object('sale_id', v_row_id);
    v_source_ref := 'daily_sales_records/' || v_row_id::text;

  elsif v_command_type = 'record_expense' then
    if coalesce((v_payload->>'amount')::numeric, 0) <= 0
       or nullif(btrim(v_payload->>'description'), '') is null
       or coalesce(v_payload->>'category', '') not in ('feed','medicine','vaccine','vitamin','supplement','payroll','utility','biosecurity','transport','maintenance','labor','rent','packaging','miscellaneous') then
      raise exception 'A valid category, description, and positive amount are required.' using errcode = '22023';
    end if;
    v_warehouse_id := nullif(v_payload->>'warehouse_id', '')::uuid;
    if v_warehouse_id is not null then
      select branch_id, farm_id into v_scope from public.warehouses
      where id = v_warehouse_id and org_id = v_org_id and status = 'active';
      if not found or not exists (
        select 1 from public.user_warehouse_access a
        where a.org_id = v_org_id and a.profile_id = p_actor_id and a.warehouse_id = v_warehouse_id
          and a.revoked_at is null and a.starts_at <= now()
          and (a.expires_at is null or a.expires_at > now())
      ) then
        raise exception 'An active warehouse assignment is required.' using errcode = '42501';
      end if;
      v_branch_id := v_scope.branch_id;
      v_farm_id := coalesce(v_scope.farm_id, v_farm_id);
    end if;
    insert into public.cost_entries(
      org_id, branch_id, farm_id, house_id, flock_id, batch_id, entry_date,
      entry_kind, category, description, amount, allocation_method,
      supplier_name, invoice_number, reference_doc, warehouse_id, recorded_by
    ) values (
      v_org_id, v_branch_id, v_farm_id, v_house_id, v_flock_id, v_batch_id, v_work_date,
      coalesce(nullif(v_payload->>'entry_kind', ''), 'one_off'), v_payload->>'category',
      btrim(v_payload->>'description'), (v_payload->>'amount')::numeric,
      coalesce(nullif(v_payload->>'allocation_method', ''), 'direct'),
      nullif(btrim(v_payload->>'supplier_name'), ''), nullif(btrim(v_payload->>'invoice_number'), ''),
      nullif(btrim(v_payload->>'reference_doc'), ''), v_warehouse_id, p_actor_id
    ) returning id into v_row_id;
    v_domain_result := jsonb_build_object('cost_entry_id', v_row_id);
    v_source_ref := 'cost_entries/' || v_row_id::text;

  elsif v_command_type = 'update_assigned_action' then
    select * into v_action from public.operational_actions
    where id = (v_payload->>'action_id')::uuid and org_id = v_org_id for update;
    if not found or v_action.owner_id is distinct from p_actor_id then
      raise exception 'This action is not assigned to you.' using errcode = '42501';
    end if;
    v_before_status := v_action.status;
    if v_payload->>'event_type' = 'acknowledged' then
      v_after_status := 'acknowledged'; v_event_type := 'acknowledged';
      update public.operational_actions set status = v_after_status, acknowledged_by = p_actor_id, acknowledged_at = now(), updated_at = now() where id = v_action.id;
    elsif v_payload->>'event_type' = 'started' then
      v_after_status := 'in_progress'; v_event_type := 'work_started';
      update public.operational_actions set status = v_after_status, updated_at = now() where id = v_action.id;
    elsif v_payload->>'event_type' = 'completion_submitted' then
      v_after_status := 'awaiting_verification'; v_event_type := 'resolution_submitted';
      update public.operational_actions set status = v_after_status,
        resolution_summary = btrim(v_payload->>'note'), resolution_submitted_by = p_actor_id,
        resolution_submitted_at = now(), updated_at = now() where id = v_action.id;
    else
      raise exception 'Unsupported assigned action update.' using errcode = '22023';
    end if;
    insert into public.operational_action_events(
      org_id, action_id, event_type, actor_id, actor_name_snapshot, actor_role_snapshot,
      note, before_status, after_status
    ) values (
      v_org_id, v_action.id, v_event_type, p_actor_id, v_actor_name, v_role,
      btrim(v_payload->>'note'), v_before_status, v_after_status
    );
    v_domain_result := jsonb_build_object('action_id', v_action.id, 'status', v_after_status);
    v_source_ref := 'operational_actions/' || v_action.id::text;
  end if;

  v_result := jsonb_build_object(
    'command_id', v_command_id,
    'status', 'applied',
    'source_ref', v_source_ref,
    'resource_revision', public.canonical_today_payload_hash(v_domain_result),
    'operating_day_revision', public.today_resource_revision('operating_day', v_farm_id, v_work_date)
  );
  update public.client_operation_receipts set result = v_result, completed_at = now() where id = v_receipt.id;
  return v_result;
end;
$$;
