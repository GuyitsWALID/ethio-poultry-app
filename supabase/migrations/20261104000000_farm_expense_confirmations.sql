-- Extend the existing expense ledger; no historical costs or receipt quantities change.
alter table public.recurring_cost_templates alter column warehouse_id drop not null;
alter table public.recurring_cost_templates add column farm_id uuid references public.farms(id);
alter table public.recurring_cost_templates add constraint recurring_cost_scope check(warehouse_id is not null or farm_id is not null);
create unique index recurring_farm_cost_name on public.recurring_cost_templates(org_id,farm_id,category,description) where warehouse_id is null;
alter table public.cost_entries add column expense_request_id uuid, add column expense_request_hash text;
create unique index expense_request_once on public.cost_entries(org_id,recorded_by,expense_request_id) where expense_request_id is not null;
drop policy recurring_cost_templates_read on public.recurring_cost_templates;
create policy recurring_cost_templates_read on public.recurring_cost_templates for select to authenticated using(
 org_id=public.current_org_id() and (public.current_active_role()='ceo' or public.has_active_break_glass(org_id)
 or (warehouse_id is not null and public.has_active_warehouse_access(warehouse_id))
 or (warehouse_id is null and public.current_active_role()='farm_manager' and public.has_active_farm_access(farm_id))));

create function public.record_operational_expense(p_actor uuid,p_org uuid,p_date date,p_payload jsonb,p_request uuid)
returns public.cost_entries language plpgsql security definer set search_path=public as $$
declare actor public.profiles; c public.cost_entries; existing public.cost_entries; t public.recurring_cost_templates;
 farm uuid:=nullif(p_payload->>'farm_id','')::uuid; warehouse uuid:=nullif(p_payload->>'warehouse_id','')::uuid;
 house uuid:=nullif(p_payload->>'house_id','')::uuid; flock uuid:=nullif(p_payload->>'flock_id','')::uuid; batch uuid:=nullif(p_payload->>'batch_id','')::uuid;
 branch uuid; w public.warehouses; f public.flocks; amount_value numeric:=(p_payload->>'amount')::numeric;
 template_id uuid:=nullif(p_payload->>'recurring_template_id','')::uuid; billing date; fingerprint text; support boolean:=false;
 kind text:=coalesce(nullif(p_payload->>'entry_kind',''),'one_off'); category_value public.cost_entry_category:=(p_payload->>'category')::public.cost_entry_category;
 description_value text:=btrim(p_payload->>'description'); allocation text:=coalesce(nullif(p_payload->>'allocation_method',''),'direct');
