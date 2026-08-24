-- Warehouse-first inventory workflow. Existing ledger quantities are preserved.

alter type public.stock_txn_type add value if not exists 'opening_balance';

create table if not exists public.warehouse_inventory_initializations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  idempotency_key text not null,
  opened_on date not null,
  opened_by uuid not null references public.profiles(id) on delete restrict,
  row_count integer not null check (row_count > 0),
  created_at timestamptz not null default now(),
  unique (warehouse_id),
  unique (org_id, idempotency_key)
);

create table if not exists public.inventory_count_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  count_month date not null check (count_month = date_trunc('month', count_month)::date),
  counted_on date not null,
  status text not null default 'submitted' check (status in ('submitted','reviewed')),
  idempotency_key text not null,
  notes text,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  unique (org_id, warehouse_id, count_month),
  unique (org_id, idempotency_key)
);

alter table public.inventory_physical_counts
  add column if not exists session_id uuid references public.inventory_count_sessions(id) on delete restrict;

create index if not exists inventory_physical_counts_session_idx
  on public.inventory_physical_counts(session_id);

create table if not exists public.recurring_cost_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  category public.cost_entry_category not null,
  description text not null,
  default_amount numeric(14,2) not null check (default_amount > 0),
  supplier_name text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, warehouse_id, category, description)
);

-- Existing warehouses already have valid history. Mark them initialized without
-- creating or rewriting a single ledger quantity.
insert into public.warehouse_inventory_initializations(org_id,warehouse_id,idempotency_key,opened_on,opened_by,row_count)
select sl.org_id,sl.warehouse_id,'legacy-history:'||sl.warehouse_id::text,min(sl.transaction_date),actor.id,count(distinct sl.item_id)::integer
from public.stock_ledger sl
join lateral (
  select p.id from public.profiles p
  where p.org_id=sl.org_id and p.is_active and p.role in ('farm_manager','ceo')
  order by case when p.role='farm_manager' then 0 else 1 end,p.created_at
  limit 1
) actor on true
group by sl.org_id,sl.warehouse_id,actor.id
on conflict (warehouse_id) do nothing;

alter table public.cost_entries
  add column if not exists warehouse_id uuid references public.warehouses(id) on delete set null,
  add column if not exists recurring_template_id uuid references public.recurring_cost_templates(id) on delete set null,
  add column if not exists confirmation_month date;

alter table public.cost_entries
  drop constraint if exists cost_entries_confirmation_month_valid;
alter table public.cost_entries
  add constraint cost_entries_confirmation_month_valid check (
    confirmation_month is null or confirmation_month = date_trunc('month', confirmation_month)::date
  );

create unique index if not exists cost_entries_template_month_unique
  on public.cost_entries(org_id, recurring_template_id, confirmation_month)
  where recurring_template_id is not null and confirmation_month is not null;

create index if not exists cost_entries_warehouse_date_idx
  on public.cost_entries(org_id, warehouse_id, entry_date desc);

alter table public.warehouse_inventory_initializations enable row level security;
alter table public.inventory_count_sessions enable row level security;
alter table public.recurring_cost_templates enable row level security;

drop policy if exists warehouse_initializations_read on public.warehouse_inventory_initializations;
create policy warehouse_initializations_read on public.warehouse_inventory_initializations for select to authenticated using (
  public.reconciliation_warehouse_scope_allowed(org_id, warehouse_id)
);

drop policy if exists inventory_count_sessions_read on public.inventory_count_sessions;
create policy inventory_count_sessions_read on public.inventory_count_sessions for select to authenticated using (
  public.reconciliation_warehouse_scope_allowed(org_id, warehouse_id)
);

drop policy if exists recurring_cost_templates_read on public.recurring_cost_templates;
create policy recurring_cost_templates_read on public.recurring_cost_templates for select to authenticated using (
  public.reconciliation_warehouse_scope_allowed(org_id, warehouse_id)
);

revoke all on public.warehouse_inventory_initializations, public.inventory_count_sessions, public.recurring_cost_templates from anon, authenticated;
grant select on public.warehouse_inventory_initializations, public.inventory_count_sessions, public.recurring_cost_templates to authenticated;
grant all on public.warehouse_inventory_initializations, public.inventory_count_sessions, public.recurring_cost_templates to service_role;

