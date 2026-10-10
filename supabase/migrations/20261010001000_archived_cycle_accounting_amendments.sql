-- Review a complete replacement of physical allocation evidence, not a rewrite
-- of the original closure. Money, stock and sale quantities never change here.
create table public.batch_cycle_accounting_amendments (
 id bigint generated always as identity primary key,
 org_id uuid not null references public.organizations(id),
 cycle_id uuid not null references public.batch_cycles(id),
 correction_id uuid not null unique references public.batch_cycle_corrections(id),
 departures jsonb not null check(jsonb_typeof(departures)='array'),
 created_at timestamptz not null default now()
);
alter table public.batch_cycle_accounting_amendments enable row level security;
revoke all on public.batch_cycle_accounting_amendments from public,anon,authenticated;
grant select on public.batch_cycle_accounting_amendments to authenticated;
grant all on public.batch_cycle_accounting_amendments to service_role;
create policy accounting_amendments_read on public.batch_cycle_accounting_amendments for select to authenticated using (
 org_id=public.current_org_id() and (public.current_active_role()='ceo' or (public.current_active_role()='farm_manager' and
 exists(select 1 from public.batch_cycles c where c.id=cycle_id and public.has_active_farm_access(c.farm_id)))));
create trigger immutable_accounting_amendment before update or delete on public.batch_cycle_accounting_amendments
 for each row execute function public.reject_lifecycle_evidence_edit();

create view public.effective_cycle_dispositions with (security_invoker=true) as
 with latest as (select distinct on (cycle_id) * from public.batch_cycle_accounting_amendments order by cycle_id,id desc)
 select d.org_id,e.flock_id,c.cycle_id,d.kind,d.quantity,d.sale_id,d.reason,d.supporting_reference
 from public.batch_cycle_dispositions d join public.batch_cycle_clearances e on e.id=d.clearance_id
 join public.batch_cycle_closures c on c.id=e.closure_id
 where not exists(select 1 from latest a where a.cycle_id=c.cycle_id)
 union all
 select a.org_id,(x->>'flock_id')::uuid,a.cycle_id,x->>'kind',(x->>'quantity')::integer,
   (x->>'sale_id')::uuid,x->>'reason',x->>'supporting_reference'
 from latest a cross join lateral jsonb_array_elements(a.departures) x;
grant select on public.effective_cycle_dispositions to authenticated,service_role;

create view public.effective_cycle_clearances with (security_invoker=true) as
 select e.id,e.org_id,e.closure_id,e.flock_id,e.house_id,e.daily_record_id,
 case when exists(select 1 from public.batch_cycle_accounting_amendments a where a.cycle_id=c.cycle_id)
   then coalesce((select sum(d.quantity)::integer from public.effective_cycle_dispositions d where d.cycle_id=c.cycle_id and d.flock_id=e.flock_id),0)
   else e.before_clearance_birds end as before_clearance_birds,e.source_snapshot,e.created_at
 from public.batch_cycle_clearances e join public.batch_cycle_closures c on c.id=e.closure_id;
grant select on public.effective_cycle_clearances to authenticated,service_role;
create trigger cleared_cull_history before insert or update or delete on public.flock_cull_events
 for each row execute function public.guard_cleared_bird_history_v1();

create function public.archived_cycle_sale_choices(p_org uuid,p_cycle uuid)
returns table(id uuid,label text,unit text,head_count integer,revision text)
language sql stable security definer set search_path=public as $$
 select s.id,s.product_label||' · '||s.sale_date::text||' · '||s.quantity::text||' '||s.unit,s.unit,a.head_count,public.lifecycle_sale_revision(s.id,p_org)
 from public.daily_sales_records s left join public.bird_sale_head_count_attestations a on a.sale_id=s.id
 where s.org_id=p_org and s.product_category='bird' and s.voided_at is null
 and exists(select 1 from public.flocks f join public.batches b on b.id=f.batch_id where b.batch_cycle_id=p_cycle and f.org_id=p_org and f.farm_id=s.farm_id
   and s.sale_date between f.placement_date and (f.completed_at at time zone 'Africa/Addis_Ababa')::date)
 order by s.sale_date desc,s.id limit 501
