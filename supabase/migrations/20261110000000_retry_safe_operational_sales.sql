-- Reuse the existing sale request index; never infer retry identity from amounts.
create function public.record_operational_sale(p_actor uuid,p_farm uuid,p_date date,p_payload jsonb,p_request uuid)
returns public.daily_sales_records language plpgsql security definer set search_path=public as $$
declare actor public.profiles; sale public.daily_sales_records; branch uuid; org uuid; support boolean:=false; support_id uuid; flock public.flocks;
 house uuid:=nullif(p_payload->>'house_id','')::uuid; batch uuid:=nullif(p_payload->>'batch_id','')::uuid;
 flock_id uuid:=nullif(p_payload->>'flock_id','')::uuid; fingerprint text;
 quantity numeric:=(p_payload->>'quantity')::numeric; price numeric:=(p_payload->>'unit_price')::numeric;
 paid numeric:=coalesce((p_payload->>'paid_amount')::numeric,0); gross numeric;
begin
 select * into actor from public.profiles where id=p_actor and is_active for share;
 if not found or (auth.uid() is not null and auth.uid()<>p_actor) or p_request is null then
  raise exception 'Active Farm Manager and retry identifier required.' using errcode='42501'; end if;
 select branch_id,org_id into branch,org from public.farms where id=p_farm;
 if not found then raise exception 'Farm unavailable.' using errcode='42501'; end if;
 if actor.role::text='system_admin' then
  select id into support_id from public.break_glass_sessions where administrator_id=p_actor and target_org_id=org and revoked_at is null and started_at<=now() and expires_at>now() order by started_at desc limit 1 for share;
  support:=found;
 end if;
 if not support then
  if actor.role::text<>'farm_manager' or actor.org_id<>org then raise exception 'Active Farm Manager required.' using errcode='42501'; end if;
  perform 1 from public.user_farm_access where org_id=org and profile_id=p_actor and farm_id=p_farm
   and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()) for share;
  if not found then raise exception 'Active farm assignment required.' using errcode='42501'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('sale-request:'||p_request::text,0));
 fingerprint:=md5(jsonb_build_array(p_farm,p_date,p_payload)::text);
 select * into sale from public.daily_sales_records where org_id=org and recorded_by=p_actor and sale_request_id=p_request;
 if found then
  if sale.sale_request_hash is distinct from fingerprint then raise exception 'Request ID already used with different sale evidence.' using errcode='40001'; end if;
  return sale;
 end if;
 if p_date is null or p_date>(now() at time zone 'Africa/Addis_Ababa')::date or p_date<(now() at time zone 'Africa/Addis_Ababa')::date-6
  or exists(select 1 from public.farm_operating_days where farm_id=p_farm and operating_date=p_date and status in ('closed','locked')) then
  raise exception 'Sale date is outside the open operating window. Request an exact governed correction.' using errcode='55000'; end if;
 if coalesce(p_payload->>'product_category','') not in ('bird','training','equipment_medicine','consultancy','package')
  or length(btrim(coalesce(p_payload->>'product_label','')))=0 or quantity is null or quantity<=0 or price is null or price<0 then
  raise exception 'A supported product, positive quantity and valid price are required.' using errcode='23514'; end if;
 gross:=round(quantity*price,2);
 if gross>999999999999.99 or paid not between 0 and gross or paid<>round(paid,2) or price>9999999999.99 or price<>round(price,2) then
  raise exception 'Use valid amounts with at most two decimals; payment cannot exceed the sale.' using errcode='23514'; end if;
 if flock_id is not null then
  select * into flock from public.flocks where id=flock_id and org_id=org and farm_id=p_farm for share;
  if not found or (house is not null and house<>flock.house_id) or (batch is not null and batch<>flock.batch_id) then
   raise exception 'Sale flock context is unavailable or contradictory.' using errcode='42501'; end if;
  house:=flock.house_id; batch:=flock.batch_id;
 end if;
 if house is not null and not exists(select 1 from public.houses where id=house and org_id=org and farm_id=p_farm) then
  raise exception 'Sale house unavailable.' using errcode='42501'; end if;
 if batch is not null and not exists(select 1 from public.batches where id=batch and org_id=org and farm_id=p_farm and (house is null or house_id=house)) then
  raise exception 'Sale batch unavailable.' using errcode='42501'; end if;
 insert into public.daily_sales_records(org_id,branch_id,farm_id,house_id,flock_id,batch_id,sale_date,
  product_category,product_label,quantity,unit,unit_price,gross_amount,paid_amount,balance_due,payment_method,customer_name,customer_phone,notes,recorded_by,sale_request_id,sale_request_hash)
 values(org,branch,p_farm,house,flock_id,batch,p_date,p_payload->>'product_category',btrim(p_payload->>'product_label'),quantity,
  coalesce(nullif(btrim(p_payload->>'unit'),''),case when p_payload->>'product_category'='bird' then 'bird' else 'unit' end),
  price,gross,paid,gross-paid,nullif(p_payload->>'payment_method',''),nullif(p_payload->>'customer_name',''),nullif(p_payload->>'customer_phone',''),
  nullif(p_payload->>'notes',''),p_actor,p_request,fingerprint) returning * into sale;
 insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,entity_table,entity_id,reason,after_values)
 values(org,p_actor,actor.role::text,support_id,'sales_record.recorded','daily_sales_records',sale.id::text,'Recorded operational sale atomically.',to_jsonb(sale));
 return sale;
end $$;
revoke all on function public.record_operational_sale(uuid,uuid,date,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.record_operational_sale(uuid,uuid,date,jsonb,uuid) to service_role;

do $$ declare definition text; first integer; last integer; begin
 select pg_get_functiondef('public.execute_today_command_v1(uuid,jsonb)'::regprocedure) into definition;
 first:=position('  elsif v_command_type = ''record_sale'' then' in definition);
 last:=position('  elsif v_command_type = ''record_expense'' then' in definition);
 if first=0 or last<=first then raise exception 'Today sale adapter seam changed.'; end if;
 execute substring(definition from 1 for first-1)||
 '  elsif v_command_type = ''record_sale'' then
    select id into v_row_id from public.record_operational_sale(p_actor_id,v_farm_id,v_work_date,
      v_payload||jsonb_build_object(''house_id'',v_house_id,''flock_id'',v_flock_id,''batch_id'',v_batch_id),v_command_id);
    v_domain_result:=jsonb_build_object(''sale_id'',v_row_id);
    v_source_ref:=''daily_sales_records/''||v_row_id::text;
 '||substring(definition from last);
end $$;
