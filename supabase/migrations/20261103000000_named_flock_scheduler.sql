-- Plans are not completed health/stock records. Legacy schedules remain untouched.
create table public.scheduled_work_rules (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 farm_id uuid not null references public.farms(id), created_by uuid not null references public.profiles(id),
 created_by_role text not null check(created_by_role in ('ceo','farm_manager')),
 kind text not null check(kind in ('weight','cleaning','vaccination','treatment')),
 title text not null check(length(btrim(title)) between 2 and 160), notes text not null default '',
 frequency text not null check(frequency in ('once','daily','weekly')),
 start_date date not null, end_date date, flock_ids uuid[] not null check(cardinality(flock_ids) between 1 and 100),
 active boolean not null default true, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(end_date is null or end_date>=start_date)
);
create table public.scheduled_work_occurrences (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id),
 rule_id uuid not null references public.scheduled_work_rules(id), farm_id uuid not null references public.farms(id),
 flock_id uuid not null references public.flocks(id), due_date date not null,
 title text not null, instructions text not null default '', kind text not null, plan_revision integer not null,
 revision integer not null default 1,
 status text not null default 'pending' check(status in ('pending','completed','deferred','skipped','cancelled')),
 source_table text, source_id uuid, reason text, outcome_date date, outcome_by uuid references public.profiles(id),
 deferred_to date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(rule_id,flock_id,due_date), check(kind in ('weight','cleaning','vaccination','treatment'))
);
create index scheduled_work_due on public.scheduled_work_occurrences(org_id,farm_id,status,due_date);
create index scheduled_work_flock on public.scheduled_work_occurrences(flock_id,due_date);
create table public.scheduler_rule_receipts(
 id uuid primary key, org_id uuid not null references public.organizations(id),actor_id uuid not null references public.profiles(id),
 payload_hash text not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table public.scheduler_rule_receipts enable row level security;
revoke all on public.scheduler_rule_receipts from public,anon,authenticated;
grant all on public.scheduler_rule_receipts to service_role;
create trigger scheduler_rule_receipts_append_only before update or delete on public.scheduler_rule_receipts
 for each row execute function public.reject_business_hard_delete();
alter table public.scheduled_work_rules enable row level security;
alter table public.scheduled_work_occurrences enable row level security;
revoke all on public.scheduled_work_rules,public.scheduled_work_occurrences from public,anon,authenticated;
grant select on public.scheduled_work_rules,public.scheduled_work_occurrences to authenticated;
grant all on public.scheduled_work_rules,public.scheduled_work_occurrences to service_role;
create policy scheduler_rule_read on public.scheduled_work_rules for select to authenticated using(
 org_id=public.current_org_id() and (public.current_active_role()='ceo' or
 (public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id))));
create policy scheduler_occurrence_read on public.scheduled_work_occurrences for select to authenticated using(
 org_id=public.current_org_id() and (public.current_active_role()='ceo' or
 (public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id))));

