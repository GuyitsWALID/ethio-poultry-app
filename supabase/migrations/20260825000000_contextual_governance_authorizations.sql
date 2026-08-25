-- Contextual governance: approval authorizes one exact, time-limited application.

alter table public.governance_requests drop constraint if exists governance_requests_status_check;
alter table public.governance_requests add constraint governance_requests_status_check
  check (status in ('pending','returned','approved','rejected','cancelled','conflict','expired','applied'));

alter table public.governance_requests
  add column if not exists intent text,
  add column if not exists context_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists correction_route text,
  add column if not exists finding_id uuid references public.reconciliation_findings(id) on delete set null,
  add column if not exists requester_name_snapshot text,
  add column if not exists requester_role_snapshot text,
  add column if not exists requester_scope_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists latest_submitted_at timestamptz,
  add column if not exists returned_at timestamptz,
  add column if not exists approval_expires_at timestamptz,
  add column if not exists applied_by uuid references public.profiles(id) on delete restrict,
  add column if not exists idempotency_key text;

update public.governance_requests r set
  requester_name_snapshot=coalesce(r.requester_name_snapshot,p.full_name,'Former user'),
  requester_role_snapshot=coalesce(r.requester_role_snapshot,p.role::text,'unknown'),
  latest_submitted_at=coalesce(r.latest_submitted_at,r.requested_at),
  intent=coalesce(r.intent,r.request_type)
from public.profiles p where p.id=r.requested_by;

update public.governance_requests set
  requester_name_snapshot=coalesce(requester_name_snapshot,'Former user'),
  requester_role_snapshot=coalesce(requester_role_snapshot,'unknown'),
  latest_submitted_at=coalesce(latest_submitted_at,requested_at),
  intent=coalesce(intent,request_type);

alter table public.governance_requests
  alter column requester_name_snapshot set not null,
  alter column requester_role_snapshot set not null,
  alter column latest_submitted_at set not null,
  alter column intent set not null;

create unique index if not exists governance_requests_requester_idempotency
  on public.governance_requests(org_id,requested_by,idempotency_key) where idempotency_key is not null;
with ranked as(
  select id,row_number() over(partition by org_id,source_table,source_id,intent order by latest_submitted_at desc,id desc) as position
  from public.governance_requests where source_id is not null and status in ('pending','returned','approved')
)
update public.governance_requests r set status='conflict',conflict_reason='A newer active request superseded this pre-existing duplicate.',updated_at=now()
from ranked where ranked.id=r.id and ranked.position>1;
create unique index if not exists governance_requests_one_actionable_source_intent
  on public.governance_requests(org_id,source_table,source_id,intent)
  where source_id is not null and status in ('pending','returned','approved');

