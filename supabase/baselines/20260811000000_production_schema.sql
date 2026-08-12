


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."account_type" AS ENUM (
    'asset',
    'liability',
    'equity',
    'revenue',
    'expense'
);


ALTER TYPE "public"."account_type" OWNER TO "postgres";


CREATE TYPE "public"."alert_category" AS ENUM (
    'mortality',
    'inventory',
    'financial',
    'environmental',
    'health'
);


ALTER TYPE "public"."alert_category" OWNER TO "postgres";


CREATE TYPE "public"."alert_priority" AS ENUM (
    'info',
    'low',
    'medium',
    'high',
    'emergency'
);


ALTER TYPE "public"."alert_priority" OWNER TO "postgres";


CREATE TYPE "public"."alert_status" AS ENUM (
    'open',
    'acknowledged',
    'resolved'
);


ALTER TYPE "public"."alert_status" OWNER TO "postgres";


CREATE TYPE "public"."cost_allocation_method" AS ENUM (
    'direct',
    'bird_count',
    'egg_count',
    'feed_consumption',
    'manual_percent'
);


ALTER TYPE "public"."cost_allocation_method" OWNER TO "postgres";


CREATE TYPE "public"."cost_entry_category" AS ENUM (
    'feed',
    'medicine',
    'vaccine',
    'vitamin',
    'supplement',
    'payroll',
    'utility',
    'biosecurity',
    'transport',
    'maintenance',
    'labor',
    'rent',
    'packaging',
    'miscellaneous'
);


ALTER TYPE "public"."cost_entry_category" OWNER TO "postgres";


CREATE TYPE "public"."feed_type" AS ENUM (
    'starter_feed',
    'grower_pullet_feed',
    'layer_feed',
    'broiler_feed',
    'medicated_feed'
);


ALTER TYPE "public"."feed_type" OWNER TO "postgres";


CREATE TYPE "public"."flock_source" AS ENUM (
    'internal_transfer',
    'external_purchase'
);


ALTER TYPE "public"."flock_source" OWNER TO "postgres";


CREATE TYPE "public"."flock_status" AS ENUM (
    'active',
    'transferred',
    'sold',
    'culled',
    'quarantined',
    'archived'
);


ALTER TYPE "public"."flock_status" OWNER TO "postgres";


CREATE TYPE "public"."flock_type" AS ENUM (
    'layer',
    'rearing',
    'parent_stock',
    'broiler'
);


ALTER TYPE "public"."flock_type" OWNER TO "postgres";


CREATE TYPE "public"."health_event_type" AS ENUM (
    'disease',
    'treatment',
    'observation'
);


ALTER TYPE "public"."health_event_type" OWNER TO "postgres";


CREATE TYPE "public"."house_type" AS ENUM (
    'layer',
    'rearing',
    'parent_stock',
    'broiler'
);


ALTER TYPE "public"."house_type" OWNER TO "postgres";


CREATE TYPE "public"."inventory_category" AS ENUM (
    'feed',
    'medicine',
    'vaccine',
    'vitamin',
    'equipment',
    'spare_parts',
    'packaging',
    'supplement',
    'miscellaneous'
);


ALTER TYPE "public"."inventory_category" OWNER TO "postgres";


CREATE TYPE "public"."lead_activity_type" AS ENUM (
    'call',
    'visit',
    'message',
    'email',
    'note'
);


ALTER TYPE "public"."lead_activity_type" OWNER TO "postgres";


CREATE TYPE "public"."lead_source" AS ENUM (
    'telegram',
    'facebook',
    'walk_in',
    'training',
    'referral',
    'other'
);


ALTER TYPE "public"."lead_source" OWNER TO "postgres";


CREATE TYPE "public"."lead_stage" AS ENUM (
    'new',
    'contacted',
    'training_registered',
    'training_completed',
    'proposal_sent',
    'proforma_issued',
    'deposit_received',
    'prep',
    'final_payment',
    'delivery_scheduled',
    'delivered',
    'follow_up',
    'closed',
    'lost'
);


ALTER TYPE "public"."lead_stage" OWNER TO "postgres";


CREATE TYPE "public"."monthly_cost_status" AS ENUM (
    'draft',
    'locked'
);


ALTER TYPE "public"."monthly_cost_status" OWNER TO "postgres";


CREATE TYPE "public"."package_item_type" AS ENUM (
    'chick',
    'feed',
    'medicine',
    'equipment',
    'service'
);


ALTER TYPE "public"."package_item_type" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'cash',
    'bank_transfer',
    'cheque',
    'mobile_money'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'partial',
    'paid'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_type" AS ENUM (
    'deposit_50',
    'final_50',
    'full',
    'partial'
);


ALTER TYPE "public"."payment_type" OWNER TO "postgres";


CREATE TYPE "public"."pos_payment_method" AS ENUM (
    'cash',
    'bank_transfer',
    'mobile_money'
);


ALTER TYPE "public"."pos_payment_method" OWNER TO "postgres";


CREATE TYPE "public"."procurement_type" AS ENUM (
    'monthly',
    'emergency',
    'miscellaneous'
);


ALTER TYPE "public"."procurement_type" OWNER TO "postgres";


CREATE TYPE "public"."sales_order_status" AS ENUM (
    'draft',
    'proforma_sent',
    'deposit_paid',
    'in_preparation',
    'ready',
    'delivered',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."sales_order_status" OWNER TO "postgres";


CREATE TYPE "public"."sensor_type" AS ENUM (
    'temperature',
    'humidity',
    'ammonia',
    'water_flow'
);


ALTER TYPE "public"."sensor_type" OWNER TO "postgres";


CREATE TYPE "public"."stock_txn_type" AS ENUM (
    'receipt',
    'issue',
    'transfer_out',
    'transfer_in',
    'adjustment',
    'return'
);


ALTER TYPE "public"."stock_txn_type" OWNER TO "postgres";


CREATE TYPE "public"."training_status" AS ENUM (
    'planned',
    'open',
    'in_progress',
    'completed'
);


ALTER TYPE "public"."training_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'super_admin',
    'system_admin',
    'ceo',
    'farm_manager',
    'veterinarian',
    'store_keeper'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."vaccination_route" AS ENUM (
    'water',
    'injection',
    'spray',
    'eye_drop'
);


ALTER TYPE "public"."vaccination_route" OWNER TO "postgres";


CREATE TYPE "public"."warehouse_type" AS ENUM (
    'farm_store',
    'pharmacy',
    'equipment_store',
    'central_warehouse'
);


ALTER TYPE "public"."warehouse_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_daily_farm_record_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  live_birds integer;
  old_deaths integer := 0;
  new_deaths integer := 0;
  death_delta integer := 0;
begin
  if tg_op = 'DELETE' then
    if coalesce(old.deaths, 0) > 0 then
      update public.flocks
      set current_count = current_count + coalesce(old.deaths, 0),
          updated_at = now()
      where id = old.flock_id;
    end if;

    return old;
  end if;

  select current_count
  into live_birds
  from public.flocks
  where id = new.flock_id
  for update;

  if live_birds is not null and live_birds > 0 then
    if new.total_eggs is not null then
      new.production_percentage = round(((new.total_eggs::numeric / live_birds::numeric) * 100), 2);
    end if;

    if new.deaths is not null then
      new.mortality_percentage = round(((new.deaths::numeric / live_birds::numeric) * 100), 2);
    end if;
  end if;

  old_deaths := case when tg_op = 'UPDATE' then coalesce(old.deaths, 0) else 0 end;
  new_deaths := coalesce(new.deaths, 0);
  death_delta := new_deaths - old_deaths;

  if death_delta <> 0 then
    update public.flocks
    set current_count = greatest(current_count - death_delta, 0),
        updated_at = now()
    where id = new.flock_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."apply_daily_farm_record_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_monthly_cost_period_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.total_normal_eggs > 0 then
    new.base_cost_per_egg = round(
      (coalesce(new.direct_inventory_cost, 0) + coalesce(new.overhead_cost, 0)) / new.total_normal_eggs,
      4
    );
  else
    new.base_cost_per_egg = null;
  end if;

  if new.status = 'locked' and new.locked_at is null then
    new.locked_at = now();
  elsif new.status = 'draft' then
    new.locked_at = null;
    new.locked_by = null;
  end if;

  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."apply_monthly_cost_period_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'org_id', '')::uuid;
$$;


ALTER FUNCTION "public"."auth_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ceo_initialize_branch_hierarchy"("p_org_id" "uuid", "p_branch" "jsonb", "p_intake_batch" "jsonb", "p_farms" "jsonb", "p_manager" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_branch_id uuid;
  v_bib_id uuid;
  v_batch_id uuid;
  v_batch_code text;
  v_farm_id uuid;
  v_house_id uuid;
  v_flock_id uuid;
  v_primary_farm_id uuid;
  v_primary_house_id uuid;
  v_created_farm_ids uuid[] := '{}'::uuid[];
  v_farm jsonb;
  v_house jsonb;
  v_flock jsonb;
  v_total_count integer;
  v_cost_per_bird numeric(12,2);
  v_placement_date date;
begin
  if p_org_id is null then
    raise exception 'org_id is required';
  end if;

  if p_branch is null or coalesce(trim(p_branch->>'name'), '') = '' then
    raise exception 'branch.name is required';
  end if;

  if p_intake_batch is null then
    raise exception 'intakeBatch is required';
  end if;

  if p_manager is null or coalesce(trim(p_manager->>'user_id'), '') = '' then
    raise exception 'manager.user_id is required';
  end if;

  v_total_count := nullif(p_intake_batch->>'total_count', '')::integer;
  v_cost_per_bird := nullif(p_intake_batch->>'purchase_cost_per_bird', '')::numeric(12,2);
  v_placement_date := nullif(p_intake_batch->>'placement_date', '')::date;

  if v_total_count is null or v_total_count <= 0 then
    raise exception 'intakeBatch.total_count must be greater than 0';
  end if;

  if v_placement_date is null then
    raise exception 'intakeBatch.placement_date is required';
  end if;

  insert into public.branches (name, location, org_id)
  values (p_branch->>'name', p_branch->>'location', p_org_id)
  returning id into v_branch_id;

  insert into public.branch_intake_batches (
    org_id, branch_id, source, supplier_name, purchase_date, placement_date,
    total_count, purchase_cost_per_bird, transport_cost, other_cost, total_cost,
    status, notes
  )
  values (
    p_org_id,
    v_branch_id,
    (p_intake_batch->>'source')::public.flock_source,
    nullif(p_intake_batch->>'supplier_name', ''),
    nullif(p_intake_batch->>'purchase_date', '')::date,
    v_placement_date,
    v_total_count,
    v_cost_per_bird,
    coalesce(nullif(p_intake_batch->>'transport_cost', '')::numeric(12,2), 0),
    coalesce(nullif(p_intake_batch->>'other_cost', '')::numeric(12,2), 0),
    nullif(p_intake_batch->>'total_cost', '')::numeric(14,2),
    'pending',
    nullif(p_intake_batch->>'notes', '')
  )
  returning id, batch_code into v_bib_id, v_batch_code;

  for v_farm in select value from jsonb_array_elements(coalesce(p_farms, '[]'::jsonb))
  loop
    insert into public.farms (name, branch_id, org_id)
    values (v_farm->>'name', v_branch_id, p_org_id)
    returning id into v_farm_id;

    v_created_farm_ids := array_append(v_created_farm_ids, v_farm_id);

    for v_house in select value from jsonb_array_elements(coalesce(v_farm->'houses', '[]'::jsonb))
    loop
      insert into public.houses (name, capacity, house_type, branch_id, farm_id, org_id)
      values (
        v_house->>'name',
        coalesce(nullif(v_house->>'capacity', '')::integer, 0),
        'broiler'::public.house_type,
        v_branch_id,
        v_farm_id,
        p_org_id
      )
      returning id into v_house_id;

      if v_primary_farm_id is null then
        v_primary_farm_id := v_farm_id;
        v_primary_house_id := v_house_id;
      end if;
    end loop;
  end loop;

  if v_primary_farm_id is null or v_primary_house_id is null then
    raise exception 'At least one house is required to initialize a batch';
  end if;

  insert into public.batches (
    org_id, branch_id, farm_id, house_id, batch_code, source, supplier_name,
    purchase_date, placement_date, total_count, purchase_cost_per_bird,
    transport_cost, other_cost, status
  )
  values (
    p_org_id,
    v_branch_id,
    v_primary_farm_id,
    v_primary_house_id,
    v_batch_code,
    (p_intake_batch->>'source')::public.flock_source,
    nullif(p_intake_batch->>'supplier_name', ''),
    nullif(p_intake_batch->>'purchase_date', '')::date,
    v_placement_date,
    v_total_count,
    v_cost_per_bird,
    coalesce(nullif(p_intake_batch->>'transport_cost', '')::numeric(12,2), 0),
    coalesce(nullif(p_intake_batch->>'other_cost', '')::numeric(12,2), 0),
    'active'
  )
  returning id into v_batch_id;

  for v_farm in select value from jsonb_array_elements(coalesce(p_farms, '[]'::jsonb))
  loop
    select id into v_farm_id
    from public.farms
    where org_id = p_org_id
      and branch_id = v_branch_id
      and name = v_farm->>'name'
    order by created_at desc
    limit 1;

    for v_house in select value from jsonb_array_elements(coalesce(v_farm->'houses', '[]'::jsonb))
    loop
      select id into v_house_id
      from public.houses
      where org_id = p_org_id
        and farm_id = v_farm_id
        and name = v_house->>'name'
      order by created_at desc
      limit 1;

      for v_flock in select value from jsonb_array_elements(coalesce(v_house->'flocks', '[]'::jsonb))
      loop
        insert into public.flocks (
          flock_code, flock_type, source, placement_date, initial_count, current_count,
          age_at_placement_days, purchase_cost_per_bird, intake_batch_id, batch_id,
          house_id, farm_id, org_id
        )
        values (
          'FLK-' || upper(substring(md5(random()::text), 1, 5)),
          'broiler'::public.flock_type,
          (p_intake_batch->>'source')::public.flock_source,
          v_placement_date,
          greatest(coalesce(nullif(v_house->>'capacity', '')::integer, v_total_count, 1), 1),
          greatest(coalesce(nullif(v_house->>'capacity', '')::integer, v_total_count, 1), 1),
          0,
          v_cost_per_bird,
          v_bib_id,
          v_batch_id,
          v_house_id,
          v_farm_id,
          p_org_id
        )
        returning id into v_flock_id;
      end loop;
    end loop;
  end loop;

  insert into public.profiles (id, org_id, role, full_name, phone)
  values (
    (p_manager->>'user_id')::uuid,
    p_org_id,
    'farm_manager',
    p_manager->>'full_name',
    nullif(p_manager->>'phone', '')
  );

  insert into public.user_branch_access (profile_id, branch_id)
  values ((p_manager->>'user_id')::uuid, v_branch_id);

  return jsonb_build_object(
    'branchId', v_branch_id,
    'bibId', v_bib_id,
    'batchId', v_batch_id,
    'farmIds', to_jsonb(v_created_farm_ids)
  );
end;
$$;


ALTER FUNCTION "public"."ceo_initialize_branch_hierarchy"("p_org_id" "uuid", "p_branch" "jsonb", "p_intake_batch" "jsonb", "p_farms" "jsonb", "p_manager" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."farm_operating_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "operating_date" "date" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "exceptions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    "locked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "farm_operating_days_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'locked'::"text"])))
);


ALTER TABLE "public"."farm_operating_days" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_farm_operating_day"("p_farm_id" "uuid", "p_operating_date" "date", "p_exceptions" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "public"."farm_operating_days"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org uuid; v_expected int; v_record_exceptions int; v_feed_exceptions int; v_row public.farm_operating_days;
begin
  select org_id into v_org from public.farms where id=p_farm_id;
  if v_org is null or public.current_active_role()<>'farm_manager' or not public.has_active_farm_access(p_farm_id) then raise exception 'Farm manager assignment is required.' using errcode='42501'; end if;
  select count(*) into v_expected from public.flocks where farm_id=p_farm_id and status='active';
  if jsonb_typeof(coalesce(p_exceptions,'[]'::jsonb)) <> 'array' or exists(select 1 from jsonb_array_elements(coalesce(p_exceptions,'[]'::jsonb)) e where length(trim(coalesce(e->>'reason','')))<8 or coalesce(e->>'requirement','') not in ('daily_record','feed_close')) then
    raise exception 'Each exception requires a requirement and a reason of at least eight characters.' using errcode='22023';
  end if;
  select count(*) into v_record_exceptions from public.flocks f where f.farm_id=p_farm_id and f.status='active' and (exists(select 1 from public.daily_farm_records d where d.flock_id=f.id and d.record_date=p_operating_date and d.voided_at is null) or exists(select 1 from jsonb_array_elements(coalesce(p_exceptions,'[]'::jsonb)) e where e->>'flock_id'=f.id::text and e->>'requirement'='daily_record'));
  select count(*) into v_feed_exceptions from public.flocks f where f.farm_id=p_farm_id and f.status='active' and (exists(select 1 from public.feed_day_closures c where c.flock_id=f.id and c.record_date=p_operating_date and c.status='closed') or exists(select 1 from jsonb_array_elements(coalesce(p_exceptions,'[]'::jsonb)) e where e->>'flock_id'=f.id::text and e->>'requirement'='feed_close'));
  if v_record_exceptions<v_expected or v_feed_exceptions<v_expected then raise exception 'All active flocks require a Daily Record and closed feeding day (%/% records, %/% feed).',v_record_exceptions,v_expected,v_feed_exceptions,v_expected using errcode='23514'; end if;
  insert into public.farm_operating_days(org_id,farm_id,operating_date,status,exceptions,closed_by,closed_at,locked_at)
  values(v_org,p_farm_id,p_operating_date,'closed',coalesce(p_exceptions,'[]'::jsonb),auth.uid(),now(),null)
  on conflict(farm_id,operating_date) do update set status='closed',exceptions=excluded.exceptions,closed_by=auth.uid(),closed_at=now(),locked_at=null,updated_at=now()
  returning * into v_row;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,after_values) values(v_org,auth.uid(),public.current_active_role(),'operating_day.closed','farm_operating_days',v_row.id::text,to_jsonb(v_row));
  return v_row;
end $$;


ALTER FUNCTION "public"."close_farm_operating_day"("p_farm_id" "uuid", "p_operating_date" "date", "p_exceptions" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_override_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_org_id uuid; v_role text; v_batch_id uuid; v_farm_id uuid; v_house_id uuid; v_branch_id uuid;
  v_actual numeric; v_planned numeric; v_incomplete integer; v_daily_id uuid; v_feed_type public.feed_type;
  v_group record; v_available numeric; v_source_key text := p_flock_id::text || ':' || p_record_date::text; v_closure_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'Actor does not match the authenticated user.' using errcode = '42501';
  end if;
  select p.org_id, p.role::text into v_org_id, v_role from public.profiles p where p.id = p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager', 'ceo', 'system_admin', 'super_admin') then
    raise exception 'User cannot close a feeding day.' using errcode = '42501';
  end if;
  select f.batch_id, f.farm_id, f.house_id, fa.branch_id into v_batch_id, v_farm_id, v_house_id, v_branch_id
  from public.flocks f join public.farms fa on fa.id = f.farm_id
  where f.id = p_flock_id and f.org_id = v_org_id;
  if v_batch_id is null then raise exception 'Flock is not linked to a batch.' using errcode = '22023'; end if;
  if v_role = 'farm_manager' and not (
    exists(select 1 from public.user_farm_access a where a.profile_id = p_actor_id and a.farm_id = v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id = p_actor_id and a.branch_id = v_branch_id)
  ) then raise exception 'User does not have access to this flock.' using errcode = '42501'; end if;

  select count(*) filter(where status <> 'completed' or actual_feed_kg is null),
    coalesce(sum(actual_feed_kg), 0), coalesce(sum(planned_feed_kg), 0)
  into v_incomplete, v_actual, v_planned
  from public.feeding_session_records
  where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date;
  if not exists(select 1 from public.feeding_session_records where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date) then
    raise exception 'Add at least one feeding session before closing the day.' using errcode = '22023';
  end if;
  if v_incomplete > 0 then raise exception 'Complete or mark every feeding session before closing the day.' using errcode = '22023'; end if;
  select s.feed_type into v_feed_type from public.feeding_session_records s
  where s.org_id = v_org_id and s.flock_id = p_flock_id and s.record_date = p_record_date and s.feed_type is not null
  order by s.session_time desc nulls last limit 1;
  select dfr.id into v_daily_id from public.daily_farm_records dfr
  where dfr.org_id = v_org_id and dfr.flock_id = p_flock_id and dfr.record_date = p_record_date;

  for v_group in
    select feed_item_id, warehouse_id, sum(actual_feed_kg) quantity
    from public.feeding_session_records
    where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date and actual_feed_kg > 0
    group by feed_item_id, warehouse_id
  loop
    if v_group.feed_item_id is null or v_group.warehouse_id is null then
      raise exception 'Every completed session needs a feed item and warehouse.' using errcode = '22023';
    end if;
    if not exists(select 1 from public.inventory_items i where i.id = v_group.feed_item_id and i.org_id = v_org_id and i.category = 'feed' and lower(i.unit) in ('kg','kilogram','kilograms')) then
      raise exception 'Feed inventory must be recorded in kilograms before the feeding day can close.' using errcode = '22023';
    end if;
    if not exists(select 1 from public.warehouses w where w.id = v_group.warehouse_id and w.org_id = v_org_id and w.branch_id = v_branch_id) then
      raise exception 'Feed warehouse is outside the flock branch.' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_group.feed_item_id::text || ':' || v_group.warehouse_id::text, 0));
    select coalesce(sum(public.stock_movement_delta(sl.transaction_type, sl.quantity)), 0) into v_available
    from public.stock_ledger sl
    where sl.org_id = v_org_id and sl.item_id = v_group.feed_item_id and sl.warehouse_id = v_group.warehouse_id
      and not (sl.source_kind = 'feed_day_close' and sl.source_key = v_source_key)
      and not (v_daily_id is not null and sl.daily_record_id = v_daily_id and coalesce(sl.source_kind, 'daily_record_usage') = 'daily_record_usage');
    if v_available < v_group.quantity and nullif(btrim(p_override_reason), '') is null then
      raise exception 'Insufficient feed stock. Record a receipt or provide an authorized override reason.' using errcode = '22023';
    end if;
  end loop;

  insert into public.daily_farm_records(org_id, flock_id, record_date, feed_intake_grams, feed_intake_quantity, feed_type, recorded_by, synced)
  values(v_org_id, p_flock_id, p_record_date, round(v_actual * 1000), v_actual, v_feed_type, p_actor_id, true)
  on conflict(org_id, flock_id, record_date) do update set
    feed_intake_grams = excluded.feed_intake_grams,
    feed_intake_quantity = excluded.feed_intake_quantity,
    feed_type = coalesce(excluded.feed_type, public.daily_farm_records.feed_type),
    recorded_by = excluded.recorded_by, synced = true, updated_at = now()
  returning id into v_daily_id;

  -- Once Feed Control claims a day, discard only legacy/manual feed issues for
  -- that daily record. Health and other Daily Records usage is retained.
  delete from public.stock_ledger sl
  using public.inventory_items i
  where sl.org_id = v_org_id and sl.daily_record_id = v_daily_id
    and sl.item_id = i.id and i.org_id = v_org_id and i.category = 'feed'
    and not (sl.source_kind = 'feed_day_close' and sl.source_key = v_source_key);

  insert into public.feed_day_closures(org_id, batch_id, flock_id, record_date, status, planned_feed_kg, actual_feed_kg, variance_kg, override_reason, closed_by, closed_at, reopened_by, reopened_at, reopen_reason)
  values(v_org_id, v_batch_id, p_flock_id, p_record_date, 'closed', v_planned, v_actual, v_actual-v_planned, nullif(btrim(p_override_reason), ''), p_actor_id, now(), null, null, null)
  on conflict(org_id, flock_id, record_date) do update set status = 'closed', planned_feed_kg = excluded.planned_feed_kg,
    actual_feed_kg = excluded.actual_feed_kg, variance_kg = excluded.variance_kg, override_reason = excluded.override_reason,
    closed_by = excluded.closed_by, closed_at = excluded.closed_at, reopened_by = null, reopened_at = null, reopen_reason = null, updated_at = now()
  returning id into v_closure_id;

  delete from public.stock_ledger where org_id = v_org_id and source_kind = 'feed_day_close' and source_key = v_source_key;
  insert into public.stock_ledger(org_id, item_id, warehouse_id, quantity, transaction_type, unit_cost, transaction_date, branch_id, farm_id, house_id, flock_id, batch_id, daily_record_id, recorded_by, reference_doc, notes, source_kind, source_key)
  select v_org_id, s.feed_item_id, s.warehouse_id, sum(s.actual_feed_kg), 'issue', coalesce(i.unit_cost, 0), p_record_date,
    v_branch_id, v_farm_id, v_house_id, p_flock_id, v_batch_id, v_daily_id, p_actor_id, 'FEED_CLOSE:' || v_source_key,
    'Feed Control daily close', 'feed_day_close', v_source_key
  from public.feeding_session_records s join public.inventory_items i on i.id = s.feed_item_id
  where s.org_id = v_org_id and s.flock_id = p_flock_id and s.record_date = p_record_date and s.actual_feed_kg > 0
  group by s.feed_item_id, s.warehouse_id, i.unit_cost;

  return jsonb_build_object('closure_id', v_closure_id, 'daily_record_id', v_daily_id, 'actual_feed_kg', v_actual, 'planned_feed_kg', v_planned, 'variance_kg', v_actual-v_planned);
end;
$$;


