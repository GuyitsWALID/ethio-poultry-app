-- Complete Feed Control: session-first capture, transactional daily close,
-- idempotent inventory posting, explicit milestone execution and configurable variance thresholds.

alter table public.feeding_session_records
  add column if not exists feed_item_id uuid references public.inventory_items(id) on delete set null,
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null,
  add column if not exists feed_type public.feed_type,
  add column if not exists status text not null default 'planned',
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid references public.profiles(id) on delete set null;

update public.feeding_session_records
set status = 'completed', completed_at = coalesce(completed_at, updated_at), completed_by = coalesce(completed_by, recorded_by)
where actual_feed_kg is not null and status = 'planned';

alter table public.feeding_session_records
  drop constraint if exists feeding_session_records_status_check;
alter table public.feeding_session_records
  add constraint feeding_session_records_status_check check (status in ('planned','completed','missed'));

alter table public.batch_feed_templates
  drop constraint if exists batch_feed_templates_source_type_check;
alter table public.batch_feed_templates
  add constraint batch_feed_templates_source_type_check
  check (source_type in ('default','breed_standard','manual','upload'));

create index if not exists idx_feeding_sessions_day
  on public.feeding_session_records(org_id, batch_id, flock_id, record_date, status);

alter table public.stock_ledger
  add column if not exists source_kind text,
  add column if not exists source_key text;

create unique index if not exists stock_ledger_generated_source_uidx
  on public.stock_ledger(org_id, source_kind, source_key, item_id, warehouse_id)
  where source_kind is not null and source_key is not null;

create table if not exists public.feed_day_closures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  flock_id uuid not null references public.flocks(id) on delete cascade,
  record_date date not null,
  status text not null default 'closed' check (status in ('closed','reopened')),
  planned_feed_kg numeric(12,2) not null default 0 check (planned_feed_kg >= 0),
  actual_feed_kg numeric(12,2) not null check (actual_feed_kg >= 0),
  variance_kg numeric(12,2) not null default 0,
  override_reason text,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  reopen_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, flock_id, record_date)
);

create index if not exists idx_feed_day_closures_batch_date
  on public.feed_day_closures(org_id, batch_id, record_date desc);

create table if not exists public.feed_control_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  warning_variance_pct numeric(6,2) not null default 5 check (warning_variance_pct > 0),
  critical_variance_pct numeric(6,2) not null default 10 check (critical_variance_pct > warning_variance_pct),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_milestone_executions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  milestone_id uuid not null references public.batch_feed_template_milestones(id) on delete cascade,
  flock_id uuid references public.flocks(id) on delete cascade,
  status text not null default 'completed' check (status in ('completed','skipped')),
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  unique (milestone_id, flock_id)
);

alter table public.feed_day_closures enable row level security;
alter table public.feed_control_settings enable row level security;
alter table public.feed_milestone_executions enable row level security;

