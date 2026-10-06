\set ON_ERROR_STOP on
begin;
select set_config('request.jwt.claims', '{}', true);

insert into public.organizations(id, name) values
  ('15000000-0000-4000-8000-000000000001', 'Rollout tenant A'),
  ('15000000-0000-4000-8000-000000000002', 'Rollout tenant B');
insert into public.profiles(id, org_id, full_name, role, is_active) values
  ('15000000-0000-4000-8000-000000000003', '15000000-0000-4000-8000-000000000001', 'CEO A', 'ceo', true),
  ('15000000-0000-4000-8000-000000000004', '15000000-0000-4000-8000-000000000002', 'CEO B', 'ceo', true),
  ('15000000-0000-4000-8000-000000000005', '15000000-0000-4000-8000-000000000002', 'Manager B', 'farm_manager', true),
  ('15000000-0000-4000-8000-000000000006', '15000000-0000-4000-8000-000000000001', 'Inactive CEO', 'ceo', false);

set local role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-4000-8000-000000000005', true);
do $$
begin
  begin
    perform public.ceo_toggle_today_workspace('15000000-0000-4000-8000-000000000003', true, 'Spoof another tenant CEO');
    raise exception 'Cross-tenant impersonation was accepted.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ceo_toggle_today_workspace('15000000-0000-4000-8000-000000000004', true, 'Spoof own tenant CEO');
    raise exception 'Same-tenant impersonation was accepted.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ceo_toggle_today_workspace('15000000-0000-4000-8000-000000000005', true, 'Manager attempting rollout');
    raise exception 'A Farm Manager changed rollout.';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform public.ceo_toggle_today_workspace('15000000-0000-4000-8000-000000000003', true, 'No authenticated session');
    raise exception 'A missing session changed rollout.';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claim.sub', '15000000-0000-4000-8000-000000000006', true);
do $$
begin
  begin
    perform public.ceo_toggle_today_workspace('15000000-0000-4000-8000-000000000006', true, 'Inactive account attempt');
    raise exception 'An inactive CEO changed rollout.';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '15000000-0000-4000-8000-000000000003', true);
do $$
declare
  v_actor uuid := '15000000-0000-4000-8000-000000000003';
  v_reason text;
  v_result jsonb;
begin
  foreach v_reason in array array['', '   ', 'abc', repeat('x', 2001)] loop
    begin
      perform public.ceo_toggle_today_workspace(v_actor, true, v_reason);
      raise exception 'Invalid rollout reason accepted.';
    exception when invalid_parameter_value then null;
    end;
  end loop;
  begin
    perform public.ceo_toggle_today_workspace(v_actor, null, 'Null rollout state');
    raise exception 'Null rollout state accepted.';
  exception when invalid_parameter_value then null;
  end;
  v_result := public.ceo_toggle_today_workspace(v_actor, true, '  Approved isolated pilot  ');
  if v_result <> '{"changed":true,"today_workspace_enabled":true}'::jsonb then
    raise exception 'Valid enable failed.';
  end if;
  v_result := public.ceo_toggle_today_workspace(v_actor, true, 'Retry same rollout state');
  if (v_result->>'changed')::boolean then raise exception 'No-op reported a change.'; end if;
  perform public.ceo_toggle_today_workspace(v_actor, false, 'Return to legacy workflow');
end $$;
reset role;

do $$
begin
  if (select count(*) from public.governance_audit_events
      where org_id = '15000000-0000-4000-8000-000000000001'
        and event_type in ('today_workspace.enabled', 'today_workspace.disabled')) <> 2 then
    raise exception 'Rollout changes were not audited exactly once.';
  end if;
  if not exists (select 1 from public.governance_audit_events
      where org_id = '15000000-0000-4000-8000-000000000001'
        and event_type = 'today_workspace.enabled' and reason = 'Approved isolated pilot'
        and actor_id = '15000000-0000-4000-8000-000000000003'
        and before_values->>'today_workspace_enabled' = 'false'
        and after_values->>'today_workspace_enabled' = 'true') then
    raise exception 'Rollout audit lacks actor, reason, or before/after evidence.';
  end if;
  if exists (select 1 from public.organizations where id in (
    '15000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002'
  ) and today_workspace_enabled) then raise exception 'Rollout affected the wrong state or tenant.'; end if;
  if has_function_privilege('anon', 'public.ceo_toggle_today_workspace(uuid,boolean,text)', 'execute') then
    raise exception 'Anonymous users may execute rollout.';
  end if;
  raise notice 'Today rollout identity, tenant, reason, replay, and audit checks passed.';
end $$;
rollback;