ALTER FUNCTION "public"."close_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_override_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_branch_batch_cycle"("p_org_id" "uuid", "p_branch_id" "uuid", "p_batch" "jsonb", "p_flock_slots" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_batch_id uuid;
  v_batch_code text;
  v_source public.flock_source;
  v_placement_date date;
  v_age_days integer;
  v_total_count integer := 0;
  v_purchase_cost numeric(12,2);
  v_transport_cost numeric(12,2);
  v_other_cost numeric(12,2);
  v_first_slot jsonb;
  v_slot jsonb;
  v_farm_id uuid;
  v_house_id uuid;
  v_flock_code text;
  v_flock_type public.flock_type;
  v_slot_count integer;
  v_created_flock_ids uuid[] := '{}'::uuid[];
  v_new_flock_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id
    and org_id = p_org_id;

  if v_profile.id is null then
    raise exception 'Organization profile was not found';
  end if;

  if v_profile.role not in ('ceo', 'system_admin', 'super_admin', 'farm_manager') then
    raise exception 'Not allowed to create batch cycles';
  end if;

  if v_profile.role = 'farm_manager'
    and not exists (
      select 1
      from public.user_branch_access uba
      where uba.profile_id = v_user_id
        and uba.branch_id = p_branch_id
    )
    and not exists (
      select 1
      from public.user_farm_access ufa
      join public.farms f on f.id = ufa.farm_id
      where ufa.profile_id = v_user_id
        and f.branch_id = p_branch_id
    )
  then
    raise exception 'Not allowed to create a batch for this branch';
  end if;

  if not exists (
    select 1 from public.branches b
    where b.id = p_branch_id
      and b.org_id = p_org_id
  ) then
    raise exception 'Branch does not belong to this organization';
  end if;

  if p_flock_slots is null or jsonb_typeof(p_flock_slots) <> 'array' or jsonb_array_length(p_flock_slots) = 0 then
    raise exception 'At least one flock slot is required';
  end if;

  v_batch_code := nullif(trim(coalesce(p_batch->>'batch_code', '')), '');
  if v_batch_code is null then
    v_batch_code := public.generate_batch_code();
  end if;

  v_source := coalesce(nullif(p_batch->>'source', ''), 'external_purchase')::public.flock_source;
  v_placement_date := nullif(p_batch->>'placement_date', '')::date;
  v_age_days := nullif(p_batch->>'age_at_placement_days', '')::integer;
  v_purchase_cost := nullif(p_batch->>'purchase_cost_per_bird', '')::numeric(12,2);
  v_transport_cost := coalesce(nullif(p_batch->>'transport_cost', '')::numeric(12,2), 0);
  v_other_cost := coalesce(nullif(p_batch->>'other_cost', '')::numeric(12,2), 0);

  if v_placement_date is null then
    raise exception 'placement_date is required';
  end if;

  v_first_slot := p_flock_slots->0;
  v_farm_id := (v_first_slot->>'farm_id')::uuid;
  v_house_id := (v_first_slot->>'house_id')::uuid;

  for v_slot in select value from jsonb_array_elements(p_flock_slots)
  loop
    v_slot_count := nullif(v_slot->>'initial_count', '')::integer;
    if v_slot_count is null or v_slot_count <= 0 then
      raise exception 'Each flock slot must have a positive initial_count';
    end if;
    v_total_count := v_total_count + v_slot_count;

    if not exists (
      select 1
      from public.houses h
      join public.farms f on f.id = h.farm_id
      where h.id = (v_slot->>'house_id')::uuid
        and f.id = (v_slot->>'farm_id')::uuid
        and f.branch_id = p_branch_id
        and f.org_id = p_org_id
        and h.org_id = p_org_id
    ) then
      raise exception 'A flock slot is outside the selected branch';
    end if;
  end loop;

  update public.flocks fl
  set status = 'archived'::public.flock_status,
      updated_at = now()
  from public.farms f
  where fl.farm_id = f.id
    and f.branch_id = p_branch_id
    and fl.org_id = p_org_id
    and fl.status = 'active';

  update public.batches
  set status = 'archived',
      updated_at = now()
  where org_id = p_org_id
    and branch_id = p_branch_id
    and status = 'active';

  insert into public.batches (
    org_id,
    branch_id,
    farm_id,
    house_id,
    batch_code,
    source,
    supplier_name,
    purchase_date,
    placement_date,
    age_at_placement_days,
    male_count,
    female_count,
    total_count,
    purchase_cost_per_bird,
    transport_cost,
    other_cost,
    total_batch_cost,
    status,
    notes
  )
  values (
    p_org_id,
    p_branch_id,
    v_farm_id,
    v_house_id,
    v_batch_code,
    v_source,
    nullif(p_batch->>'supplier_name', ''),
    nullif(p_batch->>'purchase_date', '')::date,
    v_placement_date,
    v_age_days,
    coalesce(nullif(p_batch->>'male_count', '')::integer, 0),
    coalesce(nullif(p_batch->>'female_count', '')::integer, 0),
    v_total_count,
    v_purchase_cost,
    v_transport_cost,
    v_other_cost,
    coalesce(
      nullif(p_batch->>'total_batch_cost', '')::numeric(14,2),
      coalesce(v_purchase_cost, 0) * v_total_count + v_transport_cost + v_other_cost
    ),
    'active',
    nullif(p_batch->>'notes', '')
  )
  returning id into v_batch_id;

  for v_slot in select value from jsonb_array_elements(p_flock_slots)
  loop
    v_farm_id := (v_slot->>'farm_id')::uuid;
    v_house_id := (v_slot->>'house_id')::uuid;
    v_flock_code := nullif(trim(coalesce(v_slot->>'flock_code', '')), '');
    v_flock_type := coalesce(nullif(v_slot->>'flock_type', ''), 'broiler')::public.flock_type;
    v_slot_count := nullif(v_slot->>'initial_count', '')::integer;

    insert into public.flocks (
      flock_code,
      flock_type,
      source,
      placement_date,
      initial_count,
      current_count,
      age_at_placement_days,
      purchase_cost_per_bird,
      batch_id,
      house_id,
      farm_id,
      org_id,
      status,
      notes
    )
    values (
      coalesce(v_flock_code, 'FLK-' || upper(substring(md5(random()::text), 1, 5))),
      v_flock_type,
      v_source,
      v_placement_date,
      v_slot_count,
      v_slot_count,
      coalesce(v_age_days, 0),
      v_purchase_cost,
      v_batch_id,
      v_house_id,
      v_farm_id,
      p_org_id,
      'active',
      nullif(v_slot->>'notes', '')
    )
    returning id into v_new_flock_id;

    v_created_flock_ids := array_append(v_created_flock_ids, v_new_flock_id);
  end loop;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'batch_code', v_batch_code,
    'flock_ids', to_jsonb(v_created_flock_ids),
    'total_count', v_total_count
  );
end;
$$;


ALTER FUNCTION "public"."create_branch_batch_cycle"("p_org_id" "uuid", "p_branch_id" "uuid", "p_batch" "jsonb", "p_flock_slots" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_active_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select case when p.is_active and p.role::text in ('ceo','farm_manager','system_admin') then p.role::text else null end
  from public.profiles p where p.id=auth.uid()
$$;


ALTER FUNCTION "public"."current_active_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ select p.org_id from public.profiles p where p.id=auth.uid() and p.is_active $$;


ALTER FUNCTION "public"."current_org_id"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."break_glass_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_org_id" "uuid" NOT NULL,
    "administrator_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "ticket_reference" "text" NOT NULL,
    "requested_minutes" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    "decision_note" "text",
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revocation_reason" "text",
    CONSTRAINT "break_glass_requests_reason_check" CHECK (("length"(TRIM(BOTH FROM "reason")) >= 12)),
    CONSTRAINT "break_glass_requests_requested_minutes_check" CHECK ((("requested_minutes" >= 1) AND ("requested_minutes" <= 240))),
    CONSTRAINT "break_glass_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'revoked'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."break_glass_requests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decide_break_glass_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") RETURNS "public"."break_glass_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_row public.break_glass_requests; v_session public.break_glass_sessions;
begin
  if public.current_active_role()<>'ceo' then raise exception 'Only the tenant CEO can authorize support access.' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') or length(trim(coalesce(p_note,'')))<4 then raise exception 'A valid decision and note are required.' using errcode='22023'; end if;
  select * into v_row from public.break_glass_requests where id=p_request_id and target_org_id=public.current_org_id() for update;
  if not found then raise exception 'Support request not found.' using errcode='P0002'; end if;
  if v_row.status<>'pending' then raise exception 'This support request is no longer pending.' using errcode='40001'; end if;
  update public.break_glass_requests set status=p_decision,decided_by=auth.uid(),decided_at=now(),decision_note=trim(p_note),expires_at=case when p_decision='approved' then now()+make_interval(mins=>v_row.requested_minutes) else null end where id=p_request_id returning * into v_row;
  if p_decision='approved' then
    insert into public.break_glass_sessions(request_id,target_org_id,administrator_id,expires_at) values(v_row.id,v_row.target_org_id,v_row.administrator_id,v_row.expires_at) returning * into v_session;
  end if;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,entity_table,entity_id,reason,after_values)
  values(v_row.target_org_id,auth.uid(),'ceo',v_session.id,'break_glass.'||p_decision,'break_glass_requests',v_row.id::text,p_note,to_jsonb(v_row));
  return v_row;
end $$;


ALTER FUNCTION "public"."decide_break_glass_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "farm_id" "uuid",
    "warehouse_id" "uuid",
    "source_table" "text",
    "source_id" "uuid",
    "source_version" timestamp with time zone,
    "changed_fields" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "proposed_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reason" "text" NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    "decision_note" "text",
    "applied_at" timestamp with time zone,
    "conflict_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "governance_requests_reason_check" CHECK (("length"(TRIM(BOTH FROM "reason")) >= 8)),
    CONSTRAINT "governance_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['batch_create'::"text", 'batch_archive'::"text", 'flock_place'::"text", 'flock_transfer'::"text", 'flock_close'::"text", 'flock_archive'::"text", 'feed_template'::"text", 'breed_target'::"text", 'health_schedule'::"text", 'warning_threshold'::"text", 'locked_correction'::"text", 'void_record'::"text"]))),
    CONSTRAINT "governance_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text", 'conflict'::"text", 'applied'::"text"])))
);


ALTER TABLE "public"."governance_requests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decide_governance_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") RETURNS "public"."governance_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_row public.governance_requests; v_role text; v_current_version timestamptz; v_new_id uuid; v_daily public.daily_farm_records; v_target jsonb;
begin
  v_role:=public.current_active_role();
  if v_role<>'ceo' then raise exception 'Only the organization CEO can decide governance requests.' using errcode='42501'; end if;
  if p_decision not in ('approved','rejected') or length(trim(coalesce(p_note,'')))<4 then raise exception 'A valid decision and decision note are required.' using errcode='22023'; end if;
  select * into v_row from public.governance_requests where id=p_request_id and org_id=public.current_org_id() for update;
  if not found then raise exception 'Governance request not found.' using errcode='P0002'; end if;
  if v_row.status<>'pending' then raise exception 'This request is no longer pending.' using errcode='40001'; end if;
  if p_decision='approved' and v_row.source_id is not null and v_row.source_version is not null then
    if v_row.source_table='flocks' then select updated_at into v_current_version from public.flocks where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='batches' then select updated_at into v_current_version from public.batches where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='feed_control_settings' then select updated_at into v_current_version from public.feed_control_settings where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='daily_farm_records' then select updated_at into v_current_version from public.daily_farm_records where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='daily_sales_records' then select updated_at into v_current_version from public.daily_sales_records where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='health_events' then select updated_at into v_current_version from public.health_events where id=v_row.source_id and org_id=v_row.org_id;
    elsif v_row.source_table='vaccination_events' then select updated_at into v_current_version from public.vaccination_events where id=v_row.source_id and org_id=v_row.org_id;
    else raise exception 'Unsupported versioned source table.' using errcode='22023'; end if;
    if v_current_version is null or v_current_version<>v_row.source_version then
      update public.governance_requests set status='conflict',conflict_reason='The source record changed after this request was submitted.',decided_by=auth.uid(),decided_at=now(),decision_note=trim(p_note),updated_at=now() where id=v_row.id returning * into v_row;
      return v_row;
    end if;
  end if;
  if p_decision='approved' then
    perform set_config('app.governance_apply','true',true);
    if v_row.request_type='flock_place' then
      if not exists(select 1 from public.farms f where f.id=(v_row.proposed_values->>'farm_id')::uuid and f.org_id=v_row.org_id)
        or not exists(select 1 from public.houses h where h.id=(v_row.proposed_values->>'house_id')::uuid and h.org_id=v_row.org_id and h.farm_id=(v_row.proposed_values->>'farm_id')::uuid) then
        raise exception 'The proposed farm or house is outside the organization.' using errcode='23514';
      end if;
      insert into public.flocks(org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,age_at_placement_days,initial_count,current_count,breed_id,purchase_cost_per_bird,notes,status)
      values(v_row.org_id,(v_row.proposed_values->>'farm_id')::uuid,(v_row.proposed_values->>'house_id')::uuid,nullif(v_row.proposed_values->>'batch_id','')::uuid,v_row.proposed_values->>'flock_code',(v_row.proposed_values->>'flock_type')::public.flock_type,(v_row.proposed_values->>'source')::public.flock_source,(v_row.proposed_values->>'placement_date')::date,coalesce((v_row.proposed_values->>'age_at_placement_days')::integer,0),(v_row.proposed_values->>'initial_count')::integer,(v_row.proposed_values->>'initial_count')::integer,nullif(v_row.proposed_values->>'breed_id','')::uuid,nullif(v_row.proposed_values->>'purchase_cost_per_bird','')::numeric,nullif(v_row.proposed_values->>'notes',''),'active') returning id into v_new_id;
      v_row.source_table:='flocks'; v_row.source_id:=v_new_id;
    elsif v_row.request_type='batch_create' then
      if not exists(select 1 from public.houses h join public.farms f on f.id=h.farm_id join public.branches b on b.id=f.branch_id where h.id=(v_row.proposed_values->>'house_id')::uuid and f.id=(v_row.proposed_values->>'farm_id')::uuid and b.id=(v_row.proposed_values->>'branch_id')::uuid and f.org_id=v_row.org_id and h.org_id=v_row.org_id and b.org_id=v_row.org_id) then raise exception 'Batch location is outside the organization.' using errcode='23514'; end if;
      insert into public.batches(org_id,branch_id,farm_id,house_id,batch_code,source,supplier_name,purchase_date,placement_date,age_at_placement_days,male_count,female_count,total_count,purchase_cost_per_bird,transport_cost,other_cost,notes,status)
      values(v_row.org_id,(v_row.proposed_values->>'branch_id')::uuid,(v_row.proposed_values->>'farm_id')::uuid,(v_row.proposed_values->>'house_id')::uuid,v_row.proposed_values->>'batch_code',(v_row.proposed_values->>'source')::public.flock_source,nullif(v_row.proposed_values->>'supplier_name',''),nullif(v_row.proposed_values->>'purchase_date','')::date,(v_row.proposed_values->>'placement_date')::date,coalesce((v_row.proposed_values->>'age_at_placement_days')::integer,0),coalesce((v_row.proposed_values->>'male_count')::integer,0),coalesce((v_row.proposed_values->>'female_count')::integer,0),(v_row.proposed_values->>'total_count')::integer,nullif(v_row.proposed_values->>'purchase_cost_per_bird','')::numeric,coalesce((v_row.proposed_values->>'transport_cost')::numeric,0),coalesce((v_row.proposed_values->>'other_cost')::numeric,0),nullif(v_row.proposed_values->>'notes',''),'active') returning id into v_new_id;
      v_row.source_table:='batches';v_row.source_id:=v_new_id;
    elsif v_row.request_type='flock_transfer' then
      if not exists(select 1 from public.houses h join public.farms f on f.id=h.farm_id where h.id=(v_row.proposed_values->>'house_id')::uuid and f.id=(v_row.proposed_values->>'farm_id')::uuid and f.org_id=v_row.org_id and h.org_id=v_row.org_id) then raise exception 'Transfer destination is outside the organization.' using errcode='23514'; end if;
      update public.flocks set farm_id=(v_row.proposed_values->>'farm_id')::uuid,house_id=(v_row.proposed_values->>'house_id')::uuid,updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Flock not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='flock_close' then
      if coalesce(v_row.proposed_values->>'status','archived') not in ('transferred','sold','culled','archived') then raise exception 'Flock closure requires a terminal status.' using errcode='22023'; end if;
      update public.flocks set status=coalesce(v_row.proposed_values->>'status','archived')::public.flock_status,updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Flock not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='flock_archive' then
      update public.flocks set status='archived',updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Flock not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='batch_archive' then
      update public.batches set status='archived',updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Batch not found.' using errcode='P0002'; end if;
      update public.flocks set status='archived',updated_at=now() where batch_id=v_row.source_id and org_id=v_row.org_id and status='active';
    elsif v_row.request_type='locked_correction' and v_row.source_table='batches' and v_row.changed_fields <@ array['batch_code']::text[] then
      update public.batches set batch_code=v_row.proposed_values->>'batch_code',updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Batch not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='warning_threshold' then
      insert into public.feed_control_settings(org_id,warning_variance_pct,critical_variance_pct,updated_at)
      values(v_row.org_id,(v_row.proposed_values->>'warning_variance_pct')::numeric,(v_row.proposed_values->>'critical_variance_pct')::numeric,now())
      on conflict(org_id) do update set warning_variance_pct=excluded.warning_variance_pct,critical_variance_pct=excluded.critical_variance_pct,updated_at=now();
    elsif v_row.request_type='feed_template' then
      perform public.save_feed_template(v_row.requested_by,(v_row.proposed_values->>'batch_id')::uuid,coalesce(v_row.proposed_values->>'name','Batch feed template'),coalesce(v_row.proposed_values->>'source_type','manual'),coalesce(v_row.proposed_values->'rows','[]'::jsonb));
    elsif v_row.request_type='breed_target' then
      if jsonb_typeof(v_row.proposed_values->'rows')<>'array' then raise exception 'Breed target rows are required.' using errcode='22023'; end if;
      delete from public.breed_standards where org_id=v_row.org_id and breed_id=(v_row.proposed_values->>'breed_id')::uuid;
      insert into public.breed_standards(org_id,breed_id,week_number,target_hdep_pct,target_mortality_pct,target_feed_g,target_weight_g,updated_at)
      select v_row.org_id,(v_row.proposed_values->>'breed_id')::uuid,x.week_number,x.target_hdep_pct,x.target_mortality_pct,x.target_feed_g,x.target_weight_g,now() from jsonb_to_recordset(v_row.proposed_values->'rows') as x(week_number integer,target_hdep_pct numeric,target_mortality_pct numeric,target_feed_g numeric,target_weight_g numeric);
    elsif v_row.request_type='health_schedule' then
      if not exists(select 1 from public.flocks where id=(v_row.proposed_values->>'flock_id')::uuid and org_id=v_row.org_id) then raise exception 'Health schedule flock is outside the organization.' using errcode='23514'; end if;
      insert into public.health_events(org_id,flock_id,event_date,event_type,description,diagnosis,treatment,attachment_url,vet_id,external_veterinarian_name,veterinarian_recommendation,veterinarian_reference,veterinarian_attachment,recommendation_status)
      values(v_row.org_id,(v_row.proposed_values->>'flock_id')::uuid,(v_row.proposed_values->>'event_date')::date,coalesce(v_row.proposed_values->>'event_type','observation')::public.health_event_type,nullif(v_row.proposed_values->>'description',''),nullif(v_row.proposed_values->>'diagnosis',''),nullif(v_row.proposed_values->>'treatment',''),nullif(v_row.proposed_values->>'attachment_url',''),v_row.requested_by,nullif(v_row.proposed_values->>'external_veterinarian_name',''),nullif(v_row.proposed_values->>'veterinarian_recommendation',''),nullif(v_row.proposed_values->>'veterinarian_reference',''),v_row.proposed_values->'veterinarian_attachment',nullif(v_row.proposed_values->>'recommendation_status','')) returning id into v_new_id;
      v_row.source_table:='health_events';v_row.source_id:=v_new_id;
    elsif v_row.request_type='locked_correction' and v_row.source_table='daily_farm_records' then
      if v_row.changed_fields && array['feed_intake_grams','feed_intake_quantity','feed_type']::text[] then raise exception 'Feed fields remain controlled by Feed Control.' using errcode='42501'; end if;
      select * into v_daily from jsonb_populate_record(null::public.daily_farm_records,v_row.proposed_values);
      update public.daily_farm_records set
        normal_eggs=case when 'normal_eggs'=any(v_row.changed_fields) then v_daily.normal_eggs else normal_eggs end,broken_eggs=case when 'broken_eggs'=any(v_row.changed_fields) then v_daily.broken_eggs else broken_eggs end,dirty_eggs=case when 'dirty_eggs'=any(v_row.changed_fields) then v_daily.dirty_eggs else dirty_eggs end,average_egg_weight_g=case when 'average_egg_weight_g'=any(v_row.changed_fields) then v_daily.average_egg_weight_g else average_egg_weight_g end,deaths=case when 'deaths'=any(v_row.changed_fields) then v_daily.deaths else deaths end,deaths_cause=case when 'deaths_cause'=any(v_row.changed_fields) then v_daily.deaths_cause else deaths_cause end,opening_birds=case when 'opening_birds'=any(v_row.changed_fields) then v_daily.opening_birds else opening_birds end,closing_birds=case when 'closing_birds'=any(v_row.changed_fields) then v_daily.closing_birds else closing_birds end,culls=case when 'culls'=any(v_row.changed_fields) then v_daily.culls else culls end,transfers_in=case when 'transfers_in'=any(v_row.changed_fields) then v_daily.transfers_in else transfers_in end,transfers_out=case when 'transfers_out'=any(v_row.changed_fields) then v_daily.transfers_out else transfers_out end,other_removals=case when 'other_removals'=any(v_row.changed_fields) then v_daily.other_removals else other_removals end,water_consumed_liters=case when 'water_consumed_liters'=any(v_row.changed_fields) then v_daily.water_consumed_liters else water_consumed_liters end,feed_leftover_grams=case when 'feed_leftover_grams'=any(v_row.changed_fields) then v_daily.feed_leftover_grams else feed_leftover_grams end,vaccination_status=case when 'vaccination_status'=any(v_row.changed_fields) then v_daily.vaccination_status else vaccination_status end,medication_vitamins=case when 'medication_vitamins'=any(v_row.changed_fields) then v_daily.medication_vitamins else medication_vitamins end,updated_at=now() where id=v_row.source_id and org_id=v_row.org_id;
      if not found then raise exception 'Daily record not found.' using errcode='P0002'; end if;
    elsif v_row.request_type='void_record' then
      if v_row.source_table not in ('daily_farm_records','feeding_session_records','daily_sales_records','health_events','vaccination_events','biosecurity_checks','batch_weight_check_tasks') then raise exception 'Unsupported void target.' using errcode='22023'; end if;
      execute format('update public.%I set voided_at=now(),voided_by=$1,void_reason=$2 where id=$3 and org_id=$4 and voided_at is null',v_row.source_table) using auth.uid(),v_row.reason,v_row.source_id,v_row.org_id;
    else
      raise exception 'No atomic application adapter is registered for request type %.',v_row.request_type using errcode='0A000';
    end if;
  end if;
  update public.governance_requests set status=case when p_decision='approved' then 'applied' else 'rejected' end,source_table=coalesce(v_row.source_table,source_table),source_id=coalesce(v_row.source_id,source_id),applied_at=case when p_decision='approved' then now() else null end,decided_by=auth.uid(),decided_at=now(),decision_note=trim(p_note),updated_at=now() where id=p_request_id returning * into v_row;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
  values(v_row.org_id,auth.uid(),v_role,'governance_request.'||v_row.status,'governance_requests',v_row.id::text,p_note,to_jsonb(v_row));
  return v_row;
end $_$;


ALTER FUNCTION "public"."decide_governance_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_governed_lifecycle"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ begin if auth.uid() is not null and coalesce(current_setting('app.governance_apply',true),'false')<>'true' then raise exception 'Lifecycle changes require an approved governance request.' using errcode='42501'; end if; return case when tg_op='DELETE' then old else new end; end $$;


ALTER FUNCTION "public"."enforce_governed_lifecycle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_operational_actor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare payload jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end; v_farm uuid; v_date date;
begin
  if auth.uid() is null then return case when tg_op='DELETE' then old else new end; end if;
  if coalesce(current_setting('app.governance_apply',true),'false')='true' then return case when tg_op='DELETE' then old else new end; end if;
  if public.current_active_role()<>'farm_manager' then raise exception 'Routine operational writes require a farm manager.' using errcode='42501'; end if;
  v_farm:=nullif(payload->>'farm_id','')::uuid;
  if v_farm is null and nullif(payload->>'flock_id','') is not null then select farm_id into v_farm from public.flocks where id=(payload->>'flock_id')::uuid; end if;
  if v_farm is null or not public.has_active_farm_access(v_farm) then raise exception 'An active direct farm assignment is required.' using errcode='42501'; end if;
  v_date:=coalesce(nullif(payload->>'record_date','')::date,nullif(payload->>'sale_date','')::date,nullif(payload->>'event_date','')::date,nullif(payload->>'checklist_date','')::date);
  if v_date is not null and exists(select 1 from public.farm_operating_days d where d.farm_id=v_farm and d.operating_date=v_date and d.status='locked') then raise exception 'The operating day is locked; submit a correction request.' using errcode='42501'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;


ALTER FUNCTION "public"."enforce_operational_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_batch_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  new_code text;
  seq_val integer;
begin
  seq_val := nextval('public.batch_code_seq');
  new_code := 'B-' || to_char(current_date, 'YYYY') || '-' || lpad((seq_val % 10000)::text, 4, '0');
  return new_code;
end;
$$;


ALTER FUNCTION "public"."generate_batch_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_active_break_glass"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(select 1 from public.break_glass_sessions s where s.administrator_id=auth.uid() and s.target_org_id=p_org_id and s.started_at<=now() and s.expires_at>now() and s.revoked_at is null)
$$;


ALTER FUNCTION "public"."has_active_break_glass"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_active_farm_access"("p_farm_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(select 1 from public.user_farm_access a where a.profile_id=auth.uid() and a.farm_id=p_farm_id and a.starts_at<=now() and a.revoked_at is null and (a.expires_at is null or a.expires_at>now()))
$$;


