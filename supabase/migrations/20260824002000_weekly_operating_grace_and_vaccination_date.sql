-- Give operating teams a practical weekly entry window and distinguish a
-- vaccination's planned date from the date it was actually administered.

alter table public.organizations
  add column if not exists operational_day_lock_grace_days integer not null default 7;

alter table public.organizations
  drop constraint if exists organizations_operational_day_lock_grace_days_valid;

alter table public.organizations
  add constraint organizations_operational_day_lock_grace_days_valid
  check (operational_day_lock_grace_days between 1 and 31);

create or replace function public.lock_overdue_operating_days()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer;
begin
  insert into public.governance_scheduler_health(scheduler_key,last_started_at,updated_at)
  values('operating_day_lock',now(),now())
  on conflict(scheduler_key) do update
    set last_started_at=excluded.last_started_at,updated_at=now();

  insert into public.farm_operating_days(org_id,farm_id,operating_date,status,locked_at)
  select f.org_id,f.id,d::date,'locked',now()
  from public.farms f
  join public.organizations o on o.id=f.org_id
  cross join lateral generate_series(
    coalesce((select min(fl.placement_date) from public.flocks fl where fl.farm_id=f.id), (now() at time zone 'Africa/Addis_Ababa')::date),
    (now() at time zone 'Africa/Addis_Ababa')::date
      - case
          when (now() at time zone 'Africa/Addis_Ababa')::time >= o.operational_day_lock_time
            then o.operational_day_lock_grace_days
          else o.operational_day_lock_grace_days + 1
        end,
    interval '1 day'
  ) d
  on conflict(farm_id,operating_date) do update
    set status='locked',locked_at=coalesce(farm_operating_days.locked_at,now()),updated_at=now()
    where farm_operating_days.status='open';
  get diagnostics v_count=row_count;

  update public.governance_scheduler_health
  set last_completed_at=now(),last_locked_count=v_count,updated_at=now()
  where scheduler_key='operating_day_lock';
  return v_count;
end $$;

revoke all on function public.lock_overdue_operating_days() from public,authenticated;

-- Rows locked only by the old automatic one-day policy are reopened when they
-- now fall inside the weekly grace window. Explicitly closed days stay closed.
update public.farm_operating_days d
set status='open',locked_at=null,updated_at=now()
from public.organizations o
where o.id=d.org_id
  and d.status='locked'
  and d.closed_by is null
  and d.operating_date > (now() at time zone 'Africa/Addis_Ababa')::date
    - case
        when (now() at time zone 'Africa/Addis_Ababa')::time >= o.operational_day_lock_time
          then o.operational_day_lock_grace_days
        else o.operational_day_lock_grace_days + 1
      end;

