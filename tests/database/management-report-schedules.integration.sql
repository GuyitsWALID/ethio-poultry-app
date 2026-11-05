\set ON_ERROR_STOP on
begin;
create function pg_temp.reject_schedule_audit() returns trigger language plpgsql as $$
begin
  if new.event_type like 'management_report.schedule_%' and current_setting('test.schedule_audit_failure',true)='on' then
    raise exception 'Injected schedule audit failure' using errcode='23514';
  end if;
  return new;
end $$;
create trigger test_schedule_audit_failure before insert on public.governance_audit_events
for each row execute function pg_temp.reject_schedule_audit();
do $$
declare
  o uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); manager uuid:=gen_random_uuid(); other_org uuid:=gen_random_uuid();
  s jsonb; paused jsonb; resumed jsonb; settings jsonb; revision timestamptz;
begin
  insert into public.organizations(id,name) values(o,'Schedule transaction tests'),(other_org,'Other tenant');
  insert into public.profiles(id,org_id,full_name,role,is_active) values(actor,o,'CEO','ceo',true),(manager,o,'Manager','farm_manager',true);
  settings:=jsonb_build_object('name','Weekly report','cadence','weekly','runDay',1,'runHour',7,'lookbackDays',7,
    'scope','{}'::jsonb,'recipientIds',jsonb_build_array(actor::text));
  perform set_config('test.schedule_audit_failure','on',true);
  begin
    perform public.create_management_report_schedule(o,actor,settings,now()+interval '1 week');
    raise exception 'Unaudited schedule creation accepted';
  exception when check_violation then null; end;
  if exists(select 1 from public.management_report_schedules where org_id=o) then raise exception 'Creation did not roll back'; end if;
  perform set_config('test.schedule_audit_failure','off',true);
  s:=public.create_management_report_schedule(o,actor,settings,now()+interval '1 week');
  if not exists(select 1 from public.governance_audit_events where entity_id=s->>'id' and event_type='management_report.schedule_created') then raise exception 'Creation audit missing'; end if;
  revision:=(s->>'updated_at')::timestamptz;
  perform set_config('test.schedule_audit_failure','on',true);
  begin
    perform public.set_management_report_schedule_active(o,actor,(s->>'id')::uuid,false,revision);
    raise exception 'Unaudited pause accepted';
  exception when check_violation then null; end;
  if not (select is_active from public.management_report_schedules where id=(s->>'id')::uuid) then raise exception 'Pause did not roll back'; end if;
  perform set_config('test.schedule_audit_failure','off',true);
  paused:=public.set_management_report_schedule_active(o,actor,(s->>'id')::uuid,false,revision);
  if (paused->>'is_active')::boolean or (paused->>'updated_at')::timestamptz<=revision then raise exception 'Pause revision not advanced'; end if;
  begin
    perform public.set_management_report_schedule_active(o,actor,(s->>'id')::uuid,true,revision,now()+interval '1 week');
    raise exception 'Stale edit accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.set_management_report_schedule_active(other_org,actor,(s->>'id')::uuid,true,(paused->>'updated_at')::timestamptz,now()+interval '1 week');
    raise exception 'Cross-tenant edit accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_management_report_schedule_active(o,manager,(s->>'id')::uuid,true,(paused->>'updated_at')::timestamptz,now()+interval '1 week');
    raise exception 'Manager edited schedule';
  exception when insufficient_privilege then null; end;
  perform set_config('test.schedule_audit_failure','on',true);
  begin
    perform public.set_management_report_schedule_active(o,actor,(s->>'id')::uuid,true,(paused->>'updated_at')::timestamptz,now()+interval '1 week');
    raise exception 'Unaudited resume accepted';
  exception when check_violation then null; end;
  if (select is_active from public.management_report_schedules where id=(s->>'id')::uuid) then raise exception 'Resume did not roll back'; end if;
  perform set_config('test.schedule_audit_failure','off',true);
  resumed:=public.set_management_report_schedule_active(o,actor,(s->>'id')::uuid,true,(paused->>'updated_at')::timestamptz,now()+interval '2 weeks');
  if not (resumed->>'is_active')::boolean then raise exception 'Resume failed'; end if;
  -- An exact no-op retry must not append another semantic event.
  perform public.set_management_report_schedule_active(o,actor,(s->>'id')::uuid,true,(resumed->>'updated_at')::timestamptz,now()+interval '3 weeks');
  if (select count(*) from public.governance_audit_events where entity_id=s->>'id' and event_type like 'management_report.schedule_%')<>3 then raise exception 'Unexpected schedule audit count'; end if;
  begin
    perform public.create_management_report_schedule(o,actor,jsonb_set(settings,'{runDay}','8'),now()+interval '1 week');
    raise exception 'Invalid weekly day accepted';
  exception when invalid_parameter_value then null; end;
  update public.profiles set is_active=false where id=actor;
  begin
    perform public.set_management_report_schedule_active(o,actor,(s->>'id')::uuid,false,(resumed->>'updated_at')::timestamptz);
    raise exception 'Inactive CEO edited schedule';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('authenticated','public.create_management_report_schedule(uuid,uuid,jsonb,timestamptz)','EXECUTE')
    or has_function_privilege('authenticated','public.set_management_report_schedule_active(uuid,uuid,uuid,boolean,timestamptz,timestamptz)','EXECUTE') then
    raise exception 'Browser can execute service schedule mutations'; end if;
  if has_table_privilege('service_role','public.management_report_schedules','INSERT,UPDATE,DELETE') then
    raise exception 'Service role can bypass schedule audit transactions'; end if;
end $$;
rollback;
