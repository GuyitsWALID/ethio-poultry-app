\set ON_ERROR_STOP on
begin;
do $$
declare
  o uuid:=gen_random_uuid(); ceo uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid();
  branch uuid:=gen_random_uuid(); farm uuid:=gen_random_uuid(); ids uuid[]:='{}'; page jsonb; row jsonb;
  before_time timestamptz; before_id uuid; seen uuid[]:='{}'; n integer:=0;
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  insert into public.organizations(id,name) values(o,'Report pagination'),(other_org,'Other tenant');
  insert into public.profiles(id,org_id,full_name,role,is_active) values(ceo,o,'CEO','ceo',true),(manager,o,'Manager','farm_manager',true);
  insert into public.branches(id,org_id,name) values(branch,o,'Branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Farm');
  perform public.change_farm_manager_assignment(ceo,farm,manager,now()-interval '1 day',null,null,null,'Report pagination test','grant');
  -- All dates tie. More than 1,000 rows exceeds every former saved-list limit.
  for n in 1..1105 loop
    insert into public.management_report_runs(org_id,requested_by,requested_role,report_name,period_from,period_to,scope,recipient_ids,
      organization_name,report_version,status,failure_message,created_at)
    values(o,manager,'farm_manager','Page test','2026-10-01','2026-10-18',jsonb_build_object('farmId',farm),array[manager],
      'Test','management-report-v1-scoped','failed','ignored by guard','2026-10-19T12:34:56.123456Z') returning id into before_id;
    ids:=array_append(ids,before_id);
  end loop;
  -- Newer legacy rows are CEO-only and must not consume the manager's page.
  insert into public.management_report_runs(org_id,requested_by,requested_role,report_name,period_from,period_to,recipient_ids,
    organization_name,report_version,status,created_at)
    select o,ceo,'ceo','Legacy','2026-10-01','2026-10-18',array[ceo],'Test','management-report-v1','failed',now() from generate_series(1,55);
  before_id:=null;
  loop
    page:=public.page_accessible_management_reports(manager,o,before_time,before_id);
    if jsonb_array_length(page)>51 then raise exception 'Unbounded page'; end if;
    for row in select value from jsonb_array_elements(page) with ordinality as x(value,ordinal) where ordinal<=50 loop
      if (row->>'id')::uuid=any(seen) or not ((row->>'id')::uuid=any(ids)) then raise exception 'Duplicate or unauthorized row'; end if;
      if row ? 'report_snapshot' or row ? 'snapshot_sha256' or row ? 'recipient_ids' then raise exception 'List exposes snapshot or sharing details'; end if;
      seen:=array_append(seen,(row->>'id')::uuid);
      before_time:=(row->>'created_at')::timestamptz; before_id:=(row->>'id')::uuid;
    end loop;
    exit when jsonb_array_length(page)<=50;
  end loop;
  if cardinality(seen)<>1105 then raise exception 'Records omitted: %',cardinality(seen); end if;
  if not exists(select 1 from public.read_accessible_management_report(manager,ids[1])) then raise exception 'Exact older record unavailable'; end if;
  begin
    perform public.page_accessible_management_reports(manager,other_org);
    raise exception 'Cross tenant accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.page_accessible_management_reports(manager,o,now(),null);
    raise exception 'Partial cursor accepted';
  exception when invalid_parameter_value then null; end;
  update public.user_farm_access set revoked_at=now() where org_id=o and profile_id=manager;
  if jsonb_array_length(public.page_accessible_management_reports(manager,o))<>0
    or exists(select 1 from public.read_accessible_management_report(manager,ids[1])) then raise exception 'Revoked access still reads'; end if;
  if has_function_privilege('authenticated','public.page_accessible_management_reports(uuid,uuid,timestamptz,uuid)','EXECUTE') then raise exception 'Browser can spoof page actor'; end if;
end $$;
rollback;
