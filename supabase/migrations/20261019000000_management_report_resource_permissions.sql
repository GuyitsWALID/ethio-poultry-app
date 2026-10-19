-- Old snapshots are not rewritten or assigned guessed warehouse provenance.
create function public.management_report_resources_allowed(p_org uuid,p_actor uuid,p_scope jsonb,p_resources jsonb)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_role text; v_farm uuid; v_id uuid; v_ids jsonb;
begin
  select role into v_role from public.profiles where id=p_actor and org_id=p_org and is_active;
  if v_role is null or v_role not in ('ceo','farm_manager') then return false; end if;
  if p_resources is null or p_resources->'schema_version' is distinct from '1'::jsonb
    or jsonb_typeof(p_resources->'complete') is distinct from 'boolean'
    or jsonb_typeof(p_resources->'farm_ids') is distinct from 'array'
    or jsonb_typeof(p_resources->'warehouse_ids') is distinct from 'array' then return false; end if;
  if p_scope->>'farmId' is not null then
    v_farm:=(p_scope->>'farmId')::uuid;
    if p_resources->'farm_ids' is distinct from jsonb_build_array(v_farm::text) then return false; end if;
  end if;
  for v_id in select value::uuid from jsonb_array_elements_text(p_resources->'farm_ids') loop
    if not exists(select 1 from public.farms where id=v_id and org_id=p_org) then return false; end if;
  end loop;
  if v_role='farm_manager' then
    if v_farm is null or p_resources->'complete'<>'true'::jsonb then return false; end if;
    if not exists(select 1 from public.user_farm_access where org_id=p_org and profile_id=p_actor and farm_id=v_farm
      and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now())) then return false; end if;
  end if;
  v_ids:=p_resources->'warehouse_ids';
  for v_id in select value::uuid from jsonb_array_elements_text(v_ids) loop
    if not exists(select 1 from public.warehouses where id=v_id and org_id=p_org) then return false; end if;
    if v_role='farm_manager' and not public.manager_has_effective_warehouse_access(p_actor,v_id) then return false; end if;
  end loop;
  return true;
exception when invalid_text_representation then return false;
end $$;

create function public.check_management_report_resources() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_resources jsonb; v_actor uuid; v_actors uuid[];
begin
  if new.report_version<>'management-report-v1-scoped' then return new; end if;
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
  return new;
end $$;
create trigger management_report_resource_guard before insert on public.management_report_runs
for each row execute function public.check_management_report_resources();

create function public.can_read_management_report(p_actor uuid,p_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare r public.management_report_runs; v_role text;
begin
  if auth.uid() is distinct from p_actor and coalesce(auth.role(),'')<>'service_role' then return false; end if;
  select * into r from public.management_report_runs where id=p_id;
  if not found then return false; end if;
  select role into v_role from public.profiles where id=p_actor and org_id=r.org_id and is_active;
  if v_role='ceo' then return true; end if;
  if v_role is distinct from 'farm_manager' or r.report_version<>'management-report-v1-scoped'
    or not (r.requested_by=p_actor or p_actor=any(r.recipient_ids)) then return false; end if;
  if r.status='failed' and r.report_snapshot is null
    and r.failure_message='Report generation failed. Please retry or ask the CEO for help.' then
    return public.management_report_resources_allowed(r.org_id,p_actor,r.scope,
      jsonb_build_object('schema_version',1,'complete',true,'farm_ids',jsonb_build_array(r.scope->>'farmId'),'warehouse_ids','[]'::jsonb));
  end if;
  return r.status='completed' and public.management_report_resources_allowed(r.org_id,p_actor,r.scope,r.report_snapshot->'report_resources');
end $$;

drop policy management_report_runs_read on public.management_report_runs;
create policy management_report_runs_read on public.management_report_runs for select to authenticated
using(public.can_read_management_report(auth.uid(),id));

create function public.list_accessible_management_reports(p_actor uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(r)-'report_snapshot'-'snapshot_sha256' order by r.created_at desc,r.id desc),'[]'::jsonb)
  from (select * from public.management_report_runs where public.can_read_management_report(p_actor,id)
    order by created_at desc,id desc limit 30) r;
$$;
create function public.read_accessible_management_report(p_actor uuid,p_id uuid)
returns setof public.management_report_runs language sql stable security definer set search_path=public,pg_temp as $$
  select * from public.management_report_runs where id=p_id and public.can_read_management_report(p_actor,id);
$$;

revoke all on function public.management_report_resources_allowed(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.check_management_report_resources() from public,anon,authenticated;
revoke all on function public.can_read_management_report(uuid,uuid) from public,anon;
revoke all on function public.list_accessible_management_reports(uuid) from public,anon,authenticated;
revoke all on function public.read_accessible_management_report(uuid,uuid) from public,anon,authenticated;
grant execute on function public.can_read_management_report(uuid,uuid) to authenticated,service_role;
grant execute on function public.management_report_resources_allowed(uuid,uuid,jsonb,jsonb) to service_role;
grant execute on function public.list_accessible_management_reports(uuid) to service_role;
grant execute on function public.read_accessible_management_report(uuid,uuid) to service_role;

-- BYPASSRLS must not turn a legacy server SELECT into a snapshot permission bypass.
-- All application reads/writes now use the checked security-definer RPCs above.
revoke all on public.management_report_runs from service_role;
do $$ begin
  if has_table_privilege('service_role','public.management_report_runs','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Inherited service-role report privileges must be resolved before deployment.' using errcode='42501';
  end if;
end $$;