create function public.generate_scheduled_work(p_org uuid,p_farm uuid,p_today date) returns integer
language plpgsql security definer set search_path=public as $$
declare r public.scheduled_work_rules; n integer; total integer:=0; work record; action uuid; manager uuid; event_id bigint; before_status text;
begin
 if p_today is distinct from (now() at time zone 'Africa/Addis_Ababa')::date then raise exception 'Use the current operating date.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('scheduler:'||p_farm::text,0));
 -- Completed identities never hand their plans to replacement flocks.
 update public.scheduled_work_occurrences o set status='cancelled',reason='Flock lifecycle or location changed',revision=o.revision+1,updated_at=now()
 where o.org_id=p_org and o.farm_id=p_farm and o.status='pending' and exists(
  select 1 from public.flocks f where f.id=o.flock_id and (f.farm_id<>o.farm_id or f.completed_at is not null or f.status::text not in ('active','quarantined')));
 for r in select * from public.scheduled_work_rules where org_id=p_org and farm_id=p_farm and active loop
  insert into public.scheduled_work_occurrences(org_id,rule_id,farm_id,flock_id,due_date,title,instructions,kind,plan_revision)
  select p_org,r.id,r.farm_id,f.id,d::date,r.title,r.notes,r.kind,r.revision
  from public.flocks f cross join generate_series(greatest(r.start_date,p_today)::timestamp,
   least(coalesce(r.end_date,p_today+89),p_today+89)::timestamp,interval '1 day') d
  where f.id=any(r.flock_ids) and f.org_id=p_org and f.farm_id=r.farm_id and f.completed_at is null
   and f.status::text in ('active','quarantined') and f.placement_date<=d::date
   and not exists(select 1 from public.farm_operating_days od where od.farm_id=r.farm_id and od.operating_date=d::date and od.status in ('closed','locked'))
   and (r.frequency='daily' or r.frequency='once' and d::date=r.start_date or r.frequency='weekly' and (d::date-r.start_date)%7=0)
  on conflict(rule_id,flock_id,due_date) do nothing;
  get diagnostics n=row_count; total:=total+n;
 end loop;
 for work in select o.*,f.flock_code from public.scheduled_work_occurrences o join public.flocks f on f.id=o.flock_id
  where o.org_id=p_org and o.farm_id=p_farm and f.farm_id=o.farm_id and o.status='pending' and o.due_date<=p_today and f.completed_at is null
   and f.status::text in ('active','quarantined') loop
  select a.profile_id into manager from public.user_farm_access a join public.profiles p on p.id=a.profile_id
   where a.farm_id=p_farm and a.org_id=p_org and p.is_active and p.role::text='farm_manager' and a.revoked_at is null
    and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()) for share of a,p;
  insert into public.operational_actions(org_id,source_key,source_name,source_route,title,context,severity,farm_id,status,owner_id,due_at,source_first_seen_at,source_last_seen_at)
  values(p_org,'scheduled-work-'||work.id::text,'Scheduler','/app/today?farm_id='||p_farm::text||'&flock_id='||work.flock_id::text||'&task=scheduled_work',
   work.title,work.flock_code||' · '||work.due_date::text,case when work.due_date<p_today then 'high' else 'medium' end,p_farm,
   case when manager is null then 'open' else 'assigned' end,manager,(work.due_date+time '23:59:59') at time zone 'Africa/Addis_Ababa',now(),now())
   on conflict(org_id,source_key) do nothing returning id into action;
  if action is not null then
   insert into public.operational_action_events(org_id,action_id,event_type,actor_name_snapshot,actor_role_snapshot,note,after_status)
    values(p_org,action,case when manager is null then 'discovered' else 'assigned' end,'System','system','Named-flock work is due',case when manager is null then 'open' else 'assigned' end) returning id into event_id;
   if manager is not null then
    insert into public.notifications(org_id,recipient_id,action_id,action_event_id,event_type,severity,title,message,route)
     values(p_org,manager,action,event_id,'assigned',case when work.due_date<p_today then 'high' else 'medium' end,work.title,
      work.flock_code,'/app/today?farm_id='||p_farm::text||'&flock_id='||work.flock_id::text||'&task=scheduled_work');
   end if;
  end if;
  if work.due_date<p_today then
   with locked as (select id,status from public.operational_actions where org_id=p_org and source_key='scheduled-work-'||work.id::text
    and status in ('open','assigned','acknowledged','in_progress') for update)
   update public.operational_actions a set status='escalated',severity='high',escalated_at=now(),escalation_reason='Scheduled work is overdue',updated_at=now()
    from locked where a.id=locked.id returning a.id,a.owner_id,locked.status into action,manager,before_status;
   if action is not null then
    insert into public.operational_action_events(org_id,action_id,event_type,actor_name_snapshot,actor_role_snapshot,note,before_status,after_status)
     values(p_org,action,'escalated','System','system','Scheduled work is overdue',before_status,'escalated') returning id into event_id;
    insert into public.notifications(org_id,recipient_id,action_id,action_event_id,event_type,severity,title,message,route)
     select p_org,p.id,action,event_id,'escalated','high',work.title,work.flock_code,
      '/app/today?farm_id='||p_farm::text||'&flock_id='||work.flock_id::text||'&task=scheduled_work'
     from public.profiles p where p.org_id=p_org and p.is_active and (p.role::text='ceo' or p.id=manager);
   end if;
  end if;
 end loop;
 return total;
end $$;

