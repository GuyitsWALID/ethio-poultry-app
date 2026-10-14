-- Resolve explicitly named receipts inside the same transaction as the mutation.
alter table public.client_operation_receipts add column chain_context jsonb;
alter function public.today_resource_revision(text,uuid,date) rename to today_resource_revision_pre_sessions_v1;
revoke all on function public.today_resource_revision_pre_sessions_v1(text,uuid,date) from public,anon,authenticated,service_role;
create function public.today_resource_revision(p_resource_type text,p_resource_id uuid,p_work_date date default null)
returns text language plpgsql stable security definer set search_path=public,extensions as $$
begin
  if p_resource_type<>'feed_day' then return public.today_resource_revision_pre_sessions_v1(p_resource_type,p_resource_id,p_work_date); end if;
  return public.canonical_today_payload_hash(jsonb_build_object(
    'closures',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.feed_day_closures c where c.flock_id=p_resource_id and c.record_date=p_work_date),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.feeding_session_records s where s.flock_id=p_resource_id and s.record_date=p_work_date),'[]'::jsonb)));
end $$;
revoke all on function public.today_resource_revision(text,uuid,date) from public,anon,authenticated;
grant execute on function public.today_resource_revision(text,uuid,date) to service_role;
alter function public.dispatch_today_command_v1(uuid,jsonb) rename to dispatch_today_command_pre_chains_v1;
revoke all on function public.dispatch_today_command_pre_chains_v1(uuid,jsonb) from public,anon,authenticated;

