\set ON_ERROR_STOP on

begin;

-- Fixed, future-dated fixtures keep this test deterministic. Everything is
-- rolled back at the end so staging never retains test organizations or work.
do $$
declare
  v_org_a uuid := '12000000-0000-4000-8000-000000000001';
  v_org_b uuid := '12000000-0000-4000-8000-000000000002';
  v_ceo uuid := '12000000-0000-4000-8000-000000000003';
  v_manager uuid := '12000000-0000-4000-8000-000000000004';
  v_out_of_scope uuid := '12000000-0000-4000-8000-000000000005';
  v_system_admin uuid := '12000000-0000-4000-8000-000000000006';
  v_other_tenant_manager uuid := '12000000-0000-4000-8000-000000000007';
  v_branch_a uuid := '12000000-0000-4000-8000-000000000008';
  v_branch_b uuid := '12000000-0000-4000-8000-000000000009';
  v_farm_active uuid := '12000000-0000-4000-8000-000000000010';
  v_farm_empty uuid := '12000000-0000-4000-8000-000000000011';
  v_farm_other uuid := '12000000-0000-4000-8000-000000000012';
  v_house uuid := '12000000-0000-4000-8000-000000000013';
  v_batch uuid := '12000000-0000-4000-8000-000000000014';
  v_flock uuid := '12000000-0000-4000-8000-000000000015';
  v_day date := date '2099-02-01';
  v_health_fingerprint text;
  v_supplies_fingerprint text;
  v_result jsonb;
  v_replay jsonb;
