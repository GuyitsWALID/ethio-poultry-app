-- Exact Record Check resolution, explicit exception disposition, and governed legacy egg custody.

alter table public.operational_action_events drop constraint if exists operational_action_events_event_type_check;
alter table public.operational_action_events add constraint operational_action_events_event_type_check check(event_type in ('discovered','assigned','claimed','acknowledged','work_started','resolution_submitted','verification_failed','system_verified','escalated','reopened','due_date_changed','exception_accepted'));

alter table public.governance_requests drop constraint if exists governance_requests_request_type_check;
alter table public.governance_requests add constraint governance_requests_request_type_check check(request_type in ('batch_create','batch_archive','flock_place','flock_transfer','flock_close','flock_archive','feed_template','breed_target','health_schedule','warning_threshold','locked_correction','void_record','egg_opening_balance','sales_unit_conversion'));

create table if not exists public.egg_custody_opening_balances(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete restrict,
  flock_id uuid not null references public.flocks(id) on delete restrict,
  effective_date date not null,
  quantity numeric not null check(quantity>=0),
  reason text not null check(length(trim(reason))>=8),
  source_reference text not null check(length(trim(source_reference))>=3),
  governance_request_id uuid not null unique references public.governance_requests(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid not null references public.profiles(id) on delete restrict,
  applied_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(org_id,flock_id)
);

alter table public.egg_custody_opening_balances enable row level security;
create policy egg_custody_opening_balances_read_scope on public.egg_custody_opening_balances for select to authenticated using(
  org_id=public.current_org_id() and (public.current_active_role()='ceo' or public.has_active_farm_access(farm_id) or public.has_active_break_glass(org_id))
);
revoke insert,update,delete on public.egg_custody_opening_balances from anon,authenticated;
grant select on public.egg_custody_opening_balances to authenticated;

create or replace function public.prevent_egg_opening_balance_change() returns trigger language plpgsql as $$
begin raise exception 'Opening egg custody evidence is append-only.' using errcode='42501'; end $$;
drop trigger if exists egg_opening_balances_append_only on public.egg_custody_opening_balances;
create trigger egg_opening_balances_append_only before update or delete on public.egg_custody_opening_balances for each row execute function public.prevent_egg_opening_balance_change();

create or replace function public.apply_egg_opening_balance_request(p_request_id uuid) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare v_row public.governance_requests; v_role text; v_name text; v_flock public.flocks; v_first_date date; v_balance_id uuid;
begin
  v_role:=public.current_active_role();
  if v_role<>'farm_manager' then raise exception 'Only an assigned Farm Manager can apply an approved opening balance.' using errcode='42501'; end if;
  select * into v_row from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found or v_row.request_type<>'egg_opening_balance' then raise exception 'Opening balance request not found.' using errcode='P0002'; end if;
  if v_row.status<>'approved' then raise exception 'This authorization is no longer available.' using errcode='40001'; end if;
  if v_row.approval_expires_at<=now() then update public.governance_requests set status='expired',updated_at=now() where id=v_row.id returning * into v_row; return v_row; end if;
  select * into v_flock from public.flocks where id=(v_row.proposed_values->>'flock_id')::uuid and org_id=v_row.org_id;
  if not found or v_flock.farm_id<>v_row.farm_id then raise exception 'Approved flock scope is invalid.' using errcode='23514'; end if;
  if not public.has_active_farm_access(v_flock.farm_id) then raise exception 'An active assignment to the affected farm is required.' using errcode='42501'; end if;
  select min(record_date) into v_first_date from public.daily_farm_records where org_id=v_row.org_id and flock_id=v_flock.id and voided_at is null;
  if v_first_date is null or (v_row.proposed_values->>'effective_date')::date>=v_first_date then raise exception 'The opening balance must predate the first reliable Daily Record.' using errcode='23514'; end if;
  insert into public.egg_custody_opening_balances(org_id,farm_id,flock_id,effective_date,quantity,reason,source_reference,governance_request_id,requested_by,approved_by,applied_by)
  values(v_row.org_id,v_flock.farm_id,v_flock.id,(v_row.proposed_values->>'effective_date')::date,(v_row.proposed_values->>'quantity')::numeric,v_row.reason,v_row.proposed_values->>'source_reference',v_row.id,v_row.requested_by,v_row.decided_by,auth.uid());
  select id into v_balance_id from public.egg_custody_opening_balances where governance_request_id=v_row.id;
  update public.governance_requests set status='applied',source_table='egg_custody_opening_balances',source_id=v_balance_id,applied_at=now(),applied_by=auth.uid(),updated_at=now() where id=v_row.id returning * into v_row;
  select coalesce(full_name,'Farm Manager') into v_name from public.profiles where id=auth.uid();
  insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note) values(v_row.org_id,v_row.id,'applied',auth.uid(),v_name,v_role,'Applied the CEO-authorized legacy opening egg balance.');
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values) values(v_row.org_id,auth.uid(),v_role,'governance_request.applied','governance_requests',v_row.id::text,'Applied the legacy egg custody evidence.',to_jsonb(v_row));
  return v_row;
end $$;

grant execute on function public.apply_egg_opening_balance_request(uuid) to authenticated;

