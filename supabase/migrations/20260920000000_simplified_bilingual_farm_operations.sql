-- Simplified bilingual farm operations foundation.
-- Additive only: the legacy operational routes and ledgers remain authoritative.

alter table public.profiles
  add column if not exists preferred_locale text not null default 'en';

alter table public.profiles
  drop constraint if exists profiles_preferred_locale_valid;
alter table public.profiles
  add constraint profiles_preferred_locale_valid
  check (preferred_locale in ('en', 'am'));

alter table public.organizations
  add column if not exists today_workspace_enabled boolean not null default false,
  add column if not exists today_pilot_accepted_at timestamptz,
  add column if not exists simplified_ceo_workspace_enabled boolean not null default false;

alter table public.organizations
  drop constraint if exists organizations_ceo_workspace_requires_pilot;
alter table public.organizations
  add constraint organizations_ceo_workspace_requires_pilot
  check (not simplified_ceo_workspace_enabled or today_pilot_accepted_at is not null);

create table if not exists public.client_operation_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  command_id uuid not null,
  schema_version integer not null,
  command_type text not null,
  payload_hash text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint client_operation_receipts_schema_version_valid check (schema_version = 1),
  constraint client_operation_receipts_command_type_present check (length(btrim(command_type)) > 0),
  constraint client_operation_receipts_payload_hash_valid check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint client_operation_receipts_actor_command_unique unique (org_id, actor_id, command_id)
);

create index if not exists client_operation_receipts_actor_created_idx
  on public.client_operation_receipts(org_id, actor_id, created_at desc);

create table if not exists public.daily_task_attestations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  flock_id uuid references public.flocks(id) on delete cascade,
  work_date date not null,
  task_code text not null,
  source_fingerprint text not null,
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_at timestamptz,
  constraint daily_task_attestations_task_code_valid
    check (task_code in ('health_deaths', 'routine_supplies', 'no_active_flock')),
  constraint daily_task_attestations_source_fingerprint_valid
    check (source_fingerprint ~ '^[0-9a-f]{64}$')
);

create unique index if not exists daily_task_attestations_active_unique
  on public.daily_task_attestations(
    org_id,
    farm_id,
    coalesce(flock_id, '00000000-0000-0000-0000-000000000000'::uuid),
    work_date,
    task_code
  ) where superseded_at is null;

create index if not exists daily_task_attestations_workspace_idx
  on public.daily_task_attestations(org_id, farm_id, work_date, task_code)
  where superseded_at is null;

comment on column public.profiles.preferred_locale is
  'Preferred authenticated interface locale. English and Amharic are supported.';
comment on column public.organizations.today_workspace_enabled is
  'Tenant release gate for the simplified Farm Manager Today workspace.';
comment on column public.organizations.simplified_ceo_workspace_enabled is
  'Tenant release gate for the later CEO simplification; requires accepted Today pilot evidence.';
comment on table public.client_operation_receipts is
  'Server-owned idempotency evidence for Today commands. A command ID cannot be reused with a different payload.';
comment on table public.daily_task_attestations is
  'Explicit no-activity evidence for Today tasks whose absence would otherwise be ambiguous.';

alter table public.client_operation_receipts enable row level security;
alter table public.daily_task_attestations enable row level security;

drop policy if exists client_operation_receipts_scoped_read on public.client_operation_receipts;
create policy client_operation_receipts_scoped_read
  on public.client_operation_receipts for select to authenticated
  using (
    (org_id = public.current_org_id() and (
      actor_id = auth.uid()
      or public.current_active_role() = 'ceo'
    ))
    or public.has_active_break_glass(org_id)
  );

drop policy if exists daily_task_attestations_scoped_read on public.daily_task_attestations;
create policy daily_task_attestations_scoped_read
  on public.daily_task_attestations for select to authenticated
  using (
    (org_id = public.current_org_id() and (
      public.current_active_role() = 'ceo'
      or (confirmed_by = auth.uid() and public.has_active_farm_access(farm_id))
      or public.has_active_farm_access(farm_id)
    ))
    or public.has_active_break_glass(org_id)
  );

revoke insert, update, delete on public.client_operation_receipts, public.daily_task_attestations
  from anon, authenticated;
grant select on public.client_operation_receipts, public.daily_task_attestations to authenticated;

