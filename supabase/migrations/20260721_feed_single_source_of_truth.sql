-- Feed Control is the single source of truth for feed intake and feed inventory.
-- Daily Records remains the canonical flock-day row for all other observations.

create or replace function public.save_daily_record_with_usage(
  p_actor_id uuid,
  p_daily_record_id uuid,
  p_flock_id uuid,
  p_record jsonb,
  p_usages jsonb default null
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
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'Actor does not match the authenticated user.' using errcode = '42501';
  end if;

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
    exists (select 1 from public.user_farm_access a where a.profile_id = p_actor_id and a.farm_id = v_farm_id)
    or exists (select 1 from public.user_branch_access a where a.profile_id = p_actor_id and a.branch_id = v_branch_id)
  ) then
    raise exception 'User does not have access to this flock.' using errcode = '42501';
  end if;

  if nullif(p_record->>'feed_intake_grams', '') is not null
    or nullif(p_record->>'feed_intake_quantity', '') is not null
    or nullif(p_record->>'feed_type', '') is not null then
    raise exception 'Record feed intake and feed type in Today''s Feeding, then close the feeding day.' using errcode = '22023';
  end if;
  if p_usages is not null and jsonb_typeof(p_usages) <> 'array' then
    raise exception 'Inventory usages must be an array or null.' using errcode = '22023';
  end if;

  v_record_date := nullif(p_record->>'record_date', '')::date;
  if v_record_date is null then
    raise exception 'Record date is required.' using errcode = '22023';
  end if;

  if p_daily_record_id is not null then
    if exists (
      select 1
      from public.daily_farm_records dfr
      join public.feed_day_closures c on c.org_id = dfr.org_id and c.flock_id = dfr.flock_id
        and c.record_date = dfr.record_date and c.status = 'closed'
      where dfr.id = p_daily_record_id and dfr.org_id = v_org_id and dfr.record_date <> v_record_date
    ) then
      raise exception 'Reopen the feeding day before changing this Daily Record date.' using errcode = '55000';
    end if;
    update public.daily_farm_records dfr set
      record_date = v_record_date,
      flock_age_weeks = nullif(p_record->>'flock_age_weeks', '')::integer,
      flock_age_days = nullif(p_record->>'flock_age_days', '')::integer,
      feed_leftover_grams = nullif(p_record->>'feed_leftover_grams', '')::numeric,
      normal_eggs = nullif(p_record->>'normal_eggs', '')::integer,
      broken_eggs = nullif(p_record->>'broken_eggs', '')::integer,
      dirty_eggs = nullif(p_record->>'dirty_eggs', '')::integer,
      total_eggs = nullif(p_record->>'total_eggs', '')::integer,
      average_egg_weight_g = nullif(p_record->>'average_egg_weight_g', '')::numeric,
      production_percentage = nullif(p_record->>'production_percentage', '')::numeric,
      deaths = coalesce(nullif(p_record->>'deaths', '')::integer, 0),
      mortality_percentage = nullif(p_record->>'mortality_percentage', '')::numeric,
      deaths_cause = nullif(btrim(p_record->>'deaths_cause'), ''),
      vaccination_status = nullif(btrim(p_record->>'vaccination_status'), ''),
      medication_vitamins = nullif(btrim(p_record->>'medication_vitamins'), ''),
      opening_birds = nullif(p_record->>'opening_birds', '')::integer,
      closing_birds = nullif(p_record->>'closing_birds', '')::integer,
      culls = coalesce(nullif(p_record->>'culls', '')::integer, 0),
      transfers_in = coalesce(nullif(p_record->>'transfers_in', '')::integer, 0),
      transfers_out = coalesce(nullif(p_record->>'transfers_out', '')::integer, 0),
      other_removals = coalesce(nullif(p_record->>'other_removals', '')::integer, 0),
      water_consumed_liters = nullif(p_record->>'water_consumed_liters', '')::numeric,
      recorded_by = p_actor_id,
      updated_at = now()
    where dfr.id = p_daily_record_id and dfr.org_id = v_org_id and dfr.flock_id = p_flock_id
    returning dfr.id into v_record_id;
    if v_record_id is null then
      raise exception 'Daily record is not available in this organization.' using errcode = '22023';
    end if;
  else
    insert into public.daily_farm_records (
      org_id, flock_id, record_date, flock_age_weeks, flock_age_days, feed_leftover_grams,
      normal_eggs, broken_eggs, dirty_eggs, total_eggs, average_egg_weight_g,
      production_percentage, deaths, mortality_percentage, deaths_cause,
      vaccination_status, medication_vitamins, opening_birds, closing_birds, culls,
      transfers_in, transfers_out, other_removals, water_consumed_liters, recorded_by
    ) values (
      v_org_id, p_flock_id, v_record_date,
      nullif(p_record->>'flock_age_weeks', '')::integer,
      nullif(p_record->>'flock_age_days', '')::integer,
      nullif(p_record->>'feed_leftover_grams', '')::numeric,
      nullif(p_record->>'normal_eggs', '')::integer,
      nullif(p_record->>'broken_eggs', '')::integer,
      nullif(p_record->>'dirty_eggs', '')::integer,
      nullif(p_record->>'total_eggs', '')::integer,
      nullif(p_record->>'average_egg_weight_g', '')::numeric,
      nullif(p_record->>'production_percentage', '')::numeric,
      coalesce(nullif(p_record->>'deaths', '')::integer, 0),
      nullif(p_record->>'mortality_percentage', '')::numeric,
      nullif(btrim(p_record->>'deaths_cause'), ''),
      nullif(btrim(p_record->>'vaccination_status'), ''),
      nullif(btrim(p_record->>'medication_vitamins'), ''),
      nullif(p_record->>'opening_birds', '')::integer,
      nullif(p_record->>'closing_birds', '')::integer,
      coalesce(nullif(p_record->>'culls', '')::integer, 0),
      coalesce(nullif(p_record->>'transfers_in', '')::integer, 0),
      coalesce(nullif(p_record->>'transfers_out', '')::integer, 0),
      coalesce(nullif(p_record->>'other_removals', '')::integer, 0),
      nullif(p_record->>'water_consumed_liters', '')::numeric,
      p_actor_id
    )
    on conflict (org_id, flock_id, record_date) do update set
      flock_age_weeks = excluded.flock_age_weeks,
      flock_age_days = excluded.flock_age_days,
      feed_leftover_grams = excluded.feed_leftover_grams,
      normal_eggs = excluded.normal_eggs,
      broken_eggs = excluded.broken_eggs,
      dirty_eggs = excluded.dirty_eggs,
      total_eggs = excluded.total_eggs,
      average_egg_weight_g = excluded.average_egg_weight_g,
      production_percentage = excluded.production_percentage,
      deaths = excluded.deaths,
      mortality_percentage = excluded.mortality_percentage,
      deaths_cause = excluded.deaths_cause,
      vaccination_status = excluded.vaccination_status,
      medication_vitamins = excluded.medication_vitamins,
      opening_birds = excluded.opening_birds,
      closing_birds = excluded.closing_birds,
      culls = excluded.culls,
      transfers_in = excluded.transfers_in,
      transfers_out = excluded.transfers_out,
      other_removals = excluded.other_removals,
      water_consumed_liters = excluded.water_consumed_liters,
      recorded_by = excluded.recorded_by,
      updated_at = now()
    returning id into v_record_id;
  end if;

  -- Null means an edit that preserves existing non-feed usage. An array explicitly
  -- replaces Daily Records-owned usage; Feed Control-owned rows are never touched.
  if p_usages is not null then
    if exists (
      select 1
      from jsonb_to_recordset(p_usages)
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
      from jsonb_to_recordset(p_usages)
        as x(item_id uuid, warehouse_id uuid, quantity numeric, unit_cost numeric, notes text)
      group by x.item_id, x.warehouse_id
      order by x.item_id, x.warehouse_id
    loop
      v_item_id := (v_usage->>'item_id')::uuid;
      v_warehouse_id := (v_usage->>'warehouse_id')::uuid;
      v_quantity := (v_usage->>'quantity')::numeric;
      v_unit_cost := coalesce(nullif(v_usage->>'unit_cost', '')::numeric, 0);

      select ii.category::text, coalesce(ii.unit_cost, 0)
      into v_category, v_item_cost
      from public.inventory_items ii
      where ii.id = v_item_id and ii.org_id = v_org_id;
      if not found or v_category not in ('medicine', 'vaccine', 'vitamin', 'supplement', 'packaging', 'miscellaneous') then
        raise exception 'Daily Records can issue only non-feed health or operational items. Record feed in Today''s Feeding.' using errcode = '22023';
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
        and not (sl.source_kind = 'daily_record_usage' and sl.source_key = v_record_id::text);
      if v_available < v_quantity then
        raise exception 'Insufficient stock for daily usage. Available quantity is %.', v_available using errcode = '22023';
      end if;
    end loop;

    delete from public.stock_ledger sl
    where sl.org_id = v_org_id
      and sl.source_kind = 'daily_record_usage'
      and sl.source_key = v_record_id::text;

    insert into public.stock_ledger (
      org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
      transaction_date, flock_id, batch_id, branch_id, farm_id, house_id,
      notes, reference_doc, daily_record_id, recorded_by, source_kind, source_key
    )
    select
      v_org_id, x.item_id, x.warehouse_id, 'issue', sum(x.quantity),
      coalesce(nullif(max(x.unit_cost), 0), max(ii.unit_cost), 0), v_record_date,
      p_flock_id, v_batch_id, v_branch_id, v_farm_id, v_house_id,
      string_agg(nullif(btrim(x.notes), ''), '; '), 'DAILY_RECORD:' || v_record_id::text,
      v_record_id, p_actor_id, 'daily_record_usage', v_record_id::text
    from jsonb_to_recordset(p_usages)
      as x(item_id uuid, warehouse_id uuid, quantity numeric, unit_cost numeric, notes text)
    join public.inventory_items ii on ii.id = x.item_id and ii.org_id = v_org_id
    group by x.item_id, x.warehouse_id;
  end if;

  return jsonb_build_object(
    'daily_record_id', v_record_id,
    'usage_count', case when p_usages is null then null else jsonb_array_length(p_usages) end,
    'usage_preserved', p_usages is null
  );
end;
$$;

revoke all on function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb) to service_role;

