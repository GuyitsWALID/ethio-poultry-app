begin;
do $$
begin
  if not exists(select 1 from pg_class where oid='public.history_stock_movements'::regclass and reloptions @> array['security_invoker=true']) then
    raise exception 'History stock projection must use invoker security';
  end if;
  if has_table_privilege('authenticated','public.history_stock_movements','select') or has_table_privilege('anon','public.history_stock_movements','select') then
    raise exception 'History projection must not be browser-readable';
  end if;
  if not has_table_privilege('service_role','public.history_stock_movements','select') then
    raise exception 'History server requires projection access';
  end if;
  if exists(select 1 from public.history_stock_movements h join public.stock_ledger s using(id)
    where h.operating_date is distinct from (s.transaction_date at time zone 'Africa/Addis_Ababa')::date
       or h.quantity is distinct from s.quantity or h.org_id is distinct from s.org_id) then
    raise exception 'History projection changed authoritative values';
  end if;
  if (select count(*) from public.history_stock_movements) <> (select count(*) from public.stock_ledger) then
    raise exception 'History projection omitted source records';
  end if;
  if ('2026-10-17 21:00:00+00'::timestamptz at time zone 'Africa/Addis_Ababa')::date <> date '2026-10-18'
    or ('2026-10-17 20:59:59+00'::timestamptz at time zone 'Africa/Addis_Ababa')::date <> date '2026-10-17' then
    raise exception 'Unexpected Addis Ababa operating boundary';
  end if;
end $$;
rollback;