create or replace function public.complete_vaccination_with_inventory(
  p_actor_id uuid,
  p_schedule_id uuid,
  p_item_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_administered_on date
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_flock_id uuid;
  v_scheduled_on date;
  v_farm_id uuid;
  v_house_id uuid;
  v_batch_id uuid;
  v_branch_id uuid;
  v_warehouse_branch_id uuid;
  v_warehouse_farm_id uuid;
  v_category text;
  v_cost numeric;
  v_available numeric;
  v_status_id uuid;
  v_existing_date date;
begin
  select org_id,role::text into v_org_id,v_role
  from public.profiles
  where id=p_actor_id and is_active;
  if v_org_id is null or v_role<>'farm_manager' then
    raise exception 'Only a Farm Manager can complete vaccination.' using errcode='42501';
  end if;
  if p_administered_on is null then
    raise exception 'The actual administration date is required.' using errcode='22023';
  end if;
  if p_administered_on>(now() at time zone 'Africa/Addis_Ababa')::date then
    raise exception 'The administration date cannot be in the future.' using errcode='22023';
  end if;

  select ve.flock_id,ve.event_date,f.farm_id,f.house_id,f.batch_id,h.branch_id
  into v_flock_id,v_scheduled_on,v_farm_id,v_house_id,v_batch_id,v_branch_id
  from public.vaccination_events ve
  join public.flocks f on f.id=ve.flock_id
  join public.houses h on h.id=f.house_id
  where ve.id=p_schedule_id and ve.org_id=v_org_id and ve.voided_at is null;
  if not found
     or not exists(
       select 1 from public.user_farm_access a
       where a.org_id=v_org_id and a.profile_id=p_actor_id and a.farm_id=v_farm_id
         and a.revoked_at is null and a.starts_at<=now()
         and (a.expires_at is null or a.expires_at>now())
     )
     or not exists(
       select 1 from public.user_warehouse_access a
       where a.org_id=v_org_id and a.profile_id=p_actor_id and a.warehouse_id=p_warehouse_id
         and a.revoked_at is null and a.starts_at<=now()
         and (a.expires_at is null or a.expires_at>now())
     )
  then
    raise exception 'Active farm and warehouse assignments are required.' using errcode='42501';
  end if;

  select branch_id,farm_id into v_warehouse_branch_id,v_warehouse_farm_id
  from public.warehouses
  where id=p_warehouse_id and org_id=v_org_id and status='active';
  if not found
     or v_warehouse_branch_id<>v_branch_id
     or (v_warehouse_farm_id is not null and v_warehouse_farm_id<>v_farm_id)
  then
    raise exception 'Choose an active warehouse serving this flock''s farm or branch.' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('vaccination:'||p_schedule_id::text,0));
  select transaction_date into v_existing_date
  from public.stock_ledger
  where org_id=v_org_id and source_kind='vaccination_completion' and source_key=p_schedule_id::text
  order by created_at
  limit 1;
  if found then
    return jsonb_build_object(
      'schedule_id',p_schedule_id,
      'scheduled_on',v_scheduled_on,
      'administered_on',v_existing_date,
      'reused',true
    );
  end if;

  if exists(
    select 1 from public.farm_operating_days
    where farm_id=v_farm_id and operating_date=p_administered_on and status='locked'
  ) then
    raise exception 'The actual administration date is outside the seven-day entry window and is locked. Use today for work performed today, or submit a governed correction for historical work.' using errcode='55000';
  end if;
  if p_quantity is null or p_quantity<=0 then
    raise exception 'Administered vaccine quantity must be greater than zero.' using errcode='22023';
  end if;
  select category::text,coalesce(unit_cost,0) into v_category,v_cost
  from public.inventory_items
  where id=p_item_id and org_id=v_org_id;
  if not found or v_category<>'vaccine' then
    raise exception 'Vaccination completion accepts vaccine items only.' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text||':'||p_warehouse_id::text,0));
  select coalesce(sum(public.stock_movement_delta(transaction_type,quantity)),0) into v_available
  from public.stock_ledger
  where org_id=v_org_id and item_id=p_item_id and warehouse_id=p_warehouse_id;
  if v_available<p_quantity then
    raise exception 'Insufficient vaccine stock. Available quantity is %.',v_available using errcode='22023';
  end if;

  insert into public.health_events(org_id,flock_id,event_date,event_type,description,diagnosis,vet_id)
  values(v_org_id,v_flock_id,p_administered_on,'observation','SCHEDULE_STATUS|'||p_schedule_id::text||'|completed|vaccination',null,p_actor_id)
  returning id into v_status_id;
  insert into public.stock_ledger(org_id,item_id,warehouse_id,transaction_type,quantity,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,recorded_by,source_kind,source_key,reference_doc,notes)
  values(v_org_id,p_item_id,p_warehouse_id,'issue',p_quantity,v_cost,p_administered_on,v_branch_id,v_farm_id,v_house_id,v_flock_id,v_batch_id,p_actor_id,'vaccination_completion',p_schedule_id::text,'VACCINATION:'||p_schedule_id::text,'Vaccine administered; planned date '||v_scheduled_on::text);

  return jsonb_build_object(
    'schedule_id',p_schedule_id,
    'status_event_id',v_status_id,
    'scheduled_on',v_scheduled_on,
    'administered_on',p_administered_on,
    'reused',false
  );
end $$;

revoke all on function public.complete_vaccination_with_inventory(uuid,uuid,uuid,uuid,numeric,date)
  from public,anon,authenticated;
grant execute on function public.complete_vaccination_with_inventory(uuid,uuid,uuid,uuid,numeric,date)
  to service_role;

comment on column public.organizations.operational_day_lock_grace_days is
  'Number of operational dates kept editable before the Addis Ababa lock cutoff. Default is seven.';