$$;
revoke all on function public.archived_cycle_sale_choices(uuid,uuid) from public,anon,authenticated;
grant execute on function public.archived_cycle_sale_choices(uuid,uuid) to service_role;

create function public.validate_archived_accounting(r public.governance_requests) returns void
language plpgsql security definer set search_path=public as $$
#variable_conflict use_column
declare x jsonb; y jsonb; d public.daily_farm_records; s public.daily_sales_records; f public.flocks;
 capacity bigint; used bigint; cycle uuid:=(r.proposed_values->>'cycle_id')::uuid;
begin
 -- Same cycle lock as the historical validator and closure keeps concurrent
 -- amendments serialized. Shared sales are locked in deterministic order.
 perform 1 from public.batch_cycles where id=cycle and org_id=r.org_id for update;
 if r.proposed_values ? 'loss_events' then
  if jsonb_typeof(r.proposed_values->'loss_events') is distinct from 'array' or jsonb_array_length(r.proposed_values->'loss_events')>1000
   or (select count(distinct value->>'id') from jsonb_array_elements(r.proposed_values->'loss_events'))<>jsonb_array_length(r.proposed_values->'loss_events') then
    raise exception 'Review every loss event once.' using errcode='22023'; end if;
  for x in select value from jsonb_array_elements(r.proposed_values->'loss_events') loop
   if not (x ?& array['id','record_id','kind','count','explanation']) or (select count(*) from jsonb_object_keys(x))<>5
    or x->>'kind' not in ('death','cull') or jsonb_typeof(x->'count')<>'number' or x->>'count' !~ '^[0-9]+$'
    or (x->>'count')::numeric>2147483647 or length(btrim(coalesce(x->>'explanation','')))<3 then
     raise exception 'Each loss event needs exact quantity, type and explanation.' using errcode='22023'; end if;
   select * into d from public.daily_farm_records where id=(x->>'record_id')::uuid and org_id=r.org_id;
   if not found or not exists(select 1 from jsonb_array_elements(r.proposed_values->'records') z where z->>'id'=d.id::text) then
     raise exception 'Loss events must belong to a reviewed Daily Record.' using errcode='42501'; end if;
   -- IDs cannot be reassigned across records, types or tenants.
   if exists(select 1 from public.mortality_events m where m.id=(x->>'id')::uuid and
      (m.org_id<>r.org_id or m.flock_id<>d.flock_id or m.record_date<>d.record_date or x->>'kind'<>'death')) or
      exists(select 1 from public.flock_cull_events m where m.id=(x->>'id')::uuid and
      (m.org_id<>r.org_id or m.flock_id<>d.flock_id or m.record_date<>d.record_date or x->>'kind'<>'cull')) then
     raise exception 'A loss event cannot move to another source.' using errcode='42501'; end if;
  end loop;
  for y in select value from jsonb_array_elements(r.proposed_values->'records') loop
   select * into d from public.daily_farm_records where id=(y->>'id')::uuid and org_id=r.org_id;
   if exists(select 1 from public.mortality_events m where m.org_id=r.org_id and m.flock_id=d.flock_id and m.record_date=d.record_date
       and not exists(select 1 from jsonb_array_elements(r.proposed_values->'loss_events') z where z->>'id'=m.id::text and z->>'kind'='death')) or
      exists(select 1 from public.flock_cull_events m where m.org_id=r.org_id and m.flock_id=d.flock_id and m.record_date=d.record_date
       and not exists(select 1 from jsonb_array_elements(r.proposed_values->'loss_events') z where z->>'id'=m.id::text and z->>'kind'='cull')) then
     raise exception 'Include every existing loss event; use zero to explicitly remove an incorrect event.' using errcode='23514'; end if;
   if (select coalesce(sum((z->>'count')::bigint),0) from jsonb_array_elements(r.proposed_values->'loss_events') z where z->>'record_id'=d.id::text and z->>'kind'='death')<>(y->>'deaths')::bigint or
      (select coalesce(sum((z->>'count')::bigint),0) from jsonb_array_elements(r.proposed_values->'loss_events') z where z->>'record_id'=d.id::text and z->>'kind'='cull')<>(y->>'culls')::bigint then
     raise exception 'Death and cull events must exactly match the proposed Daily Record.' using errcode='23514'; end if;
  end loop;
 end if;
 if r.proposed_values ? 'departures' then
  if jsonb_typeof(r.proposed_values->'departures') is distinct from 'array' or jsonb_array_length(r.proposed_values->'departures')>500 then
   raise exception 'Review the complete cycle departure list.' using errcode='22023'; end if;
  if exists(select 1 from public.batch_cycle_clearances e join public.batch_cycle_closures c on c.id=e.closure_id where c.cycle_id=cycle
    and not exists(select 1 from jsonb_array_elements(r.proposed_values->'records') z where z->>'id'=e.daily_record_id::text)) then
   raise exception 'Physical accounting changes require every member final Daily Record in the approval.' using errcode='23514'; end if;
  perform 1 from public.daily_sales_records where id in (select (z->>'sale_id')::uuid from jsonb_array_elements(r.proposed_values->'departures') z where z->>'kind'='sale') order by id for update;
  for x in select value from jsonb_array_elements(r.proposed_values->'departures') loop
   select f.* into f from public.flocks f join public.batches b on b.id=f.batch_id where f.id=(x->>'flock_id')::uuid and b.batch_cycle_id=cycle and f.org_id=r.org_id;
   if not found or jsonb_typeof(x->'quantity')<>'number' or x->>'quantity' !~ '^[0-9]+$' or (x->>'quantity')::numeric not between 1 and 2147483647 then
    raise exception 'Every departure needs an authorized member and a positive whole bird count.' using errcode='23514'; end if;
   if x->>'kind'='other' then
    if length(btrim(coalesce(x->>'reason','')))<8 or length(btrim(coalesce(x->>'supporting_reference','')))<3 or x->>'sale_id' is not null then
     raise exception 'Other departures need their reason and supporting evidence.' using errcode='23514'; end if;
   elsif x->>'kind'='sale' then
    select * into s from public.daily_sales_records where id=(x->>'sale_id')::uuid and org_id=r.org_id and voided_at is null;
    if not found or s.product_category<>'bird' or s.farm_id is distinct from f.farm_id or s.sale_date<f.placement_date or s.sale_date>(f.completed_at at time zone 'Africa/Addis_Ababa')::date
      or (s.flock_id is not null and s.flock_id<>f.id) or (s.batch_id is not null and s.batch_id<>f.batch_id)
      or (s.house_id is not null and s.house_id<>f.house_id) then
      raise exception 'Select an authorized non-voided bird sale for this completed flock.' using errcode='42501'; end if;
    if x->>'sale_revision' is distinct from public.lifecycle_sale_revision(s.id,r.org_id) then raise exception 'Sale evidence changed. Request approval again.' using errcode='40001'; end if;
    if lower(btrim(s.unit))='bird' then
      if s.quantity<>trunc(s.quantity) or s.quantity<1 then raise exception 'Bird sales require whole head counts.' using errcode='23514'; end if;
      capacity:=s.quantity;
    else
      select head_count into capacity from public.bird_sale_head_count_attestations where sale_id=s.id and org_id=r.org_id;
      if not found then
       if x->>'physical_head_count' !~ '^[0-9]+$' or coalesce((x->>'physical_head_count')::bigint,0)<1 or length(btrim(coalesce(x->>'supporting_reference','')))<3 then
        raise exception 'Non-bird units need approved physical head-count evidence. Never infer birds from kilograms.' using errcode='23514'; end if;
       capacity:=(x->>'physical_head_count')::bigint;
       if (select count(distinct z->>'physical_head_count') from jsonb_array_elements(r.proposed_values->'departures') z where z->>'sale_id'=s.id::text)>1 then
        raise exception 'All allocations of one sale must use the same approved physical head count.' using errcode='23514'; end if;
      elsif x->>'physical_head_count' is not null and (x->>'physical_head_count')::bigint<>capacity then
       raise exception 'Existing head-count capacity cannot be silently replaced.' using errcode='23514'; end if;
    end if;
    select coalesce(sum(quantity),0) into used from public.effective_cycle_dispositions where sale_id=s.id and cycle_id<>cycle;
    used:=used+(select coalesce(sum((z->>'quantity')::bigint),0) from jsonb_array_elements(r.proposed_values->'departures') z where z->>'kind'='sale' and z->>'sale_id'=s.id::text);
    if used>capacity then raise exception 'Sale head-count capacity is already allocated.' using errcode='23514'; end if;
   else raise exception 'Choose a sale or an evidenced other departure.' using errcode='22023'; end if;
  end loop;
 end if;
