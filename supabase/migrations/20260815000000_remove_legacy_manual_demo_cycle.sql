-- Remove the pre-launch manual test cycle created on 2026-05-20.
-- The governed DEMO-* mixed-farm dataset is intentionally preserved.

do $$
declare
  v_batch uuid := '9fb49a0e-49c6-4b6a-9524-33959adb2f11';
  v_flocks uuid[] := array[
    '87170167-8fc5-4cb5-9c37-c427f8204119'::uuid,
    'd170c318-688f-4124-87cb-7b14733377fe'::uuid,
    '0eac1ae3-7415-417a-b8fa-2fbd39f6f4b8'::uuid,
    '1a78ca37-331b-4999-9c43-51097feb82f3'::uuid
  ];
  v_houses uuid[] := array[
    'c039b2aa-8f0f-45b9-b0c2-5d48602e2511'::uuid,
    '773fa45f-837f-4365-9ae0-67ad9a657e88'::uuid,
    '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00'::uuid,
    '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'::uuid
  ];
  v_present integer;
begin
  select
    (select count(*) from public.batches where id = v_batch) +
    (select count(*) from public.flocks where id = any(v_flocks)) +
    (select count(*) from public.houses where id = any(v_houses))
  into v_present;

  if v_present = 0 then
    raise notice 'Legacy manual demo cycle is already absent; cleanup is a no-op.';
    return;
  end if;

  if not exists (
    select 1 from public.batches
    where id = v_batch and batch_code = 'B-2026-0022' and created_at::date = '2026-05-20'
  ) then
    raise exception 'Legacy cleanup stopped: the expected batch identity does not match.';
  end if;

  if (select count(*) from public.flocks where id = any(v_flocks) and batch_id = v_batch and created_at::date = '2026-05-20') <> 4 then
    raise exception 'Legacy cleanup stopped: the expected four flocks do not match.';
  end if;

  if (select count(*) from public.houses where id = any(v_houses) and created_at::date = '2026-05-20') <> 4 then
    raise exception 'Legacy cleanup stopped: the expected four houses do not match.';
  end if;

  if (select count(*) from public.flocks where id::text like 'de400000-%') <> 4
     or (select count(*) from public.batches where id::text like 'de300000-%') <> 4
     or (select count(*) from public.houses where id::text like 'de100000-%') <> 4 then
    raise exception 'Legacy cleanup stopped: the governed DEMO dataset is incomplete.';
  end if;
end $$;

insert into public.governance_audit_events(
  org_id, actor_role, event_type, entity_table, entity_id, reason, before_values, metadata
)
select
  '27e24583-0df0-415a-8815-d8d57fb49674',
  'database_maintenance',
  'demo_fixture.removed',
  'batches',
  '9fb49a0e-49c6-4b6a-9524-33959adb2f11',
  'User-requested removal of the superseded pre-launch manual test cycle.',
  jsonb_build_object(
    'batch_code', b.batch_code,
    'flocks', (select jsonb_agg(jsonb_build_object('id', f.id, 'flock_code', f.flock_code) order by f.flock_code) from public.flocks f where f.batch_id = b.id),
    'houses', (select jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name) order by h.name) from public.houses h where h.id = any(array[
      'c039b2aa-8f0f-45b9-b0c2-5d48602e2511'::uuid,
      '773fa45f-837f-4365-9ae0-67ad9a657e88'::uuid,
      '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00'::uuid,
      '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'::uuid
    ])),
    'daily_records', (select count(*) from public.daily_farm_records d where d.flock_id in (select f.id from public.flocks f where f.batch_id = b.id)),
    'health_events', (select count(*) from public.health_events e where e.flock_id in (select f.id from public.flocks f where f.batch_id = b.id)),
    'vaccination_events', (select count(*) from public.vaccination_events e where e.flock_id in (select f.id from public.flocks f where f.batch_id = b.id))
  ),
  jsonb_build_object('migration', '20260815000000_remove_legacy_manual_demo_cycle.sql', 'preserved_demo_prefix', 'DEMO-')