begin
 select * into actor from public.profiles where id=p_actor and is_active for share;
 if not found or p_request is null or (auth.uid() is not null and auth.uid()<>p_actor) then raise exception 'Active Farm Manager required.' using errcode='42501'; end if;
 if actor.role::text='system_admin' then
  perform 1 from public.break_glass_sessions where administrator_id=p_actor and target_org_id=p_org and revoked_at is null and started_at<=now() and expires_at>now() for share;
  support:=found;
 end if;
 if not support and (actor.org_id<>p_org or actor.role::text<>'farm_manager') then raise exception 'Active Farm Manager required.' using errcode='42501'; end if;
 if flock is not null then
  select * into f from public.flocks where id=flock and org_id=p_org;
  if not found or (farm is not null and farm<>f.farm_id) or (house is not null and house<>f.house_id) or (batch is not null and batch is distinct from f.batch_id) then raise exception 'Expense scope does not match the flock.' using errcode='23514';end if;
  farm:=f.farm_id;house:=f.house_id;batch:=f.batch_id;
 end if;
 if warehouse is not null then
  select * into w from public.warehouses where id=warehouse and org_id=p_org and status='active' for share;
  if not found or (not support and not public.manager_has_effective_warehouse_access(p_actor,warehouse)) then raise exception 'Farm access or explicit shared-store permission required.' using errcode='42501';end if;
  if w.farm_id is not null then
   if farm is not null and farm<>w.farm_id then raise exception 'Expense farm does not match the warehouse.' using errcode='23514';end if;
   farm:=w.farm_id;
  end if;
  branch:=w.branch_id;
 end if;
 if farm is not null then
  select branch_id into branch from public.farms where id=farm and org_id=p_org;
  if not found then raise exception 'Farm unavailable.' using errcode='42501';end if;
  if not support then
   perform 1 from public.user_farm_access where org_id=p_org and profile_id=p_actor and farm_id=farm and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()) for share;
   if not found then raise exception 'Active farm assignment required.' using errcode='42501';end if;
  end if;
 elsif warehouse is null then raise exception 'Choose an assigned farm or warehouse.' using errcode='23514';end if;
 if house is not null and not exists(select 1 from public.houses where id=house and org_id=p_org and farm_id=farm) then raise exception 'House does not match the expense farm.' using errcode='23514';end if;
 if batch is not null and not exists(select 1 from public.batches where id=batch and org_id=p_org and farm_id=farm and (house is null or house_id=house)) then raise exception 'Batch does not match the expense scope.' using errcode='23514';end if;
 if nullif(p_payload->>'branch_id','')::uuid is not null and (p_payload->>'branch_id')::uuid<>branch then raise exception 'Branch does not match the expense scope.' using errcode='23514';end if;
 if warehouse is not null and w.branch_id<>branch then raise exception 'Warehouse and farm must belong to the same branch.' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended('expense-request:'||p_request::text,0));
 fingerprint:=md5(jsonb_build_array(p_org,p_date,p_payload)::text);
 select * into c from public.cost_entries where org_id=p_org and recorded_by=p_actor and expense_request_id=p_request;
 if found then
  if c.expense_request_hash is distinct from fingerprint then raise exception 'Request ID already used with different expense evidence.' using errcode='40001';end if;
  return c;
 end if;
 if amount_value is null or amount_value not between 0.01 and 999999999999.99 or amount_value<>round(amount_value,2)
  or length(coalesce(description_value,'')) not between 1 and 2000 or kind not in ('monthly','one_off')
  or allocation not in ('direct','bird_count','egg_count','feed_consumption','manual_percent') then raise exception 'Enter valid expense fields and money with at most two decimals.' using errcode='23514';end if;
 if p_date is null or p_date>(now() at time zone 'Africa/Addis_Ababa')::date or p_date<(now() at time zone 'Africa/Addis_Ababa')::date-6
  or exists(select 1 from public.farm_operating_days where farm_id=farm and operating_date=p_date and status in ('closed','locked')) then
  raise exception 'Expense date is outside the open operating window. Use an exact governed correction.' using errcode='55000';end if;
 if template_id is not null or coalesce((p_payload->>'remember_template')::boolean,false) then
  if kind<>'monthly' or flock is not null or house is not null or batch is not null then raise exception 'Monthly templates use farm or warehouse scope, not a flock cycle.' using errcode='23514';end if;
  if template_id is null then
   perform pg_advisory_xact_lock(hashtextextended('expense-template:'||coalesce(warehouse,farm)::text||':'||category_value::text||':'||description_value,0));
   select id into template_id from public.recurring_cost_templates where org_id=p_org and category=category_value and description=description_value
    and warehouse_id is not distinct from warehouse and (warehouse is not null or farm_id=farm);
   if template_id is null then
    insert into public.recurring_cost_templates(org_id,farm_id,warehouse_id,category,description,default_amount,supplier_name,created_by)
    values(p_org,case when warehouse is null then farm else null end,warehouse,category_value,description_value,amount_value,nullif(p_payload->>'supplier_name',''),p_actor) returning id into template_id;
   end if;
  end if;
  select * into t from public.recurring_cost_templates where id=template_id and org_id=p_org and is_active for share;
  if not found or t.warehouse_id is distinct from warehouse or (warehouse is null and t.farm_id is distinct from farm) or t.category<>category_value or t.description<>description_value then
   raise exception 'Monthly template changed or does not match this scope. Refresh and review.' using errcode='40001';end if;
  billing:=date_trunc('month',p_date)::date;
  perform pg_advisory_xact_lock(hashtextextended('expense-month:'||template_id::text||':'||billing::text,0));
  select * into existing from public.cost_entries where org_id=p_org and recurring_template_id=template_id and confirmation_month=billing;
  if found then
   if to_jsonb(existing)->>'voided_at' is not null or existing.amount<>amount_value or existing.farm_id is distinct from farm
    or existing.category<>category_value or existing.description<>description_value or existing.entry_kind<>'monthly'
    or existing.allocation_method::text<>allocation or existing.supplier_name is distinct from nullif(p_payload->>'supplier_name','')
    or existing.warehouse_id is distinct from warehouse or existing.invoice_number is distinct from nullif(p_payload->>'invoice_number','')
    or existing.reference_doc is distinct from nullif(p_payload->>'reference_doc','') then raise exception 'This month is already confirmed with different evidence. Review its exact expense.' using errcode='40001';end if;
   return existing;
  end if;
 end if;
 insert into public.cost_entries(org_id,branch_id,farm_id,house_id,flock_id,batch_id,warehouse_id,entry_date,entry_kind,category,description,amount,allocation_method,
  supplier_name,invoice_number,reference_doc,recurring_template_id,confirmation_month,recorded_by,expense_request_id,expense_request_hash)
 values(p_org,branch,farm,house,flock,batch,warehouse,p_date,kind,category_value,description_value,amount_value,allocation::public.cost_allocation_method,
  nullif(p_payload->>'supplier_name',''),nullif(p_payload->>'invoice_number',''),nullif(p_payload->>'reference_doc',''),template_id,billing,p_actor,p_request,fingerprint) returning * into c;
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
 values(p_org,p_actor,actor.role::text,'cost_entry.recorded','cost_entries',c.id::text,description_value,to_jsonb(c));
 return c;
