create table public.legacy_weight_schedule_mappings (
 legacy_task_id uuid primary key references public.batch_weight_check_tasks(id), org_id uuid not null references public.organizations(id),
 rule_id uuid not null unique references public.scheduled_work_rules(id), request_id uuid not null unique,
 actor_id uuid not null references public.profiles(id), original_evidence jsonb not null, reason text not null,
 created_at timestamptz not null default now()
);
alter table public.legacy_weight_schedule_mappings enable row level security;
revoke all on public.legacy_weight_schedule_mappings from public,anon,authenticated;
grant select,insert on public.legacy_weight_schedule_mappings to service_role;
create trigger legacy_weight_mapping_immutable before update or delete on public.legacy_weight_schedule_mappings
 for each row execute function public.reject_business_hard_delete();

create function public.reschedule_legacy_template_weight(p_actor uuid,p_task uuid,p_revision timestamptz,p_date date,p_reason text,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.profiles; task public.batch_weight_check_tasks; flock public.flocks; prior public.legacy_weight_schedule_mappings;
 rule jsonb; spec jsonb; farm uuid; today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
begin
 select * into actor from public.profiles where id=p_actor and is_active and role::text='ceo' for share;
 if not found or (auth.uid() is not null and auth.uid()<>p_actor) or p_request is null then raise exception 'Active CEO required.' using errcode='42501'; end if;
 if not exists(select 1 from public.organizations where id=actor.org_id and today_workspace_enabled) then raise exception 'Enable Today before converting legacy work.' using errcode='55000'; end if;
 if p_date is null or p_date<today or length(btrim(coalesce(p_reason,''))) not between 8 and 2000 then raise exception 'Choose an actual new schedule date and explain the decision.' using errcode='22023'; end if;
 select f.farm_id into farm from public.batch_weight_check_tasks t join public.flocks f on f.id=t.flock_id and f.org_id=t.org_id where t.id=p_task and t.org_id=actor.org_id;
 if not found then raise exception 'Legacy check unavailable.' using errcode='42501'; end if;
 -- Match Scheduler's request/farm lock order before locking source records.
 perform pg_advisory_xact_lock(hashtextextended('scheduler-request:'||p_request::text,0));
 perform pg_advisory_xact_lock(hashtextextended('scheduler:'||farm::text,0));
 perform pg_advisory_xact_lock(hashtextextended('legacy-weight:'||p_task::text,0));
 if exists(select 1 from public.legacy_weight_schedule_mappings where request_id=p_request and legacy_task_id<>p_task) then raise exception 'Request already used for another legacy check.' using errcode='40001'; end if;
 select * into task from public.batch_weight_check_tasks where id=p_task and org_id=actor.org_id for update;
 if not found then raise exception 'Legacy check unavailable.' using errcode='42501'; end if;
 select * into prior from public.legacy_weight_schedule_mappings where legacy_task_id=task.id;
 if found then
  select to_jsonb(r) into rule from public.scheduled_work_rules r where r.id=prior.rule_id;
  if prior.request_id<>p_request or prior.actor_id<>p_actor or rule->>'start_date'<>p_date::text or prior.reason<>btrim(p_reason) then
   raise exception 'This legacy check was already mapped. Refresh Scheduler.' using errcode='40001'; end if;
  return rule;
 end if;
 if task.updated_at is distinct from p_revision or task.weight_record_id is not null or task.status='completed' then raise exception 'Legacy evidence changed. Refresh before deciding.' using errcode='40001'; end if;
 select * into flock from public.flocks where id=task.flock_id and org_id=actor.org_id and farm_id=farm for share;
 if not found or flock.completed_at is not null or flock.status::text not in ('active','quarantined') then raise exception 'Resolve archived or unavailable legacy work through its governed correction.' using errcode='55000'; end if;
 spec:=jsonb_build_object('farm_id',flock.farm_id,'title',left(flock.flock_code,140)||' · '||task.due_week_number::text,
  'notes',btrim(p_reason),'kind','weight','frequency','once','start_date',p_date,'end_date',p_date,'flock_ids',jsonb_build_array(flock.id),'active',true);
 rule:=public.save_scheduled_work_rule(p_actor,p_request,null,null,spec);
 insert into public.legacy_weight_schedule_mappings(legacy_task_id,org_id,rule_id,request_id,actor_id,original_evidence,reason)
 values(task.id,actor.org_id,(rule->>'id')::uuid,p_request,p_actor,to_jsonb(task),btrim(p_reason));
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,before_values,after_values)
 values(actor.org_id,p_actor,'ceo','template_weight.explicitly_rescheduled','batch_weight_check_tasks',task.id::text,btrim(p_reason),to_jsonb(task),rule);
 return rule;
end $$;
revoke all on function public.reschedule_legacy_template_weight(uuid,uuid,timestamptz,date,text,uuid) from public,anon,authenticated;
grant execute on function public.reschedule_legacy_template_weight(uuid,uuid,timestamptz,date,text,uuid) to service_role;

drop function public.scheduler_legacy_preflight(uuid,uuid[]);
create function public.scheduler_legacy_preflight(p_org uuid,p_farms uuid[])
returns table(kind text,title text,due_date date,flock_label text,route text,mapping text,legacy_id uuid,revision timestamptz)
language sql stable security definer set search_path=public as $$
 select 'weight',f.flock_code,t.due_date,f.flock_code,'/app/feeding-log?task_id='||t.id::text,
  case when t.weight_record_id is not null or f.completed_at is not null or f.status::text not in ('active','quarantined') then 'blocked' else 'review_required' end,t.id,t.updated_at
 from public.batch_weight_check_tasks t join public.flocks f on f.id=t.flock_id and f.org_id=t.org_id
 where t.org_id=p_org and f.farm_id=any(p_farms) and t.status<>'completed'
  and not exists(select 1 from public.legacy_weight_schedule_mappings decision where decision.legacy_task_id=t.id)
 union all
 select 'vaccination',v.vaccine_name,v.event_date,f.flock_code,'/app/health?record='||v.id::text,'review_required',null::uuid,null::timestamptz
 from public.vaccination_events v join public.flocks f on f.id=v.flock_id and f.org_id=v.org_id
 where v.org_id=p_org and f.farm_id=any(p_farms) and v.voided_at is null and v.event_date>=(now() at time zone 'Africa/Addis_Ababa')::date
  and not exists(select 1 from public.health_events h where h.org_id=p_org and h.voided_at is null and h.description='SCHEDULE_STATUS|'||v.id::text||'|completed|vaccination')
 union all
 select 'cleaning',coalesce(c.notes,'Cleaning'),c.checklist_date,null,'/app/health?record='||c.id::text,'review_required',null::uuid,null::timestamptz
 from public.biosecurity_checks c where c.org_id=p_org and c.farm_id=any(p_farms) and c.voided_at is null and c.completed_by is null
  and c.checklist_date>=(now() at time zone 'Africa/Addis_Ababa')::date
$$;
revoke all on function public.scheduler_legacy_preflight(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.scheduler_legacy_preflight(uuid,uuid[]) to service_role;
notify pgrst,'reload schema';
