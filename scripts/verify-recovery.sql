\set ON_ERROR_STOP on

do $$
declare
  missing_tables text[];
begin
  select array_agg(required.name)
  into missing_tables
  from (values
    ('organizations'), ('profiles'), ('farms'), ('flocks'), ('daily_farm_records'),
    ('inventory_items'), ('stock_ledger'), ('governance_audit_events')
  ) as required(name)
  where to_regclass('public.' || required.name) is null;

  if missing_tables is not null then
    raise exception 'Recovery verification is missing critical tables: %', missing_tables;
  end if;
end;
$$;

select count(*) as restored_organizations from public.organizations;
select count(*) as restored_profiles from public.profiles;
select count(*) as restored_daily_records from public.daily_farm_records;
select count(*) as restored_audit_events from public.governance_audit_events;

do $$
declare
  unprotected_tables text[];
begin
  select array_agg(c.relname)
  into unprotected_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('organizations', 'profiles', 'farms', 'daily_farm_records', 'inventory_items', 'stock_ledger', 'governance_audit_events')
    and not c.relrowsecurity;

  if unprotected_tables is not null then
    raise exception 'Recovery verification found critical tables without RLS: %', unprotected_tables;
  end if;
end;
$$;