create or replace function public.require_daily_record_routine_inventory()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_category text;
begin
  if new.source_kind <> 'daily_record_usage' then return new; end if;
  select category::text into v_category from public.inventory_items where id = new.item_id and org_id = new.org_id;
  if v_category not in ('vitamin','supplement','packaging','miscellaneous') then
    raise exception 'Daily Records may issue only vitamins, supplements, packaging, and general supplies.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists stock_ledger_daily_record_category on public.stock_ledger;
create trigger stock_ledger_daily_record_category
before insert or update of item_id, source_kind on public.stock_ledger
for each row execute function public.require_daily_record_routine_inventory();

create or replace function public.initialize_warehouse_inventory(
  p_actor_id uuid,
  p_warehouse_id uuid,
  p_opened_on date,
  p_rows jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid; v_role text; v_branch_id uuid; v_farm_id uuid; v_initialization_id uuid;
  v_row jsonb; v_item_id uuid; v_count integer := 0;
  v_name text; v_unit text; v_category public.inventory_category;
  v_quantity numeric; v_unit_cost numeric; v_reorder numeric;
begin
  select org_id, role::text into v_org_id, v_role from public.profiles where id = p_actor_id and is_active;
  if v_org_id is null or v_role <> 'farm_manager' then raise exception 'Only a Farm Manager can establish opening stock.' using errcode='42501'; end if;
  select branch_id, farm_id into v_branch_id, v_farm_id from public.warehouses
    where id=p_warehouse_id and org_id=v_org_id and status='active';
  if not found or not exists(select 1 from public.user_warehouse_access a where a.org_id=v_org_id and a.profile_id=p_actor_id and a.warehouse_id=p_warehouse_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())) then
    raise exception 'An active assignment to this warehouse is required.' using errcode='42501';
  end if;
  if nullif(btrim(p_idempotency_key),'') is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows)=0 then
    raise exception 'Opening stock rows and a request identity are required.' using errcode='22023';
  end if;
  select id into v_initialization_id from public.warehouse_inventory_initializations
    where org_id=v_org_id and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('initialization_id',v_initialization_id,'reused',true); end if;
  if exists(select 1 from public.warehouse_inventory_initializations where warehouse_id=p_warehouse_id)
     or exists(select 1 from public.stock_ledger where org_id=v_org_id and warehouse_id=p_warehouse_id) then
    raise exception 'Opening stock has already been established for this warehouse. Use Receive stock for later additions.' using errcode='23505';
  end if;

  insert into public.warehouse_inventory_initializations(org_id,warehouse_id,idempotency_key,opened_on,opened_by,row_count)
  values(v_org_id,p_warehouse_id,p_idempotency_key,p_opened_on,p_actor_id,jsonb_array_length(p_rows)) returning id into v_initialization_id;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_name:=btrim(v_row->>'name'); v_unit:=btrim(v_row->>'unit');
    v_category:=(v_row->>'category')::public.inventory_category;
    v_quantity:=(v_row->>'openingQuantity')::numeric; v_unit_cost:=(v_row->>'unitCost')::numeric; v_reorder:=(v_row->>'reorderLevel')::numeric;
    if length(v_name)<2 or length(v_unit)<1 or v_quantity<0 or v_unit_cost<0 or v_reorder<0 then
      raise exception 'Every opening row needs a valid item, unit, quantity, cost, and reorder level.' using errcode='22023';
    end if;
    select id into v_item_id from public.inventory_items where org_id=v_org_id and lower(name)=lower(v_name) limit 1;
    if v_item_id is null then
      insert into public.inventory_items(org_id,name,category,unit,reorder_level,unit_cost)
      values(v_org_id,v_name,v_category,v_unit,v_reorder,v_unit_cost) returning id into v_item_id;
    else
      update public.inventory_items set reorder_level=v_reorder, unit_cost=v_unit_cost, updated_at=now() where id=v_item_id;
    end if;
    insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date,branch_id,farm_id,recorded_by,source_kind,source_key,reference_doc,notes)
    values(v_org_id,v_item_id,p_warehouse_id,'opening_balance',v_quantity,v_unit_cost,p_opened_on,v_branch_id,v_farm_id,p_actor_id,'warehouse_opening_balance',v_initialization_id::text,'OPENING:'||v_initialization_id::text,'Opening stock established through guided setup');
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('initialization_id',v_initialization_id,'row_count',v_count,'reused',false);
end; $$;

