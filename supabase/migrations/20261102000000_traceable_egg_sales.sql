-- Existing sales remain legacy evidence. No inferred flock allocation/backfill.
alter table public.daily_sales_records
 add column egg_source_version integer not null default 0,
 add column egg_sources jsonb not null default '[]',
 add column egg_conversion_multiplier numeric,
 add column sale_request_id uuid,
 add column sale_request_hash text;
create unique index sale_request_once on public.daily_sales_records(org_id,recorded_by,sale_request_id) where sale_request_id is not null;
create index sale_egg_source_lookup on public.daily_sales_records using gin(egg_sources jsonb_path_ops);
create policy allocated_egg_sale_read on public.daily_sales_records as restrictive for select to authenticated using (
 egg_source_version=0 or (org_id=public.current_org_id() and (public.current_active_role()='ceo'
  or (public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id)))));
create policy allocated_egg_sale_select on public.daily_sales_records for select to authenticated using (
 egg_source_version>0 and org_id=public.current_org_id() and (public.current_active_role()='ceo'
  or (public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id))));
create table public.egg_sale_sources (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id),
 sale_id uuid not null references public.daily_sales_records(id),
 revision integer not null check(revision>0),
 farm_id uuid not null references public.farms(id),
 flock_id uuid not null references public.flocks(id),
 house_id uuid not null references public.houses(id),
 batch_id uuid references public.batches(id),
 egg_quantity numeric not null check(egg_quantity>0 and egg_quantity=trunc(egg_quantity)),
 conversion_multiplier numeric not null check(conversion_multiplier>0),
 request_id uuid references public.governance_requests(id),
 recorded_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(sale_id,revision,flock_id)
);
create index egg_sale_sources_custody on public.egg_sale_sources(org_id,flock_id,sale_id);
alter table public.egg_sale_sources enable row level security;
revoke all on public.egg_sale_sources from public,anon,authenticated;
grant select on public.egg_sale_sources to authenticated;
grant all on public.egg_sale_sources to service_role;
create policy egg_sale_source_read on public.egg_sale_sources for select to authenticated using(
 org_id=public.current_org_id() and (public.current_active_role()='ceo' or (public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id))));
create trigger egg_sale_source_append_only before update or delete on public.egg_sale_sources
 for each row execute function public.reject_business_hard_delete();

create function public.guard_egg_sale_sources() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' and new.product_category='egg' and coalesce(current_setting('app.egg_sale_write',true),'')<>'true' then
  raise exception 'Egg sales require explicit flock sources. Refresh and resubmit this sale.' using errcode='23514'; end if;
 if tg_op='UPDATE' and (old.product_category='egg' or new.product_category='egg') and
  (to_jsonb(new)-array['paid_amount','balance_due','payment_method','customer_name','customer_phone','notes','updated_at','voided_at','voided_by','void_reason'])
  is distinct from (to_jsonb(old)-array['paid_amount','balance_due','payment_method','customer_name','customer_phone','notes','updated_at','voided_at','voided_by','void_reason'])
  and coalesce(current_setting('app.egg_sale_write',true),'')<>'true' then
  raise exception 'Correct this exact egg sale through CEO-reviewed source allocation.' using errcode='23514'; end if;
 if tg_op='UPDATE' and old.product_category<>'egg' and new.product_category='egg'
  and coalesce(current_setting('app.egg_sale_write',true),'')<>'true' then
  raise exception 'Egg sale reclassification requires reviewed flock sources.' using errcode='23514'; end if;
 return new;
end $$;
create trigger guard_egg_sale_sources before insert or update on public.daily_sales_records for each row execute function public.guard_egg_sale_sources();