create or replace function public.canonical_today_payload_hash(p_payload jsonb)
returns text
language sql immutable strict
set search_path = public, extensions
as $$
  select encode(extensions.digest(convert_to(p_payload::text, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function public.today_source_fingerprint(
  p_farm_id uuid,
  p_flock_id uuid,
  p_work_date date,
  p_task_code text
) returns text
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_org_id uuid;
  v_payload jsonb;
begin
  select org_id into v_org_id from public.farms where id = p_farm_id;
  if v_org_id is null then
    raise exception 'Farm not found.' using errcode = 'P0002';
  end if;
  if p_flock_id is not null and not exists (
    select 1 from public.flocks
    where id = p_flock_id and farm_id = p_farm_id and org_id = v_org_id
  ) then
    raise exception 'Flock is outside the selected farm.' using errcode = '42501';
  end if;
  if p_task_code not in ('health_deaths', 'routine_supplies', 'no_active_flock') then
    raise exception 'Unsupported Today task.' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'farm', p_farm_id,
    'flock', p_flock_id,
    'date', p_work_date,
    'task', p_task_code,
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id,
        'updated_at', d.updated_at,
        'deaths', d.deaths,
        'voided_at', d.voided_at
      ) order by d.id)
      from public.daily_farm_records d
      where d.org_id = v_org_id
        and d.record_date = p_work_date
        and (p_flock_id is null or d.flock_id = p_flock_id)
    ), '[]'::jsonb),
    'mortality', case when p_task_code = 'health_deaths' then coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'updated_at', m.updated_at, 'count', m.count) order by m.id)
      from public.mortality_events m
      join public.flocks f on f.id = m.flock_id
      where m.org_id = v_org_id and f.farm_id = p_farm_id
        and m.record_date = p_work_date
        and (p_flock_id is null or m.flock_id = p_flock_id)
    ), '[]'::jsonb) else '[]'::jsonb end,
    'health', case when p_task_code = 'health_deaths' then coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'updated_at', h.updated_at, 'voided_at', h.voided_at) order by h.id)
      from public.health_events h
      join public.flocks f on f.id = h.flock_id
      where h.org_id = v_org_id and f.farm_id = p_farm_id
        and h.event_date = p_work_date
        and (p_flock_id is null or h.flock_id = p_flock_id)
    ), '[]'::jsonb) else '[]'::jsonb end,
    'supplies', case when p_task_code = 'routine_supplies' then coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'updated_at', s.updated_at, 'quantity', s.quantity) order by s.id)
      from public.stock_ledger s
      where s.org_id = v_org_id and s.farm_id = p_farm_id
        and s.transaction_date = p_work_date
        and s.source_kind = 'daily_record_usage'
        and (p_flock_id is null or s.flock_id = p_flock_id)
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into v_payload;

  return public.canonical_today_payload_hash(v_payload);
end
$$;

create or replace function public.today_resource_revision(
  p_resource_type text,
  p_resource_id uuid,
  p_work_date date default null
) returns text
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare
  v_payload jsonb;
begin
  if p_resource_type = 'daily_record' then
    select to_jsonb(d) into v_payload from public.daily_farm_records d where d.id = p_resource_id;
  elsif p_resource_type = 'feed_day' then
    select coalesce(jsonb_agg(to_jsonb(c) order by c.id), '[]'::jsonb) into v_payload
    from public.feed_day_closures c
    where c.flock_id = p_resource_id and c.record_date = p_work_date;
  elsif p_resource_type = 'operating_day' then
    select jsonb_build_object(
      'day', coalesce((
        select to_jsonb(d) from public.farm_operating_days d
        where d.farm_id = p_resource_id and d.operating_date = p_work_date
      ), jsonb_build_object('farm_id', p_resource_id, 'operating_date', p_work_date, 'status', 'missing')),
      'flocks', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'status', f.status, 'updated_at', f.updated_at) order by f.id)
        from public.flocks f where f.farm_id = p_resource_id and f.placement_date <= p_work_date
      ), '[]'::jsonb),
      'daily', coalesce((
        select jsonb_agg(jsonb_build_object('id', d.id, 'updated_at', d.updated_at, 'voided_at', d.voided_at) order by d.id)
        from public.daily_farm_records d join public.flocks f on f.id = d.flock_id
        where f.farm_id = p_resource_id and d.record_date = p_work_date
      ), '[]'::jsonb),
      'feed', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'status', c.status, 'updated_at', c.updated_at) order by c.id)
        from public.feed_day_closures c join public.flocks f on f.id = c.flock_id
        where f.farm_id = p_resource_id and c.record_date = p_work_date
      ), '[]'::jsonb),
      'attestations', coalesce((
        select jsonb_agg(jsonb_build_object('id', a.id, 'fingerprint', a.source_fingerprint, 'updated_at', a.updated_at, 'superseded_at', a.superseded_at) order by a.id)
        from public.daily_task_attestations a
        where a.farm_id = p_resource_id and a.work_date = p_work_date
      ), '[]'::jsonb)
    ) into v_payload;
  elsif p_resource_type = 'flock' then
    select to_jsonb(f) into v_payload from public.flocks f where f.id = p_resource_id;
  else
    raise exception 'Unsupported revision resource type.' using errcode = '22023';
  end if;
  if v_payload is null then
    raise exception 'Revision resource not found.' using errcode = 'P0002';
  end if;
  return public.canonical_today_payload_hash(v_payload);
end
$$;