begin
  insert into public.organizations(id, name) values
    (v_org_a, 'Today foundation integration tenant A'),
    (v_org_b, 'Today foundation integration tenant B');

  insert into public.profiles(id, org_id, full_name, role, is_active) values
    (v_ceo, v_org_a, 'Today Integration CEO', 'ceo', true),
    (v_manager, v_org_a, 'Today Assigned Manager', 'farm_manager', true),
    (v_out_of_scope, v_org_a, 'Today Out Of Scope Manager', 'farm_manager', true),
    (v_system_admin, v_org_a, 'Today System Administrator', 'system_admin', true),
    (v_other_tenant_manager, v_org_b, 'Today Other Tenant Manager', 'farm_manager', true);

  insert into public.branches(id, org_id, name) values
    (v_branch_a, v_org_a, 'Today Integration Branch A'),
    (v_branch_b, v_org_b, 'Today Integration Branch B');
  insert into public.farms(id, org_id, branch_id, name) values
    (v_farm_active, v_org_a, v_branch_a, 'Today Active Farm'),
    (v_farm_empty, v_org_a, v_branch_a, 'Today Empty Farm'),
    (v_farm_other, v_org_b, v_branch_b, 'Today Other Tenant Farm');
  insert into public.houses(id, org_id, branch_id, farm_id, name, house_type)
  values (v_house, v_org_a, v_branch_a, v_farm_active, 'Today Integration House', 'layer');
  insert into public.batches(
    id, org_id, branch_id, farm_id, house_id, batch_code, source,
    placement_date, age_at_placement_days, total_count, status
  ) values (
    v_batch, v_org_a, v_branch_a, v_farm_active, v_house, 'TODAY-FOUNDATION-BATCH',
    'external_purchase', date '2099-01-01', 0, 100, 'active'
  );
  insert into public.flocks(
    id, org_id, farm_id, house_id, batch_id, flock_code, flock_type, source,
    placement_date, initial_count, current_count, age_at_placement_days, status
  ) values (
    v_flock, v_org_a, v_farm_active, v_house, v_batch, 'TODAY-FOUNDATION-FLOCK',
    'layer', 'external_purchase', date '2099-01-01', 100, 100, 0, 'active'
  );
  insert into public.user_farm_access(org_id, profile_id, farm_id, starts_at) values
    (v_org_a, v_manager, v_farm_active, now() - interval '1 day'),
    (v_org_a, v_manager, v_farm_empty, now() - interval '1 day'),
    (v_org_b, v_other_tenant_manager, v_farm_other, now() - interval '1 day');

  v_health_fingerprint := public.today_source_fingerprint(
    v_farm_active, v_flock, v_day, 'health_deaths'
  );
  v_supplies_fingerprint := public.today_source_fingerprint(
    v_farm_active, v_flock, v_day, 'routine_supplies'
  );

  -- Same command and payload replays the stored result without creating a
  -- second attestation.
  v_result := public.apply_daily_task_attestation_v1(
    v_manager,
    '12000000-0000-4000-8000-000000000101',
    1,
    'confirm_no_activity',
    jsonb_build_object('task_code', 'health_deaths', 'answer', 'none'),
    v_farm_active,
    v_flock,
    v_day,
    'health_deaths',
    v_health_fingerprint
  );
  v_replay := public.apply_daily_task_attestation_v1(
    v_manager,
    '12000000-0000-4000-8000-000000000101',
    1,
    'confirm_no_activity',
    jsonb_build_object('answer', 'none', 'task_code', 'health_deaths'),
    v_farm_active,
    v_flock,
    v_day,
    'health_deaths',
    v_health_fingerprint
  );
  if v_result is distinct from v_replay then
    raise exception 'Same-payload attestation replay returned a different result.';
  end if;
  if (select count(*) from public.daily_task_attestations
      where org_id = v_org_a and farm_id = v_farm_active and flock_id = v_flock
        and work_date = v_day and task_code = 'health_deaths' and superseded_at is null) <> 1 then
    raise exception 'Same-payload replay duplicated the active attestation.';
  end if;

  begin
    perform public.apply_daily_task_attestation_v1(
      v_manager,
      '12000000-0000-4000-8000-000000000101',
      1,
      'confirm_no_activity',
      jsonb_build_object('task_code', 'health_deaths', 'answer', 'changed'),
      v_farm_active,
      v_flock,
      v_day,
      'health_deaths',
      v_health_fingerprint
    );
    raise exception 'A command ID was reused with a changed payload.';
  exception when sqlstate '22023' then
    if sqlerrm not like 'This command ID was already used%' then raise; end if;
  end;

  begin
    perform public.apply_daily_task_attestation_v1(
      v_manager,
      '12000000-0000-4000-8000-000000000102',
      1,
      'confirm_no_activity',
      jsonb_build_object('task_code', 'routine_supplies', 'answer', 'none'),
      v_farm_active,
      v_flock,
      v_day,
      'routine_supplies',
      repeat('0', 64)
    );
    raise exception 'A stale source fingerprint was accepted.';
  exception when sqlstate '40001' then
    if sqlerrm not like 'The source records changed%' then raise; end if;
  end;

  perform public.apply_daily_task_attestation_v1(
    v_manager,
    '12000000-0000-4000-8000-000000000103',
    1,
    'confirm_no_activity',
    jsonb_build_object('task_code', 'routine_supplies', 'answer', 'none'),
    v_farm_active,
    v_flock,
    v_day,
    'routine_supplies',
    v_supplies_fingerprint
  );

  -- Seed server-owned evidence used by the RLS checks below. The extra rows
  -- deliberately belong to a same-tenant unassigned user and another tenant.
  insert into public.client_operation_receipts(
    org_id, actor_id, command_id, schema_version, command_type, payload_hash, result, completed_at
  ) values
    (v_org_a, v_out_of_scope, '12000000-0000-4000-8000-000000000104', 1,
      'test_out_of_scope', repeat('a', 64), '{"status":"applied"}', now()),
    (v_org_b, v_other_tenant_manager, '12000000-0000-4000-8000-000000000105', 1,
      'test_other_tenant', repeat('b', 64), '{"status":"applied"}', now());
  insert into public.daily_task_attestations(
    org_id, farm_id, flock_id, work_date, task_code, source_fingerprint, confirmed_by
  ) values (
    v_org_b, v_farm_other, null, v_day, 'no_active_flock', repeat('c', 64), v_other_tenant_manager
  );
end;
$$;

create temporary table today_test_revisions (
  scope text primary key,
  revision text not null
) on commit drop;
insert into today_test_revisions(scope, revision) values (
  'active_missing',
  public.today_resource_revision(
    'operating_day', '12000000-0000-4000-8000-000000000010', date '2099-02-01'
  )
);
grant select on today_test_revisions to authenticated;

-- Assigned Farm Manager: own receipts and assigned-farm attestations only.
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.client_operation_receipts) <> 2 then
    raise exception 'Assigned manager receipt visibility is not actor-scoped.';
  end if;
  if (select count(*) from public.daily_task_attestations) <> 2 then
    raise exception 'Assigned manager cannot read the assigned farm attestations.';
  end if;
  begin
    insert into public.client_operation_receipts(
      org_id, actor_id, command_id, schema_version, command_type, payload_hash
    ) values (
      '12000000-0000-4000-8000-000000000001',
      '12000000-0000-4000-8000-000000000004',
      '12000000-0000-4000-8000-000000000106', 1, 'forbidden_direct_write', repeat('d', 64)
    );
    raise exception 'Authenticated direct receipt insert was accepted.';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- CEO: all evidence in their tenant, none from another tenant.
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.client_operation_receipts) <> 3 then
    raise exception 'CEO cannot read all same-tenant receipts or can read cross-tenant receipts.';
  end if;
  if (select count(*) from public.daily_task_attestations) <> 2 then
    raise exception 'CEO attestation visibility crossed the tenant boundary.';
  end if;
