-- PostgreSQL requires a record-returning function's column definition list
-- to be inside ROWS FROM when WITH ORDINALITY is also requested.
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
    with r as (
      select x.ordinality n,x.*
      from rows from (
        jsonb_to_recordset(p_rows) as (
          week_number int,age_day_start int,age_day_end int,feed_intake_std_g_per_head numeric,
          feed_intake_recommended_g_per_head numeric,target_weight_min_g numeric,target_weight_max_g numeric,
          feed_type_plan text,light_on_time text,light_off_time text
        )
      ) with ordinality as x(
        week_number,age_day_start,age_day_end,feed_intake_std_g_per_head,
        feed_intake_recommended_g_per_head,target_weight_min_g,target_weight_max_g,
        feed_type_plan,light_on_time,light_off_time,ordinality
      )
    )
    select 1 from r a join r b on a.n<b.n and a.age_day_start<=b.age_day_end and b.age_day_start<=a.age_day_end
  ) then raise exception 'Template age ranges cannot overlap.' using errcode='22023'; end if;

  update public.batch_feed_templates set is_active=false,updated_at=now() where org_id=v_org_id and batch_id=p_batch_id and is_active;
  insert into public.batch_feed_templates(org_id,batch_id,name,source_type,is_active,created_by)
    values(v_org_id,p_batch_id,coalesce(nullif(btrim(p_name),''),'Batch feed template'),p_source_type,true,p_actor_id) returning id into v_template_id;
  insert into public.batch_feed_template_rows(template_id,week_number,age_day_start,age_day_end,feed_intake_std_g_per_head,feed_intake_recommended_g_per_head,target_weight_min_g,target_weight_max_g,feed_type_plan,light_on_time,light_off_time,row_order)
  select v_template_id,x.week_number,x.age_day_start,x.age_day_end,x.feed_intake_std_g_per_head,x.feed_intake_recommended_g_per_head,x.target_weight_min_g,x.target_weight_max_g,btrim(x.feed_type_plan),nullif(x.light_on_time,'')::time,nullif(x.light_off_time,'')::time,(x.ordinality-1)::int
  from rows from (
    jsonb_to_recordset(p_rows) as (
      week_number int,age_day_start int,age_day_end int,feed_intake_std_g_per_head numeric,
      feed_intake_recommended_g_per_head numeric,target_weight_min_g numeric,target_weight_max_g numeric,
      feed_type_plan text,light_on_time text,light_off_time text
    )
  ) with ordinality as x(
    week_number,age_day_start,age_day_end,feed_intake_std_g_per_head,
    feed_intake_recommended_g_per_head,target_weight_min_g,target_weight_max_g,
    feed_type_plan,light_on_time,light_off_time,ordinality
  );
  get diagnostics v_rows=row_count;

  insert into public.batch_feed_template_milestones(template_id,week_number,trigger_day,title,category,notes,is_required)
  select v_template_id,week_number,age_day_start,'Switch feed plan to '||feed_type_plan,'feed',
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

revoke all on function public.save_feed_template(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.save_feed_template(uuid,uuid,text,text,jsonb) to authenticated,service_role;
