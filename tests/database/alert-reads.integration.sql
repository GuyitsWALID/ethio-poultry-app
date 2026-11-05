\set ON_ERROR_STOP on
begin;
do $$
declare o uuid:=gen_random_uuid(); branch uuid:=gen_random_uuid(); farm uuid:=gen_random_uuid();
  store uuid:=gen_random_uuid(); other_store uuid:=gen_random_uuid(); item uuid:=gen_random_uuid();
  urgent uuid; ordinary uuid; measured numeric;
begin
  insert into public.organizations(id,name) values(o,'Bounded alert reads');
  insert into public.branches(id,org_id,name) values(branch,o,'Branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Farm');
  insert into public.warehouses(id,org_id,branch_id,farm_id,name,type,status) values
    (store,o,branch,farm,'Farm store','farm_store','active'),
    (other_store,o,branch,null,'Shared store','central_warehouse','active');
  insert into public.inventory_items(id,org_id,name,category,unit,reorder_level) values(item,o,'Feed','feed','kg',10);
  insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date)
    select o,item,store,'receipt',1,1,current_date from generate_series(1,6000);
  insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date) values
    (o,item,store,'issue',5995,1,current_date),(o,item,other_store,'receipt',1000,1,current_date);
  select quantity into measured from public.operational_low_stock_balances(o) where warehouse_id=store and item_id= item;
  if measured is distinct from 5 then raise exception 'Complete ledger not aggregated: %',measured; end if;
  if exists(select 1 from public.operational_low_stock_balances(o) where warehouse_id=other_store) then
    raise exception 'High stock in another store incorrectly warned'; end if;
  if exists(select 1 from public.operational_low_stock_balances(gen_random_uuid())) then raise exception 'Cross-tenant stock'; end if;
  update public.warehouses set status='inactive' where id=store;
  if exists(select 1 from public.operational_low_stock_balances(o)) then raise exception 'Inactive store warned'; end if;
  if has_function_privilege('authenticated','public.operational_low_stock_balances(uuid)','execute')
    or has_table_privilege('authenticated','public.operational_action_inbox','select') then
    raise exception 'Service-only read surface exposed to browser'; end if;
  insert into public.operational_actions(org_id,source_key,source_name,source_route,title,context,severity,status,due_at,source_first_seen_at,source_last_seen_at)
    values(o,'urgent','Test','/app/alerts','Urgent','Test','high','open',now()+interval '2 days',now(),now()) returning id into urgent;
  insert into public.operational_actions(org_id,source_key,source_name,source_route,title,context,severity,status,due_at,source_first_seen_at,source_last_seen_at)
    values(o,'ordinary','Test','/app/alerts','Ordinary','Test','low','open',now()+interval '1 day',now(),now()) returning id into ordinary;
  if (select id from public.operational_action_inbox where org_id=o order by inbox_priority,due_at,id limit 1)<>urgent then
    raise exception 'Urgent action hidden behind an earlier ordinary deadline'; end if;
  update public.operational_actions set due_at=now()-interval '1 hour' where id=ordinary;
  if (select id from public.operational_action_inbox where org_id=o order by inbox_priority,due_at,id limit 1)<>ordinary then
    raise exception 'Overdue work not prioritized'; end if;
end $$;
rollback;
