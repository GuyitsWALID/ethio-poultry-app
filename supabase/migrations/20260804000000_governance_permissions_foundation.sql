-- Governance-first authorization foundation. Additive first; application enforcement ships with this migration.

update public.profiles set role = 'system_admin'::public.user_role where role = 'super_admin'::public.user_role;
update public.profiles set is_active = false where role in ('veterinarian'::public.user_role, 'store_keeper'::public.user_role);

-- Unknown claims must never fall through to CEO. Retired enum values remain only so old rows can be reviewed.
create or replace function public.normalize_user_role(input_role text)
returns public.user_role language plpgsql stable as $$
declare normalized text := lower(trim(coalesce(input_role,'')));
begin
  if normalized='manager' then return 'ceo'::public.user_role; end if;
  if normalized='super_admin' then return 'system_admin'::public.user_role; end if;
  if normalized in ('ceo','farm_manager','system_admin') then return normalized::public.user_role; end if;
  return null;
end $$;

create unique index if not exists profiles_one_active_ceo_per_org
  on public.profiles(org_id) where role = 'ceo'::public.user_role and is_active = true;

drop policy if exists organization_onboarding_service_only on public.organizations;
create policy organization_onboarding_service_only on public.organizations as restrictive for insert to authenticated with check(false);

alter table public.organizations add column if not exists operational_day_lock_time time not null default '10:00:00';

alter table public.user_farm_access add column if not exists starts_at timestamptz not null default now();
alter table public.user_farm_access add column if not exists expires_at timestamptz;
alter table public.user_farm_access add column if not exists revoked_at timestamptz;
alter table public.user_farm_access add column if not exists granted_by uuid references public.profiles(id) on delete set null;
alter table public.user_farm_access add column if not exists revoked_by uuid references public.profiles(id) on delete set null;
alter table public.user_farm_access drop constraint if exists user_farm_access_dates_valid;
alter table public.user_farm_access add constraint user_farm_access_dates_valid check (expires_at is null or expires_at > starts_at);

-- Preserve current branch coverage as explicit farm assignments. Future farms are never inherited.
insert into public.user_farm_access(org_id,profile_id,farm_id,starts_at)
select f.org_id, uba.profile_id, f.id, uba.created_at
from public.user_branch_access uba join public.farms f on f.branch_id = uba.branch_id
join public.profiles p on p.id = uba.profile_id and p.role = 'farm_manager'::public.user_role
on conflict (profile_id,farm_id) do nothing;
delete from public.user_branch_access;

create table if not exists public.user_warehouse_access (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  starts_at timestamptz not null default now(), expires_at timestamptz, revoked_at timestamptz,
  granted_by uuid references public.profiles(id) on delete set null, revoked_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_warehouse_access_unique unique(profile_id,warehouse_id),
  constraint user_warehouse_access_dates_valid check (expires_at is null or expires_at > starts_at)
);

create table if not exists public.farm_operating_days (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade, operating_date date not null,
  status text not null default 'open' check (status in ('open','closed','locked')),
  exceptions jsonb not null default '[]'::jsonb, closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz, locked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint farm_operating_days_unique unique(farm_id,operating_date)
);

