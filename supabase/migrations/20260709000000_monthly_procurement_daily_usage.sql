-- Transaction-safe procurement, stock movements, and daily-record inventory usage.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'procurement_type') then
    create type public.procurement_type as enum ('monthly', 'emergency', 'miscellaneous');
  end if;
end $$;

alter type public.inventory_category add value if not exists 'supplement';
alter type public.inventory_category add value if not exists 'miscellaneous';

alter table if exists public.stock_ledger
  add column if not exists procurement_type public.procurement_type,
  add column if not exists notes text,
  add column if not exists daily_record_id uuid references public.daily_farm_records(id) on delete cascade;

create index if not exists idx_stock_ledger_reference_doc
on public.stock_ledger(org_id, reference_doc);

create index if not exists idx_stock_ledger_item_warehouse
on public.stock_ledger(org_id, item_id, warehouse_id);

create index if not exists idx_stock_ledger_daily_record
on public.stock_ledger(daily_record_id)
where daily_record_id is not null;

-- Link any rows created by the pre-transactional implementation before this
-- migration is applied. Invalid or deleted record references are left untouched.
update public.stock_ledger sl
set daily_record_id = substring(sl.reference_doc from 14)::uuid
where sl.daily_record_id is null
  and sl.reference_doc ~ '^DAILY_RECORD:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and exists (
    select 1
    from public.daily_farm_records dfr
    where dfr.id = substring(sl.reference_doc from 14)::uuid
      and dfr.org_id = sl.org_id
  );

create or replace function public.stock_movement_delta(
  p_transaction_type public.stock_txn_type,
  p_quantity numeric
)
returns numeric
language sql
immutable
strict
set search_path = public
as $$
  select case
    when p_transaction_type in ('issue', 'transfer_out') then -abs(p_quantity)
    when p_transaction_type = 'adjustment' then p_quantity
    else abs(p_quantity)
  end;
$$;

