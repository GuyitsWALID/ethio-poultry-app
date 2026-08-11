-- Structural checks that must pass before a verified schema can adopt the
-- repository's historical migration identifiers. Required reference data and
-- scheduler state are verified by deployment_preflight.sql after db:deploy.
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
    raise exception 'baseline preflight failed; missing relations: %', array_to_string(missing, ', ');
  end if;

  if to_regprocedure('public.lock_overdue_operating_days()') is null then
    raise exception 'baseline preflight failed; operating-day locking function is missing';
  end if;
end
$$;
