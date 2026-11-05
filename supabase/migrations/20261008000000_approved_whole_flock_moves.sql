-- Exceptional moves retain the canonical batch and original arrival evidence.
-- Every move is whole-flock, CEO-reviewed, revision-bound and append-only.
alter table public.flock_transfers add column moved_at timestamptz,
  add column bird_count integer check (bird_count>0);
create trigger immutable_approved_movement before update or delete on public.flock_transfers
for each row execute function public.reject_lifecycle_evidence_edit();
revoke insert,update,delete on public.flock_transfers from authenticated,anon;
drop policy if exists flock_transfers_org_access on public.flock_transfers;
create policy approved_movement_read on public.flock_transfers for select to authenticated using (
  (org_id=public.current_org_id() and (public.current_active_role()='ceo' or
    (public.current_active_role()='farm_manager' and exists(select 1 from public.flocks f where f.id=flock_id and public.has_active_farm_access(f.farm_id)))))
  or public.has_active_break_glass(org_id));

create function public.lifecycle_flock_revision(p_org uuid,p_flock uuid) returns text
language sql stable security definer set search_path=public,extensions as $$
  select encode(extensions.digest(jsonb_build_object(
    'flock',(select to_jsonb(f) from public.flocks f where f.org_id=p_org and f.id=p_flock),
    'moves',(select coalesce(jsonb_agg(to_jsonb(m) order by m.moved_at,m.id),'[]') from public.flock_transfers m where m.org_id=p_org and m.flock_id=p_flock)
  )::text,'sha256'),'hex')
$$;

create function public.valid_flock_movement_chain(p_org uuid,p_flock uuid) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare f public.flocks; b public.batches; m public.flock_transfers; r public.governance_requests;
  v_house uuid; v_time timestamptz;
begin
  select * into f from public.flocks where id=p_flock and org_id=p_org;
  if not found then return false; end if;
  select * into b from public.batches where id=f.batch_id and org_id=p_org;
  if not found or b.total_count<>f.initial_count or b.placement_date<>f.placement_date then return false; end if;
  if not exists(select 1 from public.houses h where h.id=b.house_id and h.org_id=p_org and h.farm_id=b.farm_id) then return false; end if;
  v_house:=b.house_id; v_time:=coalesce(f.placed_at,f.placement_date::timestamp at time zone 'Africa/Addis_Ababa');
  for m in select * from public.flock_transfers where flock_id=f.id and org_id=p_org order by moved_at nulls first,id loop
    select * into r from public.governance_requests where id=m.governance_request_id and org_id=p_org;
    if not found or r.status<>'applied' or r.request_type<>'flock_transfer' or r.source_id<>f.id
      or m.from_house_id<>v_house or m.to_house_id=m.from_house_id or m.moved_at is null or m.moved_at<=v_time
      or m.bird_count is null or (r.proposed_values->>'bird_count')::integer<>m.bird_count
      or (r.proposed_values->>'house_id')::uuid<>m.to_house_id
      or (r.proposed_values->>'moved_at')::timestamptz<>m.moved_at then return false; end if;
    v_house:=m.to_house_id; v_time:=m.moved_at;
  end loop;
  return f.house_id=v_house and exists(select 1 from public.houses h where h.id=v_house and h.org_id=p_org and h.farm_id=f.farm_id);
end $$;

create function public.assert_lifecycle_house_available(p_org uuid,p_farm uuid,p_house uuid,p_arrival timestamptz,p_exclude uuid default null) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.houses where id=p_house and org_id=p_org and farm_id=p_farm for update;
  if not found then raise exception 'The destination house does not belong to this farm.' using errcode='42501'; end if;
  if exists(select 1 from public.flocks f left join public.batches b on b.id=f.batch_id left join public.batch_cycles c on c.id=b.batch_cycle_id
    where f.org_id=p_org and f.id is distinct from p_exclude
      and (f.house_id=p_house or exists(select 1 from public.flock_transfers m where m.flock_id=f.id and m.from_house_id=p_house))
      and (f.status in ('active','quarantined') or c.id is null or not c.completion_verified or c.completed_at>=p_arrival)) then
    raise exception 'This house is occupied or its previous cycle has not finished before arrival.' using errcode='23514'; end if;
  if p_arrival is null or p_arrival>now() then raise exception 'Record the actual arrival time, not a future arrival.' using errcode='23514'; end if;