create or replace function public.record_inventory_movement(
  p_actor_id uuid,
  p_item_id uuid,
  p_warehouse_id uuid,
  p_transaction_type text,
  p_quantity numeric,
  p_unit_cost numeric default 0,
  p_transaction_date date default current_date,
  p_destination_warehouse_id uuid default null,
  p_branch_id uuid default null,
  p_farm_id uuid default null,
  p_house_id uuid default null,
  p_flock_id uuid default null,
  p_batch_id uuid default null,
  p_procurement_type public.procurement_type default null,
  p_supplier_name text default null,
  p_invoice_number text default null,
  p_reference_doc text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_item_cost numeric;
  v_source_branch_id uuid;
  v_destination_branch_id uuid;
  v_branch_id uuid := p_branch_id;
  v_farm_id uuid := p_farm_id;
  v_house_id uuid := p_house_id;
  v_batch_id uuid := p_batch_id;
  v_available numeric;
  v_reference text := nullif(btrim(p_reference_doc), '');
  v_out_id uuid;
  v_in_id uuid;
  v_transaction_type public.stock_txn_type;
begin
  select p.org_id, p.role::text
  into v_org_id, v_role
  from public.profiles p
  where p.id = p_actor_id;

  if v_org_id is null then
    raise exception 'User profile does not have organization access.' using errcode = '42501';
  end if;
  if v_role not in ('store_keeper', 'farm_manager', 'ceo', 'system_admin', 'super_admin') then
    raise exception 'User cannot record inventory movements.' using errcode = '42501';
  end if;

  if p_transaction_type not in ('receipt', 'issue', 'return', 'adjustment', 'transfer') then
    raise exception 'Unsupported inventory transaction type.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity = 0 or (p_transaction_type <> 'adjustment' and p_quantity < 0) then
    raise exception 'Quantity must be greater than zero; adjustments may be positive or negative.' using errcode = '22023';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative.' using errcode = '22023';
  end if;
  if p_transaction_type = 'receipt' and p_procurement_type is null then
    raise exception 'Procurement type is required for receipts.' using errcode = '22023';
  end if;
  if p_transaction_type <> 'receipt' and p_procurement_type is not null then
    raise exception 'Procurement type can only be set on receipts.' using errcode = '22023';
  end if;

  select coalesce(ii.unit_cost, 0)
  into v_item_cost
  from public.inventory_items ii
  where ii.id = p_item_id and ii.org_id = v_org_id;
  if not found then
    raise exception 'Inventory item is not available in this organization.' using errcode = '22023';
  end if;

  select w.branch_id
  into v_source_branch_id
  from public.warehouses w
  where w.id = p_warehouse_id and w.org_id = v_org_id;
  if not found then
    raise exception 'Source warehouse is not available in this organization.' using errcode = '22023';
  end if;

  if p_flock_id is not null then
    select f.farm_id, f.house_id, f.batch_id
    into v_farm_id, v_house_id, v_batch_id
    from public.flocks f
    where f.id = p_flock_id and f.org_id = v_org_id;
    if not found then
      raise exception 'Flock is not available in this organization.' using errcode = '22023';
    end if;
    if p_farm_id is not null and p_farm_id <> v_farm_id
      or p_house_id is not null and p_house_id <> v_house_id
      or p_batch_id is not null and p_batch_id <> v_batch_id then
      raise exception 'Flock, farm, house, and batch selection do not agree.' using errcode = '22023';
    end if;
  end if;

  if v_house_id is not null then
    if not exists (
      select 1 from public.houses h
      where h.id = v_house_id and h.org_id = v_org_id
        and (v_farm_id is null or h.farm_id = v_farm_id)
        and (v_branch_id is null or h.branch_id = v_branch_id)
    ) then
      raise exception 'House does not belong to the selected farm and branch.' using errcode = '22023';
    end if;
    select h.farm_id, h.branch_id
    into v_farm_id, v_branch_id
    from public.houses h
    where h.id = v_house_id and h.org_id = v_org_id;
    if not found then
      raise exception 'House is not available in this organization.' using errcode = '22023';
    end if;
  end if;

  if v_farm_id is not null then
    if not exists (
      select 1 from public.farms f
      where f.id = v_farm_id and f.org_id = v_org_id
        and (v_branch_id is null or f.branch_id = v_branch_id)
    ) then
      raise exception 'Farm does not belong to the selected branch.' using errcode = '22023';
    end if;
    select f.branch_id
    into v_branch_id
    from public.farms f
    where f.id = v_farm_id and f.org_id = v_org_id;
    if not found then
      raise exception 'Farm is not available in this organization.' using errcode = '22023';
    end if;
  end if;

  if v_batch_id is not null and not exists (
    select 1 from public.batches b
    where b.id = v_batch_id and b.org_id = v_org_id
      and (v_farm_id is null or b.farm_id = v_farm_id)
      and (v_house_id is null or b.house_id = v_house_id)
  ) then
    raise exception 'Batch is not available for the selected farm and house.' using errcode = '22023';
  end if;

  v_branch_id := coalesce(v_branch_id, v_source_branch_id);
  if v_branch_id <> v_source_branch_id then
    raise exception 'Source warehouse must belong to the selected branch.' using errcode = '22023';
  end if;

  if v_role = 'farm_manager' and not (
    exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p_actor_id and ufa.farm_id = v_farm_id)
    or exists (select 1 from public.user_branch_access uba where uba.profile_id = p_actor_id and uba.branch_id = v_branch_id)
  ) then
    raise exception 'User does not have access to this inventory scope.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || p_warehouse_id::text, 0));

  if p_transaction_type = 'transfer' then
    if p_destination_warehouse_id is null or p_destination_warehouse_id = p_warehouse_id then
      raise exception 'Select a different destination warehouse for a transfer.' using errcode = '22023';
    end if;
    select w.branch_id into v_destination_branch_id
    from public.warehouses w
    where w.id = p_destination_warehouse_id and w.org_id = v_org_id;
    if not found then
      raise exception 'Destination warehouse is not available in this organization.' using errcode = '22023';
    end if;
    if v_role = 'farm_manager' and not (
      exists (
        select 1 from public.user_branch_access uba
        where uba.profile_id = p_actor_id and uba.branch_id = v_destination_branch_id
      )
      or exists (
        select 1
        from public.user_farm_access ufa
        join public.farms f on f.id = ufa.farm_id and f.org_id = v_org_id
        where ufa.profile_id = p_actor_id and f.branch_id = v_destination_branch_id
      )
    ) then
      raise exception 'User does not have access to the destination warehouse.' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || p_destination_warehouse_id::text, 0));
    v_reference := coalesce(v_reference, 'TRANSFER:' || gen_random_uuid()::text);
  end if;

  if p_transaction_type in ('issue', 'transfer') or (p_transaction_type = 'adjustment' and p_quantity < 0) then
    select coalesce(sum(public.stock_movement_delta(sl.transaction_type, sl.quantity)), 0)
    into v_available
    from public.stock_ledger sl
    where sl.org_id = v_org_id
      and sl.item_id = p_item_id
      and sl.warehouse_id = p_warehouse_id;
    if v_available < abs(p_quantity) then
      raise exception 'Insufficient stock. Available quantity is %.', v_available using errcode = '22023';
    end if;
  end if;

  if p_transaction_type = 'transfer' then
    insert into public.stock_ledger (
      org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
      transaction_date, branch_id, reference_doc, notes, recorded_by
    ) values (
      v_org_id, p_item_id, p_warehouse_id, 'transfer_out', abs(p_quantity),
      coalesce(nullif(p_unit_cost, 0), v_item_cost), p_transaction_date,
      v_source_branch_id, v_reference, nullif(btrim(p_notes), ''), p_actor_id
    ) returning id into v_out_id;

    insert into public.stock_ledger (
      org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
      transaction_date, branch_id, reference_doc, notes, recorded_by
    ) values (
      v_org_id, p_item_id, p_destination_warehouse_id, 'transfer_in', abs(p_quantity),
      coalesce(nullif(p_unit_cost, 0), v_item_cost), p_transaction_date,
      v_destination_branch_id, v_reference, nullif(btrim(p_notes), ''), p_actor_id
    ) returning id into v_in_id;

    return jsonb_build_object('movement_id', v_out_id, 'paired_movement_id', v_in_id, 'reference_doc', v_reference);
  end if;

  v_transaction_type := p_transaction_type::public.stock_txn_type;
  insert into public.stock_ledger (
    org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
    transaction_date, flock_id, batch_id, branch_id, farm_id, house_id,
    supplier_name, invoice_number, procurement_type, notes, reference_doc, recorded_by
  ) values (
    v_org_id, p_item_id, p_warehouse_id, v_transaction_type, p_quantity,
    coalesce(nullif(p_unit_cost, 0), v_item_cost), p_transaction_date,
    p_flock_id, v_batch_id, v_branch_id, v_farm_id, v_house_id,
    nullif(btrim(p_supplier_name), ''), nullif(btrim(p_invoice_number), ''),
    p_procurement_type, nullif(btrim(p_notes), ''), v_reference, p_actor_id
  ) returning id into v_out_id;

  return jsonb_build_object('movement_id', v_out_id, 'reference_doc', v_reference);