ALTER FUNCTION "public"."has_active_farm_access"("p_farm_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_active_warehouse_access"("p_warehouse_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(select 1 from public.user_warehouse_access a where a.profile_id=auth.uid() and a.warehouse_id=p_warehouse_id and a.starts_at<=now() and a.revoked_at is null and (a.expires_at is null or a.expires_at>now()))
$$;


ALTER FUNCTION "public"."has_active_warehouse_access"("p_warehouse_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_overdue_operating_days"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_count integer;
begin
  insert into public.governance_scheduler_health(scheduler_key,last_started_at,updated_at)
  values('operating_day_lock',now(),now())
  on conflict(scheduler_key) do update set last_started_at=excluded.last_started_at,updated_at=now();

  insert into public.farm_operating_days(org_id,farm_id,operating_date,status,locked_at)
  select f.org_id,f.id,d::date,'locked',now()
  from public.farms f
  join public.organizations o on o.id=f.org_id
  cross join lateral generate_series(
    coalesce((select min(fl.placement_date) from public.flocks fl where fl.farm_id=f.id), (now() at time zone 'Africa/Addis_Ababa')::date),
    (now() at time zone 'Africa/Addis_Ababa')::date - case when (now() at time zone 'Africa/Addis_Ababa')::time >= o.operational_day_lock_time then 1 else 2 end,
    interval '1 day') d
  on conflict(farm_id,operating_date) do update
    set status='locked',locked_at=coalesce(farm_operating_days.locked_at,now()),updated_at=now()
    where farm_operating_days.status='open';
  get diagnostics v_count=row_count;

  update public.governance_scheduler_health
  set last_completed_at=now(),last_locked_count=v_count,updated_at=now()
  where scheduler_key='operating_day_lock';
  return v_count;
end $$;


ALTER FUNCTION "public"."lock_overdue_operating_days"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_user_role"("input_role" "text") RETURNS "public"."user_role"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare normalized text := lower(trim(coalesce(input_role,'')));
begin
  if normalized='manager' then return 'ceo'::public.user_role; end if;
  if normalized='super_admin' then return 'system_admin'::public.user_role; end if;
  if normalized in ('ceo','farm_manager','system_admin') then return normalized::public.user_role; end if;
  return null;
end $$;


ALTER FUNCTION "public"."normalize_user_role"("input_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_closed_feed_day_record_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if exists (
    select 1 from public.feed_day_closures c
    where c.org_id = old.org_id and c.flock_id = old.flock_id
      and c.record_date = old.record_date and c.status = 'closed'
  ) then
    raise exception 'Reopen the feeding day before deleting this daily record.' using errcode = '55000';
  end if;
  return old;
end;
$$;


ALTER FUNCTION "public"."prevent_closed_feed_day_record_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_governance_audit_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ begin raise exception 'Governance audit events are append-only.' using errcode='42501'; end $$;


ALTER FUNCTION "public"."prevent_governance_audit_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_profile_authority_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if auth.uid() is not null and (new.role is distinct from old.role or new.org_id is distinct from old.org_id or new.is_active is distinct from old.is_active) then
    raise exception 'Role, organization, and account status changes must use the governed user API.' using errcode='42501';
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."protect_profile_authority_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconciliation_farm_scope_allowed"("p_org_id" "uuid", "p_farm_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.org_id=p_org_id and p.is_active
      and (p.role='ceo' or (p.role='farm_manager' and p_farm_id is not null and exists(
        select 1 from public.user_farm_access a where a.org_id=p_org_id and a.profile_id=p.id and a.farm_id=p_farm_id
          and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())
      )))
  )
$$;


ALTER FUNCTION "public"."reconciliation_farm_scope_allowed"("p_org_id" "uuid", "p_farm_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reconciliation_warehouse_scope_allowed"("p_org_id" "uuid", "p_warehouse_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.org_id=p_org_id and p.is_active
      and (p.role='ceo' or (p.role='farm_manager' and p_warehouse_id is not null and exists(
        select 1 from public.user_warehouse_access a where a.org_id=p_org_id and a.profile_id=p.id and a.warehouse_id=p_warehouse_id
          and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())
      )))
  )
$$;


ALTER FUNCTION "public"."reconciliation_warehouse_scope_allowed"("p_org_id" "uuid", "p_warehouse_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_feed_milestone"("p_actor_id" "uuid", "p_milestone_id" "uuid", "p_flock_id" "uuid", "p_status" "text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org_id uuid; v_role text; v_batch_id uuid; v_farm_id uuid; v_branch_id uuid; v_execution_id uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then raise exception 'Actor does not match the authenticated user.' using errcode='42501'; end if;
  select p.org_id,p.role::text into v_org_id,v_role from public.profiles p where p.id=p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','ceo','system_admin','super_admin') then raise exception 'User cannot complete feed milestones.' using errcode='42501'; end if;
  if p_status not in ('completed','skipped') then raise exception 'Milestone status must be completed or skipped.' using errcode='22023'; end if;
  select t.batch_id into v_batch_id from public.batch_feed_template_milestones m join public.batch_feed_templates t on t.id=m.template_id
    where m.id=p_milestone_id and t.org_id=v_org_id and t.is_active;
  if not found then raise exception 'Active feed milestone was not found.' using errcode='22023'; end if;
  select f.farm_id,fa.branch_id into v_farm_id,v_branch_id from public.flocks f join public.farms fa on fa.id=f.farm_id
    where f.id=p_flock_id and f.org_id=v_org_id and f.batch_id=v_batch_id;
  if not found then raise exception 'Flock is not part of the milestone batch.' using errcode='22023'; end if;
  if v_role='farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id=p_actor_id and a.farm_id=v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id=p_actor_id and a.branch_id=v_branch_id)) then raise exception 'User does not have access to this flock.' using errcode='42501'; end if;
  insert into public.feed_milestone_executions(org_id,milestone_id,flock_id,status,completed_by,completed_at,notes)
  values(v_org_id,p_milestone_id,p_flock_id,p_status,p_actor_id,now(),nullif(btrim(p_notes),''))
  on conflict(milestone_id,flock_id) do update set status=excluded.status,completed_by=excluded.completed_by,completed_at=excluded.completed_at,notes=excluded.notes
  returning id into v_execution_id;
  return jsonb_build_object('execution_id',v_execution_id,'status',p_status);
end;
$$;


ALTER FUNCTION "public"."record_feed_milestone"("p_actor_id" "uuid", "p_milestone_id" "uuid", "p_flock_id" "uuid", "p_status" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_feed_weight"("p_actor_id" "uuid", "p_task_id" "uuid", "p_record_date" "date", "p_sample_count" integer, "p_average_weight_g" numeric, "p_min_weight_g" numeric, "p_max_weight_g" numeric, "p_uniformity_pct" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org_id uuid; v_role text; v_flock_id uuid; v_farm_id uuid; v_branch_id uuid; v_weight_id uuid; v_existing uuid;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then raise exception 'Actor does not match the authenticated user.' using errcode='42501'; end if;
  select p.org_id,p.role::text into v_org_id,v_role from public.profiles p where p.id=p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','veterinarian','ceo','system_admin','super_admin') then raise exception 'User cannot record flock weights.' using errcode='42501'; end if;
  if p_sample_count<=0 or p_average_weight_g<=0 or p_min_weight_g<=0 or p_max_weight_g<p_min_weight_g or p_uniformity_pct<0 or p_uniformity_pct>100 then
    raise exception 'Enter a valid sample count, weight range, average, and uniformity.' using errcode='22023';
  end if;
  select t.flock_id,t.weight_record_id into v_flock_id,v_existing from public.batch_weight_check_tasks t where t.id=p_task_id and t.org_id=v_org_id;
  if not found then raise exception 'Weight task was not found.' using errcode='22023'; end if;
  select f.farm_id,fa.branch_id into v_farm_id,v_branch_id from public.flocks f join public.farms fa on fa.id=f.farm_id where f.id=v_flock_id and f.org_id=v_org_id;
  if not found then raise exception 'Flock is not available in this organization.' using errcode='22023'; end if;
  if v_role='farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id=p_actor_id and a.farm_id=v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id=p_actor_id and a.branch_id=v_branch_id)) then
    raise exception 'User does not have access to this flock.' using errcode='42501';
  end if;
  if v_existing is null then
    insert into public.weight_records(org_id,flock_id,record_date,sample_count,average_weight_g,min_weight_g,max_weight_g,uniformity_pct)
      values(v_org_id,v_flock_id,p_record_date,p_sample_count,p_average_weight_g,p_min_weight_g,p_max_weight_g,p_uniformity_pct) returning id into v_weight_id;
  else
    update public.weight_records set record_date=p_record_date,sample_count=p_sample_count,average_weight_g=p_average_weight_g,min_weight_g=p_min_weight_g,max_weight_g=p_max_weight_g,uniformity_pct=p_uniformity_pct,updated_at=now()
      where id=v_existing and org_id=v_org_id returning id into v_weight_id;
  end if;
  update public.batch_weight_check_tasks set status='completed',weight_record_id=v_weight_id,updated_at=now() where id=p_task_id;
  return jsonb_build_object('weight_record_id',v_weight_id,'task_id',p_task_id,'status','completed');
end;
$$;


ALTER FUNCTION "public"."record_feed_weight"("p_actor_id" "uuid", "p_task_id" "uuid", "p_record_date" "date", "p_sample_count" integer, "p_average_weight_g" numeric, "p_min_weight_g" numeric, "p_max_weight_g" numeric, "p_uniformity_pct" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_inventory_movement"("p_actor_id" "uuid", "p_item_id" "uuid", "p_warehouse_id" "uuid", "p_transaction_type" "text", "p_quantity" numeric, "p_unit_cost" numeric DEFAULT 0, "p_transaction_date" "date" DEFAULT CURRENT_DATE, "p_destination_warehouse_id" "uuid" DEFAULT NULL::"uuid", "p_branch_id" "uuid" DEFAULT NULL::"uuid", "p_farm_id" "uuid" DEFAULT NULL::"uuid", "p_house_id" "uuid" DEFAULT NULL::"uuid", "p_flock_id" "uuid" DEFAULT NULL::"uuid", "p_batch_id" "uuid" DEFAULT NULL::"uuid", "p_procurement_type" "public"."procurement_type" DEFAULT NULL::"public"."procurement_type", "p_supplier_name" "text" DEFAULT NULL::"text", "p_invoice_number" "text" DEFAULT NULL::"text", "p_reference_doc" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_role text;
  v_item_cost numeric;
  v_source_branch_id uuid;
  v_destination_branch_id uuid;
  v_branch_id uuid := p_branch_id;
  v_farm_id uuid := p_farm_id;
  v_house_id uuid := p_house_id;
  v_batch_id uuid := p_batch_id;
  v_available numeric;
  v_reference text := nullif(btrim(p_reference_doc), '');
  v_out_id uuid;
  v_in_id uuid;
  v_transaction_type public.stock_txn_type;
begin
  select p.org_id, p.role::text
  into v_org_id, v_role
  from public.profiles p
  where p.id = p_actor_id;

  if v_org_id is null then
    raise exception 'User profile does not have organization access.' using errcode = '42501';
  end if;
  if v_role not in ('store_keeper', 'farm_manager', 'ceo', 'system_admin', 'super_admin') then
    raise exception 'User cannot record inventory movements.' using errcode = '42501';
  end if;

  if p_transaction_type not in ('receipt', 'issue', 'return', 'adjustment', 'transfer') then
    raise exception 'Unsupported inventory transaction type.' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity = 0 or (p_transaction_type <> 'adjustment' and p_quantity < 0) then
    raise exception 'Quantity must be greater than zero; adjustments may be positive or negative.' using errcode = '22023';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Unit cost cannot be negative.' using errcode = '22023';
  end if;
  if p_transaction_type = 'receipt' and p_procurement_type is null then
    raise exception 'Procurement type is required for receipts.' using errcode = '22023';
  end if;
  if p_transaction_type <> 'receipt' and p_procurement_type is not null then
    raise exception 'Procurement type can only be set on receipts.' using errcode = '22023';
  end if;

  select coalesce(ii.unit_cost, 0)
  into v_item_cost
  from public.inventory_items ii
  where ii.id = p_item_id and ii.org_id = v_org_id;
  if not found then
    raise exception 'Inventory item is not available in this organization.' using errcode = '22023';
  end if;

  select w.branch_id
  into v_source_branch_id
  from public.warehouses w
  where w.id = p_warehouse_id and w.org_id = v_org_id;
  if not found then
    raise exception 'Source warehouse is not available in this organization.' using errcode = '22023';
  end if;

  if p_flock_id is not null then
    select f.farm_id, f.house_id, f.batch_id
    into v_farm_id, v_house_id, v_batch_id
    from public.flocks f
    where f.id = p_flock_id and f.org_id = v_org_id;
    if not found then
      raise exception 'Flock is not available in this organization.' using errcode = '22023';
    end if;
    if p_farm_id is not null and p_farm_id <> v_farm_id
      or p_house_id is not null and p_house_id <> v_house_id
      or p_batch_id is not null and p_batch_id <> v_batch_id then
      raise exception 'Flock, farm, house, and batch selection do not agree.' using errcode = '22023';
    end if;
  end if;

  if v_house_id is not null then
    if not exists (
      select 1 from public.houses h
      where h.id = v_house_id and h.org_id = v_org_id
        and (v_farm_id is null or h.farm_id = v_farm_id)
        and (v_branch_id is null or h.branch_id = v_branch_id)
    ) then
      raise exception 'House does not belong to the selected farm and branch.' using errcode = '22023';
    end if;
    select h.farm_id, h.branch_id
    into v_farm_id, v_branch_id
    from public.houses h
    where h.id = v_house_id and h.org_id = v_org_id;
    if not found then
      raise exception 'House is not available in this organization.' using errcode = '22023';
    end if;
  end if;

  if v_farm_id is not null then
    if not exists (
      select 1 from public.farms f
      where f.id = v_farm_id and f.org_id = v_org_id
        and (v_branch_id is null or f.branch_id = v_branch_id)
    ) then
      raise exception 'Farm does not belong to the selected branch.' using errcode = '22023';
    end if;
    select f.branch_id
    into v_branch_id
    from public.farms f
    where f.id = v_farm_id and f.org_id = v_org_id;
    if not found then
      raise exception 'Farm is not available in this organization.' using errcode = '22023';
    end if;
  end if;

  if v_batch_id is not null and not exists (
    select 1 from public.batches b
    where b.id = v_batch_id and b.org_id = v_org_id
      and (v_farm_id is null or b.farm_id = v_farm_id)
      and (v_house_id is null or b.house_id = v_house_id)
  ) then
    raise exception 'Batch is not available for the selected farm and house.' using errcode = '22023';
  end if;

  v_branch_id := coalesce(v_branch_id, v_source_branch_id);
  if v_branch_id <> v_source_branch_id then
    raise exception 'Source warehouse must belong to the selected branch.' using errcode = '22023';
  end if;

  if v_role = 'farm_manager' and not (
    exists (select 1 from public.user_farm_access ufa where ufa.profile_id = p_actor_id and ufa.farm_id = v_farm_id)
    or exists (select 1 from public.user_branch_access uba where uba.profile_id = p_actor_id and uba.branch_id = v_branch_id)
  ) then
    raise exception 'User does not have access to this inventory scope.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || p_warehouse_id::text, 0));

  if p_transaction_type = 'transfer' then
    if p_destination_warehouse_id is null or p_destination_warehouse_id = p_warehouse_id then
      raise exception 'Select a different destination warehouse for a transfer.' using errcode = '22023';
    end if;
    select w.branch_id into v_destination_branch_id
    from public.warehouses w
    where w.id = p_destination_warehouse_id and w.org_id = v_org_id;
    if not found then
      raise exception 'Destination warehouse is not available in this organization.' using errcode = '22023';
    end if;
    if v_role = 'farm_manager' and not (
      exists (
        select 1 from public.user_branch_access uba
        where uba.profile_id = p_actor_id and uba.branch_id = v_destination_branch_id
      )
      or exists (
        select 1
        from public.user_farm_access ufa
        join public.farms f on f.id = ufa.farm_id and f.org_id = v_org_id
        where ufa.profile_id = p_actor_id and f.branch_id = v_destination_branch_id
      )
    ) then
      raise exception 'User does not have access to the destination warehouse.' using errcode = '42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || p_destination_warehouse_id::text, 0));
    v_reference := coalesce(v_reference, 'TRANSFER:' || gen_random_uuid()::text);
  end if;

  if p_transaction_type in ('issue', 'transfer') or (p_transaction_type = 'adjustment' and p_quantity < 0) then
    select coalesce(sum(public.stock_movement_delta(sl.transaction_type, sl.quantity)), 0)
    into v_available
    from public.stock_ledger sl
    where sl.org_id = v_org_id
      and sl.item_id = p_item_id
      and sl.warehouse_id = p_warehouse_id;
    if v_available < abs(p_quantity) then
      raise exception 'Insufficient stock. Available quantity is %.', v_available using errcode = '22023';
    end if;
  end if;

  if p_transaction_type = 'transfer' then
    insert into public.stock_ledger (
      org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
      transaction_date, branch_id, reference_doc, notes, recorded_by
    ) values (
      v_org_id, p_item_id, p_warehouse_id, 'transfer_out', abs(p_quantity),
      coalesce(nullif(p_unit_cost, 0), v_item_cost), p_transaction_date,
      v_source_branch_id, v_reference, nullif(btrim(p_notes), ''), p_actor_id
    ) returning id into v_out_id;

    insert into public.stock_ledger (
      org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
      transaction_date, branch_id, reference_doc, notes, recorded_by
    ) values (
      v_org_id, p_item_id, p_destination_warehouse_id, 'transfer_in', abs(p_quantity),
      coalesce(nullif(p_unit_cost, 0), v_item_cost), p_transaction_date,
      v_destination_branch_id, v_reference, nullif(btrim(p_notes), ''), p_actor_id
    ) returning id into v_in_id;

    return jsonb_build_object('movement_id', v_out_id, 'paired_movement_id', v_in_id, 'reference_doc', v_reference);
  end if;

  v_transaction_type := p_transaction_type::public.stock_txn_type;
  insert into public.stock_ledger (
    org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
    transaction_date, flock_id, batch_id, branch_id, farm_id, house_id,
    supplier_name, invoice_number, procurement_type, notes, reference_doc, recorded_by
  ) values (
    v_org_id, p_item_id, p_warehouse_id, v_transaction_type, p_quantity,
    coalesce(nullif(p_unit_cost, 0), v_item_cost), p_transaction_date,
    p_flock_id, v_batch_id, v_branch_id, v_farm_id, v_house_id,
    nullif(btrim(p_supplier_name), ''), nullif(btrim(p_invoice_number), ''),
    p_procurement_type, nullif(btrim(p_notes), ''), v_reference, p_actor_id
  ) returning id into v_out_id;

  return jsonb_build_object('movement_id', v_out_id, 'reference_doc', v_reference);
end;
$$;


ALTER FUNCTION "public"."record_inventory_movement"("p_actor_id" "uuid", "p_item_id" "uuid", "p_warehouse_id" "uuid", "p_transaction_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_transaction_date" "date", "p_destination_warehouse_id" "uuid", "p_branch_id" "uuid", "p_farm_id" "uuid", "p_house_id" "uuid", "p_flock_id" "uuid", "p_batch_id" "uuid", "p_procurement_type" "public"."procurement_type", "p_supplier_name" "text", "p_invoice_number" "text", "p_reference_doc" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_support_access"("p_path" "text", "p_method" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_session public.break_glass_sessions;
begin
  select * into v_session from public.break_glass_sessions where administrator_id=auth.uid() and started_at<=now() and expires_at>now() and revoked_at is null order by expires_at desc limit 1;
  if not found then raise exception 'Active support session required.' using errcode='42501'; end if;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,entity_table,entity_id,metadata)
  values(v_session.target_org_id,auth.uid(),'system_admin',v_session.id,case when upper(p_method) in ('POST','PUT','PATCH','DELETE') then 'break_glass.mutation_access' else 'break_glass.read_access' end,'http_request',p_path,jsonb_build_object('method',upper(p_method)));
end $$;


ALTER FUNCTION "public"."record_support_access"("p_path" "text", "p_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_business_hard_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ begin raise exception 'Business records cannot be hard-deleted. Void the record with a reason.' using errcode='42501'; end $$;


ALTER FUNCTION "public"."reject_business_hard_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reopen_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org_id uuid; v_role text; v_farm_id uuid; v_branch_id uuid; v_source_key text := p_flock_id::text || ':' || p_record_date::text;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then raise exception 'Actor does not match the authenticated user.' using errcode = '42501'; end if;
  select p.org_id, p.role::text into v_org_id, v_role from public.profiles p where p.id = p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','ceo','system_admin','super_admin') then raise exception 'User cannot reopen a feeding day.' using errcode = '42501'; end if;
  select f.farm_id, fa.branch_id into v_farm_id, v_branch_id from public.flocks f join public.farms fa on fa.id = f.farm_id
  where f.id = p_flock_id and f.org_id = v_org_id;
  if not found then raise exception 'Flock is not available in this organization.' using errcode = '22023'; end if;
  if v_role = 'farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id = p_actor_id and a.farm_id = v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id = p_actor_id and a.branch_id = v_branch_id)) then
    raise exception 'User does not have access to this flock.' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null then raise exception 'A reopen reason is required.' using errcode = '22023'; end if;
  update public.feed_day_closures set status = 'reopened', reopened_by = p_actor_id, reopened_at = now(), reopen_reason = btrim(p_reason), updated_at = now()
  where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date and status = 'closed';
  if not found then raise exception 'Closed feeding day was not found.' using errcode = '22023'; end if;
  delete from public.stock_ledger where org_id = v_org_id and source_kind = 'feed_day_close' and source_key = v_source_key;
  update public.daily_farm_records set feed_intake_grams = null, feed_intake_quantity = null, feed_type = null, synced = false, updated_at = now()
  where org_id = v_org_id and flock_id = p_flock_id and record_date = p_record_date;
  return jsonb_build_object('status', 'reopened');
end;
$$;


ALTER FUNCTION "public"."reopen_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."break_glass_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "target_org_id" "uuid" NOT NULL,
    "administrator_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revocation_reason" "text",
    CONSTRAINT "break_glass_session_max_four_hours" CHECK (("expires_at" <= ("started_at" + '04:00:00'::interval)))
);


ALTER TABLE "public"."break_glass_sessions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_break_glass_session"("p_session_id" "uuid", "p_reason" "text") RETURNS "public"."break_glass_sessions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_session public.break_glass_sessions; v_role text;
begin
  v_role:=public.current_active_role();
  if length(trim(coalesce(p_reason,'')))<8 then
    raise exception 'A revocation reason of at least eight characters is required.' using errcode='22023';
  end if;
  select * into v_session from public.break_glass_sessions where id=p_session_id for update;
  if not found then raise exception 'Support session not found.' using errcode='P0002'; end if;
  if not ((v_role='ceo' and v_session.target_org_id=public.current_org_id()) or (v_role='system_admin' and v_session.administrator_id=auth.uid())) then
    raise exception 'Only the tenant CEO or the assigned administrator can end this support session.' using errcode='42501';
  end if;
  if v_session.revoked_at is not null then raise exception 'Support session is already revoked.' using errcode='40001'; end if;

  update public.break_glass_sessions
  set revoked_at=now(),revoked_by=auth.uid(),revocation_reason=trim(p_reason)
  where id=p_session_id returning * into v_session;
  update public.break_glass_requests
  set status='revoked',revoked_at=now(),revoked_by=auth.uid(),revocation_reason=trim(p_reason)
  where id=v_session.request_id;
  insert into public.governance_audit_events(org_id,actor_id,actor_role,support_session_id,event_type,entity_table,entity_id,reason,after_values)
  values(v_session.target_org_id,auth.uid(),v_role,v_session.id,'break_glass.revoked','break_glass_sessions',v_session.id::text,trim(p_reason),to_jsonb(v_session));
  return v_session;
end $$;


ALTER FUNCTION "public"."revoke_break_glass_session"("p_session_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_daily_record_with_usage"("p_actor_id" "uuid", "p_daily_record_id" "uuid", "p_flock_id" "uuid", "p_record" "jsonb", "p_usages" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_org_id uuid;
  v_role text;
  v_farm_id uuid;
  v_house_id uuid;
  v_batch_id uuid;
  v_branch_id uuid;
  v_record_id uuid;
  v_record_date date;
  v_usage jsonb;
  v_item_id uuid;
  v_warehouse_id uuid;
  v_quantity numeric;
  v_unit_cost numeric;
  v_item_cost numeric;
  v_category text;
  v_warehouse_branch_id uuid;
  v_available numeric;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then
    raise exception 'Actor does not match the authenticated user.' using errcode = '42501';
  end if;

  select p.org_id, p.role::text into v_org_id, v_role
  from public.profiles p where p.id = p_actor_id;
  if v_org_id is null or v_role <> 'farm_manager' then
    raise exception 'Only farm managers can save daily records.' using errcode = '42501';
  end if;

  select f.farm_id, f.house_id, f.batch_id, h.branch_id
  into v_farm_id, v_house_id, v_batch_id, v_branch_id
  from public.flocks f
  join public.houses h on h.id = f.house_id and h.org_id = f.org_id
  where f.id = p_flock_id and f.org_id = v_org_id;
  if not found then
    raise exception 'Flock is not available in this organization.' using errcode = '22023';
  end if;
  if not (
    exists (select 1 from public.user_farm_access a where a.profile_id = p_actor_id and a.farm_id = v_farm_id)
    or exists (select 1 from public.user_branch_access a where a.profile_id = p_actor_id and a.branch_id = v_branch_id)
  ) then
    raise exception 'User does not have access to this flock.' using errcode = '42501';
  end if;

  if nullif(p_record->>'feed_intake_grams', '') is not null
    or nullif(p_record->>'feed_intake_quantity', '') is not null
    or nullif(p_record->>'feed_type', '') is not null then
    raise exception 'Record feed intake and feed type in Today''s Feeding, then close the feeding day.' using errcode = '22023';
  end if;
  if p_usages is not null and jsonb_typeof(p_usages) <> 'array' then
    raise exception 'Inventory usages must be an array or null.' using errcode = '22023';
  end if;

  v_record_date := nullif(p_record->>'record_date', '')::date;
  if v_record_date is null then
    raise exception 'Record date is required.' using errcode = '22023';
  end if;

  if p_daily_record_id is not null then
    if exists (
      select 1
      from public.daily_farm_records dfr
      join public.feed_day_closures c on c.org_id = dfr.org_id and c.flock_id = dfr.flock_id
        and c.record_date = dfr.record_date and c.status = 'closed'
      where dfr.id = p_daily_record_id and dfr.org_id = v_org_id and dfr.record_date <> v_record_date
    ) then
      raise exception 'Reopen the feeding day before changing this Daily Record date.' using errcode = '55000';
    end if;
    update public.daily_farm_records dfr set
      record_date = v_record_date,
      flock_age_weeks = nullif(p_record->>'flock_age_weeks', '')::integer,
      flock_age_days = nullif(p_record->>'flock_age_days', '')::integer,
      feed_leftover_grams = nullif(p_record->>'feed_leftover_grams', '')::numeric,
      normal_eggs = nullif(p_record->>'normal_eggs', '')::integer,
      broken_eggs = nullif(p_record->>'broken_eggs', '')::integer,
      dirty_eggs = nullif(p_record->>'dirty_eggs', '')::integer,
      total_eggs = nullif(p_record->>'total_eggs', '')::integer,
      average_egg_weight_g = nullif(p_record->>'average_egg_weight_g', '')::numeric,
      production_percentage = nullif(p_record->>'production_percentage', '')::numeric,
      deaths = coalesce(nullif(p_record->>'deaths', '')::integer, 0),
      mortality_percentage = nullif(p_record->>'mortality_percentage', '')::numeric,
      deaths_cause = nullif(btrim(p_record->>'deaths_cause'), ''),
      vaccination_status = nullif(btrim(p_record->>'vaccination_status'), ''),
      medication_vitamins = nullif(btrim(p_record->>'medication_vitamins'), ''),
      opening_birds = nullif(p_record->>'opening_birds', '')::integer,
      closing_birds = nullif(p_record->>'closing_birds', '')::integer,
      culls = coalesce(nullif(p_record->>'culls', '')::integer, 0),
      transfers_in = coalesce(nullif(p_record->>'transfers_in', '')::integer, 0),
      transfers_out = coalesce(nullif(p_record->>'transfers_out', '')::integer, 0),
      other_removals = coalesce(nullif(p_record->>'other_removals', '')::integer, 0),
      water_consumed_liters = nullif(p_record->>'water_consumed_liters', '')::numeric,
      recorded_by = p_actor_id,
      updated_at = now()
    where dfr.id = p_daily_record_id and dfr.org_id = v_org_id and dfr.flock_id = p_flock_id
    returning dfr.id into v_record_id;
    if v_record_id is null then
      raise exception 'Daily record is not available in this organization.' using errcode = '22023';
    end if;
  else
    insert into public.daily_farm_records (
      org_id, flock_id, record_date, flock_age_weeks, flock_age_days, feed_leftover_grams,
      normal_eggs, broken_eggs, dirty_eggs, total_eggs, average_egg_weight_g,
      production_percentage, deaths, mortality_percentage, deaths_cause,
      vaccination_status, medication_vitamins, opening_birds, closing_birds, culls,
      transfers_in, transfers_out, other_removals, water_consumed_liters, recorded_by
    ) values (
      v_org_id, p_flock_id, v_record_date,
      nullif(p_record->>'flock_age_weeks', '')::integer,
      nullif(p_record->>'flock_age_days', '')::integer,
      nullif(p_record->>'feed_leftover_grams', '')::numeric,
      nullif(p_record->>'normal_eggs', '')::integer,
      nullif(p_record->>'broken_eggs', '')::integer,
      nullif(p_record->>'dirty_eggs', '')::integer,
      nullif(p_record->>'total_eggs', '')::integer,
      nullif(p_record->>'average_egg_weight_g', '')::numeric,
      nullif(p_record->>'production_percentage', '')::numeric,
      coalesce(nullif(p_record->>'deaths', '')::integer, 0),
      nullif(p_record->>'mortality_percentage', '')::numeric,
      nullif(btrim(p_record->>'deaths_cause'), ''),
      nullif(btrim(p_record->>'vaccination_status'), ''),
      nullif(btrim(p_record->>'medication_vitamins'), ''),
      nullif(p_record->>'opening_birds', '')::integer,
      nullif(p_record->>'closing_birds', '')::integer,
      coalesce(nullif(p_record->>'culls', '')::integer, 0),
      coalesce(nullif(p_record->>'transfers_in', '')::integer, 0),
      coalesce(nullif(p_record->>'transfers_out', '')::integer, 0),
      coalesce(nullif(p_record->>'other_removals', '')::integer, 0),
      nullif(p_record->>'water_consumed_liters', '')::numeric,
      p_actor_id
    )
    on conflict (org_id, flock_id, record_date) do update set
      flock_age_weeks = excluded.flock_age_weeks,
      flock_age_days = excluded.flock_age_days,
      feed_leftover_grams = excluded.feed_leftover_grams,
      normal_eggs = excluded.normal_eggs,
      broken_eggs = excluded.broken_eggs,
      dirty_eggs = excluded.dirty_eggs,
      total_eggs = excluded.total_eggs,
      average_egg_weight_g = excluded.average_egg_weight_g,
      production_percentage = excluded.production_percentage,
      deaths = excluded.deaths,
      mortality_percentage = excluded.mortality_percentage,
      deaths_cause = excluded.deaths_cause,
      vaccination_status = excluded.vaccination_status,
      medication_vitamins = excluded.medication_vitamins,
      opening_birds = excluded.opening_birds,
      closing_birds = excluded.closing_birds,
      culls = excluded.culls,
      transfers_in = excluded.transfers_in,
      transfers_out = excluded.transfers_out,
      other_removals = excluded.other_removals,
      water_consumed_liters = excluded.water_consumed_liters,
      recorded_by = excluded.recorded_by,
      updated_at = now()
    returning id into v_record_id;
  end if;

  -- Null means an edit that preserves existing non-feed usage. An array explicitly
  -- replaces Daily Records-owned usage; Feed Control-owned rows are never touched.
  if p_usages is not null then
    if exists (
      select 1
      from jsonb_to_recordset(p_usages)
        as x(item_id uuid, warehouse_id uuid, quantity numeric, unit_cost numeric, notes text)
      where x.item_id is null or x.warehouse_id is null or x.quantity is null or x.quantity <= 0
        or coalesce(x.unit_cost, 0) < 0
    ) then
      raise exception 'Every daily usage needs an item, warehouse, positive quantity, and non-negative cost.' using errcode = '22023';
    end if;

    for v_usage in
      select jsonb_build_object(
        'item_id', x.item_id,
        'warehouse_id', x.warehouse_id,
        'quantity', sum(x.quantity),
        'unit_cost', max(x.unit_cost),
        'notes', string_agg(nullif(btrim(x.notes), ''), '; ')
      )
      from jsonb_to_recordset(p_usages)
        as x(item_id uuid, warehouse_id uuid, quantity numeric, unit_cost numeric, notes text)
      group by x.item_id, x.warehouse_id
      order by x.item_id, x.warehouse_id
    loop
      v_item_id := (v_usage->>'item_id')::uuid;
      v_warehouse_id := (v_usage->>'warehouse_id')::uuid;
      v_quantity := (v_usage->>'quantity')::numeric;
      v_unit_cost := coalesce(nullif(v_usage->>'unit_cost', '')::numeric, 0);

      select ii.category::text, coalesce(ii.unit_cost, 0)
      into v_category, v_item_cost
      from public.inventory_items ii
      where ii.id = v_item_id and ii.org_id = v_org_id;
      if not found or v_category not in ('medicine', 'vaccine', 'vitamin', 'supplement', 'packaging', 'miscellaneous') then
        raise exception 'Daily Records can issue only non-feed health or operational items. Record feed in Today''s Feeding.' using errcode = '22023';
      end if;

      select w.branch_id into v_warehouse_branch_id
      from public.warehouses w
      where w.id = v_warehouse_id and w.org_id = v_org_id;
      if not found or v_warehouse_branch_id <> v_branch_id then
        raise exception 'Daily usage warehouse must belong to the flock branch.' using errcode = '22023';
      end if;

      perform pg_advisory_xact_lock(hashtextextended(v_item_id::text || ':' || v_warehouse_id::text, 0));
      select coalesce(sum(public.stock_movement_delta(sl.transaction_type, sl.quantity)), 0)
      into v_available
      from public.stock_ledger sl
      where sl.org_id = v_org_id and sl.item_id = v_item_id and sl.warehouse_id = v_warehouse_id
        and not (sl.source_kind = 'daily_record_usage' and sl.source_key = v_record_id::text);
      if v_available < v_quantity then
        raise exception 'Insufficient stock for daily usage. Available quantity is %.', v_available using errcode = '22023';
      end if;
    end loop;

    delete from public.stock_ledger sl
    where sl.org_id = v_org_id
      and sl.source_kind = 'daily_record_usage'
      and sl.source_key = v_record_id::text;

    insert into public.stock_ledger (
      org_id, item_id, warehouse_id, transaction_type, quantity, unit_cost,
      transaction_date, flock_id, batch_id, branch_id, farm_id, house_id,
      notes, reference_doc, daily_record_id, recorded_by, source_kind, source_key
    )
    select
      v_org_id, x.item_id, x.warehouse_id, 'issue', sum(x.quantity),
      coalesce(nullif(max(x.unit_cost), 0), max(ii.unit_cost), 0), v_record_date,
      p_flock_id, v_batch_id, v_branch_id, v_farm_id, v_house_id,
      string_agg(nullif(btrim(x.notes), ''), '; '), 'DAILY_RECORD:' || v_record_id::text,
      v_record_id, p_actor_id, 'daily_record_usage', v_record_id::text
    from jsonb_to_recordset(p_usages)
      as x(item_id uuid, warehouse_id uuid, quantity numeric, unit_cost numeric, notes text)
    join public.inventory_items ii on ii.id = x.item_id and ii.org_id = v_org_id
    group by x.item_id, x.warehouse_id;
  end if;

  return jsonb_build_object(
    'daily_record_id', v_record_id,
    'usage_count', case when p_usages is null then null else jsonb_array_length(p_usages) end,
    'usage_preserved', p_usages is null
  );
end;
$$;


ALTER FUNCTION "public"."save_daily_record_with_usage"("p_actor_id" "uuid", "p_daily_record_id" "uuid", "p_flock_id" "uuid", "p_record" "jsonb", "p_usages" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_feed_template"("p_actor_id" "uuid", "p_batch_id" "uuid", "p_name" "text", "p_source_type" "text", "p_rows" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_org_id uuid; v_role text; v_farm_id uuid; v_branch_id uuid; v_placement date; v_age integer;
  v_template_id uuid; v_rows integer; v_tasks integer; v_schedules integer;
begin
  if auth.uid() is not null and auth.uid() <> p_actor_id then raise exception 'Actor does not match the authenticated user.' using errcode='42501'; end if;
  select p.org_id,p.role::text into v_org_id,v_role from public.profiles p where p.id=p_actor_id;
  if v_org_id is null or v_role not in ('farm_manager','ceo','system_admin','super_admin') then raise exception 'User cannot manage feed templates.' using errcode='42501'; end if;
  select b.farm_id,b.branch_id,b.placement_date,coalesce(b.age_at_placement_days,0) into v_farm_id,v_branch_id,v_placement,v_age
    from public.batches b where b.id=p_batch_id and b.org_id=v_org_id;
  if not found then raise exception 'Batch is not available in this organization.' using errcode='22023'; end if;
  if v_role='farm_manager' and not (exists(select 1 from public.user_farm_access a where a.profile_id=p_actor_id and a.farm_id=v_farm_id)
    or exists(select 1 from public.user_branch_access a where a.profile_id=p_actor_id and a.branch_id=v_branch_id)) then
    raise exception 'User does not have access to this batch.' using errcode='42501';
  end if;
  if p_source_type not in ('breed_standard','manual','upload') then raise exception 'Unsupported template source.' using errcode='22023'; end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then raise exception 'Add at least one template row.' using errcode='22023'; end if;

  if exists(select 1 from jsonb_to_recordset(p_rows) x(week_number int,age_day_start int,age_day_end int,feed_intake_std_g_per_head numeric,feed_intake_recommended_g_per_head numeric,target_weight_min_g numeric,target_weight_max_g numeric,feed_type_plan text,light_on_time text,light_off_time text)
    where week_number<0 or age_day_start<0 or age_day_end<age_day_start or coalesce(feed_intake_recommended_g_per_head,-1)<0
      or target_weight_min_g is null or target_weight_max_g is null or target_weight_min_g<0 or target_weight_max_g<target_weight_min_g or nullif(btrim(feed_type_plan),'') is null) then
    raise exception 'Template rows need valid ages, non-negative feed, an ordered weight band, and a feed plan.' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_to_recordset(p_rows) x(week_number int) group by week_number having count(*)>1) then
    raise exception 'Template weeks must be unique.' using errcode='22023';
  end if;
  if exists(
    with r as (select ordinality n,x.* from jsonb_to_recordset(p_rows) with ordinality x(week_number int,age_day_start int,age_day_end int,feed_intake_std_g_per_head numeric,feed_intake_recommended_g_per_head numeric,target_weight_min_g numeric,target_weight_max_g numeric,feed_type_plan text,light_on_time text,light_off_time text,ordinality bigint))
    select 1 from r a join r b on a.n<b.n and a.age_day_start<=b.age_day_end and b.age_day_start<=a.age_day_end
  ) then raise exception 'Template age ranges cannot overlap.' using errcode='22023'; end if;

  update public.batch_feed_templates set is_active=false,updated_at=now() where org_id=v_org_id and batch_id=p_batch_id and is_active;
  insert into public.batch_feed_templates(org_id,batch_id,name,source_type,is_active,created_by)
    values(v_org_id,p_batch_id,coalesce(nullif(btrim(p_name),''),'Batch feed template'),p_source_type,true,p_actor_id) returning id into v_template_id;
  insert into public.batch_feed_template_rows(template_id,week_number,age_day_start,age_day_end,feed_intake_std_g_per_head,feed_intake_recommended_g_per_head,target_weight_min_g,target_weight_max_g,feed_type_plan,light_on_time,light_off_time,row_order)
  select v_template_id,x.week_number,x.age_day_start,x.age_day_end,x.feed_intake_std_g_per_head,x.feed_intake_recommended_g_per_head,x.target_weight_min_g,x.target_weight_max_g,btrim(x.feed_type_plan),nullif(x.light_on_time,'')::time,nullif(x.light_off_time,'')::time,(x.ordinality-1)::int
  from jsonb_to_recordset(p_rows) with ordinality x(week_number int,age_day_start int,age_day_end int,feed_intake_std_g_per_head numeric,feed_intake_recommended_g_per_head numeric,target_weight_min_g numeric,target_weight_max_g numeric,feed_type_plan text,light_on_time text,light_off_time text,ordinality bigint);
  get diagnostics v_rows=row_count;

  insert into public.batch_feed_template_milestones(template_id,week_number,trigger_day,title,category,notes,is_required)
  select id,week_number,age_day_start,'Switch feed plan to '||feed_type_plan,'feed',
    case when light_on_time is not null and light_off_time is not null then 'Lighting '||to_char(light_on_time,'HH24:MI')||'–'||to_char(light_off_time,'HH24:MI') end,true
  from (select r.*,lag(feed_type_plan) over(order by row_order) prior_feed from public.batch_feed_template_rows r where template_id=v_template_id) q
  where prior_feed is null or prior_feed is distinct from feed_type_plan;

  insert into public.batch_weight_check_tasks(org_id,batch_id,flock_id,template_row_id,due_week_number,due_date,status,weight_record_id,created_by)
  select v_org_id,p_batch_id,f.id,r.id,r.week_number,(v_placement+(r.week_number*7-v_age))::date,
    case when w.id is not null then 'completed' else 'scheduled' end,w.id,p_actor_id
  from public.flocks f join public.batch_feed_template_rows r on r.template_id=v_template_id and r.week_number%2=0
  left join lateral (select wr.id from public.weight_records wr where wr.org_id=v_org_id and wr.flock_id=f.id
    and floor(((wr.record_date-v_placement)+v_age)/7.0)=r.week_number order by wr.record_date desc limit 1) w on true
  where f.org_id=v_org_id and f.batch_id=p_batch_id and ((v_placement+(r.week_number*7-v_age))::date>=timezone('Africa/Addis_Ababa',now())::date or w.id is not null)
  on conflict(org_id,batch_id,flock_id,due_week_number) do update set template_row_id=excluded.template_row_id,due_date=excluded.due_date,
    status=case when excluded.weight_record_id is not null then 'completed' else public.batch_weight_check_tasks.status end,
    weight_record_id=coalesce(excluded.weight_record_id,public.batch_weight_check_tasks.weight_record_id),updated_at=now();
  get diagnostics v_tasks=row_count;

  insert into public.feeding_schedules(org_id,batch_id,schedule_date,feed_type,planned_feed_kg,target_grams_per_bird,notes,created_by)
  select v_org_id,p_batch_id,d::date,r.feed_type_plan,round((sum(f.current_count)*r.feed_intake_recommended_g_per_head/1000.0)::numeric,2),r.feed_intake_recommended_g_per_head,'Generated from active batch feed template',p_actor_id
  from generate_series(timezone('Africa/Addis_Ababa',now())::date,timezone('Africa/Addis_Ababa',now())::date+89,'1 day') d
  join public.batch_feed_template_rows r on r.template_id=v_template_id and ((d::date-v_placement)+v_age) between r.age_day_start and r.age_day_end
  join public.flocks f on f.org_id=v_org_id and f.batch_id=p_batch_id and f.status='active'
  group by d,r.feed_type_plan,r.feed_intake_recommended_g_per_head
  on conflict(org_id,batch_id,schedule_date) do update set feed_type=excluded.feed_type,planned_feed_kg=excluded.planned_feed_kg,target_grams_per_bird=excluded.target_grams_per_bird,notes=excluded.notes,updated_at=now();
  get diagnostics v_schedules=row_count;
  return jsonb_build_object('template_id',v_template_id,'rows',v_rows,'tasks',v_tasks,'schedules',v_schedules);
end;
$$;


ALTER FUNCTION "public"."save_feed_template"("p_actor_id" "uuid", "p_batch_id" "uuid", "p_name" "text", "p_source_type" "text", "p_rows" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_batch_total_cost_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.total_batch_cost is null then
    new.total_batch_cost :=
      coalesce(new.purchase_cost_per_bird, 0) * new.total_count +
      coalesce(new.transport_cost, 0) +
      coalesce(new.other_cost, 0);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_batch_total_cost_default"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_default_profile_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.role is null then
    new.role := public.normalize_user_role(
      coalesce(
        current_setting('request.jwt.claims', true)::jsonb ->> 'role',
        current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role'
      )
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_default_profile_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_mortality_events_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_mortality_events_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stock_movement_delta"("p_transaction_type" "public"."stock_txn_type", "p_quantity" numeric) RETURNS numeric
    LANGUAGE "sql" IMMUTABLE STRICT
    SET "search_path" TO 'public'
    AS $$
  select case
    when p_transaction_type in ('issue', 'transfer_out') then -abs(p_quantity)
    when p_transaction_type = 'adjustment' then p_quantity
    else abs(p_quantity)
  end;
$$;


ALTER FUNCTION "public"."stock_movement_delta"("p_transaction_type" "public"."stock_txn_type", "p_quantity" numeric) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alert_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "farm_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "uuid",
    "metric" "text" NOT NULL,
    "operator" "text" NOT NULL,
    "threshold" numeric NOT NULL,
    "severity" "public"."alert_priority" DEFAULT 'medium'::"public"."alert_priority" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alert_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "rule_id" "uuid",
    "category" "public"."alert_category" NOT NULL,
    "priority" "public"."alert_priority" DEFAULT 'info'::"public"."alert_priority" NOT NULL,
    "message" "text" NOT NULL,
    "status" "public"."alert_status" DEFAULT 'open'::"public"."alert_status" NOT NULL,
    "triggered_value" numeric,
    "triggered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alerts" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."batch_code_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."batch_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_feed_template_milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "week_number" integer,
    "trigger_day" integer NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" DEFAULT 'feed'::"text" NOT NULL,
    "notes" "text",
    "is_required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "batch_feed_template_milestones_category_check" CHECK (("category" = ANY (ARRAY['feed'::"text", 'weight'::"text", 'vaccine'::"text", 'light'::"text", 'note'::"text"]))),
    CONSTRAINT "batch_feed_template_milestones_trigger_day_check" CHECK (("trigger_day" >= 0)),
    CONSTRAINT "batch_feed_template_milestones_week_number_check" CHECK ((("week_number" IS NULL) OR ("week_number" >= 0)))
);


ALTER TABLE "public"."batch_feed_template_milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_feed_template_rows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "week_number" integer NOT NULL,
    "age_day_start" integer NOT NULL,
    "age_day_end" integer NOT NULL,
    "feed_intake_std_g_per_head" numeric(10,2),
    "feed_intake_recommended_g_per_head" numeric(10,2),
    "target_weight_min_g" numeric(10,2),
    "target_weight_max_g" numeric(10,2),
    "feed_type_plan" "text",
    "light_on_time" time without time zone,
    "light_off_time" time without time zone,
    "row_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "batch_feed_template_rows_age_day_start_check" CHECK (("age_day_start" >= 0)),
    CONSTRAINT "batch_feed_template_rows_check" CHECK (("age_day_end" >= "age_day_start")),
    CONSTRAINT "batch_feed_template_rows_week_number_check" CHECK (("week_number" >= 0))
);


ALTER TABLE "public"."batch_feed_template_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_feed_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "source_type" "text" DEFAULT 'manual'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "batch_feed_templates_source_type_check" CHECK (("source_type" = ANY (ARRAY['default'::"text", 'breed_standard'::"text", 'manual'::"text", 'upload'::"text"])))
);


ALTER TABLE "public"."batch_feed_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_weight_check_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "template_row_id" "uuid",
    "due_week_number" integer NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "weight_record_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    CONSTRAINT "batch_weight_check_tasks_due_week_number_check" CHECK (("due_week_number" >= 0)),
    CONSTRAINT "batch_weight_check_tasks_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'missed'::"text"])))
);


ALTER TABLE "public"."batch_weight_check_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "house_id" "uuid" NOT NULL,
    "batch_code" "text" NOT NULL,
    "source" "public"."flock_source" NOT NULL,
    "supplier_name" "text",
    "purchase_date" "date",
    "placement_date" "date" NOT NULL,
    "age_at_placement_days" integer NOT NULL,
    "male_count" integer DEFAULT 0,
    "female_count" integer DEFAULT 0,
    "total_count" integer NOT NULL,
    "purchase_cost_per_bird" numeric(12,2),
    "transport_cost" numeric(12,2) DEFAULT 0,
    "other_cost" numeric(12,2) DEFAULT 0,
    "total_batch_cost" numeric(14,2),
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    CONSTRAINT "batches_age_non_negative" CHECK (("age_at_placement_days" >= 0)),
    CONSTRAINT "batches_costs_non_negative" CHECK (((COALESCE("purchase_cost_per_bird", (0)::numeric) >= (0)::numeric) AND (COALESCE("transport_cost", (0)::numeric) >= (0)::numeric) AND (COALESCE("other_cost", (0)::numeric) >= (0)::numeric) AND (COALESCE("total_batch_cost", (0)::numeric) >= (0)::numeric))),
    CONSTRAINT "batches_female_count_non_negative" CHECK ((COALESCE("female_count", 0) >= 0)),
    CONSTRAINT "batches_male_count_non_negative" CHECK ((COALESCE("male_count", 0) >= 0)),
    CONSTRAINT "batches_total_count_positive" CHECK (("total_count" > 0))
);


ALTER TABLE "public"."batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."biosecurity_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "checklist_date" "date" NOT NULL,
    "completed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text"
);


ALTER TABLE "public"."biosecurity_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branch_intake_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "batch_code" "text" DEFAULT "public"."generate_batch_code"() NOT NULL,
    "source" "public"."flock_source" NOT NULL,
    "supplier_name" "text",
    "purchase_date" "date",
    "placement_date" "date" NOT NULL,
    "total_count" integer NOT NULL,
    "purchase_cost_per_bird" numeric(12,2),
    "transport_cost" numeric(12,2) DEFAULT 0,
    "other_cost" numeric(12,2) DEFAULT 0,
    "total_cost" numeric(14,2),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bib_total_count_positive" CHECK (("total_count" > 0))
);


ALTER TABLE "public"."branch_intake_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breed_standards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "breed_id" "uuid" NOT NULL,
    "week_number" integer NOT NULL,
    "target_weight_g" numeric,
    "target_feed_g" numeric,
    "target_mortality_pct" numeric,
    "target_hdep_pct" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."breed_standards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."breeds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."flock_type" NOT NULL,
    "breeder" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."breeds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certificates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "issued_at" timestamp with time zone,
    "certificate_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."certificates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chart_of_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "account_type" "public"."account_type" NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chart_of_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "cost_entry_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "farm_id" "uuid",
    "house_id" "uuid",
    "flock_id" "uuid",
    "batch_id" "uuid",
    "allocation_method" "public"."cost_allocation_method" DEFAULT 'direct'::"public"."cost_allocation_method" NOT NULL,
    "allocation_percent" numeric(7,4),
    "allocated_amount" numeric(14,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cost_allocations_allocated_amount_check" CHECK (("allocated_amount" >= (0)::numeric)),
    CONSTRAINT "cost_allocations_allocation_percent_check" CHECK ((("allocation_percent" IS NULL) OR (("allocation_percent" >= (0)::numeric) AND ("allocation_percent" <= (100)::numeric))))
);


ALTER TABLE "public"."cost_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "period_id" "uuid",
    "branch_id" "uuid",
    "farm_id" "uuid",
    "house_id" "uuid",
    "flock_id" "uuid",
    "batch_id" "uuid",
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "category" "public"."cost_entry_category" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "allocation_method" "public"."cost_allocation_method" DEFAULT 'direct'::"public"."cost_allocation_method" NOT NULL,
    "supplier_name" "text",
    "invoice_number" "text",
    "reference_doc" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cost_entries_amount_check" CHECK (("amount" >= (0)::numeric))
);


ALTER TABLE "public"."cost_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_egg_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "record_date" "date" NOT NULL,
    "total_eggs" integer,
    "good_eggs" integer,
    "broken_eggs" integer,
    "dirty_eggs" integer,
    "floor_eggs" integer,
    "hdep" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_egg_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_farm_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "record_date" "date" NOT NULL,
    "deaths" integer DEFAULT 0,
    "deaths_cause" "text",
    "feed_type" "public"."feed_type",
    "recorded_by" "uuid",
    "synced" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "flock_age_weeks" integer,
    "flock_age_days" integer,
    "normal_eggs" integer,
    "broken_eggs" integer,
    "total_eggs" integer,
    "production_percentage" numeric(6,2),
    "mortality_percentage" numeric(6,2),
    "vaccination_status" "text",
    "medication_vitamins" "text",
    "feed_intake_grams" numeric(12,2),
    "feed_intake_quantity" numeric(12,2),
    "feed_leftover_grams" numeric(12,2),
    "opening_birds" integer,
    "closing_birds" integer,
    "culls" integer DEFAULT 0,
    "transfers_in" integer DEFAULT 0,
    "transfers_out" integer DEFAULT 0,
    "other_removals" integer DEFAULT 0,
    "dirty_eggs" integer,
    "average_egg_weight_g" numeric(8,2),
    "water_consumed_liters" numeric(12,2),
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    CONSTRAINT "daily_farm_records_deaths_non_negative" CHECK ((("deaths" IS NULL) OR ("deaths" >= 0))),
    CONSTRAINT "daily_farm_records_egg_counts_non_negative" CHECK (((("normal_eggs" IS NULL) OR ("normal_eggs" >= 0)) AND (("broken_eggs" IS NULL) OR ("broken_eggs" >= 0)) AND (("total_eggs" IS NULL) OR ("total_eggs" >= 0)))),
    CONSTRAINT "daily_farm_records_executive_inputs_non_negative" CHECK (((("opening_birds" IS NULL) OR ("opening_birds" >= 0)) AND (("closing_birds" IS NULL) OR ("closing_birds" >= 0)) AND (COALESCE("culls", 0) >= 0) AND (COALESCE("transfers_in", 0) >= 0) AND (COALESCE("transfers_out", 0) >= 0) AND (COALESCE("other_removals", 0) >= 0) AND (("dirty_eggs" IS NULL) OR ("dirty_eggs" >= 0)) AND (("average_egg_weight_g" IS NULL) OR ("average_egg_weight_g" > (0)::numeric)) AND (("water_consumed_liters" IS NULL) OR ("water_consumed_liters" >= (0)::numeric)))),
    CONSTRAINT "daily_farm_records_feed_intake_non_negative" CHECK (((("feed_intake_grams" IS NULL) OR ("feed_intake_grams" >= (0)::numeric)) AND (("feed_intake_quantity" IS NULL) OR ("feed_intake_quantity" >= (0)::numeric))))
);


ALTER TABLE "public"."daily_farm_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_sales_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "farm_id" "uuid",
    "house_id" "uuid",
    "flock_id" "uuid",
    "batch_id" "uuid",
    "sale_date" "date" NOT NULL,
    "product_category" "text" NOT NULL,
    "product_label" "text" NOT NULL,
    "quantity" numeric(12,2) NOT NULL,
    "unit" "text" NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "gross_amount" numeric(14,2) NOT NULL,
    "paid_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "balance_due" numeric(14,2) DEFAULT 0 NOT NULL,
    "payment_method" "text",
    "customer_name" "text",
    "customer_phone" "text",
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    CONSTRAINT "daily_sales_paid_not_above_gross" CHECK (("paid_amount" <= "gross_amount")),
    CONSTRAINT "daily_sales_records_balance_due_check" CHECK (("balance_due" >= (0)::numeric)),
    CONSTRAINT "daily_sales_records_gross_amount_check" CHECK (("gross_amount" >= (0)::numeric)),
    CONSTRAINT "daily_sales_records_paid_amount_check" CHECK (("paid_amount" >= (0)::numeric)),
    CONSTRAINT "daily_sales_records_product_category_check" CHECK (("product_category" = ANY (ARRAY['egg'::"text", 'bird'::"text", 'training'::"text", 'equipment_medicine'::"text", 'consultancy'::"text", 'package'::"text"]))),
    CONSTRAINT "daily_sales_records_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "daily_sales_records_unit_price_check" CHECK (("unit_price" >= (0)::numeric)),
    CONSTRAINT "daily_sales_scope_present" CHECK ((("product_category" <> ALL (ARRAY['egg'::"text", 'bird'::"text"])) OR ("farm_id" IS NOT NULL) OR ("flock_id" IS NOT NULL) OR ("batch_id" IS NOT NULL)))
);


