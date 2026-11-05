alter table public.governance_requests drop constraint governance_requests_request_type_check;
alter table public.governance_requests add constraint governance_requests_request_type_check check(request_type in (
 'batch_create','batch_archive','flock_place','flock_transfer','flock_close','flock_archive','feed_template','breed_target',
 'health_schedule','warning_threshold','locked_correction','void_record','egg_opening_balance','sales_unit_conversion',
 'batch_cycle_create','batch_cycle_close','archived_cycle_correction','recording_start'));

create table public.flock_recording_starts (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id),
 farm_id uuid not null references public.farms(id),
 flock_id uuid not null references public.flocks(id),
 effective_date date not null, live_birds integer not null check(live_birds>=0),
 previous_live_birds integer not null check(previous_live_birds>=0),
 supporting_reference text not null check(length(btrim(supporting_reference))>=3),
 reason text not null check(length(btrim(reason))>=8),
 request_id uuid not null unique references public.governance_requests(id),
 requested_by uuid not null references public.profiles(id),
 approved_by uuid not null references public.profiles(id),
 applied_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(org_id,flock_id)
);
alter table public.flock_recording_starts enable row level security;
revoke all on public.flock_recording_starts from public,anon,authenticated;
grant select on public.flock_recording_starts to authenticated;
grant all on public.flock_recording_starts to service_role;
create policy recording_start_read on public.flock_recording_starts for select to authenticated using(
 org_id=public.current_org_id() and (public.current_active_role()='ceo' or
 (public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id))));
create trigger recording_start_append_only before update or delete on public.flock_recording_starts
 for each row execute function public.reject_lifecycle_evidence_edit();

create function public.recording_start_revision(p_org uuid,p_flock uuid) returns text
language sql stable security definer set search_path=public,extensions as $$
 select encode(extensions.digest(jsonb_build_object(
  'flock',(select to_jsonb(f) from public.flocks f where id=p_flock and org_id=p_org),
  'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by id),'[]'::jsonb) from public.daily_farm_records d where org_id=p_org and flock_id=p_flock),
  'start',(select to_jsonb(s) from public.flock_recording_starts s where org_id=p_org and flock_id=p_flock),
  'eggs',(select to_jsonb(e) from public.egg_custody_opening_balances e where org_id=p_org and flock_id=p_flock)
 )::text,'sha256'),'hex')
$$;
revoke all on function public.recording_start_revision(uuid,uuid) from public,anon,authenticated;
grant execute on function public.recording_start_revision(uuid,uuid) to service_role;

