create or replace function public.ceo_toggle_today_workspace(
  p_actor_id uuid,
  p_enabled boolean,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_role text;
  v_current boolean;
  v_result jsonb;
begin
  if auth.uid() is distinct from p_actor_id then
    raise exception 'Actor must match the signed-in user.' using errcode = '42501';
  end if;

  select org_id, role::text into v_org_id, v_role
  from public.profiles where id = p_actor_id and is_active;

  if v_org_id is null or v_role <> 'ceo' then
    raise exception 'Only an active CEO can change the Today workspace rollout.' using errcode = '42501';
  end if;

  if p_enabled is null then
    raise exception 'An enabled or disabled state is required.' using errcode = '22023';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 4 and 2000 then
    raise exception 'A reason of 4 to 2000 characters is required.' using errcode = '22023';
  end if;

  select today_workspace_enabled into v_current
  from public.organizations where id = v_org_id for update;

  if v_current is distinct from p_enabled then
    update public.organizations
    set today_workspace_enabled = p_enabled
    where id = v_org_id;

    insert into public.governance_audit_events(
      org_id, actor_id, actor_role, event_type, operation, source,
      entity_table, entity_id, reason, before_values, after_values
    ) values (
      v_org_id, p_actor_id, 'ceo',
      'today_workspace.' || case when p_enabled then 'enabled' else 'disabled' end,
      'decision', 'semantic',
      'organizations', v_org_id,
      btrim(p_reason),
      jsonb_build_object('today_workspace_enabled', v_current),
      jsonb_build_object('today_workspace_enabled', p_enabled)
    );
  end if;

  v_result := jsonb_build_object(
    'today_workspace_enabled', p_enabled,
    'changed', v_current is distinct from p_enabled
  );
  return v_result;
end;
$$;

revoke all on function public.ceo_toggle_today_workspace(uuid, boolean, text) from public, anon;
grant execute on function public.ceo_toggle_today_workspace(uuid, boolean, text) to authenticated;