create function public.dispatch_today_command_v1(p_actor_id uuid,p_command jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
  v_org uuid; v_enabled boolean; v_id uuid := (p_command->>'command_id')::uuid;
  v_farm uuid := (p_command->>'farm_id')::uuid;
  v_flock uuid := nullif(p_command->>'flock_id','')::uuid;
  v_date date := (p_command->>'work_date')::date;
  v_type text := p_command->>'type'; v_hash text := public.canonical_today_payload_hash(p_command);
  v_command jsonb := p_command; v_receipt public.client_operation_receipts;
  v_ref text; v_ref_id uuid; v_prior jsonb; v_daily uuid; v_revision text;
  v_root jsonb; v_after jsonb; v_task text; v_result jsonb;
begin
  select p.org_id,o.today_workspace_enabled into v_org,v_enabled from public.profiles p
  join public.organizations o on o.id=p.org_id
  where p.id=p_actor_id and p.is_active and p.role::text='farm_manager';
  if auth.uid() is distinct from p_actor_id or v_org is null then raise exception 'An active Farm Manager is required.' using errcode='42501'; end if;
  if not v_enabled then raise exception 'Today workspace is not enabled.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text||p_actor_id::text||v_id::text,0));
  select * into v_receipt from public.client_operation_receipts where org_id=v_org and actor_id=p_actor_id and command_id=v_id;
  if found then
    if v_receipt.payload_hash<>v_hash then raise exception 'This command ID was already used with a different payload.' using errcode='22023'; end if;
    if v_receipt.result is not null then return v_receipt.result; end if;
  end if;
  if not exists(select 1 from public.user_farm_access a join public.farms f on f.id=a.farm_id and f.org_id=v_org
    where a.org_id=v_org and a.profile_id=p_actor_id and a.farm_id=v_farm and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()))
    then raise exception 'An active farm assignment is required.' using errcode='42501'; end if;
  if v_flock is not null then
    perform 1 from public.flocks where id=v_flock and org_id=v_org and farm_id=v_farm for update;
    if not found then raise exception 'Flock assignment not found.' using errcode='42501'; end if;
    select id into v_daily from public.daily_farm_records where org_id=v_org and flock_id=v_flock and record_date=v_date and voided_at is null for update;
    perform 1 from public.feeding_session_records where org_id=v_org and flock_id=v_flock and record_date=v_date for update;
    perform 1 from public.feed_day_closures where org_id=v_org and flock_id=v_flock and record_date=v_date for update;
    v_root:=jsonb_build_object('health_deaths',public.today_source_fingerprint(v_farm,v_flock,v_date,'health_deaths'),'routine_supplies',public.today_source_fingerprint(v_farm,v_flock,v_date,'routine_supplies'));
  end if;
  foreach v_ref in array array['revision_from','daily_revision_from','fingerprint_from'] loop
    v_ref_id:=nullif(p_command->>v_ref,'')::uuid;
    if v_ref_id is null then continue; end if;
    if v_ref_id=v_id or not coalesce(p_command->'depends_on','[]'::jsonb) @> jsonb_build_array(v_ref_id::text) then raise exception 'Receipt reference must be an earlier dependency.' using errcode='22023'; end if;
    select chain_context into v_prior from public.client_operation_receipts
    where org_id=v_org and actor_id=p_actor_id and command_id=v_ref_id and result->>'status'='applied';
    if v_prior is null or v_prior->>'farm_id' is distinct from v_farm::text
      or v_prior->>'flock_id' is distinct from v_flock::text or v_prior->>'work_date' is distinct from v_date::text
      then raise exception 'Required dependency is unavailable or outside this work.' using errcode='23514'; end if;
    if v_ref='fingerprint_from' then
      if v_type<>'confirm_no_activity' then raise exception 'Invalid fingerprint dependency.' using errcode='22023'; end if;
      v_task:=p_command->'payload'->>'task_code';
      if v_task not in ('health_deaths','routine_supplies') or
        (p_command->'payload'->>'source_fingerprint' is distinct from v_prior->'root_fingerprints'->>v_task
         and p_command->'payload'->>'source_fingerprint' is distinct from v_prior->'fingerprints'->>v_task)
        or public.today_source_fingerprint(v_farm,v_flock,v_date,v_task) is distinct from v_prior->'fingerprints'->>v_task
        then raise exception 'Source fingerprint changed outside this receipt chain.' using errcode='40001'; end if;
      v_command:=jsonb_set(v_command,'{payload,source_fingerprint}',v_prior->'fingerprints'->v_task);
    elsif v_ref='daily_revision_from' or v_type='save_daily_record' then
      if v_type not in ('save_daily_record','close_feed_day') or v_prior->>'daily_revision' is null then raise exception 'Invalid daily resource dependency.' using errcode='22023'; end if;
      if v_daily is null or v_daily::text is distinct from v_prior->>'daily_id'
        or public.today_resource_revision('daily_record',v_daily,null) is distinct from v_prior->>'daily_revision'
        then raise exception 'Daily record revision changed outside this receipt chain.' using errcode='40001'; end if;
      v_root:=v_prior->'root_fingerprints';
      if v_type='save_daily_record' then
        v_revision:=v_prior->>'daily_revision';
        v_command:=jsonb_set(jsonb_set(v_command,'{expected_resource_revision}',to_jsonb(v_revision)),'{payload,daily_record_id}',to_jsonb(v_daily::text));
        if v_command->'payload'->'record' ? '_today_bird_loss' then v_command:=jsonb_set(v_command,'{payload,record,_today_bird_loss,expected_revision}',to_jsonb(v_revision)); end if;
      end if;
    else
      if v_type not in ('save_feed_session','close_feed_day') or v_prior->>'feed_revision' is null then raise exception 'Invalid feed resource dependency.' using errcode='22023'; end if;
      v_command:=jsonb_set(v_command,'{expected_resource_revision}',v_prior->'feed_revision');
    end if;
  end loop;
  if v_type='confirm_no_activity' and v_command->'payload'->>'task_code'='health_deaths' and (
    exists(select 1 from public.daily_farm_records where flock_id=v_flock and record_date=v_date and voided_at is null and (deaths>0 or culls>0))
    or exists(select 1 from public.mortality_events where flock_id=v_flock and record_date=v_date)
    or exists(select 1 from public.health_events where flock_id=v_flock and event_date=v_date and voided_at is null)
    or exists(select 1 from public.vaccination_events where flock_id=v_flock and event_date=v_date)
  ) then raise exception 'Health activity exists; none today cannot be confirmed.' using errcode='23514'; end if;
  if v_type='confirm_no_activity' and v_command->'payload'->>'task_code'='routine_supplies' and exists(
    select 1 from public.stock_ledger where org_id=v_org and flock_id=v_flock and transaction_date=v_date and source_kind='daily_record_usage'
  ) then raise exception 'Supply usage exists; none today cannot be confirmed.' using errcode='23514'; end if;
  v_result:=public.dispatch_today_command_pre_chains_v1(p_actor_id,v_command);
  if v_result->>'status'='applied' then
    select id into v_daily from public.daily_farm_records where org_id=v_org and flock_id=v_flock and record_date=v_date and voided_at is null;
    if v_flock is not null then v_after:=jsonb_build_object('health_deaths',public.today_source_fingerprint(v_farm,v_flock,v_date,'health_deaths'),'routine_supplies',public.today_source_fingerprint(v_farm,v_flock,v_date,'routine_supplies')); end if;
    update public.client_operation_receipts set payload_hash=v_hash,chain_context=jsonb_build_object(
      'farm_id',v_farm,'flock_id',v_flock,'work_date',v_date,'daily_id',v_daily,
      'daily_revision',case when v_daily is not null then public.today_resource_revision('daily_record',v_daily,null) end,
      'feed_revision',case when v_type in ('save_feed_session','close_feed_day') then public.today_resource_revision('feed_day',v_flock,v_date) end,
      'root_fingerprints',v_root,'fingerprints',v_after)
    where org_id=v_org and actor_id=p_actor_id and command_id=v_id;
  end if;
  return v_result;
end $$;
revoke all on function public.dispatch_today_command_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.dispatch_today_command_v1(uuid,jsonb) to authenticated;
