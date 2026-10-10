-- Internal helpers are never executable by browser roles. The existing
-- Governance interface remains the only decision/application interface.
create function public.lifecycle_cycle_revision(p_org uuid,p_cycle uuid,p_day date) returns text
language sql stable security definer set search_path=public,extensions as $$
  select encode(extensions.digest(jsonb_build_object(
    'cycle',(select to_jsonb(c) from public.batch_cycles c where c.id=p_cycle and c.org_id=p_org),
    'batches',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.batches b where b.org_id=p_org and b.batch_cycle_id=p_cycle),
    'flocks',(select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]') from public.flocks f join public.batches b on b.id=f.batch_id where f.org_id=p_org and b.batch_cycle_id=p_cycle),
    'daily',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.daily_farm_records d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where d.org_id=p_org and b.batch_cycle_id=p_cycle and d.record_date=p_day),
    'feed',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.feed_day_closures d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where d.org_id=p_org and b.batch_cycle_id=p_cycle and d.record_date=p_day),
    'attestations',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.daily_task_attestations d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where d.org_id=p_org and b.batch_cycle_id=p_cycle and d.work_date=p_day),
    'health',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.health_events d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where d.org_id=p_org and b.batch_cycle_id=p_cycle and d.event_date=p_day),
    'mortality',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.mortality_events d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where d.org_id=p_org and b.batch_cycle_id=p_cycle and d.record_date=p_day),
    'supplies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]') from public.stock_ledger d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where d.org_id=p_org and b.batch_cycle_id=p_cycle and d.transaction_date=p_day and d.source_kind='daily_record_usage')
  )::text,'sha256'),'hex')
$$;
create function public.lifecycle_house_revision(p_org uuid,p_house uuid) returns text
language sql stable security definer set search_path=public,extensions as $$
  select encode(extensions.digest(jsonb_build_object(
    'house',(select to_jsonb(h) from public.houses h where h.id=p_house and h.org_id=p_org),
    'flocks',(select coalesce(jsonb_agg(to_jsonb(f) order by f.id),'[]') from public.flocks f where f.org_id=p_org and (f.house_id=p_house or f.id in(select m.flock_id from public.flock_transfers m where m.from_house_id=p_house))),
    'closures',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.batch_cycle_closures c join public.batch_cycles b on b.id=c.cycle_id where b.org_id=p_org and b.id in(select x.batch_cycle_id from public.batches x join public.flocks f on f.batch_id=x.id where f.house_id=p_house))
  )::text,'sha256'),'hex')
$$;
create function public.append_lifecycle_change(p_request public.governance_requests,p_table text,p_id uuid,p_before jsonb,p_after jsonb,p_fields text[]) returns void
language plpgsql security definer set search_path=public,extensions as $$
begin
  insert into public.lifecycle_record_changes(org_id,request_id,source_table,source_id,before_values,after_values,after_revision,approved_fields)
  values(p_request.org_id,p_request.id,p_table,p_id,p_before,p_after,encode(extensions.digest(p_after::text,'sha256'),'hex'),p_fields);
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,before_values,after_values,metadata)
  values(p_request.org_id,auth.uid(),'farm_manager','lifecycle.'||p_request.request_type,p_table,p_id::text,p_request.reason,p_before,p_after,jsonb_build_object('request_id',p_request.id,'approved_fields',p_fields));
end $$;

create function public.apply_batch_cycle_create_v1(p_request public.governance_requests) returns uuid
language plpgsql security definer set search_path=public as $$
declare p jsonb:=p_request.proposed_values; v_farm public.farms; v_house public.houses; v_item jsonb;
  v_cycle uuid; v_batch uuid; v_flock uuid; v_time timestamptz; v_day date; v_count integer; v_total bigint:=0;
  v_purpose public.flock_type; v_source public.flock_source; v_after jsonb; v_previous record;
