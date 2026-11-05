-- Operator-only read-only preflight. Review every returned row. Never choose
-- shared membership, invent completion dates or reset counts automatically.
begin transaction read only;

select 'overlapping_house_occupancy' as issue, f.org_id, h.name as house,
  array_agg(f.flock_code order by f.flock_code) as flocks
from public.flocks f join public.houses h on h.id=f.house_id
where f.status::text in ('active','quarantined')
group by f.org_id, f.house_id, h.name having count(*)>1;

select 'ambiguous_batch_membership' as issue, b.org_id, b.batch_code,
  array_agg(distinct f.farm_id) as farms, array_agg(distinct f.house_id) as houses,
  array_agg(f.flock_code order by f.flock_code) as flocks
from public.batches b join public.flocks f on f.batch_id=b.id
group by b.org_id,b.id,b.batch_code
having count(distinct f.farm_id)>1 or count(distinct f.house_id)>1;

select 'broken_placement_lineage' as issue, f.org_id, f.flock_code,
  b.batch_code, h.name as current_house
from public.flocks f left join public.houses h on h.id=f.house_id
left join public.batches b on b.id=f.batch_id
where f.status::text in ('active','quarantined') and
  (h.id is null or h.org_id<>f.org_id or h.farm_id<>f.farm_id
   or b.id is null or b.org_id<>f.org_id or b.farm_id<>f.farm_id or b.house_id<>f.house_id);
-- A supported approved transfer may explain location difference. Review its
-- movement chain; do not rewrite original placement from this report alone.

select 'placement_population_mismatch' as issue, b.org_id,b.batch_code,
  b.total_count as batch_starting_birds, sum(f.initial_count) as flock_starting_birds
from public.batches b left join public.flocks f on f.batch_id=b.id
group by b.org_id,b.id,b.batch_code,b.total_count
having sum(f.initial_count) is distinct from b.total_count;

select 'lifecycle_status_mismatch' as issue, b.org_id,b.batch_code,b.status as batch_status,f.flock_code,f.status as flock_status
from public.batches b join public.flocks f on f.batch_id=b.id
where (b.status='active') is distinct from (f.status::text in ('active','quarantined'));

select 'current_population_mismatch' as issue, f.org_id,f.flock_code,
  f.current_count, d.record_date,d.closing_birds
from public.flocks f join lateral (
  select r.record_date,r.closing_birds from public.daily_farm_records r
  where r.org_id=f.org_id and r.flock_id=f.id and r.voided_at is null
  order by r.record_date desc limit 1
) d on true
where f.status::text in ('active','quarantined') and d.closing_birds is not null
  and d.closing_birds<>f.current_count;

select 'future_active_placement' as issue, f.org_id,f.flock_code,f.placement_date
from public.flocks f where f.status::text in ('active','quarantined')
and f.placement_date>(now() at time zone 'Africa/Addis_Ababa')::date;

select 'legacy_completion_attestation_required' as issue, f.org_id,f.flock_code,
  f.status,f.current_count as historical_recorded_population,h.name as house
from public.flocks f join public.houses h on h.id=f.house_id
where f.status::text in ('archived','sold','culled','transferred');
-- This baseline has no verified shared-cycle completion fields. These rows
-- must be reviewed before house reuse, not interpreted as currently live birds.

select 'lifecycle_approval_requires_review' as issue,r.org_id,r.id as request_id,
  r.request_type,r.status,r.source_table,r.source_id,r.source_version,
  r.approval_expires_at,r.context_snapshot->>'sourceLabel' as source_label
from public.governance_requests r
where r.status in ('pending','returned','approved')
and r.request_type in ('batch_create','batch_archive','flock_place','flock_transfer','flock_close','flock_archive')
order by r.org_id,r.requested_at;

rollback;