ALTER TABLE "public"."daily_sales_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."farms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "capacity_birds" integer,
    "latitude" numeric(9,6),
    "longitude" numeric(9,6),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."farms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feed_control_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "warning_variance_pct" numeric(6,2) DEFAULT 5 NOT NULL,
    "critical_variance_pct" numeric(6,2) DEFAULT 10 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feed_control_settings_check" CHECK (("critical_variance_pct" > "warning_variance_pct")),
    CONSTRAINT "feed_control_settings_warning_variance_pct_check" CHECK (("warning_variance_pct" > (0)::numeric))
);


ALTER TABLE "public"."feed_control_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feed_day_closures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "record_date" "date" NOT NULL,
    "status" "text" DEFAULT 'closed'::"text" NOT NULL,
    "planned_feed_kg" numeric(12,2) DEFAULT 0 NOT NULL,
    "actual_feed_kg" numeric(12,2) NOT NULL,
    "variance_kg" numeric(12,2) DEFAULT 0 NOT NULL,
    "override_reason" "text",
    "closed_by" "uuid",
    "closed_at" timestamp with time zone,
    "reopened_by" "uuid",
    "reopened_at" timestamp with time zone,
    "reopen_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feed_day_closures_actual_feed_kg_check" CHECK (("actual_feed_kg" >= (0)::numeric)),
    CONSTRAINT "feed_day_closures_planned_feed_kg_check" CHECK (("planned_feed_kg" >= (0)::numeric)),
    CONSTRAINT "feed_day_closures_status_check" CHECK (("status" = ANY (ARRAY['closed'::"text", 'reopened'::"text"])))
);