end;
$$;

create or replace function public.save_daily_record_with_usage(
  p_actor_id uuid,
  p_daily_record_id uuid,
  p_flock_id uuid,
  p_record jsonb,
  p_usages jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_farm_id uuid;
  v_house_id uuid;
  v_batch_id uuid;
  v_branch_id uuid;
  v_record_id uuid;
  v_record_date date;
  v_feed_type public.feed_type;
  v_usage jsonb;
  v_item_id uuid;
  v_warehouse_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_item_cost numeric;
  v_category text;
  v_warehouse_branch_id uuid;
  v_available numeric;
begin
  select p.org_id, p.role::text into v_org_id, v_role
  from public.profiles p where p.id = p_actor_id;
  if v_org_id is null or v_role <> 'farm_manager' then
    raise exception 'Only farm managers can save daily records.' using errcode = '42501';
  end if;

  select f.farm_id, f.house_id, f.batch_id, h.branch_id
  into v_farm_id, v_house_id, v_batch_id, v_branch_id
  from public.flocks f
  join public.houses h on h.id = f.house_id and h.org_id = f.org_id
  where f.id = p_flock_id and f.org_id = v_org_id;
  if not found then
    raise exception 'Flock is not available in this organization.' using errcode = '22023';
  end if;
  if not (
    exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p_actor_id and ufa.farm_id = v_farm_id)
    or exists (select 1 from public.user_branch_access uba where uba.profile_id = p_actor_id and uba.branch_id = v_branch_id)
  ) then
    raise exception 'User does not have access to this flock.' using errcode = '42501';
  end if;

  v_record_date := nullif(p_record->>'record_date', '')::date;
  if v_record_date is null then
    raise exception 'Record date is required.' using errcode = '22023';
  end if;
  if nullif(p_record->>'feed_type', '') is not null then
    v_feed_type := (p_record->>'feed_type')::public.feed_type;
  end if;

  if p_daily_record_id is not null then
    update public.daily_farm_records dfr set
      flock_id = p_flock_id,
      record_date = v_record_date,
      flock_age_weeks = nullif(p_record->>'flock_age_weeks', '')::integer,
      flock_age_days = nullif(p_record->>'flock_age_days', '')::integer,
      feed_intake_grams = nullif(p_record->>'feed_intake_grams', '')::numeric,
      feed_intake_quantity = nullif(p_record->>'feed_intake_quantity', '')::numeric,
      feed_leftover_grams = nullif(p_record->>'feed_leftover_grams', '')::numeric,
      feed_type = v_feed_type,
      normal_eggs = nullif(p_record->>'normal_eggs', '')::integer,
      broken_eggs = nullif(p_record->>'broken_eggs', '')::integer,
      total_eggs = nullif(p_record->>'total_eggs', '')::integer,
      production_percentage = nullif(p_record->>'production_percentage', '')::numeric,
      deaths = coalesce(nullif(p_record->>'deaths', '')::integer, 0),
      mortality_percentage = nullif(p_record->>'mortality_percentage', '')::numeric,
      deaths_cause = nullif(btrim(p_record->>'deaths_cause'), ''),
      vaccination_status = nullif(btrim(p_record->>'vaccination_status'), ''),
      medication_vitamins = nullif(btrim(p_record->>'medication_vitamins'), ''),
      recorded_by = p_actor_id,
      updated_at = now()
    where dfr.id = p_daily_record_id and dfr.org_id = v_org_id and dfr.flock_id = p_flock_id
    returning dfr.id into v_record_id;
    if v_record_id is null then
      raise exception 'Daily record is not available in this organization.' using errcode = '22023';
    end if;
  else
    insert into public.daily_farm_records (
      org_id, flock_id, record_date, flock_age_weeks, flock_age_days,
      feed_intake_grams, feed_intake_quantity, feed_leftover_grams, feed_type,
      normal_eggs, broken_eggs, total_eggs, production_percentage, deaths,
      mortality_percentage, deaths_cause, vaccination_status, medication_vitamins, recorded_by
    ) values (
      v_org_id, p_flock_id, v_record_date,
      nullif(p_record->>'flock_age_weeks', '')::integer,
      nullif(p_record->>'flock_age_days', '')::integer,
      nullif(p_record->>'feed_intake_grams', '')::numeric,
      nullif(p_record->>'feed_intake_quantity', '')::numeric,
      nullif(p_record->>'feed_leftover_grams', '')::numeric,
      v_feed_type,
      nullif(p_record->>'normal_eggs', '')::integer,
      nullif(p_record->>'broken_eggs', '')::integer,
      nullif(p_record->>'total_eggs', '')::integer,
      nullif(p_record->>'production_percentage', '')::numeric,
      coalesce(nullif(p_record->>'deaths', '')::integer, 0),
      nullif(p_record->>'mortality_percentage', '')::numeric,
      nullif(btrim(p_record->>'deaths_cause'), ''),
      nullif(btrim(p_record->>'vaccination_status'), ''),
      nullif(btrim(p_record->>'medication_vitamins'), ''),
      p_actor_id
    )
    on conflict (org_id, flock_id, record_date) do update set
      flock_age_weeks = excluded.flock_age_weeks,
      flock_age_days = excluded.flock_age_days,
      feed_intake_grams = excluded.feed_intake_grams,
      feed_intake_quantity = excluded.feed_intake_quantity,
      feed_leftover_grams = excluded.feed_leftover_grams,
      feed_type = excluded.feed_type,
      normal_eggs = excluded.normal_eggs,
      broken_eggs = excluded.broken_eggs,
      total_eggs = excluded.total_eggs,
      production_percentage = excluded.production_percentage,
      deaths = excluded.deaths,
      mortality_percentage = excluded.mortality_percentage,
      deaths_cause = excluded.deaths_cause,
      vaccination_status = excluded.vaccination_status,
      medication_vitamins = excluded.medication_vitamins,
      recorded_by = excluded.recorded_by,
      updated_at = now()
    returning id into v_record_id;
  end if;

  -- Lock and validate aggregate usage before replacing existing issues. Because
  -- this is one function, any validation or insert failure rolls back the record too.
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_usages, '[]'::jsonb))
      as x(item_id uuid, warehouse_id uuid, quantity numeric, unit_cost numeric, notes text)
    where x.item_id is null or x.warehouse_id is null or x.quantity is null or x.quantity <= 0
      or coalesce(x.unit_cost, 0) < 0
  ) then
    raise exception 'Every daily usage needs an item, warehouse, positive quantity, and non-negative cost.' using errcode = '22023';
  end if;

  for v_usage in
    select jsonb_build_object(
      'item_id', x.item_id,
      'warehouse_id', x.warehouse_id,
      'quantity', sum(x.quantity),
      'unit_cost', max(x.unit_cost),
      'notes', string_agg(nullif(btrim(x.notes), ''), '; ')
    )
    from jsonb_to_recordset(coalesce(p_usages, '[]'::jsonb))
      as x(item_id uuid, warehouse_id uuid, quantity numeric, unit_cost numeric, notes text)
    group by x.item_id, x.warehouse_id
    order by x.item_id, x.warehouse_id
  loop
    v_item_id := (v_usage->>'item_id')::uuid;
    v_warehouse_id := (v_usage->>'warehouse_id')::uuid;
    v_quantity := (v_usage->>'quantity')::numeric;
    v_unit_cost := coalesce(nullif(v_usage->>'unit_cost', '')::numeric, 0);
    if v_quantity <= 0 then
      raise exception 'Daily usage quantity must be greater than zero.' using errcode = '22023';
    end if;

    select ii.category::text, coalesce(ii.unit_cost, 0)
    into v_category, v_item_cost
    from public.inventory_items ii
    where ii.id = v_item_id and ii.org_id = v_org_id;
    if not found or v_category not in ('feed', 'medicine', 'vaccine', 'vitamin', 'supplement', 'packaging') then
      raise exception 'Daily usage item is unavailable or has an unsupported category.' using errcode = '22023';
    end if;

    select w.branch_id into v_warehouse_branch_id
    from public.warehouses w
    where w.id = v_warehouse_id and w.org_id = v_org_id;
    if not found or v_warehouse_branch_id <> v_branch_id then
      raise exception 'Daily usage warehouse must belong to the flock branch.' using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_item_id::text || ':' || v_warehouse_id::text, 0));
    select coalesce(sum(public.stock_movement_delta(sl.transaction_type, sl.quantity)), 0)
    into v_available
    from public.stock_ledger sl
    where sl.org_id = v_org_id and sl.item_id = v_item_id and sl.warehouse_id = v_warehouse_id
      and sl.daily_record_id is distinct from v_record_id;
    if v_available < v_quantity then
      raise exception 'Insufficient stock for daily usage. Available quantity is %.', v_available using errcode = '22023';
    end if;
  end loop;

  delete from public.stock_ledger sl
  where sl.org_id = v_org_id and sl.daily_record_id = v_record_id;

  insert into public.stock_ledger (
    org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
    transaction_date, flock_id, batch_id, branch_id, farm_id, house_id,
    notes, reference_doc, daily_record_id, recorded_by
  )
  select
    v_org_id, x.item_id, x.warehouse_id, 'issue', sum(x.quantity),
    coalesce(nullif(max(x.unit_cost), 0), max(ii.unit_cost), 0), v_record_date,
    p_flock_id, v_batch_id, v_branch_id, v_farm_id, v_house_id,
    string_agg(nullif(btrim(x.notes), ''), '; '), 'DAILY_RECORD:' || v_record_id::text,
    v_record_id, p_actor_id
  from jsonb_to_recordset(coalesce(p_usages, '[]'::jsonb))
    as x(item_id uuid, warehouse_id uuid, quantity numeric, unit_cost numeric, notes text)
  join public.inventory_items ii on ii.id = x.item_id and ii.org_id = v_org_id
  group by x.item_id, x.warehouse_id;

  return jsonb_build_object(
    'daily_record_id', v_record_id,
    'usage_count', jsonb_array_length(coalesce(p_usages, '[]'::jsonb))
  );
end;
$$;

revoke all on function public.record_inventory_movement(uuid, uuid, uuid, text, numeric, numeric, date, uuid, uuid, uuid, uuid, uuid, uuid, public.procurement_type, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_inventory_movement(uuid, uuid, uuid, text, numeric, numeric, date, uuid, uuid, uuid, uuid, uuid, uuid, public.procurement_type, text, text, text, text) to service_role;

revoke all on function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb) to service_role;
