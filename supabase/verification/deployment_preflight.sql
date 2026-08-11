do $$
declare
  missing text[];
begin
  select array_agg(required.name order by required.name)
  into missing
  from (values
    ('organizations'),('profiles'),('branches'),('farms'),('houses'),('batches'),('flocks'),
    ('daily_farm_records'),('feeding_session_records'),('feed_day_closures'),('stock_ledger'),
    ('governance_requests'),('farm_operating_days'),('governance_audit_events'),
    ('reconciliation_runs'),('reconciliation_findings'),('inventory_physical_counts')
  ) required(name)
  where to_regclass('public.' || required.name) is null;

  if missing is not null then
    raise exception 'deployment preflight failed; missing relations: %', array_to_string(missing, ', ');
  end if;

  if exists (
    select 1 from (values
      ('daily_farm_records'),('feeding_session_records'),('feed_day_closures'),('stock_ledger'),
      ('governance_requests'),('farm_operating_days'),('governance_audit_events'),
      ('reconciliation_findings'),('inventory_physical_counts')
    ) required(name)
    join pg_class c on c.oid = to_regclass('public.' || required.name)
    where not c.relrowsecurity
  ) then
    raise exception 'deployment preflight failed; one or more sensitive relations do not have RLS enabled';
  end if;

  if to_regprocedure('public.lock_overdue_operating_days()') is null then
    raise exception 'deployment preflight failed; operating-day scheduler function is missing';
  end if;

  if (select count(*) from public.roles where code in ('ceo','farm_manager','system_admin')) <> 3 then
    raise exception 'deployment preflight failed; required active-role reference rows are incomplete';
  end if;

  if exists (
    select 1
    from public.organizations o
    cross join (values ('egg'),('eggs'),('piece'),('pieces'),('dozen'),('tray')) expected(unit)
    where not exists (
      select 1 from public.sales_unit_conversions c
      where c.org_id=o.id and c.product_category='egg' and c.unit=expected.unit
    )
  ) then
    raise exception 'deployment preflight failed; one or more organizations lack required sales unit conversions';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname='trg_organizations_seed_sales_unit_conversions' and not tgisinternal
  ) then
    raise exception 'deployment preflight failed; organization reference-data trigger is missing';
  end if;

  if not exists (
    select 1 from public.governance_scheduler_health where scheduler_key='operating_day_lock'
  ) then
    raise exception 'deployment preflight failed; operating-day scheduler health row is missing';
  end if;

  if to_regclass('cron.job') is null or not exists (
    select 1 from cron.job
    where jobname='lock-overdue-farm-operating-days'
      and schedule='*/15 * * * *'
      and command='select public.lock_overdue_operating_days()'
      and active
  ) then
    raise exception 'deployment preflight failed; operating-day scheduler job is missing or incorrect';
  end if;

  if to_regclass('supabase_migrations.schema_migrations') is null or not exists (
    select 1 from supabase_migrations.schema_migrations where version='20260811100000'
  ) then
    raise exception 'deployment preflight failed; canonical migration head is not recorded';
  end if;
end $$;

select
  current_database() as database_name,
  current_setting('server_version') as postgres_version,
  count(*) filter (where status in ('open','acknowledged','investigating')) as active_reconciliation_findings,
  max(last_seen_at) as latest_reconciliation_run_evidence
from public.reconciliation_findings;
