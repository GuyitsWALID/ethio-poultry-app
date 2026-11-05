-- Today owns ordinary deaths and culls in the health step. Keep the Daily
-- Record bird balance, cause event, and cull evidence in one transaction.
create table public.flock_cull_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  flock_id uuid not null references public.flocks(id),
  record_date date not null,
  count integer not null check (count > 0),
  reason text not null check (length(btrim(reason)) > 0),
  observed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index flock_cull_events_day_idx on public.flock_cull_events(org_id, flock_id, record_date);
alter table public.flock_cull_events enable row level security;
revoke all on public.flock_cull_events from public, anon, authenticated;
grant select, insert on public.flock_cull_events to service_role;

-- Existing culls were not reflected in flock.current_count by the old
-- trigger. -1 marks that legacy baseline without rewriting historical rows.
-- The trigger changes new records to baseline zero and freezes the old cull
-- count as the baseline when a legacy record is first edited.
alter table public.daily_farm_records
  add column today_cull_baseline integer not null default -1
  check (today_cull_baseline >= -1);

-- Daily Records are the source for ordinary flock losses. The previous count
-- trigger ignored culls, and the later lifecycle guard blocked its death
-- update. Permit only this nested, count-only ledger update; other lifecycle
-- edits still require Governance.
create or replace function public.enforce_governed_lifecycle() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'flocks' and tg_op = 'UPDATE'
    and pg_trigger_depth() > 1
    and current_setting('app.daily_record_count_apply', true) = 'true'
    and (to_jsonb(new) - array['current_count', 'updated_at'])
      = (to_jsonb(old) - array['current_count', 'updated_at']) then
    return new;
  end if;
  if auth.uid() is not null
    and coalesce(current_setting('app.governance_apply', true), 'false') <> 'true' then
    raise exception 'Lifecycle changes require an approved governance request.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.apply_daily_farm_record_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_live_birds integer;
  v_old_losses integer := 0;
  v_new_losses integer := 0;
  v_loss_delta integer;
  v_prior_flag text;
  v_cull_baseline integer;
begin
  if tg_op <> 'DELETE' then
    if tg_op = 'INSERT' then
      new.today_cull_baseline := 0;
    elsif old.today_cull_baseline = -1 then
      new.today_cull_baseline := coalesce(old.culls, 0);
    else
      new.today_cull_baseline := old.today_cull_baseline;
    end if;
    select current_count into v_live_birds
    from public.flocks where id = new.flock_id for update;
    if v_live_birds is not null and v_live_birds > 0 then
      if new.total_eggs is not null then
        new.production_percentage := round(new.total_eggs::numeric / v_live_birds * 100, 2);
      end if;
      if new.deaths is not null then
        new.mortality_percentage := round(new.deaths::numeric / v_live_birds * 100, 2);
      end if;
    end if;
    v_new_losses := coalesce(new.deaths, 0)
      + greatest(coalesce(new.culls, 0) - new.today_cull_baseline, 0);
  end if;
  if tg_op <> 'INSERT' then
    v_cull_baseline := case when old.today_cull_baseline = -1
      then coalesce(old.culls, 0) else old.today_cull_baseline end;
    v_old_losses := coalesce(old.deaths, 0)
      + greatest(coalesce(old.culls, 0) - v_cull_baseline, 0);
  end if;
  v_loss_delta := v_new_losses - v_old_losses;
  if v_loss_delta <> 0 then
    v_prior_flag := current_setting('app.daily_record_count_apply', true);
    perform set_config('app.daily_record_count_apply', 'true', true);
    update public.flocks set current_count = greatest(current_count - v_loss_delta, 0),
      updated_at = now()
    where id = case when tg_op = 'DELETE' then old.flock_id else new.flock_id end;
    perform set_config('app.daily_record_count_apply', coalesce(v_prior_flag, 'false'), true);
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

alter function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb)
  rename to save_daily_record_with_usage_partial_v1;

