alter table public.management_report_schedules
 add column dispatch_failures integer not null default 0 check(dispatch_failures>=0),
 add column dispatch_retry_at timestamptz,
 add column dispatch_failure_code text;

create function public.due_management_report_schedules(p_cutoff timestamptz,p_after_time timestamptz default null,p_after_id uuid default null)
returns setof public.management_report_schedules language sql stable security definer set search_path=public as $$
 select s.* from public.management_report_schedules s where s.is_active and s.next_run_at<=p_cutoff
 and (s.dispatch_retry_at is null or s.dispatch_retry_at<=p_cutoff)
 and (p_after_time is null or (s.next_run_at,s.id)>(p_after_time,p_after_id))
 order by s.next_run_at,s.id limit 20
$$;

create function public.record_report_schedule_failure(p_id uuid,p_revision timestamptz,p_failures integer,p_code text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_before public.management_report_schedules; v_after public.management_report_schedules;
begin
 select * into v_before from public.management_report_schedules where id=p_id for update;
 if not found or not v_before.is_active or v_before.updated_at is distinct from p_revision
   or v_before.dispatch_failures<>p_failures then return false; end if;
 if p_code not in ('CREATOR_AUTHORITY','GENERATION_FAILED') then raise exception 'Invalid failure code' using errcode='22023'; end if;
 update public.management_report_schedules set dispatch_failures=dispatch_failures+1,
   dispatch_failure_code=p_code,dispatch_retry_at=clock_timestamp()+interval '15 minutes'*(2^least(dispatch_failures,4)),
   is_active=case when p_code='CREATOR_AUTHORITY' or dispatch_failures>=2 then false else is_active end
 where id=p_id returning * into v_after;
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,operation,source,entity_table,entity_id,reason,before_values,after_values)
 values(v_before.org_id,v_before.created_by,'system','management_report.schedule_failed','update','semantic',
   'management_report_schedules',p_id::text,'Scheduled generation failed; retry is delayed or the schedule is paused.',to_jsonb(v_before),to_jsonb(v_after));
 return true;
end $$;

-- Reset dispatch state only in the existing authorized resume/success transactions.
do $$ declare d text; begin
 select pg_get_functiondef('public.set_management_report_schedule_active(uuid,uuid,uuid,boolean,timestamptz,timestamptz)'::regprocedure) into d;
 if position('set is_active=p_active,' in d)=0 then raise exception 'Schedule resume seam changed'; end if;
 execute replace(d,'set is_active=p_active,','set is_active=p_active, dispatch_failures=0,dispatch_retry_at=null,dispatch_failure_code=null,');
 select pg_get_functiondef('public.finish_management_report(uuid,uuid,text,uuid,jsonb,text,text,timestamptz)'::regprocedure) into d;
 if position('set last_run_at=now(),' in d)=0 then raise exception 'Schedule completion seam changed'; end if;
 execute replace(d,'set last_run_at=now(),','set last_run_at=now(),dispatch_failures=0,dispatch_retry_at=null,dispatch_failure_code=null,');
end $$;
revoke all on function public.due_management_report_schedules(timestamptz,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.record_report_schedule_failure(uuid,timestamptz,integer,text) from public,anon,authenticated;
grant execute on function public.due_management_report_schedules(timestamptz,timestamptz,uuid) to service_role;
grant execute on function public.record_report_schedule_failure(uuid,timestamptz,integer,text) to service_role;
