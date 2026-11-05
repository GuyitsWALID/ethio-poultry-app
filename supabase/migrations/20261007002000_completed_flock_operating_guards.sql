-- The same historical predicate is shared by the Today read model and final
-- online verification. Both old and new identities apply on turnover day.
create function public.flock_operates_on(p_flock public.flocks,p_day date) returns boolean
language sql immutable as $$
  select p_flock.placement_date<=p_day and (
    (p_flock.status in ('active','quarantined') and p_flock.completed_at is null)
    or (p_flock.completed_at is not null and (p_flock.completed_at at time zone 'Africa/Addis_Ababa')::date>=p_day)
  )
$$;

-- Transform the retained close implementation rather than duplicating its
-- receipt, stock, health and task-attestation rules.
do $$ declare v_definition text; begin
  select pg_get_functiondef(p.oid) into v_definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='finish_farm_operating_day_v1';
  if v_definition is null or position('f.status = ''active'' and f.placement_date <= p_operating_date' in v_definition)=0 then
    raise exception 'Final-day applicability seam changed. Review the existing close function before migration.'; end if;
  execute replace(v_definition,'f.status = ''active'' and f.placement_date <= p_operating_date','public.flock_operates_on(f,p_operating_date)');
end $$;

create function public.guard_completed_flock_entry_v1() returns trigger language plpgsql security definer set search_path=public as $$
declare v_status public.flock_status; v_completed timestamptz; v_day date;
begin
  if new.flock_id is null then return new; end if;
  select status,completed_at into v_status,v_completed from public.flocks where id=new.flock_id and org_id=new.org_id for share;
  if v_status is null then raise exception 'The selected flock is unavailable.' using errcode='42501'; end if;
  v_day:=coalesce(to_jsonb(new)->>'record_date',to_jsonb(new)->>'event_date',to_jsonb(new)->>'work_date',to_jsonb(new)->>'administered_on')::date;
  if v_completed is not null and v_day>(v_completed at time zone 'Africa/Addis_Ababa')::date then
    raise exception 'This date is after the cycle finished. Use the correct flock identity; historical approval cannot reopen a completed cycle.' using errcode='40001'; end if;
  if coalesce(current_setting('app.governance_apply',true),'false')='true' then return new; end if;
  if v_status not in ('active','quarantined') then
    raise exception 'This cycle has finished. Your draft is preserved, but recording against it requires an approved historical correction.' using errcode='40001'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['daily_farm_records','feeding_session_records','mortality_events','health_events','vaccination_events','daily_task_attestations'] loop
    execute format('create trigger completed_flock_entry before insert or update on public.%I for each row execute function public.guard_completed_flock_entry_v1()',t);
  end loop;
end $$;

create function public.guard_archived_flock_population_v1() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.batch_cycle_clearances where flock_id=old.id) and
    row(new.current_count,new.status,new.completed_at,new.house_id,new.farm_id,new.batch_id,new.initial_count,new.placement_date,new.placed_at,new.age_at_placement_days)
      is distinct from row(old.current_count,old.status,old.completed_at,old.house_id,old.farm_id,old.batch_id,old.initial_count,old.placement_date,old.placed_at,old.age_at_placement_days) and
    coalesce(current_setting('app.lifecycle_apply',true),'false')<>'true' then
    raise exception 'An archived cycle cannot be resurrected or relocated by a source edit. Request a reviewed lifecycle correction.' using errcode='42501'; end if;
  return new;
end $$;
create trigger archived_flock_population before update on public.flocks for each row execute function public.guard_archived_flock_population_v1();

-- Original canonical batch membership/count/date also underpins the immutable
-- closure. Editing that separate record must not evade the flock's own guard.
create function public.guard_cleared_batch_source_v1() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.batch_cycle_clearances e join public.flocks f on f.id=e.flock_id where f.batch_id=old.id) and
    (tg_op='DELETE' or row(new.org_id,new.farm_id,new.house_id,new.batch_cycle_id,new.total_count,new.placement_date,new.age_at_placement_days,new.status)
      is distinct from row(old.org_id,old.farm_id,old.house_id,old.batch_cycle_id,old.total_count,old.placement_date,old.age_at_placement_days,old.status)) and
    coalesce(current_setting('app.lifecycle_apply',true),'false')<>'true' then
    raise exception 'This original batch supports an archived cycle. Request a reviewed lifecycle correction.' using errcode='42501';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger cleared_batch_source before update or delete on public.batches for each row execute function public.guard_cleared_batch_source_v1();

-- An ordinary historical Governance flag is not permission to add losses or
-- insert a new count record behind an already-approved physical clearance.
create function public.guard_cleared_bird_history_v1() returns trigger language plpgsql security definer set search_path=public as $$
declare v_flock uuid; v_org uuid;
begin
  if tg_op='DELETE' then v_flock:=old.flock_id; v_org:=old.org_id; else v_flock:=new.flock_id; v_org:=new.org_id; end if;
  if (exists(select 1 from public.batch_cycle_clearances where flock_id=v_flock and org_id=v_org)
    or (tg_op='UPDATE' and exists(select 1 from public.batch_cycle_clearances where flock_id=old.flock_id and org_id=old.org_id))) and
    coalesce(current_setting('app.lifecycle_apply',true),'false')<>'true' then
    raise exception 'This bird history supports an archived cycle. Request a reviewed lifecycle correction.' using errcode='42501';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
create trigger cleared_daily_insert before insert on public.daily_farm_records for each row execute function public.guard_cleared_bird_history_v1();
create trigger cleared_mortality_history before insert or update or delete on public.mortality_events for each row execute function public.guard_cleared_bird_history_v1();

-- Protect the complete bird-count chain, not only its final Daily Record.
do $$ declare definition text; anchor text:='where daily_record_id=old.id'; begin
  select pg_get_functiondef('public.protect_cycle_closure_sources_v1()'::regprocedure) into definition;
  if position(anchor in definition)=0 then raise exception 'Closure source guard seam changed; review before migration.'; end if;
  execute replace(definition,anchor,'where flock_id=old.flock_id and org_id=old.org_id');
end $$;
revoke all on function public.guard_cleared_batch_source_v1(),public.guard_cleared_bird_history_v1() from public,anon,authenticated;

create function public.guard_archived_feed_evidence_v1() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.batch_cycle_clearances where flock_id=old.flock_id and daily_record_id in(select id from public.daily_farm_records where flock_id=old.flock_id and record_date=old.record_date)) and
    to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'This feeding close supports an archived cycle. Request a reviewed lifecycle correction before changing it.' using errcode='42501'; end if;
  return new;
end $$;
create trigger archived_feed_evidence before update on public.feed_day_closures for each row execute function public.guard_archived_feed_evidence_v1();

-- A closure is not blanket permission for future edits. Compare the complete
-- current row with the immutable post-approval snapshot, not just its identity
-- or timestamp (two writes in one transaction can share a timestamp).
create function public.exact_lifecycle_corrections(p_org uuid) returns table(source_id uuid)
language sql stable security definer set search_path=public,extensions as $$
  select distinct d.id from public.lifecycle_record_changes e join public.daily_farm_records d
    on d.id=e.source_id and d.org_id=e.org_id
  where e.org_id=p_org and e.source_table='daily_farm_records'
    and e.after_revision=encode(extensions.digest(to_jsonb(d)::text,'sha256'),'hex')
  limit 10001
$$;
revoke all on function public.exact_lifecycle_corrections(uuid) from public,anon,authenticated;
grant execute on function public.exact_lifecycle_corrections(uuid) to service_role;
