-- One authorization boundary for inherited farm stores and explicit shared stores.
create extension if not exists btree_gist with schema extensions;
set search_path=public,extensions;
do $$ begin
  if exists(select 1 from public.user_farm_access a join public.user_farm_access b
    on a.farm_id=b.farm_id and a.id<b.id where a.revoked_at is null and b.revoked_at is null
    and tstzrange(a.starts_at,a.expires_at,'[)') && tstzrange(b.starts_at,b.expires_at,'[)')) then
    raise exception 'Resolve overlapping farm-manager assignments before deployment.';
  end if;
  if exists(select 1 from public.warehouses w left join public.farms f on f.id=w.farm_id
    where (w.farm_id is not null and (f.id is null or f.org_id<>w.org_id or f.branch_id<>w.branch_id))
      or (w.farm_id is null and w.type::text='farm_store')) then
    raise exception 'Resolve inconsistent warehouse farm ownership before deployment.';
  end if;
  if exists(select 1 from public.user_farm_access a where a.revoked_at is null and a.starts_at>now()
    and exists(select 1 from public.user_farm_access b where b.farm_id=a.farm_id and b.profile_id<>a.profile_id
      and b.revoked_at is null and b.starts_at<a.starts_at)) then
    raise exception 'Resolve scheduled manager replacements before deployment.';
  end if;
  if exists(select 1 from public.feeding_session_records s join public.warehouses w on w.id=s.warehouse_id
    join public.profiles p on p.id=s.recorded_by where w.farm_id is null and w.status='active'
      and p.is_active and p.role::text='farm_manager' and s.record_date>=(now() at time zone 'Africa/Addis_Ababa')::date-30
      and not exists(select 1 from public.user_warehouse_access a where a.org_id=w.org_id and a.profile_id=p.id
        and a.warehouse_id=w.id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()))) then
    raise exception 'CEO must review shared stores used for feeding without explicit permission.';
  end if;
end $$;
alter table public.user_farm_access add constraint user_farm_access_one_manager_period
  exclude using gist (farm_id with =, tstzrange(starts_at,expires_at,'[)') with &&) where (revoked_at is null);

create function public.manager_has_effective_warehouse_access(p_actor_id uuid,p_warehouse_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.warehouses w join public.profiles p on p.id=p_actor_id and p.org_id=w.org_id
    where w.id=p_warehouse_id and w.status='active' and p.is_active and p.role::text='farm_manager'
    and case when w.farm_id is not null then exists(
      select 1 from public.user_farm_access a join public.farms f on f.id=a.farm_id and f.org_id=w.org_id
      where a.org_id=w.org_id and a.profile_id=p_actor_id and a.farm_id=w.farm_id
        and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())
    ) else exists(
      select 1 from public.user_warehouse_access a where a.org_id=w.org_id and a.profile_id=p_actor_id and a.warehouse_id=w.id
        and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())
    ) end);
$$;
revoke all on function public.manager_has_effective_warehouse_access(uuid,uuid) from public,anon,authenticated;
grant execute on function public.manager_has_effective_warehouse_access(uuid,uuid) to service_role;
create function public.manager_warehouse_access_scope(p_actor_id uuid,p_org_id uuid)
returns table(id uuid,name text,farm_id uuid,branch_id uuid,access_source text)
language sql stable security definer set search_path=public as $$
  select w.id,w.name,w.farm_id,w.branch_id,
    case when w.farm_id is null then 'warehouse_assignment' else 'farm_assignment' end
  from public.warehouses w where w.org_id=p_org_id
    and public.manager_has_effective_warehouse_access(p_actor_id,w.id) order by w.name,w.id;
