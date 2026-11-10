-- One authorized snapshot replaces the per-flock HTTP token/context reads.
create function public.today_farm_resource_tokens(p_actor uuid,p_farm uuid,p_day date,p_flocks uuid[],p_starts uuid[])
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_org uuid; v_rows jsonb:='[]'; v_flock public.flocks; v_daily uuid; v_daily_updated timestamptz; v_start jsonb;
begin
 select org_id into v_org from public.farms where id=p_farm;
 if v_org is null or p_day is null or not public.actor_has_operational_scope(p_actor,v_org,p_farm,null)
   or (auth.uid() is not null and auth.uid()<>p_actor) then raise exception 'Farm access required' using errcode='42501'; end if;
 if p_flocks is null or p_starts is null or cardinality(p_flocks)>1000
   or cardinality(p_flocks)<>(select count(distinct id) from unnest(p_flocks) id)
   or not p_starts<@p_flocks or cardinality(p_flocks)<>(select count(*) from public.flocks f
     where f.id=any(p_flocks) and f.org_id=v_org and f.farm_id=p_farm and public.flock_operates_on(f,p_day))
 then raise exception 'Flock scope changed' using errcode='40001'; end if;
 for v_flock in select * from public.flocks where id=any(p_flocks) order by id loop
   select id,updated_at into v_daily,v_daily_updated from public.daily_farm_records where org_id=v_org and flock_id=v_flock.id and record_date=p_day and voided_at is null;
   v_start:=null;
   if v_flock.id=any(p_starts) then
     begin v_start:=public.recording_start_context(p_actor,v_flock.id);
     exception when others then v_start:=null; end;
   end if;
   v_rows:=v_rows||jsonb_build_array(jsonb_build_object('flock_id',v_flock.id,'daily_record_id',v_daily,'daily_updated_at',v_daily_updated,
     'daily_revision',case when v_daily is not null then public.today_resource_revision('daily_record',v_daily,null) end,
     'feed_revision',public.today_resource_revision('feed_day',v_flock.id,p_day),
     'health_fingerprint',public.today_source_fingerprint(p_farm,v_flock.id,p_day,'health_deaths'),
     'supplies_fingerprint',public.today_source_fingerprint(p_farm,v_flock.id,p_day,'routine_supplies'),
     'start_context',v_start));
 end loop;
 return jsonb_build_object('operating_revision',public.today_resource_revision('operating_day',p_farm,p_day),'flocks',v_rows);
end $$;
revoke all on function public.today_farm_resource_tokens(uuid,uuid,date,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.today_farm_resource_tokens(uuid,uuid,date,uuid[],uuid[]) to service_role;
