\set ON_ERROR_STOP on
begin;
create function pg_temp.reject_report_audit() returns trigger language plpgsql as $$
begin
  if new.event_type='management_report.generated' and current_setting('test.report_audit_failure',true)='on' then
    raise exception 'Injected report audit failure' using errcode='23514';
  end if;
  return new;
end $$;
create trigger test_report_audit_failure before insert on public.governance_audit_events
for each row execute function pg_temp.reject_report_audit();

do $$
declare
  o uuid:='19000000-0000-4000-8000-000000000001';
  actor uuid:='19000000-0000-4000-8000-000000000002';
  other_actor uuid:='19000000-0000-4000-8000-000000000003';
  schedule uuid:='19000000-0000-4000-8000-000000000004';
  other_org uuid:='19000000-0000-4000-8000-000000000005';
  branch uuid:='19000000-0000-4000-8000-000000000006';
  farm uuid:='19000000-0000-4000-8000-000000000007';
  r jsonb; c jsonb; replay jsonb; v_run_id uuid; failed_id uuid;
begin
  insert into public.organizations(id,name) values(o,'Report transaction tests');
  insert into public.organizations(id,name) values(other_org,'Other report tenant');
  insert into public.profiles(id,org_id,full_name,role,is_active) values(actor,o,'CEO','ceo',true),(other_actor,o,'Other manager','farm_manager',true);
  r:=jsonb_build_object('name','Transaction test','scope','{}'::jsonb,'recipientIds',jsonb_build_array(actor::text),
    'periodFrom','2026-10-01','periodTo','2026-10-18','version','management-report-v1','scheduleId',null);
  begin
    perform public.claim_management_report(other_org,actor,'manual:other-tenant',repeat('a',64),r);
    raise exception 'Cross-tenant claim accepted';
  exception when insufficient_privilege then null; end;
  c:=public.claim_management_report(o,actor,'manual:transaction-test',repeat('a',64),r);
  if c->>'status'<>'claimed' then raise exception 'Initial claim failed'; end if;
  if public.claim_management_report(o,actor,'manual:transaction-test',repeat('a',64),r)->>'status'<>'busy' then raise exception 'Duplicate worker was not blocked'; end if;
  begin
    perform public.claim_management_report(o,actor,'manual:transaction-test',repeat('b',64),r);
    raise exception 'Changed retry accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.claim_management_report(o,other_actor,'manual:transaction-test',repeat('a',64),r);
    raise exception 'Another actor claimed the operation';
  exception when insufficient_privilege then null; end;
  perform set_config('test.report_audit_failure','on',true);
  begin
    perform public.finish_management_report(o,actor,'manual:transaction-test',(c->>'claim_token')::uuid,'{"eggs":10}',repeat('c',64),'Test org');
    raise exception 'Injected audit failure was ignored';
  exception when check_violation then null; end;
  if exists(select 1 from public.management_report_runs where org_id=o and status='completed') then raise exception 'Unaudited completion persisted'; end if;
  if (select status from public.management_report_operations where org_id=o and operation_key='manual:transaction-test')<>'pending' then raise exception 'Audit failure did not roll back receipt'; end if;
  perform set_config('test.report_audit_failure','off',true);
  v_run_id:=public.finish_management_report(o,actor,'manual:transaction-test',(c->>'claim_token')::uuid,'{"eggs":10}',repeat('c',64),'Test org');
  if not exists(select 1 from public.governance_audit_events where entity_id=v_run_id::text and event_type='management_report.generated') then raise exception 'Semantic audit missing'; end if;
  replay:=public.claim_management_report(o,actor,'manual:transaction-test',repeat('a',64),r);
  if replay->>'run_id'<>v_run_id::text then raise exception 'Completed retry changed identity'; end if;
  replay:=public.fail_management_report(o,actor,'manual:transaction-test',(c->>'claim_token')::uuid,'Lost response','Test org');
  if replay->>'status'<>'completed' or exists(select 1 from public.management_report_runs where org_id=o and status='failed') then raise exception 'Contradictory failed run appended'; end if;

  c:=public.claim_management_report(o,actor,'manual:expired-test',repeat('a',64),r);
  update public.management_report_operations set lease_until=clock_timestamp()-interval '1 second' where org_id=o and operation_key='manual:expired-test';
  replay:=public.claim_management_report(o,actor,'manual:expired-test',repeat('a',64),r);
  begin
    perform public.finish_management_report(o,actor,'manual:expired-test',(c->>'claim_token')::uuid,'{"eggs":10}',repeat('c',64),'Test org');
    raise exception 'Expired worker completed';
  exception when serialization_failure then null; end;
  perform public.fail_management_report(o,actor,'manual:expired-test',(replay->>'claim_token')::uuid,'Evidence failed','Test org');
  if (select count(*) from public.management_report_runs where org_id=o and status='failed')<>1 then raise exception 'Failed attempt missing'; end if;
  c:=public.claim_management_report(o,actor,'manual:expired-test',repeat('a',64),r);
  failed_id:=public.finish_management_report(o,actor,'manual:expired-test',(c->>'claim_token')::uuid,'{"eggs":10}',repeat('c',64),'Test org');
  if failed_id=v_run_id then raise exception 'Different operations merged'; end if;

  insert into public.management_report_schedules(id,org_id,created_by,name,cadence,run_day,run_hour,lookback_days,scope,recipient_ids,next_run_at)
  values(schedule,o,actor,'Transaction test','weekly',1,7,7,'{}',array[actor],now()-interval '1 hour');
  r:=jsonb_set(r,'{scheduleId}',to_jsonb(schedule::text));
  r:=jsonb_set(r,'{scheduleRevision}',to_jsonb((select updated_at from public.management_report_schedules where id=schedule)));
  c:=public.claim_management_report(o,actor,'schedule:transaction-test',repeat('d',64),r);
  update public.profiles set role='farm_manager' where id=actor;
  begin
    perform public.finish_management_report(o,actor,'schedule:transaction-test',(c->>'claim_token')::uuid,'{"eggs":10}',repeat('c',64),'Test org',now()+interval '1 week');
    raise exception 'Demoted schedule creator completed';
  exception when insufficient_privilege then null; end;
  update public.profiles set role='ceo' where id=actor;
  update public.management_report_schedules set updated_at=now()+interval '1 second' where id=schedule;
  begin
    perform public.finish_management_report(o,actor,'schedule:transaction-test',(c->>'claim_token')::uuid,'{"eggs":10}',repeat('c',64),'Test org',now()+interval '1 week');
    raise exception 'Stale schedule settings completed';
  exception when serialization_failure then null; end;
  update public.management_report_schedules set updated_at=(r->>'scheduleRevision')::timestamptz where id=schedule;
  v_run_id:=public.finish_management_report(o,actor,'schedule:transaction-test',(c->>'claim_token')::uuid,'{"eggs":10}',repeat('c',64),'Test org',now()+interval '1 week');
  if not exists(select 1 from public.management_report_schedules where id=schedule and next_run_at>now() and last_run_at is not null) then raise exception 'Schedule advance was not atomic'; end if;
  if has_function_privilege('authenticated','public.finish_management_report(uuid,uuid,text,uuid,jsonb,text,text,timestamptz)','EXECUTE') then raise exception 'Public finalization bypass'; end if;

  insert into public.branches(id,org_id,name) values(branch,o,'Report branch');
  insert into public.farms(id,org_id,branch_id,name) values(farm,o,branch,'Report farm');
  perform public.change_farm_manager_assignment(actor,farm,other_actor,now()-interval '1 day',null,null,null,'Report test assignment','grant');
  r:=r-'scheduleRevision'; r:=jsonb_set(r,'{scheduleId}','null');
  r:=jsonb_set(r,'{scope}',jsonb_build_object('farmId',farm));
  r:=jsonb_set(r,'{recipientIds}',jsonb_build_array(other_actor::text));
  c:=public.claim_management_report(o,other_actor,'manual:revoked-manager',repeat('f',64),r);
  update public.user_farm_access set revoked_at=now(),revocation_reason='Report regression test' where org_id=o and profile_id=other_actor and farm_id=farm;
  begin
    perform public.finish_management_report(o,other_actor,'manual:revoked-manager',(c->>'claim_token')::uuid,'{"eggs":10}',repeat('c',64),'Test org');
    raise exception 'Revoked assignment completed';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