end $$;

create or replace function public.guard_house_occupancy_v1() returns trigger language plpgsql security definer set search_path=public as $$
declare v_arrival timestamptz;
begin
  if new.status not in ('active','quarantined') then return new; end if;
  if tg_op='UPDATE' and new.house_id=old.house_id and new.farm_id=old.farm_id and old.status in ('active','quarantined') then return new; end if;
  -- Legacy day-only fixtures/imports may enter an empty house. Midnight is a
  -- conservative ordering bound, not stored placement evidence; same-day
  -- turnover still needs the explicit timestamp in the approved adapter.
  v_arrival:=coalesce(new.placed_at,new.placement_date::timestamp at time zone 'Africa/Addis_Ababa');
  if tg_op='UPDATE' and new.house_id<>old.house_id then
    if coalesce(current_setting('app.lifecycle_apply',true),'false')<>'true' then
      raise exception 'Moving a flock requires exact CEO authorization.' using errcode='42501'; end if;
    v_arrival:=nullif(current_setting('app.lifecycle_moved_at',true),'')::timestamptz;
  end if;
  perform public.assert_lifecycle_house_available(new.org_id,new.farm_id,new.house_id,v_arrival,new.id);
  if new.placement_date>(now() at time zone 'Africa/Addis_Ababa')::date then raise exception 'Future arrivals cannot be activated as already placed.' using errcode='23514'; end if;
  return new;
end $$;

create function public.validate_whole_flock_move(p_request public.governance_requests,p_lock boolean) returns public.flocks
language plpgsql security definer set search_path=public as $$
declare f public.flocks; h public.houses; p jsonb:=p_request.proposed_values; v_time timestamptz; v_previous timestamptz;
begin
  -- Lock both houses in deterministic order before the flock, matching placement.
  if p_lock then
    perform 1 from public.houses where org_id=p_request.org_id and id in ((p->>'from_house_id')::uuid,(p->>'house_id')::uuid) order by id for update;
    select * into f from public.flocks where id=p_request.source_id and org_id=p_request.org_id for update;
  else select * into f from public.flocks where id=p_request.source_id and org_id=p_request.org_id; end if;
  if p_request.source_table is distinct from 'flocks' or f.id is null or f.status not in ('active','quarantined') or f.completed_at is not null or f.current_count<=0
    or f.farm_id is distinct from p_request.farm_id or f.house_id is distinct from (p->>'from_house_id')::uuid
    or f.id is distinct from (p->>'flock_id')::uuid or f.current_count is distinct from (p->>'bird_count')::integer then
    raise exception 'Move the entire current flock; refresh changed bird counts or location.' using errcode='40001'; end if;
  if not exists(select 1 from public.batches b join public.batch_cycles c on c.id=b.batch_cycle_id where b.id=f.batch_id and c.status='active')
    or not public.valid_flock_movement_chain(f.org_id,f.id) then raise exception 'The original cycle membership or movement chain needs reviewed correction.' using errcode='23514'; end if;
  select * into h from public.houses where id=(p->>'house_id')::uuid and org_id=p_request.org_id and farm_id=(p->>'farm_id')::uuid;
  if not found or h.id=f.house_id then raise exception 'Select a different authorized destination house.' using errcode='23514'; end if;
  if public.current_active_role()='farm_manager' and (not public.has_active_farm_access(f.farm_id) or not public.has_active_farm_access(h.farm_id)) then
    raise exception 'Active assignment to both source and destination farms is required.' using errcode='42501'; end if;
  if p->>'expected_revision' is distinct from public.lifecycle_flock_revision(f.org_id,f.id)
    or p->>'destination_revision' is distinct from public.lifecycle_house_revision(f.org_id,h.id) then
    raise exception 'The flock or destination changed. Request fresh CEO review.' using errcode='40001'; end if;
  v_time:=(p->>'moved_at')::timestamptz;
  select max(moved_at) into v_previous from public.flock_transfers where org_id=f.org_id and flock_id=f.id;
  if v_time is null or v_time<=coalesce(v_previous,f.placed_at,f.placement_date::timestamp at time zone 'Africa/Addis_Ababa') then
    raise exception 'Actual movement must follow placement and previous movements.' using errcode='23514'; end if;
  perform public.assert_lifecycle_house_available(f.org_id,h.farm_id,h.id,v_time,f.id);
  return f;