from public.batches b
where b.id = '9fb49a0e-49c6-4b6a-9524-33959adb2f11';

-- Findings and AI analyses are governed evidence. Preserve them, but remove them
-- from the active queue now that their source fixture is intentionally gone.
update public.reconciliation_findings
set status = 'cleared',
    resolved_at = coalesce(resolved_at, now()),
    resolution_note = coalesce(resolution_note, 'Legacy pre-launch manual test fixture removed by database maintenance.'),
    updated_at = now()
where flock_id = any(array[
    '87170167-8fc5-4cb5-9c37-c427f8204119'::uuid,
    'd170c318-688f-4124-87cb-7b14733377fe'::uuid,
    '0eac1ae3-7415-417a-b8fa-2fbd39f6f4b8'::uuid,
    '1a78ca37-331b-4999-9c43-51097feb82f3'::uuid
  ])
   or batch_id = '9fb49a0e-49c6-4b6a-9524-33959adb2f11'
   or house_id = any(array[
    'c039b2aa-8f0f-45b9-b0c2-5d48602e2511'::uuid,
    '773fa45f-837f-4365-9ae0-67ad9a657e88'::uuid,
    '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00'::uuid,
    '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'::uuid
  ]);

-- Hard deletion is normally prohibited. Disable only the named business-record
-- guards for this transaction-bound, exact-ID pre-launch fixture cleanup.
alter table public.daily_farm_records disable trigger reject_hard_delete;
alter table public.daily_sales_records disable trigger reject_hard_delete;
alter table public.feeding_session_records disable trigger reject_hard_delete;
alter table public.health_events disable trigger reject_hard_delete;
alter table public.vaccination_events disable trigger reject_hard_delete;
alter table public.batch_weight_check_tasks disable trigger reject_hard_delete;
alter table public.batches disable trigger reject_hard_delete;

delete from public.daily_sales_records
where flock_id = any(array[
    '87170167-8fc5-4cb5-9c37-c427f8204119'::uuid,
    'd170c318-688f-4124-87cb-7b14733377fe'::uuid,
    '0eac1ae3-7415-417a-b8fa-2fbd39f6f4b8'::uuid,
    '1a78ca37-331b-4999-9c43-51097feb82f3'::uuid
  ])
   or batch_id = '9fb49a0e-49c6-4b6a-9524-33959adb2f11'
   or house_id = any(array[
    'c039b2aa-8f0f-45b9-b0c2-5d48602e2511'::uuid,
    '773fa45f-837f-4365-9ae0-67ad9a657e88'::uuid,
    '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00'::uuid,
    '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'::uuid
  ]);

delete from public.stock_ledger
where flock_id = any(array[
    '87170167-8fc5-4cb5-9c37-c427f8204119'::uuid,
    'd170c318-688f-4124-87cb-7b14733377fe'::uuid,
    '0eac1ae3-7415-417a-b8fa-2fbd39f6f4b8'::uuid,
    '1a78ca37-331b-4999-9c43-51097feb82f3'::uuid
  ])
   or batch_id = '9fb49a0e-49c6-4b6a-9524-33959adb2f11'
   or house_id = any(array[
    'c039b2aa-8f0f-45b9-b0c2-5d48602e2511'::uuid,
    '773fa45f-837f-4365-9ae0-67ad9a657e88'::uuid,
    '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00'::uuid,
    '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'::uuid
  ]);

delete from public.cost_allocations
where flock_id = any(array[
    '87170167-8fc5-4cb5-9c37-c427f8204119'::uuid,
    'd170c318-688f-4124-87cb-7b14733377fe'::uuid,
    '0eac1ae3-7415-417a-b8fa-2fbd39f6f4b8'::uuid,
    '1a78ca37-331b-4999-9c43-51097feb82f3'::uuid
  ])
   or batch_id = '9fb49a0e-49c6-4b6a-9524-33959adb2f11'
   or house_id = any(array[
    'c039b2aa-8f0f-45b9-b0c2-5d48602e2511'::uuid,
    '773fa45f-837f-4365-9ae0-67ad9a657e88'::uuid,
    '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00'::uuid,
    '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'::uuid
  ]);