begin
  if p_request.farm_id is null or (p->>'farm_id')::uuid is distinct from p_request.farm_id or coalesce(p->>'actual_date_confirmed','false')<>'true' then
    raise exception 'Confirm the actual arrival and placement date for the assigned farm.' using errcode='22023'; end if;
  select * into v_farm from public.farms where id=p_request.farm_id and org_id=p_request.org_id for share;
  if not found or not public.has_active_farm_access(v_farm.id) then raise exception 'An active farm assignment is required.' using errcode='42501'; end if;
  v_time:=(p->>'placed_at')::timestamptz; v_day:=(v_time at time zone 'Africa/Addis_Ababa')::date;
  if v_time is null or v_time>now() then raise exception 'Use the actual arrival time, not a future arrival.' using errcode='22023'; end if;
  -- Historical placements are explicitly governed, but cannot contradict an
  -- already established house occupancy timeline.
  if jsonb_typeof(p->'placements') is distinct from 'array' or jsonb_array_length(p->'placements') not between 1 and 100 then
    raise exception 'Choose between one and one hundred houses.' using errcode='22023'; end if;
  if (select count(distinct x->>'house_id') from jsonb_array_elements(p->'placements') x)<>jsonb_array_length(p->'placements') then
    raise exception 'A house can appear only once in this cycle.' using errcode='22023'; end if;
  v_purpose:=(p->>'production_purpose')::public.flock_type; v_source:=(p->>'source')::public.flock_source;
  if v_purpose is null or v_source is null or length(btrim(coalesce(p->>'cycle_code',''))) not between 1 and 120
    or coalesce((p->>'age_at_placement_days')::integer,-1)<0 then
    raise exception 'Cycle code, purpose, source and age at arrival are required.' using errcode='22023'; end if;
  if nullif(p->>'breed_id','') is not null and not exists(select 1 from public.breeds where id=(p->>'breed_id')::uuid and org_id=p_request.org_id) then
    raise exception 'The selected breed is unavailable.' using errcode='42501'; end if;
  -- Lock every target in deterministic order before observing occupancy.
  for v_item in select x from jsonb_array_elements(p->'placements') x order by x->>'house_id' loop
    select * into v_house from public.houses where id=(v_item->>'house_id')::uuid and farm_id=v_farm.id and org_id=p_request.org_id for update;
    if not found then raise exception 'A selected house is outside the farm.' using errcode='42501'; end if;
    if v_item->>'expected_revision' is distinct from public.lifecycle_house_revision(p_request.org_id,v_house.id) then
      raise exception 'A house or its previous cycle changed. Review and request approval again.' using errcode='40001'; end if;
    if exists(select 1 from public.flocks f where f.house_id=v_house.id and (f.status in ('active','quarantined') or not exists(select 1 from public.batch_cycle_clearances c where c.flock_id=f.id))) then
      raise exception 'Finish and archive the previous cycle before placing new birds in this house.' using errcode='23514'; end if;
    for v_previous in select c.completed_at from public.batch_cycle_closures c join public.batch_cycles bc on bc.id=c.cycle_id
      where bc.id in (select b.batch_cycle_id from public.batches b join public.flocks f on f.batch_id=b.id where f.house_id=v_house.id
        or f.id in(select flock_id from public.flock_transfers where from_house_id=v_house.id)) loop
      if v_previous.completed_at>=v_time then raise exception 'The whole previous cycle must finish before the new placement time.' using errcode='23514'; end if;
    end loop;
    if exists(select 1 from public.flock_transfers m join public.flocks f on f.id=m.flock_id left join public.batches b on b.id=f.batch_id left join public.batch_cycles c on c.id=b.batch_cycle_id
      where m.from_house_id=v_house.id and (c.id is null or not c.completion_verified or c.status<>'archived')) then
      raise exception 'The previous transferred cycle must be finished and archived before this house is reused.' using errcode='23514'; end if;
    v_count:=(v_item->>'starting_birds')::integer;
    if v_count is null or v_count<1 or length(btrim(coalesce(v_item->>'batch_code','')))=0 or length(btrim(coalesce(v_item->>'flock_code','')))=0 then
      raise exception 'Enter independent starting birds, batch code and flock code for each house.' using errcode='22023'; end if;
    v_total:=v_total+v_count;
  end loop;
  if v_total<>coalesce((p->>'placement_total')::bigint,-1) or v_total>2147483647 then
    raise exception 'House starting populations must equal the reviewed placement total.' using errcode='23514'; end if;
  insert into public.batch_cycles(org_id,farm_id,cycle_code,production_purpose,status,placement_date,placed_at,created_by_request)
  values(p_request.org_id,v_farm.id,btrim(p->>'cycle_code'),v_purpose,'active',v_day,v_time,p_request.id) returning id into v_cycle;
  select to_jsonb(c) into v_after from public.batch_cycles c where id=v_cycle;
  perform public.append_lifecycle_change(p_request,'batch_cycles',v_cycle,'{}',v_after,array['placement','production_purpose','farm_id']);
  for v_item in select x from jsonb_array_elements(p->'placements') x order by x->>'house_id' loop
    v_count:=(v_item->>'starting_birds')::integer;
    insert into public.batches(org_id,branch_id,farm_id,house_id,batch_cycle_id,batch_code,source,supplier_name,purchase_date,placement_date,
      age_at_placement_days,total_count,purchase_cost_per_bird,transport_cost,other_cost,notes,status)
    values(p_request.org_id,v_farm.branch_id,v_farm.id,(v_item->>'house_id')::uuid,v_cycle,btrim(v_item->>'batch_code'),v_source,nullif(p->>'supplier_name',''),
      v_day,v_day,(p->>'age_at_placement_days')::integer,v_count,nullif(p->>'purchase_cost_per_bird','')::numeric,
      coalesce((v_item->>'transport_cost')::numeric,0),coalesce((v_item->>'other_cost')::numeric,0),nullif(p->>'notes',''),'active') returning id into v_batch;
    insert into public.flocks(org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,placed_at,age_at_placement_days,initial_count,current_count,breed_id,purchase_cost_per_bird,notes,status)
    values(p_request.org_id,v_farm.id,(v_item->>'house_id')::uuid,v_batch,btrim(v_item->>'flock_code'),v_purpose,v_source,v_day,v_time,
      (p->>'age_at_placement_days')::integer,v_count,v_count,nullif(p->>'breed_id','')::uuid,nullif(p->>'purchase_cost_per_bird','')::numeric,nullif(p->>'notes',''),'active') returning id into v_flock;
    select to_jsonb(b) into v_after from public.batches b where id=v_batch;
    perform public.append_lifecycle_change(p_request,'batches',v_batch,'{}',v_after,array['placement','starting_population','batch_cycle_id']);
    select to_jsonb(f) into v_after from public.flocks f where id=v_flock;
    perform public.append_lifecycle_change(p_request,'flocks',v_flock,'{}',v_after,array['placement','starting_population']);
  end loop;
  return v_cycle;
