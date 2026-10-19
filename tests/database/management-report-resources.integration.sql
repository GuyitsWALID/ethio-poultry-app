\set ON_ERROR_STOP on
begin;
do $$
declare
  o uuid:='20000000-0000-4000-8000-000000000001';
  ceo uuid:='20000000-0000-4000-8000-000000000002';
  manager uuid:='20000000-0000-4000-8000-000000000003';
  branch uuid:='20000000-0000-4000-8000-000000000004';
  farm uuid:='20000000-0000-4000-8000-000000000005';
  owned uuid:='20000000-0000-4000-8000-000000000006';
  shared uuid:='20000000-0000-4000-8000-000000000007';
  other_org uuid:='20000000-0000-4000-8000-000000000008';
  alien uuid:='20000000-0000-4000-8000-000000000009';
  alien_branch uuid:='20000000-0000-4000-8000-000000000010';
  owned2 uuid:='20000000-0000-4000-8000-000000000011';
  r jsonb; c jsonb; proof jsonb; snapshot jsonb; saved uuid; own_saved uuid; legacy uuid; partial uuid; failure uuid; before_snapshot jsonb;
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  insert into public.organizations(id,name) values(o,'Report resource tests'),(other_org,'Other report org');
  insert into public.profiles(id,org_id,full_name,role,is_active) values(ceo,o,'CEO','ceo',true),(manager,o,'Manager','farm_manager',true);
  insert into public.branches(id,org_id,name) values(branch,o,'Branch'),(alien_branch,other_org,'Other branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Farm');
  perform public.change_farm_manager_assignment(ceo,farm,manager,now()-interval '1 day',null,null,null,'Report resources test','grant');
  insert into public.warehouses(id,org_id,branch_id,farm_id,name,type,status) values
    (owned,o,branch,farm,'Inherited store','farm_store','active'),
    (shared,o,branch,null,'Shared store','central_warehouse','active'),
    (alien,other_org,alien_branch,null,'Foreign store','central_warehouse','active');
  r:=jsonb_build_object('name','Resource report','scope',jsonb_build_object('farmId',farm),'recipientIds',jsonb_build_array(ceo::text,manager::text),
    'periodFrom','2026-10-01','periodTo','2026-10-18','version','management-report-v1-scoped','scheduleId',null);
  proof:=jsonb_build_object('schema_version',1,'complete',true,'farm_ids',jsonb_build_array(farm::text),'warehouse_ids',jsonb_build_array(owned::text,shared::text));
  snapshot:=jsonb_build_object('eggs',10,'report_resources',proof);
  c:=public.claim_management_report(o,ceo,'manual:shared-permission',repeat('a',64),r);
  begin
    perform public.finish_management_report(o,ceo,'manual:shared-permission',(c->>'claim_token')::uuid,snapshot,repeat('b',64),'Test org');
    raise exception 'CEO sharing bypassed shared-store permission';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.management_report_runs where org_id=o) then raise exception 'Denied sharing partially saved'; end if;
  insert into public.user_warehouse_access(org_id,profile_id,warehouse_id) values(o,manager,shared);
  saved:=public.finish_management_report(o,ceo,'manual:shared-permission',(c->>'claim_token')::uuid,snapshot,repeat('b',64),'Test org');
  if not public.can_read_management_report(manager,saved) then raise exception 'Authorized shared report unavailable'; end if;
  update public.user_warehouse_access set starts_at=now()-interval '2 days',expires_at=now()-interval '1 day'
    where org_id=o and profile_id=manager and warehouse_id=shared;
  if public.can_read_management_report(manager,saved) then raise exception 'Expired shared permission still reads'; end if;
  update public.user_warehouse_access set expires_at=null where org_id=o and profile_id=manager and warehouse_id=shared;
  update public.user_warehouse_access set revoked_at=now() where org_id=o and profile_id=manager and warehouse_id=shared;
  if public.can_read_management_report(manager,saved) or exists(select 1 from public.read_accessible_management_report(manager,saved)) then raise exception 'Revoked shared permission still downloads'; end if;
  if jsonb_array_length(public.list_accessible_management_reports(manager))<>0 then raise exception 'Revoked report still listed'; end if;
  if not public.can_read_management_report(ceo,saved) then raise exception 'CEO lost tenant report'; end if;

  proof:=jsonb_set(proof,'{warehouse_ids}',jsonb_build_array(owned::text));
  snapshot:=jsonb_build_object('eggs',10,'report_resources',proof);
  r:=jsonb_set(r,'{recipientIds}',jsonb_build_array(manager::text));
  c:=public.claim_management_report(o,manager,'manual:inherited-permission',repeat('c',64),r);
  own_saved:=public.finish_management_report(o,manager,'manual:inherited-permission',(c->>'claim_token')::uuid,snapshot,repeat('d',64),'Test org');
  if not public.can_read_management_report(manager,own_saved) then raise exception 'Inherited farm store did not authorize snapshot'; end if;
  if exists(select 1 from public.user_warehouse_access where warehouse_id=owned and profile_id=manager) then raise exception 'Fake inherited grant was created'; end if;
  insert into public.warehouses(id,org_id,branch_id,farm_id,name,type,status) values(owned2,o,branch,farm,'New inherited store','farm_store','active');
  if not public.management_report_resources_allowed(o,manager,r->'scope',jsonb_set(proof,'{warehouse_ids}',jsonb_build_array(owned2::text))) then raise exception 'New store did not inherit'; end if;
  update public.warehouses set status='inactive' where id=owned;
  if public.can_read_management_report(manager,own_saved) then raise exception 'Inactive warehouse remained visible'; end if;
  update public.warehouses set status='active' where id=owned;
  if public.management_report_resources_allowed(o,ceo,r->'scope',jsonb_set(proof,'{warehouse_ids}',jsonb_build_array(alien::text))) then raise exception 'Cross-tenant evidence accepted'; end if;

  insert into public.management_report_runs(org_id,requested_by,requested_role,report_name,period_from,period_to,scope,recipient_ids,organization_name,report_snapshot,report_version,status)
  values(o,ceo,'ceo','Legacy report','2026-10-01','2026-10-18',r->'scope',array[manager],'Test org','{"legacy":true}','management-report-v1','completed') returning id,report_snapshot into legacy,before_snapshot;
  if public.can_read_management_report(manager,legacy) or not public.can_read_management_report(ceo,legacy) then raise exception 'Legacy restriction failed'; end if;
  if (select report_snapshot from public.management_report_runs where id=legacy) is distinct from before_snapshot then raise exception 'Legacy snapshot was rewritten'; end if;
  begin
    update public.management_report_runs set report_version='management-report-v1-scoped' where id=legacy;
    raise exception 'Legacy snapshot was relabeled';
  exception when insufficient_privilege then null; end;
  r:=jsonb_set(r,'{recipientIds}',jsonb_build_array(ceo::text));
  proof:=jsonb_set(proof,'{complete}','false');
  c:=public.claim_management_report(o,ceo,'manual:unattributed-source',repeat('e',64),r);
  partial:=public.finish_management_report(o,ceo,'manual:unattributed-source',(c->>'claim_token')::uuid,jsonb_build_object('report_resources',proof),repeat('f',64),'Test org');
  if public.management_report_resources_allowed(o,manager,r->'scope',proof) then raise exception 'Unverifiable source was guessed'; end if;

  r:=jsonb_set(r,'{recipientIds}',jsonb_build_array(manager::text));
  c:=public.claim_management_report(o,manager,'manual:safe-failure-message',repeat('a',64),r);
  failure:=(public.fail_management_report(o,manager,'manual:safe-failure-message',(c->>'claim_token')::uuid,'Sensitive private warehouse detail','Test org')->>'run_id')::uuid;
  if not public.can_read_management_report(manager,failure) then raise exception 'Safe failure history missing'; end if;
  if (select failure_message from public.management_report_runs where id=failure) like '%Sensitive%' then raise exception 'Private failure detail persisted for recipients'; end if;
  insert into public.management_report_runs(org_id,requested_by,requested_role,report_name,period_from,period_to,scope,recipient_ids,organization_name,report_snapshot,report_version,status,created_at)
  select o,ceo,'ceo','Newer inaccessible legacy report','2026-10-01','2026-10-18',r->'scope',array[manager],'Test org','{}','management-report-v1','completed',now()+interval '1 second'
    from generate_series(1,35);
  if jsonb_array_length(public.list_accessible_management_reports(manager))<>2 then raise exception 'Unauthorized newer rows hid accessible history'; end if;

  -- Exercise the same boundary with a real authenticated role and direct SELECT.
  perform set_config('request.jwt.claim.sub',manager::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  set local role authenticated;
  if not exists(select 1 from public.management_report_runs where id=own_saved) then raise exception 'RLS blocked inherited report'; end if;
  if exists(select 1 from public.management_report_runs where id in (saved,legacy,partial)) then raise exception 'RLS legacy/shared restriction bypassed'; end if;
  if public.can_read_management_report(ceo,legacy) then raise exception 'Authenticated actor spoofed CEO'; end if;
  begin
    perform public.read_accessible_management_report(ceo,legacy);
    raise exception 'Service-only read exposed';
  exception when insufficient_privilege then null; end;
  reset role;
  perform set_config('request.jwt.claim.role','service_role',true);
  if has_table_privilege('service_role','public.management_report_runs','SELECT') then raise exception 'Legacy service SELECT bypass remains'; end if;
  set local role service_role;
  begin
    perform 1 from public.management_report_runs where id=legacy;
    raise exception 'Legacy service key read directly';
  exception when insufficient_privilege then null; end;
  if not exists(select 1 from public.read_accessible_management_report(ceo,legacy)) then raise exception 'Checked service reader failed'; end if;
  reset role;
  update public.user_farm_access set revoked_at=now(),revocation_reason='Report resource test revocation' where org_id=o and farm_id=farm and profile_id=manager;
  if public.can_read_management_report(manager,own_saved) or public.can_read_management_report(manager,failure) then raise exception 'Revoked farm access still reads'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  update public.profiles set is_active=false where id=ceo;
  if public.can_read_management_report(ceo,legacy) then raise exception 'Inactive CEO still reads'; end if;
end $$;
rollback;