create or replace function public.record_inventory_count_session(
  p_actor_id uuid,
  p_warehouse_id uuid,
  p_counted_on date,
  p_rows jsonb,
  p_notes text,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid; v_role text; v_session_id uuid; v_month date:=date_trunc('month',p_counted_on)::date;
  v_row jsonb; v_item_id uuid; v_counted numeric; v_ledger numeric; v_cost numeric; v_variances integer:=0; v_count integer:=0;
begin
  select org_id, role::text into v_org_id,v_role from public.profiles where id=p_actor_id and is_active;
  if v_org_id is null or v_role<>'farm_manager' then raise exception 'Only a Farm Manager can submit a shelf count.' using errcode='42501'; end if;
  if not exists(select 1 from public.user_warehouse_access a where a.org_id=v_org_id and a.profile_id=p_actor_id and a.warehouse_id=p_warehouse_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())) then raise exception 'An active warehouse assignment is required.' using errcode='42501'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or nullif(btrim(p_idempotency_key),'') is null then raise exception 'Count every stocked item before submitting.' using errcode='22023'; end if;
  select id into v_session_id from public.inventory_count_sessions where org_id=v_org_id and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('session_id',v_session_id,'reused',true); end if;
  insert into public.inventory_count_sessions(org_id,warehouse_id,count_month,counted_on,idempotency_key,notes,submitted_by)
  values(v_org_id,p_warehouse_id,v_month,p_counted_on,p_idempotency_key,nullif(btrim(p_notes),''),p_actor_id) returning id into v_session_id;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_item_id:=(v_row->>'itemId')::uuid; v_counted:=(v_row->>'countedQuantity')::numeric;
    if v_counted<0 then raise exception 'Counted quantities cannot be negative.' using errcode='22023'; end if;
    select coalesce(unit_cost,0) into v_cost from public.inventory_items where id=v_item_id and org_id=v_org_id;
    if not found then raise exception 'A counted item is outside this organization.' using errcode='22023'; end if;
    select coalesce(sum(public.stock_movement_delta(transaction_type,quantity)),0) into v_ledger from public.stock_ledger
      where org_id=v_org_id and warehouse_id=p_warehouse_id and item_id=v_item_id and transaction_date<=p_counted_on;
    insert into public.inventory_physical_counts(org_id,warehouse_id,item_id,count_date,ledger_quantity,counted_quantity,unit_cost,counted_by,notes,evidence,session_id)
    values(v_org_id,p_warehouse_id,v_item_id,p_counted_on,v_ledger,v_counted,v_cost,p_actor_id,nullif(btrim(p_notes),''),jsonb_build_array(jsonb_build_object('type','monthly_count_session','sessionId',v_session_id)),v_session_id);
    if v_ledger<>v_counted then v_variances:=v_variances+1; end if; v_count:=v_count+1;
  end loop;
  return jsonb_build_object('session_id',v_session_id,'row_count',v_count,'variance_count',v_variances,'reused',false);
end; $$;