create function public.recording_start_context(p_actor uuid,p_flock uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare actor public.profiles; flock public.flocks;
begin
 select * into actor from public.profiles where id=p_actor and is_active;
 if not found or actor.role::text not in ('ceo','farm_manager') then
  raise exception 'Recording-start access is unavailable.' using errcode='42501'; end if;
 select * into flock from public.flocks where id=p_flock and org_id=actor.org_id;
 if not found then raise exception 'The flock is unavailable.' using errcode='42501'; end if;
 if actor.role::text='farm_manager' and not exists(select 1 from public.user_farm_access
   where org_id=actor.org_id and profile_id=p_actor and farm_id=flock.farm_id and revoked_at is null
   and starts_at<=now() and (expires_at is null or expires_at>now())) then
  raise exception 'An active farm assignment is required.' using errcode='42501'; end if;
 if flock.status not in ('active','quarantined') or flock.completed_at is not null then
  raise exception 'An archived flock needs historical correction, not a new starting point.' using errcode='23514'; end if;
 return jsonb_build_object('farm_id',flock.farm_id,'placement_date',flock.placement_date,'initial_count',flock.initial_count,
  'current_birds',flock.current_count,'flock_type',flock.flock_type,'updated_at',flock.updated_at,
  'expected_revision',public.recording_start_revision(actor.org_id,flock.id),
  'last_record_date',(select max(record_date) from public.daily_farm_records where org_id=actor.org_id and flock_id=flock.id and voided_at is null),
  'last_record_closing_birds',(select closing_birds from public.daily_farm_records where org_id=actor.org_id and flock_id=flock.id and voided_at is null order by record_date desc limit 1),
  'existing_start',exists(select 1 from public.flock_recording_starts where org_id=actor.org_id and flock_id=flock.id),
  'existing_egg_balance',exists(select 1 from public.egg_custody_opening_balances where org_id=actor.org_id and flock_id=flock.id));
end $$;

-- A later correction to pre-start losses cannot deduct the same historical
-- birds from a physical population established after that history.
do $$ declare definition text; seam text := 'v_loss_delta := v_new_losses - v_old_losses;';
begin
 select pg_get_functiondef('public.apply_daily_farm_record_counts()'::regprocedure) into definition;
 if position(seam in definition)=0 then raise exception 'Daily population seam changed; review before migration.'; end if;
 execute replace(definition,seam,'
  if tg_op<>''DELETE'' and exists(select 1 from public.flock_recording_starts s
    where s.flock_id=new.flock_id and s.effective_date>new.record_date) then v_new_losses:=0; end if;
  if tg_op<>''INSERT'' and exists(select 1 from public.flock_recording_starts s
    where s.flock_id=old.flock_id and s.effective_date>old.record_date) then v_old_losses:=0; end if;
  v_loss_delta := v_new_losses - v_old_losses;');
end $$;
revoke all on function public.recording_start_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.recording_start_context(uuid,uuid) to service_role;

create function public.apply_recording_start_request(p_request_id uuid) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare
 r public.governance_requests; f public.flocks; p jsonb; d date; birds integer; eggs integer;
 before_flock jsonb; after_flock jsonb; prior_apply text; prior_lifecycle text; n text; baseline_id uuid;
begin
 if public.current_active_role()<>'farm_manager' then
  raise exception 'Only an assigned Farm Manager can apply the recording starting point.' using errcode='42501'; end if;
 select * into r from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
 if not found or r.request_type<>'recording_start' then raise exception 'Starting-point request not found.' using errcode='P0002'; end if;
 if not public.has_active_farm_access(r.farm_id) then raise exception 'An active farm assignment is required.' using errcode='42501'; end if;
 if r.status='applied' then return r; end if;
 if r.status<>'approved' or r.decided_at is null or r.approval_expires_at is null or r.approval_expires_at<=now()
  or not exists(select 1 from public.profiles where id=r.decided_by and org_id=r.org_id and role::text='ceo' and is_active) then
  raise exception 'This CEO authorization is no longer available.' using errcode='40001'; end if;
 p:=r.proposed_values;
 select * into f from public.flocks where id=(p->>'flock_id')::uuid and org_id=r.org_id and farm_id=r.farm_id for update;
 if not found or r.source_table is distinct from 'flocks' or r.source_id is distinct from f.id
  or f.status not in ('active','quarantined') or f.completed_at is not null then
  raise exception 'The flock changed or has finished. Submit a new reviewed request.' using errcode='40001'; end if;
 if p->>'expected_revision' is distinct from public.recording_start_revision(r.org_id,f.id) then
  raise exception 'The starting-point evidence changed. Submit a new request.' using errcode='40001'; end if;
 d:=(p->>'effective_date')::date; birds:=(p->>'live_birds')::integer; eggs:=(p->>'opening_eggs')::integer;
 perform pg_advisory_xact_lock(hashtextextended(r.farm_id::text||':'||d::text,0));
 if d is null or d<f.placement_date or d>(now() at time zone 'Africa/Addis_Ababa')::date
  or birds is null or birds<0 or length(btrim(coalesce(p->>'supporting_reference','')))<3
  or exists(select 1 from public.daily_farm_records where org_id=r.org_id and flock_id=f.id and record_date>=d and voided_at is null)
  or exists(select 1 from public.flock_recording_starts where org_id=r.org_id and flock_id=f.id)
  or exists(select 1 from public.egg_custody_opening_balances where org_id=r.org_id and flock_id=f.id) then
  raise exception 'The starting point conflicts with existing evidence. Correct the exact records instead.' using errcode='23514'; end if;
 if exists(select 1 from public.daily_farm_records where org_id=r.org_id and flock_id=f.id and record_date=d-1 and closing_birds is not null and voided_at is null) then
  raise exception 'A preceding closing count is already available. Correct that exact record instead.' using errcode='23514'; end if;
 if (f.flock_type::text in ('layer','parent_stock') and (eggs is null or eggs<0))
  or (f.flock_type::text not in ('layer','parent_stock') and eggs is not null) then
  raise exception 'Explicit opening egg counts apply only to egg-producing flocks.' using errcode='23514'; end if;
 if exists(select 1 from public.farm_operating_days where org_id=r.org_id and farm_id=r.farm_id and operating_date=d and status in ('closed','locked')) then
  raise exception 'The starting day is closed. Request its exact historical correction.' using errcode='55000'; end if;
 before_flock:=to_jsonb(f);
 insert into public.flock_recording_starts(org_id,farm_id,flock_id,effective_date,live_birds,previous_live_birds,supporting_reference,reason,request_id,requested_by,approved_by,applied_by)
 values(r.org_id,r.farm_id,f.id,d,birds,f.current_count,p->>'supporting_reference',r.reason,r.id,r.requested_by,r.decided_by,auth.uid())
 returning id into baseline_id;
 if eggs is not null then
  insert into public.egg_custody_opening_balances(org_id,farm_id,flock_id,effective_date,quantity,reason,source_reference,governance_request_id,requested_by,approved_by,applied_by)
  values(r.org_id,r.farm_id,f.id,d,eggs,r.reason,p->>'supporting_reference',r.id,r.requested_by,r.decided_by,auth.uid());
 end if;
 prior_apply:=current_setting('app.governance_apply',true); prior_lifecycle:=current_setting('app.lifecycle_apply',true);
 perform set_config('app.governance_apply','true',true); perform set_config('app.lifecycle_apply','true',true);
 update public.flocks set current_count=birds,updated_at=now() where id=f.id returning to_jsonb(flocks.*) into after_flock;
 perform set_config('app.governance_apply',coalesce(prior_apply,''),true); perform set_config('app.lifecycle_apply',coalesce(prior_lifecycle,''),true);
 update public.governance_requests set status='applied',applied_at=now(),applied_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 select coalesce(full_name,'Farm Manager') into n from public.profiles where id=auth.uid();
 insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note)
 values(r.org_id,r.id,'applied',auth.uid(),n,'farm_manager','Applied approved recording starting counts without manufacturing earlier history.');
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,before_values,after_values)
 values(r.org_id,auth.uid(),'farm_manager','recording_start.applied','flocks',f.id::text,r.reason,before_flock,after_flock);
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
 values(r.org_id,auth.uid(),'farm_manager','recording_start.established','flock_recording_starts',baseline_id::text,r.reason,
  jsonb_build_object('request',r.id,'effective_date',d,'live_birds',birds,'opening_eggs',eggs));
 return r;
end $$;
revoke all on function public.apply_recording_start_request(uuid) from public,anon;
grant execute on function public.apply_recording_start_request(uuid) to authenticated;

-- Extend the exact new-day check without copying its loss/stock/lock writer.
do $$ declare definition text; seam text := 'elsif prior.id is null and flock.placement_date=work_date then';
begin
 select pg_get_functiondef('public.save_daily_record_with_usage(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure) into definition;
 if position(seam in definition)=0 then raise exception 'Opening-source seam changed; review before migration.'; end if;
 execute replace(definition,seam,
  'elsif exists(select 1 from public.flock_recording_starts s where s.org_id=actor.org_id and s.flock_id=flock.id and s.effective_date=work_date) then
    select live_birds into expected_count from public.flock_recording_starts where org_id=actor.org_id and flock_id=flock.id and effective_date=work_date;
    expected_source := ''baseline'';
   elsif prior.id is null and flock.placement_date=work_date then');
end $$;