create table if not exists public.governance_requests (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
  request_type text not null check (request_type in ('batch_create','batch_archive','flock_place','flock_transfer','flock_close','flock_archive','feed_template','breed_target','health_schedule','warning_threshold','locked_correction','void_record')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','conflict','applied')),
  farm_id uuid references public.farms(id) on delete restrict, warehouse_id uuid references public.warehouses(id) on delete restrict,
  source_table text, source_id uuid, source_version timestamptz,
  changed_fields text[] not null default '{}', proposed_values jsonb not null default '{}'::jsonb,
  reason text not null check (length(trim(reason)) >= 8), attachments jsonb not null default '[]'::jsonb,
  requested_by uuid not null references public.profiles(id) on delete restrict, requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete restrict, decided_at timestamptz, decision_note text,
  applied_at timestamptz, conflict_reason text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.break_glass_requests (
  id uuid primary key default gen_random_uuid(), target_org_id uuid not null references public.organizations(id) on delete cascade,
  administrator_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(trim(reason)) >= 12), ticket_reference text not null,
  requested_minutes integer not null check (requested_minutes between 1 and 240),
  status text not null default 'pending' check (status in ('pending','approved','rejected','revoked','expired')),
  requested_at timestamptz not null default now(), decided_by uuid references public.profiles(id) on delete restrict,
  decided_at timestamptz, decision_note text, expires_at timestamptz, revoked_at timestamptz
);

create table if not exists public.break_glass_sessions (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique references public.break_glass_requests(id) on delete restrict,
  target_org_id uuid not null references public.organizations(id) on delete cascade,
  administrator_id uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz,
  constraint break_glass_session_max_four_hours check (expires_at <= started_at + interval '4 hours')
);

create table if not exists public.governance_audit_events (
  id bigint generated always as identity primary key, org_id uuid references public.organizations(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null, actor_role text, support_session_id uuid references public.break_glass_sessions(id) on delete set null,
  event_type text not null, entity_table text, entity_id text, reason text,
  before_values jsonb, after_values jsonb, metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

-- Application records are retired by voiding; their original values remain queryable.
alter table public.daily_farm_records add column if not exists voided_at timestamptz, add column if not exists voided_by uuid references public.profiles(id) on delete set null, add column if not exists void_reason text;
alter table public.feeding_session_records add column if not exists voided_at timestamptz, add column if not exists voided_by uuid references public.profiles(id) on delete set null, add column if not exists void_reason text;
alter table public.daily_sales_records add column if not exists voided_at timestamptz, add column if not exists voided_by uuid references public.profiles(id) on delete set null, add column if not exists void_reason text;
alter table public.batches add column if not exists voided_at timestamptz, add column if not exists voided_by uuid references public.profiles(id) on delete set null, add column if not exists void_reason text;
alter table public.health_events add column if not exists voided_at timestamptz, add column if not exists voided_by uuid references public.profiles(id) on delete set null, add column if not exists void_reason text,
  add column if not exists external_veterinarian_name text, add column if not exists veterinarian_recommendation text, add column if not exists veterinarian_reference text, add column if not exists veterinarian_attachment jsonb, add column if not exists recommendation_status text check(recommendation_status is null or recommendation_status in ('received','planned','implemented','declined'));
alter table public.vaccination_events add column if not exists voided_at timestamptz, add column if not exists voided_by uuid references public.profiles(id) on delete set null, add column if not exists void_reason text,
  add column if not exists external_veterinarian_name text, add column if not exists veterinarian_recommendation text, add column if not exists veterinarian_reference text, add column if not exists veterinarian_attachment jsonb, add column if not exists recommendation_status text check(recommendation_status is null or recommendation_status in ('received','planned','implemented','declined'));
alter table public.biosecurity_checks add column if not exists voided_at timestamptz, add column if not exists voided_by uuid references public.profiles(id) on delete set null, add column if not exists void_reason text;
alter table public.batch_weight_check_tasks add column if not exists voided_at timestamptz, add column if not exists voided_by uuid references public.profiles(id) on delete set null, add column if not exists void_reason text;

create or replace function public.reject_business_hard_delete() returns trigger language plpgsql as $$ begin raise exception 'Business records cannot be hard-deleted. Void the record with a reason.' using errcode='42501'; end $$;
do $$ declare t text; begin foreach t in array array['daily_farm_records','feeding_session_records','daily_sales_records','batches','health_events','vaccination_events','biosecurity_checks','batch_weight_check_tasks'] loop execute format('drop trigger if exists reject_hard_delete on public.%I',t); execute format('create trigger reject_hard_delete before delete on public.%I for each row execute function public.reject_business_hard_delete()',t); end loop; end $$;

create or replace function public.current_active_role() returns text language sql stable security definer set search_path=public as $$
  select case when p.is_active and p.role::text in ('ceo','farm_manager','system_admin') then p.role::text else null end
  from public.profiles p where p.id=auth.uid()
$$;
create or replace function public.current_org_id() returns uuid language sql stable security definer set search_path=public as $$ select p.org_id from public.profiles p where p.id=auth.uid() and p.is_active $$;
create or replace function public.has_active_farm_access(p_farm_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_farm_access a where a.profile_id=auth.uid() and a.farm_id=p_farm_id and a.starts_at<=now() and a.revoked_at is null and (a.expires_at is null or a.expires_at>now()))
$$;
create or replace function public.has_active_warehouse_access(p_warehouse_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_warehouse_access a where a.profile_id=auth.uid() and a.warehouse_id=p_warehouse_id and a.starts_at<=now() and a.revoked_at is null and (a.expires_at is null or a.expires_at>now()))
$$;
create or replace function public.has_active_break_glass(p_org_id uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.break_glass_sessions s where s.administrator_id=auth.uid() and s.target_org_id=p_org_id and s.started_at<=now() and s.expires_at>now() and s.revoked_at is null)
$$;

create or replace function public.protect_profile_authority_fields() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and (new.role is distinct from old.role or new.org_id is distinct from old.org_id or new.is_active is distinct from old.is_active) then
    raise exception 'Role, organization, and account status changes must use the governed user API.' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_authority_fields on public.profiles;
create trigger protect_profile_authority_fields before update on public.profiles for each row execute function public.protect_profile_authority_fields();

-- Direct browser writes cannot use CEO oversight or expired/branch-only access as operational authority.
create or replace function public.enforce_operational_actor() returns trigger language plpgsql security definer set search_path=public as $$
declare payload jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; v_farm uuid; v_date date;
begin
  if auth.uid() is null then return case when tg_op='DELETE' then old else new end; end if;
  if coalesce(current_setting('app.governance_apply',true),'false')='true' then return case when tg_op='DELETE' then old else new end; end if;
  if public.current_active_role()<>'farm_manager' then raise exception 'Routine operational writes require a farm manager.' using errcode='42501'; end if;
  v_farm:=nullif(payload->>'farm_id','')::uuid;
  if v_farm is null and nullif(payload->>'flock_id','') is not null then select farm_id into v_farm from public.flocks where id=(payload->>'flock_id')::uuid; end if;
  if v_farm is null or not public.has_active_farm_access(v_farm) then raise exception 'An active direct farm assignment is required.' using errcode='42501'; end if;
  v_date:=coalesce(nullif(payload->>'record_date','')::date,nullif(payload->>'sale_date','')::date,nullif(payload->>'event_date','')::date,nullif(payload->>'checklist_date','')::date);
  if v_date is not null and exists(select 1 from public.farm_operating_days d where d.farm_id=v_farm and d.operating_date=v_date and d.status='locked') then raise exception 'The operating day is locked; submit a correction request.' using errcode='42501'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
do $$ declare t text; begin foreach t in array array['daily_farm_records','feeding_session_records','daily_sales_records','health_events','vaccination_events','biosecurity_checks','weight_records','mortality_events'] loop execute format('drop trigger if exists enforce_operational_actor on public.%I',t); execute format('create trigger enforce_operational_actor before insert or update or delete on public.%I for each row execute function public.enforce_operational_actor()',t); end loop; end $$;

create or replace function public.enforce_governed_lifecycle() returns trigger language plpgsql as $$ begin if auth.uid() is not null and coalesce(current_setting('app.governance_apply',true),'false')<>'true' then raise exception 'Lifecycle changes require an approved governance request.' using errcode='42501'; end if; return case when tg_op='DELETE' then old else new end; end $$;
drop trigger if exists enforce_governed_lifecycle on public.flocks;create trigger enforce_governed_lifecycle before insert or update or delete on public.flocks for each row execute function public.enforce_governed_lifecycle();
drop trigger if exists enforce_governed_lifecycle on public.batches;create trigger enforce_governed_lifecycle before insert or update or delete on public.batches for each row execute function public.enforce_governed_lifecycle();

create or replace function public.prevent_governance_audit_change() returns trigger language plpgsql as $$ begin raise exception 'Governance audit events are append-only.' using errcode='42501'; end $$;
drop trigger if exists governance_audit_immutable on public.governance_audit_events;
create trigger governance_audit_immutable before update or delete on public.governance_audit_events for each row execute function public.prevent_governance_audit_change();

create or replace function public.close_farm_operating_day(p_farm_id uuid,p_operating_date date,p_exceptions jsonb default '[]'::jsonb) returns public.farm_operating_days
language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_expected int; v_record_exceptions int; v_feed_exceptions int; v_row public.farm_operating_days;
begin
  select org_id into v_org from public.farms where id=p_farm_id;
  if v_org is null or public.current_active_role()<>'farm_manager' or not public.has_active_farm_access(p_farm_id) then raise exception 'Farm manager assignment is required.' using errcode='42501'; end if;
  select count(*) into v_expected from public.flocks where farm_id=p_farm_id and status='active';
  if jsonb_typeof(coalesce(p_exceptions,'[]'::jsonb)) <> 'array' or exists(select 1 from jsonb_array_elements(coalesce(p_exceptions,'[]'::jsonb)) e where length(trim(coalesce(e->>'reason','')))<8 or coalesce(e->>'requirement','') not in ('daily_record','feed_close')) then
    raise exception 'Each exception requires a requirement and a reason of at least eight characters.' using errcode='22023';
  end if;
  select count(*) into v_record_exceptions from public.flocks f where f.farm_id=p_farm_id and f.status='active' and (exists(select 1 from public.daily_farm_records d where d.flock_id=f.id and d.record_date=p_operating_date and d.voided_at is null) or exists(select 1 from jsonb_array_elements(coalesce(p_exceptions,'[]'::jsonb)) e where e->>'flock_id'=f.id::text and e->>'requirement'='daily_record'));
  select count(*) into v_feed_exceptions from public.flocks f where f.farm_id=p_farm_id and f.status='active' and (exists(select 1 from public.feed_day_closures c where c.flock_id=f.id and c.record_date=p_operating_date and c.status='closed') or exists(select 1 from jsonb_array_elements(coalesce(p_exceptions,'[]'::jsonb)) e where e->>'flock_id'=f.id::text and e->>'requirement'='feed_close'));
  if v_record_exceptions<v_expected or v_feed_exceptions<v_expected then raise exception 'All active flocks require a Daily Record and closed feeding day (%/% records, %/% feed).',v_record_exceptions,v_expected,v_feed_exceptions,v_expected using errcode='23514'; end if;
  insert into public.farm_operating_days(org_id,farm_id,operating_date,status,exceptions,closed_by,closed_at,locked_at)
  values(v_org,p_farm_id,p_operating_date,'closed',coalesce(p_exceptions,'[]'::jsonb),auth.uid(),now(),null)
  on conflict(farm_id,operating_date) do update set status='closed',exceptions=excluded.exceptions,closed_by=auth.uid(),closed_at=now(),locked_at=null,updated_at=now()
  returning * into v_row;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,after_values) values(v_org,auth.uid(),public.current_active_role(),'operating_day.closed','farm_operating_days',v_row.id::text,to_jsonb(v_row));
  return v_row;
end $$;

create or replace function public.lock_overdue_operating_days() returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  insert into public.farm_operating_days(org_id,farm_id,operating_date,status,locked_at)
  select f.org_id,f.id,d::date,'locked',now()
  from public.farms f join public.organizations o on o.id=f.org_id
  cross join lateral generate_series(
    coalesce((select min(fl.placement_date) from public.flocks fl where fl.farm_id=f.id), (now() at time zone 'Africa/Addis_Ababa')::date),
    (now() at time zone 'Africa/Addis_Ababa')::date - case when (now() at time zone 'Africa/Addis_Ababa')::time >= o.operational_day_lock_time then 1 else 2 end,
    interval '1 day') d
  on conflict(farm_id,operating_date) do update set status='locked',locked_at=coalesce(farm_operating_days.locked_at,now()),updated_at=now() where farm_operating_days.status='open';
  get diagnostics v_count=row_count; return v_count;
end $$;

create or replace function public.decide_governance_request(p_request_id uuid,p_decision text,p_note text) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare v_row public.governance_requests; v_role text; v_current_version timestamptz; v_new_id uuid; v_daily public.daily_farm_records; v_target jsonb;
begin
  v_role:=public.current_active_role();
  if v_role<>'ceo' then raise exception 'Only the organization CEO can decide governance requests.' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') or length(trim(coalesce(p_note,'')))<4 then raise exception 'A valid decision and decision note are required.' using errcode='22023'; end if;
  select * into v_row from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
  if v_row.status<>'pending' then raise exception 'This request is no longer pending.' using errcode='40001'; end if;
  if p_decision='approved' and v_row.source_id is not null and v_row.source_version is not null then
    if v_row.source_table='flocks' then select updated_at into v_current_version from public.flocks where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='batches' then select updated_at into v_current_version from public.batches where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='feed_control_settings' then select updated_at into v_current_version from public.feed_control_settings where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='daily_farm_records' then select updated_at into v_current_version from public.daily_farm_records where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='daily_sales_records' then select updated_at into v_current_version from public.daily_sales_records where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='health_events' then select updated_at into v_current_version from public.health_events where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='vaccination_events' then select updated_at into v_current_version from public.vaccination_events where id=v_row.source_id and org_id=v_row.org_id;
    else raise exception 'Unsupported versioned source table.' using errcode='22023'; end if;
    if v_current_version is null or v_current_version<>v_row.source_version then
      update public.governance_requests set status='conflict',conflict_reason='The source record changed after this request was submitted.',decided_by=auth.uid(),decided_at=now(),decision_note=trim(p_note),updated_at=now() where id=v_row.id returning * into v_row;
      return v_row;
    end if;
  end if;
  if p_decision='approved' then
    perform set_config('app.governance_apply','true',true);
    if v_row.request_type='flock_place' then
      if not exists(select 1 from public.farms f where f.id=(v_row.proposed_values->>'farm_id')::uuid and f.org_id=v_row.org_id)
        or not exists(select 1 from public.houses h where h.id=(v_row.proposed_values->>'house_id')::uuid and h.org_id=v_row.org_id and h.farm_id=(v_row.proposed_values->>'farm_id')::uuid) then
        raise exception 'The proposed farm or house is outside the organization.' using errcode='23514';
      end if;
      insert into public.flocks(org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,age_at_placement_days,initial_count,current_count,breed_id,purchase_cost_per_bird,notes,status)
      values(v_row.org_id,(v_row.proposed_values->>'farm_id')::uuid,(v_row.proposed_values->>'house_id')::uuid,nullif(v_row.proposed_values->>'batch_id','')::uuid,v_row.proposed_values->>'flock_code',(v_row.proposed_values->>'flock_type')::public.flock_type,(v_row.proposed_values->>'source')::public.flock_source,(v_row.proposed_values->>'placement_date')::date,coalesce((v_row.proposed_values->>'age_at_placement_days')::integer,0),(v_row.proposed_values->>'initial_count')::integer,(v_row.proposed_values->>'initial_count')::integer,nullif(v_row.proposed_values->>'breed_id','')::uuid,nullif(v_row.proposed_values->>'purchase_cost_per_bird','')::numeric,nullif(v_row.proposed_values->>'notes',''),'active') returning id into v_new_id;
      v_row.source_table:='flocks'; v_row.source_id:=v_new_id;
    elsif v_row.request_type='batch_create' then
      if not exists(select 1 from public.houses h join public.farms f on f.id=h.farm_id join public.branches b on b.id=f.branch_id where h.id=(v_row.proposed_values->>'house_id')::uuid and f.id=(v_row.proposed_values->>'farm_id')::uuid and b.id=(v_row.proposed_values->>'branch_id')::uuid and f.org_id=v_row.org_id and h.org_id=v_row.org_id and b.org_id=v_row.org_id) then raise exception 'Batch location is outside the organization.' using errcode='23514'; end if;
      insert into public.batches(org_id,branch_id,farm_id,house_id,batch_code,source,supplier_name,purchase_date,placement_date,age_at_placement_days,male_count,female_count,total_count,purchase_cost_per_bird,transport_cost,other_cost,notes,status)
      values(v_row.org_id,(v_row.proposed_values->>'branch_id')::uuid,(v_row.proposed_values->>'farm_id')::uuid,(v_row.proposed_values->>'house_id')::uuid,v_row.proposed_values->>'batch_code',(v_row.proposed_values->>'source')::public.flock_source,nullif(v_row.proposed_values->>'supplier_name',''),nullif(v_row.proposed_values->>'purchase_date','')::date,(v_row.proposed_values->>'placement_date')::date,coalesce((v_row.proposed_values->>'age_at_placement_days')::integer,0),coalesce((v_row.proposed_values->>'male_count')::integer,0),coalesce((v_row.proposed_values->>'female_count')::integer,0),(v_row.proposed_values->>'total_count')::integer,nullif(v_row.proposed_values->>'purchase_cost_per_bird','')::numeric,coalesce((v_row.proposed_values->>'transport_cost')::numeric,0),coalesce((v_row.proposed_values->>'other_cost')::numeric,0),nullif(v_row.proposed_values->>'notes',''),'active') returning id into v_new_id;
      v_row.source_table:='batches';v_row.source_id:=v_new_id;
    elsif v_row.request_type='flock_transfer' then
      if not exists(select 1 from public.houses h join public.farms f on f.id=h.farm_id where h.id=(v_row.proposed_values->>'house_id')::uuid and f.id=(v_row.proposed_values->>'farm_id')::uuid and f.org_id=v_row.org_id and h.org_id=v_row.org_id) then raise exception 'Transfer destination is outside the organization.' using errcode='23514'; end if;
      update public.flocks set farm_id=(v_row.proposed_values->>'farm_id')::uuid,house_id=(v_row.proposed_values->>'house_id')::uuid,updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Flock not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='flock_close' then
      if coalesce(v_row.proposed_values->>'status','archived') not in ('transferred','sold','culled','archived') then raise exception 'Flock closure requires a terminal status.' using errcode='22023'; end if;
      update public.flocks set status=coalesce(v_row.proposed_values->>'status','archived')::public.flock_status,updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Flock not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='flock_archive' then
      update public.flocks set status='archived',updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Flock not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='batch_archive' then
      update public.batches set status='archived',updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Batch not found.' using errcode='P0002'; end if;
      update public.flocks set status='archived',updated_at=now() where batch_id=v_row.source_id and org_id=v_row.org_id and status='active';
    elsif v_row.request_type='locked_correction' and v_row.source_table='batches' and v_row.changed_fields <@ array['batch_code']::text[] then
      update public.batches set batch_code=v_row.proposed_values->>'batch_code',updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Batch not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='warning_threshold' then
      insert into public.feed_control_settings(org_id,warning_variance_pct,critical_variance_pct,updated_at)
      values(v_row.org_id,(v_row.proposed_values->>'warning_variance_pct')::numeric,(v_row.proposed_values->>'critical_variance_pct')::numeric,now())
      on conflict(org_id) do update set warning_variance_pct=excluded.warning_variance_pct,critical_variance_pct=excluded.critical_variance_pct,updated_at=now();
    elsif v_row.request_type='feed_template' then
      perform public.save_feed_template(v_row.requested_by,(v_row.proposed_values->>'batch_id')::uuid,coalesce(v_row.proposed_values->>'name','Batch feed template'),coalesce(v_row.proposed_values->>'source_type','manual'),coalesce(v_row.proposed_values->'rows','[]'::jsonb));
    elsif v_row.request_type='breed_target' then
      if jsonb_typeof(v_row.proposed_values->'rows')<>'array' then raise exception 'Breed target rows are required.' using errcode='22023'; end if;
      delete from public.breed_standards where org_id=v_row.org_id and breed_id=(v_row.proposed_values->>'breed_id')::uuid;
      insert into public.breed_standards(org_id,breed_id,week_number,target_hdep_pct,target_mortality_pct,target_feed_g,target_weight_g,updated_at)
      select v_row.org_id,(v_row.proposed_values->>'breed_id')::uuid,x.week_number,x.target_hdep_pct,x.target_mortality_pct,x.target_feed_g,x.target_weight_g,now() from jsonb_to_recordset(v_row.proposed_values->'rows') as x(week_number integer,target_hdep_pct numeric,target_mortality_pct numeric,target_feed_g numeric,target_weight_g numeric);
    elsif v_row.request_type='health_schedule' then
      if not exists(select 1 from public.flocks where id=(v_row.proposed_values->>'flock_id')::uuid and org_id=v_row.org_id) then raise exception 'Health schedule flock is outside the organization.' using errcode='23514'; end if;
      insert into public.health_events(org_id,flock_id,event_date,event_type,description,diagnosis,treatment,attachment_url,vet_id,external_veterinarian_name,veterinarian_recommendation,veterinarian_reference,veterinarian_attachment,recommendation_status)
      values(v_row.org_id,(v_row.proposed_values->>'flock_id')::uuid,(v_row.proposed_values->>'event_date')::date,coalesce(v_row.proposed_values->>'event_type','observation')::public.health_event_type,nullif(v_row.proposed_values->>'description',''),nullif(v_row.proposed_values->>'diagnosis',''),nullif(v_row.proposed_values->>'treatment',''),nullif(v_row.proposed_values->>'attachment_url',''),v_row.requested_by,nullif(v_row.proposed_values->>'external_veterinarian_name',''),nullif(v_row.proposed_values->>'veterinarian_recommendation',''),nullif(v_row.proposed_values->>'veterinarian_reference',''),v_row.proposed_values->'veterinarian_attachment',nullif(v_row.proposed_values->>'recommendation_status','')) returning id into v_new_id;
      v_row.source_table:='health_events';v_row.source_id:=v_new_id;
    elsif v_row.request_type='locked_correction' and v_row.source_table='daily_farm_records' then
      if v_row.changed_fields && array['feed_intake_grams','feed_intake_quantity','feed_type']::text[] then raise exception 'Feed fields remain controlled by Feed Control.' using errcode='42501'; end if;
      select * into v_daily from jsonb_populate_record(null::public.daily_farm_records,v_row.proposed_values);
      update public.daily_farm_records set
        normal_eggs=case when 'normal_eggs'=any(v_row.changed_fields) then v_daily.normal_eggs else normal_eggs end,broken_eggs=case when 'broken_eggs'=any(v_row.changed_fields) then v_daily.broken_eggs else broken_eggs end,dirty_eggs=case when 'dirty_eggs'=any(v_row.changed_fields) then v_daily.dirty_eggs else dirty_eggs end,average_egg_weight_g=case when 'average_egg_weight_g'=any(v_row.changed_fields) then v_daily.average_egg_weight_g else average_egg_weight_g end,deaths=case when 'deaths'=any(v_row.changed_fields) then v_daily.deaths else deaths end,deaths_cause=case when 'deaths_cause'=any(v_row.changed_fields) then v_daily.deaths_cause else deaths_cause end,opening_birds=case when 'opening_birds'=any(v_row.changed_fields) then v_daily.opening_birds else opening_birds end,closing_birds=case when 'closing_birds'=any(v_row.changed_fields) then v_daily.closing_birds else closing_birds end,culls=case when 'culls'=any(v_row.changed_fields) then v_daily.culls else culls end,transfers_in=case when 'transfers_in'=any(v_row.changed_fields) then v_daily.transfers_in else transfers_in end,transfers_out=case when 'transfers_out'=any(v_row.changed_fields) then v_daily.transfers_out else transfers_out end,other_removals=case when 'other_removals'=any(v_row.changed_fields) then v_daily.other_removals else other_removals end,water_consumed_liters=case when 'water_consumed_liters'=any(v_row.changed_fields) then v_daily.water_consumed_liters else water_consumed_liters end,feed_leftover_grams=case when 'feed_leftover_grams'=any(v_row.changed_fields) then v_daily.feed_leftover_grams else feed_leftover_grams end,vaccination_status=case when 'vaccination_status'=any(v_row.changed_fields) then v_daily.vaccination_status else vaccination_status end,medication_vitamins=case when 'medication_vitamins'=any(v_row.changed_fields) then v_daily.medication_vitamins else medication_vitamins end,updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Daily record not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='void_record' then
      if v_row.source_table not in ('daily_farm_records','feeding_session_records','daily_sales_records','health_events','vaccination_events','biosecurity_checks','batch_weight_check_tasks') then raise exception 'Unsupported void target.' using errcode='22023'; end if;
      execute format('update public.%I set voided_at=now(),voided_by=$1,void_reason=$2 where id=$3 and org_id=$4 and voided_at is null',v_row.source_table) using auth.uid(),v_row.reason,v_row.source_id,v_row.org_id;
    else
      raise exception 'No atomic application adapter is registered for request type %.',v_row.request_type using errcode='0A000';
    end if;
  end if;
  update public.governance_requests set status=case when p_decision='approved' then 'applied' else 'rejected' end,source_table=coalesce(v_row.source_table,source_table),source_id=coalesce(v_row.source_id,source_id),applied_at=case when p_decision='approved' then now() else null end,decided_by=auth.uid(),decided_at=now(),decision_note=trim(p_note),updated_at=now() where id=p_request_id returning * into v_row;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
  values(v_row.org_id,auth.uid(),v_role,'governance_request.'||v_row.status,'governance_requests',v_row.id::text,p_note,to_jsonb(v_row));
  return v_row;
end $$;

create or replace function public.decide_break_glass_request(p_request_id uuid,p_decision text,p_note text) returns public.break_glass_requests
language plpgsql security definer set search_path=public as $$
declare v_row public.break_glass_requests; v_session public.break_glass_sessions;
begin
  if public.current_active_role()<>'ceo' then raise exception 'Only the tenant CEO can authorize support access.' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') or length(trim(coalesce(p_note,'')))<4 then raise exception 'A valid decision and note are required.' using errcode='22023'; end if;
  select * into v_row from public.break_glass_requests where id=p_request_id and target_org_id=public.current_org_id() for update;
  if not found then raise exception 'Support request not found.' using errcode='P0002'; end if;
  if v_row.status<>'pending' then raise exception 'This support request is no longer pending.' using errcode='40001'; end if;
  update public.break_glass_requests set status=p_decision,decided_by=auth.uid(),decided_at=now(),decision_note=trim(p_note),expires_at=case when p_decision='approved' then now()+make_interval(mins=>v_row.requested_minutes) else null end where id=p_request_id returning * into v_row;
  if p_decision='approved' then
    insert into public.break_glass_sessions(request_id,target_org_id,administrator_id,expires_at) values(v_row.id,v_row.target_org_id,v_row.administrator_id,v_row.expires_at) returning * into v_session;
  end if;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,entity_table,entity_id,reason,after_values)
  values(v_row.target_org_id,auth.uid(),'ceo',v_session.id,'break_glass.'||p_decision,'break_glass_requests',v_row.id::text,p_note,to_jsonb(v_row));
  return v_row;
end $$;

create or replace function public.record_support_access(p_path text,p_method text) returns void language plpgsql security definer set search_path=public as $$
declare v_session public.break_glass_sessions;
begin
  select * into v_session from public.break_glass_sessions where administrator_id=auth.uid() and started_at<=now() and expires_at>now() and revoked_at is null order by expires_at desc limit 1;
  if not found then raise exception 'Active support session required.' using errcode='42501'; end if;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,entity_table,entity_id,metadata)
  values(v_session.target_org_id,auth.uid(),'system_admin',v_session.id,case when upper(p_method) in ('POST','PUT','PATCH','DELETE') then 'break_glass.mutation_access' else 'break_glass.read_access' end,'http_request',p_path,jsonb_build_object('method',upper(p_method)));