create table if not exists public.governance_request_activity(
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.governance_requests(id) on delete cascade,
  action text not null check(action in ('submitted','returned','resubmitted','approved','rejected','applied','conflict','expired')),
  actor_id uuid references public.profiles(id) on delete restrict,
  actor_name_snapshot text not null,
  actor_role_snapshot text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists governance_request_activity_request_time on public.governance_request_activity(request_id,created_at);

create table if not exists public.governance_request_evidence(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.governance_requests(id) on delete cascade,
  storage_path text,
  reference_label text,
  reference_url text,
  file_name text,
  content_type text,
  byte_size bigint,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  check(storage_path is not null or reference_url is not null)
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('governance-evidence','governance-evidence',false,8388608,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.prevent_governance_supporting_evidence_change() returns trigger
language plpgsql as $$ begin raise exception 'Governance history and evidence are append-only.' using errcode='42501'; end $$;
drop trigger if exists governance_request_activity_append_only on public.governance_request_activity;
create trigger governance_request_activity_append_only before update or delete on public.governance_request_activity for each row execute function public.prevent_governance_supporting_evidence_change();
drop trigger if exists governance_request_evidence_append_only on public.governance_request_evidence;
create trigger governance_request_evidence_append_only before update or delete on public.governance_request_evidence for each row execute function public.prevent_governance_supporting_evidence_change();

create or replace function public.limit_governance_request_evidence() returns trigger language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.request_id::text,0));
  if (select count(*) from public.governance_request_evidence where request_id=new.request_id)>=5 then
    raise exception 'A governance request can contain at most five evidence files or references.' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists governance_request_evidence_limit on public.governance_request_evidence;
create trigger governance_request_evidence_limit before insert on public.governance_request_evidence for each row execute function public.limit_governance_request_evidence();

alter table public.governance_request_activity enable row level security;
alter table public.governance_request_evidence enable row level security;
drop policy if exists governance_request_activity_read on public.governance_request_activity;
create policy governance_request_activity_read on public.governance_request_activity for select using(
  exists(select 1 from public.governance_requests r where r.id=request_id and r.org_id=public.current_org_id()
    and (public.current_active_role()='ceo' or public.has_active_break_glass(r.org_id) or r.requested_by=auth.uid()
      or (r.farm_id is not null and public.has_active_farm_access(r.farm_id))
      or (r.warehouse_id is not null and public.has_active_warehouse_access(r.warehouse_id))))
);
drop policy if exists governance_request_evidence_read on public.governance_request_evidence;
create policy governance_request_evidence_read on public.governance_request_evidence for select using(
  exists(select 1 from public.governance_requests r where r.id=request_id and r.org_id=public.current_org_id()
    and (public.current_active_role()='ceo' or public.has_active_break_glass(r.org_id) or r.requested_by=auth.uid()
      or (r.farm_id is not null and public.has_active_farm_access(r.farm_id))
      or (r.warehouse_id is not null and public.has_active_warehouse_access(r.warehouse_id))))
);
revoke insert,update,delete on public.governance_request_activity from anon,authenticated;
revoke insert,update,delete on public.governance_request_evidence from anon,authenticated;

create or replace function public.governance_source_version(p_table text,p_id uuid,p_org_id uuid) returns timestamptz
language plpgsql security definer set search_path=public as $$
declare v_value timestamptz;
begin
  if p_table not in ('flocks','batches','feed_control_settings','daily_farm_records','daily_sales_records','health_events','vaccination_events','feeding_session_records','biosecurity_checks','batch_weight_check_tasks') then
    raise exception 'Unsupported versioned source table.' using errcode='22023';
  end if;
  execute format('select updated_at from public.%I where id=$1 and org_id=$2',p_table) into v_value using p_id,p_org_id;
  return v_value;
end $$;

create or replace function public.decide_governance_request(p_request_id uuid,p_decision text,p_note text) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare v_row public.governance_requests; v_version timestamptz; v_name text; v_role text;
begin
  v_role:=public.current_active_role();
  if v_role<>'ceo' then raise exception 'Only the organization CEO can decide governance requests.' using errcode='42501'; end if;
  if p_decision not in ('approved','returned','rejected') or length(trim(coalesce(p_note,'')))<4 then raise exception 'A valid decision and decision note are required.' using errcode='22023'; end if;
  select * into v_row from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
  if v_row.status<>'pending' then raise exception 'This request is no longer awaiting a decision.' using errcode='40001'; end if;
  if p_decision='approved' and v_row.source_id is not null and v_row.source_version is not null then
    v_version:=public.governance_source_version(v_row.source_table,v_row.source_id,v_row.org_id);
    if v_version is null or v_version<>v_row.source_version then
      update public.governance_requests set status='conflict',conflict_reason='The source record changed after this request was submitted.',decided_by=auth.uid(),decided_at=now(),decision_note=trim(p_note),updated_at=now() where id=v_row.id returning * into v_row;
      select coalesce(full_name,'CEO') into v_name from public.profiles where id=auth.uid();
      insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note) values(v_row.org_id,v_row.id,'conflict',auth.uid(),v_name,v_role,v_row.conflict_reason);
      return v_row;
    end if;
  end if;
  update public.governance_requests set
    status=p_decision, decided_by=auth.uid(), decided_at=now(), decision_note=trim(p_note),
    returned_at=case when p_decision='returned' then now() else null end,
    approval_expires_at=case when p_decision='approved' then now()+interval '7 days' else null end,
    updated_at=now()
  where id=v_row.id returning * into v_row;
  select coalesce(full_name,'CEO') into v_name from public.profiles where id=auth.uid();
  insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note) values(v_row.org_id,v_row.id,p_decision,auth.uid(),v_name,v_role,trim(p_note));
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values) values(v_row.org_id,auth.uid(),v_role,'governance_request.'||p_decision,'governance_requests',v_row.id::text,trim(p_note),to_jsonb(v_row));
  return v_row;
end $$;