create function public.save_daily_record_with_usage(
  p_actor_id uuid,
  p_daily_record_id uuid,
  p_flock_id uuid,
  p_record jsonb,
  p_usages jsonb default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_loss jsonb := p_record->'_today_bird_loss';
  v_existing public.daily_farm_records;
  v_org_id uuid;
  v_deaths integer;
  v_culls integer;
  v_allocated integer;
  v_expected_close integer;
  v_patch jsonb;
  v_result jsonb;
begin
  if v_loss is null then
    return public.save_daily_record_with_usage_partial_v1(
      p_actor_id, p_daily_record_id, p_flock_id, p_record, p_usages
    );
  end if;

  if jsonb_typeof(v_loss) <> 'object' or p_daily_record_id is null
    or (p_usages is not null and p_usages <> 'null'::jsonb) then
    raise exception 'Start the bird check before recording losses; do not replace supplies.' using errcode = '22023';
  end if;
  select org_id into v_org_id from public.profiles where id = p_actor_id and is_active;
  select * into v_existing from public.daily_farm_records
  where id = p_daily_record_id and org_id = v_org_id and flock_id = p_flock_id
    and record_date = nullif(p_record->>'record_date', '')::date and voided_at is null
  for update;
  if not found then
    raise exception 'The current Daily Record is missing. Refresh Today.' using errcode = '40001';
  end if;
  if nullif(v_loss->>'expected_revision', '') is null
    or v_loss->>'expected_revision' <> public.today_resource_revision('daily_record', v_existing.id, null) then
    raise exception 'The bird record changed. Refresh before saving.' using errcode = '40001';
  end if;

  v_deaths := coalesce((v_loss->>'deaths')::integer, 0);
  v_culls := coalesce((v_loss->>'culls')::integer, 0);
  if v_deaths < 0 or v_culls < 0 or v_deaths + v_culls = 0
    or (v_deaths > 0 and nullif(btrim(v_loss->>'cause'), '') is null)
    or (v_culls > 0 and nullif(btrim(v_loss->>'cull_reason'), '') is null) then
    raise exception 'Enter positive deaths or culls and a reason for each.' using errcode = '22023';
  end if;

  select coalesce(sum(count), 0)::integer into v_allocated from public.mortality_events
  where org_id = v_org_id and flock_id = p_flock_id and record_date = v_existing.record_date;
  v_expected_close := v_existing.opening_birds + coalesce(v_existing.transfers_in, 0)
    - coalesce(v_existing.deaths, 0) - coalesce(v_existing.culls, 0)
    - coalesce(v_existing.transfers_out, 0) - coalesce(v_existing.other_removals, 0);
  if v_existing.opening_birds is null or v_existing.closing_birds is distinct from v_expected_close
    or coalesce(v_existing.deaths, 0) <> v_allocated then
    raise exception 'Existing bird or mortality records disagree. Review them before adding losses.' using errcode = '23514';
  end if;
  if v_existing.closing_birds < v_deaths + v_culls then
    raise exception 'Bird losses cannot exceed the live flock count.' using errcode = '23514';
  end if;

  -- The underlying Daily Record writer replaces all editable columns. Carry
  -- forward the current row; a loss must not erase eggs, water, or supplies.
  v_patch := jsonb_build_object(
    'record_date', v_existing.record_date,
    'flock_age_weeks', v_existing.flock_age_weeks,
    'flock_age_days', v_existing.flock_age_days,
    'feed_leftover_grams', v_existing.feed_leftover_grams,
    'normal_eggs', v_existing.normal_eggs,
    'broken_eggs', v_existing.broken_eggs,
    'dirty_eggs', v_existing.dirty_eggs,
    'total_eggs', v_existing.total_eggs,
    'average_egg_weight_g', v_existing.average_egg_weight_g,
    'production_percentage', v_existing.production_percentage,
    'mortality_percentage', v_existing.mortality_percentage,
    'deaths_cause', v_existing.deaths_cause,
    'vaccination_status', v_existing.vaccination_status,
    'medication_vitamins', v_existing.medication_vitamins,
    'opening_birds', v_existing.opening_birds,
    'transfers_in', v_existing.transfers_in,
    'transfers_out', v_existing.transfers_out,
    'other_removals', v_existing.other_removals,
    'water_consumed_liters', v_existing.water_consumed_liters
  ) || jsonb_build_object(
    'deaths', coalesce(v_existing.deaths, 0) + v_deaths,
    'culls', coalesce(v_existing.culls, 0) + v_culls,
    'closing_birds', v_existing.closing_birds - v_deaths - v_culls
  );
  v_result := public.save_daily_record_with_usage_partial_v1(
    p_actor_id, v_existing.id, p_flock_id, v_patch, null
  );
  if v_deaths > 0 then
    insert into public.mortality_events(
      org_id, flock_id, record_date, count, cause, recorded_time, diagnosis, notes, observed_by
    ) values (
      v_org_id, p_flock_id, v_existing.record_date, v_deaths, btrim(v_loss->>'cause'),
      nullif(v_loss->>'recorded_time', '')::time,
      nullif(btrim(v_loss->>'diagnosis'), ''), nullif(btrim(v_loss->>'notes'), ''), p_actor_id
    );
  end if;
  if v_culls > 0 then
    insert into public.flock_cull_events(org_id, flock_id, record_date, count, reason, observed_by)
    values (v_org_id, p_flock_id, v_existing.record_date, v_culls, btrim(v_loss->>'cull_reason'), p_actor_id);
  end if;
  return v_result;
end;
$$;

revoke all on function public.save_daily_record_with_usage_partial_v1(uuid, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_daily_record_with_usage_partial_v1(uuid, uuid, uuid, jsonb, jsonb)
  to service_role;
revoke all on function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb)
  to service_role;

-- Cull-only days count as real health/bird-loss activity at server close.
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
        and d.voided_at is null and (coalesce(d.deaths, 0) + coalesce(d.culls, 0)) > 0
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

  select * into v_day
  from public.close_farm_operating_day(p_farm_id, p_operating_date, '[]'::jsonb);
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

-- A "none today" confirmation must not contradict recorded losses or care.
create function public.reject_false_health_attestation_v1() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.task_code = 'health_deaths' and new.flock_id is not null and (
    exists (select 1 from public.daily_farm_records d
      where d.org_id = new.org_id and d.flock_id = new.flock_id and d.record_date = new.work_date
        and d.voided_at is null and (coalesce(d.deaths, 0) > 0 or coalesce(d.culls, 0) > 0))
    or exists (select 1 from public.mortality_events m
      where m.org_id = new.org_id and m.flock_id = new.flock_id and m.record_date = new.work_date)
    or exists (select 1 from public.health_events h
      where h.org_id = new.org_id and h.flock_id = new.flock_id and h.event_date = new.work_date
        and h.voided_at is null)
  ) then
    raise exception 'Health or bird losses already recorded for this day.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reject_false_health_attestation
before insert on public.daily_task_attestations
for each row execute function public.reject_false_health_attestation_v1();