end $$;

create function public.apply_batch_cycle_close_v1(p_request public.governance_requests) returns uuid
language plpgsql security definer set search_path=public as $$
declare p jsonb:=p_request.proposed_values; v_cycle public.batch_cycles; v_flock public.flocks;
  v_daily public.daily_farm_records; v_sale public.daily_sales_records; v_item jsonb; v_time timestamptz; v_day date;
  v_closure uuid; v_clearance uuid; v_before jsonb; v_after jsonb; v_quantity integer; v_total bigint; v_capacity bigint; v_used bigint; v_members integer:=0;
  v_confirmations jsonb; v_confirmation jsonb; v_attestation_id uuid;
begin
  select * into v_cycle from public.batch_cycles where id=(p->>'cycle_id')::uuid and org_id=p_request.org_id for update;
  if not found or v_cycle.farm_id is distinct from p_request.farm_id then raise exception 'The affected cycle is unavailable.' using errcode='42501'; end if;
  v_time:=(p->>'completed_at')::timestamptz; v_day:=(v_time at time zone 'Africa/Addis_Ababa')::date;
  if v_time is null or v_time>now() or v_day<v_cycle.placement_date or (v_cycle.placed_at is not null and v_time<=v_cycle.placed_at) then
    raise exception 'Enter the actual completion time after placement, not a future time.' using errcode='22023'; end if;
  if p->>'mode' not in ('close','legacy_attestation') then raise exception 'Choose a supported completion mode.' using errcode='22023'; end if;
  if p->>'mode'='close' and v_cycle.status<>'active' then raise exception 'This cycle is no longer operating.' using errcode='40001'; end if;
  if p->>'mode'='legacy_attestation' and (not v_cycle.legacy_singleton or v_cycle.status<>'archived' or v_cycle.completion_verified or length(btrim(coalesce(p->>'supporting_reference','')))<3) then
    raise exception 'A legacy archived cycle needs explicit CEO-approved empty-house evidence.' using errcode='23514'; end if;
  perform 1 from public.houses h where h.id in(select f.house_id from public.flocks f join public.batches b on b.id=f.batch_id where b.batch_cycle_id=v_cycle.id) order by h.id for update;
  perform 1 from public.batches b where b.batch_cycle_id=v_cycle.id order by b.id for update;
  perform 1 from public.flocks f join public.batches b on b.id=f.batch_id where b.batch_cycle_id=v_cycle.id order by f.id for update of f;
  perform 1 from public.daily_farm_records d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where b.batch_cycle_id=v_cycle.id and d.record_date=v_day order by d.id for update of d;
  perform 1 from public.feed_day_closures d join public.flocks f on f.id=d.flock_id join public.batches b on b.id=f.batch_id where b.batch_cycle_id=v_cycle.id and d.record_date=v_day order by d.id for update of d;
  if p->>'expected_revision' is distinct from public.lifecycle_cycle_revision(p_request.org_id,v_cycle.id,v_day) then
    raise exception 'Cycle membership or final-day evidence changed. Request fresh approval.' using errcode='40001'; end if;
  if jsonb_typeof(p->'dispositions') is distinct from 'array' or jsonb_array_length(p->'dispositions')>500 then
    raise exception 'Review the remaining-bird accounting.' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p->'dispositions') x where not exists(select 1 from public.flocks f join public.batches b on b.id=f.batch_id where f.id=(x->>'flock_id')::uuid and b.batch_cycle_id=v_cycle.id)) then
    raise exception 'Every departure must belong to this cycle.' using errcode='42501'; end if;
  -- Sale locks serialize allocations even when independent cycles close together.
  perform 1 from public.daily_sales_records s where s.id in(select (x->>'sale_id')::uuid from jsonb_array_elements(p->'dispositions') x where x->>'kind'='sale') order by s.id for update;
  insert into public.batch_cycle_closures(org_id,cycle_id,request_id,completed_at,mode,supporting_reference,applied_by)
  values(p_request.org_id,v_cycle.id,p_request.id,v_time,p->>'mode',nullif(p->>'supporting_reference',''),auth.uid()) returning id into v_closure;
  for v_flock in select f.* from public.flocks f join public.batches b on b.id=f.batch_id where b.batch_cycle_id=v_cycle.id order by f.id loop
    v_members:=v_members+1;
    if not public.has_active_farm_access(v_flock.farm_id) then raise exception 'An active assignment to every member farm is required.' using errcode='42501'; end if;
    if p->>'mode'='legacy_attestation' then
      if v_flock.status in ('active','quarantined') or jsonb_array_length(p->'dispositions')<>0 then
        raise exception 'Legacy attestation does not alter an operating flock or rewrite historical bird accounting.' using errcode='23514'; end if;
      insert into public.batch_cycle_clearances(org_id,closure_id,flock_id,house_id,before_clearance_birds,source_snapshot)
      values(p_request.org_id,v_closure,v_flock.id,v_flock.house_id,v_flock.current_count,to_jsonb(v_flock));
      -- Historical populations stay unchanged; verified no-birds-present is
      -- represented by immutable clearance evidence, not a fabricated count.
      v_before:=to_jsonb(v_flock);
      update public.flocks set completed_at=v_time,updated_at=now() where id=v_flock.id returning to_jsonb(flocks.*) into v_after;
      perform public.append_lifecycle_change(p_request,'flocks',v_flock.id,v_before,v_after,array['completed_at']);
      continue;
    end if;
    if v_flock.status not in ('active','quarantined') then raise exception 'Every member must still be operating.' using errcode='40001'; end if;
    if exists(select 1 from public.daily_farm_records where flock_id=v_flock.id and voided_at is null and record_date>v_day) then
      raise exception 'Later operating records exist. Review the actual completion date.' using errcode='23514'; end if;
    select * into v_daily from public.daily_farm_records where org_id=p_request.org_id and flock_id=v_flock.id and record_date=v_day and voided_at is null;
    if not found or v_daily.opening_birds is null or v_daily.closing_birds is null or v_daily.water_consumed_liters is null
      or v_daily.deaths is null or v_daily.culls is null or (v_flock.flock_type in ('layer','parent_stock') and
        (v_daily.normal_eggs is null or v_daily.broken_eggs is null or v_daily.dirty_eggs is null or v_daily.total_eggs is null)) then
      raise exception 'Complete each member flock final-day Daily Record first.' using errcode='23514'; end if;
    if v_daily.closing_birds<>v_daily.opening_birds+coalesce(v_daily.transfers_in,0)-v_daily.deaths-v_daily.culls-coalesce(v_daily.transfers_out,0)-coalesce(v_daily.other_removals,0)
      or v_daily.closing_birds<>v_flock.current_count then
      raise exception 'The final-day bird count disagrees with the flock. Correct the source; no balancing adjustment is permitted.' using errcode='23514'; end if;
    if not exists(select 1 from public.feed_day_closures where org_id=p_request.org_id and flock_id=v_flock.id and record_date=v_day and status='closed') then
      raise exception 'Finish feeding for every member flock before closing the cycle.' using errcode='23514'; end if;
    -- Do not strand unfinished Today confirmations on an archived identity.
    -- This is the retained Today evidence rule, not an automatic zero event.
    if v_daily.deaths+v_daily.culls=0
      and not exists(select 1 from public.health_events where org_id=p_request.org_id and flock_id=v_flock.id and event_date=v_day and voided_at is null)
      and not exists(select 1 from public.mortality_events where org_id=p_request.org_id and flock_id=v_flock.id and record_date=v_day)
      and not exists(select 1 from public.daily_task_attestations where org_id=p_request.org_id and farm_id=v_flock.farm_id and flock_id=v_flock.id and work_date=v_day and task_code='health_deaths' and superseded_at is null and source_fingerprint=public.today_source_fingerprint(v_flock.farm_id,v_flock.id,v_day,'health_deaths')) then
      raise exception 'Confirm health and deaths for every member flock in Today before archiving.' using errcode='23514'; end if;
    if not exists(select 1 from public.stock_ledger where org_id=p_request.org_id and farm_id=v_flock.farm_id and flock_id=v_flock.id and transaction_date=v_day and source_kind='daily_record_usage')
      and not exists(select 1 from public.daily_task_attestations where org_id=p_request.org_id and farm_id=v_flock.farm_id and flock_id=v_flock.id and work_date=v_day and task_code='routine_supplies' and superseded_at is null and source_fingerprint=public.today_source_fingerprint(v_flock.farm_id,v_flock.id,v_day,'routine_supplies')) then
      raise exception 'Confirm supplies for every member flock in Today before archiving.' using errcode='23514'; end if;
    v_total:=0;
    insert into public.batch_cycle_clearances(org_id,closure_id,flock_id,house_id,daily_record_id,before_clearance_birds,source_snapshot)
    values(p_request.org_id,v_closure,v_flock.id,v_flock.house_id,v_daily.id,v_flock.current_count,jsonb_build_object('flock',to_jsonb(v_flock),'daily',to_jsonb(v_daily))) returning id into v_clearance;
    for v_item in select x from jsonb_array_elements(p->'dispositions') x where (x->>'flock_id')::uuid=v_flock.id loop
      v_quantity:=(v_item->>'quantity')::integer;
      if v_quantity is null or v_quantity<1 then raise exception 'Every final departure needs a positive physical bird count.' using errcode='22023'; end if;
      if v_item->>'kind'='sale' then
        select * into v_sale from public.daily_sales_records where id=(v_item->>'sale_id')::uuid and org_id=p_request.org_id and voided_at is null;
        if not found or v_sale.product_category<>'bird' or v_sale.farm_id is distinct from v_flock.farm_id or v_sale.sale_date>v_day or v_sale.sale_date<v_flock.placement_date
          or (v_sale.flock_id is not null and v_sale.flock_id<>v_flock.id) or (v_sale.batch_id is not null and v_sale.batch_id<>v_flock.batch_id)
          or (v_sale.house_id is not null and v_sale.house_id<>v_flock.house_id) then
          raise exception 'Select an authorized, non-voided bird sale for this flock and completion date.' using errcode='42501'; end if;
        if v_item->>'sale_revision' is distinct from public.lifecycle_sale_revision(v_sale.id,p_request.org_id) then
          raise exception 'A selected sale changed. Review its physical evidence and request approval again.' using errcode='40001'; end if;
        if lower(btrim(v_sale.unit))='bird' then
          if v_sale.quantity<>trunc(v_sale.quantity) or v_sale.quantity<1 then raise exception 'Bird-unit sales require whole physical head counts.' using errcode='23514'; end if;
          v_capacity:=v_sale.quantity;
        else
          select head_count into v_capacity from public.bird_sale_head_count_attestations where sale_id=v_sale.id;
          if not found then
            v_capacity:=(v_item->>'physical_head_count')::integer;
            if v_capacity is null or v_capacity<1 or length(btrim(coalesce(v_item->>'supporting_reference','')))<3 then
              raise exception 'A non-bird-unit sale needs explicit CEO-approved physical head-count evidence. Birds cannot be inferred from kilograms.' using errcode='23514'; end if;
            insert into public.bird_sale_head_count_attestations(sale_id,org_id,request_id,head_count,supporting_reference,source_revision)
            values(v_sale.id,p_request.org_id,p_request.id,v_capacity,v_item->>'supporting_reference',v_item->>'sale_revision');
          elsif nullif(v_item->>'physical_head_count','') is not null and v_capacity<>(v_item->>'physical_head_count')::integer then
            raise exception 'The approved physical sale capacity cannot be changed by another closure.' using errcode='23514'; end if;
        end if;
        select coalesce(sum(quantity),0) into v_used from public.batch_cycle_dispositions where sale_id=v_sale.id;
        if v_used+v_quantity>v_capacity then raise exception 'This sale has insufficient unallocated physical birds.' using errcode='23514'; end if;
        insert into public.batch_cycle_dispositions(org_id,clearance_id,kind,quantity,sale_id,supporting_reference)
        values(p_request.org_id,v_clearance,'sale',v_quantity,v_sale.id,nullif(v_item->>'supporting_reference',''));
      elsif v_item->>'kind'='other' then
        insert into public.batch_cycle_dispositions(org_id,clearance_id,kind,quantity,reason,supporting_reference)
        values(p_request.org_id,v_clearance,'other',v_quantity,v_item->>'reason',v_item->>'supporting_reference');
      else raise exception 'Choose sold birds or an evidenced other departure. Deaths and culls are already recorded.' using errcode='22023'; end if;
      v_total:=v_total+v_quantity;
    end loop;
    if v_total<>v_flock.current_count then raise exception 'Final physical departures must exactly account for every remaining bird.' using errcode='23514'; end if;
    -- Preserve only already-valid explicit zero confirmations, not missing
    -- work. The approved final removal changes the Daily Record revision but
    -- does not introduce health activity or supply usage. Keep the original
    -- confirmation and append its narrowly derived successor plus audit.
    select coalesce(jsonb_agg(to_jsonb(a)),'[]') into v_confirmations
    from public.daily_task_attestations a where a.org_id=p_request.org_id and a.farm_id=v_flock.farm_id and a.flock_id=v_flock.id
      and a.work_date=v_day and a.task_code in ('health_deaths','routine_supplies') and a.superseded_at is null
      and a.source_fingerprint=public.today_source_fingerprint(v_flock.farm_id,v_flock.id,v_day,a.task_code);
    v_before:=to_jsonb(v_daily);
    update public.daily_farm_records set other_removals=coalesce(other_removals,0)+v_total,closing_birds=0,updated_at=now() where id=v_daily.id returning to_jsonb(daily_farm_records.*) into v_after;
    perform public.append_lifecycle_change(p_request,'daily_farm_records',v_daily.id,v_before,v_after,array['other_removals','closing_birds']);
    for v_confirmation in select value from jsonb_array_elements(v_confirmations) loop
      update public.daily_task_attestations set superseded_at=now(),updated_at=now() where id=(v_confirmation->>'id')::uuid returning to_jsonb(daily_task_attestations.*) into v_after;
      perform public.append_lifecycle_change(p_request,'daily_task_attestations',(v_confirmation->>'id')::uuid,v_confirmation,v_after,array['superseded_at']);
      insert into public.daily_task_attestations(org_id,farm_id,flock_id,work_date,task_code,source_fingerprint,confirmed_by,derived_from_id,governance_request_id)
      values(p_request.org_id,v_flock.farm_id,v_flock.id,v_day,v_confirmation->>'task_code',
        public.today_source_fingerprint(v_flock.farm_id,v_flock.id,v_day,v_confirmation->>'task_code'),(v_confirmation->>'confirmed_by')::uuid,(v_confirmation->>'id')::uuid,p_request.id)
      returning id,to_jsonb(daily_task_attestations.*) into v_attestation_id,v_after;
      perform public.append_lifecycle_change(p_request,'daily_task_attestations',v_attestation_id,'{}',v_after,array['source_fingerprint','derived_from_id','governance_request_id']);
    end loop;
    v_before:=to_jsonb(v_flock);
    update public.flocks set current_count=0,status='archived',completed_at=v_time,updated_at=now() where id=v_flock.id returning to_jsonb(flocks.*) into v_after;
    perform public.append_lifecycle_change(p_request,'flocks',v_flock.id,v_before,v_after,array['current_count','status','completed_at']);
  end loop;
  if v_members=0 then raise exception 'This cycle has no verified placements. Operator mapping is required.' using errcode='23514'; end if;
  for v_item in select to_jsonb(b) from public.batches b where b.batch_cycle_id=v_cycle.id loop
    update public.batches set status='archived',updated_at=now() where id=(v_item->>'id')::uuid returning to_jsonb(batches.*) into v_after;
    perform public.append_lifecycle_change(p_request,'batches',(v_item->>'id')::uuid,v_item,v_after,array['status']);
  end loop;
  update public.batch_cycles set status='archived',completion_verified=true,completed_at=v_time,updated_at=now() where id=v_cycle.id returning to_jsonb(batch_cycles.*) into v_after;
  perform public.append_lifecycle_change(p_request,'batch_cycles',v_cycle.id,to_jsonb(v_cycle),v_after,array['status','completion_verified','completed_at']);
  return v_cycle.id;
