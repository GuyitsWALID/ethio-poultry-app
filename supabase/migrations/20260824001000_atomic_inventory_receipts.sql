-- Make the warehouse assignment authoritative for receipts and keep new-item
-- registration in the same transaction as its first stock movement.

create or replace function public.receive_inventory_stock(
  p_actor_id uuid,
  p_warehouse_id uuid,
  p_item_id uuid,
  p_new_item jsonb,
  p_quantity numeric,
  p_unit_cost numeric,
  p_transaction_date date,
  p_procurement_type public.procurement_type,
  p_supplier_name text,
  p_invoice_number text,
  p_notes text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_branch_id uuid;
  v_farm_id uuid;
  v_item_id uuid := p_item_id;
  v_movement_id uuid;
  v_name text;
  v_unit text;
  v_category public.inventory_category;
  v_reorder_level numeric;
begin
  select p.org_id, p.role::text into v_org_id, v_role
  from public.profiles p
  where p.id = p_actor_id and p.is_active;

  if v_org_id is null or v_role not in ('farm_manager', 'system_admin') then
    raise exception 'Only an assigned Farm Manager can receive warehouse stock.' using errcode = '42501';
  end if;

  select w.branch_id, w.farm_id into v_branch_id, v_farm_id
  from public.warehouses w
  where w.id = p_warehouse_id and w.org_id = v_org_id and w.status = 'active';
  if not found then
    raise exception 'The warehouse is inactive or outside this organization.' using errcode = '22023';
  end if;

  if v_role = 'farm_manager' and not exists (
    select 1 from public.user_warehouse_access a
    where a.org_id = v_org_id
      and a.profile_id = p_actor_id
      and a.warehouse_id = p_warehouse_id
      and a.revoked_at is null
      and a.starts_at <= now()
      and (a.expires_at is null or a.expires_at > now())
  ) then
    raise exception 'An active assignment to this warehouse is required.' using errcode = '42501';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'A receipt request identity is required.' using errcode = '22023';
  end if;
  select sl.id, sl.item_id into v_movement_id, v_item_id
  from public.stock_ledger sl
  where sl.org_id = v_org_id
    and sl.warehouse_id = p_warehouse_id
    and sl.source_kind = 'inventory_receipt'
    and sl.source_key = p_idempotency_key
  limit 1;
  if found then
    return jsonb_build_object('movement_id', v_movement_id, 'item_id', v_item_id, 'reused', true);
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity received must be greater than zero.' using errcode = '22023';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative.' using errcode = '22023';
  end if;
  if p_transaction_date is null or p_procurement_type is null then
    raise exception 'Receipt date and purchase type are required.' using errcode = '22023';
  end if;

  if v_item_id is null then
    if p_new_item is null or jsonb_typeof(p_new_item) <> 'object' then
      raise exception 'Choose an existing item or enter the new item details.' using errcode = '22023';
    end if;
    v_name := btrim(p_new_item->>'name');
    v_unit := btrim(p_new_item->>'unit');
    v_category := (p_new_item->>'category')::public.inventory_category;
    v_reorder_level := coalesce(nullif(p_new_item->>'reorderLevel', '')::numeric, 0);
    if length(v_name) < 2 or length(v_name) > 120 or length(v_unit) < 1 or length(v_unit) > 40 or v_reorder_level < 0 then
      raise exception 'Enter a valid item name, category, unit, and reorder level.' using errcode = '22023';
    end if;
    if exists(select 1 from public.inventory_items i where i.org_id = v_org_id and lower(i.name) = lower(v_name)) then
      raise exception 'An inventory item with this name already exists. Choose it from Existing item.' using errcode = '23505';
    end if;
    insert into public.inventory_items(org_id, name, category, unit, reorder_level, unit_cost)
    values(v_org_id, v_name, v_category, v_unit, v_reorder_level, p_unit_cost)
    returning id into v_item_id;
  elsif not exists(select 1 from public.inventory_items i where i.id = v_item_id and i.org_id = v_org_id) then
    raise exception 'The inventory item is outside this organization.' using errcode = '22023';
  end if;

  insert into public.stock_ledger(
    org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
    transaction_date, branch_id, farm_id, supplier_name, invoice_number,
    procurement_type, notes, reference_doc, recorded_by, source_kind, source_key
  ) values (
    v_org_id, v_item_id, p_warehouse_id, 'receipt', p_quantity, p_unit_cost,
    p_transaction_date, v_branch_id, v_farm_id, nullif(btrim(p_supplier_name), ''),
    nullif(btrim(p_invoice_number), ''), p_procurement_type, nullif(btrim(p_notes), ''),
    coalesce(nullif(btrim(p_invoice_number), ''), 'RECEIPT:' || p_idempotency_key),
    p_actor_id, 'inventory_receipt', p_idempotency_key
  ) returning id into v_movement_id;

  return jsonb_build_object('movement_id', v_movement_id, 'item_id', v_item_id, 'reused', false);
end;
$$;

revoke all on function public.receive_inventory_stock(uuid,uuid,uuid,jsonb,numeric,numeric,date,public.procurement_type,text,text,text,text) from public, anon, authenticated;
grant execute on function public.receive_inventory_stock(uuid,uuid,uuid,jsonb,numeric,numeric,date,public.procurement_type,text,text,text,text) to service_role;

create or replace function public.record_assigned_inventory_movement(
  p_actor_id uuid,
  p_item_id uuid,
  p_warehouse_id uuid,
  p_transaction_type text,
  p_quantity numeric,
  p_unit_cost numeric,
  p_transaction_date date,
  p_destination_warehouse_id uuid,
  p_notes text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid; v_role text; v_branch_id uuid; v_farm_id uuid;
  v_destination_branch_id uuid; v_destination_farm_id uuid;
  v_available numeric; v_item_cost numeric; v_out_id uuid; v_in_id uuid;
begin
  select p.org_id,p.role::text into v_org_id,v_role from public.profiles p where p.id=p_actor_id and p.is_active;
  if v_org_id is null or v_role not in ('farm_manager','system_admin') then raise exception 'Only an assigned Farm Manager can move warehouse stock.' using errcode='42501'; end if;
  if p_transaction_type not in ('issue','return','adjustment','transfer') then raise exception 'Use the stock receipt workflow for purchases.' using errcode='22023'; end if;
  if p_quantity is null or p_quantity=0 or (p_transaction_type<>'adjustment' and p_quantity<0) then raise exception 'Enter a valid non-zero quantity.' using errcode='22023'; end if;
  if p_unit_cost is null or p_unit_cost<0 or p_transaction_date is null then raise exception 'Movement date and a non-negative cost are required.' using errcode='22023'; end if;
  if nullif(btrim(p_idempotency_key),'') is null then raise exception 'A stock action request identity is required.' using errcode='22023'; end if;

  select i.unit_cost into v_item_cost from public.inventory_items i where i.id=p_item_id and i.org_id=v_org_id;
  if not found then raise exception 'The inventory item is outside this organization.' using errcode='22023'; end if;
  select w.branch_id,w.farm_id into v_branch_id,v_farm_id from public.warehouses w where w.id=p_warehouse_id and w.org_id=v_org_id and w.status='active';
  if not found then raise exception 'The source warehouse is inactive or unavailable.' using errcode='22023'; end if;
  if v_role='farm_manager' and not exists(select 1 from public.user_warehouse_access a where a.org_id=v_org_id and a.profile_id=p_actor_id and a.warehouse_id=p_warehouse_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())) then raise exception 'An active source warehouse assignment is required.' using errcode='42501'; end if;

  select sl.id into v_out_id from public.stock_ledger sl where sl.org_id=v_org_id and sl.item_id=p_item_id and sl.warehouse_id=p_warehouse_id and sl.source_kind='assigned_stock_action' and sl.source_key=p_idempotency_key limit 1;
  if found then return jsonb_build_object('movement_id',v_out_id,'reused',true); end if;

  if p_transaction_type='transfer' then
    if p_destination_warehouse_id is null or p_destination_warehouse_id=p_warehouse_id then raise exception 'Choose a different destination warehouse.' using errcode='22023'; end if;
    select w.branch_id,w.farm_id into v_destination_branch_id,v_destination_farm_id from public.warehouses w where w.id=p_destination_warehouse_id and w.org_id=v_org_id and w.status='active';
    if not found then raise exception 'The destination warehouse is inactive or unavailable.' using errcode='22023'; end if;
    if v_role='farm_manager' and not exists(select 1 from public.user_warehouse_access a where a.org_id=v_org_id and a.profile_id=p_actor_id and a.warehouse_id=p_destination_warehouse_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())) then raise exception 'An active destination warehouse assignment is required.' using errcode='42501'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text||':'||p_warehouse_id::text,0));
  if p_transaction_type in ('issue','transfer') or (p_transaction_type='adjustment' and p_quantity<0) then
    select coalesce(sum(public.stock_movement_delta(sl.transaction_type,sl.quantity)),0) into v_available from public.stock_ledger sl where sl.org_id=v_org_id and sl.item_id=p_item_id and sl.warehouse_id=p_warehouse_id;
    if v_available<abs(p_quantity) then raise exception 'Insufficient stock. Available quantity is %.',v_available using errcode='22023'; end if;
  end if;

  if p_transaction_type='transfer' then
    perform pg_advisory_xact_lock(hashtextextended(p_item_id::text||':'||p_destination_warehouse_id::text,0));
    insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date,branch_id,farm_id,notes,reference_doc,recorded_by,source_kind,source_key)
    values(v_org_id,p_item_id,p_warehouse_id,'transfer_out',abs(p_quantity),coalesce(nullif(p_unit_cost,0),v_item_cost,0),p_transaction_date,v_branch_id,v_farm_id,nullif(btrim(p_notes),''),'TRANSFER:'||p_idempotency_key,p_actor_id,'assigned_stock_action',p_idempotency_key) returning id into v_out_id;
    insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date,branch_id,farm_id,notes,reference_doc,recorded_by,source_kind,source_key)
    values(v_org_id,p_item_id,p_destination_warehouse_id,'transfer_in',abs(p_quantity),coalesce(nullif(p_unit_cost,0),v_item_cost,0),p_transaction_date,v_destination_branch_id,v_destination_farm_id,nullif(btrim(p_notes),''),'TRANSFER:'||p_idempotency_key,p_actor_id,'assigned_stock_action',p_idempotency_key) returning id into v_in_id;
    return jsonb_build_object('movement_id',v_out_id,'paired_movement_id',v_in_id,'reused',false);
  end if;

  insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date,branch_id,farm_id,notes,reference_doc,recorded_by,source_kind,source_key)
  values(v_org_id,p_item_id,p_warehouse_id,p_transaction_type::public.stock_txn_type,p_quantity,coalesce(nullif(p_unit_cost,0),v_item_cost,0),p_transaction_date,v_branch_id,v_farm_id,nullif(btrim(p_notes),''),'STOCK_ACTION:'||p_idempotency_key,p_actor_id,'assigned_stock_action',p_idempotency_key) returning id into v_out_id;
  return jsonb_build_object('movement_id',v_out_id,'reused',false);
end;
$$;

revoke all on function public.record_assigned_inventory_movement(uuid,uuid,uuid,text,numeric,numeric,date,uuid,text,text) from public, anon, authenticated;
grant execute on function public.record_assigned_inventory_movement(uuid,uuid,uuid,text,numeric,numeric,date,uuid,text,text) to service_role;