create or replace function public.close_feed_day(
  p_actor_id uuid,
  p_flock_id uuid,
  p_record_date date,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid; v_role text; v_batch_id uuid; v_farm_id uuid; v_house_id uuid; v_branch_id uuid;
  v_actual numeric; v_planned numeric; v_incomplete integer; v_daily_id uuid; v_feed_type public.feed_type;
  v_group record; v_available numeric; v_source_key text := p_flock_id::text || ':' || p_record_date::text; v_closure_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'Actor does not match the authenticated user.' using errcode = '42501';
  end if;
  select p.org_id, p.role::text into v_org_id, v_role from public.profiles p where p.id = p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager', 'ceo', 'system_admin', 'super_admin') then
    raise exception 'User cannot close a feeding day.' using errcode = '42501';
  end if;
  select f.batch_id, f.farm_id, f.house_id, fa.branch_id into v_batch_id, v_farm_id, v_house_id, v_branch_id
  from public.flocks f join public.farms fa on fa.id = f.farm_id
  where f.id = p_flock_id and f.org_id = v_org_id;
  if v_batch_id is null then raise exception 'Flock is not linked to a batch.' using errcode = '22023'; end if;
  if v_role = 'farm_manager' and not (
    exists(select 1 from public.user_farm_access a where a.profile_id = p_actor_id and a.farm_id = v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id = p_actor_id and a.branch_id = v_branch_id)
  ) then raise exception 'User does not have access to this flock.' using errcode = '42501'; end if;

  select count(*) filter(where status <> 'completed' or actual_feed_kg is null),
    coalesce(sum(actual_feed_kg), 0), coalesce(sum(planned_feed_kg), 0)
  into v_incomplete, v_actual, v_planned
  from public.feeding_session_records
  where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date;
  if not exists(select 1 from public.feeding_session_records where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date) then
    raise exception 'Add at least one feeding session before closing the day.' using errcode = '22023';
  end if;
  if v_incomplete > 0 then raise exception 'Complete or mark every feeding session before closing the day.' using errcode = '22023'; end if;
  select s.feed_type into v_feed_type from public.feeding_session_records s
  where s.org_id = v_org_id and s.flock_id = p_flock_id and s.record_date = p_record_date and s.feed_type is not null
  order by s.session_time desc nulls last limit 1;
  select dfr.id into v_daily_id from public.daily_farm_records dfr
  where dfr.org_id = v_org_id and dfr.flock_id = p_flock_id and dfr.record_date = p_record_date;

  for v_group in
    select feed_item_id, warehouse_id, sum(actual_feed_kg) quantity
    from public.feeding_session_records
    where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date and actual_feed_kg > 0
    group by feed_item_id, warehouse_id
  loop
    if v_group.feed_item_id is null or v_group.warehouse_id is null then
      raise exception 'Every completed session needs a feed item and warehouse.' using errcode = '22023';
    end if;
    if not exists(select 1 from public.inventory_items i where i.id = v_group.feed_item_id and i.org_id = v_org_id and i.category = 'feed' and lower(i.unit) in ('kg','kilogram','kilograms')) then
      raise exception 'Feed inventory must be recorded in kilograms before the feeding day can close.' using errcode = '22023';
    end if;
    if not exists(select 1 from public.warehouses w where w.id = v_group.warehouse_id and w.org_id = v_org_id and w.branch_id = v_branch_id) then
      raise exception 'Feed warehouse is outside the flock branch.' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_group.feed_item_id::text || ':' || v_group.warehouse_id::text, 0));
    select coalesce(sum(public.stock_movement_delta(sl.transaction_type, sl.quantity)), 0) into v_available
    from public.stock_ledger sl
    where sl.org_id = v_org_id and sl.item_id = v_group.feed_item_id and sl.warehouse_id = v_group.warehouse_id
      and not (sl.source_kind = 'feed_day_close' and sl.source_key = v_source_key)
      and not (v_daily_id is not null and sl.daily_record_id = v_daily_id and coalesce(sl.source_kind, 'daily_record_usage') = 'daily_record_usage');
    if v_available < v_group.quantity and nullif(btrim(p_override_reason), '') is null then
      raise exception 'Insufficient feed stock. Record a receipt or provide an authorized override reason.' using errcode = '22023';
    end if;
  end loop;

  insert into public.daily_farm_records(org_id, flock_id, record_date, feed_intake_grams, feed_intake_quantity, feed_type, recorded_by, synced)
  values(v_org_id, p_flock_id, p_record_date, round(v_actual * 1000), v_actual, v_feed_type, p_actor_id, true)
  on conflict(org_id, flock_id, record_date) do update set
    feed_intake_grams = excluded.feed_intake_grams,
    feed_intake_quantity = excluded.feed_intake_quantity,
    feed_type = coalesce(excluded.feed_type, public.daily_farm_records.feed_type),
    recorded_by = excluded.recorded_by, synced = true, updated_at = now()
  returning id into v_daily_id;

  -- Once Feed Control claims a day, discard only legacy/manual feed issues for
  -- that daily record. Health and other Daily Records usage is retained.
  delete from public.stock_ledger sl
  using public.inventory_items i
  where sl.org_id = v_org_id and sl.daily_record_id = v_daily_id
    and sl.item_id = i.id and i.org_id = v_org_id and i.category = 'feed'
    and not (sl.source_kind = 'feed_day_close' and sl.source_key = v_source_key);

  insert into public.feed_day_closures(org_id, batch_id, flock_id, record_date, status, planned_feed_kg, actual_feed_kg, variance_kg, override_reason, closed_by, closed_at, reopened_by, reopened_at, reopen_reason)
  values(v_org_id, v_batch_id, p_flock_id, p_record_date, 'closed', v_planned, v_actual, v_actual-v_planned, nullif(btrim(p_override_reason), ''), p_actor_id, now(), null, null, null)
  on conflict(org_id, flock_id, record_date) do update set status = 'closed', planned_feed_kg = excluded.planned_feed_kg,
    actual_feed_kg = excluded.actual_feed_kg, variance_kg = excluded.variance_kg, override_reason = excluded.override_reason,
    closed_by = excluded.closed_by, closed_at = excluded.closed_at, reopened_by = null, reopened_at = null, reopen_reason = null, updated_at = now()
  returning id into v_closure_id;

  delete from public.stock_ledger where org_id = v_org_id and source_kind = 'feed_day_close' and source_key = v_source_key;
  insert into public.stock_ledger(org_id, item_id, warehouse_id, quantity, transaction_type, unit_cost, transaction_date, branch_id, farm_id, house_id, flock_id, batch_id, daily_record_id, recorded_by, reference_doc, notes, source_kind, source_key)
  select v_org_id, s.feed_item_id, s.warehouse_id, sum(s.actual_feed_kg), 'issue', coalesce(i.unit_cost, 0), p_record_date,
    v_branch_id, v_farm_id, v_house_id, p_flock_id, v_batch_id, v_daily_id, p_actor_id, 'FEED_CLOSE:' || v_source_key,
    'Feed Control daily close', 'feed_day_close', v_source_key
  from public.feeding_session_records s join public.inventory_items i on i.id = s.feed_item_id
  where s.org_id = v_org_id and s.flock_id = p_flock_id and s.record_date = p_record_date and s.actual_feed_kg > 0
  group by s.feed_item_id, s.warehouse_id, i.unit_cost;

  return jsonb_build_object('closure_id', v_closure_id, 'daily_record_id', v_daily_id, 'actual_feed_kg', v_actual, 'planned_feed_kg', v_planned, 'variance_kg', v_actual-v_planned);