$$;
revoke all on function public.manager_warehouse_access_scope(uuid,uuid) from public,anon,authenticated;
grant execute on function public.manager_warehouse_access_scope(uuid,uuid) to service_role;
create or replace function public.has_active_warehouse_access(p_warehouse_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.manager_has_effective_warehouse_access(auth.uid(),p_warehouse_id);
$$;
create or replace function public.reconciliation_warehouse_scope_allowed(p_org_id uuid,p_warehouse_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select p_org_id=public.current_org_id() and (
    public.current_active_role()='ceo' or public.has_active_break_glass(p_org_id)
    or public.has_active_warehouse_access(p_warehouse_id));
$$;

-- Preserve old grant rows and the sensitive audit trigger history; never manufacture inherited grants.
update public.user_warehouse_access a set revoked_at=now(),
  revocation_reason='Superseded by farm assignment inheritance (20261006000000).'
from public.warehouses w where w.id=a.warehouse_id and w.farm_id is not null and a.revoked_at is null;
create function public.guard_warehouse_assignment_ownership() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.revoked_at is null and exists(select 1 from public.warehouses where id=new.warehouse_id and farm_id is not null) then
    raise exception 'Farm stores inherit access. Assign the farm instead.' using errcode='22023';
  end if;
  if not exists(select 1 from public.warehouses w join public.profiles p on p.id=new.profile_id
    where w.id=new.warehouse_id and w.org_id=new.org_id and p.org_id=new.org_id
      and (new.revoked_at is not null or (w.status='active' and p.is_active and p.role::text='farm_manager'))) then
    raise exception 'Warehouse and manager must belong to the same organization.' using errcode='42501';
  end if;
  return new;
end $$;
create trigger guard_warehouse_assignment_ownership before insert or update on public.user_warehouse_access
for each row execute function public.guard_warehouse_assignment_ownership();

-- Controlled rewrite of authorization predicates only. Stock and domain bodies are retained.
-- Fail closed if an upstream definition changes instead of silently missing a mutation path.
do $$
declare r record; v_definition text; v_updated text;
  v_pattern text := 'exists\s*\(\s*select 1 from public\.user_warehouse_access a\s+where a\.org_id\s*=\s*v_org_id\s+and a\.profile_id\s*=\s*p_actor_id\s+and a\.warehouse_id\s*=\s*([a-z_]+)\s+and a\.revoked_at is null\s+and a\.starts_at\s*<=\s*now\(\)\s+and\s*\(a\.expires_at is null or a\.expires_at\s*>\s*now\(\)\)\s*\)';
begin
  for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('complete_vaccination_with_inventory','execute_today_command_v1',
      'initialize_warehouse_inventory','receive_inventory_stock','record_assigned_inventory_movement',
      'record_health_event_with_inventory','record_inventory_count_session')
    and p.prosrc like '%public.user_warehouse_access%'
  loop
    v_definition:=pg_get_functiondef(r.oid);
    v_updated:=regexp_replace(v_definition,v_pattern,'public.manager_has_effective_warehouse_access(p_actor_id,\1)','g');
    if v_updated=v_definition or v_updated like '%public.user_warehouse_access%' then
      raise exception 'Unrecognized warehouse authorization predicate in %',r.proname;
    end if;
    execute v_updated;
  end loop;
end $$;

-- Feeding no longer bypasses explicit shared-store permission.
do $$
declare v_definition text; v_updated text;
begin
  v_definition:=pg_get_functiondef('public.execute_today_command_v1(uuid,jsonb)'::regprocedure);
  v_updated:=replace(v_definition,
    'and (farm_id = v_farm_id or (farm_id is null and branch_id = v_branch_id))',
    'and (farm_id = v_farm_id or (farm_id is null and branch_id = v_branch_id)) and public.manager_has_effective_warehouse_access(p_actor_id,id)');
  if v_updated=v_definition then raise exception 'Feed session scope definition changed; review authorization migration.'; end if;
  execute v_updated;
  v_definition:=pg_get_functiondef('public.close_feed_day(uuid,uuid,date,text)'::regprocedure);
  v_updated:=replace(v_definition,
    'where p.id = p_actor_id;', 'where p.id = p_actor_id and p.is_active;');
  v_updated:=replace(v_updated,
    'exists(select 1 from public.user_farm_access a where a.profile_id = p_actor_id and a.farm_id = v_farm_id)' || chr(10) ||
    '    or exists(select 1 from public.user_branch_access a where a.profile_id = p_actor_id and a.branch_id = v_branch_id)',
    'exists(select 1 from public.user_farm_access a where a.org_id=v_org_id and a.profile_id=p_actor_id and a.farm_id=v_farm_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()))');
  v_updated:=replace(v_updated,
    'w.org_id = v_org_id and w.branch_id = v_branch_id)',
    'w.org_id = v_org_id and w.branch_id = v_branch_id and w.status=''active'' and (w.farm_id=v_farm_id or w.farm_id is null) and (v_role<>''farm_manager'' or public.manager_has_effective_warehouse_access(p_actor_id,w.id)))');
  if v_updated=v_definition or v_updated like '%public.user_branch_access%' or v_updated not like '%manager_has_effective_warehouse_access%' then
    raise exception 'Feed close scope definition changed; review authorization migration.';
  end if;
  execute v_updated;
  -- Ownership of a task alone cannot retain access after the farm assignment ends.
  v_definition:=pg_get_functiondef('public.execute_today_command_v1(uuid,jsonb)'::regprocedure);
  v_updated:=replace(v_definition,
    'if not found or v_action.owner_id is distinct from p_actor_id then',
    'if not found or v_action.owner_id is distinct from p_actor_id or not ((v_action.farm_id=v_farm_id) or (v_action.warehouse_id is not null and public.manager_has_effective_warehouse_access(p_actor_id,v_action.warehouse_id))) then');
  if v_updated=v_definition then raise exception 'Today task ownership boundary changed; review migration.'; end if;
  execute v_updated;
end $$;
-- Action history remains visible to the CEO, or to managers with current source access.
drop policy operational_actions_read_scope on public.operational_actions;
create policy operational_actions_read_scope on public.operational_actions for select using(
  org_id=public.current_org_id() and (public.current_active_role()='ceo' or public.has_active_break_glass(org_id)
    or (farm_id is not null and public.has_active_farm_access(farm_id))
    or (warehouse_id is not null and public.has_active_warehouse_access(warehouse_id))));
drop policy operational_action_events_read_scope on public.operational_action_events;
create policy operational_action_events_read_scope on public.operational_action_events for select using(
  exists(select 1 from public.operational_actions a where a.id=action_id and a.org_id=public.current_org_id()
    and (public.current_active_role()='ceo' or public.has_active_break_glass(a.org_id)
      or (a.farm_id is not null and public.has_active_farm_access(a.farm_id))
      or (a.warehouse_id is not null and public.has_active_warehouse_access(a.warehouse_id)))));
reset search_path;
