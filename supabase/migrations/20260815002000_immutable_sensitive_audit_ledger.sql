-- Item 5: immutable, scoped, tamper-evident audit history.

create extension if not exists pgcrypto;

alter table public.governance_audit_events
  add column if not exists operation text,
  add column if not exists source text not null default 'semantic',
  add column if not exists farm_id uuid,
  add column if not exists house_id uuid,
  add column if not exists flock_id uuid,
  add column if not exists batch_id uuid,
  add column if not exists warehouse_id uuid,
  add column if not exists ledger_scope text,
  add column if not exists sequence_number bigint,
  add column if not exists previous_event_hash text,
  add column if not exists event_hash text;

alter table public.governance_audit_events
  drop constraint if exists governance_audit_operation_valid,
  add constraint governance_audit_operation_valid
    check (operation is null or operation in ('insert', 'update', 'delete', 'execute', 'decision', 'access', 'authentication'));

create or replace function public.audit_event_digest(event public.governance_audit_events)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(convert_to(concat_ws('|',
    coalesce(event.id::text, ''),
    coalesce(event.org_id::text, ''),
    coalesce(event.ledger_scope, ''),
    coalesce(event.sequence_number::text, ''),
    coalesce(event.previous_event_hash, ''),
    coalesce(extract(epoch from event.occurred_at)::text, ''),
    coalesce(event.actor_id::text, ''),
    coalesce(event.actor_role, ''),
    coalesce(event.support_session_id::text, ''),
    coalesce(event.event_type, ''),
    coalesce(event.operation, ''),
    coalesce(event.source, ''),
    coalesce(event.entity_table, ''),
    coalesce(event.entity_id, ''),
    coalesce(event.reason, ''),
    coalesce(event.farm_id::text, ''),
    coalesce(event.house_id::text, ''),
    coalesce(event.flock_id::text, ''),
    coalesce(event.batch_id::text, ''),
    coalesce(event.warehouse_id::text, ''),
    coalesce(event.before_values, '{}'::jsonb)::text,
    coalesce(event.after_values, '{}'::jsonb)::text,
    coalesce(event.metadata, '{}'::jsonb)::text
  ), 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.chain_governance_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_hash text;
  v_previous_sequence bigint;
begin
  -- New evidence always receives the database server's time. Historic rows
  -- keep their original timestamps because the backfill updates in place.
  new.occurred_at := clock_timestamp();
  new.ledger_scope := coalesce(new.org_id::text, 'platform');

  perform pg_advisory_xact_lock(hashtextextended(new.ledger_scope, 0));

  select event_hash, sequence_number
  into v_previous_hash, v_previous_sequence
  from public.governance_audit_events
  where ledger_scope = new.ledger_scope
  order by sequence_number desc nulls last, id desc
  limit 1;

  new.sequence_number := coalesce(v_previous_sequence, 0) + 1;
  new.previous_event_hash := v_previous_hash;
  new.event_hash := public.audit_event_digest(new);
  return new;
end;
$$;

-- Backfill the existing append-only history into one chain per tenant (plus a
-- platform chain). The immutability trigger is disabled only inside this
-- migration transaction.
alter table public.governance_audit_events disable trigger governance_audit_immutable;

do $$
declare
  scope_row record;
  event_row public.governance_audit_events%rowtype;
  v_previous_hash text;
  v_sequence bigint;
begin
  for scope_row in
    select distinct coalesce(org_id::text, 'platform') as ledger_scope
    from public.governance_audit_events
  loop
    v_previous_hash := null;
    v_sequence := 0;

    for event_row in
      select *
      from public.governance_audit_events
      where coalesce(org_id::text, 'platform') = scope_row.ledger_scope
      order by occurred_at, id
    loop
      v_sequence := v_sequence + 1;
      event_row.ledger_scope := scope_row.ledger_scope;
      event_row.sequence_number := v_sequence;
      event_row.previous_event_hash := v_previous_hash;
      event_row.event_hash := public.audit_event_digest(event_row);

      update public.governance_audit_events
      set ledger_scope = event_row.ledger_scope,
          sequence_number = event_row.sequence_number,
          previous_event_hash = event_row.previous_event_hash,
          event_hash = event_row.event_hash
      where id = event_row.id;

      v_previous_hash := event_row.event_hash;
    end loop;
  end loop;
end $$;

alter table public.governance_audit_events enable trigger governance_audit_immutable;

alter table public.governance_audit_events
  alter column ledger_scope set not null,
  alter column sequence_number set not null,
  alter column event_hash set not null;

create unique index if not exists governance_audit_scope_sequence_unique
  on public.governance_audit_events(ledger_scope, sequence_number);
create unique index if not exists governance_audit_event_hash_unique
  on public.governance_audit_events(event_hash);
create index if not exists governance_audit_org_time_idx
  on public.governance_audit_events(org_id, occurred_at desc);
create index if not exists governance_audit_farm_time_idx
  on public.governance_audit_events(farm_id, occurred_at desc)
  where farm_id is not null;
create index if not exists governance_audit_warehouse_time_idx
  on public.governance_audit_events(warehouse_id, occurred_at desc)
  where warehouse_id is not null;

drop trigger if exists governance_audit_chain on public.governance_audit_events;
create trigger governance_audit_chain
before insert on public.governance_audit_events
for each row execute function public.chain_governance_audit_event();

create or replace function public.capture_sensitive_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_payload jsonb;
  v_org_id uuid;
  v_actor_id uuid;
  v_actor_role text;
  v_support_session_id uuid;
  v_farm_id uuid;
  v_house_id uuid;
  v_flock_id uuid;
  v_batch_id uuid;
  v_warehouse_id uuid;
  v_reason text;
  v_entity_id text;
  v_operation text := lower(tg_op);
begin
  v_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_payload := coalesce(v_after, v_before, '{}'::jsonb);

  if tg_op = 'UPDATE' and v_before = v_after then
    return new;
  end if;

  v_org_id := case
    when tg_table_name = 'organizations' then nullif(v_payload->>'id', '')::uuid
    when tg_table_name in ('break_glass_requests', 'break_glass_sessions') then nullif(v_payload->>'target_org_id', '')::uuid
    else nullif(v_payload->>'org_id', '')::uuid
  end;
  if v_org_id is null then
    v_org_id := case
      when tg_table_name in ('batch_feed_template_rows', 'batch_feed_template_milestones') then
        (select org_id from public.batch_feed_templates where id = nullif(v_payload->>'template_id', '')::uuid)
      when tg_table_name = 'journal_entry_lines' then
        (select org_id from public.journal_entries where id = nullif(v_payload->>'journal_entry_id', '')::uuid)
      when tg_table_name = 'lead_activities' then
        (select org_id from public.leads where id = nullif(v_payload->>'lead_id', '')::uuid)
      when tg_table_name = 'package_template_items' then
        (select org_id from public.package_templates where id = nullif(v_payload->>'template_id', '')::uuid)
      when tg_table_name = 'payments' then
        (select org_id from public.sales_orders where id = nullif(v_payload->>'order_id', '')::uuid)
      when tg_table_name = 'pos_items' then
        (select org_id from public.pos_transactions where id = nullif(v_payload->>'transaction_id', '')::uuid)
      when tg_table_name = 'sales_order_items' then
        (select org_id from public.sales_orders where id = nullif(v_payload->>'order_id', '')::uuid)
      else null
    end;
  end if;
  v_entity_id := coalesce(v_payload->>'id', v_payload->>'key', 'unknown');
  v_farm_id := nullif(v_payload->>'farm_id', '')::uuid;
  v_house_id := nullif(v_payload->>'house_id', '')::uuid;
  v_flock_id := nullif(v_payload->>'flock_id', '')::uuid;
  v_batch_id := nullif(v_payload->>'batch_id', '')::uuid;
  v_warehouse_id := nullif(v_payload->>'warehouse_id', '')::uuid;

  v_actor_id := coalesce(
    auth.uid(),
    nullif(current_setting('app.audit_actor_id', true), '')::uuid,
    nullif(v_payload->>'voided_by', '')::uuid,
    nullif(v_payload->>'recorded_by', '')::uuid,
    nullif(v_payload->>'counted_by', '')::uuid,
    nullif(v_payload->>'created_by', '')::uuid,
    nullif(v_payload->>'updated_by', '')::uuid,
    nullif(v_payload->>'actor_id', '')::uuid,
    nullif(v_payload->>'triggered_by', '')::uuid,
    nullif(v_payload->>'submitted_by', '')::uuid,
    nullif(v_payload->>'approved_by', '')::uuid,
    nullif(v_payload->>'closed_by', '')::uuid,
    nullif(v_payload->>'reopened_by', '')::uuid,
    nullif(v_payload->>'received_by', '')::uuid,
    nullif(v_payload->>'completed_by', '')::uuid,
    nullif(v_payload->>'administrator_id', '')::uuid,
    nullif(v_payload->>'requested_by', '')::uuid,
    nullif(v_payload->>'decided_by', '')::uuid,
    nullif(v_payload->>'granted_by', '')::uuid,
    nullif(v_payload->>'revoked_by', '')::uuid
  );

  if v_actor_id is not null then
    select role::text into v_actor_role from public.profiles where id = v_actor_id;
  end if;
  v_actor_role := coalesce(v_actor_role, public.current_active_role(), 'system');
  v_support_session_id := nullif(current_setting('app.support_session_id', true), '')::uuid;

  if v_flock_id is not null and (v_farm_id is null or v_house_id is null or v_batch_id is null) then
    select coalesce(v_farm_id, farm_id), coalesce(v_house_id, house_id), coalesce(v_batch_id, batch_id)
    into v_farm_id, v_house_id, v_batch_id
    from public.flocks where id = v_flock_id;
  end if;
  if v_house_id is not null and v_farm_id is null then
    select farm_id into v_farm_id from public.houses where id = v_house_id;
  end if;
  if v_batch_id is not null and v_farm_id is null then
    select farm_id into v_farm_id from public.batches where id = v_batch_id;
  end if;

  v_reason := coalesce(
    nullif(current_setting('app.audit_reason', true), ''),
    nullif(v_payload->>'void_reason', ''),
    nullif(v_payload->>'revocation_reason', ''),
    nullif(v_payload->>'decision_note', ''),
    nullif(v_payload->>'reason', ''),
    case v_operation
      when 'insert' then 'Routine governed record creation.'
      when 'update' then 'Governed record update.'
      else 'Governed record removal.'
    end
  );

  insert into public.governance_audit_events(
    org_id, actor_id, actor_role, support_session_id,
    event_type, operation, source, entity_table, entity_id, reason,
    farm_id, house_id, flock_id, batch_id, warehouse_id,
    before_values, after_values,
    metadata
  ) values (
    v_org_id, v_actor_id, v_actor_role, v_support_session_id,
    'record.' || v_operation, v_operation, 'database_trigger', tg_table_name, v_entity_id, v_reason,
    v_farm_id, v_house_id, v_flock_id, v_batch_id, v_warehouse_id,
    v_before, v_after,
    jsonb_build_object('schema', tg_table_schema, 'trigger', tg_name)
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'profiles', 'branches', 'farms', 'houses', 'warehouses',
    'batches', 'flocks', 'user_farm_access', 'user_warehouse_access',
    'user_branch_access', 'branch_intake_batches', 'flock_transfers',
    'daily_farm_records', 'daily_egg_records', 'farm_operating_days',
    'feeding_session_records', 'feed_day_closures',
    'weight_records', 'mortality_events', 'health_events', 'vaccination_events',
    'biosecurity_checks', 'batch_weight_check_tasks', 'stock_ledger',
    'inventory_physical_counts', 'inventory_items', 'daily_sales_records',
    'cost_entries', 'cost_allocations', 'monthly_cost_periods',
    'feed_control_settings', 'batch_feed_templates', 'batch_feed_template_rows',
    'batch_feed_template_milestones', 'feed_milestone_executions',
    'feeding_schedules', 'breeds', 'breed_standards', 'management_targets',
    'alert_rules', 'certificates', 'sales_unit_conversions', 'sensors',
    'training_programs', 'training_enrollments', 'visitor_logs',
    'governance_requests', 'break_glass_requests', 'break_glass_sessions',
    'reconciliation_runs', 'reconciliation_findings',
    'reconciliation_finding_responses', 'reconciliation_ai_analyses',
    'customers', 'leads', 'lead_activities', 'sales_orders',
    'sales_order_items', 'payments', 'pos_transactions', 'pos_items',
    'chart_of_accounts', 'journal_entries', 'journal_entry_lines',
    'package_templates', 'package_template_items'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists capture_sensitive_change on public.%I', table_name);
      execute format(
        'create trigger capture_sensitive_change after insert or update or delete on public.%I for each row execute function public.capture_sensitive_row_change()',
        table_name
      );
    end if;
  end loop;
end $$;

drop policy if exists governance_audit_scoped_read on public.governance_audit_events;
create policy governance_audit_scoped_read
on public.governance_audit_events
for select
to authenticated
using (
  (org_id = public.current_org_id() and public.current_active_role() = 'ceo')
  or actor_id = auth.uid()
  or (farm_id is not null and public.has_active_farm_access(farm_id))
  or (warehouse_id is not null and public.has_active_warehouse_access(warehouse_id))
  or (
    public.current_active_role() = 'system_admin'
    and support_session_id is not null
    and exists (
      select 1 from public.break_glass_sessions session
      where session.id = support_session_id
        and session.administrator_id = auth.uid()
        and session.target_org_id = org_id
        and session.revoked_at is null
        and session.started_at <= now()
        and session.expires_at > now()
    )
  )
);

revoke insert, update, delete, truncate on public.governance_audit_events from anon, authenticated;
grant select on public.governance_audit_events to authenticated;

comment on table public.governance_audit_events is
  'Append-only governance and sensitive-record ledger. Automatic entries are atomic with source mutations and every tenant chain is tamper-evident.';
comment on column public.governance_audit_events.event_hash is
  'SHA-256 digest of this event and the previous event hash in the tenant ledger.';
comment on column public.governance_audit_events.source is
  'semantic for explicit workflow events, database_trigger for automatic row-change evidence, or migration for governed maintenance.';

create or replace function public.verify_governance_audit_chain(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is not null and not (
    public.current_active_role() = 'ceo'
    and public.current_org_id() = p_org_id
  ) then
    raise exception 'Only the organization CEO can verify the tenant audit chain.' using errcode = '42501';
  end if;

  with ordered as (
    select
      event as audit_event,
      event.sequence_number,
      event.event_hash,
      event.previous_event_hash,
      lag(event.event_hash) over (order by event.sequence_number) as expected_previous_hash
    from public.governance_audit_events event
    where event.ledger_scope = p_org_id::text
  ), checked as (
    select
      *,
      event_hash = public.audit_event_digest(audit_event) as digest_valid,
      previous_event_hash is not distinct from expected_previous_hash as link_valid
    from ordered
  )
  select jsonb_build_object(
    'valid', coalesce(bool_and(digest_valid and link_valid), true),
    'eventCount', count(*),
    'firstInvalidSequence', min(sequence_number) filter (where not digest_valid or not link_valid),
    'headHash', (array_agg(event_hash order by sequence_number desc))[1],
    'verifiedAt', clock_timestamp()
  )
  into v_result
  from checked;

  return v_result;
end;
$$;

revoke all on function public.verify_governance_audit_chain(uuid) from public, anon;
grant execute on function public.verify_governance_audit_chain(uuid) to authenticated, service_role;