ALTER TABLE "public"."feed_day_closures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feed_milestone_executions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "milestone_id" "uuid" NOT NULL,
    "flock_id" "uuid",
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "completed_by" "uuid",
    "completed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feed_milestone_executions_status_check" CHECK (("status" = ANY (ARRAY['completed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."feed_milestone_executions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feeding_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "schedule_date" "date" NOT NULL,
    "feed_type" "text" NOT NULL,
    "planned_feed_kg" numeric(10,2) NOT NULL,
    "target_grams_per_bird" numeric(10,2),
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feeding_schedules_planned_feed_positive" CHECK (("planned_feed_kg" > (0)::numeric)),
    CONSTRAINT "feeding_schedules_target_grams_non_negative" CHECK ((("target_grams_per_bird" IS NULL) OR ("target_grams_per_bird" >= (0)::numeric)))
);


ALTER TABLE "public"."feeding_schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feeding_session_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "record_date" "date" NOT NULL,
    "session_name" "text" NOT NULL,
    "session_time" time without time zone,
    "feeders_count" integer NOT NULL,
    "planned_feed_kg" numeric(10,2) NOT NULL,
    "actual_feed_kg" numeric(10,2),
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "feed_item_id" "uuid",
    "warehouse_id" "uuid",
    "feed_type" "public"."feed_type",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    CONSTRAINT "feeding_session_records_actual_non_negative" CHECK ((("actual_feed_kg" IS NULL) OR ("actual_feed_kg" >= (0)::numeric))),
    CONSTRAINT "feeding_session_records_feeders_positive" CHECK (("feeders_count" > 0)),
    CONSTRAINT "feeding_session_records_planned_positive" CHECK (("planned_feed_kg" > (0)::numeric)),
    CONSTRAINT "feeding_session_records_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'completed'::"text", 'missed'::"text"])))
);


ALTER TABLE "public"."feeding_session_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flock_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "from_house_id" "uuid" NOT NULL,
    "to_house_id" "uuid" NOT NULL,
    "transfer_date" "date" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."flock_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "house_id" "uuid" NOT NULL,
    "flock_code" "text" NOT NULL,
    "flock_type" "public"."flock_type" NOT NULL,
    "breed_id" "uuid",
    "source" "public"."flock_source" NOT NULL,
    "placement_date" "date" NOT NULL,
    "initial_count" integer NOT NULL,
    "current_count" integer NOT NULL,
    "age_at_placement_days" integer NOT NULL,
    "purchase_cost_per_bird" numeric(12,2),
    "status" "public"."flock_status" DEFAULT 'active'::"public"."flock_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "intake_batch_id" "uuid",
    "batch_id" "uuid"
);


ALTER TABLE "public"."flocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_audit_events" (
    "id" bigint NOT NULL,
    "org_id" "uuid",
    "actor_id" "uuid",
    "actor_role" "text",
    "support_session_id" "uuid",
    "event_type" "text" NOT NULL,
    "entity_table" "text",
    "entity_id" "text",
    "reason" "text",
    "before_values" "jsonb",
    "after_values" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."governance_audit_events" OWNER TO "postgres";


ALTER TABLE "public"."governance_audit_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."governance_audit_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."governance_scheduler_health" (
    "scheduler_key" "text" NOT NULL,
    "last_started_at" timestamp with time zone,
    "last_completed_at" timestamp with time zone,
    "last_locked_count" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "governance_scheduler_health_key" CHECK (("scheduler_key" = 'operating_day_lock'::"text"))
);


ALTER TABLE "public"."governance_scheduler_health" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."health_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "event_date" "date" NOT NULL,
    "event_type" "public"."health_event_type" NOT NULL,
    "description" "text",
    "diagnosis" "text",
    "treatment" "text",
    "attachment_url" "text",
    "vet_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    "external_veterinarian_name" "text",
    "veterinarian_recommendation" "text",
    "veterinarian_reference" "text",
    "veterinarian_attachment" "jsonb",
    "recommendation_status" "text",
    CONSTRAINT "health_events_recommendation_status_check" CHECK ((("recommendation_status" IS NULL) OR ("recommendation_status" = ANY (ARRAY['received'::"text", 'planned'::"text", 'implemented'::"text", 'declined'::"text"]))))
);


ALTER TABLE "public"."health_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."houses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "house_type" "public"."house_type" NOT NULL,
    "capacity" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."houses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."inventory_category" NOT NULL,
    "unit" "text" NOT NULL,
    "reorder_level" numeric(12,2) DEFAULT 0,
    "unit_cost" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_physical_counts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "count_date" "date" NOT NULL,
    "ledger_quantity" numeric(14,3) NOT NULL,
    "counted_quantity" numeric(14,3) NOT NULL,
    "variance" numeric(14,3) GENERATED ALWAYS AS (("counted_quantity" - "ledger_quantity")) STORED,
    "unit_cost" numeric(12,2) DEFAULT 0 NOT NULL,
    "counted_by" "uuid" NOT NULL,
    "notes" "text",
    "evidence" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_physical_counts_counted_quantity_check" CHECK (("counted_quantity" >= (0)::numeric)),
    CONSTRAINT "inventory_physical_counts_unit_cost_check" CHECK (("unit_cost" >= (0)::numeric))
);


ALTER TABLE "public"."inventory_physical_counts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inventory_physical_counts"."ledger_quantity" IS 'Immutable system balance captured at the moment of the physical count.';



CREATE TABLE IF NOT EXISTS "public"."journal_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "entry_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "description" "text",
    "source" "text",
    "source_id" "uuid",
    "posted" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."journal_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."journal_entry_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journal_entry_id" "uuid" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "debit" numeric(14,2) DEFAULT 0 NOT NULL,
    "credit" numeric(14,2) DEFAULT 0 NOT NULL,
    "flock_id" "uuid",
    "farm_id" "uuid",
    "branch_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "journal_entry_lines_check" CHECK (((("debit" >= (0)::numeric) AND ("credit" = (0)::numeric)) OR (("debit" = (0)::numeric) AND ("credit" >= (0)::numeric))))
);


ALTER TABLE "public"."journal_entry_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lead_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "activity_type" "public"."lead_activity_type" NOT NULL,
    "description" "text",
    "outcome" "text",
    "next_action" "text",
    "next_action_date" "date",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lead_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "location" "text",
    "lead_source" "public"."lead_source" DEFAULT 'walk_in'::"public"."lead_source" NOT NULL,
    "source_detail" "text",
    "farm_size_interest" integer,
    "pipeline_stage" "public"."lead_stage" DEFAULT 'new'::"public"."lead_stage" NOT NULL,
    "assigned_to" "uuid",
    "last_activity" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."management_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "scope_type" "text" NOT NULL,
    "scope_id" "uuid",
    "period_month" "date" NOT NULL,
    "revenue_target_etb" numeric(14,2),
    "operating_margin_target_pct" numeric(7,2),
    "cash_collection_target_pct" numeric(7,2),
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "management_targets_check" CHECK (((("scope_type" = 'organization'::"text") AND ("scope_id" IS NULL)) OR (("scope_type" <> 'organization'::"text") AND ("scope_id" IS NOT NULL)))),
    CONSTRAINT "management_targets_period_month_check" CHECK (("period_month" = ("date_trunc"('month'::"text", ("period_month")::timestamp with time zone))::"date")),
    CONSTRAINT "management_targets_revenue_target_etb_check" CHECK ((("revenue_target_etb" IS NULL) OR ("revenue_target_etb" >= (0)::numeric))),
    CONSTRAINT "management_targets_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['organization'::"text", 'branch'::"text", 'farm'::"text"])))
);


ALTER TABLE "public"."management_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_cost_periods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "farm_id" "uuid",
    "house_id" "uuid",
    "flock_id" "uuid",
    "batch_id" "uuid",
    "period_start" "date" NOT NULL,
    "period_end" "date" NOT NULL,
    "status" "public"."monthly_cost_status" DEFAULT 'draft'::"public"."monthly_cost_status" NOT NULL,
    "total_normal_eggs" integer DEFAULT 0 NOT NULL,
    "total_broken_eggs" integer DEFAULT 0 NOT NULL,
    "total_revenue" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_absorbed_cost" numeric(14,2) DEFAULT 0 NOT NULL,
    "base_cost_per_egg" numeric(12,4),
    "target_margin_per_egg" numeric(12,4) DEFAULT 0 NOT NULL,
    "locked_at" timestamp with time zone,
    "locked_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_paid_revenue" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_balance_due" numeric(14,2) DEFAULT 0 NOT NULL,
    "direct_inventory_cost" numeric(14,2) DEFAULT 0 NOT NULL,
    "bird_cogs" numeric(14,2) DEFAULT 0 NOT NULL,
    "overhead_cost" numeric(14,2) DEFAULT 0 NOT NULL,
    "unallocated_cost" numeric(14,2) DEFAULT 0 NOT NULL,
    "excluded_duplicate_cost" numeric(14,2) DEFAULT 0 NOT NULL,
    "operating_profit" numeric(14,2) DEFAULT 0 NOT NULL,
    "cash_operating_surplus" numeric(14,2) DEFAULT 0 NOT NULL,
    "reconciliation_warnings" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "monthly_cost_period_base_cost_check" CHECK ((("base_cost_per_egg" IS NULL) OR ("base_cost_per_egg" >= (0)::numeric))),
    CONSTRAINT "monthly_cost_period_range" CHECK (("period_end" >= "period_start")),
    CONSTRAINT "monthly_cost_periods_reconciliation_non_negative" CHECK ((("total_paid_revenue" >= (0)::numeric) AND ("total_balance_due" >= (0)::numeric) AND ("direct_inventory_cost" >= (0)::numeric) AND ("bird_cogs" >= (0)::numeric) AND ("overhead_cost" >= (0)::numeric) AND ("unallocated_cost" >= (0)::numeric) AND ("excluded_duplicate_cost" >= (0)::numeric))),
    CONSTRAINT "monthly_cost_periods_total_absorbed_cost_check" CHECK (("total_absorbed_cost" >= (0)::numeric)),
    CONSTRAINT "monthly_cost_periods_total_broken_eggs_check" CHECK (("total_broken_eggs" >= 0)),
    CONSTRAINT "monthly_cost_periods_total_normal_eggs_check" CHECK (("total_normal_eggs" >= 0)),
    CONSTRAINT "monthly_cost_periods_total_revenue_check" CHECK (("total_revenue" >= (0)::numeric))
);


ALTER TABLE "public"."monthly_cost_periods" OWNER TO "postgres";


COMMENT ON COLUMN "public"."monthly_cost_periods"."unallocated_cost" IS 'Shared costs compatible with a selected scope but not explicitly allocated to that scope; excluded from operating profit.';



COMMENT ON COLUMN "public"."monthly_cost_periods"."excluded_duplicate_cost" IS 'Manual inventory-category costs excluded because issued stock already supplied the cost basis for that category.';



CREATE TABLE IF NOT EXISTS "public"."mortality_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "record_date" "date" NOT NULL,
    "recorded_time" time without time zone,
    "count" integer NOT NULL,
    "cause" "text" NOT NULL,
    "notes" "text",
    "diagnosis" "text",
    "observed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mortality_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "plan" "text" DEFAULT 'starter'::"text",
    "settings_json" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_count" integer,
    "primary_location" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "operational_day_lock_time" time without time zone DEFAULT '10:00:00'::time without time zone NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_template_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "item_type" "public"."package_item_type" NOT NULL,
    "item_name" "text" NOT NULL,
    "inventory_item_id" "uuid",
    "quantity" numeric(12,3),
    "unit_price" numeric(12,2),
    "is_free" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."package_template_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."package_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."package_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "payment_date" "date",
    "amount" numeric(14,2),
    "payment_type" "public"."payment_type" NOT NULL,
    "method" "public"."payment_method" NOT NULL,
    "reference" "text",
    "received_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pos_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "inventory_item_id" "uuid",
    "quantity" numeric(10,3),
    "unit_price" numeric(12,2),
    "expiry_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pos_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pos_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "transaction_number" "text" NOT NULL,
    "transaction_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subtotal" numeric(12,2),
    "vat_amount" numeric(12,2),
    "total" numeric(12,2),
    "payment_method" "public"."pos_payment_method" NOT NULL,
    "cashier_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pos_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "public"."user_role" DEFAULT 'farm_manager'::"public"."user_role" NOT NULL,
    "phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reconciliation_finding_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "finding_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "note" "text" NOT NULL,
    "evidence" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "support_session_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reconciliation_finding_responses_action_check" CHECK (("action" = ANY (ARRAY['acknowledge'::"text", 'investigate'::"text", 'explain'::"text", 'resolve'::"text", 'accept_exception'::"text", 'reopen'::"text", 'system_clear'::"text", 'system_reopen'::"text"])))
);


ALTER TABLE "public"."reconciliation_finding_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reconciliation_findings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "run_id" "uuid",
    "fingerprint" "text" NOT NULL,
    "rule_code" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "explanation" "text" NOT NULL,
    "recommended_action" "text" NOT NULL,
    "branch_id" "uuid",
    "farm_id" "uuid",
    "house_id" "uuid",
    "flock_id" "uuid",
    "batch_id" "uuid",
    "warehouse_id" "uuid",
    "record_date" "date",
    "expected_value" numeric,
    "recorded_value" numeric,
    "variance" numeric,
    "unit" "text",
    "estimated_impact_etb" numeric,
    "evidence" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "occurrence_count" integer DEFAULT 1 NOT NULL,
    "reopened_count" integer DEFAULT 0 NOT NULL,
    "acknowledged_by" "uuid",
    "acknowledged_at" timestamp with time zone,
    "assigned_to" "uuid",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolution_note" "text",
    "resolution_evidence" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reconciliation_findings_domain_check" CHECK (("domain" = ANY (ARRAY['birds'::"text", 'feed'::"text", 'mortality'::"text", 'eggs_sales'::"text", 'inventory'::"text", 'financial'::"text", 'lineage'::"text", 'governance'::"text"]))),
    CONSTRAINT "reconciliation_findings_occurrence_count_check" CHECK (("occurrence_count" > 0)),
    CONSTRAINT "reconciliation_findings_reopened_count_check" CHECK (("reopened_count" >= 0)),
    CONSTRAINT "reconciliation_findings_severity_check" CHECK (("severity" = ANY (ARRAY['critical'::"text", 'high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "reconciliation_findings_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'acknowledged'::"text", 'investigating'::"text", 'resolved'::"text", 'accepted_exception'::"text", 'cleared'::"text"])))
);


ALTER TABLE "public"."reconciliation_findings" OWNER TO "postgres";


COMMENT ON TABLE "public"."reconciliation_findings" IS 'Durable evidence-backed exceptions. A finding describes a contradiction or missing custody evidence, never an accusation of intent.';



COMMENT ON COLUMN "public"."reconciliation_findings"."fingerprint" IS 'Stable rule and source identity used to deduplicate recurring evaluations and reopen unresolved evidence.';



CREATE TABLE IF NOT EXISTS "public"."reconciliation_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "date_from" "date" NOT NULL,
    "date_to" "date" NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "triggered_by" "uuid",
    "trigger_source" "text" DEFAULT 'application'::"text" NOT NULL,
    "finding_count" integer DEFAULT 0 NOT NULL,
    "critical_count" integer DEFAULT 0 NOT NULL,
    "high_count" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reconciliation_run_range" CHECK (("date_to" >= "date_from")),
    CONSTRAINT "reconciliation_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "reconciliation_runs_trigger_source_check" CHECK (("trigger_source" = ANY (ARRAY['application'::"text", 'manual'::"text", 'scheduler'::"text"])))
);


ALTER TABLE "public"."reconciliation_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alias" "text" NOT NULL,
    "role_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "role_aliases_alias_check" CHECK (("alias" = "lower"("alias")))
);


ALTER TABLE "public"."role_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "default_route" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "roles_code_check" CHECK (("code" = "lower"("code")))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "item_type" "public"."package_item_type" NOT NULL,
    "item_name" "text" NOT NULL,
    "inventory_item_id" "uuid",
    "flock_id" "uuid",
    "quantity" numeric(12,3),
    "unit_price" numeric(12,2),
    "vat_rate" numeric(5,2),
    "is_free" boolean DEFAULT false NOT NULL,
    "line_total" numeric(14,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sales_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "order_number" "text" NOT NULL,
    "lead_id" "uuid",
    "customer_name" "text",
    "customer_phone" "text",
    "customer_address" "text",
    "order_date" "date",
    "delivery_date" "date",
    "subtotal" numeric(14,2),
    "vat_amount" numeric(14,2),
    "total" numeric(14,2),
    "deposit_amount" numeric(14,2),
    "balance_due" numeric(14,2),
    "status" "public"."sales_order_status" DEFAULT 'draft'::"public"."sales_order_status" NOT NULL,
    "assigned_to" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sales_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_unit_conversions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "product_category" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "base_unit" "text" NOT NULL,
    "multiplier" numeric(12,4) NOT NULL,
    "source" "text" DEFAULT 'organization'::"text" NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sales_unit_conversions_multiplier_check" CHECK (("multiplier" > (0)::numeric)),
    CONSTRAINT "sales_unit_conversions_source_check" CHECK (("source" = ANY (ARRAY['system_default'::"text", 'organization'::"text"])))
);


ALTER TABLE "public"."sales_unit_conversions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sensor_readings" (
    "id" bigint NOT NULL,
    "sensor_id" "uuid" NOT NULL,
    "reading_value" numeric(10,4) NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sensor_readings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sensor_readings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sensor_readings_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sensor_readings_id_seq" OWNED BY "public"."sensor_readings"."id";



CREATE TABLE IF NOT EXISTS "public"."sensors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "house_id" "uuid" NOT NULL,
    "sensor_type" "public"."sensor_type" NOT NULL,
    "external_id" "text",
    "status" "text" DEFAULT 'active'::"text",
    "last_seen" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sensors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "transaction_type" "public"."stock_txn_type" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "unit_cost" numeric(12,2) NOT NULL,
    "flock_id" "uuid",
    "reference_doc" "text",
    "expiry_date" "date",
    "batch_number" "text",
    "recorded_by" "uuid",
    "transaction_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "branch_id" "uuid",
    "farm_id" "uuid",
    "house_id" "uuid",
    "batch_id" "uuid",
    "supplier_name" "text",
    "invoice_number" "text",
    "cost_method" "text" DEFAULT 'weighted_average'::"text" NOT NULL,
    "procurement_type" "public"."procurement_type",
    "notes" "text",
    "daily_record_id" "uuid",
    "source_kind" "text",
    "source_key" "text"
);


ALTER TABLE "public"."stock_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_enrollments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "payment_status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "attendance" "jsonb" DEFAULT '{}'::"jsonb",
    "assessment_score" numeric(5,2),
    "passed" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."training_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "start_date" "date",
    "end_date" "date",
    "fee_etb" numeric(12,2),
    "max_capacity" integer,
    "facilitator_id" "uuid",
    "status" "public"."training_status" DEFAULT 'planned'::"public"."training_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."training_programs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_branch_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_branch_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_farm_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "granted_by" "uuid",
    "revoked_by" "uuid",
    "revocation_reason" "text",
    CONSTRAINT "user_farm_access_dates_valid" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "starts_at")))
);


ALTER TABLE "public"."user_farm_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_warehouse_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "warehouse_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "granted_by" "uuid",
    "revoked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revocation_reason" "text",
    CONSTRAINT "user_warehouse_access_dates_valid" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "starts_at")))
);


ALTER TABLE "public"."user_warehouse_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vaccination_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "event_date" "date" NOT NULL,
    "vaccine_name" "text" NOT NULL,
    "dosage" "text",
    "route" "public"."vaccination_route" NOT NULL,
    "birds_vaccinated" integer,
    "vet_id" "uuid",
    "batch_number" "text",
    "expiry_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_reason" "text",
    "external_veterinarian_name" "text",
    "veterinarian_recommendation" "text",
    "veterinarian_reference" "text",
    "veterinarian_attachment" "jsonb",
    "recommendation_status" "text",
    CONSTRAINT "vaccination_events_recommendation_status_check" CHECK ((("recommendation_status" IS NULL) OR ("recommendation_status" = ANY (ARRAY['received'::"text", 'planned'::"text", 'implemented'::"text", 'declined'::"text"]))))
);


ALTER TABLE "public"."vaccination_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visitor_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "farm_id" "uuid" NOT NULL,
    "visit_date" "date" NOT NULL,
    "visitor_name" "text" NOT NULL,
    "purpose" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."visitor_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warehouses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."warehouse_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."warehouses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weight_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "flock_id" "uuid" NOT NULL,
    "record_date" "date" NOT NULL,
    "sample_count" integer,
    "average_weight_g" numeric(8,2),
    "min_weight_g" numeric(8,2),
    "max_weight_g" numeric(8,2),
    "uniformity_pct" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."weight_records" OWNER TO "postgres";


ALTER TABLE ONLY "public"."sensor_readings" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sensor_readings_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."alert_rules"
    ADD CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_feed_template_milestones"
    ADD CONSTRAINT "batch_feed_template_milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_feed_template_rows"
    ADD CONSTRAINT "batch_feed_template_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_feed_templates"
    ADD CONSTRAINT "batch_feed_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_weight_check_tasks"
    ADD CONSTRAINT "batch_weight_check_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_weight_check_tasks"
    ADD CONSTRAINT "batch_weight_check_tasks_unique" UNIQUE ("org_id", "batch_id", "flock_id", "due_week_number");



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_batch_code_org_unique" UNIQUE ("org_id", "batch_code");



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branch_intake_batches"
    ADD CONSTRAINT "bib_batch_code_org_unique" UNIQUE ("org_id", "batch_code");



ALTER TABLE ONLY "public"."biosecurity_checks"
    ADD CONSTRAINT "biosecurity_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branch_intake_batches"
    ADD CONSTRAINT "branch_intake_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_org_id_name_key" UNIQUE ("org_id", "name");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."break_glass_requests"
    ADD CONSTRAINT "break_glass_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."break_glass_sessions"
    ADD CONSTRAINT "break_glass_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."break_glass_sessions"
    ADD CONSTRAINT "break_glass_sessions_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."breed_standards"
    ADD CONSTRAINT "breed_standards_breed_id_week_number_key" UNIQUE ("breed_id", "week_number");



ALTER TABLE ONLY "public"."breed_standards"
    ADD CONSTRAINT "breed_standards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."breeds"
    ADD CONSTRAINT "breeds_org_id_name_key" UNIQUE ("org_id", "name");



ALTER TABLE ONLY "public"."breeds"
    ADD CONSTRAINT "breeds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_org_id_code_key" UNIQUE ("org_id", "code");



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_allocations"
    ADD CONSTRAINT "cost_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_egg_records"
    ADD CONSTRAINT "daily_egg_records_flock_id_record_date_key" UNIQUE ("flock_id", "record_date");