end;
$$;

create or replace function public.reopen_feed_day(p_actor_id uuid, p_flock_id uuid, p_record_date date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org_id uuid; v_role text; v_farm_id uuid; v_branch_id uuid; v_source_key text := p_flock_id::text || ':' || p_record_date::text;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then raise exception 'Actor does not match the authenticated user.' using errcode = '42501'; end if;
  select p.org_id, p.role::text into v_org_id, v_role from public.profiles p where p.id = p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','ceo','system_admin','super_admin') then raise exception 'User cannot reopen a feeding day.' using errcode = '42501'; end if;
  select f.farm_id, fa.branch_id into v_farm_id, v_branch_id from public.flocks f join public.farms fa on fa.id = f.farm_id
  where f.id = p_flock_id and f.org_id = v_org_id;
  if not found then raise exception 'Flock is not available in this organization.' using errcode = '22023'; end if;
  if v_role = 'farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id = p_actor_id and a.farm_id = v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id = p_actor_id and a.branch_id = v_branch_id)) then
    raise exception 'User does not have access to this flock.' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'A reopen reason is required.' using errcode = '22023'; end if;
  update public.feed_day_closures set status = 'reopened', reopened_by = p_actor_id, reopened_at = now(), reopen_reason = btrim(p_reason), updated_at = now()
  where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date and status = 'closed';
  if not found then raise exception 'Closed feeding day was not found.' using errcode = '22023'; end if;
  delete from public.stock_ledger where org_id = v_org_id and source_kind = 'feed_day_close' and source_key = v_source_key;
  update public.daily_farm_records set feed_intake_grams = null, feed_intake_quantity = null, feed_type = null, synced = false, updated_at = now()
  where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date;
  return jsonb_build_object('status', 'reopened');
end;
$$;

grant execute on function public.close_feed_day(uuid, uuid, date, text) to authenticated;
grant execute on function public.reopen_feed_day(uuid, uuid, date, text) to authenticated;

-- Protect a canonical closed flock-day from direct client deletion.
create or replace function public.prevent_closed_feed_day_record_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.feed_day_closures c
    where c.org_id = old.org_id and c.flock_id = old.flock_id
      and c.record_date = old.record_date and c.status = 'closed'
  ) then
    raise exception 'Reopen the feeding day before deleting this daily record.' using errcode = '55000';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_closed_feed_day_record_delete on public.daily_farm_records;