-- Validate and freeze the conversion and readable source identity once, never
-- reinterpret an allocated sale after a conversion/configuration edit.
create function public.egg_sale_source_evidence(p_org uuid,p_farm uuid,p_date date,p_quantity numeric,p_unit text,p_sources jsonb,p_multiplier numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare multiplier numeric; total numeric:=0; result jsonb:='[]'; item jsonb; f public.flocks; q numeric;
begin
 if jsonb_typeof(p_sources) is distinct from 'array' or jsonb_array_length(p_sources) not between 1 and 100 then
  raise exception 'Choose one or more source flocks and their egg quantities.' using errcode='23514'; end if;
 multiplier:=p_multiplier;
 if multiplier is null then
  if (select count(*) from public.sales_unit_conversions where org_id=p_org and product_category='egg' and lower(unit)=lower(btrim(p_unit)))<>1 then
   raise exception 'Choose an unambiguous governed egg unit.' using errcode='23514'; end if;
  select c.multiplier into multiplier from public.sales_unit_conversions c
   where c.org_id=p_org and c.product_category='egg' and lower(c.unit)=lower(btrim(p_unit));
 end if;
 if multiplier is null or multiplier<=0 or multiplier::text in ('NaN','Infinity','-Infinity')
  or p_quantity is null or p_quantity not between 0.01 and 9999999999.99 or p_quantity<>round(p_quantity,2)
  or p_quantity*multiplier<>trunc(p_quantity*multiplier) then
  raise exception 'Choose a governed egg unit producing an exact whole-egg quantity.' using errcode='23514'; end if;
 if (select count(distinct s->>'flock_id') from jsonb_array_elements(p_sources) s)<>jsonb_array_length(p_sources) then
  raise exception 'Choose each source flock only once.' using errcode='23514'; end if;
 for item in select value from jsonb_array_elements(p_sources) order by value->>'flock_id' loop
  select * into f from public.flocks where id=(item->>'flock_id')::uuid and org_id=p_org and farm_id=p_farm for update;
  if not found or f.flock_type::text not in ('layer','parent_stock') or f.placement_date>p_date then
   raise exception 'Every source must be an egg-producing flock in this farm on the sale date.' using errcode='23514'; end if;
  q:=(item->>'egg_quantity')::numeric;
  if q is null or q not between 1 and 9007199254740991 or q<>trunc(q) then raise exception 'Enter positive whole eggs for each source.' using errcode='23514'; end if;
  total:=total+q;
  result:=result||jsonb_build_array(jsonb_build_object('flock_id',f.id,'flock',f.flock_code,'house_id',f.house_id,
   'batch_id',f.batch_id,'egg_quantity',q,'multiplier',multiplier));
 end loop;
 if total<>p_quantity*multiplier then raise exception 'Source eggs must exactly equal the converted sale quantity.' using errcode='23514'; end if;
 return result;
end $$;

create function public.check_egg_sale_custody(p_org uuid,p_flock uuid,p_date date default null) returns void
language plpgsql security definer set search_path=public as $$
declare opening public.egg_custody_opening_balances; placement date; start_date date; end_date date; deficit numeric;
begin
 select placement_date into placement from public.flocks where id=p_flock and org_id=p_org for update;
 select * into opening from public.egg_custody_opening_balances where org_id=p_org and flock_id=p_flock and effective_date<=coalesce(p_date,'infinity'::date) order by effective_date desc limit 1;
 select min(effective_date) into end_date from public.egg_custody_opening_balances where org_id=p_org and flock_id=p_flock and effective_date>coalesce(p_date,'infinity'::date);
 start_date:=coalesce(opening.effective_date,placement);
 if exists(select 1 from public.daily_sales_records s where s.org_id=p_org and s.voided_at is null and s.product_category='egg'
  and s.egg_source_version=0 and s.flock_id=p_flock and s.sale_date>=start_date and (end_date is null or s.sale_date<end_date)
  and not exists(select 1 from public.sales_unit_conversions c where c.org_id=p_org and c.product_category='egg' and lower(c.unit)=lower(s.unit))) then
  raise exception 'Resolve the legacy sale unit before allocating more eggs.' using errcode='23514'; end if;
 with movements as (
  select start_date d,coalesce(opening.quantity,0)::numeric q
  union all select record_date,normal_eggs from public.daily_farm_records where org_id=p_org and flock_id=p_flock and voided_at is null and record_date>=start_date and (end_date is null or record_date<end_date) and normal_eggs is not null
  union all select s.sale_date,-a.egg_quantity from public.egg_sale_sources a join public.daily_sales_records s on s.id=a.sale_id and s.egg_source_version=a.revision
   where s.org_id=p_org and s.voided_at is null and a.flock_id=p_flock and s.sale_date>=start_date and (end_date is null or s.sale_date<end_date)
  union all select s.sale_date,-s.quantity*c.multiplier from public.daily_sales_records s join public.sales_unit_conversions c on c.org_id=s.org_id and c.product_category='egg' and lower(c.unit)=lower(s.unit)
   where s.org_id=p_org and s.voided_at is null and s.product_category='egg' and s.egg_source_version=0 and s.flock_id=p_flock and s.sale_date>=start_date and (end_date is null or s.sale_date<end_date)
 ), days as(select d,sum(q) q from movements group by d), balances as(select sum(q) over(order by d) balance from days)
 select min(balance) into deficit from balances;
 if deficit<0 then raise exception 'Insufficient traceable eggs. Check production, opening stock and existing sales.' using errcode='23514'; end if;
end $$;

create function public.write_egg_sale_sources(p_sale uuid,p_actor uuid,p_sources jsonb,p_multiplier numeric default null,p_request uuid default null)
returns public.daily_sales_records language plpgsql security definer set search_path=public as $$
declare s public.daily_sales_records; evidence jsonb; source jsonb; prior text; rev integer; source_flock uuid;
begin
 select * into s from public.daily_sales_records where id=p_sale and product_category='egg' and voided_at is null for update;
 if not found then raise exception 'Egg sale unavailable.' using errcode='P0002'; end if;
 -- A farm lock serializes allocation/correction across partially overlapping source sets.
 perform pg_advisory_xact_lock(hashtextextended('egg-custody:'||s.farm_id::text,0));
 -- Lock departed sources too, before changing the organization's reporting revision.
 perform 1 from public.flocks where org_id=s.org_id and (id=s.flock_id or id in
  (select flock_id from public.egg_sale_sources where sale_id=s.id)) order by id for update;
 evidence:=public.egg_sale_source_evidence(s.org_id,s.farm_id,s.sale_date,s.quantity,s.unit,p_sources,p_multiplier);
 rev:=s.egg_source_version+1;
 for source in select value from jsonb_array_elements(evidence) loop
  insert into public.egg_sale_sources(org_id,sale_id,revision,farm_id,flock_id,house_id,batch_id,egg_quantity,conversion_multiplier,request_id,recorded_by)
  values(s.org_id,s.id,rev,s.farm_id,(source->>'flock_id')::uuid,(source->>'house_id')::uuid,nullif(source->>'batch_id','')::uuid,
   (source->>'egg_quantity')::numeric,(source->>'multiplier')::numeric,p_request,p_actor);
 end loop;
 prior:=current_setting('app.egg_sale_write',true); perform set_config('app.egg_sale_write','true',true);
 update public.daily_sales_records set egg_sources=evidence,egg_source_version=rev,egg_conversion_multiplier=(evidence->0->>'multiplier')::numeric,
  flock_id=case when jsonb_array_length(evidence)=1 then (evidence->0->>'flock_id')::uuid end,
  house_id=case when jsonb_array_length(evidence)=1 then (evidence->0->>'house_id')::uuid end,
  batch_id=case when jsonb_array_length(evidence)=1 then nullif(evidence->0->>'batch_id','')::uuid end,updated_at=clock_timestamp()
 where id=s.id returning * into s;
 perform set_config('app.egg_sale_write',coalesce(prior,''),true);
 for source_flock in select distinct x.fl from (
  select (value->>'flock_id')::uuid fl from jsonb_array_elements(evidence)
  union select flock_id from public.egg_sale_sources where sale_id=s.id
 ) x order by x.fl loop perform public.check_egg_sale_custody(s.org_id,source_flock,s.sale_date); end loop;
 return s;
end $$;

create function public.record_egg_sale(p_actor uuid,p_farm uuid,p_date date,p_payload jsonb,p_request uuid)
returns public.daily_sales_records language plpgsql security definer set search_path=public as $$
declare actor public.profiles; s public.daily_sales_records; branch uuid; gross numeric; paid numeric; prior text; fingerprint text;
begin
 select * into actor from public.profiles where id=p_actor and is_active and role::text='farm_manager' for share;
 if not found or (auth.uid() is not null and auth.uid()<>p_actor) or p_request is null then raise exception 'Active Farm Manager required.' using errcode='42501'; end if;
 select branch_id into branch from public.farms where id=p_farm and org_id=actor.org_id;
 if not found or not exists(select 1 from public.user_farm_access a where a.org_id=actor.org_id and a.profile_id=p_actor and a.farm_id=p_farm
  and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())) then raise exception 'Active farm assignment required.' using errcode='42501'; end if;
 perform 1 from public.user_farm_access a where a.org_id=actor.org_id and a.profile_id=p_actor and a.farm_id=p_farm
  and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()) for share;
 if not found then raise exception 'Farm assignment changed. Refresh access.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('egg-sale-request:'||p_request::text,0));
 fingerprint:=md5(jsonb_build_array(p_farm,p_date,p_payload)::text);
 select * into s from public.daily_sales_records where org_id=actor.org_id and recorded_by=p_actor and sale_request_id=p_request;
 if found then
  if s.sale_request_hash is distinct from fingerprint then raise exception 'Request ID already used with different sale evidence.' using errcode='40001'; end if;
  return s;
 end if;
 if p_date is null or p_date>(now() at time zone 'Africa/Addis_Ababa')::date or p_date<(now() at time zone 'Africa/Addis_Ababa')::date-6
  or exists(select 1 from public.farm_operating_days where farm_id=p_farm and operating_date=p_date and status in ('closed','locked')) then
  raise exception 'Sale date is outside the open operating window. Request an exact governed correction.' using errcode='55000'; end if;
 if p_payload->>'product_category' is distinct from 'egg' or length(btrim(coalesce(p_payload->>'product_label','')))=0
  or coalesce((p_payload->>'quantity')::numeric,0)<=0 or coalesce((p_payload->>'unit_price')::numeric,-1)<0 then
  raise exception 'A valid egg product, quantity and price are required.' using errcode='23514'; end if;
 gross:=round((p_payload->>'quantity')::numeric*(p_payload->>'unit_price')::numeric,2); paid:=coalesce((p_payload->>'paid_amount')::numeric,0);
 if gross>999999999999.99 then raise exception 'Sale amount exceeds the supported money precision.' using errcode='23514'; end if;
 if paid not between 0 and gross or paid<>round(paid,2) or (p_payload->>'unit_price')::numeric not between 0 and 9999999999.99
  or (p_payload->>'unit_price')::numeric<>round((p_payload->>'unit_price')::numeric,2) then raise exception 'Use valid amounts with at most two decimals; payment cannot exceed the sale.' using errcode='23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('egg-custody:'||p_farm::text,0));
 -- Match Daily Record lock order before the sale's reporting-revision trigger runs.
 perform public.egg_sale_source_evidence(actor.org_id,p_farm,p_date,(p_payload->>'quantity')::numeric,p_payload->>'unit',p_payload->'egg_sources');
 prior:=current_setting('app.egg_sale_write',true); perform set_config('app.egg_sale_write','true',true);
 insert into public.daily_sales_records(org_id,branch_id,farm_id,sale_date,product_category,product_label,quantity,unit,unit_price,gross_amount,paid_amount,balance_due,
  payment_method,customer_name,customer_phone,notes,recorded_by,sale_request_id,sale_request_hash)
 values(actor.org_id,branch,p_farm,p_date,'egg',btrim(p_payload->>'product_label'),(p_payload->>'quantity')::numeric,btrim(p_payload->>'unit'),
  (p_payload->>'unit_price')::numeric,gross,paid,gross-paid,nullif(p_payload->>'payment_method',''),nullif(p_payload->>'customer_name',''),
  nullif(p_payload->>'customer_phone',''),nullif(p_payload->>'notes',''),p_actor,p_request,fingerprint) returning * into s;
 perform set_config('app.egg_sale_write',coalesce(prior,''),true);
 s:=public.write_egg_sale_sources(s.id,p_actor,p_payload->'egg_sources');
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
 values(actor.org_id,p_actor,'farm_manager','egg_sale.recorded','daily_sales_records',s.id::text,'Recorded sale and explicit flock egg custody atomically.',to_jsonb(s));
 return s;