create function public.save_scheduled_work_rule(p_actor uuid,p_request uuid,p_id uuid,p_revision integer,p_spec jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare actor public.profiles; r public.scheduled_work_rules; old jsonb; result jsonb; replay public.scheduler_rule_receipts;
 farm uuid:=(p_spec->>'farm_id')::uuid; targets uuid[]; today date:=(now() at time zone 'Africa/Addis_Ababa')::date; fingerprint text;
begin
 select * into actor from public.profiles where id=p_actor and is_active and role::text in ('ceo','farm_manager') for share;
 if not found or p_request is null or (auth.uid() is not null and auth.uid()<>p_actor) then raise exception 'Active CEO or Farm Manager required.' using errcode='42501'; end if;
 if not exists(select 1 from public.farms where id=farm and org_id=actor.org_id) or
  actor.role::text='farm_manager' and not exists(select 1 from public.user_farm_access a where a.profile_id=p_actor and a.org_id=actor.org_id
   and a.farm_id=farm and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())) then
  raise exception 'Active farm assignment required.' using errcode='42501'; end if;
 if actor.role::text='farm_manager' then
  perform 1 from public.user_farm_access a where a.profile_id=p_actor and a.org_id=actor.org_id and a.farm_id=farm
   and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()) for share;
  if not found then raise exception 'Farm assignment changed. Refresh access.' using errcode='42501'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('scheduler-request:'||p_request::text,0));
 fingerprint:=md5(jsonb_build_array(p_id,p_revision,p_spec)::text);
 select * into replay from public.scheduler_rule_receipts where id=p_request;
 if found then
  if replay.org_id<>actor.org_id or replay.actor_id<>p_actor or replay.payload_hash is distinct from fingerprint then
   raise exception 'Request ID already used with different values.' using errcode='40001'; end if;
  return replay.result;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('scheduler:'||farm::text,0));
 if p_id is not null then
  select * into r from public.scheduled_work_rules where id=p_id and org_id=actor.org_id and farm_id=farm for update;
  if not found then raise exception 'Plan unavailable.' using errcode='P0002'; end if;
  if actor.role::text='farm_manager' and (r.created_by<>p_actor or r.created_by_role<>'farm_manager') then raise exception 'Only the manager plan creator or CEO can edit this plan.' using errcode='42501'; end if;
  if r.revision is distinct from p_revision then raise exception 'Plan changed. Refresh before saving.' using errcode='40001'; end if;
  old:=to_jsonb(r);
 end if;
 select array_agg(value::uuid order by value) into targets from jsonb_array_elements_text(p_spec->'flock_ids');
 if cardinality(targets) not between 1 and 100 or cardinality(targets)<>(select count(distinct x) from unnest(targets) x) then raise exception 'Choose distinct named flocks.' using errcode='23514'; end if;
 perform 1 from public.flocks where id=any(targets) order by id for update;
 if (select count(*) from public.flocks where id=any(targets) and org_id=actor.org_id
  and (coalesce((p_spec->>'active')::boolean,true)=false or farm_id=farm and completed_at is null and status::text in ('active','quarantined')))<>cardinality(targets) then raise exception 'A selected flock is unavailable.' using errcode='42501'; end if;
 if (p_spec->>'start_date')::date<today and p_id is null then raise exception 'New plans cannot manufacture past scheduled work.' using errcode='23514'; end if;
 if p_id is null and p_spec->>'frequency'='once' and (p_spec->>'start_date')::date=today and exists(
  select 1 from public.farm_operating_days where farm_id=farm and operating_date=today and status in ('closed','locked')) then
  raise exception 'This operating day is closed. Choose a future plan date.' using errcode='55000'; end if;
 if p_id is null then
  insert into public.scheduled_work_rules(org_id,farm_id,created_by,created_by_role,kind,title,notes,frequency,start_date,end_date,flock_ids)
  values(actor.org_id,farm,p_actor,actor.role::text,p_spec->>'kind',btrim(p_spec->>'title'),coalesce(p_spec->>'notes',''),p_spec->>'frequency',
   (p_spec->>'start_date')::date,nullif(p_spec->>'end_date','')::date,targets) returning * into r;
 else
  update public.scheduled_work_rules set title=btrim(p_spec->>'title'),kind=p_spec->>'kind',notes=coalesce(p_spec->>'notes',''),
   frequency=p_spec->>'frequency',start_date=(p_spec->>'start_date')::date,end_date=nullif(p_spec->>'end_date','')::date,flock_ids=targets,
   active=coalesce((p_spec->>'active')::boolean,true),revision=revision+1,updated_at=now() where id=r.id returning * into r;
  -- Today's promised work cannot disappear when a rule is edited.
  update public.scheduled_work_occurrences set status='cancelled',reason='Plan revised',revision=revision+1,updated_at=now()
   where rule_id=r.id and status='pending' and due_date>today;
  -- Reuse the same occurrence identity when a revised plan still includes its date.
  update public.scheduled_work_occurrences o set status='pending',reason=null,title=r.title,instructions=r.notes,kind=r.kind,plan_revision=r.revision,revision=o.revision+1,updated_at=now()
   where o.rule_id=r.id and o.status='cancelled' and o.reason='Plan revised' and o.due_date>today and r.active
    and o.flock_id=any(targets) and o.due_date>=r.start_date and o.due_date<=coalesce(r.end_date,today+89)
    and (r.frequency='daily' or r.frequency='once' and o.due_date=r.start_date or r.frequency='weekly' and (o.due_date-r.start_date)%7=0);
 end if;
 perform public.generate_scheduled_work(actor.org_id,farm,today);
 result:=to_jsonb(r);
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,before_values,after_values)
 values(actor.org_id,p_actor,actor.role::text,'scheduler.rule_saved','scheduled_work_rules',r.id::text,'Explicit named-flock plan saved',old,result);
 insert into public.scheduler_rule_receipts(id,org_id,actor_id,payload_hash,result) values(p_request,actor.org_id,p_actor,fingerprint,result);
 return result;