create trigger prevent_closed_feed_day_record_delete
before delete on public.daily_farm_records
for each row execute function public.prevent_closed_feed_day_record_delete();

-- Consolidate legacy rows before assigning the generated-source key, whose
-- uniqueness is one row per daily record, item, and warehouse.
with grouped as (
  select min(id::text)::uuid keep_id, daily_record_id, item_id, warehouse_id,
    sum(quantity) quantity, max(unit_cost) unit_cost
  from public.stock_ledger
  where daily_record_id is not null and source_kind is null
    and reference_doc ~ '^DAILY_RECORD:[0-9a-fA-F-]+$'
  group by daily_record_id, item_id, warehouse_id
)
update public.stock_ledger sl set quantity = g.quantity, unit_cost = g.unit_cost
from grouped g where sl.id = g.keep_id;

with grouped as (
  select min(id::text)::uuid keep_id, daily_record_id, item_id, warehouse_id
  from public.stock_ledger
  where daily_record_id is not null and source_kind is null
    and reference_doc ~ '^DAILY_RECORD:[0-9a-fA-F-]+$'
  group by daily_record_id, item_id, warehouse_id
)
delete from public.stock_ledger sl using grouped g
where sl.daily_record_id = g.daily_record_id and sl.item_id = g.item_id and sl.warehouse_id = g.warehouse_id
  and sl.source_kind is null and sl.reference_doc ~ '^DAILY_RECORD:[0-9a-fA-F-]+$' and sl.id <> g.keep_id;