ALTER TABLE ONLY "public"."daily_egg_records"
    ADD CONSTRAINT "daily_egg_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_farm_records"
    ADD CONSTRAINT "daily_farm_records_flock_id_record_date_key" UNIQUE ("flock_id", "record_date");



ALTER TABLE ONLY "public"."daily_farm_records"
    ADD CONSTRAINT "daily_farm_records_org_flock_date_unique" UNIQUE ("org_id", "flock_id", "record_date");



ALTER TABLE ONLY "public"."daily_farm_records"
    ADD CONSTRAINT "daily_farm_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_sales_records"
    ADD CONSTRAINT "daily_sales_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."farm_operating_days"
    ADD CONSTRAINT "farm_operating_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."farm_operating_days"
    ADD CONSTRAINT "farm_operating_days_unique" UNIQUE ("farm_id", "operating_date");



ALTER TABLE ONLY "public"."farms"
    ADD CONSTRAINT "farms_org_id_branch_id_name_key" UNIQUE ("org_id", "branch_id", "name");



ALTER TABLE ONLY "public"."farms"
    ADD CONSTRAINT "farms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_control_settings"
    ADD CONSTRAINT "feed_control_settings_org_id_key" UNIQUE ("org_id");



ALTER TABLE ONLY "public"."feed_control_settings"
    ADD CONSTRAINT "feed_control_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_day_closures"
    ADD CONSTRAINT "feed_day_closures_org_id_flock_id_record_date_key" UNIQUE ("org_id", "flock_id", "record_date");



ALTER TABLE ONLY "public"."feed_day_closures"
    ADD CONSTRAINT "feed_day_closures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_milestone_executions"
    ADD CONSTRAINT "feed_milestone_executions_milestone_id_flock_id_key" UNIQUE ("milestone_id", "flock_id");



ALTER TABLE ONLY "public"."feed_milestone_executions"
    ADD CONSTRAINT "feed_milestone_executions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feeding_schedules"
    ADD CONSTRAINT "feeding_schedules_org_batch_date_unique" UNIQUE ("org_id", "batch_id", "schedule_date");



ALTER TABLE ONLY "public"."feeding_schedules"
    ADD CONSTRAINT "feeding_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_unique" UNIQUE ("org_id", "flock_id", "record_date", "session_name");



ALTER TABLE ONLY "public"."flock_transfers"
    ADD CONSTRAINT "flock_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_org_id_flock_code_key" UNIQUE ("org_id", "flock_code");



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_audit_events"
    ADD CONSTRAINT "governance_audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_requests"
    ADD CONSTRAINT "governance_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_scheduler_health"
    ADD CONSTRAINT "governance_scheduler_health_pkey" PRIMARY KEY ("scheduler_key");



ALTER TABLE ONLY "public"."health_events"
    ADD CONSTRAINT "health_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."houses"
    ADD CONSTRAINT "houses_org_id_farm_id_name_key" UNIQUE ("org_id", "farm_id", "name");



ALTER TABLE ONLY "public"."houses"
    ADD CONSTRAINT "houses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_org_id_name_key" UNIQUE ("org_id", "name");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_physical_counts"
    ADD CONSTRAINT "inventory_physical_counts_org_id_warehouse_id_item_id_count_key" UNIQUE ("org_id", "warehouse_id", "item_id", "count_date");



ALTER TABLE ONLY "public"."inventory_physical_counts"
    ADD CONSTRAINT "inventory_physical_counts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."management_targets"
    ADD CONSTRAINT "management_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_cost_periods"
    ADD CONSTRAINT "monthly_cost_periods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mortality_events"
    ADD CONSTRAINT "mortality_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_template_items"
    ADD CONSTRAINT "package_template_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."package_templates"
    ADD CONSTRAINT "package_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pos_items"
    ADD CONSTRAINT "pos_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_org_id_transaction_number_key" UNIQUE ("org_id", "transaction_number");



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reconciliation_finding_responses"
    ADD CONSTRAINT "reconciliation_finding_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_org_id_fingerprint_key" UNIQUE ("org_id", "fingerprint");



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reconciliation_runs"
    ADD CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_aliases"
    ADD CONSTRAINT "role_aliases_alias_key" UNIQUE ("alias");



ALTER TABLE ONLY "public"."role_aliases"
    ADD CONSTRAINT "role_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_org_id_order_number_key" UNIQUE ("org_id", "order_number");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_unit_conversions"
    ADD CONSTRAINT "sales_unit_conversions_org_id_product_category_unit_key" UNIQUE ("org_id", "product_category", "unit");



ALTER TABLE ONLY "public"."sales_unit_conversions"
    ADD CONSTRAINT "sales_unit_conversions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sensor_readings"
    ADD CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sensors"
    ADD CONSTRAINT "sensors_org_id_external_id_key" UNIQUE ("org_id", "external_id");



ALTER TABLE ONLY "public"."sensors"
    ADD CONSTRAINT "sensors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_enrollments"
    ADD CONSTRAINT "training_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_programs"
    ADD CONSTRAINT "training_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_unique" UNIQUE ("profile_id", "branch_id");



ALTER TABLE ONLY "public"."user_farm_access"
    ADD CONSTRAINT "user_farm_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_farm_access"
    ADD CONSTRAINT "user_farm_access_profile_id_farm_id_key" UNIQUE ("profile_id", "farm_id");



ALTER TABLE ONLY "public"."user_warehouse_access"
    ADD CONSTRAINT "user_warehouse_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_warehouse_access"
    ADD CONSTRAINT "user_warehouse_access_unique" UNIQUE ("profile_id", "warehouse_id");



ALTER TABLE ONLY "public"."vaccination_events"
    ADD CONSTRAINT "vaccination_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."visitor_logs"
    ADD CONSTRAINT "visitor_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_org_id_branch_id_name_key" UNIQUE ("org_id", "branch_id", "name");



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weight_records"
    ADD CONSTRAINT "weight_records_flock_id_record_date_key" UNIQUE ("flock_id", "record_date");



ALTER TABLE ONLY "public"."weight_records"
    ADD CONSTRAINT "weight_records_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "batch_feed_templates_one_active" ON "public"."batch_feed_templates" USING "btree" ("batch_id") WHERE "is_active";



CREATE INDEX "idx_batch_feed_template_milestones_template" ON "public"."batch_feed_template_milestones" USING "btree" ("template_id", "trigger_day");



CREATE INDEX "idx_batch_feed_template_rows_template" ON "public"."batch_feed_template_rows" USING "btree" ("template_id", "row_order");



CREATE INDEX "idx_batch_feed_template_rows_week" ON "public"."batch_feed_template_rows" USING "btree" ("template_id", "week_number");



CREATE INDEX "idx_batch_feed_templates_org_batch" ON "public"."batch_feed_templates" USING "btree" ("org_id", "batch_id");



CREATE INDEX "idx_batch_weight_check_tasks_flock_due" ON "public"."batch_weight_check_tasks" USING "btree" ("flock_id", "due_date");



CREATE INDEX "idx_batch_weight_check_tasks_org_batch" ON "public"."batch_weight_check_tasks" USING "btree" ("org_id", "batch_id");



CREATE INDEX "idx_batch_weight_check_tasks_status" ON "public"."batch_weight_check_tasks" USING "btree" ("status");



CREATE INDEX "idx_batches_branch_id" ON "public"."batches" USING "btree" ("branch_id");



CREATE INDEX "idx_batches_farm_id" ON "public"."batches" USING "btree" ("farm_id");



CREATE INDEX "idx_batches_house_id" ON "public"."batches" USING "btree" ("house_id");



CREATE INDEX "idx_batches_org_id" ON "public"."batches" USING "btree" ("org_id");



CREATE INDEX "idx_batches_placement_date" ON "public"."batches" USING "btree" ("placement_date");



CREATE INDEX "idx_bib_branch_id" ON "public"."branch_intake_batches" USING "btree" ("branch_id");



CREATE INDEX "idx_bib_org_id" ON "public"."branch_intake_batches" USING "btree" ("org_id");



CREATE INDEX "idx_cost_allocations_entry" ON "public"."cost_allocations" USING "btree" ("cost_entry_id");



CREATE INDEX "idx_cost_allocations_scope" ON "public"."cost_allocations" USING "btree" ("org_id", "branch_id", "farm_id", "house_id", "flock_id", "batch_id");



CREATE INDEX "idx_cost_entries_org_date" ON "public"."cost_entries" USING "btree" ("org_id", "entry_date" DESC);



CREATE INDEX "idx_cost_entries_period" ON "public"."cost_entries" USING "btree" ("period_id");



CREATE INDEX "idx_cost_entries_scope" ON "public"."cost_entries" USING "btree" ("org_id", "branch_id", "farm_id", "house_id", "flock_id", "batch_id");



CREATE INDEX "idx_daily_sales_records_batch" ON "public"."daily_sales_records" USING "btree" ("batch_id");



CREATE INDEX "idx_daily_sales_records_branch" ON "public"."daily_sales_records" USING "btree" ("branch_id");



CREATE INDEX "idx_daily_sales_records_farm" ON "public"."daily_sales_records" USING "btree" ("farm_id");



CREATE INDEX "idx_daily_sales_records_flock" ON "public"."daily_sales_records" USING "btree" ("flock_id");



CREATE INDEX "idx_daily_sales_records_house" ON "public"."daily_sales_records" USING "btree" ("house_id");



CREATE INDEX "idx_daily_sales_records_org_date" ON "public"."daily_sales_records" USING "btree" ("org_id", "sale_date" DESC);



CREATE INDEX "idx_daily_sales_records_product" ON "public"."daily_sales_records" USING "btree" ("product_category", "product_label");



CREATE INDEX "idx_feed_day_closures_batch_date" ON "public"."feed_day_closures" USING "btree" ("org_id", "batch_id", "record_date" DESC);



CREATE INDEX "idx_feeding_schedules_batch_id" ON "public"."feeding_schedules" USING "btree" ("batch_id");



CREATE INDEX "idx_feeding_schedules_org_id" ON "public"."feeding_schedules" USING "btree" ("org_id");



CREATE INDEX "idx_feeding_schedules_schedule_date" ON "public"."feeding_schedules" USING "btree" ("schedule_date");



CREATE INDEX "idx_feeding_session_records_batch_id" ON "public"."feeding_session_records" USING "btree" ("batch_id");



CREATE INDEX "idx_feeding_session_records_flock_id" ON "public"."feeding_session_records" USING "btree" ("flock_id");



CREATE INDEX "idx_feeding_session_records_org_id" ON "public"."feeding_session_records" USING "btree" ("org_id");



CREATE INDEX "idx_feeding_session_records_record_date" ON "public"."feeding_session_records" USING "btree" ("record_date");



CREATE INDEX "idx_feeding_sessions_day" ON "public"."feeding_session_records" USING "btree" ("org_id", "batch_id", "flock_id", "record_date", "status");



CREATE INDEX "idx_flocks_batch_id" ON "public"."flocks" USING "btree" ("batch_id");



CREATE INDEX "idx_flocks_intake_batch_id" ON "public"."flocks" USING "btree" ("intake_batch_id");



CREATE INDEX "idx_inventory_physical_counts_scope" ON "public"."inventory_physical_counts" USING "btree" ("org_id", "warehouse_id", "count_date" DESC);



CREATE INDEX "idx_monthly_cost_periods_org_period" ON "public"."monthly_cost_periods" USING "btree" ("org_id", "period_start" DESC, "period_end" DESC);



CREATE INDEX "idx_reconciliation_findings_farm" ON "public"."reconciliation_findings" USING "btree" ("org_id", "farm_id", "status");



CREATE INDEX "idx_reconciliation_findings_queue" ON "public"."reconciliation_findings" USING "btree" ("org_id", "status", "severity", "last_seen_at" DESC);



CREATE INDEX "idx_reconciliation_findings_warehouse" ON "public"."reconciliation_findings" USING "btree" ("org_id", "warehouse_id", "status");



CREATE INDEX "idx_reconciliation_responses_finding" ON "public"."reconciliation_finding_responses" USING "btree" ("finding_id", "created_at");



CREATE INDEX "idx_reconciliation_runs_org_completed" ON "public"."reconciliation_runs" USING "btree" ("org_id", "completed_at" DESC);



CREATE INDEX "idx_sensor_readings_sensor_time" ON "public"."sensor_readings" USING "btree" ("sensor_id", "captured_at" DESC);



CREATE INDEX "idx_sensor_readings_time" ON "public"."sensor_readings" USING "btree" ("captured_at" DESC);



CREATE INDEX "idx_stock_ledger_daily_record" ON "public"."stock_ledger" USING "btree" ("daily_record_id") WHERE ("daily_record_id" IS NOT NULL);



CREATE INDEX "idx_stock_ledger_item_warehouse" ON "public"."stock_ledger" USING "btree" ("org_id", "item_id", "warehouse_id");



CREATE INDEX "idx_stock_ledger_reference_doc" ON "public"."stock_ledger" USING "btree" ("org_id", "reference_doc");



CREATE INDEX "idx_stock_ledger_scope" ON "public"."stock_ledger" USING "btree" ("org_id", "branch_id", "farm_id", "house_id", "flock_id", "batch_id");



CREATE INDEX "idx_uba_branch_id" ON "public"."user_branch_access" USING "btree" ("branch_id");



CREATE INDEX "idx_uba_profile_id" ON "public"."user_branch_access" USING "btree" ("profile_id");



CREATE INDEX "management_targets_org_month_idx" ON "public"."management_targets" USING "btree" ("org_id", "period_month");