end $$;

create function public.apply_scheduled_work_outcome(p_actor uuid,p_farm uuid,p_flock uuid,p_date date,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.scheduled_work_occurrences; f public.flocks; outcome text:=p_payload->>'outcome'; evidence jsonb; source uuid; before_value jsonb;
 notes text:=nullif(btrim(p_payload->>'notes'),''); outcome_reason text:=nullif(btrim(p_payload->>'reason'),''); later date:=nullif(p_payload->>'deferred_to','')::date;
begin
 perform pg_advisory_xact_lock(hashtextextended('scheduler:'||p_farm::text,0));
 select * into o from public.scheduled_work_occurrences where id=(p_payload->>'occurrence_id')::uuid and farm_id=p_farm and flock_id=p_flock for update;
 if not found then raise exception 'Scheduled work not found.' using errcode='P0002'; end if;
 before_value:=to_jsonb(o);
 perform 1 from public.user_farm_access a join public.profiles p on p.id=a.profile_id
  where a.profile_id=p_actor and a.org_id=o.org_id and p.org_id=o.org_id and p.is_active and p.role::text='farm_manager'
   and a.farm_id=p_farm and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()) for share of a,p;
 if not found then raise exception 'Active farm assignment required.' using errcode='42501'; end if;
 select * into f from public.flocks where id=p_flock and org_id=o.org_id and farm_id=p_farm for update;
 if not found or f.completed_at is not null or f.status::text not in ('active','quarantined') then raise exception 'Flock lifecycle changed. Refresh Today.' using errcode='40001'; end if;
 if o.revision is distinct from (p_payload->>'occurrence_revision')::integer or o.status<>'pending' then raise exception 'Scheduled work changed. Refresh Today.' using errcode='40001'; end if;
 if o.due_date>p_date or p_date<f.placement_date then raise exception 'Scheduled work is not due on this date.' using errcode='23514'; end if;
 if outcome not in ('completed','deferred','skipped') then raise exception 'Choose a scheduled-work outcome.' using errcode='23514'; end if;
 if outcome in ('deferred','skipped') and coalesce(length(outcome_reason),0)<4 then raise exception 'A reason is required to defer or skip work.' using errcode='23514'; end if;
 if outcome='deferred' then
  if later is null or later<=p_date or later>p_date+89 then raise exception 'Choose a later date within the next 90 days.' using errcode='23514'; end if;
  insert into public.scheduled_work_occurrences(org_id,rule_id,farm_id,flock_id,due_date,title,instructions,kind,plan_revision)
   values(o.org_id,o.rule_id,o.farm_id,o.flock_id,later,o.title,o.instructions,o.kind,o.plan_revision);
 elsif outcome='completed' then
  if o.kind='weight' then
   if coalesce((p_payload->>'sample_count')::integer,0)<=0 or coalesce((p_payload->>'average_weight_g')::numeric,0)<=0
    or coalesce((p_payload->>'min_weight_g')::numeric,0)<=0 or coalesce((p_payload->>'max_weight_g')::numeric,0)<(p_payload->>'min_weight_g')::numeric
    or (p_payload->>'average_weight_g')::numeric not between (p_payload->>'min_weight_g')::numeric and (p_payload->>'max_weight_g')::numeric
    or coalesce((p_payload->>'uniformity_pct')::numeric,-1) not between 0 and 100 then raise exception 'Enter valid measured weights and sample size.' using errcode='23514'; end if;
   insert into public.weight_records(org_id,flock_id,record_date,sample_count,average_weight_g,min_weight_g,max_weight_g,uniformity_pct)
    values(o.org_id,p_flock,p_date,(p_payload->>'sample_count')::integer,(p_payload->>'average_weight_g')::numeric,(p_payload->>'min_weight_g')::numeric,
     (p_payload->>'max_weight_g')::numeric,(p_payload->>'uniformity_pct')::numeric) returning id into source;
   o.source_table:='weight_records';
  elsif o.kind='cleaning' then
   if coalesce(length(notes),0)<4 then raise exception 'Record what was cleaned and checked.' using errcode='23514'; end if;
   insert into public.biosecurity_checks(org_id,farm_id,checklist_date,notes,completed_by)
    values(o.org_id,p_farm,p_date,o.title||': '||notes,p_actor) returning id into source;
   o.source_table:='biosecurity_checks';
  elsif o.kind='treatment' then
   if coalesce(length(notes),0)<4 then raise exception 'Record the treatment actually administered.' using errcode='23514'; end if;
   evidence:=public.record_health_event_with_inventory(p_actor,p_flock,p_date,'treatment',jsonb_build_object('description',o.title,'treatment',notes),
    nullif(p_payload->'inventory_usage'->>'item_id','')::uuid,nullif(p_payload->'inventory_usage'->>'warehouse_id','')::uuid,
    nullif(p_payload->'inventory_usage'->>'quantity','')::numeric);
   source:=(evidence->>'event_id')::uuid; o.source_table:='health_events';
  else
   if p_payload->'inventory_usage' is null or p_payload->'inventory_usage'='null'::jsonb then raise exception 'Vaccine item, warehouse and quantity are required.' using errcode='23514'; end if;
   if p_payload->>'vaccination_route' is null then raise exception 'Choose the actual vaccination route.' using errcode='23514'; end if;
   insert into public.vaccination_events(org_id,flock_id,event_date,vaccine_name,route)
    values(o.org_id,p_flock,p_date,o.title,(p_payload->>'vaccination_route')::public.vaccination_route) returning id into source;
   perform public.complete_vaccination_with_inventory(p_actor,source,(p_payload->'inventory_usage'->>'item_id')::uuid,
    (p_payload->'inventory_usage'->>'warehouse_id')::uuid,(p_payload->'inventory_usage'->>'quantity')::numeric,p_date);
   o.source_table:='vaccination_events';
  end if;
 end if;
 update public.scheduled_work_occurrences set status=outcome,reason=outcome_reason,outcome_date=p_date,outcome_by=p_actor,deferred_to=later,
  source_table=o.source_table,source_id=source,revision=revision+1,updated_at=now() where id=o.id;
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,before_values,after_values)
 values(o.org_id,p_actor,'farm_manager','scheduler.outcome_recorded','scheduled_work_occurrences',o.id::text,coalesce(outcome_reason,notes,'Scheduled work completed'),
  before_value,(select to_jsonb(x) from public.scheduled_work_occurrences x where x.id=o.id));
 return jsonb_build_object('occurrence_id',o.id,'status',outcome,'source_table',o.source_table,'source_id',source);