delete from public.cost_entries
where flock_id = any(array[
    '87170167-8fc5-4cb5-9c37-c427f8204119'::uuid,
    'd170c318-688f-4124-87cb-7b14733377fe'::uuid,
    '0eac1ae3-7415-417a-b8fa-2fbd39f6f4b8'::uuid,
    '1a78ca37-331b-4999-9c43-51097feb82f3'::uuid
  ])
   or batch_id = '9fb49a0e-49c6-4b6a-9524-33959adb2f11'
   or house_id = any(array[
    'c039b2aa-8f0f-45b9-b0c2-5d48602e2511'::uuid,
    '773fa45f-837f-4365-9ae0-67ad9a657e88'::uuid,
    '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00'::uuid,
    '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'::uuid
  ]);

delete from public.monthly_cost_periods
where flock_id = any(array[
    '87170167-8fc5-4cb5-9c37-c427f8204119'::uuid,
    'd170c318-688f-4124-87cb-7b14733377fe'::uuid,
    '0eac1ae3-7415-417a-b8fa-2fbd39f6f4b8'::uuid,
    '1a78ca37-331b-4999-9c43-51097feb82f3'::uuid
  ])
   or batch_id = '9fb49a0e-49c6-4b6a-9524-33959adb2f11'
   or house_id = any(array[
    'c039b2aa-8f0f-45b9-b0c2-5d48602e2511'::uuid,
    '773fa45f-837f-4365-9ae0-67ad9a657e88'::uuid,
    '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00'::uuid,
    '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'::uuid
  ]);

delete from public.flocks
where id = any(array[
  '87170167-8fc5-4cb5-9c37-c427f8204119'::uuid,
  'd170c318-688f-4124-87cb-7b14733377fe'::uuid,
  '0eac1ae3-7415-417a-b8fa-2fbd39f6f4b8'::uuid,
  '1a78ca37-331b-4999-9c43-51097feb82f3'::uuid
]);

delete from public.batches where id = '9fb49a0e-49c6-4b6a-9524-33959adb2f11';

delete from public.houses
where id = any(array[
  'c039b2aa-8f0f-45b9-b0c2-5d48602e2511'::uuid,
  '773fa45f-837f-4365-9ae0-67ad9a657e88'::uuid,
  '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00'::uuid,
  '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'::uuid
]);

alter table public.daily_farm_records enable trigger reject_hard_delete;
alter table public.daily_sales_records enable trigger reject_hard_delete;
alter table public.feeding_session_records enable trigger reject_hard_delete;
alter table public.health_events enable trigger reject_hard_delete;
alter table public.vaccination_events enable trigger reject_hard_delete;
alter table public.batch_weight_check_tasks enable trigger reject_hard_delete;
alter table public.batches enable trigger reject_hard_delete;

do $$
begin
  if exists (select 1 from public.batches where id = '9fb49a0e-49c6-4b6a-9524-33959adb2f11')
     or exists (select 1 from public.flocks where id in (
       '87170167-8fc5-4cb5-9c37-c427f8204119', 'd170c318-688f-4124-87cb-7b14733377fe',
       '0eac1ae3-7415-417a-b8fa-2fbd39f6f4b8', '1a78ca37-331b-4999-9c43-51097feb82f3'
     ))
     or exists (select 1 from public.houses where id in (
       'c039b2aa-8f0f-45b9-b0c2-5d48602e2511', '773fa45f-837f-4365-9ae0-67ad9a657e88',
       '8db5daa0-974c-4dbb-bacf-8ebe9c7dcc00', '7ad1ea59-6b6d-44e4-8b98-595cd7e6c52b'
     )) then
    raise exception 'Legacy manual demo cleanup did not remove every target.';
  end if;
end $$;