end $$;

-- Preserve every prior non-lifecycle adapter, including egg-opening and sale
-- conversions, instead of copying an obsolete version of the dispatcher.
alter function public.apply_governance_request(uuid) rename to apply_governance_request_pre_cycles;
revoke all on function public.apply_governance_request_pre_cycles(uuid) from public,anon,authenticated,service_role;
create function public.apply_governance_request(p_request_id uuid) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare r public.governance_requests; v_id uuid; v_before_flag text; v_before_apply text; v_name text;
begin
  if public.current_active_role()<>'farm_manager' then raise exception 'Only an assigned Farm Manager can apply an approved change.' using errcode='42501'; end if;
  select * into r from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
  if r.request_type in ('batch_create','batch_archive','flock_place','flock_close','flock_archive','flock_transfer') then
    raise exception 'Refresh the cycle membership and bird accounting in Flocks and request CEO approval again.' using errcode='0A000'; end if;
  if r.request_type not in ('batch_cycle_create','batch_cycle_close') then
    return public.apply_governance_request_pre_cycles(p_request_id);
  end if;
  if not public.has_active_farm_access(r.farm_id) then raise exception 'An active farm assignment is required.' using errcode='42501'; end if;
  if r.status='applied' then return r; end if;
  if r.status<>'approved' or r.decided_at is null or r.approval_expires_at is null or r.approval_expires_at<=now()
    or not exists(select 1 from public.profiles where id=r.decided_by and org_id=r.org_id and role::text='ceo' and is_active) then
    raise exception 'This CEO authorization is no longer available.' using errcode='40001'; end if;
  v_before_flag:=current_setting('app.lifecycle_apply',true); v_before_apply:=current_setting('app.governance_apply',true);
  perform set_config('app.lifecycle_apply','true',true); perform set_config('app.governance_apply','true',true);
  if r.request_type='batch_cycle_create' then v_id:=public.apply_batch_cycle_create_v1(r);
  else v_id:=public.apply_batch_cycle_close_v1(r); end if;
  perform set_config('app.lifecycle_apply',coalesce(v_before_flag,''),true); perform set_config('app.governance_apply',coalesce(v_before_apply,''),true);
  update public.governance_requests set status='applied',source_table='batch_cycles',source_id=v_id,applied_at=now(),applied_by=auth.uid(),updated_at=now() where id=r.id returning * into r;
  select coalesce(full_name,'Farm Manager') into v_name from public.profiles where id=auth.uid();
  insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note)
  values(r.org_id,r.id,'applied',auth.uid(),v_name,'farm_manager','Applied the exact CEO-authorized cycle change.');
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
  values(r.org_id,auth.uid(),'farm_manager','governance_request.applied','governance_requests',r.id::text,r.reason,to_jsonb(r));
  return r;
