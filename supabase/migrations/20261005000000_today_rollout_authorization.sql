-- Rollout changes must use the CEO or credentialed release boundary, with evidence.
create function public.guard_today_workspace_rollout()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  v_context jsonb;
begin
  if new.today_workspace_enabled is not distinct from old.today_workspace_enabled then return new; end if;
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Use the authorized Today rollout operation.' using errcode = '42501';
  end if;
  v_context := nullif(current_setting('app.today_rollout_context', true), '')::jsonb;
  if v_context is null or v_context->>'org_id' is distinct from new.id::text
     or coalesce(length(btrim(v_context->>'reason')), 0) not between 4 and 2000
     or coalesce(v_context->>'source', '') not in ('ceo', 'system_release') then
    raise exception 'Today rollout requires an authorized reason and audit context.' using errcode = '42501';
  end if;
  insert into public.governance_audit_events(
    org_id, actor_id, actor_role, event_type, operation, source,
    entity_table, entity_id, reason, before_values, after_values, metadata
  ) values (
    new.id, nullif(v_context->>'actor_id', '')::uuid,
    case when v_context->>'source' = 'ceo' then 'ceo' else 'system_release' end,
    'today_workspace.' || case when new.today_workspace_enabled then 'enabled' else 'disabled' end,
    'decision', 'semantic', 'organizations', new.id::text, btrim(v_context->>'reason'),
    jsonb_build_object('today_workspace_enabled', old.today_workspace_enabled),
    jsonb_build_object('today_workspace_enabled', new.today_workspace_enabled),
    jsonb_build_object('rollout_source', v_context->>'source', 'release_reference', v_context->>'release_reference')
  );
  return new;
end;
$$;
revoke all on function public.guard_today_workspace_rollout() from public, anon, authenticated, service_role;
create trigger guard_today_workspace_rollout
before update of today_workspace_enabled on public.organizations
for each row execute function public.guard_today_workspace_rollout();

create function public.apply_today_workspace_rollout(
  p_org_id uuid, p_enabled boolean, p_reason text, p_actor_id uuid, p_release_reference text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_current boolean;
  v_previous_context text := coalesce(current_setting('app.today_rollout_context', true), '');
begin
  if p_enabled is null then
    raise exception 'An enabled or disabled state is required.' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 4 and 2000 then
    raise exception 'A reason of 4 to 2000 characters is required.' using errcode = '22023';
  end if;
  select today_workspace_enabled into v_current from public.organizations where id = p_org_id for update;
  if not found then raise exception 'Organization not found.' using errcode = '22023'; end if;
  if v_current is distinct from p_enabled then
    perform set_config('app.today_rollout_context', jsonb_build_object(
      'org_id', p_org_id, 'actor_id', p_actor_id, 'reason', btrim(p_reason),
      'source', case when p_actor_id is null then 'system_release' else 'ceo' end,
      'release_reference', p_release_reference
    )::text, true);
    update public.organizations set today_workspace_enabled = p_enabled where id = p_org_id;
    perform set_config('app.today_rollout_context', v_previous_context, true);
  end if;
  return jsonb_build_object('today_workspace_enabled', p_enabled, 'changed', v_current is distinct from p_enabled);
end;
$$;
revoke all on function public.apply_today_workspace_rollout(uuid, boolean, text, uuid, text) from public, anon, authenticated, service_role;

create or replace function public.ceo_toggle_today_workspace(p_actor_id uuid, p_enabled boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_org_id uuid;
begin
  if auth.uid() is distinct from p_actor_id then
    raise exception 'Actor must match the signed-in user.' using errcode = '42501';
  end if;
  select org_id into v_org_id from public.profiles where id = p_actor_id and is_active and role::text = 'ceo';
  if v_org_id is null then
    raise exception 'Only an active CEO can change the Today workspace rollout.' using errcode = '42501';
  end if;
  return public.apply_today_workspace_rollout(v_org_id, p_enabled, p_reason, p_actor_id, null);
end;
$$;

-- No browser/system-admin route: release credentials are required for this operation.
create function public.release_toggle_today_workspace(
  p_org_id uuid, p_enabled boolean, p_reason text, p_release_reference text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_release_reference is null or length(btrim(p_release_reference)) not between 7 and 200 then
    raise exception 'A release reference of 7 to 200 characters is required.' using errcode = '22023';
  end if;
  return public.apply_today_workspace_rollout(p_org_id, p_enabled, p_reason, null, btrim(p_release_reference));
end;
$$;
revoke all on function public.release_toggle_today_workspace(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.release_toggle_today_workspace(uuid, boolean, text, text) to service_role;
comment on function public.release_toggle_today_workspace(uuid, boolean, text, text) is
  'Credentialed release-only rollout/rollback. Records organization, reason, release reference and before/after state atomically.';