end $$;

create function public.apply_archived_loss_events(r public.governance_requests) returns void
language plpgsql security definer set search_path=public as $$
declare x jsonb; d public.daily_farm_records; before_row jsonb; after_row jsonb;
begin
 if not (r.proposed_values ? 'loss_events') then return; end if;
 for x in select value from jsonb_array_elements(r.proposed_values->'loss_events') order by value->>'id' loop
  select * into d from public.daily_farm_records where id=(x->>'record_id')::uuid;
  if x->>'kind'='death' then
   select to_jsonb(m) into before_row from public.mortality_events m where id=(x->>'id')::uuid;
   if (x->>'count')::integer=0 then
    delete from public.mortality_events where id=(x->>'id')::uuid; after_row:='{}';
   elsif before_row is not null then
    update public.mortality_events set count=(x->>'count')::integer,cause=x->>'explanation',updated_at=clock_timestamp() where id=(x->>'id')::uuid returning to_jsonb(mortality_events.*) into after_row;
   else
    insert into public.mortality_events(id,org_id,flock_id,record_date,cause,count,observed_by) values((x->>'id')::uuid,r.org_id,d.flock_id,d.record_date,x->>'explanation',(x->>'count')::integer,auth.uid()) returning to_jsonb(mortality_events.*) into after_row;
   end if;
  else
   select to_jsonb(m) into before_row from public.flock_cull_events m where id=(x->>'id')::uuid;
   if (x->>'count')::integer=0 then
    delete from public.flock_cull_events where id=(x->>'id')::uuid; after_row:='{}';
   elsif before_row is not null then
    update public.flock_cull_events set count=(x->>'count')::integer,reason=x->>'explanation' where id=(x->>'id')::uuid returning to_jsonb(flock_cull_events.*) into after_row;
   else
    insert into public.flock_cull_events(id,org_id,flock_id,record_date,reason,count,observed_by) values((x->>'id')::uuid,r.org_id,d.flock_id,d.record_date,x->>'explanation',(x->>'count')::integer,auth.uid()) returning to_jsonb(flock_cull_events.*) into after_row;
   end if;
  end if;
  perform public.append_lifecycle_change(r,case when x->>'kind'='death' then 'mortality_events' else 'flock_cull_events' end,(x->>'id')::uuid,coalesce(before_row,'{}'),after_row,array['count','explanation']);
 end loop;
