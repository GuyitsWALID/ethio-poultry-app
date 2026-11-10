-- Enforce the same Addis cutoff even when the scheduled lock job has not run.
-- Governance application is the existing, reviewed historical-correction boundary.
create function public.assert_operating_entry_date(p_org uuid,p_farm uuid,p_date date)
returns void language plpgsql security definer set search_path=public as $$
declare cutoff date; today date:=(now() at time zone 'Africa/Addis_Ababa')::date;
begin
 select today-case when (now() at time zone 'Africa/Addis_Ababa')::time>=operational_day_lock_time
  then operational_day_lock_grace_days else operational_day_lock_grace_days+1 end
 into cutoff from public.organizations where id=p_org;
 if cutoff is null or p_date is null or p_date>today or p_date<=cutoff then
  raise exception 'This date is outside the open operating window. Request an exact governed correction.' using errcode='55000'; end if;
 if exists(select 1 from public.farm_operating_days where org_id=p_org and farm_id=p_farm and operating_date=p_date and status in ('closed','locked')) then
  raise exception 'The operating day is closed or locked. Request an exact governed correction.' using errcode='55000'; end if;
end $$;

-- The private schedule editor already verifies tenant, assignment, revision and
-- uncompleted status. Its linked metadata is a plan, not actual treatment.
do $$ declare definition text; first integer; last integer; begin
 select pg_get_functiondef('public.edit_legacy_health_schedule(uuid,uuid,uuid,text,timestamptz,date,uuid,uuid,uuid,jsonb)'::regprocedure) into definition;
 first:=position(' update public.health_events set event_date=p_date' in definition);
 last:=position(' execute format(''select to_jsonb(s)' in substring(definition from first))+first-1;
 if first=0 or last<=first then raise exception 'Private schedule metadata seam changed.'; end if;
 execute substring(definition from 1 for first-1)||
 ' declare previous_schedule_edit text:=current_setting(''app.health_schedule_edit'',true); begin
 perform set_config(''app.health_schedule_edit'',''true'',true);
 '||substring(definition from first for last-first)||
 ' perform set_config(''app.health_schedule_edit'',coalesce(previous_schedule_edit,''''),true);
 end;
 '||substring(definition from last);
end $$;
revoke all on function public.assert_operating_entry_date(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.assert_operating_entry_date(uuid,uuid,date) to service_role;

-- Retained sale/expense writers used a hard-coded seven-day window. Use the
-- organization setting here too, without changing their retry-before-write order.
do $$ declare signature text; definition text; first integer; last integer; arguments text; begin
 foreach signature in array array['public.record_egg_sale(uuid,uuid,date,jsonb,uuid)',
  'public.record_operational_sale(uuid,uuid,date,jsonb,uuid)',
  'public.record_operational_expense(uuid,uuid,date,jsonb,uuid)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  first:=position('if p_date is null or p_date>' in definition);
  if first=0 then raise exception 'Operating date seam changed: %',signature; end if;
  last:=position('end if;' in substring(definition from first))+first+6;
  arguments:=case when signature like '%record_egg_sale%' then 'actor.org_id,p_farm,p_date'
   when signature like '%record_operational_sale%' then 'org,p_farm,p_date' else 'p_org,farm,p_date' end;
  execute substring(definition from 1 for first-1)||'perform public.assert_operating_entry_date('||arguments||');'||substring(definition from last);
 end loop;
end $$;

create function public.guard_operating_entry_window() returns trigger
language plpgsql security definer set search_path=public as $$
declare evidence jsonb; farm uuid; day date; version integer;
begin
 if coalesce(current_setting('app.governance_apply',true),'false')='true' then
  return case when tg_op='DELETE' then old else new end;
 end if;
 -- Check both identities: an expired record cannot be moved to today to evade review.
 for version in 1..case when tg_op='UPDATE' then 2 else 1 end loop
  evidence:=case when tg_op='DELETE' or (tg_op='UPDATE' and version=1) then to_jsonb(old) else to_jsonb(new) end;
  if tg_table_name='health_events' and coalesce(current_setting('app.health_schedule_edit',true),'false')='true'
   and (evidence->>'description' like 'SCHEDULE_TARGET|%' or evidence->>'description' like 'SCHEDULE_STATUS|%') then continue; end if;
  if tg_table_name='biosecurity_checks' and evidence->>'completed_by' is null then continue; end if;
  farm:=nullif(evidence->>'farm_id','')::uuid;
  if farm is null and evidence->>'flock_id' is not null then
   select farm_id into farm from public.flocks where id=(evidence->>'flock_id')::uuid and org_id=(evidence->>'org_id')::uuid;
  end if;
  if farm is null and evidence->>'warehouse_id' is not null then
   select farm_id into farm from public.warehouses where id=(evidence->>'warehouse_id')::uuid and org_id=(evidence->>'org_id')::uuid;
  end if;
  day:=coalesce(evidence->>'record_date',evidence->>'sale_date',evidence->>'event_date',evidence->>'transaction_date',evidence->>'entry_date',evidence->>'checklist_date')::date;
  perform public.assert_operating_entry_date((evidence->>'org_id')::uuid,farm,day);
 end loop;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function public.guard_operating_entry_window() from public,anon,authenticated;
do $$ declare name text; begin
 -- Vaccination dates are plans; actual completions write health/stock evidence.
 foreach name in array array['daily_farm_records','feeding_session_records','daily_sales_records',
  'health_events','mortality_events','weight_records','stock_ledger','cost_entries','feed_day_closures','biosecurity_checks'] loop
  execute format('create trigger operating_entry_window before insert or update or delete on public.%I for each row execute function public.guard_operating_entry_window()',name);
 end loop;
end $$;
