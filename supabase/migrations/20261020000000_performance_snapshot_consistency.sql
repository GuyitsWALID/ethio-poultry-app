-- Detect concurrent changes across paginated, independently authorized readers.
-- Report publication locks/revalidates this token in its existing audit transaction.
create table public.performance_evidence_revisions (
 org_id uuid primary key references public.organizations(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0)
);
alter table public.performance_evidence_revisions enable row level security;
revoke all on public.performance_evidence_revisions from public,anon,authenticated,service_role;

create function public.bump_performance_evidence_revision() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare old_org uuid; new_org uuid; target uuid;
begin
 if tg_op<>'INSERT' then old_org:=case when tg_table_name='organizations' then (to_jsonb(old)->>'id')::uuid else (to_jsonb(old)->>'org_id')::uuid end; end if;
 if tg_op<>'DELETE' then new_org:=case when tg_table_name='organizations' then (to_jsonb(new)->>'id')::uuid else (to_jsonb(new)->>'org_id')::uuid end; end if;
 for target in select distinct x from unnest(array[old_org,new_org]) x where x is not null order by x loop
  if exists(select 1 from public.organizations where id=target) then
   insert into public.performance_evidence_revisions(org_id,revision) values(target,1)
   on conflict(org_id) do update set revision=performance_evidence_revisions.revision+1;
  end if;
 end loop;
 return null;
end $$;
revoke all on function public.bump_performance_evidence_revision() from public,anon,authenticated;

do $$ declare source text; begin
 foreach source in array array['organizations','profiles','branches','farms','houses','flocks','batches',
  'breeds','breed_standards','feed_control_settings','daily_farm_records','weight_records',
  'stock_ledger','inventory_items','warehouses','user_farm_access','user_warehouse_access',
  'feeding_session_records','feed_day_closures','health_events','vaccination_events',
  'daily_sales_records','cost_entries','monthly_cost_periods','flock_transfers','governance_requests',
  'batch_cycles','batch_cycle_closures','batch_cycle_clearances','batch_cycle_dispositions','batch_cycle_accounting_amendments'] loop
  execute format('create trigger performance_evidence_changed after insert or update or delete on public.%I for each row execute function public.bump_performance_evidence_revision()',source);
 end loop;
end $$;

create function public.read_performance_revision(p_org uuid,p_actor uuid) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from public.profiles where id=p_actor and org_id=p_org and is_active and role in ('ceo','farm_manager')) then
  raise exception 'Current reporting authority required.' using errcode='42501';
 end if;
 insert into public.performance_evidence_revisions(org_id,revision) values(p_org,0) on conflict do nothing;
 return (select revision::text from public.performance_evidence_revisions where org_id=p_org);
end $$;
revoke all on function public.read_performance_revision(uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_performance_revision(uuid,uuid) to service_role;
create or replace function public.check_management_report_resources() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_resources jsonb; v_actor uuid; v_actors uuid[]; v_revision text;
begin
  if new.report_version not in ('management-report-v1-scoped','management-report-v2') then return new; end if;
  if new.status='failed' then
    if new.report_snapshot is not null then raise exception 'Failed reports cannot contain snapshot evidence.' using errcode='22023'; end if;
    new.failure_message:='Report generation failed. Please retry or ask the CEO for help.';
    return new;
  end if;
  if new.status<>'completed' then raise exception 'Scoped reports must be finalized atomically.' using errcode='22023'; end if;
  v_resources:=new.report_snapshot->'report_resources';
  v_actors:=array_append(new.recipient_ids,new.requested_by);
  -- Hold current permission evidence through publication, including shared grants.
  perform 1 from public.profiles where org_id=new.org_id and id=any(v_actors) order by id for share;
  perform 1 from public.user_farm_access where org_id=new.org_id and profile_id=any(v_actors) order by id for share;
  perform 1 from public.user_warehouse_access where org_id=new.org_id and profile_id=any(v_actors) order by id for share;
  perform 1 from public.warehouses where org_id=new.org_id and id in
    (select value::uuid from jsonb_array_elements_text(v_resources->'warehouse_ids')) order by id for share;
  foreach v_actor in array v_actors loop
    if not public.management_report_resources_allowed(new.org_id,v_actor,new.scope,v_resources) then
      raise exception 'Report warehouse or farm access changed; sharing cannot expand permissions.' using errcode='42501';
    end if;
  end loop;
  if new.report_version='management-report-v2' then
    if new.report_snapshot->'schemaVersion' is distinct from '1'::jsonb
      or jsonb_typeof(new.report_snapshot->'sections') is distinct from 'object'
      or not (new.report_snapshot->'sections' ?& array['production','feeding','health','stock','salesCosts'])
      or exists(select 1 from jsonb_each(new.report_snapshot->'sections') s where s.value->>'state'='failed')
      or new.report_snapshot->>'evidence_revision' is null then
      raise exception 'Complete versioned report evidence required.' using errcode='22023';
    end if;
    select revision::text into v_revision from public.performance_evidence_revisions where org_id=new.org_id for share;
    if v_revision is distinct from new.report_snapshot->>'evidence_revision' then
      raise exception 'Report evidence changed; regenerate the report.' using errcode='40001';
    end if;
  end if;
  return new;
end $$;

create or replace function public.can_read_management_report(p_actor uuid,p_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r public.management_report_runs; v_role text;
begin
  if auth.uid() is distinct from p_actor and coalesce(auth.role(),'')<>'service_role' then return false; end if;
  select * into r from public.management_report_runs where id=p_id;
  if not found then return false; end if;
  select role into v_role from public.profiles where id=p_actor and org_id=r.org_id and is_active;
  if v_role='ceo' then return true; end if;
  if v_role is distinct from 'farm_manager' or r.report_version not in ('management-report-v1-scoped','management-report-v2')
    or not (r.requested_by=p_actor or p_actor=any(r.recipient_ids)) then return false; end if;
  if r.status='failed' and r.report_snapshot is null
    and r.failure_message='Report generation failed. Please retry or ask the CEO for help.' then
    return public.management_report_resources_allowed(r.org_id,p_actor,r.scope,
      jsonb_build_object('schema_version',1,'complete',true,'farm_ids',jsonb_build_array(r.scope->>'farmId'),'warehouse_ids','[]'::jsonb));
  end if;
  return r.status='completed' and public.management_report_resources_allowed(r.org_id,p_actor,r.scope,r.report_snapshot->'report_resources');
end $$;
