-- Server reporting metadata only. Current assignments are applied by each reader.
-- Original placement is retained; only the approved movement chain can relocate evidence.
create or replace function public.report_movement_chain_valid(p_org uuid,p_flock uuid) returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin return public.valid_flock_movement_chain(p_org,p_flock);
exception when invalid_text_representation or datetime_field_overflow then return false;
end $$;
revoke all on function public.report_movement_chain_valid(uuid,uuid) from public,anon,authenticated;
grant execute on function public.report_movement_chain_valid(uuid,uuid) to service_role;
drop function if exists public.report_flock_locations(uuid);
create function public.report_flock_locations(p_org uuid)
returns table(flock_id uuid,farm_id uuid,house_id uuid,from_date date,to_date date,verified boolean,from_at timestamptz,to_at timestamptz,starts_with_move boolean)
language sql stable security definer set search_path=public,pg_temp as $$
  with origins as (
    select f.id flock_id,f.placement_date from_date,
      case when exists(select 1 from public.flock_transfers m where m.org_id=p_org and m.flock_id=f.id) then b.house_id else f.house_id end house_id,
      case when exists(select 1 from public.flock_transfers m where m.org_id=p_org and m.flock_id=f.id)
        then public.report_movement_chain_valid(p_org,f.id) else true end verified,
      coalesce(f.placed_at,f.placement_date::timestamp at time zone 'Africa/Addis_Ababa') at_time,
      0 position
    from public.flocks f left join public.batches b on b.id=f.batch_id and b.org_id=p_org where f.org_id=p_org
  ), points as (
    select * from origins
    union all
    select m.flock_id,(m.moved_at at time zone 'Africa/Addis_Ababa')::date,m.to_house_id,o.verified,m.moved_at,1
    from public.flock_transfers m join origins o on o.flock_id=m.flock_id where m.org_id=p_org
  ), periods as (
    select *,lead(from_date) over(partition by points.flock_id order by at_time nulls first,position,house_id) end_date,
      lead(at_time) over(partition by points.flock_id order by at_time nulls first,position,house_id) end_time
    from points
  ) select p.flock_id,h.farm_id,p.house_id,p.from_date,p.end_date,p.verified and h.id is not null and p.from_date is not null,p.at_time,p.end_time,p.position=1
    from periods p left join public.houses h on h.id=p.house_id and h.org_id=p_org;
$$;
revoke all on function public.report_flock_locations(uuid) from public,anon,authenticated;
grant execute on function public.report_flock_locations(uuid) to service_role;

-- Existing period totals retain no source-store manifest. Do not let a direct
-- browser SELECT bypass the reporting reader's fail-closed legacy rule.
drop policy if exists monthly_cost_periods_verified_sources on public.monthly_cost_periods;
create policy monthly_cost_periods_verified_sources on public.monthly_cost_periods
as restrictive for select to authenticated using (
  public.current_active_role()<>'farm_manager' or public.has_active_break_glass(org_id)
);