end $$;
revoke all on function public.apply_governance_request(uuid) from public,anon;
grant execute on function public.apply_governance_request(uuid) to authenticated;
do $$ declare signature text; begin
  foreach signature in array array['lifecycle_cycle_revision(uuid,uuid,date)','lifecycle_house_revision(uuid,uuid)','append_lifecycle_change(public.governance_requests,text,uuid,jsonb,jsonb,text[])','apply_batch_cycle_create_v1(public.governance_requests)','apply_batch_cycle_close_v1(public.governance_requests)'] loop
    execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
  end loop;
end $$;
grant execute on function public.lifecycle_cycle_revision(uuid,uuid,date) to service_role;
grant execute on function public.lifecycle_house_revision(uuid,uuid) to service_role;

alter function public.governance_source_version(text,uuid,uuid) rename to governance_source_version_pre_cycles;
revoke all on function public.governance_source_version_pre_cycles(text,uuid,uuid) from public,anon,authenticated,service_role;
create function public.governance_source_version(p_table text,p_id uuid,p_org uuid) returns timestamptz language plpgsql security definer set search_path=public as $$
begin
  if p_table='batch_cycles' then return (select updated_at from public.batch_cycles where id=p_id and org_id=p_org); end if;
  return public.governance_source_version_pre_cycles(p_table,p_id,p_org);
