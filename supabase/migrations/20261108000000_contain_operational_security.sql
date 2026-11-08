-- Findings 1–7: no source rows, stock calculations, or tenant rollout flags change.
create function public.actor_has_operational_scope(p_actor uuid,p_org uuid,p_farm uuid,p_warehouse uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=p_actor and p.is_active and (
   (p.role::text='system_admin' and exists(select 1 from public.break_glass_sessions s
     where s.administrator_id=p.id and s.target_org_id=p_org and s.revoked_at is null and s.started_at<=now() and s.expires_at>now()))
   or (p.org_id=p_org and (p.role::text='ceo' or (p.role::text='farm_manager'
     and (p_farm is not null or p_warehouse is not null)
     and (p_farm is null or exists(select 1 from public.user_farm_access a join public.farms f on f.id=a.farm_id
       where a.profile_id=p.id and a.org_id=p_org and f.org_id=p_org and a.farm_id=p_farm
       and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())))
     and (p_warehouse is null or public.manager_has_effective_warehouse_access(p.id,p_warehouse))
   )))))
$$;
revoke all on function public.actor_has_operational_scope(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.actor_has_operational_scope(uuid,uuid,uuid,uuid) to service_role;

create function public.current_operational_scope_allowed(p_org uuid,p_farm uuid,p_warehouse uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.actor_has_operational_scope(auth.uid(),p_org,p_farm,p_warehouse)
$$;
create function public.current_operational_flock_allowed(p_org uuid,p_flock uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.flocks f where f.id=p_flock and f.org_id=p_org
   and public.actor_has_operational_scope(auth.uid(),p_org,f.farm_id,null))
$$;
revoke all on function public.current_operational_scope_allowed(uuid,uuid,uuid),public.current_operational_flock_allowed(uuid,uuid) from public,anon;
grant execute on function public.current_operational_scope_allowed(uuid,uuid,uuid),public.current_operational_flock_allowed(uuid,uuid) to authenticated;

-- Restrictive policies intersect every retained permissive policy, including ALL policies.
do $$ declare t text; begin
 foreach t in array array['daily_farm_records','health_events','weight_records','mortality_events','vaccination_events','feeding_session_records','feed_day_closures','batch_weight_check_tasks'] loop
   execute format('create policy security_current_flock_read on public.%I as restrictive for select to authenticated using(public.current_operational_flock_allowed(org_id,flock_id))',t);
   execute format('create policy security_current_flock_select on public.%I for select to authenticated using(public.current_operational_flock_allowed(org_id,flock_id))',t);
 end loop;
end $$;
create policy security_current_sales_read on public.daily_sales_records as restrictive for select to authenticated
 using(public.current_operational_scope_allowed(org_id,farm_id,null));
create policy security_current_cost_read on public.cost_entries as restrictive for select to authenticated
 using(public.current_operational_scope_allowed(org_id,farm_id,warehouse_id));
create policy security_current_cost_select on public.cost_entries for select to authenticated
 using(public.current_operational_scope_allowed(org_id,farm_id,warehouse_id));
create policy security_current_cleanup_read on public.biosecurity_checks as restrictive for select to authenticated
 using(public.current_operational_scope_allowed(org_id,farm_id,null));
create policy security_current_feed_store_read on public.feeding_session_records as restrictive for select to authenticated
 using(warehouse_id is null or public.current_operational_scope_allowed(org_id,null,warehouse_id));
-- Cost mutations already use guarded operational RPCs; the old ALL policy is not entry authority.
revoke insert,update,delete on public.cost_entries from authenticated,anon;

-- Helpers/triggers and retired operations do not need public network execution.
do $$ declare r record; begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in (
    'apply_daily_farm_record_counts','apply_egg_opening_balance_request','apply_monthly_cost_period_totals',
    'apply_sales_unit_conversion_request','ceo_initialize_branch_hierarchy','close_farm_operating_day',
    'close_feed_day','create_branch_batch_cycle','guard_completed_flock_entry_v1','guard_farm_manager_assignment',
    'guard_warehouse_assignment_ownership','prevent_closed_feed_day_record_delete','record_feed_milestone',
    'record_feed_weight','record_support_access','reopen_feed_day') loop
   execute format('revoke execute on function %s from public,anon',r.signature);
 end loop;
 -- These have no direct browser callers. Today/Governance invoke them inside trusted SQL.
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname in ('ceo_initialize_branch_hierarchy','record_feed_weight','record_feed_milestone','close_feed_day','reopen_feed_day') loop
   execute format('revoke execute on function %s from authenticated',r.signature);
   execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;

-- Replace obsolete assignment checks, not feed/stock arithmetic.
do $$ declare r record; definition text; updated text;
 pattern text:='if v_role\s*=\s*''farm_manager'' and not \(exists\(select 1 from public\.user_farm_access a where a\.profile_id\s*=\s*p_actor_id and a\.farm_id\s*=\s*v_farm_id\)\s+or exists\(select 1 from public\.user_branch_access a where a\.profile_id\s*=\s*p_actor_id and a\.branch_id\s*=\s*v_branch_id\)\) then';
begin
 for r in select p.oid from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in ('save_feed_template','record_feed_weight','record_feed_milestone','reopen_feed_day') loop
   definition:=pg_get_functiondef(r.oid);
   updated:=regexp_replace(definition,pattern,'if not public.actor_has_operational_scope(p_actor_id,v_org_id,v_farm_id,null) then','g');
   -- Some retained bodies use spaced multiline predicates; refuse to miss them silently.
   if updated like '%public.user_branch_access%' then raise exception 'Unrecognized legacy feed authorization in %',r.oid::regprocedure; end if;
   if updated=definition then raise exception 'Feed authorization seam changed in %',r.oid::regprocedure; end if;
   execute updated;
 end loop;
end $$;

-- Only the existing approved apply operation sets this transaction-local flag.
do $$ declare definition text; updated text; begin
 definition:=pg_get_functiondef('public.save_feed_template(uuid,uuid,text,text,jsonb)'::regprocedure);
 updated:=regexp_replace(definition,E'begin[\r\n]+',E'begin\n  if coalesce(current_setting(''app.governance_apply'',true),''false'')<>''true'' then\n    raise exception ''Apply an exact CEO-approved feed-template request.'' using errcode=''42501'';\n  end if;\n','i');
 if updated=definition then raise exception 'Feed template approval seam changed'; end if;
 execute updated;
end $$;
revoke all on function public.save_feed_template(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.save_feed_template(uuid,uuid,text,text,jsonb) to service_role;

-- New functions must declare their intended API grants explicitly.
alter default privileges for role postgres in schema public revoke execute on functions from public;

create function public.notification_recipient_has_access(p_notification uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.notifications n join public.operational_actions a on a.id=n.action_id and a.org_id=n.org_id
   where n.id=p_notification and public.actor_has_operational_scope(n.recipient_id,n.org_id,a.farm_id,a.warehouse_id))
$$;
revoke all on function public.notification_recipient_has_access(uuid) from public,anon,authenticated;
grant execute on function public.notification_recipient_has_access(uuid) to service_role;
create view public.authorized_notifications as
 select n.* from public.notifications n where public.notification_recipient_has_access(n.id);
revoke all on public.authorized_notifications from public,anon,authenticated;
grant select on public.authorized_notifications to service_role;
create policy security_current_notification_read on public.notifications as restrictive for select to authenticated using(
 recipient_id=auth.uid() and exists(select 1 from public.operational_actions a where a.id=notifications.action_id and a.org_id=notifications.org_id
   and public.current_operational_scope_allowed(a.org_id,a.farm_id,a.warehouse_id)));

create function public.edit_legacy_health_schedule(p_actor uuid,p_org uuid,p_schedule uuid,p_kind text,p_expected_version timestamptz,
 p_date date,p_farm uuid,p_house uuid,p_flock uuid,p_changes jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare table_name text; before_source jsonb; after_source jsonb; before_events jsonb; events jsonb; old_farm uuid; old_date date; actor_role text; support_id uuid;
begin
 if auth.uid() is not null and auth.uid()<>p_actor then raise exception 'Actor mismatch.' using errcode='42501'; end if;
 select role::text into actor_role from public.profiles where id=p_actor and is_active;
 if actor_role not in ('farm_manager','system_admin') or actor_role is null then raise exception 'Active operations authority is required.' using errcode='42501'; end if;
 if p_kind not in ('vaccination','cleanup') or p_kind is null or p_date is null or p_farm is null
   or p_expected_version is null or jsonb_typeof(p_changes) is distinct from 'object' then raise exception 'Refresh the schedule and choose valid changes.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('vaccine_name','dosage','route','notes')) then raise exception 'Unsupported schedule fields.' using errcode='22023'; end if;
 table_name:=case when p_kind='vaccination' then 'vaccination_events' else 'biosecurity_checks' end;
 perform pg_advisory_xact_lock(hashtextextended('legacy-health:'||p_schedule::text,0));
 execute format('select to_jsonb(s) from public.%I s where id=$1 and org_id=$2 for update',table_name) into before_source using p_schedule,p_org;
 if before_source is null or before_source->>'voided_at' is not null then raise exception 'Schedule is unavailable.' using errcode='42501'; end if;
 old_farm:=(before_source->>'farm_id')::uuid;
 if p_kind='vaccination' then select farm_id into old_farm from public.flocks where id=(before_source->>'flock_id')::uuid and org_id=p_org for share; end if;
 if old_farm is null or not public.actor_has_operational_scope(p_actor,p_org,old_farm,null)
   or not public.actor_has_operational_scope(p_actor,p_org,p_farm,null) then raise exception 'Original and destination farm access are required.' using errcode='42501'; end if;
 if (before_source->>'updated_at')::timestamptz is distinct from p_expected_version then raise exception 'Schedule changed. Refresh before editing.' using errcode='40001'; end if;
 if p_flock is not null and not exists(select 1 from public.flocks f where f.id=p_flock and f.org_id=p_org and f.farm_id=p_farm
   and f.house_id=p_house and f.status::text in ('active','quarantined') and f.completed_at is null) then raise exception 'Choose a flock in the selected farm and house.' using errcode='22023'; end if;
 if p_house is not null and not exists(select 1 from public.houses where id=p_house and org_id=p_org and farm_id=p_farm) then raise exception 'House is outside the selected farm.' using errcode='22023'; end if;
 if p_kind='vaccination' and p_flock is null then raise exception 'Vaccination needs a flock.' using errcode='22023'; end if;
 perform 1 from public.health_events where org_id=p_org and
   (description like 'SCHEDULE_TARGET|'||p_schedule::text||'|%' or description like 'SCHEDULE_STATUS|'||p_schedule::text||'|%') for update;
 if exists(select 1 from public.health_events h join public.flocks f on f.id=h.flock_id and f.org_id=h.org_id where h.org_id=p_org
   and (h.description like 'SCHEDULE_TARGET|'||p_schedule::text||'|%' or h.description like 'SCHEDULE_STATUS|'||p_schedule::text||'|%')
   and not public.actor_has_operational_scope(p_actor,p_org,f.farm_id,null)) then raise exception 'Linked evidence is outside your assignment.' using errcode='42501'; end if;
 if before_source->>'completed_by' is not null or (p_kind='vaccination' and before_source->>'birds_vaccinated' is not null)
   or exists(select 1 from public.health_events where org_id=p_org and voided_at is null
   and description like 'SCHEDULE_STATUS|'||p_schedule::text||'|completed|%')
   or exists(select 1 from public.stock_ledger where org_id=p_org and source_kind='vaccination_completion' and source_key=p_schedule::text) then
   raise exception 'Completed evidence requires an exact governed correction.' using errcode='55000'; end if;
 old_date:=coalesce(before_source->>'event_date',before_source->>'checklist_date')::date;
 if exists(select 1 from public.farm_operating_days where (farm_id=old_farm and operating_date=old_date or farm_id=p_farm and operating_date=p_date) and status in ('closed','locked')) then
   raise exception 'The operating day is closed. Request a governed correction.' using errcode='55000'; end if;
 select coalesce(jsonb_agg(to_jsonb(h) order by h.id),'[]') into before_events from public.health_events h where h.org_id=p_org and
   (h.description like 'SCHEDULE_TARGET|'||p_schedule::text||'|%' or h.description like 'SCHEDULE_STATUS|'||p_schedule::text||'|%');
 if p_flock is null and jsonb_array_length(before_events)>0 then raise exception 'Choose a flock for linked evidence.' using errcode='22023'; end if;
 perform set_config('app.audit_actor_id',p_actor::text,true);
 if actor_role='system_admin' then
   select id into support_id from public.break_glass_sessions where administrator_id=p_actor and target_org_id=p_org
     and revoked_at is null and started_at<=now() and expires_at>now() order by started_at desc limit 1;
   perform set_config('app.support_session_id',support_id::text,true);
 end if;
 if p_kind='vaccination' then
   if nullif(btrim(coalesce(p_changes->>'vaccine_name',before_source->>'vaccine_name')),'') is null
     or nullif(btrim(coalesce(p_changes->>'dosage',before_source->>'dosage')),'') is null
     or coalesce(p_changes->>'route',before_source->>'route') not in ('water','injection','spray','eye_drop') then raise exception 'Valid vaccine, dosage and route are required.' using errcode='22023'; end if;
   update public.vaccination_events set event_date=p_date,flock_id=p_flock,
     vaccine_name=coalesce(p_changes->>'vaccine_name',vaccine_name),dosage=coalesce(p_changes->>'dosage',dosage),route=coalesce((p_changes->>'route')::public.vaccination_route,route),updated_at=clock_timestamp() where id=p_schedule and org_id=p_org;
 else
   update public.biosecurity_checks set checklist_date=p_date,farm_id=p_farm,notes=coalesce(p_changes->>'notes',notes),updated_at=clock_timestamp() where id=p_schedule and org_id=p_org;
 end if;
 update public.health_events set event_date=p_date,flock_id=p_flock,description=case when description like 'SCHEDULE_TARGET|%' then
   'SCHEDULE_TARGET|'||p_schedule::text||'|'||p_farm::text||'|'||coalesce(p_house::text,'')||'|'||p_flock::text else description end
 where org_id=p_org and (description like 'SCHEDULE_TARGET|'||p_schedule::text||'|%' or description like 'SCHEDULE_STATUS|'||p_schedule::text||'|%');
 execute format('select to_jsonb(s) from public.%I s where id=$1 and org_id=$2',table_name) into after_source using p_schedule,p_org;
 select coalesce(jsonb_agg(to_jsonb(h) order by h.id),'[]') into events from public.health_events h where h.org_id=p_org and
   (h.description like 'SCHEDULE_TARGET|'||p_schedule::text||'|%' or h.description like 'SCHEDULE_STATUS|'||p_schedule::text||'|%');
 insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,operation,entity_table,entity_id,reason,before_values,after_values,farm_id,flock_id)
 values(p_org,p_actor,actor_role,support_id,'health_schedule.evidence_updated','update',table_name,p_schedule::text,'Updated schedule and linked evidence atomically.',
   jsonb_build_object('source',before_source,'events',before_events),jsonb_build_object('source',after_source,'events',events),p_farm,p_flock);
 return jsonb_build_object('events',events,'revision',after_source->>'updated_at');
end $$;
revoke all on function public.edit_legacy_health_schedule(uuid,uuid,uuid,text,timestamptz,date,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.edit_legacy_health_schedule(uuid,uuid,uuid,text,timestamptz,date,uuid,uuid,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
