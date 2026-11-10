-- Setup creates empty structure only; placement remains governed by batch cycles.
create table public.branch_structure_requests (
 org_id uuid not null references public.organizations(id), actor_id uuid not null references public.profiles(id),
 request_id uuid not null, payload_hash text not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(org_id,actor_id,request_id)
);
alter table public.branch_structure_requests enable row level security;
revoke all on public.branch_structure_requests from public,anon,authenticated;
grant select,insert on public.branch_structure_requests to service_role;

create function public.create_branch_structure(p_actor uuid,p_org uuid,p_request uuid,p_structure jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prior public.branch_structure_requests; fingerprint text:=md5(p_structure::text);
 branch uuid; farm uuid; house uuid; manager uuid:=nullif(p_structure->>'manager_id','')::uuid;
 farms jsonb:='[]'; houses jsonb:='[]'; farm_input jsonb; house_input jsonb; result jsonb;
begin
 perform 1 from public.profiles where id=p_actor and org_id=p_org and role::text='ceo' and is_active for share;
 if not found or (auth.uid() is not null and auth.uid()<>p_actor) or p_request is null then
  raise exception 'An active organization CEO and retry identifier are required.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('branch-structure:'||p_actor::text||':'||p_request::text,0));
 select * into prior from public.branch_structure_requests where org_id=p_org and actor_id=p_actor and request_id=p_request;
 if found then
  if prior.payload_hash is distinct from fingerprint then raise exception 'Request already used with different structure. Refresh the branch network before submitting again.' using errcode='40001'; end if;
  return prior.result;
 end if;
 if jsonb_typeof(p_structure) is distinct from 'object' or p_structure-array['branch','farms','manager_id']<>'{}'::jsonb
  or length(btrim(coalesce(p_structure->'branch'->>'name',''))) not between 1 and 120
  or jsonb_typeof(p_structure->'farms') is distinct from 'array' then
  raise exception 'Submit branch structure only; use approved Batch cycles for placement.' using errcode='22023'; end if;
 if jsonb_array_length(p_structure->'farms') not between 1 and 20 then raise exception 'Choose 1 to 20 farms.' using errcode='22023'; end if;
 if manager is not null then
  perform 1 from public.profiles where id=manager and org_id=p_org and role::text='farm_manager' and is_active for share;
  if not found then raise exception 'Choose an active Farm Manager in this organization.' using errcode='42501'; end if;
 end if;
 insert into public.branches(org_id,name,location) values(p_org,btrim(p_structure->'branch'->>'name'),nullif(btrim(p_structure->'branch'->>'location'),'')) returning id into branch;
 for farm_input in select value from jsonb_array_elements(p_structure->'farms') loop
  if jsonb_typeof(farm_input) is distinct from 'object' or farm_input-array['name','houses']<>'{}'::jsonb
   or length(btrim(coalesce(farm_input->>'name',''))) not between 1 and 120 or jsonb_typeof(farm_input->'houses') is distinct from 'array' then
   raise exception 'Choose a named farm and its empty houses.' using errcode='22023'; end if;
  if jsonb_array_length(farm_input->'houses') not between 1 and 100 then raise exception 'Choose 1 to 100 houses per farm.' using errcode='22023'; end if;
  insert into public.farms(org_id,branch_id,name) values(p_org,branch,btrim(farm_input->>'name')) returning id into farm;
  farms:=farms||jsonb_build_array(farm);
  for house_input in select value from jsonb_array_elements(farm_input->'houses') loop
   if jsonb_typeof(house_input) is distinct from 'object' or house_input-array['name','capacity','house_type']<>'{}'::jsonb
    or length(btrim(coalesce(house_input->>'name',''))) not between 1 and 120
    or coalesce(house_input->>'house_type','') not in ('layer','broiler','rearing','parent_stock')
    or coalesce((house_input->>'capacity')::numeric,0) not between 1 and 10000000
    or (house_input->>'capacity')::numeric<>trunc((house_input->>'capacity')::numeric) then
    raise exception 'Choose a house name, production type and positive whole-number capacity; do not supply flocks.' using errcode='22023'; end if;
   insert into public.houses(org_id,branch_id,farm_id,name,capacity,house_type)
   values(p_org,branch,farm,btrim(house_input->>'name'),(house_input->>'capacity')::integer,(house_input->>'house_type')::public.house_type) returning id into house;
   houses:=houses||jsonb_build_array(house);
  end loop;
  if manager is not null then
   perform public.change_farm_manager_assignment(p_actor,farm,manager,now(),null,null,null,'Assigned during branch structure setup, including farm-owned stores.','grant');
  end if;
 end loop;
 result:=jsonb_build_object('branchId',branch,'farmIds',farms,'houseIds',houses,'placementRequired',true);
 insert into public.governance_audit_events(org_id,actor_id,actor_role,event_type,entity_table,entity_id,reason,after_values)
 values(p_org,p_actor,'ceo','branch.structure_created','branches',branch::text,'Created empty structure; placement requires its own approved cycle.',result);
 insert into public.branch_structure_requests(org_id,actor_id,request_id,payload_hash,result) values(p_org,p_actor,p_request,fingerprint,result);
 return result;
end $$;
revoke all on function public.create_branch_structure(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_branch_structure(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.ceo_initialize_branch_hierarchy(p_org_id uuid,p_branch jsonb,p_intake_batch jsonb,p_farms jsonb,p_manager jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$ begin
 raise exception 'This combined setup is retired. Resubmit empty branch structure, assign the farm, then use approved Batch cycles for placement.' using errcode='55000';
end $$;
revoke all on function public.ceo_initialize_branch_hierarchy(uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