end $$;
revoke all on function public.governance_source_version(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.governance_source_version(text,uuid,uuid) to service_role;

-- A direct browser insert may propose work, never manufacture an approval.
drop policy governance_requests_manager_insert on public.governance_requests;
create policy governance_requests_manager_insert on public.governance_requests for insert to authenticated with check (
  public.current_active_role()='farm_manager' and org_id=public.current_org_id() and requested_by=auth.uid()
  and status='pending' and decided_by is null and decided_at is null and applied_by is null and applied_at is null and approval_expires_at is null
  and (farm_id is null or public.has_active_farm_access(farm_id)));

alter function public.decide_governance_request(uuid,text,text) rename to decide_governance_request_pre_cycles;
revoke all on function public.decide_governance_request_pre_cycles(uuid,text,text) from public,anon,authenticated,service_role;
create function public.decide_governance_request(p_request_id uuid,p_decision text,p_note text) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare r public.governance_requests; p jsonb; x jsonb; v_day date;
begin
  if public.current_active_role()<>'ceo' then raise exception 'Only the organization CEO can decide governance requests.' using errcode='42501'; end if;
  select * into r from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
  p:=r.proposed_values;
  if p_decision='approved' and r.request_type='batch_cycle_create' then
    for x in select value from jsonb_array_elements(p->'placements') loop
      if x->>'expected_revision' is distinct from public.lifecycle_house_revision(r.org_id,(x->>'house_id')::uuid) then
        raise exception 'A placement house changed. Return the proposal for a fresh review.' using errcode='40001'; end if;
    end loop;
  elsif p_decision='approved' and r.request_type='batch_cycle_close' then
    v_day:=((p->>'completed_at')::timestamptz at time zone 'Africa/Addis_Ababa')::date;
    if p->>'expected_revision' is distinct from public.lifecycle_cycle_revision(r.org_id,(p->>'cycle_id')::uuid,v_day) then
      raise exception 'Cycle membership or final-day evidence changed. Return the proposal for a fresh review.' using errcode='40001'; end if;
    for x in select value from jsonb_array_elements(p->'dispositions') where value->>'kind'='sale' loop
      if x->>'sale_revision' is distinct from public.lifecycle_sale_revision((x->>'sale_id')::uuid,r.org_id) then
        raise exception 'Sale evidence changed. Return the proposal for a fresh review.' using errcode='40001'; end if;
    end loop;
  end if;
  return public.decide_governance_request_pre_cycles(p_request_id,p_decision,p_note);
end $$;
revoke all on function public.decide_governance_request(uuid,text,text) from public,anon;
grant execute on function public.decide_governance_request(uuid,text,text) to authenticated;