-- Assign ownership markers to older Daily Records usage rows.
update public.stock_ledger
set source_kind = 'daily_record_usage', source_key = daily_record_id::text
where daily_record_id is not null and source_kind is null
  and reference_doc ~ '^DAILY_RECORD:[0-9a-fA-F-]+$';

-- Closed Feed Control days win over legacy/manual feed issues.
delete from public.stock_ledger sl
using public.inventory_items i, public.daily_farm_records dfr, public.feed_day_closures c
where sl.item_id = i.id and i.category = 'feed'
  and sl.daily_record_id = dfr.id
  and c.org_id = dfr.org_id and c.flock_id = dfr.flock_id and c.record_date = dfr.record_date and c.status = 'closed'
  and not (sl.source_kind = 'feed_day_close' and sl.source_key = dfr.flock_id::text || ':' || dfr.record_date::text);

-- Recompute closed-day summaries and canonical feed ledger rows from sessions.
with totals as (
  select c.org_id, c.flock_id, c.record_date,
    coalesce(sum(s.actual_feed_kg), 0) actual_feed_kg,
    (array_agg(s.feed_type order by s.session_time desc nulls last) filter (where s.feed_type is not null))[1] feed_type
  from public.feed_day_closures c
  join public.feeding_session_records s on s.org_id = c.org_id and s.flock_id = c.flock_id and s.record_date = c.record_date
  where c.status = 'closed'
  group by c.org_id, c.flock_id, c.record_date
)
update public.daily_farm_records dfr set
  feed_intake_grams = round(t.actual_feed_kg * 1000),
  feed_intake_quantity = t.actual_feed_kg,
  feed_type = coalesce(t.feed_type, dfr.feed_type),
  synced = true,
  updated_at = now()