create or replace function public.apply_daily_task_attestation_v1(
  p_actor_id uuid,
  p_command_id uuid,
  p_schema_version integer,
  p_command_type text,
  p_payload jsonb,
  p_farm_id uuid,
  p_flock_id uuid,
  p_work_date date,
  p_task_code text,
  p_expected_source_fingerprint text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_hash text;
  v_current_fingerprint text;
  v_receipt public.client_operation_receipts;
  v_attestation public.daily_task_attestations;
  v_result jsonb;
begin
  if p_schema_version <> 1 or p_command_type <> 'confirm_no_activity' then
    raise exception 'Unsupported Today command version or type.' using errcode = '22023';
  end if;
  select org_id, role::text into v_org_id, v_role
  from public.profiles where id = p_actor_id and is_active;
  if v_org_id is null or v_role <> 'farm_manager' then
    raise exception 'Only an active Farm Manager can confirm daily work.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.farms where id = p_farm_id and org_id = v_org_id
  ) or not exists (
    select 1 from public.user_farm_access a
    where a.org_id = v_org_id and a.profile_id = p_actor_id and a.farm_id = p_farm_id
      and a.revoked_at is null and a.starts_at <= now()
      and (a.expires_at is null or a.expires_at > now())
  ) then
    raise exception 'An active farm assignment is required.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.farm_operating_days
    where farm_id = p_farm_id and operating_date = p_work_date and status in ('closed', 'locked')
  ) then
    raise exception 'This operating day is not open.' using errcode = '55000';
  end if;

  v_hash := public.canonical_today_payload_hash(p_payload);
  select * into v_receipt from public.client_operation_receipts
  where org_id = v_org_id and actor_id = p_actor_id and command_id = p_command_id
  for update;
  if found then
    if v_receipt.payload_hash <> v_hash then
      raise exception 'This command ID was already used with a different payload.' using errcode = '22023';
    end if;
    if v_receipt.result is not null then return v_receipt.result; end if;
  else
    insert into public.client_operation_receipts(
      org_id, actor_id, command_id, schema_version, command_type, payload_hash
    ) values (
      v_org_id, p_actor_id, p_command_id, p_schema_version, p_command_type, v_hash
    ) returning * into v_receipt;
  end if;

  v_current_fingerprint := public.today_source_fingerprint(p_farm_id, p_flock_id, p_work_date, p_task_code);
  if v_current_fingerprint <> p_expected_source_fingerprint then
    raise exception 'The source records changed. Refresh before confirming.' using errcode = '40001';
  end if;

  update public.daily_task_attestations
  set superseded_at = now(), updated_at = now()
  where org_id = v_org_id and farm_id = p_farm_id
    and flock_id is not distinct from p_flock_id
    and work_date = p_work_date and task_code = p_task_code
    and superseded_at is null;

  insert into public.daily_task_attestations(
    org_id, farm_id, flock_id, work_date, task_code, source_fingerprint, confirmed_by
  ) values (
    v_org_id, p_farm_id, p_flock_id, p_work_date, p_task_code,
    v_current_fingerprint, p_actor_id
  ) returning * into v_attestation;

  v_result := jsonb_build_object(
    'command_id', p_command_id,
    'status', 'applied',
    'source_ref', 'daily_task_attestations/' || v_attestation.id::text,
    'resource_revision', public.canonical_today_payload_hash(to_jsonb(v_attestation))
  );
  update public.client_operation_receipts
  set result = v_result, completed_at = now()
  where id = v_receipt.id;
  return v_result;
end
$$;

