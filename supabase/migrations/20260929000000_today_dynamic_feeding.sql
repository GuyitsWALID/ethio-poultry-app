-- A missed feeding with a documented reason is resolved work, not an incomplete session.
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

  select count(*) filter(where status = 'planned' or (status = 'completed' and actual_feed_kg is null) or (status = 'missed' and nullif(btrim(notes), '') is null)),
    coalesce(sum(actual_feed_kg), 0), coalesce(sum(planned_feed_kg), 0)
  into v_incomplete, v_actual, v_planned
  from public.feeding_session_records
  where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date;
  if not exists(select 1 from public.feeding_session_records where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date) then
    raise exception 'Add at least one feeding session before closing the day.' using errcode = '22023';
  end if;
  if v_incomplete > 0 then raise exception 'Complete each feeding or explain why it was missed before closing the day.' using errcode = '22023'; end if;
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