end $$;

alter table public.user_warehouse_access enable row level security; alter table public.farm_operating_days enable row level security;
alter table public.governance_requests enable row level security; alter table public.break_glass_requests enable row level security;
alter table public.break_glass_sessions enable row level security; alter table public.governance_audit_events enable row level security;

create policy user_warehouse_access_ceo_all on public.user_warehouse_access for all using (public.current_active_role()='ceo' and org_id=public.current_org_id()) with check (public.current_active_role()='ceo' and org_id=public.current_org_id());
create policy user_warehouse_access_manager_read on public.user_warehouse_access for select using (profile_id=auth.uid());
create policy operating_days_tenant_read on public.farm_operating_days for select using (org_id=public.current_org_id() and (public.current_active_role()='ceo' or public.has_active_farm_access(farm_id)));
create policy governance_requests_tenant_read on public.governance_requests for select using (org_id=public.current_org_id() and (public.current_active_role()='ceo' or requested_by=auth.uid() or (farm_id is not null and public.has_active_farm_access(farm_id))));
create policy governance_requests_manager_insert on public.governance_requests for insert with check (public.current_active_role()='farm_manager' and org_id=public.current_org_id() and requested_by=auth.uid() and (farm_id is null or public.has_active_farm_access(farm_id)));
create policy break_glass_admin_request on public.break_glass_requests for insert with check (public.current_active_role()='system_admin' and administrator_id=auth.uid());
create policy break_glass_participant_read on public.break_glass_requests for select using (administrator_id=auth.uid() or (target_org_id=public.current_org_id() and public.current_active_role()='ceo'));
create policy break_glass_sessions_participant_read on public.break_glass_sessions for select using (administrator_id=auth.uid() or (target_org_id=public.current_org_id() and public.current_active_role()='ceo'));
create policy governance_audit_scoped_read on public.governance_audit_events for select using ((org_id=public.current_org_id() and public.current_active_role()='ceo') or actor_id=auth.uid() or (public.current_active_role()='system_admin' and support_session_id is not null));