create or replace function public.finish_farm_operating_day_v1(
  p_actor_id uuid,
  p_command_id uuid,
  p_schema_version integer,
  p_payload jsonb,
  p_farm_id uuid,
  p_operating_date date,
  p_expected_revision text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_hash text;
  v_current_revision text;
  v_receipt public.client_operation_receipts;
  v_flock record;
  v_fingerprint text;
  v_day public.farm_operating_days;
  v_result jsonb;
begin
  if p_schema_version <> 1 then
    raise exception 'Unsupported Today command version.' using errcode = '22023';
  end if;
  select org_id, role::text into v_org_id, v_role
  from public.profiles where id = p_actor_id and is_active;
  if v_org_id is null or v_role <> 'farm_manager' or auth.uid() is distinct from p_actor_id then
    raise exception 'Only the signed-in Farm Manager can finish the day.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.farms where id = p_farm_id and org_id = v_org_id
  ) or not exists (
    select 1 from public.user_farm_access a
    where a.org_id = v_org_id and a.profile_id = p_actor_id and a.farm_id = p_farm_id
      and a.revoked_at is null and a.starts_at <= now()
      and (a.expires_at is null or a.expires_at > now())
  ) then
    raise exception 'An active farm assignment is required.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_farm_id::text || ':' || p_operating_date::text, 0));
  v_hash := public.canonical_today_payload_hash(p_payload);
  select * into v_receipt from public.client_operation_receipts
  where org_id = v_org_id and actor_id = p_actor_id and command_id = p_command_id
  for update;
  if found then
    if v_receipt.payload_hash <> v_hash then
      raise exception 'This command ID was already used with a different payload.' using errcode = '22023';
    end if;
    if v_receipt.result is not null then return v_receipt.result; end if;
  else
    insert into public.client_operation_receipts(
      org_id, actor_id, command_id, schema_version, command_type, payload_hash
    ) values (
      v_org_id, p_actor_id, p_command_id, p_schema_version, 'finish_operating_day', v_hash
    ) returning * into v_receipt;
  end if;

  v_current_revision := public.today_resource_revision('operating_day', p_farm_id, p_operating_date);
  if v_current_revision <> p_expected_revision then
    raise exception 'The operating day changed. Refresh before finishing.' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.farm_operating_days
    where farm_id = p_farm_id and operating_date = p_operating_date and status = 'closed'
  ) then
    raise exception 'This operating day is already closed.' using errcode = '23505';
  end if;

  for v_flock in
    select f.id
    from public.flocks f
    where f.org_id = v_org_id and f.farm_id = p_farm_id
      and f.status = 'active' and f.placement_date <= p_operating_date
  loop
    if not exists (
      select 1 from public.daily_farm_records d
      where d.org_id = v_org_id and d.flock_id = v_flock.id
        and d.record_date = p_operating_date and d.voided_at is null
    ) then
      raise exception 'A Daily Record is still missing.' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.feed_day_closures c
      where c.org_id = v_org_id and c.flock_id = v_flock.id
        and c.record_date = p_operating_date and c.status = 'closed'
    ) then
      raise exception 'A feeding day is still open.' using errcode = '23514';
    end if;

    v_fingerprint := public.today_source_fingerprint(p_farm_id, v_flock.id, p_operating_date, 'health_deaths');
    if not exists (
      select 1 from public.mortality_events m
      where m.org_id = v_org_id and m.flock_id = v_flock.id and m.record_date = p_operating_date
    ) and not exists (
      select 1 from public.health_events h
      where h.org_id = v_org_id and h.flock_id = v_flock.id and h.event_date = p_operating_date
        and h.voided_at is null
    ) and not exists (
      select 1 from public.daily_farm_records d
      where d.org_id = v_org_id and d.flock_id = v_flock.id and d.record_date = p_operating_date
        and d.voided_at is null and coalesce(d.deaths, 0) > 0
    ) and not exists (
      select 1 from public.daily_task_attestations a
      where a.org_id = v_org_id and a.farm_id = p_farm_id and a.flock_id = v_flock.id
        and a.work_date = p_operating_date and a.task_code = 'health_deaths'
        and a.superseded_at is null and a.source_fingerprint = v_fingerprint
    ) then
      raise exception 'Confirm health and deaths for every flock.' using errcode = '23514';
    end if;

    v_fingerprint := public.today_source_fingerprint(p_farm_id, v_flock.id, p_operating_date, 'routine_supplies');
    if not exists (
      select 1 from public.stock_ledger s
      where s.org_id = v_org_id and s.farm_id = p_farm_id and s.flock_id = v_flock.id
        and s.transaction_date = p_operating_date and s.source_kind = 'daily_record_usage'
    ) and not exists (
      select 1 from public.daily_task_attestations a
      where a.org_id = v_org_id and a.farm_id = p_farm_id and a.flock_id = v_flock.id
        and a.work_date = p_operating_date and a.task_code = 'routine_supplies'
        and a.superseded_at is null and a.source_fingerprint = v_fingerprint
    ) then
      raise exception 'Confirm routine supplies for every flock.' using errcode = '23514';
    end if;
  end loop;

  select public.close_farm_operating_day(p_farm_id, p_operating_date, '[]'::jsonb) into v_day;
  v_result := jsonb_build_object(
    'command_id', p_command_id,
    'status', 'applied',
    'source_ref', 'farm_operating_days/' || v_day.id::text,
    'resource_revision', public.today_resource_revision('operating_day', p_farm_id, p_operating_date),
    'operating_day_revision', public.today_resource_revision('operating_day', p_farm_id, p_operating_date)
  );
  update public.client_operation_receipts
  set result = v_result, completed_at = now()
  where id = v_receipt.id;
  return v_result;
end
$$;

