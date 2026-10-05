\set ON_ERROR_STOP on
begin;
insert into public.organizations(id, name) values
  ('18000000-0000-4000-8000-000000000001', 'CEO pilot gate A'),
  ('18000000-0000-4000-8000-000000000002', 'CEO pilot gate B');
insert into public.profiles(id, org_id, full_name, role, is_active) values
  ('18000000-0000-4000-8000-000000000003', '18000000-0000-4000-8000-000000000001', 'Pilot CEO', 'ceo', true),
  ('18000000-0000-4000-8000-000000000004', '18000000-0000-4000-8000-000000000001', 'Pilot manager', 'farm_manager', true),
  ('18000000-0000-4000-8000-000000000005', '18000000-0000-4000-8000-000000000001', 'Pilot admin', 'system_admin', true);

-- A privileged INSERT must not bypass the UPDATE guard or fake acceptance.
do $$ begin
  begin
    insert into public.organizations(id, name, today_pilot_accepted_at, simplified_ceo_workspace_enabled)
    values ('18000000-0000-4000-8000-000000000006', 'Forged pilot', now(), true);
    raise exception 'INSERT bypassed pilot gate.';
  exception when insufficient_privilege then null; end;
end $$;

-- Check each browser role; RLS denial/zero rows is also a valid denial.
set local role authenticated;
do $$ declare v_actor uuid; v_rows integer; begin
  foreach v_actor in array array[
    '18000000-0000-4000-8000-000000000003'::uuid,
    '18000000-0000-4000-8000-000000000004'::uuid,
    '18000000-0000-4000-8000-000000000005'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
    begin
      update public.organizations set today_pilot_accepted_at = now(), simplified_ceo_workspace_enabled = true
      where id = '18000000-0000-4000-8000-000000000001';
      get diagnostics v_rows = row_count;
      if v_rows > 0 then raise exception 'Browser role bypassed pilot gate.'; end if;
    exception when insufficient_privilege then null; end;
  end loop;
  perform set_config('request.jwt.claim.sub', '18000000-0000-4000-8000-000000000003', true);
  perform public.ceo_toggle_today_workspace('18000000-0000-4000-8000-000000000003', true, 'Manager pilot only');
end $$;
reset role;

-- Release credentials cannot invent acceptance, enable alone, or set both.
set local role service_role;
do $$ begin
  begin
    update public.organizations set today_pilot_accepted_at = now()
    where id = '18000000-0000-4000-8000-000000000001';
    raise exception 'Service role forged pilot acceptance.';
  exception when insufficient_privilege then null; end;
  begin
    update public.organizations set simplified_ceo_workspace_enabled = true
    where id = '18000000-0000-4000-8000-000000000001';
    raise exception 'Service role enabled CEO before pilot.';
  exception when insufficient_privilege then null; end;
  begin
    update public.organizations set today_pilot_accepted_at = now(), simplified_ceo_workspace_enabled = true
    where id = '18000000-0000-4000-8000-000000000001';
    raise exception 'Service role bypassed gate with timestamp.';
  exception when insufficient_privilege then null; end;
  perform public.release_toggle_today_workspace('18000000-0000-4000-8000-000000000001', false, 'Manager pilot rollback', 'release-task-7.4');
end $$;
reset role;

-- Normal organization edits and false/null no-ops remain compatible.
update public.organizations set name = 'CEO pilot gate renamed',
  simplified_ceo_workspace_enabled = false, today_pilot_accepted_at = null
where id = '18000000-0000-4000-8000-000000000001';
do $$ begin
  if exists(select 1 from public.organizations where id in (
    '18000000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000002'
  ) and (simplified_ceo_workspace_enabled or today_pilot_accepted_at is not null or today_workspace_enabled)) then
    raise exception 'Pilot gate or Today rollback changed wrong state.';
  end if;
  if not (public.verify_governance_audit_chain('18000000-0000-4000-8000-000000000001')->>'valid')::boolean then
    raise exception 'Manager rollout audit chain changed.';
  end if;
  raise notice 'CEO pilot gate, browser/release denial, and manager rollout compatibility passed.';
end $$;
rollback;