end;
$$;
reset role;

-- Same-tenant but unassigned Farm Manager: only their own receipt, no farm evidence.
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.client_operation_receipts) <> 1 then
    raise exception 'Out-of-scope manager receipt visibility is incorrect.';
  end if;
  if (select count(*) from public.daily_task_attestations) <> 0 then
    raise exception 'Out-of-scope manager can read farm attestations.';
  end if;
end;
$$;
reset role;

-- System Admin has no tenant-business read path without break-glass evidence.
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.client_operation_receipts) <> 0
     or (select count(*) from public.daily_task_attestations) <> 0 then
    raise exception 'System Admin can read tenant evidence without break glass.';
  end if;
end;
$$;
reset role;

-- Other tenant manager sees only their own tenant evidence.
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.client_operation_receipts) <> 1
     or (select count(*) from public.daily_task_attestations) <> 1 then
    raise exception 'Cross-tenant evidence isolation failed.';
  end if;
end;
$$;
reset role;

-- Finish Day rejects missing authoritative work before it can close anything.
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare
  v_revision text;
begin
  select revision into v_revision from today_test_revisions where scope = 'active_missing';
  begin
    perform public.finish_farm_operating_day_v1(
      '12000000-0000-4000-8000-000000000004',
      '12000000-0000-4000-8000-000000000201',
      1,
      jsonb_build_object('farm_id', '12000000-0000-4000-8000-000000000010', 'date', '2099-02-01'),
      '12000000-0000-4000-8000-000000000010',
      date '2099-02-01',
      v_revision
    );
    raise exception 'Finish Day accepted missing Daily Record and feed work.';
  exception when sqlstate '23514' then
    if sqlerrm not like 'A Daily Record is still missing%' then raise; end if;
  end;
end;
$$;
reset role;

do $$
declare
  v_org uuid := '12000000-0000-4000-8000-000000000001';
  v_manager uuid := '12000000-0000-4000-8000-000000000004';
  v_batch uuid := '12000000-0000-4000-8000-000000000014';
  v_flock uuid := '12000000-0000-4000-8000-000000000015';
  v_day date := date '2099-02-01';
begin
  insert into public.daily_farm_records(
    org_id, flock_id, record_date, opening_birds, closing_birds, deaths, recorded_by
  ) values (v_org, v_flock, v_day, 100, 100, 0, v_manager);
  insert into public.feed_day_closures(
    org_id, batch_id, flock_id, record_date, status, planned_feed_kg,
    actual_feed_kg, variance_kg, closed_by, closed_at
  ) values (v_org, v_batch, v_flock, v_day, 'closed', 10, 10, 0, v_manager, now());
end;
$$;

do $$
declare
  v_manager uuid := '12000000-0000-4000-8000-000000000004';
  v_farm uuid := '12000000-0000-4000-8000-000000000010';
  v_flock uuid := '12000000-0000-4000-8000-000000000015';
  v_day date := date '2099-02-01';
begin
  -- The new Daily Record changes both source fingerprints. Reconfirming the
  -- tasks supersedes stale evidence and proves Finish Day accepts only the
  -- attestation matching the current authoritative source state.
  perform public.apply_daily_task_attestation_v1(
    v_manager,
    '12000000-0000-4000-8000-000000000107',
    1,
    'confirm_no_activity',
    jsonb_build_object('task_code', 'health_deaths', 'answer', 'none'),
    v_farm,
    v_flock,
    v_day,
    'health_deaths',
    public.today_source_fingerprint(v_farm, v_flock, v_day, 'health_deaths')
  );
  perform public.apply_daily_task_attestation_v1(
    v_manager,
    '12000000-0000-4000-8000-000000000108',
    1,
    'confirm_no_activity',
    jsonb_build_object('task_code', 'routine_supplies', 'answer', 'none'),
    v_farm,
    v_flock,
    v_day,
    'routine_supplies',
    public.today_source_fingerprint(v_farm, v_flock, v_day, 'routine_supplies')
  );
  if (select count(*) from public.daily_task_attestations
      where farm_id = v_farm and flock_id = v_flock and work_date = v_day
        and superseded_at is not null) <> 2 then
    raise exception 'Source-changing work did not supersede the two stale attestations.';
  end if;
end;
$$;