create or replace function public.execute_today_command_v1(
  p_actor_id uuid,
  p_command jsonb
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_command_id uuid;
  v_command_type text;
  v_farm_id uuid;
  v_flock_id uuid;
  v_work_date date;
  v_payload jsonb;
  v_hash text;
  v_receipt public.client_operation_receipts;
  v_domain_result jsonb;
  v_source_ref text;
  v_row_id uuid;
  v_batch_id uuid;
  v_branch_id uuid;
  v_house_id uuid;
  v_warehouse_id uuid;
  v_item_id uuid;
  v_scope record;
  v_action public.operational_actions;
  v_before_status text;
  v_after_status text;
  v_event_type text;
  v_actor_name text;
  v_expected_revision text;
  v_current_revision text;
  v_result jsonb;
begin
  if coalesce((p_command->>'schema_version')::integer, 0) <> 1 then
    raise exception 'Unsupported Today command version.' using errcode = '22023';
  end if;
  v_command_id := nullif(p_command->>'command_id', '')::uuid;
  v_command_type := nullif(btrim(p_command->>'type'), '');
  v_farm_id := nullif(p_command->>'farm_id', '')::uuid;
  v_flock_id := nullif(p_command->>'flock_id', '')::uuid;
  v_work_date := nullif(p_command->>'work_date', '')::date;
  v_payload := coalesce(p_command->'payload', '{}'::jsonb);
  if v_command_id is null or v_command_type is null or v_farm_id is null or v_work_date is null then
    raise exception 'Command ID, type, farm, and work date are required.' using errcode = '22023';
  end if;
  if v_command_type not in (
    'save_daily_record', 'save_feed_session', 'close_feed_day',
    'record_mortality_event', 'record_health_event', 'complete_vaccination',
    'record_stock_receipt', 'record_sale', 'record_expense', 'update_assigned_action'
  ) then
    raise exception 'Unsupported Today command type.' using errcode = '22023';
  end if;

  select org_id, role::text, coalesce(nullif(btrim(full_name), ''), 'Farm Manager')
  into v_org_id, v_role, v_actor_name
  from public.profiles where id = p_actor_id and is_active;
  if v_org_id is null or v_role <> 'farm_manager' then
    raise exception 'Only an active Farm Manager can submit Today work.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.farms where id = v_farm_id and org_id = v_org_id
  ) or not exists (
    select 1 from public.user_farm_access a
    where a.org_id = v_org_id and a.profile_id = p_actor_id and a.farm_id = v_farm_id
      and a.revoked_at is null and a.starts_at <= now()
      and (a.expires_at is null or a.expires_at > now())
  ) then
    raise exception 'An active farm assignment is required.' using errcode = '42501';
  end if;
  if v_flock_id is not null then
    select f.batch_id, f.house_id, h.branch_id into v_batch_id, v_house_id, v_branch_id
    from public.flocks f join public.houses h on h.id = f.house_id
    where f.id = v_flock_id and f.org_id = v_org_id and f.farm_id = v_farm_id;
    if not found then raise exception 'The flock is outside the selected farm.' using errcode = '42501'; end if;
  else
    select branch_id into v_branch_id from public.farms where id = v_farm_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('today-command:' || v_command_id::text, 0));
  v_hash := public.canonical_today_payload_hash(p_command);
  select * into v_receipt from public.client_operation_receipts
  where org_id = v_org_id and actor_id = p_actor_id and command_id = v_command_id
  for update;
  if found then
    if v_receipt.payload_hash <> v_hash then
      raise exception 'This command ID was already used with a different payload.' using errcode = '22023';
    end if;
    if v_receipt.result is not null then return v_receipt.result; end if;
  else
    insert into public.client_operation_receipts(
      org_id, actor_id, command_id, schema_version, command_type, payload_hash
    ) values (v_org_id, p_actor_id, v_command_id, 1, v_command_type, v_hash)
    returning * into v_receipt;
  end if;

  if v_command_type not in ('record_stock_receipt', 'record_sale', 'record_expense') and exists (
    select 1 from public.farm_operating_days
    where farm_id = v_farm_id and operating_date = v_work_date and status in ('closed', 'locked')
  ) then
    raise exception 'This operating day is not open.' using errcode = '55000';
  end if;

  v_expected_revision := nullif(p_command->>'expected_resource_revision', '');
  if v_expected_revision is not null then
    if v_command_type = 'save_daily_record' and nullif(v_payload->>'daily_record_id', '') is not null then
      v_current_revision := public.today_resource_revision('daily_record', (v_payload->>'daily_record_id')::uuid, null);
    elsif v_command_type in ('save_feed_session', 'close_feed_day') and v_flock_id is not null then
      v_current_revision := public.today_resource_revision('feed_day', v_flock_id, v_work_date);
    end if;
    if v_current_revision is not null and v_current_revision <> v_expected_revision then
      raise exception 'The source record changed. Refresh before saving.' using errcode = '40001';
    end if;
  end if;

  if v_command_type = 'save_daily_record' then
    if v_flock_id is null then raise exception 'A flock is required.' using errcode = '22023'; end if;
    v_domain_result := public.save_daily_record_with_usage(
      p_actor_id,
      nullif(v_payload->>'daily_record_id', '')::uuid,
      v_flock_id,
      coalesce(v_payload->'record', '{}'::jsonb),
      coalesce(v_payload->'usages', '[]'::jsonb)
    );
    v_source_ref := 'daily_farm_records/' || coalesce(v_domain_result->>'daily_record_id', v_domain_result->>'record_id');

  elsif v_command_type = 'save_feed_session' then
    if v_flock_id is null then raise exception 'A flock is required.' using errcode = '22023'; end if;
    if coalesce((v_payload->'session'->>'planned_feed_kg')::numeric, 0) <= 0
       or coalesce((v_payload->'session'->>'feeders_count')::integer, 0) <= 0
       or nullif(btrim(v_payload->'session'->>'session_name'), '') is null then
      raise exception 'Session name, positive plan, and feeder count are required.' using errcode = '22023';
    end if;
    if coalesce(v_payload->'session'->>'status', 'planned') = 'completed' then
      v_warehouse_id := nullif(v_payload->'session'->>'warehouse_id', '')::uuid;
      v_item_id := nullif(v_payload->'session'->>'feed_item_id', '')::uuid;
      if v_warehouse_id is null or v_item_id is null or (v_payload->'session'->>'actual_feed_kg') is null then
        raise exception 'Completed sessions require actual feed, a feed item, and warehouse.' using errcode = '22023';
      end if;
      if not exists (
           select 1 from public.user_warehouse_access a
           where a.org_id = v_org_id and a.profile_id = p_actor_id and a.warehouse_id = v_warehouse_id
             and a.revoked_at is null and a.starts_at <= now()
             and (a.expires_at is null or a.expires_at > now())
         )
         or not exists (select 1 from public.inventory_items where id = v_item_id and org_id = v_org_id and category = 'feed') then
        raise exception 'Choose an assigned warehouse and feed inventory item.' using errcode = '42501';
      end if;
    end if;
    insert into public.feeding_session_records(
      org_id, batch_id, flock_id, record_date, session_name, session_time, feeders_count,
      planned_feed_kg, actual_feed_kg, notes, feed_item_id, warehouse_id, feed_type,
      status, completed_at, completed_by, recorded_by, updated_at
    ) values (
      v_org_id, v_batch_id, v_flock_id, v_work_date,
      v_payload->'session'->>'session_name', nullif(v_payload->'session'->>'session_time', '')::time,
      (v_payload->'session'->>'feeders_count')::integer,
      (v_payload->'session'->>'planned_feed_kg')::numeric,
      nullif(v_payload->'session'->>'actual_feed_kg', '')::numeric,
      nullif(btrim(v_payload->'session'->>'notes'), ''),
      nullif(v_payload->'session'->>'feed_item_id', '')::uuid,
      nullif(v_payload->'session'->>'warehouse_id', '')::uuid,
      (v_payload->'session'->>'feed_type')::public.feed_type,
      coalesce(v_payload->'session'->>'status', 'planned'),
      case when v_payload->'session'->>'status' = 'completed' then now() else null end,
      case when v_payload->'session'->>'status' = 'completed' then p_actor_id else null end,
      p_actor_id, now()
    ) on conflict (org_id, flock_id, record_date, session_name)
    do update set session_time = excluded.session_time, feeders_count = excluded.feeders_count,
      planned_feed_kg = excluded.planned_feed_kg, actual_feed_kg = excluded.actual_feed_kg,
      notes = excluded.notes, feed_item_id = excluded.feed_item_id, warehouse_id = excluded.warehouse_id,
      feed_type = excluded.feed_type, status = excluded.status, completed_at = excluded.completed_at,
      completed_by = excluded.completed_by, updated_at = now()
    returning id into v_row_id;
    v_domain_result := jsonb_build_object('session_id', v_row_id);
    v_source_ref := 'feeding_session_records/' || v_row_id::text;

  elsif v_command_type = 'close_feed_day' then
    if v_flock_id is null then raise exception 'A flock is required.' using errcode = '22023'; end if;
    v_domain_result := public.close_feed_day(p_actor_id, v_flock_id, v_work_date, nullif(btrim(v_payload->>'override_reason'), ''));
    v_source_ref := 'feed_day_closures/' || v_flock_id::text || ':' || v_work_date::text;

  elsif v_command_type = 'record_mortality_event' then
    if v_flock_id is null or coalesce((v_payload->>'count')::integer, 0) <= 0 or nullif(btrim(v_payload->>'cause'), '') is null then
      raise exception 'Flock, positive death count, and cause are required.' using errcode = '22023';
    end if;
    insert into public.mortality_events(
      org_id, flock_id, record_date, count, cause, recorded_time, diagnosis, notes, observed_by
    ) values (
      v_org_id, v_flock_id, v_work_date, (v_payload->>'count')::integer,
      btrim(v_payload->>'cause'), nullif(v_payload->>'recorded_time', '')::time,
      nullif(btrim(v_payload->>'diagnosis'), ''), nullif(btrim(v_payload->>'notes'), ''), p_actor_id
    ) returning id into v_row_id;
    v_domain_result := jsonb_build_object('event_id', v_row_id);
    v_source_ref := 'mortality_events/' || v_row_id::text;

  elsif v_command_type = 'record_health_event' then
    if v_flock_id is null then raise exception 'A flock is required.' using errcode = '22023'; end if;
    v_domain_result := public.record_health_event_with_inventory(
      p_actor_id, v_flock_id, v_work_date,
      (v_payload->>'event_type')::public.health_event_type,
      coalesce(v_payload->'event', '{}'::jsonb),
      nullif(v_payload->'inventory_usage'->>'item_id', '')::uuid,
      nullif(v_payload->'inventory_usage'->>'warehouse_id', '')::uuid,
      nullif(v_payload->'inventory_usage'->>'quantity', '')::numeric
    );
    v_source_ref := 'health_events/' || (v_domain_result->>'event_id');

  elsif v_command_type = 'complete_vaccination' then
    v_domain_result := public.complete_vaccination_with_inventory(
      p_actor_id,
      (v_payload->>'schedule_id')::uuid,
      (v_payload->>'item_id')::uuid,
      (v_payload->>'warehouse_id')::uuid,
      (v_payload->>'quantity')::numeric,
      v_work_date
    );
    v_source_ref := 'vaccination_events/' || (v_payload->>'schedule_id');

  elsif v_command_type = 'record_stock_receipt' then
    v_domain_result := public.receive_inventory_stock(
      p_actor_id,
      (v_payload->>'warehouse_id')::uuid,
      nullif(v_payload->>'item_id', '')::uuid,
      v_payload->'item',
      (v_payload->>'quantity')::numeric,
      (v_payload->>'unit_cost')::numeric,
      v_work_date,
      coalesce(nullif(v_payload->'details'->>'procurement_type', ''), 'local')::public.procurement_type,
      nullif(btrim(v_payload->'details'->>'supplier_name'), ''),
      nullif(btrim(v_payload->'details'->>'invoice_number'), ''),
      nullif(btrim(v_payload->'details'->>'notes'), ''),
      v_command_id::text
    );
    v_source_ref := 'stock_ledger/' || (v_domain_result->>'movement_id');

  elsif v_command_type = 'record_sale' then
    if coalesce((v_payload->>'quantity')::numeric, 0) <= 0
       or coalesce((v_payload->>'unit_price')::numeric, -1) < 0
       or nullif(btrim(v_payload->>'product_label'), '') is null
       or coalesce(v_payload->>'product_category', '') not in ('egg','bird','training','equipment_medicine','consultancy','package') then
      raise exception 'A supported product, positive quantity, and valid price are required.' using errcode = '22023';
    end if;
    insert into public.daily_sales_records(
      org_id, branch_id, farm_id, house_id, flock_id, batch_id, sale_date,
      product_category, product_label, quantity, unit, unit_price, gross_amount,
      paid_amount, balance_due, payment_method, customer_name, customer_phone, notes, recorded_by
    ) values (
      v_org_id, v_branch_id, v_farm_id, v_house_id, v_flock_id, v_batch_id, v_work_date,
      v_payload->>'product_category', btrim(v_payload->>'product_label'),
      (v_payload->>'quantity')::numeric, coalesce(nullif(btrim(v_payload->>'unit'), ''), 'unit'),
      (v_payload->>'unit_price')::numeric,
      round((v_payload->>'quantity')::numeric * (v_payload->>'unit_price')::numeric, 2),
      coalesce((v_payload->>'paid_amount')::numeric, 0),
      round(((v_payload->>'quantity')::numeric * (v_payload->>'unit_price')::numeric) - coalesce((v_payload->>'paid_amount')::numeric, 0), 2),
      nullif(btrim(v_payload->>'payment_method'), ''), nullif(btrim(v_payload->>'customer_name'), ''),
      nullif(btrim(v_payload->>'customer_phone'), ''), nullif(btrim(v_payload->>'notes'), ''), p_actor_id
    ) returning id into v_row_id;
    v_domain_result := jsonb_build_object('sale_id', v_row_id);
    v_source_ref := 'daily_sales_records/' || v_row_id::text;

  elsif v_command_type = 'record_expense' then
    if coalesce((v_payload->>'amount')::numeric, 0) <= 0
       or nullif(btrim(v_payload->>'description'), '') is null
       or coalesce(v_payload->>'category', '') not in ('feed','medicine','vaccine','vitamin','supplement','payroll','utility','biosecurity','transport','maintenance','labor','rent','packaging','miscellaneous') then
      raise exception 'A valid category, description, and positive amount are required.' using errcode = '22023';
    end if;
    v_warehouse_id := nullif(v_payload->>'warehouse_id', '')::uuid;
    if v_warehouse_id is not null then
      select branch_id, farm_id into v_scope from public.warehouses
      where id = v_warehouse_id and org_id = v_org_id and status = 'active';
      if not found or not exists (
        select 1 from public.user_warehouse_access a
        where a.org_id = v_org_id and a.profile_id = p_actor_id and a.warehouse_id = v_warehouse_id
          and a.revoked_at is null and a.starts_at <= now()
          and (a.expires_at is null or a.expires_at > now())
      ) then
        raise exception 'An active warehouse assignment is required.' using errcode = '42501';
      end if;
      v_branch_id := v_scope.branch_id;
      v_farm_id := coalesce(v_scope.farm_id, v_farm_id);
    end if;
    insert into public.cost_entries(
      org_id, branch_id, farm_id, house_id, flock_id, batch_id, entry_date,
      entry_kind, category, description, amount, allocation_method,
      supplier_name, invoice_number, reference_doc, warehouse_id, recorded_by
    ) values (
      v_org_id, v_branch_id, v_farm_id, v_house_id, v_flock_id, v_batch_id, v_work_date,
      coalesce(nullif(v_payload->>'entry_kind', ''), 'one_off'), v_payload->>'category',
      btrim(v_payload->>'description'), (v_payload->>'amount')::numeric,
      coalesce(nullif(v_payload->>'allocation_method', ''), 'direct'),
      nullif(btrim(v_payload->>'supplier_name'), ''), nullif(btrim(v_payload->>'invoice_number'), ''),
      nullif(btrim(v_payload->>'reference_doc'), ''), v_warehouse_id, p_actor_id
    ) returning id into v_row_id;
    v_domain_result := jsonb_build_object('cost_entry_id', v_row_id);
    v_source_ref := 'cost_entries/' || v_row_id::text;

  elsif v_command_type = 'update_assigned_action' then
    select * into v_action from public.operational_actions
    where id = (v_payload->>'action_id')::uuid and org_id = v_org_id for update;
    if not found or v_action.owner_id is distinct from p_actor_id then
      raise exception 'This action is not assigned to you.' using errcode = '42501';
    end if;
    v_before_status := v_action.status;
    if v_payload->>'event_type' = 'acknowledged' then
      v_after_status := 'acknowledged'; v_event_type := 'acknowledged';
      update public.operational_actions set status = v_after_status, acknowledged_by = p_actor_id, acknowledged_at = now(), updated_at = now() where id = v_action.id;
    elsif v_payload->>'event_type' = 'started' then
      v_after_status := 'in_progress'; v_event_type := 'work_started';
      update public.operational_actions set status = v_after_status, updated_at = now() where id = v_action.id;
    elsif v_payload->>'event_type' = 'completion_submitted' then
      v_after_status := 'awaiting_verification'; v_event_type := 'resolution_submitted';
      update public.operational_actions set status = v_after_status,
        resolution_summary = btrim(v_payload->>'note'), resolution_submitted_by = p_actor_id,
        resolution_submitted_at = now(), updated_at = now() where id = v_action.id;
    else
      raise exception 'Unsupported assigned action update.' using errcode = '22023';
    end if;
    insert into public.operational_action_events(
      org_id, action_id, event_type, actor_id, actor_name_snapshot, actor_role_snapshot,
      note, before_status, after_status
    ) values (
      v_org_id, v_action.id, v_event_type, p_actor_id, v_actor_name, v_role,
      btrim(v_payload->>'note'), v_before_status, v_after_status
    );
    v_domain_result := jsonb_build_object('action_id', v_action.id, 'status', v_after_status);
    v_source_ref := 'operational_actions/' || v_action.id::text;
  end if;

  v_result := jsonb_build_object(
    'command_id', v_command_id,
    'status', 'applied',
    'source_ref', v_source_ref,
    'resource_revision', public.canonical_today_payload_hash(v_domain_result),
    'operating_day_revision', public.today_resource_revision('operating_day', v_farm_id, v_work_date)
  );
  update public.client_operation_receipts set result = v_result, completed_at = now() where id = v_receipt.id;
  return v_result;
end
$$;

revoke all on function public.canonical_today_payload_hash(jsonb) from public, anon, authenticated;
revoke all on function public.today_source_fingerprint(uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function public.today_resource_revision(text, uuid, date) from public, anon, authenticated;
revoke all on function public.apply_daily_task_attestation_v1(uuid, uuid, integer, text, jsonb, uuid, uuid, date, text, text) from public, anon, authenticated;
revoke all on function public.finish_farm_operating_day_v1(uuid, uuid, integer, jsonb, uuid, date, text) from public, anon, authenticated;
revoke all on function public.execute_today_command_v1(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.canonical_today_payload_hash(jsonb) to service_role;
grant execute on function public.today_source_fingerprint(uuid, uuid, date, text) to service_role;
grant execute on function public.today_resource_revision(text, uuid, date) to service_role;
grant execute on function public.apply_daily_task_attestation_v1(uuid, uuid, integer, text, jsonb, uuid, uuid, date, text, text) to service_role;
grant execute on function public.finish_farm_operating_day_v1(uuid, uuid, integer, jsonb, uuid, date, text) to authenticated;
grant execute on function public.execute_today_command_v1(uuid, jsonb) to service_role;