end $$;

alter function public.apply_governance_request(uuid) rename to apply_governance_request_pre_moves;
revoke all on function public.apply_governance_request_pre_moves(uuid) from public,anon,authenticated,service_role;
create function public.apply_governance_request(p_request_id uuid) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare r public.governance_requests; f public.flocks; v_before jsonb; v_after jsonb; v_move uuid;
  v_flag text; v_apply text; v_time_flag text;
begin
  if public.current_active_role()<>'farm_manager' then raise exception 'Only an assigned Farm Manager can apply an approved change.' using errcode='42501'; end if;
  select * into r from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
  if r.request_type<>'flock_transfer' then return public.apply_governance_request_pre_moves(p_request_id); end if;
  if not public.has_active_farm_access(r.farm_id) or not public.has_active_farm_access((r.proposed_values->>'farm_id')::uuid) then
    raise exception 'Active assignment to both source and destination farms is required.' using errcode='42501'; end if;
  if r.status='applied' then return r; end if;
  if r.status<>'approved' or r.approval_expires_at is null or r.approval_expires_at<=now() or r.decided_at is null
    or not exists(select 1 from public.profiles where id=r.decided_by and org_id=r.org_id and role::text='ceo' and is_active) then
    raise exception 'This CEO authorization is no longer available.' using errcode='40001'; end if;
  f:=public.validate_whole_flock_move(r,true); v_before:=to_jsonb(f);
  v_flag:=current_setting('app.lifecycle_apply',true); v_apply:=current_setting('app.governance_apply',true); v_time_flag:=current_setting('app.lifecycle_moved_at',true);
  perform set_config('app.lifecycle_apply','true',true); perform set_config('app.governance_apply','true',true); perform set_config('app.lifecycle_moved_at',r.proposed_values->>'moved_at',true);
  insert into public.flock_transfers(org_id,flock_id,from_house_id,to_house_id,transfer_date,moved_at,bird_count,reason,governance_request_id)
  values(r.org_id,f.id,f.house_id,(r.proposed_values->>'house_id')::uuid,((r.proposed_values->>'moved_at')::timestamptz at time zone 'Africa/Addis_Ababa')::date,
    (r.proposed_values->>'moved_at')::timestamptz,f.current_count,r.reason,r.id) returning id into v_move;
  update public.flocks set farm_id=(r.proposed_values->>'farm_id')::uuid,house_id=(r.proposed_values->>'house_id')::uuid,updated_at=now()
    where id=f.id returning to_jsonb(flocks.*) into v_after;
  perform public.append_lifecycle_change(r,'flocks',f.id,v_before,v_after,array['farm_id','house_id']);
  select to_jsonb(m) into v_after from public.flock_transfers m where id=v_move;
  perform public.append_lifecycle_change(r,'flock_transfers',v_move,'{}',v_after,array['approved_whole_flock_movement']);
  perform set_config('app.lifecycle_apply',coalesce(v_flag,''),true); perform set_config('app.governance_apply',coalesce(v_apply,''),true); perform set_config('app.lifecycle_moved_at',coalesce(v_time_flag,''),true);
  update public.governance_requests set status='applied',applied_by=auth.uid(),applied_at=now(),updated_at=now() where id=r.id returning * into r;
  insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note)
    select r.org_id,r.id,'applied',auth.uid(),coalesce(full_name,'Farm Manager'),'farm_manager','Applied the exact whole-flock movement.' from public.profiles where id=auth.uid();
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
    values(r.org_id,auth.uid(),'farm_manager','governance_request.applied','governance_requests',r.id::text,r.reason,to_jsonb(r));
  return r;
