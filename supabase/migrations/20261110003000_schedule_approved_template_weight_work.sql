alter table public.scheduled_work_rules add column feed_template_row_id uuid references public.batch_feed_template_rows(id);
alter table public.scheduled_work_rules add constraint template_weight_rule_shape check(feed_template_row_id is null or (kind='weight' and frequency='once' and cardinality(flock_ids)=1));
create unique index template_weight_rule_once on public.scheduled_work_rules(feed_template_row_id,flock_ids) where feed_template_row_id is not null;

create function public.create_template_weight_rules(p_actor uuid,p_template uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare template public.batch_feed_templates; batch public.batches; actor public.profiles; today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
 count_created integer; total integer:=0; scope record;
begin
 if coalesce(current_setting('app.governance_apply',true),'false')<>'true' then raise exception 'Apply an approved feed-template request.' using errcode='42501'; end if;
 select * into template from public.batch_feed_templates where id=p_template and is_active;
 select * into actor from public.profiles where id=p_actor and is_active;
 if template.id is null or actor.id is null or template.org_id<>actor.org_id or actor.role::text not in ('ceo','farm_manager') then raise exception 'Template authority unavailable.' using errcode='42501'; end if;
 select * into batch from public.batches where id=template.batch_id and org_id=template.org_id for share;
 if not found or exists(select 1 from public.flocks where org_id=template.org_id and batch_id=batch.id and completed_at is null and farm_id<>batch.farm_id) then
  raise exception 'Review ambiguous batch/farm membership before applying a template.' using errcode='55000'; end if;
 perform pg_advisory_xact_lock(hashtextextended('scheduler:'||batch.farm_id::text,0));
 -- Preserve today's promised work, as ordinary Scheduler revisions already do.
 update public.scheduled_work_occurrences o set status='cancelled',reason='Plan revised',revision=o.revision+1,updated_at=now()
 from public.scheduled_work_rules r join public.batch_feed_template_rows row on row.id=r.feed_template_row_id
 join public.batch_feed_templates old_template on old_template.id=row.template_id
 where o.rule_id=r.id and old_template.batch_id=batch.id and old_template.org_id=template.org_id and old_template.id<>p_template
  and o.status='pending' and o.due_date>today;
 update public.scheduled_work_rules r set active=false,revision=r.revision+1,updated_at=now()
 from public.batch_feed_template_rows row join public.batch_feed_templates old_template on old_template.id=row.template_id
 where r.feed_template_row_id=row.id and old_template.batch_id=batch.id and old_template.org_id=template.org_id and old_template.id<>p_template and r.active;
 if not exists(select 1 from public.organizations where id=template.org_id and today_workspace_enabled) then return 0; end if;
 insert into public.scheduled_work_rules(org_id,farm_id,created_by,created_by_role,kind,title,notes,frequency,start_date,end_date,flock_ids,feed_template_row_id)
 select template.org_id,f.farm_id,p_actor,actor.role::text,'weight',left(template.name,140)||' · '||row.week_number::text,template.name,'once',
  f.placement_date+row.age_day_start-f.age_at_placement_days,f.placement_date+row.age_day_start-f.age_at_placement_days,array[f.id],row.id
 from public.flocks f join public.batch_feed_template_rows row on row.template_id=p_template and row.week_number%2=0
 where f.org_id=template.org_id and f.batch_id=batch.id and f.completed_at is null and f.status::text in ('active','quarantined')
  and f.placement_date+row.age_day_start-f.age_at_placement_days>=today
  and not (f.placement_date+row.age_day_start-f.age_at_placement_days=today and exists(
   select 1 from public.scheduled_work_occurrences promised join public.scheduled_work_rules old_rule on old_rule.id=promised.rule_id
   where promised.org_id=template.org_id and promised.flock_id=f.id and promised.due_date=today and promised.status<>'cancelled' and old_rule.feed_template_row_id is not null))
 on conflict(feed_template_row_id,flock_ids) where feed_template_row_id is not null do nothing;
 get diagnostics count_created=row_count; total:=total+count_created;
 for scope in select distinct f.farm_id from public.flocks f where f.org_id=template.org_id and f.batch_id=batch.id loop
  perform public.generate_scheduled_work(template.org_id,scope.farm_id,today);
 end loop;
 return total;
end $$;
revoke all on function public.create_template_weight_rules(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_template_weight_rules(uuid,uuid) to service_role;

do $$ declare definition text; first integer; last integer; begin
 select pg_get_functiondef('public.save_feed_template(uuid,uuid,text,text,jsonb)'::regprocedure) into definition;
 first:=position('  insert into public.batch_weight_check_tasks(' in definition);
 last:=position('  insert into public.feeding_schedules(' in definition);
 if first=0 or last<=first then raise exception 'Template work generation seam changed.'; end if;
 execute substring(definition from 1 for first-1)||'  v_tasks:=public.create_template_weight_rules(p_actor_id,v_template_id);
  if not exists(select 1 from public.organizations where id=v_org_id and today_workspace_enabled) then
 '||substring(definition from first for last-first)||'  end if;
 '||substring(definition from last);
 select pg_get_functiondef('public.save_scheduled_work_rule(uuid,uuid,uuid,integer,jsonb)'::regprocedure) into definition;
 if position('  old:=to_jsonb(r);' in definition)=0 then raise exception 'Scheduler edit seam changed.'; end if;
 execute replace(definition,'  old:=to_jsonb(r);','  if r.feed_template_row_id is not null then raise exception ''Change this work through an approved feed-template request.'' using errcode=''42501''; end if;
  old:=to_jsonb(r);');
end $$;
notify pgrst,'reload schema';