end $$;

-- Keep the existing Today receipts, authorization, offline replay and audit path.
do $$ declare definition text; start_at integer; end_at integer; begin
 select pg_get_functiondef('public.execute_today_command_v1(uuid,jsonb)'::regprocedure) into definition;
 start_at:=position('  elsif v_command_type = ''record_sale'' then' in definition);
 end_at:=position('  elsif v_command_type = ''record_expense'' then' in definition);
 if start_at=0 or end_at<=start_at then raise exception 'Today sale adapter seam changed.'; end if;
 definition:=substring(definition from 1 for start_at-1)||
 '  elsif v_command_type = ''record_sale'' and v_payload->>''product_category''=''egg'' then
    select id into v_row_id from public.record_egg_sale(p_actor_id,v_farm_id,v_work_date,v_payload,v_command_id);
    v_domain_result:=jsonb_build_object(''sale_id'',v_row_id);
    v_source_ref:=''daily_sales_records/''||v_row_id::text;
 '||substring(definition from start_at);
 execute definition;
end $$;

alter table public.governance_requests drop constraint governance_requests_request_type_check;
alter table public.governance_requests add constraint governance_requests_request_type_check check(request_type in (
 'batch_create','batch_archive','flock_place','flock_transfer','flock_close','flock_archive','feed_template','breed_target',
 'health_schedule','warning_threshold','locked_correction','void_record','egg_opening_balance','sales_unit_conversion',
 'batch_cycle_create','batch_cycle_close','archived_cycle_correction','recording_start','egg_sale_sources'));
