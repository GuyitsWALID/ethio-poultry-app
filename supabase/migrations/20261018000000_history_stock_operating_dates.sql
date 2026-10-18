-- Read projection only: preserve stock ledger identities, values and timestamps.
-- A date column is required for stable (operating date, source identity) paging.
create view public.history_stock_movements with (security_invoker=true) as
select id,org_id,warehouse_id,item_id,farm_id,house_id,flock_id,batch_id,
  daily_record_id,transaction_date,
  (transaction_date at time zone 'Africa/Addis_Ababa')::date as operating_date,
  transaction_type,quantity,unit_cost,supplier_name,invoice_number,reference_doc,
  notes,created_at,updated_at
from public.stock_ledger;

revoke all on public.history_stock_movements from public,anon,authenticated;
grant select on public.history_stock_movements to service_role;
comment on view public.history_stock_movements is
  'Internal History projection of authoritative stock_ledger; server must authorize effective warehouse access before pagination.';
notify pgrst,'reload schema';