end $$;

-- Extend the reviewed adapter at explicit, checked seams. Existing narrow
-- proposals retain their old behavior and cannot bypass these new validators.
do $$ declare definition text; anchor text; begin
 select pg_get_functiondef('public.validate_archived_cycle_correction(public.governance_requests)'::regprocedure) into definition;
 anchor:='if jsonb_typeof(r.proposed_values->''records'')';
 if position(anchor in definition)=0 then raise exception 'Archived validator seam changed'; end if;
 definition:=replace(definition,anchor,'perform public.validate_archived_accounting(r); '||anchor);
 definition:=replace(definition,'select * into e from public.batch_cycle_clearances','select * into e from public.effective_cycle_clearances');
 anchor:='e.before_clearance_birds) then';
 if position(anchor in definition)=0 then raise exception 'Final accounting seam changed'; end if;
 definition:=replace(definition,anchor,'case when r.proposed_values ? ''departures'' then (select coalesce(sum((z->>''quantity'')::bigint),0) from jsonb_array_elements(r.proposed_values->''departures'') z where z->>''flock_id''=f.id::text) else e.before_clearance_birds end) then');
 definition:=replace(definition,'is distinct from d.deaths and exists','is distinct from d.deaths and not (r.proposed_values ? ''loss_events'') and exists');
 definition:=replace(definition,'is distinct from d.culls and exists','is distinct from d.culls and not (r.proposed_values ? ''loss_events'') and exists');
 execute definition;
 select pg_get_functiondef('public.apply_governance_request(uuid)'::regprocedure) into definition;
 anchor:='for x in select value from jsonb_array_elements(r.proposed_values->''records'')';
 if position(anchor in definition)=0 then raise exception 'Archived apply seam changed'; end if;
 definition:=replace(definition,anchor,'perform public.apply_archived_loss_events(r); '||anchor);
 -- Append the effective replacement only after the immutable amendment exists.
 anchor:='perform set_config(''app.lifecycle_apply'',coalesce(flag,''''),true);';
 if position(anchor in definition)=0 then raise exception 'Archived receipt seam changed'; end if;
 definition:=replace(definition,anchor,'perform public.append_archived_accounting(r); '||anchor);
 execute definition;
 -- New closures must honor released/reassigned allocations, never sum original
 -- historical allocations as though amended allocations were still current.
 select pg_get_functiondef('public.apply_batch_cycle_close_v1(public.governance_requests)'::regprocedure) into definition;
 anchor:='from public.batch_cycle_dispositions where sale_id=v_sale.id';
 if position(anchor in definition)=0 then raise exception 'Sale allocation seam changed'; end if;
 execute replace(definition,anchor,'from public.effective_cycle_dispositions where sale_id=v_sale.id');
end $$;

create function public.append_archived_accounting(r public.governance_requests) returns void
language plpgsql security definer set search_path=public as $$
declare x jsonb;
begin
 if not (r.proposed_values ? 'departures') then return; end if;
 for x in select value from jsonb_array_elements(r.proposed_values->'departures') where value->>'kind'='sale' loop
  if lower(btrim((select unit from public.daily_sales_records where id=(x->>'sale_id')::uuid)))<>'bird'
    and not exists(select 1 from public.bird_sale_head_count_attestations where sale_id=(x->>'sale_id')::uuid) then
   insert into public.bird_sale_head_count_attestations(sale_id,org_id,request_id,head_count,supporting_reference,source_revision)
   values((x->>'sale_id')::uuid,r.org_id,r.id,(x->>'physical_head_count')::integer,x->>'supporting_reference',x->>'sale_revision') on conflict(sale_id) do nothing;
  end if;
 end loop;
 insert into public.batch_cycle_accounting_amendments(org_id,cycle_id,correction_id,departures)
 select r.org_id,(r.proposed_values->>'cycle_id')::uuid,id,r.proposed_values->'departures' from public.batch_cycle_corrections where request_id=r.id;
end $$;

-- Newly allocated sales need the same source protection as original sales.
do $$ declare definition text; anchor text:='exists(select 1 from public.batch_cycle_dispositions where sale_id=old.id)'; begin
 select pg_get_functiondef('public.protect_cycle_closure_sources_v1()'::regprocedure) into definition;
 if position(anchor in definition)=0 then raise exception 'Sale protection seam changed'; end if;
 execute replace(definition,anchor,'(exists(select 1 from public.batch_cycle_dispositions where sale_id=old.id) or exists(select 1 from public.effective_cycle_dispositions where sale_id=old.id))');
end $$;
revoke all on function public.validate_archived_accounting(public.governance_requests),public.apply_archived_loss_events(public.governance_requests),public.append_archived_accounting(public.governance_requests) from public,anon,authenticated,service_role;