drop policy if exists "feed_day_closures_org_select" on public.feed_day_closures;
create policy "feed_day_closures_org_select" on public.feed_day_closures for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.org_id=feed_day_closures.org_id)
);
drop policy if exists "feed_day_closures_ops_write" on public.feed_day_closures;
create policy "feed_day_closures_ops_write" on public.feed_day_closures for all to authenticated using (
  exists (select 1 from public.profiles p join public.flocks f on f.id=feed_day_closures.flock_id
    where p.id=auth.uid() and p.org_id=feed_day_closures.org_id and
      (p.role in ('ceo','system_admin','super_admin') or
       (p.role='farm_manager' and (exists(select 1 from public.user_farm_access a where a.profile_id=p.id and a.farm_id=f.farm_id)
         or exists(select 1 from public.farms fa join public.user_branch_access a on a.branch_id=fa.branch_id where fa.id=f.farm_id and a.profile_id=p.id)))))
) with check (
  exists (select 1 from public.profiles p join public.flocks f on f.id=feed_day_closures.flock_id
    where p.id=auth.uid() and p.org_id=feed_day_closures.org_id and
      (p.role in ('ceo','system_admin','super_admin') or
       (p.role='farm_manager' and (exists(select 1 from public.user_farm_access a where a.profile_id=p.id and a.farm_id=f.farm_id)
         or exists(select 1 from public.farms fa join public.user_branch_access a on a.branch_id=fa.branch_id where fa.id=f.farm_id and a.profile_id=p.id)))))
);
drop policy if exists "feed_control_settings_org_select" on public.feed_control_settings;
create policy "feed_control_settings_org_select" on public.feed_control_settings for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.org_id=feed_control_settings.org_id)
);
drop policy if exists "feed_control_settings_admin_write" on public.feed_control_settings;
create policy "feed_control_settings_admin_write" on public.feed_control_settings for all to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.org_id=feed_control_settings.org_id and p.role in ('ceo','system_admin','super_admin'))
) with check (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.org_id=feed_control_settings.org_id and p.role in ('ceo','system_admin','super_admin'))
);
drop policy if exists "feed_milestone_executions_org_select" on public.feed_milestone_executions;
create policy "feed_milestone_executions_org_select" on public.feed_milestone_executions for select to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.org_id=feed_milestone_executions.org_id)
);
drop policy if exists "feed_milestone_executions_ops_write" on public.feed_milestone_executions;
create policy "feed_milestone_executions_ops_write" on public.feed_milestone_executions for all to authenticated using (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.org_id=feed_milestone_executions.org_id and p.role in ('farm_manager','ceo','system_admin','super_admin'))
) with check (
  exists (select 1 from public.profiles p where p.id=auth.uid() and p.org_id=feed_milestone_executions.org_id and p.role in ('farm_manager','ceo','system_admin','super_admin'))
);

