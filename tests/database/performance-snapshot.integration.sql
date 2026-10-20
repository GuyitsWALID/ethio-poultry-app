\set ON_ERROR_STOP on
begin;
do $$ declare
 o uuid:='23000000-0000-4000-8000-000000000001'; actor uuid:='23000000-0000-4000-8000-000000000002';
 manager uuid:='23000000-0000-4000-8000-000000000003'; branch uuid:='23000000-0000-4000-8000-000000000004'; farm uuid:='23000000-0000-4000-8000-000000000005';
 revision text; request jsonb; snapshot jsonb; claim jsonb; saved uuid;
begin
 perform set_config('request.jwt.claim.role','service_role',true);
 insert into public.organizations(id,name) values(o,'Snapshot tests');
 insert into public.profiles(id,org_id,full_name,role,is_active) values(actor,o,'CEO','ceo',true);
 revision:=public.read_performance_revision(o,actor);
 request:=jsonb_build_object('name','All topics','scope','{}'::jsonb,'recipientIds',jsonb_build_array(actor),'periodFrom','2026-10-01','periodTo','2026-10-20','version','management-report-v2','scheduleId',null);
 snapshot:=jsonb_build_object('schemaVersion',1,'evidence_revision',revision,'sections',jsonb_build_object('production',jsonb_build_object('state','missing'),'feeding',jsonb_build_object('state','missing'),'health',jsonb_build_object('state','missing'),'stock',jsonb_build_object('state','missing'),'salesCosts',jsonb_build_object('state','missing')),'report_resources',jsonb_build_object('schema_version',1,'complete',true,'farm_ids','[]'::jsonb,'warehouse_ids','[]'::jsonb));
 claim:=public.claim_management_report(o,actor,'manual:v2',repeat('1',64),request);
 update public.organizations set name='Source changed' where id=o;
 begin
  perform public.finish_management_report(o,actor,'manual:v2',(claim->>'claim_token')::uuid,snapshot,repeat('2',64),'Tests');
  raise exception 'Stale evidence published';
 exception when serialization_failure then null; end;
 if exists(select 1 from public.management_report_runs where org_id=o) then raise exception 'Stale publication partially persisted'; end if;
 snapshot:=jsonb_set(snapshot,'{evidence_revision}',to_jsonb(public.read_performance_revision(o,actor)));
 saved:=public.finish_management_report(o,actor,'manual:v2',(claim->>'claim_token')::uuid,snapshot,repeat('2',64),'Tests');
 if saved is distinct from public.finish_management_report(o,actor,'manual:v2',(claim->>'claim_token')::uuid,snapshot,repeat('2',64),'Tests') then raise exception 'Retry duplicated snapshot'; end if;
 if not public.can_read_management_report(actor,saved) then raise exception 'Authorized v2 unavailable'; end if;
 if has_function_privilege('authenticated','public.read_performance_revision(uuid,uuid)','EXECUTE') then raise exception 'Browser revision privilege'; end if;
 if has_table_privilege('service_role','public.performance_evidence_revisions','SELECT') then raise exception 'Unchecked revision read'; end if;
 insert into public.profiles(id,org_id,full_name,role,is_active) values(manager,o,'Manager','farm_manager',true);
 insert into public.branches(id,org_id,name) values(branch,o,'Branch');
 insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Farm');
 perform public.change_farm_manager_assignment(actor,farm,manager,now()-interval '1 day',null,null,null,'Snapshot assignment','grant');
 request:=jsonb_set(jsonb_set(request,'{scope}',jsonb_build_object('farmId',farm)),'{recipientIds}',jsonb_build_array(actor,manager));
 snapshot:=jsonb_set(snapshot,'{report_resources,farm_ids}',jsonb_build_array(farm));
 snapshot:=jsonb_set(snapshot,'{evidence_revision}',to_jsonb(public.read_performance_revision(o,actor)));
 claim:=public.claim_management_report(o,actor,'manual:v2-manager',repeat('3',64),request);
 saved:=public.finish_management_report(o,actor,'manual:v2-manager',(claim->>'claim_token')::uuid,snapshot,repeat('4',64),'Tests');
 if not public.can_read_management_report(manager,saved) then raise exception 'Authorized manager v2 unavailable'; end if;
 update public.user_farm_access set revoked_at=now() where org_id=o and profile_id=manager;
 if public.can_read_management_report(manager,saved) then raise exception 'Revoked manager v2 readable'; end if;
end $$;
rollback;
