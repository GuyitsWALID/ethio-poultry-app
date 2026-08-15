-- Repair the chronology of the synthetic DEMO daily-record backfill.
--
-- The records for 2026-07-21 through 2026-08-14 were generated on
-- 2026-08-15, after their operating days had already locked. The
-- reconciliation engine correctly treated those timestamps as late edits.
-- This migration changes timestamps only for the exact four DEMO flocks,
-- preserves every business value, records the maintenance event, and clears
-- only the findings caused by this synthetic chronology.

do $$
declare
  v_count integer;
begin
  select count(*)
  into v_count
  from public.daily_farm_records
  where flock_id = any(array[
    'de400000-0000-4000-8000-000000000001'::uuid,
    'de400000-0000-4000-8000-000000000002'::uuid,
    'de400000-0000-4000-8000-000000000003'::uuid,
    'de400000-0000-4000-8000-000000000004'::uuid
  ])
    and record_date between date '2026-07-21' and date '2026-08-14'
    and created_at::date = date '2026-08-15';

  if v_count not in (0, 100) then
    raise exception 'DEMO chronology repair stopped: expected 0 or 100 exact backfill records, found %.', v_count;
  end if;
end $$;

insert into public.governance_audit_events(
  org_id,
  actor_role,
  event_type,
  entity_table,
  entity_id,
  reason,
  before_values,
  after_values,
  metadata
)
select
  target.org_id,
  'database_maintenance',
  'demo_fixture.chronology_repaired',
  'daily_farm_records',
  'DEMO-DAILY-20260721-20260814',
  'Corrected generated test-data timestamps that were later than their operating-day locks; no business values changed.',
  jsonb_build_object(
    'record_count', count(*),
    'record_date_from', min(target.record_date),
    'record_date_to', max(target.record_date),
    'generated_at', min(target.created_at)
  ),
  jsonb_build_object(
    'chronology', 'recorded on each synthetic operating date before lock',
    'business_values_changed', false
  ),
  jsonb_build_object(
    'migration', '20260815001000_repair_demo_backfill_chronology.sql',
    'fixture_only', true,
    'flock_count', count(distinct target.flock_id)
  )
from public.daily_farm_records target
where target.flock_id = any(array[
    'de400000-0000-4000-8000-000000000001'::uuid,
    'de400000-0000-4000-8000-000000000002'::uuid,
    'de400000-0000-4000-8000-000000000003'::uuid,
    'de400000-0000-4000-8000-000000000004'::uuid
  ])
  and target.record_date between date '2026-07-21' and date '2026-08-14'
  and target.created_at::date = date '2026-08-15'
group by target.org_id;

-- Prevent generic update triggers from replacing the intentional historical
-- timestamp or recalculating production percentages from today's bird count.
alter table public.daily_farm_records disable trigger trg_daily_farm_records_updated_at;
alter table public.daily_farm_records disable trigger apply_daily_farm_record_counts;

update public.daily_farm_records
set
  created_at = (record_date::timestamp + time '18:00') at time zone 'Africa/Addis_Ababa',
  updated_at = (record_date::timestamp + time '18:30') at time zone 'Africa/Addis_Ababa'
where flock_id = any(array[
    'de400000-0000-4000-8000-000000000001'::uuid,
    'de400000-0000-4000-8000-000000000002'::uuid,
    'de400000-0000-4000-8000-000000000003'::uuid,
    'de400000-0000-4000-8000-000000000004'::uuid
  ])
  and record_date between date '2026-07-21' and date '2026-08-14'
  and created_at::date = date '2026-08-15';

alter table public.daily_farm_records enable trigger apply_daily_farm_record_counts;
alter table public.daily_farm_records enable trigger trg_daily_farm_records_updated_at;

insert into public.reconciliation_finding_responses(
  org_id,
  finding_id,
  action,
  note,
  actor_role,
  created_at
)
select
  finding.org_id,
  finding.id,
  'system_clear',
  'Synthetic DEMO backfill chronology was repaired; no business values changed.',
  'system',
  now()
from public.reconciliation_findings finding
where finding.rule_code = 'LOCKED_RECORD_CHANGED_WITHOUT_APPROVAL'
  and finding.flock_id = any(array[
    'de400000-0000-4000-8000-000000000001'::uuid,
    'de400000-0000-4000-8000-000000000002'::uuid,
    'de400000-0000-4000-8000-000000000003'::uuid,
    'de400000-0000-4000-8000-000000000004'::uuid
  ])
  and finding.record_date between date '2026-07-21' and date '2026-08-14'
  and not exists (
    select 1
    from public.reconciliation_finding_responses response
    where response.finding_id = finding.id
      and response.action = 'system_clear'
      and response.note = 'Synthetic DEMO backfill chronology was repaired; no business values changed.'
  );

update public.reconciliation_findings
set
  status = 'cleared',
  resolved_at = now(),
  resolution_note = 'Synthetic DEMO backfill chronology was repaired; no business values changed.',
  updated_at = now()
where rule_code = 'LOCKED_RECORD_CHANGED_WITHOUT_APPROVAL'
  and flock_id = any(array[
    'de400000-0000-4000-8000-000000000001'::uuid,
    'de400000-0000-4000-8000-000000000002'::uuid,
    'de400000-0000-4000-8000-000000000003'::uuid,
    'de400000-0000-4000-8000-000000000004'::uuid
  ])
  and record_date between date '2026-07-21' and date '2026-08-14';

do $$
begin
  if exists (
    select 1
    from public.daily_farm_records record
    join public.flocks flock on flock.id = record.flock_id
    join public.farm_operating_days operating_day
      on operating_day.farm_id = flock.farm_id
     and operating_day.operating_date = record.record_date
     and operating_day.status = 'locked'
    where record.flock_id = any(array[
      'de400000-0000-4000-8000-000000000001'::uuid,
      'de400000-0000-4000-8000-000000000002'::uuid,
      'de400000-0000-4000-8000-000000000003'::uuid,
      'de400000-0000-4000-8000-000000000004'::uuid
    ])
      and record.record_date between date '2026-07-21' and date '2026-08-14'
      and record.updated_at > operating_day.locked_at
  ) then
    raise exception 'DEMO chronology repair did not place every generated record before its operating-day lock.';
  end if;
end $$;