create or replace function public.apply_sales_unit_conversion_request(p_request_id uuid) returns public.governance_requests
language plpgsql security definer set search_path=public as $$
declare v_row public.governance_requests; v_role text; v_name text; v_conversion_id uuid; v_category text; v_unit text; v_multiplier numeric;
begin
  v_role:=public.current_active_role();
  if v_role<>'farm_manager' then raise exception 'Only an assigned Farm Manager can apply an approved sales conversion.' using errcode='42501'; end if;
  select * into v_row from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found or v_row.request_type<>'sales_unit_conversion' then raise exception 'Sales conversion request not found.' using errcode='P0002'; end if;
  if v_row.status<>'approved' then raise exception 'This authorization is no longer available.' using errcode='40001'; end if;
  if v_row.approval_expires_at<=now() then update public.governance_requests set status='expired',updated_at=now() where id=v_row.id returning * into v_row; return v_row; end if;
  if v_row.farm_id is not null and not public.has_active_farm_access(v_row.farm_id) then raise exception 'An active assignment to the affected farm is required.' using errcode='42501'; end if;
  v_category:=lower(trim(v_row.proposed_values->>'category')); v_unit:=lower(trim(v_row.proposed_values->>'unit')); v_multiplier:=(v_row.proposed_values->>'multiplier')::numeric;
  if v_category<>'egg' or length(v_unit)<1 or v_multiplier<=0 or length(trim(coalesce(v_row.proposed_values->>'source_reference','')))<3 then raise exception 'A supported egg unit, positive multiplier, and evidence reference are required.' using errcode='23514'; end if;
  insert into public.sales_unit_conversions(org_id,product_category,unit,base_unit,multiplier,source,updated_by)
  values(v_row.org_id,v_category,v_unit,'egg',v_multiplier,'organization',auth.uid())
  on conflict(org_id,product_category,unit) do update set multiplier=excluded.multiplier,source='organization',updated_by=auth.uid(),updated_at=now()
  returning id into v_conversion_id;
  update public.governance_requests set status='applied',source_table='sales_unit_conversions',source_id=v_conversion_id,applied_at=now(),applied_by=auth.uid(),updated_at=now() where id=v_row.id returning * into v_row;
  select coalesce(full_name,'Farm Manager') into v_name from public.profiles where id=auth.uid();
  insert into public.governance_request_activity(org_id,request_id,action,actor_id,actor_name_snapshot,actor_role_snapshot,note) values(v_row.org_id,v_row.id,'applied',auth.uid(),v_name,v_role,'Applied the CEO-authorized sales unit conversion.');
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values) values(v_row.org_id,auth.uid(),v_role,'governance_request.applied','governance_requests',v_row.id::text,'Applied the approved sales unit conversion.',to_jsonb(v_row));
  return v_row;
end $$;

grant execute on function public.apply_sales_unit_conversion_request(uuid) to authenticated;

create or replace function public.accept_reconciliation_exception(p_finding_id uuid,p_note text,p_evidence jsonb) returns public.reconciliation_findings
language plpgsql security definer set search_path=public as $$
declare v_finding public.reconciliation_findings; v_action public.operational_actions; v_name text; v_now timestamptz:=now();
begin
  if public.current_active_role()<>'ceo' then raise exception 'Only the organization CEO can approve an exception.' using errcode='42501'; end if;
  if length(trim(coalesce(p_note,'')))<8 or jsonb_typeof(p_evidence)<>'array' or jsonb_array_length(p_evidence)<1 then raise exception 'A clear reason and supporting reference are required.' using errcode='22023'; end if;
  select * into v_finding from public.reconciliation_findings where id=p_finding_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Record Check not found.' using errcode='P0002'; end if;
  if v_finding.status not in ('open','acknowledged','investigating') then raise exception 'Only an active Record Check can be accepted as an exception.' using errcode='40001'; end if;
  update public.reconciliation_findings set status='accepted_exception',resolved_by=auth.uid(),resolved_at=v_now,resolution_note=trim(p_note),resolution_evidence=p_evidence,updated_at=v_now where id=v_finding.id returning * into v_finding;
  insert into public.reconciliation_finding_responses(org_id,finding_id,action,note,evidence,actor_id,actor_role) values(v_finding.org_id,v_finding.id,'accept_exception',trim(p_note),p_evidence,auth.uid(),'ceo');
  select coalesce(full_name,'CEO') into v_name from public.profiles where id=auth.uid();
  select * into v_action from public.operational_actions where org_id=v_finding.org_id and source_key='reconciliation-'||v_finding.id::text for update;
  if found and v_action.status<>'resolved' then
    update public.operational_actions set status='resolved',source_resolved_at=v_now,resolution_summary=trim(p_note),updated_at=v_now where id=v_action.id;
    insert into public.operational_action_events(org_id,action_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,note,before_status,after_status)
    values(v_finding.org_id,v_action.id,'exception_accepted',auth.uid(),v_name,'ceo',trim(p_note),v_action.status,'resolved');
  end if;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values,metadata)
  values(v_finding.org_id,auth.uid(),'ceo','reconciliation.accept_exception','reconciliation_findings',v_finding.id::text,trim(p_note),to_jsonb(v_finding),jsonb_build_object('supportingEvidence',p_evidence,'linkedActionId',v_action.id));
  return v_finding;
end $$;

grant execute on function public.accept_reconciliation_exception(uuid,text,jsonb) to authenticated;
comment on table public.egg_custody_opening_balances is 'Permanent CEO-approved starting evidence for legacy flock egg custody; never substitutes for new-flock Daily Records.';