create function public.apply_egg_sale_sources_request(p_request_id uuid) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare r public.governance_requests; s public.daily_sales_records; previous jsonb; prior text; stale_reason text;
begin
 if public.current_active_role()<>'farm_manager' then raise exception 'Assigned Farm Manager required.' using errcode='42501'; end if;
 select * into r from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
 if not found or r.request_type<>'egg_sale_sources' or r.source_table<>'daily_sales_records' then raise exception 'Source correction unavailable.' using errcode='P0002'; end if;
 if not public.has_active_farm_access(r.farm_id) then raise exception 'Active farm assignment required.' using errcode='42501'; end if;
 perform 1 from public.user_farm_access where profile_id=auth.uid() and farm_id=r.farm_id and revoked_at is null
  and starts_at<=now() and (expires_at is null or expires_at>now()) for share;
 if not found then raise exception 'Farm assignment changed. Refresh access.' using errcode='42501'; end if;
 if r.status='applied' then return r; end if;
 if r.status<>'approved' or r.approval_expires_at is null or r.approval_expires_at<=now()
  or not exists(select 1 from public.profiles where id=r.decided_by and org_id=r.org_id and role::text='ceo' and is_active) then
  raise exception 'CEO approval is no longer valid.' using errcode='40001'; end if;
 select * into s from public.daily_sales_records where id=r.source_id and org_id=r.org_id and farm_id=r.farm_id and product_category='egg' and voided_at is null for update;
 if not found or r.source_version is distinct from s.updated_at or r.proposed_values->>'sale_revision' is distinct from public.lifecycle_sale_revision(s.id,r.org_id) then
  stale_reason:='Sale changed after review. Submit again.';
 elsif s.egg_conversion_multiplier is null and (r.proposed_values->'egg_sources'->0->>'multiplier')::numeric is distinct from
  (select multiplier from public.sales_unit_conversions where org_id=s.org_id and product_category='egg' and lower(unit)=lower(s.unit)) then
  stale_reason:='Egg conversion changed after review. Submit again.';
 else
  perform pg_advisory_xact_lock(hashtextextended('egg-custody:'||r.farm_id::text,0));
  if public.egg_sale_source_evidence(s.org_id,s.farm_id,s.sale_date,s.quantity,s.unit,r.proposed_values->'egg_sources',s.egg_conversion_multiplier)
   is distinct from r.proposed_values->'egg_sources' then stale_reason:='Flock source context changed after review. Submit again.'; end if;
 end if;
 if stale_reason is not null then
  update public.governance_requests set status='conflict',conflict_reason=stale_reason,updated_at=now() where id=r.id returning * into r;
  insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note)
  select r.org_id,r.id,'conflict',auth.uid(),coalesce(full_name,'Farm Manager'),'farm_manager',stale_reason from public.profiles where id=auth.uid();
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
  values(r.org_id,auth.uid(),'farm_manager','egg_sale.source_conflict','governance_requests',r.id::text,stale_reason,to_jsonb(r));
  return r;
 end if;
 previous:=to_jsonb(s); prior:=current_setting('app.governance_apply',true); perform set_config('app.governance_apply','true',true);
 s:=public.write_egg_sale_sources(s.id,auth.uid(),r.proposed_values->'egg_sources',s.egg_conversion_multiplier,r.id);
 perform set_config('app.governance_apply',coalesce(prior,''),true);
 update public.governance_requests set status='applied',applied_at=now(),applied_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
 insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note)
 select r.org_id,r.id,'applied',auth.uid(),coalesce(full_name,'Farm Manager'),'farm_manager','Applied exact reviewed egg source correction; money unchanged.' from public.profiles where id=auth.uid();
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,before_values,after_values)
 values(r.org_id,auth.uid(),'farm_manager','egg_sale.sources_corrected','daily_sales_records',s.id::text,r.reason,previous,to_jsonb(s));
 return r;