create or replace function public.resubmit_governance_request(p_request_id uuid,p_reason text,p_proposed_values jsonb,p_changed_fields text[]) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare v_row public.governance_requests; v_name text; v_version timestamptz;
begin
  select * into v_row from public.governance_requests where id=p_request_id and org_id=public.current_org_id() and requested_by=auth.uid() for update;
  if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
  if v_row.status<>'returned' then raise exception 'Only a returned request can be resubmitted.' using errcode='40001'; end if;
  if length(trim(coalesce(p_reason,'')))<8 or coalesce(array_length(p_changed_fields,1),0)=0 then raise exception 'Reason and changed fields are required.' using errcode='22023'; end if;
  if v_row.source_id is not null and v_row.source_table is not null then v_version:=public.governance_source_version(v_row.source_table,v_row.source_id,v_row.org_id); end if;
  update public.governance_requests set status='pending',reason=trim(p_reason),proposed_values=p_proposed_values,changed_fields=p_changed_fields,source_version=coalesce(v_version,source_version),latest_submitted_at=now(),decided_by=null,decided_at=null,decision_note=null,returned_at=null,updated_at=now() where id=v_row.id returning * into v_row;
  select coalesce(full_name,'Farm Manager') into v_name from public.profiles where id=auth.uid();
  insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note) values(v_row.org_id,v_row.id,'resubmitted',auth.uid(),v_name,'farm_manager',trim(p_reason));
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
  values(v_row.org_id,auth.uid(),'farm_manager','governance_request.resubmitted','governance_requests',v_row.id::text,trim(p_reason),to_jsonb(v_row));
  return v_row;
end $$;

