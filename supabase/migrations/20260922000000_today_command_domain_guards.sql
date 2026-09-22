-- Keep Today feed-session commands and the legacy Feed Control route behind
-- the same database invariants. This trigger is deliberately shared by both
-- entry points and runs in the caller's mutation transaction.

create or replace function public.enforce_feeding_session_authority()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_flock_batch_id uuid;
  v_flock_branch_id uuid;
  v_warehouse_branch_id uuid;
  v_item_unit text;
begin
  if exists (
    select 1
    from public.feed_day_closures c
    where c.org_id = new.org_id
      and c.flock_id = new.flock_id
      and c.record_date = new.record_date
      and c.status = 'closed'
  ) then
    raise exception 'Reopen the feeding day before changing its sessions.' using errcode = '55000';
  end if;

  select f.batch_id, h.branch_id
  into v_flock_batch_id, v_flock_branch_id
  from public.flocks f
  join public.houses h on h.id = f.house_id
  where f.id = new.flock_id and f.org_id = new.org_id;

  if not found or new.batch_id is distinct from v_flock_batch_id then
    raise exception 'The flock is not part of the selected batch.' using errcode = '22023';
  end if;

  if new.status = 'completed' then
    if new.actual_feed_kg is null or new.feed_item_id is null or new.warehouse_id is null then
      raise exception 'Completed sessions require actual feed, a feed item, and warehouse.' using errcode = '22023';
    end if;
  end if;

  if new.feed_item_id is not null or new.warehouse_id is not null then
    if new.feed_item_id is null or new.warehouse_id is null then
      raise exception 'Feed item and warehouse must be selected together.' using errcode = '22023';
    end if;
    select lower(btrim(i.unit))
    into v_item_unit
    from public.inventory_items i
    where i.id = new.feed_item_id
      and i.org_id = new.org_id
      and i.category = 'feed';
    if not found or v_item_unit not in ('kg', 'kilogram', 'kilograms') then
      raise exception 'Select a feed inventory item measured in kilograms.' using errcode = '22023';
    end if;

    select w.branch_id
    into v_warehouse_branch_id
    from public.warehouses w
    where w.id = new.warehouse_id
      and w.org_id = new.org_id
      and w.status = 'active';
    if not found or v_warehouse_branch_id is distinct from v_flock_branch_id then
      raise exception 'Select an active warehouse in the flock branch.' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists feeding_session_authority_guard on public.feeding_session_records;
create trigger feeding_session_authority_guard
before insert or update on public.feeding_session_records
for each row execute function public.enforce_feeding_session_authority();

revoke all on function public.enforce_feeding_session_authority() from public, anon, authenticated;
grant execute on function public.enforce_feeding_session_authority() to service_role;

comment on function public.enforce_feeding_session_authority() is
  'Shared Feed Control and Today invariant guard for closed days, flock/batch scope, feed catalogue category/unit, and warehouse branch.';