insert into today_test_revisions(scope, revision) values
  (
    'active_ready',
    public.today_resource_revision(
      'operating_day', '12000000-0000-4000-8000-000000000010', date '2099-02-01'
    )
  ),
  (
    'empty_ready',
    public.today_resource_revision(
      'operating_day', '12000000-0000-4000-8000-000000000011', date '2099-02-01'
    )
  );

-- A stale revision fails; complete evidence closes once; identical replay
-- returns the stored result; a fresh command cannot close the day again.
set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare
  v_active_farm uuid := '12000000-0000-4000-8000-000000000010';
  v_empty_farm uuid := '12000000-0000-4000-8000-000000000011';
  v_manager uuid := '12000000-0000-4000-8000-000000000004';
  v_day date := date '2099-02-01';
  v_revision text;
  v_payload jsonb;
  v_result jsonb;
  v_replay jsonb;
begin
  begin
    perform public.finish_farm_operating_day_v1(
      v_manager,
      '12000000-0000-4000-8000-000000000202',
      1,
      jsonb_build_object('farm_id', v_empty_farm, 'date', v_day),
      v_empty_farm,
      v_day,
      repeat('0', 64)
    );
    raise exception 'Finish Day accepted a stale operating-day revision.';
  exception when sqlstate '40001' then
    if sqlerrm not like 'The operating day changed%' then raise; end if;
  end;

  select revision into v_revision from today_test_revisions where scope = 'active_ready';
  v_payload := jsonb_build_object('farm_id', v_active_farm, 'date', v_day);
  v_result := public.finish_farm_operating_day_v1(
    v_manager,
    '12000000-0000-4000-8000-000000000203',
    1,
    v_payload,
    v_active_farm,
    v_day,
    v_revision
  );
  v_replay := public.finish_farm_operating_day_v1(
    v_manager,
    '12000000-0000-4000-8000-000000000203',
    1,
    jsonb_build_object('date', v_day, 'farm_id', v_active_farm),
    v_active_farm,
    v_day,
    v_revision
  );
  if v_result is distinct from v_replay or v_result->>'status' <> 'applied' then
    raise exception 'Finish Day replay did not return the original applied result.';
  end if;
  if not exists (
    select 1 from public.farm_operating_days
    where farm_id = v_active_farm and operating_date = v_day and status = 'closed'
  ) then
    raise exception 'Finish Day did not close the active-flock operating day.';
  end if;
  if not exists (select 1 from pg_locks where locktype = 'advisory' and granted) then
    raise exception 'Finish Day did not retain its transaction-scoped concurrency lock.';
  end if;

end;
$$;
reset role;

insert into today_test_revisions(scope, revision) values (
  'active_closed',
  public.today_resource_revision(
    'operating_day', '12000000-0000-4000-8000-000000000010', date '2099-02-01'
  )
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"12000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
declare
  v_active_farm uuid := '12000000-0000-4000-8000-000000000010';
  v_empty_farm uuid := '12000000-0000-4000-8000-000000000011';
  v_manager uuid := '12000000-0000-4000-8000-000000000004';
  v_day date := date '2099-02-01';
  v_revision text;
  v_result jsonb;
begin
  select revision into v_revision from today_test_revisions where scope = 'active_closed';
  begin
    perform public.finish_farm_operating_day_v1(
      v_manager,
      '12000000-0000-4000-8000-000000000204',
      1,
      jsonb_build_object('farm_id', v_active_farm, 'date', v_day),
      v_active_farm,
      v_day,
      v_revision
    );
    raise exception 'A new command closed an already closed operating day.';
  exception when unique_violation then
    if sqlerrm not like 'This operating day is already closed%' then raise; end if;
  end;

  -- A farm with no applicable flock can still finish after fresh server
  -- revalidation; farm-level optional work remains available independently.
  select revision into v_revision from today_test_revisions where scope = 'empty_ready';
  v_result := public.finish_farm_operating_day_v1(
    v_manager,
    '12000000-0000-4000-8000-000000000205',
    1,
    jsonb_build_object('farm_id', v_empty_farm, 'date', v_day),
    v_empty_farm,
    v_day,
    v_revision
  );
  if v_result->>'status' <> 'applied' or not exists (
    select 1 from public.farm_operating_days
    where farm_id = v_empty_farm and operating_date = v_day and status = 'closed'
  ) then
    raise exception 'No-active-flock Finish Day did not close successfully.';
  end if;
end;
$$;
reset role;

do $$
begin
  raise notice 'Today RLS, idempotency, attestation, revision, and Finish Day integration checks passed.';
end;
$$;

rollback;
