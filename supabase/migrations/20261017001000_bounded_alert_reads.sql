-- Aggregate the complete ledger in PostgreSQL, not a capped browser/API row list.
create function public.operational_low_stock_balances(p_org_id uuid)
returns table(item_id uuid,warehouse_id uuid,quantity numeric)
language sql stable security definer set search_path=public as $$
  select s.item_id,s.warehouse_id,sum(case when s.transaction_type in ('issue','transfer_out') then -s.quantity else s.quantity end)
  from public.stock_ledger s
  join public.warehouses w on w.id=s.warehouse_id and w.org_id=p_org_id and w.status='active'
  join public.inventory_items i on i.id=s.item_id and i.org_id=p_org_id and i.reorder_level is not null
  where s.org_id=p_org_id
  group by s.item_id,s.warehouse_id,i.reorder_level
  having sum(case when s.transaction_type in ('issue','transfer_out') then -s.quantity else s.quantity end)<=i.reorder_level;
$$;
revoke all on function public.operational_low_stock_balances(uuid) from public,anon,authenticated;
grant execute on function public.operational_low_stock_balances(uuid) to service_role;

-- Keep urgent work ahead of later pages, not merely sorted within one page.
create view public.operational_action_inbox with(security_invoker=true) as
  select a.*,case when a.status='escalated' or a.due_at<now() then 0
    when a.severity='high' then 1 when a.severity='medium' then 2 else 3 end as inbox_priority
  from public.operational_actions a;
revoke all on public.operational_action_inbox from public,anon,authenticated;
grant select on public.operational_action_inbox to service_role;

create index if not exists operational_actions_inbox_order on public.operational_actions(org_id,due_at,id)
  where status<>'resolved';
create index if not exists operational_action_events_recent on public.operational_action_events(org_id,action_id,created_at desc,id desc);

notify pgrst, 'reload schema';