create or replace function public.apply_governance_request(p_request_id uuid) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare v_row public.governance_requests; v_role text; v_version timestamptz; v_name text; v_new_id uuid; v_daily public.daily_farm_records;
begin
  v_role:=public.current_active_role();
  if v_role<>'farm_manager' then raise exception 'Only an assigned Farm Manager can apply an approved change.' using errcode='42501'; end if;
  select * into v_row from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
  if v_row.status<>'approved' then raise exception 'This authorization is no longer available.' using errcode='40001'; end if;
  if v_row.approval_expires_at<=now() then
    update public.governance_requests set status='expired',updated_at=now() where id=v_row.id returning * into v_row;
    select coalesce(full_name,'Farm Manager') into v_name from public.profiles where id=auth.uid();
    insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note) values(v_row.org_id,v_row.id,'expired',auth.uid(),v_name,v_role,'The seven-day authorization expired before application.');
    return v_row;
  end if;
  if v_row.farm_id is not null and not public.has_active_farm_access(v_row.farm_id) then raise exception 'An active assignment to the affected farm is required.' using errcode='42501'; end if;
  if v_row.warehouse_id is not null and not public.has_active_warehouse_access(v_row.warehouse_id) then raise exception 'An active assignment to the affected warehouse is required.' using errcode='42501'; end if;
  if v_row.source_id is not null and v_row.source_version is not null then
    v_version:=public.governance_source_version(v_row.source_table,v_row.source_id,v_row.org_id);
    if v_version is null or v_version<>v_row.source_version then
      update public.governance_requests set status='conflict',conflict_reason='The source record changed after CEO approval.',updated_at=now() where id=v_row.id returning * into v_row;
      select coalesce(full_name,'Farm Manager') into v_name from public.profiles where id=auth.uid();
      insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note) values(v_row.org_id,v_row.id,'conflict',auth.uid(),v_name,v_role,v_row.conflict_reason);
      insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values) values(v_row.org_id,auth.uid(),v_role,'governance_request.conflict','governance_requests',v_row.id::text,v_row.conflict_reason,to_jsonb(v_row));
      return v_row;
    end if;
  end if;
  perform set_config('app.governance_apply','true',true);
  if v_row.request_type='flock_place' then
    if not exists(select 1 from public.houses where id=(v_row.proposed_values->>'house_id')::uuid and farm_id=(v_row.proposed_values->>'farm_id')::uuid and org_id=v_row.org_id) then raise exception 'Approved placement is invalid.' using errcode='23514'; end if;
    insert into public.flocks(org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,age_at_placement_days,initial_count,current_count,breed_id,purchase_cost_per_bird,notes,status)
    values(v_row.org_id,(v_row.proposed_values->>'farm_id')::uuid,(v_row.proposed_values->>'house_id')::uuid,nullif(v_row.proposed_values->>'batch_id','')::uuid,v_row.proposed_values->>'flock_code',(v_row.proposed_values->>'flock_type')::public.flock_type,(v_row.proposed_values->>'source')::public.flock_source,(v_row.proposed_values->>'placement_date')::date,coalesce((v_row.proposed_values->>'age_at_placement_days')::integer,0),(v_row.proposed_values->>'initial_count')::integer,(v_row.proposed_values->>'initial_count')::integer,nullif(v_row.proposed_values->>'breed_id','')::uuid,nullif(v_row.proposed_values->>'purchase_cost_per_bird','')::numeric,nullif(v_row.proposed_values->>'notes',''),'active') returning id into v_new_id;
    v_row.source_table:='flocks';v_row.source_id:=v_new_id;
  elsif v_row.request_type='batch_create' then
    if not exists(select 1 from public.houses h join public.farms f on f.id=h.farm_id join public.branches b on b.id=f.branch_id where h.id=(v_row.proposed_values->>'house_id')::uuid and f.id=(v_row.proposed_values->>'farm_id')::uuid and b.id=(v_row.proposed_values->>'branch_id')::uuid and f.org_id=v_row.org_id and h.org_id=v_row.org_id and b.org_id=v_row.org_id) then raise exception 'Approved batch location is invalid.' using errcode='23514'; end if;
    insert into public.batches(org_id,branch_id,farm_id,house_id,batch_code,source,supplier_name,purchase_date,placement_date,age_at_placement_days,male_count,female_count,total_count,purchase_cost_per_bird,transport_cost,other_cost,notes,status)
    values(v_row.org_id,(v_row.proposed_values->>'branch_id')::uuid,(v_row.proposed_values->>'farm_id')::uuid,(v_row.proposed_values->>'house_id')::uuid,v_row.proposed_values->>'batch_code',(v_row.proposed_values->>'source')::public.flock_source,nullif(v_row.proposed_values->>'supplier_name',''),nullif(v_row.proposed_values->>'purchase_date','')::date,(v_row.proposed_values->>'placement_date')::date,coalesce((v_row.proposed_values->>'age_at_placement_days')::integer,0),coalesce((v_row.proposed_values->>'male_count')::integer,0),coalesce((v_row.proposed_values->>'female_count')::integer,0),(v_row.proposed_values->>'total_count')::integer,nullif(v_row.proposed_values->>'purchase_cost_per_bird','')::numeric,coalesce((v_row.proposed_values->>'transport_cost')::numeric,0),coalesce((v_row.proposed_values->>'other_cost')::numeric,0),nullif(v_row.proposed_values->>'notes',''),'active') returning id into v_new_id;
    v_row.source_table:='batches';v_row.source_id:=v_new_id;
  elsif v_row.request_type='flock_transfer' then
    if not exists(select 1 from public.houses where id=(v_row.proposed_values->>'house_id')::uuid and farm_id=(v_row.proposed_values->>'farm_id')::uuid and org_id=v_row.org_id) then raise exception 'Approved destination is invalid.' using errcode='23514'; end if;
    update public.flocks set farm_id=(v_row.proposed_values->>'farm_id')::uuid,house_id=(v_row.proposed_values->>'house_id')::uuid,updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
  elsif v_row.request_type in ('flock_close','flock_archive') then
    update public.flocks set status=coalesce(v_row.proposed_values->>'status','archived')::public.flock_status,updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
  elsif v_row.request_type='batch_archive' then
    update public.batches set status='archived',updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
    update public.flocks set status='archived',updated_at=now() where batch_id=v_row.source_id and org_id=v_row.org_id and status='active';
  elsif v_row.request_type='locked_correction' and v_row.source_table='batches' and v_row.changed_fields <@ array['batch_code']::text[] then
    update public.batches set batch_code=v_row.proposed_values->>'batch_code',updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
  elsif v_row.request_type='locked_correction' and v_row.source_table='daily_farm_records' and v_row.source_id is null then
    if v_row.changed_fields && array['feed_intake_grams','feed_intake_quantity','feed_type']::text[] then raise exception 'Feed fields remain controlled by Feed Control.' using errcode='42501'; end if;
    if not exists(select 1 from public.flocks where id=(v_row.proposed_values->>'flock_id')::uuid and farm_id=v_row.farm_id and org_id=v_row.org_id) then raise exception 'Approved flock scope is invalid.' using errcode='23514'; end if;
    select * into v_daily from jsonb_populate_record(null::public.daily_farm_records,v_row.proposed_values);
    insert into public.daily_farm_records(org_id,flock_id,record_date,normal_eggs,broken_eggs,dirty_eggs,average_egg_weight_g,deaths,deaths_cause,opening_birds,closing_birds,culls,transfers_in,transfers_out,other_removals,water_consumed_liters,feed_leftover_grams,vaccination_status,medication_vitamins,recorded_by)
    values(v_row.org_id,v_daily.flock_id,v_daily.record_date,v_daily.normal_eggs,v_daily.broken_eggs,v_daily.dirty_eggs,v_daily.average_egg_weight_g,coalesce(v_daily.deaths,0),v_daily.deaths_cause,v_daily.opening_birds,v_daily.closing_birds,coalesce(v_daily.culls,0),coalesce(v_daily.transfers_in,0),coalesce(v_daily.transfers_out,0),coalesce(v_daily.other_removals,0),v_daily.water_consumed_liters,v_daily.feed_leftover_grams,v_daily.vaccination_status,v_daily.medication_vitamins,auth.uid()) returning id into v_new_id;
    v_row.source_id:=v_new_id;
  elsif v_row.request_type='locked_correction' and v_row.source_table='daily_farm_records' then
    if v_row.changed_fields && array['feed_intake_grams','feed_intake_quantity','feed_type']::text[] then raise exception 'Feed fields remain controlled by Feed Control.' using errcode='42501'; end if;
    select * into v_daily from jsonb_populate_record(null::public.daily_farm_records,v_row.proposed_values);
    update public.daily_farm_records set normal_eggs=case when 'normal_eggs'=any(v_row.changed_fields) then v_daily.normal_eggs else normal_eggs end,broken_eggs=case when 'broken_eggs'=any(v_row.changed_fields) then v_daily.broken_eggs else broken_eggs end,dirty_eggs=case when 'dirty_eggs'=any(v_row.changed_fields) then v_daily.dirty_eggs else dirty_eggs end,deaths=case when 'deaths'=any(v_row.changed_fields) then v_daily.deaths else deaths end,deaths_cause=case when 'deaths_cause'=any(v_row.changed_fields) then v_daily.deaths_cause else deaths_cause end,opening_birds=case when 'opening_birds'=any(v_row.changed_fields) then v_daily.opening_birds else opening_birds end,closing_birds=case when 'closing_birds'=any(v_row.changed_fields) then v_daily.closing_birds else closing_birds end,culls=case when 'culls'=any(v_row.changed_fields) then v_daily.culls else culls end,transfers_in=case when 'transfers_in'=any(v_row.changed_fields) then v_daily.transfers_in else transfers_in end,transfers_out=case when 'transfers_out'=any(v_row.changed_fields) then v_daily.transfers_out else transfers_out end,other_removals=case when 'other_removals'=any(v_row.changed_fields) then v_daily.other_removals else other_removals end,water_consumed_liters=case when 'water_consumed_liters'=any(v_row.changed_fields) then v_daily.water_consumed_liters else water_consumed_liters end,feed_leftover_grams=case when 'feed_leftover_grams'=any(v_row.changed_fields) then v_daily.feed_leftover_grams else feed_leftover_grams end,vaccination_status=case when 'vaccination_status'=any(v_row.changed_fields) then v_daily.vaccination_status else vaccination_status end,medication_vitamins=case when 'medication_vitamins'=any(v_row.changed_fields) then v_daily.medication_vitamins else medication_vitamins end,updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
  elsif v_row.request_type='warning_threshold' then
    insert into public.feed_control_settings(org_id,warning_variance_pct,critical_variance_pct,updated_at) values(v_row.org_id,(v_row.proposed_values->>'warning_variance_pct')::numeric,(v_row.proposed_values->>'critical_variance_pct')::numeric,now()) on conflict(org_id) do update set warning_variance_pct=excluded.warning_variance_pct,critical_variance_pct=excluded.critical_variance_pct,updated_at=now();
  elsif v_row.request_type='feed_template' then
    perform public.save_feed_template(auth.uid(),(v_row.proposed_values->>'batch_id')::uuid,coalesce(v_row.proposed_values->>'name','Batch feed template'),coalesce(v_row.proposed_values->>'source_type','manual'),coalesce(v_row.proposed_values->'rows','[]'::jsonb));
  elsif v_row.request_type='breed_target' then
    if jsonb_typeof(v_row.proposed_values->'rows')<>'array' then raise exception 'Breed target rows are required.' using errcode='22023'; end if;
    delete from public.breed_standards where org_id=v_row.org_id and breed_id=(v_row.proposed_values->>'breed_id')::uuid;
    insert into public.breed_standards(org_id,breed_id,week_number,target_hdep_pct,target_mortality_pct,target_feed_g,target_weight_g,updated_at)
    select v_row.org_id,(v_row.proposed_values->>'breed_id')::uuid,x.week_number,x.target_hdep_pct,x.target_mortality_pct,x.target_feed_g,x.target_weight_g,now() from jsonb_to_recordset(v_row.proposed_values->'rows') as x(week_number integer,target_hdep_pct numeric,target_mortality_pct numeric,target_feed_g numeric,target_weight_g numeric);
  elsif v_row.request_type='health_schedule' then
    if not exists(select 1 from public.flocks where id=(v_row.proposed_values->>'flock_id')::uuid and org_id=v_row.org_id) then raise exception 'Approved flock is invalid.' using errcode='23514'; end if;
    insert into public.health_events(org_id,flock_id,event_date,event_type,description,diagnosis,treatment,attachment_url,vet_id,external_veterinarian_name,veterinarian_recommendation,veterinarian_reference,veterinarian_attachment,recommendation_status)
    values(v_row.org_id,(v_row.proposed_values->>'flock_id')::uuid,(v_row.proposed_values->>'event_date')::date,coalesce(v_row.proposed_values->>'event_type','observation')::public.health_event_type,nullif(v_row.proposed_values->>'description',''),nullif(v_row.proposed_values->>'diagnosis',''),nullif(v_row.proposed_values->>'treatment',''),nullif(v_row.proposed_values->>'attachment_url',''),auth.uid(),nullif(v_row.proposed_values->>'external_veterinarian_name',''),nullif(v_row.proposed_values->>'veterinarian_recommendation',''),nullif(v_row.proposed_values->>'veterinarian_reference',''),v_row.proposed_values->'veterinarian_attachment',nullif(v_row.proposed_values->>'recommendation_status','')) returning id into v_new_id;
    v_row.source_table:='health_events';v_row.source_id:=v_new_id;
  elsif v_row.request_type='void_record' then
    if v_row.source_table not in ('daily_farm_records','feeding_session_records','daily_sales_records','health_events','vaccination_events','biosecurity_checks','batch_weight_check_tasks') then raise exception 'Unsupported void target.' using errcode='22023'; end if;
    execute format('update public.%I set voided_at=now(),voided_by=$1,void_reason=$2 where id=$3 and org_id=$4 and voided_at is null',v_row.source_table) using auth.uid(),v_row.reason,v_row.source_id,v_row.org_id;
  else
    raise exception 'This request type needs a registered one-time application adapter.' using errcode='0A000';
  end if;
  update public.governance_requests set status='applied',source_table=coalesce(v_row.source_table,source_table),source_id=coalesce(v_row.source_id,source_id),applied_at=now(),applied_by=auth.uid(),updated_at=now() where id=v_row.id returning * into v_row;
  select coalesce(full_name,'Farm Manager') into v_name from public.profiles where id=auth.uid();
  insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note) values(v_row.org_id,v_row.id,'applied',auth.uid(),v_name,v_role,'Applied the exact CEO-authorized change.');
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values) values(v_row.org_id,auth.uid(),v_role,'governance_request.applied','governance_requests',v_row.id::text,'Applied the exact CEO-authorized change.',to_jsonb(v_row));
  return v_row;
end $$;

create or replace function public.expire_governance_authorizations() returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer; v_item record;
begin
  v_count:=0;
  for v_item in
    update public.governance_requests set status='expired',updated_at=now()
    where status='approved' and approval_expires_at<=now()
    returning id,org_id
  loop
    insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note)
    values(v_item.org_id,v_item.id,'expired',null,'System','system','The seven-day authorization expired before application.');
    insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason)
    values(v_item.org_id,null,'system','governance_request.expired','governance_requests',v_item.id::text,'The seven-day authorization expired before application.');
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

grant execute on function public.decide_governance_request(uuid,text,text) to authenticated;
grant execute on function public.resubmit_governance_request(uuid,text,jsonb,text[]) to authenticated;
grant execute on function public.apply_governance_request(uuid) to authenticated;
revoke all on function public.expire_governance_authorizations() from public,anon,authenticated;
grant execute on function public.expire_governance_authorizations() to service_role;

comment on function public.apply_governance_request(uuid) is 'Applies one exact, unexpired CEO authorization once and attributes the acting Farm Manager.';
