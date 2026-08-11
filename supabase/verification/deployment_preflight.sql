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
end $$;

select
  current_database() as database_name,
  current_setting('server_version') as postgres_version,
  count(*) filter (where status in ('open','acknowledged','investigating')) as active_reconciliation_findings,
  max(last_seen_at) as latest_reconciliation_run_evidence
from public.reconciliation_findings;