end $$;

-- Inventory only: matching names/dates never constitute a conversion decision.
create function public.scheduler_legacy_preflight(p_org uuid,p_farms uuid[]) returns table(kind text,title text,due_date date,flock_label text,route text,mapping text)
language sql stable security definer set search_path=public as $$
 select 'weight',f.flock_code,t.due_date,f.flock_code,'/app/feeding-log?task_id='||t.id::text,
  case when t.weight_record_id is not null or f.completed_at is not null or f.status::text not in ('active','quarantined') then 'blocked' else 'review_required' end
 from public.batch_weight_check_tasks t join public.flocks f on f.id=t.flock_id and f.org_id=t.org_id
 where t.org_id=p_org and f.farm_id=any(p_farms) and t.status<>'completed'
 union all
 select 'vaccination',v.vaccine_name,v.event_date,f.flock_code,'/app/health?record='||v.id::text,'review_required'
 from public.vaccination_events v join public.flocks f on f.id=v.flock_id and f.org_id=v.org_id
 where v.org_id=p_org and f.farm_id=any(p_farms) and v.voided_at is null and v.event_date>=(now() at time zone 'Africa/Addis_Ababa')::date
  and not exists(select 1 from public.health_events h where h.org_id=p_org and h.voided_at is null and h.description='SCHEDULE_STATUS|'||v.id::text||'|completed|vaccination')
 union all
 select 'cleaning',coalesce(c.notes,'Cleaning'),c.checklist_date,null,'/app/health?record='||c.id::text,'review_required'
 from public.biosecurity_checks c where c.org_id=p_org and c.farm_id=any(p_farms) and c.voided_at is null and c.completed_by is null
  and c.checklist_date>=(now() at time zone 'Africa/Addis_Ababa')::date