grant execute on function public.close_farm_operating_day(uuid,date,jsonb) to authenticated;
grant execute on function public.decide_governance_request(uuid,text,text) to authenticated;
grant execute on function public.decide_break_glass_request(uuid,text,text) to authenticated;
grant execute on function public.record_support_access(text,text) to authenticated;
revoke all on function public.lock_overdue_operating_days() from public,authenticated;

-- Run frequently; the function itself applies each organization's Addis Ababa cutoff.
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='lock-overdue-farm-operating-days';
    perform cron.schedule('lock-overdue-farm-operating-days','*/15 * * * *','select public.lock_overdue_operating_days()');
  end if;
end $$;

insert into public.farm_operating_days(org_id,farm_id,operating_date,status,locked_at)
select f.org_id,f.id,d::date,'locked',now() from public.farms f cross join lateral generate_series(coalesce((select min(fl.placement_date) from public.flocks fl where fl.farm_id=f.id),(now() at time zone 'Africa/Addis_Ababa')::date),(now() at time zone 'Africa/Addis_Ababa')::date-interval '1 day',interval '1 day') d
on conflict(farm_id,operating_date) do nothing;
insert into public.farm_operating_days(org_id,farm_id,operating_date,status)
select org_id,id,(now() at time zone 'Africa/Addis_Ababa')::date,'open' from public.farms on conflict(farm_id,operating_date) do nothing;