CREATE UNIQUE INDEX "management_targets_scope_month_uidx" ON "public"."management_targets" USING "btree" ("org_id", "scope_type", COALESCE("scope_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "period_month");



CREATE UNIQUE INDEX "monthly_cost_periods_scope_unique" ON "public"."monthly_cost_periods" USING "btree" ("org_id", COALESCE("branch_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("farm_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("house_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("flock_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("batch_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "period_start", "period_end");



CREATE INDEX "mortality_events_flock_date_idx" ON "public"."mortality_events" USING "btree" ("flock_id", "record_date");



CREATE INDEX "mortality_events_org_id_idx" ON "public"."mortality_events" USING "btree" ("org_id");



CREATE UNIQUE INDEX "profiles_one_active_ceo_per_org" ON "public"."profiles" USING "btree" ("org_id") WHERE (("role" = 'ceo'::"public"."user_role") AND ("is_active" = true));



CREATE UNIQUE INDEX "stock_ledger_generated_source_uidx" ON "public"."stock_ledger" USING "btree" ("org_id", "source_kind", "source_key", "item_id", "warehouse_id") WHERE (("source_kind" IS NOT NULL) AND ("source_key" IS NOT NULL));



CREATE OR REPLACE TRIGGER "apply_daily_farm_record_counts" BEFORE INSERT OR DELETE OR UPDATE ON "public"."daily_farm_records" FOR EACH ROW EXECUTE FUNCTION "public"."apply_daily_farm_record_counts"();



CREATE OR REPLACE TRIGGER "apply_monthly_cost_period_totals" BEFORE INSERT OR UPDATE ON "public"."monthly_cost_periods" FOR EACH ROW EXECUTE FUNCTION "public"."apply_monthly_cost_period_totals"();



CREATE OR REPLACE TRIGGER "enforce_governed_lifecycle" BEFORE INSERT OR DELETE OR UPDATE ON "public"."batches" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_governed_lifecycle"();



CREATE OR REPLACE TRIGGER "enforce_governed_lifecycle" BEFORE INSERT OR DELETE OR UPDATE ON "public"."flocks" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_governed_lifecycle"();



CREATE OR REPLACE TRIGGER "enforce_operational_actor" BEFORE INSERT OR DELETE OR UPDATE ON "public"."biosecurity_checks" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_operational_actor"();



CREATE OR REPLACE TRIGGER "enforce_operational_actor" BEFORE INSERT OR DELETE OR UPDATE ON "public"."daily_farm_records" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_operational_actor"();



CREATE OR REPLACE TRIGGER "enforce_operational_actor" BEFORE INSERT OR DELETE OR UPDATE ON "public"."daily_sales_records" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_operational_actor"();



CREATE OR REPLACE TRIGGER "enforce_operational_actor" BEFORE INSERT OR DELETE OR UPDATE ON "public"."feeding_session_records" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_operational_actor"();



CREATE OR REPLACE TRIGGER "enforce_operational_actor" BEFORE INSERT OR DELETE OR UPDATE ON "public"."health_events" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_operational_actor"();



CREATE OR REPLACE TRIGGER "enforce_operational_actor" BEFORE INSERT OR DELETE OR UPDATE ON "public"."mortality_events" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_operational_actor"();



CREATE OR REPLACE TRIGGER "enforce_operational_actor" BEFORE INSERT OR DELETE OR UPDATE ON "public"."vaccination_events" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_operational_actor"();



CREATE OR REPLACE TRIGGER "enforce_operational_actor" BEFORE INSERT OR DELETE OR UPDATE ON "public"."weight_records" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_operational_actor"();



CREATE OR REPLACE TRIGGER "governance_audit_immutable" BEFORE DELETE OR UPDATE ON "public"."governance_audit_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_governance_audit_change"();



CREATE OR REPLACE TRIGGER "mortality_events_updated_at" BEFORE UPDATE ON "public"."mortality_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_mortality_events_updated_at"();



CREATE OR REPLACE TRIGGER "prevent_closed_feed_day_record_delete" BEFORE DELETE ON "public"."daily_farm_records" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_closed_feed_day_record_delete"();



CREATE OR REPLACE TRIGGER "protect_profile_authority_fields" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_profile_authority_fields"();



CREATE OR REPLACE TRIGGER "reject_hard_delete" BEFORE DELETE ON "public"."batch_weight_check_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."reject_business_hard_delete"();



CREATE OR REPLACE TRIGGER "reject_hard_delete" BEFORE DELETE ON "public"."batches" FOR EACH ROW EXECUTE FUNCTION "public"."reject_business_hard_delete"();



CREATE OR REPLACE TRIGGER "reject_hard_delete" BEFORE DELETE ON "public"."biosecurity_checks" FOR EACH ROW EXECUTE FUNCTION "public"."reject_business_hard_delete"();



CREATE OR REPLACE TRIGGER "reject_hard_delete" BEFORE DELETE ON "public"."daily_farm_records" FOR EACH ROW EXECUTE FUNCTION "public"."reject_business_hard_delete"();



CREATE OR REPLACE TRIGGER "reject_hard_delete" BEFORE DELETE ON "public"."daily_sales_records" FOR EACH ROW EXECUTE FUNCTION "public"."reject_business_hard_delete"();



CREATE OR REPLACE TRIGGER "reject_hard_delete" BEFORE DELETE ON "public"."feeding_session_records" FOR EACH ROW EXECUTE FUNCTION "public"."reject_business_hard_delete"();



CREATE OR REPLACE TRIGGER "reject_hard_delete" BEFORE DELETE ON "public"."health_events" FOR EACH ROW EXECUTE FUNCTION "public"."reject_business_hard_delete"();



CREATE OR REPLACE TRIGGER "reject_hard_delete" BEFORE DELETE ON "public"."vaccination_events" FOR EACH ROW EXECUTE FUNCTION "public"."reject_business_hard_delete"();



CREATE OR REPLACE TRIGGER "trg_alert_rules_updated_at" BEFORE UPDATE ON "public"."alert_rules" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_alerts_updated_at" BEFORE UPDATE ON "public"."alerts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_batches_set_total_cost_default" BEFORE INSERT ON "public"."batches" FOR EACH ROW EXECUTE FUNCTION "public"."set_batch_total_cost_default"();



CREATE OR REPLACE TRIGGER "trg_biosecurity_checks_updated_at" BEFORE UPDATE ON "public"."biosecurity_checks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_branches_updated_at" BEFORE UPDATE ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_breed_standards_updated_at" BEFORE UPDATE ON "public"."breed_standards" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_breeds_updated_at" BEFORE UPDATE ON "public"."breeds" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_certificates_updated_at" BEFORE UPDATE ON "public"."certificates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_chart_of_accounts_updated_at" BEFORE UPDATE ON "public"."chart_of_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_daily_egg_records_updated_at" BEFORE UPDATE ON "public"."daily_egg_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_daily_farm_records_updated_at" BEFORE UPDATE ON "public"."daily_farm_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_farms_updated_at" BEFORE UPDATE ON "public"."farms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_flock_transfers_updated_at" BEFORE UPDATE ON "public"."flock_transfers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_flocks_updated_at" BEFORE UPDATE ON "public"."flocks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_health_events_updated_at" BEFORE UPDATE ON "public"."health_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_houses_updated_at" BEFORE UPDATE ON "public"."houses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_inventory_items_updated_at" BEFORE UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_journal_entries_updated_at" BEFORE UPDATE ON "public"."journal_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_journal_entry_lines_updated_at" BEFORE UPDATE ON "public"."journal_entry_lines" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_lead_activities_updated_at" BEFORE UPDATE ON "public"."lead_activities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_package_template_items_updated_at" BEFORE UPDATE ON "public"."package_template_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_package_templates_updated_at" BEFORE UPDATE ON "public"."package_templates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pos_items_updated_at" BEFORE UPDATE ON "public"."pos_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pos_transactions_updated_at" BEFORE UPDATE ON "public"."pos_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_default_role" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_profile_role"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sales_order_items_updated_at" BEFORE UPDATE ON "public"."sales_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sales_orders_updated_at" BEFORE UPDATE ON "public"."sales_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sensors_updated_at" BEFORE UPDATE ON "public"."sensors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_stock_ledger_updated_at" BEFORE UPDATE ON "public"."stock_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_training_enrollments_updated_at" BEFORE UPDATE ON "public"."training_enrollments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_training_programs_updated_at" BEFORE UPDATE ON "public"."training_programs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_vaccination_events_updated_at" BEFORE UPDATE ON "public"."vaccination_events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_visitor_logs_updated_at" BEFORE UPDATE ON "public"."visitor_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_warehouses_updated_at" BEFORE UPDATE ON "public"."warehouses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_weight_records_updated_at" BEFORE UPDATE ON "public"."weight_records" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."alert_rules"
    ADD CONSTRAINT "alert_rules_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alert_rules"
    ADD CONSTRAINT "alert_rules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alerts"
    ADD CONSTRAINT "alerts_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."batch_feed_template_milestones"
    ADD CONSTRAINT "batch_feed_template_milestones_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."batch_feed_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_feed_template_rows"
    ADD CONSTRAINT "batch_feed_template_rows_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."batch_feed_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_feed_templates"
    ADD CONSTRAINT "batch_feed_templates_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_feed_templates"
    ADD CONSTRAINT "batch_feed_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."batch_feed_templates"
    ADD CONSTRAINT "batch_feed_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_weight_check_tasks"
    ADD CONSTRAINT "batch_weight_check_tasks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_weight_check_tasks"
    ADD CONSTRAINT "batch_weight_check_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."batch_weight_check_tasks"
    ADD CONSTRAINT "batch_weight_check_tasks_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_weight_check_tasks"
    ADD CONSTRAINT "batch_weight_check_tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_weight_check_tasks"
    ADD CONSTRAINT "batch_weight_check_tasks_template_row_id_fkey" FOREIGN KEY ("template_row_id") REFERENCES "public"."batch_feed_template_rows"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."batch_weight_check_tasks"
    ADD CONSTRAINT "batch_weight_check_tasks_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."batch_weight_check_tasks"
    ADD CONSTRAINT "batch_weight_check_tasks_weight_record_id_fkey" FOREIGN KEY ("weight_record_id") REFERENCES "public"."weight_records"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batches"
    ADD CONSTRAINT "batches_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."biosecurity_checks"
    ADD CONSTRAINT "biosecurity_checks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."biosecurity_checks"
    ADD CONSTRAINT "biosecurity_checks_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biosecurity_checks"
    ADD CONSTRAINT "biosecurity_checks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biosecurity_checks"
    ADD CONSTRAINT "biosecurity_checks_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branch_intake_batches"
    ADD CONSTRAINT "branch_intake_batches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."branch_intake_batches"
    ADD CONSTRAINT "branch_intake_batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."break_glass_requests"
    ADD CONSTRAINT "break_glass_requests_administrator_id_fkey" FOREIGN KEY ("administrator_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."break_glass_requests"
    ADD CONSTRAINT "break_glass_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."break_glass_requests"
    ADD CONSTRAINT "break_glass_requests_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."break_glass_requests"
    ADD CONSTRAINT "break_glass_requests_target_org_id_fkey" FOREIGN KEY ("target_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."break_glass_sessions"
    ADD CONSTRAINT "break_glass_sessions_administrator_id_fkey" FOREIGN KEY ("administrator_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."break_glass_sessions"
    ADD CONSTRAINT "break_glass_sessions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."break_glass_requests"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."break_glass_sessions"
    ADD CONSTRAINT "break_glass_sessions_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."break_glass_sessions"
    ADD CONSTRAINT "break_glass_sessions_target_org_id_fkey" FOREIGN KEY ("target_org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."breed_standards"
    ADD CONSTRAINT "breed_standards_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "public"."breeds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."breed_standards"
    ADD CONSTRAINT "breed_standards_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."breeds"
    ADD CONSTRAINT "breeds_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certificates"
    ADD CONSTRAINT "certificates_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."training_enrollments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chart_of_accounts"
    ADD CONSTRAINT "chart_of_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_allocations"
    ADD CONSTRAINT "cost_allocations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_allocations"
    ADD CONSTRAINT "cost_allocations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_allocations"
    ADD CONSTRAINT "cost_allocations_cost_entry_id_fkey" FOREIGN KEY ("cost_entry_id") REFERENCES "public"."cost_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_allocations"
    ADD CONSTRAINT "cost_allocations_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_allocations"
    ADD CONSTRAINT "cost_allocations_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_allocations"
    ADD CONSTRAINT "cost_allocations_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_allocations"
    ADD CONSTRAINT "cost_allocations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "public"."monthly_cost_periods"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cost_entries"
    ADD CONSTRAINT "cost_entries_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_egg_records"
    ADD CONSTRAINT "daily_egg_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_egg_records"
    ADD CONSTRAINT "daily_egg_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_farm_records"
    ADD CONSTRAINT "daily_farm_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_farm_records"
    ADD CONSTRAINT "daily_farm_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_farm_records"
    ADD CONSTRAINT "daily_farm_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_farm_records"
    ADD CONSTRAINT "daily_farm_records_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_sales_records"
    ADD CONSTRAINT "daily_sales_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."daily_sales_records"
    ADD CONSTRAINT "daily_sales_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."daily_sales_records"
    ADD CONSTRAINT "daily_sales_records_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."daily_sales_records"
    ADD CONSTRAINT "daily_sales_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."daily_sales_records"
    ADD CONSTRAINT "daily_sales_records_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."daily_sales_records"
    ADD CONSTRAINT "daily_sales_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_sales_records"
    ADD CONSTRAINT "daily_sales_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_sales_records"
    ADD CONSTRAINT "daily_sales_records_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."farm_operating_days"
    ADD CONSTRAINT "farm_operating_days_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."farm_operating_days"
    ADD CONSTRAINT "farm_operating_days_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."farm_operating_days"
    ADD CONSTRAINT "farm_operating_days_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."farms"
    ADD CONSTRAINT "farms_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."farms"
    ADD CONSTRAINT "farms_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_control_settings"
    ADD CONSTRAINT "feed_control_settings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_day_closures"
    ADD CONSTRAINT "feed_day_closures_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_day_closures"
    ADD CONSTRAINT "feed_day_closures_closed_by_fkey" FOREIGN KEY ("closed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_day_closures"
    ADD CONSTRAINT "feed_day_closures_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_day_closures"
    ADD CONSTRAINT "feed_day_closures_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_day_closures"
    ADD CONSTRAINT "feed_day_closures_reopened_by_fkey" FOREIGN KEY ("reopened_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_milestone_executions"
    ADD CONSTRAINT "feed_milestone_executions_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_milestone_executions"
    ADD CONSTRAINT "feed_milestone_executions_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_milestone_executions"
    ADD CONSTRAINT "feed_milestone_executions_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."batch_feed_template_milestones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_milestone_executions"
    ADD CONSTRAINT "feed_milestone_executions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feeding_schedules"
    ADD CONSTRAINT "feeding_schedules_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feeding_schedules"
    ADD CONSTRAINT "feeding_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."feeding_schedules"
    ADD CONSTRAINT "feeding_schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_feed_item_id_fkey" FOREIGN KEY ("feed_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feeding_session_records"
    ADD CONSTRAINT "feeding_session_records_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flock_transfers"
    ADD CONSTRAINT "flock_transfers_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flock_transfers"
    ADD CONSTRAINT "flock_transfers_from_house_id_fkey" FOREIGN KEY ("from_house_id") REFERENCES "public"."houses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."flock_transfers"
    ADD CONSTRAINT "flock_transfers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flock_transfers"
    ADD CONSTRAINT "flock_transfers_to_house_id_fkey" FOREIGN KEY ("to_house_id") REFERENCES "public"."houses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_breed_id_fkey" FOREIGN KEY ("breed_id") REFERENCES "public"."breeds"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_intake_batch_id_fkey" FOREIGN KEY ("intake_batch_id") REFERENCES "public"."branch_intake_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flocks"
    ADD CONSTRAINT "flocks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_audit_events"
    ADD CONSTRAINT "governance_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."governance_audit_events"
    ADD CONSTRAINT "governance_audit_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."governance_audit_events"
    ADD CONSTRAINT "governance_audit_events_support_session_id_fkey" FOREIGN KEY ("support_session_id") REFERENCES "public"."break_glass_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."governance_requests"
    ADD CONSTRAINT "governance_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."governance_requests"
    ADD CONSTRAINT "governance_requests_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."governance_requests"
    ADD CONSTRAINT "governance_requests_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_requests"
    ADD CONSTRAINT "governance_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."governance_requests"
    ADD CONSTRAINT "governance_requests_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."health_events"
    ADD CONSTRAINT "health_events_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."health_events"
    ADD CONSTRAINT "health_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."health_events"
    ADD CONSTRAINT "health_events_vet_id_fkey" FOREIGN KEY ("vet_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."health_events"
    ADD CONSTRAINT "health_events_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."houses"
    ADD CONSTRAINT "houses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."houses"
    ADD CONSTRAINT "houses_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."houses"
    ADD CONSTRAINT "houses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_physical_counts"
    ADD CONSTRAINT "inventory_physical_counts_counted_by_fkey" FOREIGN KEY ("counted_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_physical_counts"
    ADD CONSTRAINT "inventory_physical_counts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_physical_counts"
    ADD CONSTRAINT "inventory_physical_counts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_physical_counts"
    ADD CONSTRAINT "inventory_physical_counts_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_physical_counts"
    ADD CONSTRAINT "inventory_physical_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."journal_entries"
    ADD CONSTRAINT "journal_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."journal_entry_lines"
    ADD CONSTRAINT "journal_entry_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lead_activities"
    ADD CONSTRAINT "lead_activities_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."management_targets"
    ADD CONSTRAINT "management_targets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."management_targets"
    ADD CONSTRAINT "management_targets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_cost_periods"
    ADD CONSTRAINT "monthly_cost_periods_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_cost_periods"
    ADD CONSTRAINT "monthly_cost_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_cost_periods"
    ADD CONSTRAINT "monthly_cost_periods_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_cost_periods"
    ADD CONSTRAINT "monthly_cost_periods_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_cost_periods"
    ADD CONSTRAINT "monthly_cost_periods_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_cost_periods"
    ADD CONSTRAINT "monthly_cost_periods_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."monthly_cost_periods"
    ADD CONSTRAINT "monthly_cost_periods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mortality_events"
    ADD CONSTRAINT "mortality_events_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mortality_events"
    ADD CONSTRAINT "mortality_events_observed_by_fkey" FOREIGN KEY ("observed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mortality_events"
    ADD CONSTRAINT "mortality_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."package_template_items"
    ADD CONSTRAINT "package_template_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."package_template_items"
    ADD CONSTRAINT "package_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."package_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."package_templates"
    ADD CONSTRAINT "package_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pos_items"
    ADD CONSTRAINT "pos_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pos_items"
    ADD CONSTRAINT "pos_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."pos_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pos_transactions"
    ADD CONSTRAINT "pos_transactions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reconciliation_finding_responses"
    ADD CONSTRAINT "reconciliation_finding_responses_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_finding_responses"
    ADD CONSTRAINT "reconciliation_finding_responses_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "public"."reconciliation_findings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reconciliation_finding_responses"
    ADD CONSTRAINT "reconciliation_finding_responses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reconciliation_finding_responses"
    ADD CONSTRAINT "reconciliation_finding_responses_support_session_id_fkey" FOREIGN KEY ("support_session_id") REFERENCES "public"."break_glass_sessions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliation_runs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_findings"
    ADD CONSTRAINT "reconciliation_findings_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reconciliation_runs"
    ADD CONSTRAINT "reconciliation_runs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reconciliation_runs"
    ADD CONSTRAINT "reconciliation_runs_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."role_aliases"
    ADD CONSTRAINT "role_aliases_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "public"."roles"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_unit_conversions"
    ADD CONSTRAINT "sales_unit_conversions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_unit_conversions"
    ADD CONSTRAINT "sales_unit_conversions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sensor_readings"
    ADD CONSTRAINT "sensor_readings_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sensors"
    ADD CONSTRAINT "sensors_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sensors"
    ADD CONSTRAINT "sensors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_daily_record_id_fkey" FOREIGN KEY ("daily_record_id") REFERENCES "public"."daily_farm_records"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "public"."houses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."inventory_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stock_ledger"
    ADD CONSTRAINT "stock_ledger_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."training_enrollments"
    ADD CONSTRAINT "training_enrollments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_enrollments"
    ADD CONSTRAINT "training_enrollments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_programs"
    ADD CONSTRAINT "training_programs_facilitator_id_fkey" FOREIGN KEY ("facilitator_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."training_programs"
    ADD CONSTRAINT "training_programs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_branch_access"
    ADD CONSTRAINT "user_branch_access_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_farm_access"
    ADD CONSTRAINT "user_farm_access_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_farm_access"
    ADD CONSTRAINT "user_farm_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_farm_access"
    ADD CONSTRAINT "user_farm_access_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_farm_access"
    ADD CONSTRAINT "user_farm_access_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_farm_access"
    ADD CONSTRAINT "user_farm_access_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_warehouse_access"
    ADD CONSTRAINT "user_warehouse_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_warehouse_access"
    ADD CONSTRAINT "user_warehouse_access_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_warehouse_access"
    ADD CONSTRAINT "user_warehouse_access_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_warehouse_access"
    ADD CONSTRAINT "user_warehouse_access_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_warehouse_access"
    ADD CONSTRAINT "user_warehouse_access_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vaccination_events"
    ADD CONSTRAINT "vaccination_events_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vaccination_events"
    ADD CONSTRAINT "vaccination_events_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vaccination_events"
    ADD CONSTRAINT "vaccination_events_vet_id_fkey" FOREIGN KEY ("vet_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vaccination_events"
    ADD CONSTRAINT "vaccination_events_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visitor_logs"
    ADD CONSTRAINT "visitor_logs_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "public"."farms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visitor_logs"
    ADD CONSTRAINT "visitor_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."warehouses"
    ADD CONSTRAINT "warehouses_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weight_records"
    ADD CONSTRAINT "weight_records_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "public"."flocks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weight_records"
    ADD CONSTRAINT "weight_records_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "CEOs have full access to branch intake batches" ON "public"."branch_intake_batches" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ceo'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ceo'::"public"."user_role")))));



CREATE POLICY "CEOs have full access to user branch access" ON "public"."user_branch_access" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ceo'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ceo'::"public"."user_role")))));



CREATE POLICY "Farm managers can view batches in their assigned branches" ON "public"."batches" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."farms"
     JOIN "public"."user_branch_access" ON (("farms"."branch_id" = "user_branch_access"."branch_id")))
  WHERE (("user_branch_access"."profile_id" = "auth"."uid"()) AND ("batches"."farm_id" = "farms"."id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_farm_access"
     JOIN "public"."farms" ON (("user_farm_access"."farm_id" = "farms"."id")))
  WHERE (("user_farm_access"."profile_id" = "auth"."uid"()) AND ("batches"."farm_id" = "farms"."id")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ceo'::"public"."user_role"))))));



CREATE POLICY "Farm managers can view farms in their assigned branches" ON "public"."farms" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_branch_access"
  WHERE (("user_branch_access"."profile_id" = "auth"."uid"()) AND ("user_branch_access"."branch_id" = "farms"."branch_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_farm_access"
  WHERE (("user_farm_access"."profile_id" = "auth"."uid"()) AND ("user_farm_access"."farm_id" = "farms"."id")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ceo'::"public"."user_role"))))));



CREATE POLICY "Farm managers can view flocks in their assigned branches" ON "public"."flocks" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."farms"
     JOIN "public"."user_branch_access" ON (("farms"."branch_id" = "user_branch_access"."branch_id")))
  WHERE (("user_branch_access"."profile_id" = "auth"."uid"()) AND ("flocks"."farm_id" = "farms"."id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_farm_access"
     JOIN "public"."farms" ON (("user_farm_access"."farm_id" = "farms"."id")))
  WHERE (("user_farm_access"."profile_id" = "auth"."uid"()) AND ("flocks"."farm_id" = "farms"."id")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ceo'::"public"."user_role"))))));



CREATE POLICY "Farm managers can view houses in their assigned branches" ON "public"."houses" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."farms"
     JOIN "public"."user_branch_access" ON (("farms"."branch_id" = "user_branch_access"."branch_id")))
  WHERE (("user_branch_access"."profile_id" = "auth"."uid"()) AND ("houses"."farm_id" = "farms"."id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_farm_access"
     JOIN "public"."farms" ON (("user_farm_access"."farm_id" = "farms"."id")))
  WHERE (("user_farm_access"."profile_id" = "auth"."uid"()) AND ("houses"."farm_id" = "farms"."id")))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ceo'::"public"."user_role"))))));



CREATE POLICY "Managers can view their assigned branch intake batches" ON "public"."branch_intake_batches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_branch_access"
  WHERE (("user_branch_access"."profile_id" = "auth"."uid"()) AND ("user_branch_access"."branch_id" = "branch_intake_batches"."branch_id")))));



CREATE POLICY "Managers can view their own branch access" ON "public"."user_branch_access" FOR SELECT USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."alert_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alert_rules_org_access" ON "public"."alert_rules" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."alerts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "alerts_org_access" ON "public"."alerts" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."batch_feed_template_milestones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "batch_feed_template_milestones_select_scope" ON "public"."batch_feed_template_milestones" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."batch_feed_templates" "t"
  WHERE ("t"."id" = "batch_feed_template_milestones"."template_id"))));



CREATE POLICY "batch_feed_template_milestones_write_scope" ON "public"."batch_feed_template_milestones" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."batch_feed_templates" "t"
     JOIN "public"."profiles" "p" ON ((("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "t"."org_id"))))
     JOIN "public"."batches" "b" ON (("b"."id" = "t"."batch_id")))
  WHERE (("t"."id" = "batch_feed_template_milestones"."template_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id"))))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."batch_feed_templates" "t"
     JOIN "public"."profiles" "p" ON ((("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "t"."org_id"))))
     JOIN "public"."batches" "b" ON (("b"."id" = "t"."batch_id")))
  WHERE (("t"."id" = "batch_feed_template_milestones"."template_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id")))))))))));



ALTER TABLE "public"."batch_feed_template_rows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "batch_feed_template_rows_select_scope" ON "public"."batch_feed_template_rows" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."batch_feed_templates" "t"
  WHERE ("t"."id" = "batch_feed_template_rows"."template_id"))));



CREATE POLICY "batch_feed_template_rows_write_scope" ON "public"."batch_feed_template_rows" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."batch_feed_templates" "t"
     JOIN "public"."profiles" "p" ON ((("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "t"."org_id"))))
     JOIN "public"."batches" "b" ON (("b"."id" = "t"."batch_id")))
  WHERE (("t"."id" = "batch_feed_template_rows"."template_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id"))))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."batch_feed_templates" "t"
     JOIN "public"."profiles" "p" ON ((("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "t"."org_id"))))
     JOIN "public"."batches" "b" ON (("b"."id" = "t"."batch_id")))
  WHERE (("t"."id" = "batch_feed_template_rows"."template_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id")))))))))));



ALTER TABLE "public"."batch_feed_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "batch_feed_templates_select_scope" ON "public"."batch_feed_templates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "batch_feed_templates"."batch_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "batch_feed_templates"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id")))))))));



CREATE POLICY "batch_feed_templates_write_scope" ON "public"."batch_feed_templates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "batch_feed_templates"."batch_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "batch_feed_templates"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id"))))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "batch_feed_templates"."batch_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "batch_feed_templates"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id")))))))))));



ALTER TABLE "public"."batch_weight_check_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "batch_weight_check_tasks_select_scope" ON "public"."batch_weight_check_tasks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "batch_weight_check_tasks"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "batch_weight_check_tasks"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



CREATE POLICY "batch_weight_check_tasks_write_scope" ON "public"."batch_weight_check_tasks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "batch_weight_check_tasks"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "batch_weight_check_tasks"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id"))))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "batch_weight_check_tasks"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "batch_weight_check_tasks"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))))));



ALTER TABLE "public"."batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."biosecurity_checks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "biosecurity_checks_delete_scope" ON "public"."biosecurity_checks" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "biosecurity_checks"."org_id") AND (("p"."role" = 'ceo'::"public"."user_role") OR (EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "biosecurity_checks"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "biosecurity_checks"."farm_id")))))))));



CREATE POLICY "biosecurity_checks_insert_scope" ON "public"."biosecurity_checks" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "biosecurity_checks"."org_id") AND (("p"."role" = 'ceo'::"public"."user_role") OR (EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "biosecurity_checks"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "biosecurity_checks"."farm_id")))))))));



CREATE POLICY "biosecurity_checks_select_scope" ON "public"."biosecurity_checks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "biosecurity_checks"."org_id")))));



CREATE POLICY "biosecurity_checks_update_scope" ON "public"."biosecurity_checks" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "biosecurity_checks"."org_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "biosecurity_checks"."org_id")))));



ALTER TABLE "public"."branch_intake_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "branches_org_access" ON "public"."branches" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



CREATE POLICY "break_glass_admin_request" ON "public"."break_glass_requests" FOR INSERT WITH CHECK ((("public"."current_active_role"() = 'system_admin'::"text") AND ("administrator_id" = "auth"."uid"())));



CREATE POLICY "break_glass_participant_read" ON "public"."break_glass_requests" FOR SELECT USING ((("administrator_id" = "auth"."uid"()) OR (("target_org_id" = "public"."current_org_id"()) AND ("public"."current_active_role"() = 'ceo'::"text"))));



ALTER TABLE "public"."break_glass_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."break_glass_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "break_glass_sessions_participant_read" ON "public"."break_glass_sessions" FOR SELECT USING ((("administrator_id" = "auth"."uid"()) OR (("target_org_id" = "public"."current_org_id"()) AND ("public"."current_active_role"() = 'ceo'::"text"))));



ALTER TABLE "public"."breed_standards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "breed_standards_org_access" ON "public"."breed_standards" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."breeds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "breeds_org_access" ON "public"."breeds" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."certificates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "certificates_org_access" ON "public"."certificates" USING ((EXISTS ( SELECT 1
   FROM ("public"."training_enrollments" "te"
     JOIN "public"."training_programs" "tp" ON (("tp"."id" = "te"."program_id")))
  WHERE (("te"."id" = "certificates"."enrollment_id") AND ("tp"."org_id" = "public"."auth_org_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."training_enrollments" "te"
     JOIN "public"."training_programs" "tp" ON (("tp"."id" = "te"."program_id")))
  WHERE (("te"."id" = "certificates"."enrollment_id") AND ("tp"."org_id" = "public"."auth_org_id"())))));



ALTER TABLE "public"."chart_of_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chart_of_accounts_org_access" ON "public"."chart_of_accounts" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."cost_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cost_allocations_admin_write" ON "public"."cost_allocations" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "cost_allocations"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "cost_allocations"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"]))))));



CREATE POLICY "cost_allocations_org_select" ON "public"."cost_allocations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "cost_allocations"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role", 'store_keeper'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "cost_allocations"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM "public"."user_branch_access" "uba"
          WHERE (("uba"."profile_id" = "p"."id") AND ("uba"."branch_id" = "cost_allocations"."branch_id")))))))))));



ALTER TABLE "public"."cost_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cost_entries_ops_write" ON "public"."cost_entries" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "cost_entries"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role", 'store_keeper'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "cost_entries"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role", 'store_keeper'::"public"."user_role"]))))));



CREATE POLICY "cost_entries_org_select" ON "public"."cost_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "cost_entries"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role", 'store_keeper'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "cost_entries"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM "public"."user_branch_access" "uba"
          WHERE (("uba"."profile_id" = "p"."id") AND ("uba"."branch_id" = "cost_entries"."branch_id")))))))))));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_org_access" ON "public"."customers" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."daily_egg_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_egg_records_org_access" ON "public"."daily_egg_records" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."daily_farm_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_farm_records_delete_scope" ON "public"."daily_farm_records" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "daily_farm_records"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_farm_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



CREATE POLICY "daily_farm_records_insert_scope" ON "public"."daily_farm_records" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "daily_farm_records"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_farm_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



CREATE POLICY "daily_farm_records_org_access" ON "public"."daily_farm_records" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_farm_records"."org_id")))));



CREATE POLICY "daily_farm_records_select_scope" ON "public"."daily_farm_records" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "daily_farm_records"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_farm_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



CREATE POLICY "daily_farm_records_update_scope" ON "public"."daily_farm_records" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "daily_farm_records"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_farm_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "daily_farm_records"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_farm_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



ALTER TABLE "public"."daily_sales_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_sales_records_manager_delete" ON "public"."daily_sales_records" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_sales_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "daily_sales_records"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "daily_sales_records"."farm_id")))))))));



CREATE POLICY "daily_sales_records_manager_insert" ON "public"."daily_sales_records" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_sales_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "daily_sales_records"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "daily_sales_records"."farm_id")))))))));



CREATE POLICY "daily_sales_records_manager_select" ON "public"."daily_sales_records" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_sales_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "daily_sales_records"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "daily_sales_records"."farm_id")))))))));



CREATE POLICY "daily_sales_records_manager_update" ON "public"."daily_sales_records" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_sales_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "daily_sales_records"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "daily_sales_records"."farm_id"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_sales_records"."org_id") AND ("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "daily_sales_records"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "daily_sales_records"."farm_id")))))))));



CREATE POLICY "daily_sales_records_org_role_select" ON "public"."daily_sales_records" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "daily_sales_records"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role", 'store_keeper'::"public"."user_role"]))))));



ALTER TABLE "public"."farm_operating_days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."farms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "farms_org_access" ON "public"."farms" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."feed_control_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feed_control_settings_admin_write" ON "public"."feed_control_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feed_control_settings"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feed_control_settings"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"]))))));



CREATE POLICY "feed_control_settings_org_select" ON "public"."feed_control_settings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feed_control_settings"."org_id")))));



ALTER TABLE "public"."feed_day_closures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feed_day_closures_ops_write" ON "public"."feed_day_closures" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "f" ON (("f"."id" = "feed_day_closures"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feed_day_closures"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "a"
          WHERE (("a"."profile_id" = "p"."id") AND ("a"."farm_id" = "f"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "fa"
             JOIN "public"."user_branch_access" "a" ON (("a"."branch_id" = "fa"."branch_id")))
          WHERE (("fa"."id" = "f"."farm_id") AND ("a"."profile_id" = "p"."id"))))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "f" ON (("f"."id" = "feed_day_closures"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feed_day_closures"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "a"
          WHERE (("a"."profile_id" = "p"."id") AND ("a"."farm_id" = "f"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "fa"
             JOIN "public"."user_branch_access" "a" ON (("a"."branch_id" = "fa"."branch_id")))
          WHERE (("fa"."id" = "f"."farm_id") AND ("a"."profile_id" = "p"."id")))))))))));



CREATE POLICY "feed_day_closures_org_select" ON "public"."feed_day_closures" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feed_day_closures"."org_id")))));



ALTER TABLE "public"."feed_milestone_executions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feed_milestone_executions_ops_write" ON "public"."feed_milestone_executions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feed_milestone_executions"."org_id") AND ("p"."role" = ANY (ARRAY['farm_manager'::"public"."user_role", 'ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feed_milestone_executions"."org_id") AND ("p"."role" = ANY (ARRAY['farm_manager'::"public"."user_role", 'ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"]))))));



CREATE POLICY "feed_milestone_executions_org_select" ON "public"."feed_milestone_executions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feed_milestone_executions"."org_id")))));



ALTER TABLE "public"."feeding_schedules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feeding_schedules_insert_scope" ON "public"."feeding_schedules" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "feeding_schedules"."batch_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feeding_schedules"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id")))))))));



CREATE POLICY "feeding_schedules_select_scope" ON "public"."feeding_schedules" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "feeding_schedules"."batch_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feeding_schedules"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id")))))))));



CREATE POLICY "feeding_schedules_update_scope" ON "public"."feeding_schedules" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "feeding_schedules"."batch_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feeding_schedules"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."batches" "b" ON (("b"."id" = "feeding_schedules"."batch_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feeding_schedules"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])) OR (EXISTS ( SELECT 1
           FROM ("public"."flocks" "fl"
             JOIN "public"."user_farm_access" "ufa" ON (("ufa"."farm_id" = "fl"."farm_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("ufa"."profile_id" = "p"."id")))) OR (EXISTS ( SELECT 1
           FROM (("public"."flocks" "fl"
             JOIN "public"."farms" "f" ON (("f"."id" = "fl"."farm_id")))
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("fl"."batch_id" = "b"."id") AND ("uba"."profile_id" = "p"."id")))))))));



ALTER TABLE "public"."feeding_session_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feeding_session_records_insert_scope" ON "public"."feeding_session_records" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "feeding_session_records"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feeding_session_records"."org_id") AND (("p"."role" = 'ceo'::"public"."user_role") OR (EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



CREATE POLICY "feeding_session_records_select_scope" ON "public"."feeding_session_records" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "feeding_session_records"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feeding_session_records"."org_id") AND (("p"."role" = 'ceo'::"public"."user_role") OR (EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



CREATE POLICY "feeding_session_records_update_scope" ON "public"."feeding_session_records" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "feeding_session_records"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feeding_session_records"."org_id") AND (("p"."role" = 'ceo'::"public"."user_role") OR (EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id"))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "feeding_session_records"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "feeding_session_records"."org_id") AND (("p"."role" = 'ceo'::"public"."user_role") OR (EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



ALTER TABLE "public"."flock_transfers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flock_transfers_org_access" ON "public"."flock_transfers" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."flocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flocks_org_access" ON "public"."flocks" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."governance_audit_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_audit_scoped_read" ON "public"."governance_audit_events" FOR SELECT USING (((("org_id" = "public"."current_org_id"()) AND ("public"."current_active_role"() = 'ceo'::"text")) OR ("actor_id" = "auth"."uid"()) OR (("public"."current_active_role"() = 'system_admin'::"text") AND ("support_session_id" IS NOT NULL))));



ALTER TABLE "public"."governance_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_requests_manager_insert" ON "public"."governance_requests" FOR INSERT WITH CHECK ((("public"."current_active_role"() = 'farm_manager'::"text") AND ("org_id" = "public"."current_org_id"()) AND ("requested_by" = "auth"."uid"()) AND (("farm_id" IS NULL) OR "public"."has_active_farm_access"("farm_id"))));



CREATE POLICY "governance_requests_tenant_read" ON "public"."governance_requests" FOR SELECT USING ((("org_id" = "public"."current_org_id"()) AND (("public"."current_active_role"() = 'ceo'::"text") OR ("requested_by" = "auth"."uid"()) OR (("farm_id" IS NOT NULL) AND "public"."has_active_farm_access"("farm_id")))));



ALTER TABLE "public"."governance_scheduler_health" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_scheduler_health_tenant_read" ON "public"."governance_scheduler_health" FOR SELECT TO "authenticated" USING (("public"."current_active_role"() = ANY (ARRAY['ceo'::"text", 'farm_manager'::"text"])));



ALTER TABLE "public"."health_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "health_events_delete_scope" ON "public"."health_events" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "health_events"."org_id")))));



CREATE POLICY "health_events_insert_scope" ON "public"."health_events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "health_events"."org_id")))));



CREATE POLICY "health_events_org_access" ON "public"."health_events" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



CREATE POLICY "health_events_select_scope" ON "public"."health_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "health_events"."org_id")))));



CREATE POLICY "health_events_update_scope" ON "public"."health_events" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "health_events"."org_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "health_events"."org_id")))));



ALTER TABLE "public"."houses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "houses_org_access" ON "public"."houses" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_items_org_access" ON "public"."inventory_items" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."inventory_physical_counts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."journal_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_entries_org_access" ON "public"."journal_entries" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."journal_entry_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "journal_entry_lines_org_access" ON "public"."journal_entry_lines" USING ((EXISTS ( SELECT 1
   FROM "public"."journal_entries" "je"
  WHERE (("je"."id" = "journal_entry_lines"."journal_entry_id") AND ("je"."org_id" = "public"."auth_org_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."journal_entries" "je"
  WHERE (("je"."id" = "journal_entry_lines"."journal_entry_id") AND ("je"."org_id" = "public"."auth_org_id"())))));



ALTER TABLE "public"."lead_activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lead_activities_org_access" ON "public"."lead_activities" USING ((EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_activities"."lead_id") AND ("l"."org_id" = "public"."auth_org_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."leads" "l"
  WHERE (("l"."id" = "lead_activities"."lead_id") AND ("l"."org_id" = "public"."auth_org_id"())))));



ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "leads_org_access" ON "public"."leads" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."management_targets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "management_targets_admin_write" ON "public"."management_targets" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "management_targets"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "management_targets"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"]))))));