create or replace function public.record_health_event_with_inventory(
  p_actor_id uuid, p_flock_id uuid, p_event_date date, p_event_type public.health_event_type,
  p_event jsonb, p_item_id uuid default null, p_warehouse_id uuid default null, p_quantity numeric default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid; v_role text; v_farm_id uuid; v_house_id uuid; v_batch_id uuid; v_branch_id uuid;
  v_event_id uuid; v_category text; v_cost numeric; v_available numeric;
begin
  select org_id,role::text into v_org_id,v_role from public.profiles where id=p_actor_id and is_active;
  if v_org_id is null or v_role<>'farm_manager' then raise exception 'Only a Farm Manager can record treatment usage.' using errcode='42501'; end if;
  select f.farm_id,f.house_id,f.batch_id,h.branch_id into v_farm_id,v_house_id,v_batch_id,v_branch_id from public.flocks f join public.houses h on h.id=f.house_id where f.id=p_flock_id and f.org_id=v_org_id;
  if not found or not exists(select 1 from public.user_farm_access a where a.org_id=v_org_id and a.profile_id=p_actor_id and a.farm_id=v_farm_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())) then raise exception 'An active farm assignment is required.' using errcode='42501'; end if;
  if exists(select 1 from public.farm_operating_days where farm_id=v_farm_id and operating_date=p_event_date and status='locked') then raise exception 'This operating day is locked.' using errcode='55000'; end if;
  if (p_item_id is null)<>(p_warehouse_id is null) or (p_item_id is null)<>(p_quantity is null) then raise exception 'Medicine item, warehouse, and quantity must be supplied together.' using errcode='22023'; end if;
  if p_item_id is not null then
    if p_event_type<>'treatment' or p_quantity<=0 then raise exception 'Inventory medicine can only be issued with a treatment and positive quantity.' using errcode='22023'; end if;
    if not exists(select 1 from public.user_warehouse_access a where a.org_id=v_org_id and a.profile_id=p_actor_id and a.warehouse_id=p_warehouse_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())) then raise exception 'An active warehouse assignment is required.' using errcode='42501'; end if;
    select category::text,coalesce(unit_cost,0) into v_category,v_cost from public.inventory_items where id=p_item_id and org_id=v_org_id;
    if v_category<>'medicine' then raise exception 'Treatments may issue medicine items only.' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_item_id::text||':'||p_warehouse_id::text,0));
    select coalesce(sum(public.stock_movement_delta(transaction_type,quantity)),0) into v_available from public.stock_ledger where org_id=v_org_id and item_id=p_item_id and warehouse_id=p_warehouse_id;
    if v_available<p_quantity then raise exception 'Insufficient medicine stock. Available quantity is %.',v_available using errcode='22023'; end if;
  end if;
  insert into public.health_events(org_id,flock_id,event_date,event_type,description,diagnosis,treatment,attachment_url,vet_id,external_veterinarian_name,veterinarian_recommendation,veterinarian_reference,veterinarian_attachment,recommendation_status)
  values(v_org_id,p_flock_id,p_event_date,p_event_type,nullif(btrim(p_event->>'description'),''),nullif(btrim(p_event->>'diagnosis'),''),nullif(btrim(p_event->>'treatment'),''),nullif(btrim(p_event->>'attachment_url'),''),p_actor_id,nullif(btrim(p_event->>'external_veterinarian_name'),''),nullif(btrim(p_event->>'veterinarian_recommendation'),''),nullif(btrim(p_event->>'veterinarian_reference'),''),case when nullif(btrim(p_event->>'attachment_url'),'') is null then null else jsonb_build_object('url',p_event->>'attachment_url') end,nullif(btrim(p_event->>'recommendation_status'),'')) returning id into v_event_id;
  if p_item_id is not null then
    insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,recorded_by,source_kind,source_key,reference_doc,notes)
    values(v_org_id,p_item_id,p_warehouse_id,'issue',p_quantity,v_cost,p_event_date,v_branch_id,v_farm_id,v_house_id,p_flock_id,v_batch_id,p_actor_id,'health_treatment',v_event_id::text,'TREATMENT:'||v_event_id::text,'Medicine administered with treatment record');
  end if;
  return jsonb_build_object('event_id',v_event_id,'stock_issued',coalesce(p_quantity,0));
end; $$;

