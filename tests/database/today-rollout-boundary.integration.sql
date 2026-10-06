\set ON_ERROR_STOP on
begin;
-- Hosted Supabase can initialize request.jwt.claims to an empty string.
-- A direct psql test needs a valid JSON envelope just like PostgREST supplies.
select set_config('request.jwt.claims', '{}', true);
insert into public.organizations(id, name) values
  ('17000000-0000-4000-8000-000000000001', 'Rollout boundary A'),
  ('17000000-0000-4000-8000-000000000002', 'Rollout boundary B');
insert into public.profiles(id, org_id, full_name, role, is_active) values
  ('17000000-0000-4000-8000-000000000003', '17000000-0000-4000-8000-000000000001', 'Rollout CEO', 'ceo', true),
  ('17000000-0000-4000-8000-000000000004', '17000000-0000-4000-8000-000000000001', 'Rollout manager', 'farm_manager', true),
  ('17000000-0000-4000-8000-000000000005', '17000000-0000-4000-8000-000000000001', 'Rollout admin', 'system_admin', true);
set local role authenticated;
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000004', true);
do $$ declare v_rows integer; begin
  begin
    update public.organizations set today_workspace_enabled = true where id = '17000000-0000-4000-8000-000000000001';
    get diagnostics v_rows = row_count;
    if v_rows > 0 then raise exception 'Manager bypassed rollout RPC.'; end if;
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_today_workspace_rollout('17000000-0000-4000-8000-000000000001', true, 'Bypass private function', null, 'fake-release');
    raise exception 'Private rollout helper is public.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.release_toggle_today_workspace('17000000-0000-4000-8000-000000000001', true, 'Manager spoofing release', 'fake-release');
    raise exception 'Manager executed release operation.';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000005', true);
do $$ begin
  begin
    perform public.ceo_toggle_today_workspace('17000000-0000-4000-8000-000000000005', true, 'Admin bypassing CEO');
    raise exception 'System admin toggled as CEO.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.release_toggle_today_workspace('17000000-0000-4000-8000-000000000001', true, 'Admin bypassing release', 'fake-release');
    raise exception 'Browser admin executed release operation.';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub', '17000000-0000-4000-8000-000000000003', true);
do $$ declare v_rows integer; begin
  begin
    update public.organizations set today_workspace_enabled = true where id = '17000000-0000-4000-8000-000000000001';
    get diagnostics v_rows = row_count;
    if v_rows > 0 then raise exception 'CEO changed rollout without evidence.'; end if;
  exception when insufficient_privilege then null; end;
  perform public.ceo_toggle_today_workspace('17000000-0000-4000-8000-000000000003', true, 'Enable isolated manager pilot');
  perform public.ceo_toggle_today_workspace('17000000-0000-4000-8000-000000000003', true, 'Retry enable');
  if (select count(*) from public.governance_audit_events where source = 'semantic' and event_type like 'today_workspace.%') <> 1 then
    raise exception 'CEO history is duplicated or not tenant scoped.';
  end if;
  begin
    delete from public.governance_audit_events where org_id = '17000000-0000-4000-8000-000000000001';
    raise exception 'Audit evidence can be deleted.';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
do $$ begin
  begin
    update public.organizations set today_workspace_enabled = false where id = '17000000-0000-4000-8000-000000000001';
    raise exception 'Service role bypassed evidence requirement.';
  exception when insufficient_privilege then null; end;
  begin
    perform public.release_toggle_today_workspace('17000000-0000-4000-8000-000000000001', false, 'Release rollback', 'bad');
    raise exception 'Missing release reference accepted.';
  exception when invalid_parameter_value then null; end;
  perform public.release_toggle_today_workspace('17000000-0000-4000-8000-000000000001', false, 'Release rollback', 'release-cb948a6');
  perform public.release_toggle_today_workspace('17000000-0000-4000-8000-000000000001', false, 'Retry rollback', 'release-cb948a6');
end $$;
reset role;
do $$ begin
  if (select count(*) from public.governance_audit_events where org_id = '17000000-0000-4000-8000-000000000001' and source = 'semantic' and event_type like 'today_workspace.%') <> 2 then
    raise exception 'Enable/rollback were not audited exactly once.';
  end if;
  if not exists(select 1 from public.governance_audit_events where org_id = '17000000-0000-4000-8000-000000000001'
    and event_type = 'today_workspace.disabled' and actor_id is null and actor_role = 'system_release'
    and metadata->>'release_reference' = 'release-cb948a6' and reason = 'Release rollback') then
    raise exception 'Release audit evidence missing.';
  end if;
  if current_setting('app.today_rollout_context', true) <> '' then raise exception 'Rollout context leaked.'; end if;
  if exists(select 1 from public.organizations where id in ('17000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000002') and today_workspace_enabled) then
    raise exception 'Rollback changed wrong organization or failed.';
  end if;
  if not (public.verify_governance_audit_chain('17000000-0000-4000-8000-000000000001')->>'valid')::boolean then
    raise exception 'Rollout audit chain invalid.';
  end if;
  raise notice 'Rollout direct-write, CEO, release, audit and rollback boundary passed.';
end $$;
rollback;