end $$;

revoke all on function public.egg_sale_source_evidence(uuid,uuid,date,numeric,text,jsonb,numeric),public.check_egg_sale_custody(uuid,uuid,date),public.write_egg_sale_sources(uuid,uuid,jsonb,numeric,uuid),public.record_egg_sale(uuid,uuid,date,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.egg_sale_source_evidence(uuid,uuid,date,numeric,text,jsonb,numeric),public.record_egg_sale(uuid,uuid,date,jsonb,uuid) to service_role;
revoke all on function public.apply_egg_sale_sources_request(uuid) from public,anon;
grant execute on function public.apply_egg_sale_sources_request(uuid) to authenticated;

-- v3 freezes source-aware financial attribution. Old snapshots stay untouched.
do $$ declare definition text; signature text; begin
 foreach signature in array array['public.check_management_report_resources()','public.can_read_management_report(uuid,uuid)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  if position('''management-report-v2''' in definition)=0 then raise exception 'Report version seam changed.'; end if;
  definition:=replace(definition,'''management-report-v1-scoped'',''management-report-v2''','''management-report-v1-scoped'',''management-report-v2'',''management-report-v3''');
  definition:=replace(definition,'new.report_version=''management-report-v2''','new.report_version in (''management-report-v2'',''management-report-v3'')');
  if signature='public.check_management_report_resources()' then
   definition:=replace(definition,'v_resources:=new.report_snapshot->''report_resources'';',
    'if new.report_version=''management-report-v3'' and new.report_snapshot->''egg_sale_evidence_version'' is distinct from ''1''::jsonb then
      raise exception ''Versioned egg-source report evidence required.'' using errcode=''22023''; end if;
     v_resources:=new.report_snapshot->''report_resources'';');
  end if;
  execute definition;
 end loop;
end $$;