create or replace function public.complete_vaccination_with_inventory(
  p_actor_id uuid, p_schedule_id uuid, p_item_id uuid, p_warehouse_id uuid, p_quantity numeric
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_org_id uuid; v_role text; v_flock_id uuid; v_event_date date; v_farm_id uuid; v_house_id uuid; v_batch_id uuid; v_branch_id uuid;
  v_category text; v_cost numeric; v_available numeric; v_status_id uuid;
begin
  select org_id,role::text into v_org_id,v_role from public.profiles where id=p_actor_id and is_active;
  if v_org_id is null or v_role<>'farm_manager' then raise exception 'Only a Farm Manager can complete vaccination.' using errcode='42501'; end if;
  select ve.flock_id,ve.event_date,f.farm_id,f.house_id,f.batch_id,h.branch_id into v_flock_id,v_event_date,v_farm_id,v_house_id,v_batch_id,v_branch_id
  from public.vaccination_events ve join public.flocks f on f.id=ve.flock_id join public.houses h on h.id=f.house_id
  where ve.id=p_schedule_id and ve.org_id=v_org_id;
  if not found
     or not exists(select 1 from public.user_farm_access a where a.org_id=v_org_id and a.profile_id=p_actor_id and a.farm_id=v_farm_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()))
     or not exists(select 1 from public.user_warehouse_access a where a.org_id=v_org_id and a.profile_id=p_actor_id and a.warehouse_id=p_warehouse_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()))
  then raise exception 'Active farm and warehouse assignments are required.' using errcode='42501'; end if;
  if exists(select 1 from public.farm_operating_days where farm_id=v_farm_id and operating_date=v_event_date and status='locked') then raise exception 'This operating day is locked.' using errcode='55000'; end if;
  if p_quantity<=0 then raise exception 'Administered vaccine quantity must be greater than zero.' using errcode='22023'; end if;
  select category::text,coalesce(unit_cost,0) into v_category,v_cost from public.inventory_items where id=p_item_id and org_id=v_org_id;
  if v_category<>'vaccine' then raise exception 'Vaccination completion accepts vaccine items only.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text||':'||p_warehouse_id::text,0));
  select coalesce(sum(public.stock_movement_delta(transaction_type,quantity)),0) into v_available from public.stock_ledger where org_id=v_org_id and item_id=p_item_id and warehouse_id=p_warehouse_id;
  if v_available<p_quantity then raise exception 'Insufficient vaccine stock. Available quantity is %.',v_available using errcode='22023'; end if;
  if exists(select 1 from public.stock_ledger where org_id=v_org_id and source_kind='vaccination_completion' and source_key=p_schedule_id::text) then return jsonb_build_object('schedule_id',p_schedule_id,'reused',true); end if;
  insert into public.health_events(org_id,flock_id,event_date,event_type,description,diagnosis,vet_id)
  values(v_org_id,v_flock_id,v_event_date,'observation','SCHEDULE_STATUS|'||p_schedule_id::text||'|completed|vaccination',null,p_actor_id) returning id into v_status_id;
  insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,recorded_by,source_kind,source_key,reference_doc,notes)
  values(v_org_id,p_item_id,p_warehouse_id,'issue',p_quantity,v_cost,v_event_date,v_branch_id,v_farm_id,v_house_id,v_flock_id,v_batch_id,p_actor_id,'vaccination_completion',p_schedule_id::text,'VACCINATION:'||p_schedule_id::text,'Vaccine administered on schedule completion');
  return jsonb_build_object('schedule_id',p_schedule_id,'status_event_id',v_status_id,'reused',false);
end; $$;

revoke all on function public.initialize_warehouse_inventory(uuid,uuid,date,jsonb,text) from public,anon,authenticated;
revoke all on function public.record_inventory_count_session(uuid,uuid,date,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.record_health_event_with_inventory(uuid,uuid,date,public.health_event_type,jsonb,uuid,uuid,numeric) from public,anon,authenticated;
revoke all on function public.complete_vaccination_with_inventory(uuid,uuid,uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function public.initialize_warehouse_inventory(uuid,uuid,date,jsonb,text) to service_role;
grant execute on function public.record_inventory_count_session(uuid,uuid,date,jsonb,text,text) to service_role;
grant execute on function public.record_health_event_with_inventory(uuid,uuid,date,public.health_event_type,jsonb,uuid,uuid,numeric) to service_role;
grant execute on function public.complete_vaccination_with_inventory(uuid,uuid,uuid,uuid,numeric) to service_role;

comment on table public.warehouse_inventory_initializations is 'One-time, idempotent opening-stock custody record for a warehouse.';
comment on table public.inventory_count_sessions is 'Monthly multi-item physical-count session. Counts never silently alter ledger balances.';
comment on table public.recurring_cost_templates is 'Suggested recurring costs. A template never posts a financial entry without monthly confirmation.';
