-- Focused Today cards update one part of a Daily Record at a time. Preserve
-- the other authoritative fields and routine-supply ledger unless the caller
-- explicitly sends a replacement usage array.

alter function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb)
  rename to save_daily_record_with_usage_full_v1;

create function public.save_daily_record_with_usage(
  p_actor_id uuid,
  p_daily_record_id uuid,
  p_flock_id uuid,
  p_record jsonb,
  p_usages jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_record_date date;
  v_existing public.daily_farm_records;
  v_has_existing boolean := false;
  v_merged_record jsonb;
  v_normalized_usages jsonb;
begin
  select p.org_id into v_org_id
  from public.profiles p
  where p.id = p_actor_id;

  v_record_date := nullif(p_record->>'record_date', '')::date;

  if p_daily_record_id is not null then
    select dfr.* into v_existing
    from public.daily_farm_records dfr
    where dfr.id = p_daily_record_id
      and dfr.org_id = v_org_id
      and dfr.flock_id = p_flock_id;
    v_has_existing := found;
  elsif v_record_date is not null then
    select dfr.* into v_existing
    from public.daily_farm_records dfr
    where dfr.org_id = v_org_id
      and dfr.flock_id = p_flock_id
      and dfr.record_date = v_record_date;
    v_has_existing := found;
  end if;

  if v_has_existing then
    p_daily_record_id := v_existing.id;
    v_merged_record := (
      to_jsonb(v_existing)
      - array[
        'id', 'org_id', 'flock_id', 'recorded_by', 'created_at', 'updated_at',
        'voided_at', 'voided_by', 'void_reason',
        'feed_intake_grams', 'feed_intake_quantity', 'feed_type'
      ]
    ) || coalesce(p_record, '{}'::jsonb);
  else
    v_merged_record := coalesce(p_record, '{}'::jsonb);
  end if;

  -- JSON null is how the command envelope says "do not touch supplies".
  -- A JSON array, including [], remains an explicit replacement.
  v_normalized_usages := case
    when p_usages is null or p_usages = 'null'::jsonb then null
    else p_usages
  end;

  return public.save_daily_record_with_usage_full_v1(
    p_actor_id,
    p_daily_record_id,
    p_flock_id,
    v_merged_record,
    v_normalized_usages
  );
end;
$$;

revoke all on function public.save_daily_record_with_usage_full_v1(uuid, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_daily_record_with_usage_full_v1(uuid, uuid, uuid, jsonb, jsonb)
  to service_role;

revoke all on function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb)
  to service_role;

comment on function public.save_daily_record_with_usage(uuid, uuid, uuid, jsonb, jsonb) is
  'Stable Daily Record command seam. Merges focused field patches and preserves usage when usages is SQL or JSON null.';