CREATE POLICY "management_targets_org_select" ON "public"."management_targets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "management_targets"."org_id")))));



ALTER TABLE "public"."monthly_cost_periods" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "monthly_cost_periods_admin_write" ON "public"."monthly_cost_periods" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "monthly_cost_periods"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "monthly_cost_periods"."org_id") AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role"]))))));



CREATE POLICY "monthly_cost_periods_org_select" ON "public"."monthly_cost_periods" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "monthly_cost_periods"."org_id") AND (("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'system_admin'::"public"."user_role", 'super_admin'::"public"."user_role", 'store_keeper'::"public"."user_role"])) OR (("p"."role" = 'farm_manager'::"public"."user_role") AND ((EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "monthly_cost_periods"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM "public"."user_branch_access" "uba"
          WHERE (("uba"."profile_id" = "p"."id") AND ("uba"."branch_id" = "monthly_cost_periods"."branch_id")))))))))));



ALTER TABLE "public"."mortality_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mortality_events_org_access" ON "public"."mortality_events" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" = "mortality_events"."org_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."org_id" = "mortality_events"."org_id")))));



CREATE POLICY "operating_days_tenant_read" ON "public"."farm_operating_days" FOR SELECT USING ((("org_id" = "public"."current_org_id"()) AND (("public"."current_active_role"() = 'ceo'::"text") OR "public"."has_active_farm_access"("farm_id"))));



CREATE POLICY "organization_onboarding_service_only" ON "public"."organizations" AS RESTRICTIVE FOR INSERT TO "authenticated" WITH CHECK (false);



ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_org_access" ON "public"."organizations" USING (("id" = "public"."auth_org_id"())) WITH CHECK (("id" = "public"."auth_org_id"()));



ALTER TABLE "public"."package_template_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "package_template_items_org_access" ON "public"."package_template_items" USING ((EXISTS ( SELECT 1
   FROM "public"."package_templates" "pt"
  WHERE (("pt"."id" = "package_template_items"."template_id") AND ("pt"."org_id" = "public"."auth_org_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."package_templates" "pt"
  WHERE (("pt"."id" = "package_template_items"."template_id") AND ("pt"."org_id" = "public"."auth_org_id"())))));



ALTER TABLE "public"."package_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "package_templates_org_access" ON "public"."package_templates" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_org_access" ON "public"."payments" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE (("so"."id" = "payments"."order_id") AND ("so"."org_id" = "public"."auth_org_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE (("so"."id" = "payments"."order_id") AND ("so"."org_id" = "public"."auth_org_id"())))));



CREATE POLICY "physical_counts_read" ON "public"."inventory_physical_counts" FOR SELECT TO "authenticated" USING ("public"."reconciliation_warehouse_scope_allowed"("org_id", "warehouse_id"));



ALTER TABLE "public"."pos_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pos_items_org_access" ON "public"."pos_items" USING ((EXISTS ( SELECT 1
   FROM "public"."pos_transactions" "pt"
  WHERE (("pt"."id" = "pos_items"."transaction_id") AND ("pt"."org_id" = "public"."auth_org_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pos_transactions" "pt"
  WHERE (("pt"."id" = "pos_items"."transaction_id") AND ("pt"."org_id" = "public"."auth_org_id"())))));



ALTER TABLE "public"."pos_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pos_transactions_org_access" ON "public"."pos_transactions" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_org_admin_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((COALESCE(NULLIF(("auth"."jwt"() ->> 'role'::"text"), ''::"text"), (("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text")) = ANY (ARRAY['ceo'::"text", 'system_admin'::"text", 'super_admin'::"text"])));



CREATE POLICY "profiles_self_read" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_self_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."reconciliation_finding_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reconciliation_findings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reconciliation_findings_read" ON "public"."reconciliation_findings" FOR SELECT TO "authenticated" USING (("public"."reconciliation_farm_scope_allowed"("org_id", "farm_id") OR "public"."reconciliation_warehouse_scope_allowed"("org_id", "warehouse_id") OR (("farm_id" IS NULL) AND ("warehouse_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "reconciliation_findings"."org_id") AND "p"."is_active" AND ("p"."role" = 'ceo'::"public"."user_role")))))));



CREATE POLICY "reconciliation_responses_read" ON "public"."reconciliation_finding_responses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."reconciliation_findings" "f"
  WHERE ("f"."id" = "reconciliation_finding_responses"."finding_id"))));



ALTER TABLE "public"."reconciliation_runs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reconciliation_runs_read" ON "public"."reconciliation_runs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "reconciliation_runs"."org_id") AND "p"."is_active" AND ("p"."role" = 'ceo'::"public"."user_role")))));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_order_items_org_access" ON "public"."sales_order_items" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE (("so"."id" = "sales_order_items"."order_id") AND ("so"."org_id" = "public"."auth_org_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE (("so"."id" = "sales_order_items"."order_id") AND ("so"."org_id" = "public"."auth_org_id"())))));



ALTER TABLE "public"."sales_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_orders_org_access" ON "public"."sales_orders" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."sales_unit_conversions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_unit_conversions_read" ON "public"."sales_unit_conversions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "sales_unit_conversions"."org_id") AND "p"."is_active" AND ("p"."role" = ANY (ARRAY['ceo'::"public"."user_role", 'farm_manager'::"public"."user_role"]))))));



ALTER TABLE "public"."sensor_readings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sensor_readings_org_access" ON "public"."sensor_readings" USING ((EXISTS ( SELECT 1
   FROM "public"."sensors" "s"
  WHERE (("s"."id" = "sensor_readings"."sensor_id") AND ("s"."org_id" = "public"."auth_org_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sensors" "s"
  WHERE (("s"."id" = "sensor_readings"."sensor_id") AND ("s"."org_id" = "public"."auth_org_id"())))));



ALTER TABLE "public"."sensors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sensors_org_access" ON "public"."sensors" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."stock_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stock_ledger_org_access" ON "public"."stock_ledger" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."training_enrollments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_enrollments_org_access" ON "public"."training_enrollments" USING ((EXISTS ( SELECT 1
   FROM "public"."training_programs" "tp"
  WHERE (("tp"."id" = "training_enrollments"."program_id") AND ("tp"."org_id" = "public"."auth_org_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."training_programs" "tp"
  WHERE (("tp"."id" = "training_enrollments"."program_id") AND ("tp"."org_id" = "public"."auth_org_id"())))));



ALTER TABLE "public"."training_programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "training_programs_org_access" ON "public"."training_programs" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."user_branch_access" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_farm_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_farm_access_org_access" ON "public"."user_farm_access" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."user_warehouse_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_warehouse_access_ceo_all" ON "public"."user_warehouse_access" USING ((("public"."current_active_role"() = 'ceo'::"text") AND ("org_id" = "public"."current_org_id"()))) WITH CHECK ((("public"."current_active_role"() = 'ceo'::"text") AND ("org_id" = "public"."current_org_id"())));



CREATE POLICY "user_warehouse_access_manager_read" ON "public"."user_warehouse_access" FOR SELECT USING (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."vaccination_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vaccination_events_delete_scope" ON "public"."vaccination_events" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "vaccination_events"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "vaccination_events"."org_id") AND (("p"."role" = 'ceo'::"public"."user_role") OR (EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



CREATE POLICY "vaccination_events_insert_scope" ON "public"."vaccination_events" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."flocks" "fl" ON (("fl"."id" = "vaccination_events"."flock_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "vaccination_events"."org_id") AND (("p"."role" = 'ceo'::"public"."user_role") OR (EXISTS ( SELECT 1
           FROM "public"."user_farm_access" "ufa"
          WHERE (("ufa"."profile_id" = "p"."id") AND ("ufa"."farm_id" = "fl"."farm_id")))) OR (EXISTS ( SELECT 1
           FROM ("public"."farms" "f"
             JOIN "public"."user_branch_access" "uba" ON (("uba"."branch_id" = "f"."branch_id")))
          WHERE (("uba"."profile_id" = "p"."id") AND ("f"."id" = "fl"."farm_id")))))))));



CREATE POLICY "vaccination_events_select_scope" ON "public"."vaccination_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "vaccination_events"."org_id")))));



CREATE POLICY "vaccination_events_update_scope" ON "public"."vaccination_events" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "vaccination_events"."org_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."org_id" = "vaccination_events"."org_id")))));



ALTER TABLE "public"."visitor_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visitor_logs_org_access" ON "public"."visitor_logs" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."warehouses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "warehouses_org_access" ON "public"."warehouses" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));



ALTER TABLE "public"."weight_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "weight_records_org_access" ON "public"."weight_records" USING (("org_id" = "public"."auth_org_id"())) WITH CHECK (("org_id" = "public"."auth_org_id"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."apply_daily_farm_record_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_daily_farm_record_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_daily_farm_record_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_monthly_cost_period_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_monthly_cost_period_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_monthly_cost_period_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ceo_initialize_branch_hierarchy"("p_org_id" "uuid", "p_branch" "jsonb", "p_intake_batch" "jsonb", "p_farms" "jsonb", "p_manager" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."ceo_initialize_branch_hierarchy"("p_org_id" "uuid", "p_branch" "jsonb", "p_intake_batch" "jsonb", "p_farms" "jsonb", "p_manager" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ceo_initialize_branch_hierarchy"("p_org_id" "uuid", "p_branch" "jsonb", "p_intake_batch" "jsonb", "p_farms" "jsonb", "p_manager" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."farm_operating_days" TO "anon";
GRANT ALL ON TABLE "public"."farm_operating_days" TO "authenticated";
GRANT ALL ON TABLE "public"."farm_operating_days" TO "service_role";



GRANT ALL ON FUNCTION "public"."close_farm_operating_day"("p_farm_id" "uuid", "p_operating_date" "date", "p_exceptions" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."close_farm_operating_day"("p_farm_id" "uuid", "p_operating_date" "date", "p_exceptions" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_farm_operating_day"("p_farm_id" "uuid", "p_operating_date" "date", "p_exceptions" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."close_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_override_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."close_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_override_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_override_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_branch_batch_cycle"("p_org_id" "uuid", "p_branch_id" "uuid", "p_batch" "jsonb", "p_flock_slots" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_branch_batch_cycle"("p_org_id" "uuid", "p_branch_id" "uuid", "p_batch" "jsonb", "p_flock_slots" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_branch_batch_cycle"("p_org_id" "uuid", "p_branch_id" "uuid", "p_batch" "jsonb", "p_flock_slots" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_active_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_active_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_active_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "service_role";



GRANT ALL ON TABLE "public"."break_glass_requests" TO "anon";
GRANT ALL ON TABLE "public"."break_glass_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."break_glass_requests" TO "service_role";



GRANT ALL ON FUNCTION "public"."decide_break_glass_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decide_break_glass_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decide_break_glass_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") TO "service_role";



GRANT ALL ON TABLE "public"."governance_requests" TO "anon";
GRANT ALL ON TABLE "public"."governance_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_requests" TO "service_role";



GRANT ALL ON FUNCTION "public"."decide_governance_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decide_governance_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decide_governance_request"("p_request_id" "uuid", "p_decision" "text", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_governed_lifecycle"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_governed_lifecycle"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_governed_lifecycle"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_operational_actor"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_operational_actor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_operational_actor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_batch_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_batch_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_batch_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_active_break_glass"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_active_break_glass"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_active_break_glass"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_active_farm_access"("p_farm_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_active_farm_access"("p_farm_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_active_farm_access"("p_farm_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_active_warehouse_access"("p_warehouse_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_active_warehouse_access"("p_warehouse_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_active_warehouse_access"("p_warehouse_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lock_overdue_operating_days"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lock_overdue_operating_days"() TO "anon";
GRANT ALL ON FUNCTION "public"."lock_overdue_operating_days"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_user_role"("input_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_user_role"("input_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_user_role"("input_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_closed_feed_day_record_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_closed_feed_day_record_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_closed_feed_day_record_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_governance_audit_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_governance_audit_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_governance_audit_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_profile_authority_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_profile_authority_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_profile_authority_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reconciliation_farm_scope_allowed"("p_org_id" "uuid", "p_farm_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reconciliation_farm_scope_allowed"("p_org_id" "uuid", "p_farm_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconciliation_farm_scope_allowed"("p_org_id" "uuid", "p_farm_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reconciliation_warehouse_scope_allowed"("p_org_id" "uuid", "p_warehouse_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reconciliation_warehouse_scope_allowed"("p_org_id" "uuid", "p_warehouse_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reconciliation_warehouse_scope_allowed"("p_org_id" "uuid", "p_warehouse_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_feed_milestone"("p_actor_id" "uuid", "p_milestone_id" "uuid", "p_flock_id" "uuid", "p_status" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_feed_milestone"("p_actor_id" "uuid", "p_milestone_id" "uuid", "p_flock_id" "uuid", "p_status" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_feed_milestone"("p_actor_id" "uuid", "p_milestone_id" "uuid", "p_flock_id" "uuid", "p_status" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_feed_weight"("p_actor_id" "uuid", "p_task_id" "uuid", "p_record_date" "date", "p_sample_count" integer, "p_average_weight_g" numeric, "p_min_weight_g" numeric, "p_max_weight_g" numeric, "p_uniformity_pct" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."record_feed_weight"("p_actor_id" "uuid", "p_task_id" "uuid", "p_record_date" "date", "p_sample_count" integer, "p_average_weight_g" numeric, "p_min_weight_g" numeric, "p_max_weight_g" numeric, "p_uniformity_pct" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_feed_weight"("p_actor_id" "uuid", "p_task_id" "uuid", "p_record_date" "date", "p_sample_count" integer, "p_average_weight_g" numeric, "p_min_weight_g" numeric, "p_max_weight_g" numeric, "p_uniformity_pct" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_inventory_movement"("p_actor_id" "uuid", "p_item_id" "uuid", "p_warehouse_id" "uuid", "p_transaction_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_transaction_date" "date", "p_destination_warehouse_id" "uuid", "p_branch_id" "uuid", "p_farm_id" "uuid", "p_house_id" "uuid", "p_flock_id" "uuid", "p_batch_id" "uuid", "p_procurement_type" "public"."procurement_type", "p_supplier_name" "text", "p_invoice_number" "text", "p_reference_doc" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_inventory_movement"("p_actor_id" "uuid", "p_item_id" "uuid", "p_warehouse_id" "uuid", "p_transaction_type" "text", "p_quantity" numeric, "p_unit_cost" numeric, "p_transaction_date" "date", "p_destination_warehouse_id" "uuid", "p_branch_id" "uuid", "p_farm_id" "uuid", "p_house_id" "uuid", "p_flock_id" "uuid", "p_batch_id" "uuid", "p_procurement_type" "public"."procurement_type", "p_supplier_name" "text", "p_invoice_number" "text", "p_reference_doc" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."record_support_access"("p_path" "text", "p_method" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_support_access"("p_path" "text", "p_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_support_access"("p_path" "text", "p_method" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_business_hard_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."reject_business_hard_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_business_hard_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reopen_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reopen_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_feed_day"("p_actor_id" "uuid", "p_flock_id" "uuid", "p_record_date" "date", "p_reason" "text") TO "service_role";



GRANT ALL ON TABLE "public"."break_glass_sessions" TO "anon";
GRANT ALL ON TABLE "public"."break_glass_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."break_glass_sessions" TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_break_glass_session"("p_session_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_break_glass_session"("p_session_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_break_glass_session"("p_session_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_daily_record_with_usage"("p_actor_id" "uuid", "p_daily_record_id" "uuid", "p_flock_id" "uuid", "p_record" "jsonb", "p_usages" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_daily_record_with_usage"("p_actor_id" "uuid", "p_daily_record_id" "uuid", "p_flock_id" "uuid", "p_record" "jsonb", "p_usages" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_feed_template"("p_actor_id" "uuid", "p_batch_id" "uuid", "p_name" "text", "p_source_type" "text", "p_rows" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_feed_template"("p_actor_id" "uuid", "p_batch_id" "uuid", "p_name" "text", "p_source_type" "text", "p_rows" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_feed_template"("p_actor_id" "uuid", "p_batch_id" "uuid", "p_name" "text", "p_source_type" "text", "p_rows" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_batch_total_cost_default"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_batch_total_cost_default"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_batch_total_cost_default"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_default_profile_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_default_profile_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_default_profile_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_mortality_events_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_mortality_events_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_mortality_events_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."stock_movement_delta"("p_transaction_type" "public"."stock_txn_type", "p_quantity" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."stock_movement_delta"("p_transaction_type" "public"."stock_txn_type", "p_quantity" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."stock_movement_delta"("p_transaction_type" "public"."stock_txn_type", "p_quantity" numeric) TO "service_role";
























GRANT ALL ON TABLE "public"."alert_rules" TO "anon";
GRANT ALL ON TABLE "public"."alert_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."alert_rules" TO "service_role";



GRANT ALL ON TABLE "public"."alerts" TO "anon";
GRANT ALL ON TABLE "public"."alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."alerts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."batch_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."batch_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."batch_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."batch_feed_template_milestones" TO "anon";
GRANT ALL ON TABLE "public"."batch_feed_template_milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_feed_template_milestones" TO "service_role";



GRANT ALL ON TABLE "public"."batch_feed_template_rows" TO "anon";
GRANT ALL ON TABLE "public"."batch_feed_template_rows" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_feed_template_rows" TO "service_role";



GRANT ALL ON TABLE "public"."batch_feed_templates" TO "anon";
GRANT ALL ON TABLE "public"."batch_feed_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_feed_templates" TO "service_role";



GRANT ALL ON TABLE "public"."batch_weight_check_tasks" TO "anon";
GRANT ALL ON TABLE "public"."batch_weight_check_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_weight_check_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."batches" TO "anon";
GRANT ALL ON TABLE "public"."batches" TO "authenticated";
GRANT ALL ON TABLE "public"."batches" TO "service_role";



GRANT ALL ON TABLE "public"."biosecurity_checks" TO "anon";
GRANT ALL ON TABLE "public"."biosecurity_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."biosecurity_checks" TO "service_role";



GRANT ALL ON TABLE "public"."branch_intake_batches" TO "anon";
GRANT ALL ON TABLE "public"."branch_intake_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."branch_intake_batches" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."breed_standards" TO "anon";
GRANT ALL ON TABLE "public"."breed_standards" TO "authenticated";
GRANT ALL ON TABLE "public"."breed_standards" TO "service_role";



GRANT ALL ON TABLE "public"."breeds" TO "anon";
GRANT ALL ON TABLE "public"."breeds" TO "authenticated";
GRANT ALL ON TABLE "public"."breeds" TO "service_role";



GRANT ALL ON TABLE "public"."certificates" TO "anon";
GRANT ALL ON TABLE "public"."certificates" TO "authenticated";
GRANT ALL ON TABLE "public"."certificates" TO "service_role";



GRANT ALL ON TABLE "public"."chart_of_accounts" TO "anon";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."chart_of_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."cost_allocations" TO "anon";
GRANT ALL ON TABLE "public"."cost_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."cost_entries" TO "anon";
GRANT ALL ON TABLE "public"."cost_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_entries" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."daily_egg_records" TO "anon";
GRANT ALL ON TABLE "public"."daily_egg_records" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_egg_records" TO "service_role";



GRANT ALL ON TABLE "public"."daily_farm_records" TO "anon";
GRANT ALL ON TABLE "public"."daily_farm_records" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_farm_records" TO "service_role";



GRANT ALL ON TABLE "public"."daily_sales_records" TO "anon";
GRANT ALL ON TABLE "public"."daily_sales_records" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_sales_records" TO "service_role";



GRANT ALL ON TABLE "public"."farms" TO "anon";
GRANT ALL ON TABLE "public"."farms" TO "authenticated";
GRANT ALL ON TABLE "public"."farms" TO "service_role";



GRANT ALL ON TABLE "public"."feed_control_settings" TO "anon";
GRANT ALL ON TABLE "public"."feed_control_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_control_settings" TO "service_role";



GRANT ALL ON TABLE "public"."feed_day_closures" TO "anon";
GRANT ALL ON TABLE "public"."feed_day_closures" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_day_closures" TO "service_role";



GRANT ALL ON TABLE "public"."feed_milestone_executions" TO "anon";
GRANT ALL ON TABLE "public"."feed_milestone_executions" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_milestone_executions" TO "service_role";



GRANT ALL ON TABLE "public"."feeding_schedules" TO "anon";
GRANT ALL ON TABLE "public"."feeding_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."feeding_schedules" TO "service_role";



GRANT ALL ON TABLE "public"."feeding_session_records" TO "anon";
GRANT ALL ON TABLE "public"."feeding_session_records" TO "authenticated";
GRANT ALL ON TABLE "public"."feeding_session_records" TO "service_role";



GRANT ALL ON TABLE "public"."flock_transfers" TO "anon";
GRANT ALL ON TABLE "public"."flock_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."flock_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."flocks" TO "anon";
GRANT ALL ON TABLE "public"."flocks" TO "authenticated";
GRANT ALL ON TABLE "public"."flocks" TO "service_role";



GRANT ALL ON TABLE "public"."governance_audit_events" TO "anon";
GRANT ALL ON TABLE "public"."governance_audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_audit_events" TO "service_role";



GRANT ALL ON SEQUENCE "public"."governance_audit_events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."governance_audit_events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."governance_audit_events_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."governance_scheduler_health" TO "anon";
GRANT ALL ON TABLE "public"."governance_scheduler_health" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_scheduler_health" TO "service_role";



GRANT ALL ON TABLE "public"."health_events" TO "anon";
GRANT ALL ON TABLE "public"."health_events" TO "authenticated";
GRANT ALL ON TABLE "public"."health_events" TO "service_role";



GRANT ALL ON TABLE "public"."houses" TO "anon";
GRANT ALL ON TABLE "public"."houses" TO "authenticated";
GRANT ALL ON TABLE "public"."houses" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory_physical_counts" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."inventory_physical_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_physical_counts" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entries" TO "anon";
GRANT ALL ON TABLE "public"."journal_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entries" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entry_lines" TO "anon";
GRANT ALL ON TABLE "public"."journal_entry_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entry_lines" TO "service_role";



GRANT ALL ON TABLE "public"."lead_activities" TO "anon";
GRANT ALL ON TABLE "public"."lead_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_activities" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."management_targets" TO "anon";
GRANT ALL ON TABLE "public"."management_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."management_targets" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_cost_periods" TO "anon";
GRANT ALL ON TABLE "public"."monthly_cost_periods" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_cost_periods" TO "service_role";



GRANT ALL ON TABLE "public"."mortality_events" TO "anon";
GRANT ALL ON TABLE "public"."mortality_events" TO "authenticated";
GRANT ALL ON TABLE "public"."mortality_events" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."package_template_items" TO "anon";
GRANT ALL ON TABLE "public"."package_template_items" TO "authenticated";
GRANT ALL ON TABLE "public"."package_template_items" TO "service_role";



GRANT ALL ON TABLE "public"."package_templates" TO "anon";
GRANT ALL ON TABLE "public"."package_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."package_templates" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."pos_items" TO "anon";
GRANT ALL ON TABLE "public"."pos_items" TO "authenticated";
GRANT ALL ON TABLE "public"."pos_items" TO "service_role";



GRANT ALL ON TABLE "public"."pos_transactions" TO "anon";
GRANT ALL ON TABLE "public"."pos_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."pos_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reconciliation_finding_responses" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reconciliation_finding_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."reconciliation_finding_responses" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reconciliation_findings" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reconciliation_findings" TO "authenticated";
GRANT ALL ON TABLE "public"."reconciliation_findings" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reconciliation_runs" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reconciliation_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."reconciliation_runs" TO "service_role";



GRANT ALL ON TABLE "public"."role_aliases" TO "anon";
GRANT ALL ON TABLE "public"."role_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."role_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."sales_order_items" TO "anon";
GRANT ALL ON TABLE "public"."sales_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."sales_orders" TO "anon";
GRANT ALL ON TABLE "public"."sales_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_orders" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sales_unit_conversions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."sales_unit_conversions" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_unit_conversions" TO "service_role";



GRANT ALL ON TABLE "public"."sensor_readings" TO "anon";
GRANT ALL ON TABLE "public"."sensor_readings" TO "authenticated";
GRANT ALL ON TABLE "public"."sensor_readings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sensor_readings_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sensor_readings_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sensor_readings_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sensors" TO "anon";
GRANT ALL ON TABLE "public"."sensors" TO "authenticated";
GRANT ALL ON TABLE "public"."sensors" TO "service_role";



GRANT ALL ON TABLE "public"."stock_ledger" TO "anon";
GRANT ALL ON TABLE "public"."stock_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."stock_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."training_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."training_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."training_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."training_programs" TO "anon";
GRANT ALL ON TABLE "public"."training_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."training_programs" TO "service_role";



GRANT ALL ON TABLE "public"."user_branch_access" TO "anon";
GRANT ALL ON TABLE "public"."user_branch_access" TO "authenticated";
GRANT ALL ON TABLE "public"."user_branch_access" TO "service_role";



GRANT ALL ON TABLE "public"."user_farm_access" TO "anon";
GRANT ALL ON TABLE "public"."user_farm_access" TO "authenticated";
GRANT ALL ON TABLE "public"."user_farm_access" TO "service_role";



GRANT ALL ON TABLE "public"."user_warehouse_access" TO "anon";
GRANT ALL ON TABLE "public"."user_warehouse_access" TO "authenticated";
GRANT ALL ON TABLE "public"."user_warehouse_access" TO "service_role";



GRANT ALL ON TABLE "public"."vaccination_events" TO "anon";
GRANT ALL ON TABLE "public"."vaccination_events" TO "authenticated";
GRANT ALL ON TABLE "public"."vaccination_events" TO "service_role";



GRANT ALL ON TABLE "public"."visitor_logs" TO "anon";
GRANT ALL ON TABLE "public"."visitor_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."visitor_logs" TO "service_role";



GRANT ALL ON TABLE "public"."warehouses" TO "anon";
GRANT ALL ON TABLE "public"."warehouses" TO "authenticated";
GRANT ALL ON TABLE "public"."warehouses" TO "service_role";



GRANT ALL ON TABLE "public"."weight_records" TO "anon";
GRANT ALL ON TABLE "public"."weight_records" TO "authenticated";
GRANT ALL ON TABLE "public"."weight_records" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































