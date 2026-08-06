-- Close the remaining Item 2 governance gaps without rewriting the applied foundation migration.

alter table public.user_farm_access
  add column if not exists revocation_reason text;
alter table public.user_warehouse_access
  add column if not exists revocation_reason text;

alter table public.break_glass_requests
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null,
  add column if not exists revocation_reason text;
alter table public.break_glass_sessions
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null,
  add column if not exists revocation_reason text;

create table if not exists public.governance_scheduler_health (
  scheduler_key text primary key,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_locked_count integer,
  updated_at timestamptz not null default now(),
  constraint governance_scheduler_health_key check (scheduler_key = 'operating_day_lock')
);

alter table public.governance_scheduler_health enable row level security;
drop policy if exists governance_scheduler_health_tenant_read on public.governance_scheduler_health;
create policy governance_scheduler_health_tenant_read
  on public.governance_scheduler_health for select to authenticated
  using (public.current_active_role() in ('ceo','farm_manager'));

create or replace function public.lock_overdue_operating_days()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer;
begin
  insert into public.governance_scheduler_health(scheduler_key,last_started_at,updated_at)
  values('operating_day_lock',now(),now())
  on conflict(scheduler_key) do update set last_started_at=excluded.last_started_at,updated_at=now();

  insert into public.farm_operating_days(org_id,farm_id,operating_date,status,locked_at)
  select f.org_id,f.id,d::date,'locked',now()
  from public.farms f
  join public.organizations o on o.id=f.org_id
  cross join lateral generate_series(
    coalesce((select min(fl.placement_date) from public.flocks fl where fl.farm_id=f.id), (now() at time zone 'Africa/Addis_Ababa')::date),
    (now() at time zone 'Africa/Addis_Ababa')::date - case when (now() at time zone 'Africa/Addis_Ababa')::time >= o.operational_day_lock_time then 1 else 2 end,
    interval '1 day') d
  on conflict(farm_id,operating_date) do update
    set status='locked',locked_at=coalesce(farm_operating_days.locked_at,now()),updated_at=now()
    where farm_operating_days.status='open';
  get diagnostics v_count=row_count;

  update public.governance_scheduler_health
  set last_completed_at=now(),last_locked_count=v_count,updated_at=now()
  where scheduler_key='operating_day_lock';
  return v_count;
end $$;

create or replace function public.revoke_break_glass_session(p_session_id uuid,p_reason text)
returns public.break_glass_sessions
language plpgsql
security definer
set search_path=public
as $$
declare v_session public.break_glass_sessions; v_role text;
begin
  v_role:=public.current_active_role();
  if length(trim(coalesce(p_reason,'')))<8 then
    raise exception 'A revocation reason of at least eight characters is required.' using errcode='22023';
  end if;
  select * into v_session from public.break_glass_sessions where id=p_session_id for update;
  if not found then raise exception 'Support session not found.' using errcode='P0002'; end if;
  if not ((v_role='ceo' and v_session.target_org_id=public.current_org_id()) or (v_role='system_admin' and v_session.administrator_id=auth.uid())) then
    raise exception 'Only the tenant CEO or the assigned administrator can end this support session.' using errcode='42501';
  end if;
  if v_session.revoked_at is not null then raise exception 'Support session is already revoked.' using errcode='40001'; end if;

  update public.break_glass_sessions
  set revoked_at=now(),revoked_by=auth.uid(),revocation_reason=trim(p_reason)
  where id=p_session_id returning * into v_session;
  update public.break_glass_requests
  set status='revoked',revoked_at=now(),revoked_by=auth.uid(),revocation_reason=trim(p_reason)
  where id=v_session.request_id;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,entity_table,entity_id,reason,after_values)
  values(v_session.target_org_id,auth.uid(),v_role,v_session.id,'break_glass.revoked','break_glass_sessions',v_session.id::text,trim(p_reason),to_jsonb(v_session));
  return v_session;
end $$;

grant execute on function public.revoke_break_glass_session(uuid,text) to authenticated;
revoke all on function public.lock_overdue_operating_days() from public,authenticated;

-- Supabase hosted projects support pg_cron. Fail deployment rather than silently shipping without locking.
create extension if not exists pg_cron;
do $$ declare v_job record; begin
  for v_job in select jobid from cron.job where jobname='lock-overdue-farm-operating-days' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  perform cron.schedule('lock-overdue-farm-operating-days','*/15 * * * *','select public.lock_overdue_operating_days()');
end $$;

select public.lock_overdue_operating_days();