create or replace function public.close_feed_day(
  p_actor_id uuid,
  p_flock_id uuid,
  p_record_date date,
  p_override_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org_id uuid; v_role text; v_batch_id uuid; v_farm_id uuid; v_house_id uuid; v_branch_id uuid;
  v_actual numeric; v_planned numeric; v_incomplete integer; v_daily_id uuid; v_feed_type public.feed_type;
  v_group record; v_available numeric; v_source_key text; v_closure_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'Actor does not match the authenticated user.' using errcode='42501';
  end if;
  select p.org_id,p.role::text into v_org_id,v_role from public.profiles p where p.id=p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','ceo','system_admin','super_admin') then
    raise exception 'User cannot close a feeding day.' using errcode='42501';
  end if;
  select f.batch_id,f.farm_id,f.house_id,fa.branch_id into v_batch_id,v_farm_id,v_house_id,v_branch_id
  from public.flocks f join public.farms fa on fa.id=f.farm_id where f.id=p_flock_id and f.org_id=v_org_id;
  if v_batch_id is null then raise exception 'Flock is not linked to a batch.' using errcode='22023'; end if;
  if v_role='farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id=p_actor_id and a.farm_id=v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id=p_actor_id and a.branch_id=v_branch_id)) then
    raise exception 'User does not have access to this flock.' using errcode='42501';
  end if;
  select count(*) filter(where status<>'completed' or actual_feed_kg is null),coalesce(sum(actual_feed_kg),0),coalesce(sum(planned_feed_kg),0)
  into v_incomplete,v_actual,v_planned
  from public.feeding_session_records where org_id=v_org_id and flock_id=p_flock_id and record_date=p_record_date;
  select s.feed_type into v_feed_type from public.feeding_session_records s
    where s.org_id=v_org_id and s.flock_id=p_flock_id and s.record_date=p_record_date and s.feed_type is not null
    order by s.session_time desc nulls last limit 1;
  if not exists(select 1 from public.feeding_session_records where org_id=v_org_id and flock_id=p_flock_id and record_date=p_record_date) then
    raise exception 'Add at least one feeding session before closing the day.' using errcode='22023';
  end if;
  if v_incomplete>0 then raise exception 'Complete or mark every feeding session before closing the day.' using errcode='22023'; end if;

  for v_group in select feed_item_id,warehouse_id,sum(actual_feed_kg) quantity
    from public.feeding_session_records where org_id=v_org_id and flock_id=p_flock_id and record_date=p_record_date and actual_feed_kg>0
    group by feed_item_id,warehouse_id
  loop
    if v_group.feed_item_id is null or v_group.warehouse_id is null then
      raise exception 'Every completed session needs a feed item and warehouse.' using errcode='22023';
    end if;
    if not exists(select 1 from public.inventory_items i where i.id=v_group.feed_item_id and i.org_id=v_org_id and i.category='feed' and lower(i.unit) in ('kg','kilogram','kilograms')) then
      raise exception 'Feed inventory must be recorded in kilograms before the feeding day can close.' using errcode='22023';
    end if;
    if not exists(select 1 from public.warehouses w where w.id=v_group.warehouse_id and w.org_id=v_org_id and w.branch_id=v_branch_id) then
      raise exception 'Feed warehouse is outside the flock branch.' using errcode='42501';
    end if;
    select coalesce(sum(public.stock_movement_delta(sl.transaction_type,sl.quantity)),0) into v_available
      from public.stock_ledger sl where sl.org_id=v_org_id and sl.item_id=v_group.feed_item_id and sl.warehouse_id=v_group.warehouse_id
        and not (sl.source_kind='feed_day_close' and sl.source_key=p_flock_id::text||':'||p_record_date::text);
    if v_available<v_group.quantity and nullif(btrim(p_override_reason),'') is null then
      raise exception 'Insufficient feed stock. Record a receipt or provide an authorized override reason.' using errcode='22023';
    end if;
  end loop;

  insert into public.daily_farm_records(org_id,flock_id,record_date,feed_intake_grams,feed_intake_quantity,feed_type,recorded_by,synced)
  values(v_org_id,p_flock_id,p_record_date,round(v_actual*1000),v_actual,v_feed_type,p_actor_id,true)
  on conflict(org_id,flock_id,record_date) do update set feed_intake_grams=excluded.feed_intake_grams,
    feed_intake_quantity=excluded.feed_intake_quantity,feed_type=coalesce(excluded.feed_type,public.daily_farm_records.feed_type),
    recorded_by=excluded.recorded_by,synced=true,updated_at=now()
  returning id into v_daily_id;

  insert into public.feed_day_closures(org_id,batch_id,flock_id,record_date,status,planned_feed_kg,actual_feed_kg,variance_kg,override_reason,closed_by,closed_at,reopened_by,reopened_at,reopen_reason)
  values(v_org_id,v_batch_id,p_flock_id,p_record_date,'closed',v_planned,v_actual,v_actual-v_planned,nullif(btrim(p_override_reason),''),p_actor_id,now(),null,null,null)
  on conflict(org_id,flock_id,record_date) do update set status='closed',planned_feed_kg=excluded.planned_feed_kg,
    actual_feed_kg=excluded.actual_feed_kg,variance_kg=excluded.variance_kg,override_reason=excluded.override_reason,
    closed_by=excluded.closed_by,closed_at=excluded.closed_at,reopened_by=null,reopened_at=null,reopen_reason=null,updated_at=now()
  returning id into v_closure_id;

  v_source_key:=p_flock_id::text||':'||p_record_date::text;
  delete from public.stock_ledger where org_id=v_org_id and source_kind='feed_day_close' and source_key=v_source_key;
  insert into public.stock_ledger(org_id,item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,daily_record_id,recorded_by,reference_doc,notes,source_kind,source_key)
  select v_org_id,s.feed_item_id,s.warehouse_id,sum(s.actual_feed_kg),'issue',coalesce(i.unit_cost,0),p_record_date,
    v_branch_id,v_farm_id,v_house_id,p_flock_id,v_batch_id,v_daily_id,p_actor_id,'FEED_CLOSE:'||v_source_key,
    'Feed Control daily close','feed_day_close',v_source_key
  from public.feeding_session_records s join public.inventory_items i on i.id=s.feed_item_id
  where s.org_id=v_org_id and s.flock_id=p_flock_id and s.record_date=p_record_date and s.actual_feed_kg>0
  group by s.feed_item_id,s.warehouse_id,i.unit_cost;
  return jsonb_build_object('closure_id',v_closure_id,'daily_record_id',v_daily_id,'actual_feed_kg',v_actual,'planned_feed_kg',v_planned,'variance_kg',v_actual-v_planned);
end;
$$;

create or replace function public.reopen_feed_day(p_actor_id uuid,p_flock_id uuid,p_record_date date,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org_id uuid; v_role text; v_farm_id uuid; v_branch_id uuid; v_source_key text:=p_flock_id::text||':'||p_record_date::text;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then raise exception 'Actor does not match the authenticated user.' using errcode='42501'; end if;
  select p.org_id,p.role::text into v_org_id,v_role from public.profiles p where p.id=p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','ceo','system_admin','super_admin') then raise exception 'User cannot reopen a feeding day.' using errcode='42501'; end if;
  select f.farm_id,fa.branch_id into v_farm_id,v_branch_id from public.flocks f join public.farms fa on fa.id=f.farm_id
    where f.id=p_flock_id and f.org_id=v_org_id;
  if not found then raise exception 'Flock is not available in this organization.' using errcode='22023'; end if;
  if v_role='farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id=p_actor_id and a.farm_id=v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id=p_actor_id and a.branch_id=v_branch_id)) then
    raise exception 'User does not have access to this flock.' using errcode='42501';
  end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'A reopen reason is required.' using errcode='22023'; end if;
  update public.feed_day_closures set status='reopened',reopened_by=p_actor_id,reopened_at=now(),reopen_reason=btrim(p_reason),updated_at=now()
    where org_id=v_org_id and flock_id=p_flock_id and record_date=p_record_date;
  if not found then raise exception 'Closed feeding day was not found.' using errcode='22023'; end if;
  delete from public.stock_ledger where org_id=v_org_id and source_kind='feed_day_close' and source_key=v_source_key;
  return jsonb_build_object('status','reopened');
end;
$$;

grant execute on function public.close_feed_day(uuid,uuid,date,text) to authenticated;
grant execute on function public.reopen_feed_day(uuid,uuid,date,text) to authenticated;

create or replace function public.save_feed_template(
  p_actor_id uuid,
  p_batch_id uuid,
  p_name text,
  p_source_type text,
  p_rows jsonb
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org_id uuid; v_role text; v_farm_id uuid; v_branch_id uuid; v_placement date; v_age integer;
  v_template_id uuid; v_rows integer; v_tasks integer; v_schedules integer;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then raise exception 'Actor does not match the authenticated user.' using errcode='42501'; end if;
  select p.org_id,p.role::text into v_org_id,v_role from public.profiles p where p.id=p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','ceo','system_admin','super_admin') then raise exception 'User cannot manage feed templates.' using errcode='42501'; end if;
  select b.farm_id,b.branch_id,b.placement_date,coalesce(b.age_at_placement_days,0) into v_farm_id,v_branch_id,v_placement,v_age
    from public.batches b where b.id=p_batch_id and b.org_id=v_org_id;
  if not found then raise exception 'Batch is not available in this organization.' using errcode='22023'; end if;
  if v_role='farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id=p_actor_id and a.farm_id=v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id=p_actor_id and a.branch_id=v_branch_id)) then
    raise exception 'User does not have access to this batch.' using errcode='42501';
  end if;
  if p_source_type not in ('breed_standard','manual','upload') then raise exception 'Unsupported template source.' using errcode='22023'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'Add at least one template row.' using errcode='22023'; end if;

  if exists(select 1 from jsonb_to_recordset(p_rows) x(week_number int,age_day_start int,age_day_end int,feed_intake_std_g_per_head numeric,feed_intake_recommended_g_per_head numeric,target_weight_min_g numeric,target_weight_max_g numeric,feed_type_plan text,light_on_time text,light_off_time text)
    where week_number<0 or age_day_start<0 or age_day_end<age_day_start or coalesce(feed_intake_recommended_g_per_head,-1)<0
      or target_weight_min_g is null or target_weight_max_g is null or target_weight_min_g<0 or target_weight_max_g<target_weight_min_g or nullif(btrim(feed_type_plan),'') is null) then
    raise exception 'Template rows need valid ages, non-negative feed, an ordered weight band, and a feed plan.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_rows) x(week_number int) group by week_number having count(*)>1) then
    raise exception 'Template weeks must be unique.' using errcode='22023';
  end if;
  if exists(
    with r as (select ordinality n,x.* from jsonb_to_recordset(p_rows) with ordinality x(week_number int,age_day_start int,age_day_end int,feed_intake_std_g_per_head numeric,feed_intake_recommended_g_per_head numeric,target_weight_min_g numeric,target_weight_max_g numeric,feed_type_plan text,light_on_time text,light_off_time text,ordinality bigint))
    select 1 from r a join r b on a.n<b.n and a.age_day_start<=b.age_day_end and b.age_day_start<=a.age_day_end
  ) then raise exception 'Template age ranges cannot overlap.' using errcode='22023'; end if;

  update public.batch_feed_templates set is_active=false,updated_at=now() where org_id=v_org_id and batch_id=p_batch_id and is_active;
  insert into public.batch_feed_templates(org_id,batch_id,name,source_type,is_active,created_by)
    values(v_org_id,p_batch_id,coalesce(nullif(btrim(p_name),''),'Batch feed template'),p_source_type,true,p_actor_id) returning id into v_template_id;
  insert into public.batch_feed_template_rows(template_id,week_number,age_day_start,age_day_end,feed_intake_std_g_per_head,feed_intake_recommended_g_per_head,target_weight_min_g,target_weight_max_g,feed_type_plan,light_on_time,light_off_time,row_order)
  select v_template_id,x.week_number,x.age_day_start,x.age_day_end,x.feed_intake_std_g_per_head,x.feed_intake_recommended_g_per_head,x.target_weight_min_g,x.target_weight_max_g,btrim(x.feed_type_plan),nullif(x.light_on_time,'')::time,nullif(x.light_off_time,'')::time,(x.ordinality-1)::int
  from jsonb_to_recordset(p_rows) with ordinality x(week_number int,age_day_start int,age_day_end int,feed_intake_std_g_per_head numeric,feed_intake_recommended_g_per_head numeric,target_weight_min_g numeric,target_weight_max_g numeric,feed_type_plan text,light_on_time text,light_off_time text,ordinality bigint);
  get diagnostics v_rows=row_count;

  insert into public.batch_feed_template_milestones(template_id,week_number,trigger_day,title,category,notes,is_required)
  select id,week_number,age_day_start,'Switch feed plan to '||feed_type_plan,'feed',
    case when light_on_time is not null and light_off_time is not null then 'Lighting '||to_char(light_on_time,'HH24:MI')||'–'||to_char(light_off_time,'HH24:MI') end,true
  from (select r.*,lag(feed_type_plan) over(order by row_order) prior_feed from public.batch_feed_template_rows r where template_id=v_template_id) q
  where prior_feed is null or prior_feed is distinct from feed_type_plan;

  insert into public.batch_weight_check_tasks(org_id,batch_id,flock_id,template_row_id,due_week_number,due_date,status,weight_record_id,created_by)
  select v_org_id,p_batch_id,f.id,r.id,r.week_number,(v_placement+(r.week_number*7-v_age))::date,
    case when w.id is not null then 'completed' else 'scheduled' end,w.id,p_actor_id
  from public.flocks f join public.batch_feed_template_rows r on r.template_id=v_template_id and r.week_number%2=0
  left join lateral (select wr.id from public.weight_records wr where wr.org_id=v_org_id and wr.flock_id=f.id
    and floor(((wr.record_date-v_placement)+v_age)/7.0)=r.week_number order by wr.record_date desc limit 1) w on true
  where f.org_id=v_org_id and f.batch_id=p_batch_id and ((v_placement+(r.week_number*7-v_age))::date>=timezone('Africa/Addis_Ababa',now())::date or w.id is not null)
  on conflict(org_id,batch_id,flock_id,due_week_number) do update set template_row_id=excluded.template_row_id,due_date=excluded.due_date,
    status=case when excluded.weight_record_id is not null then 'completed' else public.batch_weight_check_tasks.status end,
    weight_record_id=coalesce(excluded.weight_record_id,public.batch_weight_check_tasks.weight_record_id),updated_at=now();
  get diagnostics v_tasks=row_count;

  insert into public.feeding_schedules(org_id,batch_id,schedule_date,feed_type,planned_feed_kg,target_grams_per_bird,notes,created_by)
  select v_org_id,p_batch_id,d::date,r.feed_type_plan,round((sum(f.current_count)*r.feed_intake_recommended_g_per_head/1000.0)::numeric,2),r.feed_intake_recommended_g_per_head,'Generated from active batch feed template',p_actor_id
  from generate_series(timezone('Africa/Addis_Ababa',now())::date,timezone('Africa/Addis_Ababa',now())::date+89,'1 day') d
  join public.batch_feed_template_rows r on r.template_id=v_template_id and ((d::date-v_placement)+v_age) between r.age_day_start and r.age_day_end
  join public.flocks f on f.org_id=v_org_id and f.batch_id=p_batch_id and f.status='active'
  group by d,r.feed_type_plan,r.feed_intake_recommended_g_per_head
  on conflict(org_id,batch_id,schedule_date) do update set feed_type=excluded.feed_type,planned_feed_kg=excluded.planned_feed_kg,target_grams_per_bird=excluded.target_grams_per_bird,notes=excluded.notes,updated_at=now();
  get diagnostics v_schedules=row_count;
  return jsonb_build_object('template_id',v_template_id,'rows',v_rows,'tasks',v_tasks,'schedules',v_schedules);
end;
$$;

create or replace function public.record_feed_weight(
  p_actor_id uuid,p_task_id uuid,p_record_date date,p_sample_count integer,p_average_weight_g numeric,
  p_min_weight_g numeric,p_max_weight_g numeric,p_uniformity_pct numeric
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org_id uuid; v_role text; v_flock_id uuid; v_farm_id uuid; v_branch_id uuid; v_weight_id uuid; v_existing uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then raise exception 'Actor does not match the authenticated user.' using errcode='42501'; end if;
  select p.org_id,p.role::text into v_org_id,v_role from public.profiles p where p.id=p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','veterinarian','ceo','system_admin','super_admin') then raise exception 'User cannot record flock weights.' using errcode='42501'; end if;
  if p_sample_count<=0 or p_average_weight_g<=0 or p_min_weight_g<=0 or p_max_weight_g<p_min_weight_g or p_uniformity_pct<0 or p_uniformity_pct>100 then
    raise exception 'Enter a valid sample count, weight range, average, and uniformity.' using errcode='22023';
  end if;
  select t.flock_id,t.weight_record_id into v_flock_id,v_existing from public.batch_weight_check_tasks t where t.id=p_task_id and t.org_id=v_org_id;
  if not found then raise exception 'Weight task was not found.' using errcode='22023'; end if;
  select f.farm_id,fa.branch_id into v_farm_id,v_branch_id from public.flocks f join public.farms fa on fa.id=f.farm_id where f.id=v_flock_id and f.org_id=v_org_id;
  if not found then raise exception 'Flock is not available in this organization.' using errcode='22023'; end if;
  if v_role='farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id=p_actor_id and a.farm_id=v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id=p_actor_id and a.branch_id=v_branch_id)) then
    raise exception 'User does not have access to this flock.' using errcode='42501';
  end if;
  if v_existing is null then
    insert into public.weight_records(org_id,flock_id,record_date,sample_count,average_weight_g,min_weight_g,max_weight_g,uniformity_pct)
      values(v_org_id,v_flock_id,p_record_date,p_sample_count,p_average_weight_g,p_min_weight_g,p_max_weight_g,p_uniformity_pct) returning id into v_weight_id;
  else
    update public.weight_records set record_date=p_record_date,sample_count=p_sample_count,average_weight_g=p_average_weight_g,min_weight_g=p_min_weight_g,max_weight_g=p_max_weight_g,uniformity_pct=p_uniformity_pct,updated_at=now()
      where id=v_existing and org_id=v_org_id returning id into v_weight_id;
  end if;
  update public.batch_weight_check_tasks set status='completed',weight_record_id=v_weight_id,updated_at=now() where id=p_task_id;
  return jsonb_build_object('weight_record_id',v_weight_id,'task_id',p_task_id,'status','completed');
end;
$$;

create or replace function public.record_feed_milestone(
  p_actor_id uuid,p_milestone_id uuid,p_flock_id uuid,p_status text,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org_id uuid; v_role text; v_batch_id uuid; v_farm_id uuid; v_branch_id uuid; v_execution_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then raise exception 'Actor does not match the authenticated user.' using errcode='42501'; end if;
  select p.org_id,p.role::text into v_org_id,v_role from public.profiles p where p.id=p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','ceo','system_admin','super_admin') then raise exception 'User cannot complete feed milestones.' using errcode='42501'; end if;
  if p_status not in ('completed','skipped') then raise exception 'Milestone status must be completed or skipped.' using errcode='22023'; end if;
  select t.batch_id into v_batch_id from public.batch_feed_template_milestones m join public.batch_feed_templates t on t.id=m.template_id
    where m.id=p_milestone_id and t.org_id=v_org_id and t.is_active;
  if not found then raise exception 'Active feed milestone was not found.' using errcode='22023'; end if;
  select f.farm_id,fa.branch_id into v_farm_id,v_branch_id from public.flocks f join public.farms fa on fa.id=f.farm_id
    where f.id=p_flock_id and f.org_id=v_org_id and f.batch_id=v_batch_id;
  if not found then raise exception 'Flock is not part of the milestone batch.' using errcode='22023'; end if;
  if v_role='farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id=p_actor_id and a.farm_id=v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id=p_actor_id and a.branch_id=v_branch_id)) then raise exception 'User does not have access to this flock.' using errcode='42501'; end if;
  insert into public.feed_milestone_executions(org_id,milestone_id,flock_id,status,completed_by,completed_at,notes)
  values(v_org_id,p_milestone_id,p_flock_id,p_status,p_actor_id,now(),nullif(btrim(p_notes),''))
  on conflict(milestone_id,flock_id) do update set status=excluded.status,completed_by=excluded.completed_by,completed_at=excluded.completed_at,notes=excluded.notes
  returning id into v_execution_id;
  return jsonb_build_object('execution_id',v_execution_id,'status',p_status);
end;
$$;

grant execute on function public.save_feed_template(uuid,uuid,text,text,jsonb) to authenticated;
grant execute on function public.record_feed_weight(uuid,uuid,date,integer,numeric,numeric,numeric,numeric) to authenticated;
grant execute on function public.record_feed_milestone(uuid,uuid,uuid,text,text) to authenticated;