from totals t
where dfr.org_id = t.org_id and dfr.flock_id = t.flock_id and dfr.record_date = t.record_date;

delete from public.stock_ledger sl
using public.feed_day_closures c
where c.status = 'closed' and sl.org_id = c.org_id
  and sl.source_kind = 'feed_day_close'
  and sl.source_key = c.flock_id::text || ':' || c.record_date::text;

insert into public.stock_ledger(org_id, item_id, warehouse_id, quantity, transaction_type, unit_cost, transaction_date, branch_id, farm_id, house_id, flock_id, batch_id, daily_record_id, recorded_by, reference_doc, notes, source_kind, source_key)
select c.org_id, s.feed_item_id, s.warehouse_id, sum(s.actual_feed_kg), 'issue', coalesce(i.unit_cost, 0), c.record_date,
  fa.branch_id, f.farm_id, f.house_id, c.flock_id, c.batch_id, dfr.id, c.closed_by,
  'FEED_CLOSE:' || c.flock_id::text || ':' || c.record_date::text,
  'Feed Control daily close', 'feed_day_close', c.flock_id::text || ':' || c.record_date::text
from public.feed_day_closures c
join public.feeding_session_records s on s.org_id = c.org_id and s.flock_id = c.flock_id and s.record_date = c.record_date and s.actual_feed_kg > 0
join public.inventory_items i on i.id = s.feed_item_id and i.org_id = c.org_id
join public.flocks f on f.id = c.flock_id and f.org_id = c.org_id
join public.farms fa on fa.id = f.farm_id and fa.org_id = c.org_id
join public.daily_farm_records dfr on dfr.org_id = c.org_id and dfr.flock_id = c.flock_id and dfr.record_date = c.record_date
where c.status = 'closed'
group by c.org_id, c.flock_id, c.record_date, c.batch_id, c.closed_by, s.feed_item_id, s.warehouse_id,
  i.unit_cost, fa.branch_id, f.farm_id, f.house_id, dfr.id;

-- Older reopened closures predate clearing synchronized daily fields.
update public.daily_farm_records dfr set
  feed_intake_grams = null, feed_intake_quantity = null, feed_type = null, synced = false, updated_at = now()
from public.feed_day_closures c
where c.org_id = dfr.org_id and c.flock_id = dfr.flock_id and c.record_date = dfr.record_date
  and c.status = 'reopened' and dfr.synced = true;
