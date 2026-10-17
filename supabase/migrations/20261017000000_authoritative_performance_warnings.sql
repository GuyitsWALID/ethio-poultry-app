-- One calculation for warning discovery and locked final verification.
-- Matches Flock Profile: matched evidence, bird-day denominators, weighted
-- age-specific targets and a production shortfall of >3 / >7.5 percentage points.
create function public.operational_performance_warnings(p_org_id uuid,p_flock_id uuid default null,
  p_today date default (now() at time zone 'Africa/Addis_Ababa')::date)
returns jsonb language sql stable security definer set search_path=public as $$
with flocks_in_scope as (
  select f.*,greatest(f.placement_date,p_today-29) as period_from
  from public.flocks f where f.org_id=p_org_id and (p_flock_id is null or f.id=p_flock_id)
), evidence as (
  select f.id,f.farm_id,f.house_id,f.flock_code,f.flock_type,f.status,f.completed_at,f.placement_date,f.period_from,
    d.record_date,coalesce(d.opening_birds,d.closing_birds) as birds,d.total_eggs,d.deaths,
    t.target_hdep_pct,t.target_mortality_pct
  from flocks_in_scope f left join public.daily_farm_records d on d.org_id=p_org_id and d.flock_id=f.id
    and d.voided_at is null and d.record_date between f.period_from and p_today
  left join public.breed_standards t on t.org_id=p_org_id and t.breed_id=f.breed_id
    and t.week_number=floor((greatest(0,d.record_date-f.placement_date)+greatest(0,f.age_at_placement_days))/7.0)
), metrics as (
  select id,farm_id,house_id,flock_code,flock_type,status,completed_at,placement_date,period_from,
    count(*) filter(where birds>0 and total_eggs is not null) as egg_days,
    count(*) filter(where birds>0 and deaths is not null) as death_days,
    count(*) filter(where birds>0 and total_eggs is not null and target_hdep_pct is null) as missing_egg_targets,
    count(*) filter(where birds>0 and deaths is not null and target_mortality_pct is null) as missing_death_targets,
    round(100.0*sum(total_eggs) filter(where birds>0 and total_eggs is not null)/
      nullif(sum(birds) filter(where birds>0 and total_eggs is not null),0),2) as production,
    round(sum(birds*target_hdep_pct) filter(where birds>0 and total_eggs is not null)/
      nullif(sum(birds) filter(where birds>0 and total_eggs is not null),0),2) as production_target,
    round(100.0*sum(deaths) filter(where birds>0 and deaths is not null)/
      nullif(sum(birds) filter(where birds>0 and deaths is not null),0),2) as mortality,
    round(sum(birds*target_mortality_pct) filter(where birds>0 and deaths is not null)/
      nullif(sum(birds) filter(where birds>0 and deaths is not null),0),2) as mortality_target
  from evidence group by id,farm_id,house_id,flock_code,flock_type,status,completed_at,placement_date,period_from
), warnings as (
  select m.*,k.kind,
    case when kind='production' then production else mortality end as actual,
    case when kind='production' then production_target else mortality_target end as target,
    case when kind='production' then egg_days else death_days end as evidence_days,
    case when kind='production' then missing_egg_targets else missing_death_targets end as missing_targets
  from metrics m cross join (values ('production'),('mortality')) k(kind)
)
select coalesce(jsonb_agg(jsonb_build_object(
  'flock_id',id,'farm_id',farm_id,'house_id',house_id,'flock_code',flock_code,'kind',kind,
  'date_from',period_from,'date_to',p_today,'evidence_days',evidence_days,
  'expected_days',greatest(0,p_today-period_from+1),'actual',actual,
  'target',case when missing_targets=0 then target end,
  'severity',case when kind='mortality' or actual-target < -7.5 then 'high' else 'medium' end,
  'state',case when status not in ('active','quarantined') or completed_at is not null or placement_date>p_today
      or (kind='production' and flock_type not in ('layer','parent_stock')) then 'clear'
    when actual is null or target is null or missing_targets>0 then 'unavailable'
    when (kind='production' and actual-target < -3) or (kind='mortality' and actual>target) then 'active'
    else 'clear' end
) order by id,kind),'[]'::jsonb) from warnings;
$$;
revoke all on function public.operational_performance_warnings(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.operational_performance_warnings(uuid,uuid,date) to service_role;

do $$
declare definition text; anchor text;
begin
  definition:=pg_get_functiondef('public.operational_action_source_state(uuid,uuid)'::regprocedure);
  if strpos(definition,'v_today-7')=0 or strpos(definition,'''UTC''')=0 then
    raise exception 'Warning date boundary changed; review migration.'; end if;
  definition:=replace(definition,'''UTC''','''Africa/Addis_Ababa''');
  definition:=replace(definition,'v_today-7','v_today-6');
  definition:=replace(definition,'''daily-missing'',''mortality-spike'',''schedule-missed''',
    '''daily-missing'',''mortality-spike'',''schedule-missed'',''kpi-production-rate'',''kpi-mortality-rate''');
  anchor:='  elsif a.source_key ~ ''^reconciliation-[0-9a-f-]{36}$'' then';
  if strpos(definition,anchor)=0 then raise exception 'Warning source boundary changed; review migration.'; end if;
  definition:=replace(definition,anchor,$checker$
  elsif a.source_key ~ '^performance-(production|mortality)-[0-9a-f-]{36}$' then
    v_id:=right(a.source_key,36)::uuid;
    perform 1 from public.flocks where id=v_id and org_id=p_org_id and farm_id=a.farm_id for share;
    if not found then return jsonb_build_object('state','unavailable','reason','SOURCE_NOT_FOUND'); end if;
    select value->>'state' into v_state from jsonb_array_elements(
      public.operational_performance_warnings(p_org_id,v_id,v_today))
      where value->>'kind'=split_part(a.source_key,'-',2);
    return jsonb_build_object('state',coalesce(v_state,'unavailable'),'reason','AUTHORITATIVE_PERFORMANCE');
$checker$||anchor);
  execute definition;
end $$;