end $$;
revoke all on function public.record_operational_expense(uuid,uuid,date,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.record_operational_expense(uuid,uuid,date,jsonb,uuid) to service_role;

-- Today and retained expense entry share one authoritative transaction.
do $$declare definition text;first_pos integer;last_pos integer;begin
 select pg_get_functiondef('public.execute_today_command_v1(uuid,jsonb)'::regprocedure) into definition;
 first_pos:=position('  elsif v_command_type = ''record_expense'' then' in definition);
 last_pos:=position('  elsif v_command_type = ''update_assigned_action'' then' in definition);
 if first_pos=0 or last_pos<=first_pos then raise exception 'Expense dispatcher seam changed. Review migration.';end if;
 definition:=substring(definition from 1 for first_pos-1)||$patch$  elsif v_command_type = 'record_expense' then
    select id into v_row_id from public.record_operational_expense(p_actor_id,v_org_id,v_work_date,
      v_payload||jsonb_build_object('farm_id',v_farm_id,'house_id',v_house_id,'flock_id',v_flock_id,'batch_id',v_batch_id),v_command_id);
    v_domain_result:=jsonb_build_object('cost_entry_id',v_row_id);
    v_source_ref:='cost_entries/'||v_row_id::text;

$patch$||substring(definition from last_pos);
 execute definition;
end $$;
-- Keep the existing receipt operation and its stock guards; bind replay to the
-- original evidence and put its explicit audit in the same transaction.
alter function public.receive_inventory_stock(uuid,uuid,uuid,jsonb,numeric,numeric,date,public.procurement_type,text,text,text,text) rename to receive_inventory_stock_before_expense_workspace;
create function public.receive_inventory_stock(p_actor_id uuid,p_warehouse_id uuid,p_item_id uuid,p_new_item jsonb,p_quantity numeric,p_unit_cost numeric,
 p_transaction_date date,p_procurement_type public.procurement_type,p_supplier_name text,p_invoice_number text,p_notes text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; movement public.stock_ledger;begin
 perform pg_advisory_xact_lock(hashtextextended('receipt:'||p_warehouse_id::text||':'||p_idempotency_key,0));
 result:=public.receive_inventory_stock_before_expense_workspace(p_actor_id,p_warehouse_id,p_item_id,p_new_item,p_quantity,p_unit_cost,p_transaction_date,p_procurement_type,p_supplier_name,p_invoice_number,p_notes,p_idempotency_key);
 select * into movement from public.stock_ledger where id=(result->>'movement_id')::uuid;
 if movement.quantity is distinct from p_quantity or movement.unit_cost is distinct from p_unit_cost
  or movement.transaction_date::date is distinct from p_transaction_date
  or movement.procurement_type is distinct from p_procurement_type
  or movement.supplier_name is distinct from nullif(btrim(p_supplier_name),'') or movement.invoice_number is distinct from nullif(btrim(p_invoice_number),'')
  or movement.notes is distinct from nullif(btrim(p_notes),'') or p_item_id is not null and movement.item_id<>p_item_id
  or p_new_item is not null and not exists(select 1 from public.inventory_items i where i.id=movement.item_id and i.name=btrim(p_new_item->>'name')
    and i.category::text=p_new_item->>'category' and i.unit=btrim(p_new_item->>'unit')) then
  raise exception 'Receipt request ID already used with different evidence. Review the original receipt.' using errcode='40001';end if;
 if not coalesce((result->>'reused')::boolean,false) then
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
   select movement.org_id,p_actor_id,p.role::text,'inventory.stock.received','stock_ledger',movement.id::text,'Received purchased stock; no duplicate expense created.',to_jsonb(movement) from public.profiles p where p.id=p_actor_id;
 end if;
 return result;
end $$;
revoke all on function public.receive_inventory_stock(uuid,uuid,uuid,jsonb,numeric,numeric,date,public.procurement_type,text,text,text,text) from public,anon,authenticated;
grant execute on function public.receive_inventory_stock(uuid,uuid,uuid,jsonb,numeric,numeric,date,public.procurement_type,text,text,text,text) to service_role;
notify pgrst,'reload schema';
