-- The warning list is a presentation, never proof that one source is clear.
create function public.operational_action_source_state(p_org_id uuid,p_action_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.operational_actions; f public.flocks; v_id uuid; v_status text; v_farm uuid; v_store uuid;
  v_level numeric; v_balance numeric; v_count bigint; v_day date; v_state text;
  v_today date:=(now() at time zone 'UTC')::date; -- Updated with producer under finding 5.
begin
  select * into a from public.operational_actions where org_id=p_org_id and id=p_action_id;
  if not found then return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
  if a.source_key in ('daily-missing','mortality-spike','schedule-missed')
    or (a.warehouse_id is null and a.source_key ~ '^inv-[0-9a-f-]{36}$') then
    return jsonb_build_object('state','superseded','reason','LEGACY_UNSCOPED_WARNING');
  elsif a.source_key ~ '^reconciliation-[0-9a-f-]{36}$' then
    v_id:=substring(a.source_key from 16)::uuid;
    select status,farm_id,warehouse_id into v_status,v_farm,v_store from public.reconciliation_findings
      where id=v_id and org_id=p_org_id for share;
    if not found or v_farm is distinct from a.farm_id or v_store is distinct from a.warehouse_id then
      return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    v_state:=case when v_status in ('open','acknowledged','investigating') then 'active'
      when v_status in ('resolved','accepted_exception','cleared') then 'clear' else 'unavailable' end;
  elsif a.source_key ~ '^governance-[0-9a-f-]{36}$' then
    v_id:=substring(a.source_key from 12)::uuid;
    select status,farm_id,warehouse_id into v_status,v_farm,v_store from public.governance_requests
      where id=v_id and org_id=p_org_id for share;
    if not found or v_farm is distinct from a.farm_id or v_store is distinct from a.warehouse_id then
      return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    v_state:=case when v_status in ('applied','rejected','cancelled') then 'clear'
      when v_status in ('pending','returned','approved','conflict','expired') then 'active' else 'unavailable' end;
  elsif a.source_key ~ '^db-[0-9a-f-]{36}$' then
    v_id:=substring(a.source_key from 4)::uuid;
    select status::text into v_status from public.alerts where id=v_id and org_id=p_org_id for share;
    if not found then return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    v_state:=case when v_status='resolved' then 'clear' else 'active' end;
  elsif a.warehouse_id is not null and a.source_key like 'inv-'||a.warehouse_id::text||'-%' then
    v_id:=substring(a.source_key from 42)::uuid;
    perform 1 from public.warehouses where id=a.warehouse_id and org_id=p_org_id and status='active'
      and farm_id is not distinct from a.farm_id for share;
    if not found then return jsonb_build_object('state','unavailable','reason','WAREHOUSE_UNAVAILABLE'); end if;
    select reorder_level into v_level from public.inventory_items where id=v_id and org_id=p_org_id for share;
    if not found then return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    if v_level is null then return jsonb_build_object('state','clear','reason','WARNING_DISABLED'); end if;
    select count(*),sum(case when transaction_type in ('issue','transfer_out') then -quantity else quantity end)
      into v_count,v_balance from public.stock_ledger where org_id=p_org_id and warehouse_id=a.warehouse_id and item_id=v_id;
    if v_count=0 then return jsonb_build_object('state','unavailable','reason','STOCK_EVIDENCE_MISSING'); end if;
    return jsonb_build_object('state',case when v_balance<=v_level then 'active' else 'clear' end,
      'reason','STOCK_THRESHOLD','balance',v_balance,'reorder_level',v_level);
  elsif a.source_key ~ '^daily-missing-[0-9a-f-]{36}-[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    v_id:=substring(a.source_key from 15 for 36)::uuid; v_day:=substring(a.source_key from 52)::date;
    select * into f from public.flocks where id=v_id and org_id=p_org_id and farm_id=a.farm_id for share;
    if not found then return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    v_state:=case when not public.flock_operates_on(f,v_day) or exists(select 1 from public.daily_farm_records
      where org_id=p_org_id and flock_id=v_id and record_date=v_day and voided_at is null) then 'clear' else 'active' end;
  elsif a.source_key ~ '^mortality-spike-[0-9a-f-]{36}$' then
    v_id:=substring(a.source_key from 17)::uuid;
    perform 1 from public.flocks where id=v_id and org_id=p_org_id and farm_id=a.farm_id for share;
    if not found then return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    select coalesce(sum(count),0) into v_count from public.mortality_events
      where org_id=p_org_id and flock_id=v_id and record_date between v_today-7 and v_today;
    v_state:=case when v_count>=20 then 'active' else 'clear' end;
  elsif a.source_key ~ '^schedule-missed-[0-9a-f-]{36}$' then
    v_id:=substring(a.source_key from 17)::uuid;
    perform 1 from public.flocks where id=v_id and org_id=p_org_id and farm_id=a.farm_id for share;
    if not found then return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    select count(*) into v_count from (select distinct on (split_part(description,'|',2))
      split_part(description,'|',3) as status from public.health_events
      where org_id=p_org_id and flock_id=v_id and voided_at is null and event_date<=v_today
        and description like 'SCHEDULE_STATUS|%'
        and split_part(description,'|',2)<>'' and split_part(description,'|',3) in ('missed','completed')
      order by split_part(description,'|',2),created_at desc,id desc) latest where status='missed';
    v_state:=case when v_count>0 then 'active' else 'clear' end;
  else
    -- Unknown sources and the legacy KPI formulas need a reviewed checker,
    -- not absence from a limited list. Finding 5 replaces those formulas.
    return jsonb_build_object('state','unavailable','reason','UNSUPPORTED_SOURCE');
  end if;
  return jsonb_build_object('state',v_state,'reason','EXACT_SOURCE_STATUS');
exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
  return jsonb_build_object('state','unavailable','reason','INVALID_SOURCE_TARGET');
end $$;
revoke all on function public.operational_action_source_state(uuid,uuid) from public,anon,authenticated;
grant execute on function public.operational_action_source_state(uuid,uuid) to service_role;

alter table public.operational_action_events drop constraint operational_action_events_event_type_check;
alter table public.operational_action_events add constraint operational_action_events_event_type_check check(event_type in
  ('discovered','assigned','claimed','acknowledged','work_started','resolution_submitted','verification_failed','system_verified',
   'escalated','reopened','due_date_changed','exception_accepted','legacy_retired'));

-- Verification reads the exact source inside the locked save transaction.
do $$
declare v_definition text; v_anchor text; v_insert text;
begin
  v_definition:=pg_get_functiondef('public.apply_operational_action_transition(uuid,uuid,uuid,bigint,jsonb,text,text,text,boolean,uuid)'::regprocedure);
  if strpos(v_definition,'v_status text; v_owner uuid;')=0 then raise exception 'Action declarations changed; review migration.'; end if;
  v_definition:=replace(v_definition,'v_status text; v_owner uuid;','v_status text; v_owner uuid; v_source jsonb;');
  v_anchor:='    if p_event_type in (''assigned'',''due_date_changed'',''verification_failed'',''system_verified'') and v_actor.role::text<>''ceo'' then';
  if strpos(v_definition,v_anchor)=0 then raise exception 'Action verification boundary changed; review migration.'; end if;
  v_insert:=$check$
    if p_event_type in ('verification_failed','system_verified','legacy_retired') then
      if v_actor.role::text<>'ceo' then raise exception 'Only the CEO can verify or retire actions.' using errcode='42501'; end if;
      v_source:=public.operational_action_source_state(p_org_id,p_action_id);
      if p_event_type='legacy_retired' then
        if coalesce(v_source->>'state','unavailable')<>'superseded'
          or p_note is null or length(btrim(p_note)) not between 8 and 2000 then
          raise exception 'Only an older replaced warning can be retired, with a reason.' using errcode='22023'; end if;
        p_changes:=jsonb_set(p_changes,'{status}','"resolved"'); v_status:='resolved';
      else
        if coalesce(v_source->>'state','unavailable') not in ('active','clear') then
          raise exception 'Could not verify this problem. Its source is missing, unsupported or requires CEO review.' using errcode='55000'; end if;
        if v_source->>'state'='active' then
          p_event_type:='verification_failed'; p_note:='The exact source still reports this issue.'; v_status:='in_progress';
          p_changes:=p_changes||jsonb_build_object('status',v_status,'source_resolved_at',null,
            'context',split_part(v_before.context,' Source status:',1)||' Source status: The exact source still reports this issue.');
        else
          p_event_type:='system_verified'; p_note:='The exact source check is clear.'; v_status:='resolved';
          p_changes:=p_changes||jsonb_build_object('status',v_status,'source_resolved_at',now());
        end if;
      end if;
    end if;
$check$;
  v_definition:=replace(v_definition,v_anchor,v_insert||v_anchor);
  v_anchor:='  v_status:=coalesce(p_changes->>''status'',v_before.status);';
  if strpos(v_definition,v_anchor)=0 then raise exception 'Action source-clear guard changed; review migration.'; end if;
  v_definition:=replace(v_definition,v_anchor,$clear$
  if p_automated and p_changes ? 'source_resolved_at' and p_changes->'source_resolved_at'<>'null'::jsonb then
    v_source:=public.operational_action_source_state(p_org_id,p_action_id);
    if coalesce(v_source->>'state','unavailable')<>'clear' then
      raise exception 'Source changed. Refresh before continuing.' using errcode='40001'; end if;
  end if;
$clear$||v_anchor);
  v_anchor:='    elsif p_event_type<>''due_date_changed'' or p_event_type is null then';
  if strpos(v_definition,v_anchor)=0 then raise exception 'Action status guard changed; review migration.'; end if;
  v_definition:=replace(v_definition,v_anchor,'    elsif p_event_type=''legacy_retired'' then'||chr(10)||
    '      if v_status<>''resolved'' then raise exception ''Invalid retirement status.'' using errcode=''22023''; end if;'||chr(10)||v_anchor);
  execute v_definition;
end $$;