$$;
revoke all on function public.scheduler_legacy_preflight(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.scheduler_legacy_preflight(uuid,uuid[]) to service_role;

-- Additive v1 command: retain all existing dispatcher/receipt/chain guards.
do $$ declare definition text; signature text; begin
 foreach signature in array array['public.execute_today_command_v1(uuid,jsonb)','public.dispatch_today_command_v1_pre_stock_count_v1(uuid,jsonb)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  if position('''complete_vaccination''' in definition)=0 then raise exception 'Today command catalogue seam changed.'; end if;
  definition:=replace(definition,'''record_health_event'', ''complete_vaccination''','''record_health_event'', ''complete_vaccination'', ''complete_scheduled_work''');
  if signature='public.execute_today_command_v1(uuid,jsonb)' then
   definition:=replace(definition,'  elsif v_command_type = ''record_health_event'' then',
    '  elsif v_command_type = ''complete_scheduled_work'' then
       v_domain_result:=public.apply_scheduled_work_outcome(p_actor_id,v_farm_id,v_flock_id,v_work_date,v_payload);
       v_source_ref:=''scheduled_work_occurrences/''||(v_payload->>''occurrence_id'');
      elsif v_command_type = ''record_health_event'' then');
  end if;
  execute definition;
 end loop;
 select pg_get_functiondef('public.dispatch_today_command_v1(uuid,jsonb)'::regprocedure) into definition;
 if position('  if v_flock is not null then' in definition)=0 then raise exception 'Today chain seam changed.'; end if;
 definition:=replace(definition,'  if v_flock is not null then',
  '  if v_type in (''complete_scheduled_work'',''finish_operating_day'') then perform pg_advisory_xact_lock(hashtextextended(''scheduler:''||v_farm::text,0)); end if;
    if v_flock is not null then');
 execute definition;
 -- Share the farm lock with generation/edit/outcome before atomic day closure.
 select pg_get_functiondef('public.finish_farm_operating_day_v1(uuid,uuid,integer,jsonb,uuid,date,text)'::regprocedure) into definition;
 definition:=regexp_replace(definition,'begin[\r\n]+', 'begin'||chr(10)||
  ' perform pg_advisory_xact_lock(hashtextextended(''scheduler:''||p_farm_id::text,0));
    if exists(select 1 from public.scheduled_work_occurrences o join public.flocks f on f.id=o.flock_id
      where o.farm_id=p_farm_id and f.farm_id=o.farm_id and o.due_date<=p_operating_date and o.status=''pending'' and f.completed_at is null
      and f.status::text in (''active'',''quarantined'')) then
      raise exception ''Scheduled work is still missing an outcome.'' using errcode=''23514''; end if;
 ','i');
 if position('Scheduled work is still missing an outcome.' in definition)=0 then raise exception 'Finish-day scheduler seam changed.'; end if;
 execute definition;
end $$;
revoke all on function public.generate_scheduled_work(uuid,uuid,date), public.save_scheduled_work_rule(uuid,uuid,uuid,integer,jsonb),
 public.apply_scheduled_work_outcome(uuid,uuid,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.generate_scheduled_work(uuid,uuid,date),public.save_scheduled_work_rule(uuid,uuid,uuid,integer,jsonb) to service_role;

-- Missing from a warning list is never proof of completion.
do $$ declare definition text; begin
 select pg_get_functiondef('public.operational_action_source_state(uuid,uuid)'::regprocedure) into definition;
 if position('declare a public.operational_actions;' in definition)=0 or position('  if a.source_key in (' in definition)=0 then
  raise exception 'Exact action verification seam changed.'; end if;
 definition:=replace(definition,'declare a public.operational_actions;','declare v_work public.scheduled_work_occurrences; a public.operational_actions;');
 definition:=replace(definition,'  if a.source_key in (', $scheduler_checker$  if a.source_key ~ '^scheduled-work-[0-9a-f-]{36}$' then
    select * into v_work from public.scheduled_work_occurrences where id=substring(a.source_key from 16)::uuid
      and org_id=p_org_id and farm_id=a.farm_id for share;
    if not found then return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    select * into f from public.flocks where id=v_work.flock_id and org_id=p_org_id for share;
    if not found then return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    if f.completed_at is not null or f.status::text not in ('active','quarantined') or f.farm_id<>v_work.farm_id then
      return jsonb_build_object('state','clear','reason','FLOCK_LIFECYCLE_CHANGED'); end if;
    if v_work.status='pending' then
      return jsonb_build_object('state',case when v_work.due_date<=v_today then 'active' else 'clear' end,'reason','SCHEDULE_DUE'); end if;
    if v_work.status='skipped' and length(btrim(v_work.reason))>=4 and v_work.outcome_by is not null and v_work.outcome_date is not null then
      return jsonb_build_object('state','clear','reason','SCHEDULE_SKIPPED_WITH_REASON'); end if;
    if v_work.status='deferred' and length(btrim(v_work.reason))>=4 and v_work.outcome_by is not null and v_work.deferred_to>v_work.outcome_date
      and exists(select 1 from public.scheduled_work_occurrences x where x.org_id=p_org_id and x.rule_id=v_work.rule_id
        and x.flock_id=v_work.flock_id and x.farm_id=v_work.farm_id and x.due_date=v_work.deferred_to) then
      return jsonb_build_object('state','clear','reason','SCHEDULE_DEFERRED_WITH_EVIDENCE'); end if;
    if v_work.status='cancelled' and v_work.reason='Plan revised' and exists(select 1 from public.scheduled_work_rules r
      where r.id=v_work.rule_id and r.org_id=p_org_id and r.revision>v_work.plan_revision) then
      return jsonb_build_object('state','clear','reason','SCHEDULE_REVISED'); end if;
    if v_work.status='completed' and v_work.outcome_by is not null and (
      (v_work.kind='weight' and v_work.source_table='weight_records' and exists(select 1 from public.weight_records x
       where x.id=v_work.source_id and x.org_id=p_org_id and x.flock_id=v_work.flock_id and x.record_date=v_work.outcome_date))
      or (v_work.kind='cleaning' and v_work.source_table='biosecurity_checks' and exists(select 1 from public.biosecurity_checks x
       where x.id=v_work.source_id and x.org_id=p_org_id and x.farm_id=v_work.farm_id and x.checklist_date=v_work.outcome_date and x.completed_by is not null and x.voided_at is null))
      or (v_work.kind='treatment' and v_work.source_table='health_events' and exists(select 1 from public.health_events x
       where x.id=v_work.source_id and x.org_id=p_org_id and x.flock_id=v_work.flock_id and x.event_date=v_work.outcome_date and x.voided_at is null))
      or (v_work.kind='vaccination' and v_work.source_table='vaccination_events' and exists(select 1 from public.vaccination_events x
       where x.id=v_work.source_id and x.org_id=p_org_id and x.flock_id=v_work.flock_id and x.event_date=v_work.outcome_date and x.voided_at is null))
    ) then return jsonb_build_object('state','clear','reason','SCHEDULE_AUTHORITATIVE_RECORD'); end if;
    return jsonb_build_object('state','unavailable','reason','SCHEDULE_EVIDENCE_MISSING');
  elsif a.source_key in ($scheduler_checker$);
 execute definition;
end $$;
notify pgrst, 'reload schema';
