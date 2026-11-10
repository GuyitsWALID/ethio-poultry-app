\set ON_ERROR_STOP on
begin;
do $$
declare org uuid:=gen_random_uuid(); ceo uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); request uuid:=gen_random_uuid();
 result jsonb; replay jsonb; farm uuid; store uuid; branch uuid; before_count integer;
 structure jsonb:=jsonb_build_object('branch',jsonb_build_object('name','Structure fixture'), 'farms',jsonb_build_array(
  jsonb_build_object('name','Layer farm','houses',jsonb_build_array(jsonb_build_object('name','Layer house','capacity',200,'house_type','layer'))),
  jsonb_build_object('name','Broiler farm','houses',jsonb_build_array(jsonb_build_object('name','Broiler house','capacity',300,'house_type','broiler')))));
begin
 insert into public.organizations(id,name) values(org,'Branch structure tests');
 insert into public.profiles(id,org_id,full_name,role,is_active) values(ceo,org,'CEO','ceo',true),(manager,org,'Manager','farm_manager',true);
 structure:=structure||jsonb_build_object('manager_id',manager);
 result:=public.create_branch_structure(ceo,org,request,structure); branch:=(result->>'branchId')::uuid;
 replay:=public.create_branch_structure(ceo,org,request,structure);
 if result<>replay or jsonb_array_length(result->'farmIds')<>2 or jsonb_array_length(result->'houseIds')<>2 then raise exception 'Structure replay or membership incorrect'; end if;
 if exists(select 1 from public.flocks where org_id=org) or exists(select 1 from public.batches where org_id=org)
  or exists(select 1 from public.branch_intake_batches where org_id=org) or exists(select 1 from public.user_branch_access where profile_id=manager) then
  raise exception 'Setup created legacy placements or branch grants'; end if;
 if (select count(*) from public.user_farm_access where org_id=org and profile_id=manager and revoked_at is null)<>2
  or (select count(distinct house_type) from public.houses where org_id=org)<>2 then raise exception 'Assignments or house types incorrect'; end if;
 farm:=(result->'farmIds'->>0)::uuid; store:=gen_random_uuid();
 insert into public.warehouses(id,org_id,branch_id,farm_id,name,type,status) values(store,org,branch,farm,'New farm store','farm_store','active');
 if not public.manager_has_effective_warehouse_access(manager,store) then raise exception 'Farm stores did not inherit assignment'; end if;
 if (select count(*) from public.governance_audit_events where org_id=org and event_type='branch.structure_created')<>1 then raise exception 'Audit duplicated'; end if;
 begin perform public.create_branch_structure(ceo,org,request,structure||jsonb_build_object('manager_id',null)); raise exception 'Changed retry accepted'; exception when serialization_failure then null; end;
 begin perform public.create_branch_structure(manager,org,gen_random_uuid(),structure); raise exception 'Manager created structure'; exception when insufficient_privilege then null; end;
 begin perform public.create_branch_structure(ceo,gen_random_uuid(),gen_random_uuid(),structure); raise exception 'Cross-tenant setup accepted'; exception when insufficient_privilege then null; end;
 select count(*) into before_count from public.branches where org_id=org;
 begin perform public.create_branch_structure(ceo,org,gen_random_uuid(),jsonb_set(jsonb_set(structure,'{branch,name}','"Failed structure"'),'{farms,1,houses,0,house_type}','"unknown"')); raise exception 'Invalid second farm committed'; exception when invalid_parameter_value then null; end;
 if (select count(*) from public.branches where org_id=org)<>before_count then raise exception 'Failed structure left partial data'; end if;
 begin perform public.ceo_initialize_branch_hierarchy(org,'{}','{}','[]','{}'); raise exception 'Retired setup accepted'; exception when sqlstate '55000' then null; end;
 if has_function_privilege('authenticated','public.create_branch_structure(uuid,uuid,uuid,jsonb)','execute') or has_function_privilege('anon','public.create_branch_structure(uuid,uuid,uuid,jsonb)','execute') then raise exception 'Private setup exposed'; end if;
end $$;
rollback;