end $$;
revoke all on function public.apply_governance_request(uuid) from public,anon;
grant execute on function public.apply_governance_request(uuid) to authenticated;

alter function public.decide_governance_request(uuid,text,text) rename to decide_governance_request_pre_moves;
revoke all on function public.decide_governance_request_pre_moves(uuid,text,text) from public,anon,authenticated,service_role;
create function public.decide_governance_request(p_request_id uuid,p_decision text,p_note text) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare r public.governance_requests;
begin
  if public.current_active_role()<>'ceo' then raise exception 'Only the organization CEO can decide governance requests.' using errcode='42501'; end if;
  select * into r from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
  if r.request_type='flock_transfer' and p_decision='approved' then perform public.validate_whole_flock_move(r,false); end if;
  return public.decide_governance_request_pre_moves(p_request_id,p_decision,p_note);
end $$;
revoke all on function public.decide_governance_request(uuid,text,text) from public,anon;
grant execute on function public.decide_governance_request(uuid,text,text) to authenticated;

create function public.verified_flock_movements(p_org uuid) returns table(flock_id uuid)
language sql stable security definer set search_path=public as $$
  select f.id from public.flocks f where f.org_id=p_org and public.valid_flock_movement_chain(p_org,f.id) limit 10001
$$;
do $$ declare s text; begin
  foreach s in array array['lifecycle_flock_revision(uuid,uuid)','valid_flock_movement_chain(uuid,uuid)','assert_lifecycle_house_available(uuid,uuid,uuid,timestamptz,uuid)','validate_whole_flock_move(public.governance_requests,boolean)','verified_flock_movements(uuid)'] loop
    execute 'revoke all on function public.'||s||' from public,anon,authenticated';
  end loop;
end $$;
grant execute on function public.lifecycle_flock_revision(uuid,uuid),public.verified_flock_movements(uuid),public.valid_flock_movement_chain(uuid,uuid) to service_role;
update public.governance_requests set status='returned',returned_at=now(),approval_expires_at=null,
  decision_note='Refresh the entire flock count, actual movement time, original cycle and empty destination, then request CEO review again.',updated_at=now()
where request_type='flock_transfer' and status in ('pending','approved') and
  not (proposed_values ?& array['flock_id','from_house_id','bird_count','moved_at','expected_revision','destination_revision']);

-- Completion must follow the actual movement chain, not only original arrival.
-- Patch the single authoritative closure implementation, failing if its seam
-- changes instead of silently installing a second set of closure rules.
do $$ declare definition text; anchor text := 'if v_flock.status not in (''active'',''quarantined'') then'; begin
  select pg_get_functiondef('public.apply_batch_cycle_close_v1(public.governance_requests)'::regprocedure) into definition;
  if position(anchor in definition)=0 then raise exception 'Cycle closure validation seam changed; review before migration.'; end if;
  execute replace(definition,anchor,
    'if not public.valid_flock_movement_chain(p_request.org_id,v_flock.id) or exists(select 1 from public.flock_transfers m where m.flock_id=v_flock.id and m.moved_at>=v_time) then raise exception ''Cycle completion must follow its verified whole-flock movement chain.'' using errcode=''23514''; end if; '||anchor);
end $$;
