-- Read-only review list. Do not rebalance or reopen historical days automatically.
with live as (
 select org_id,flock_id,record_date,count(*) sessions,
   coalesce(sum(actual_feed_kg),0) actual_kg,coalesce(sum(planned_feed_kg),0) planned_kg
 from public.feeding_session_records where voided_at is null group by org_id,flock_id,record_date
), posted as (
 select org_id,source_key,sum(quantity) issued_kg from public.stock_ledger
 where source_kind='feed_day_close' and transaction_type='issue' group by org_id,source_key
)
select c.org_id,c.id closure_id,f.flock_code,c.record_date,
 c.actual_feed_kg closed_actual_kg,c.planned_feed_kg closed_planned_kg,
 coalesce(l.sessions,0) active_sessions,coalesce(l.actual_kg,0) active_actual_kg,
 coalesce(l.planned_kg,0) active_planned_kg,coalesce(p.issued_kg,0) posted_issue_kg,
 d.feed_type recorded_feed_type,t.feed_type active_feed_type
from public.feed_day_closures c join public.flocks f on f.id=c.flock_id and f.org_id=c.org_id
left join live l on l.org_id=c.org_id and l.flock_id=c.flock_id and l.record_date=c.record_date
left join posted p on p.org_id=c.org_id and p.source_key=c.flock_id::text||':'||c.record_date::text
left join public.daily_farm_records d on d.org_id=c.org_id and d.flock_id=c.flock_id and d.record_date=c.record_date and d.voided_at is null
left join lateral(select s.feed_type from public.feeding_session_records s
 where s.org_id=c.org_id and s.flock_id=c.flock_id and s.record_date=c.record_date
 and s.voided_at is null and s.feed_type is not null order by s.session_time desc nulls last limit 1) t on true
where c.status='closed' and exists(select 1 from public.feeding_session_records s
 where s.org_id=c.org_id and s.flock_id=c.flock_id and s.record_date=c.record_date and s.voided_at is not null)
and (coalesce(l.sessions,0)=0 or c.actual_feed_kg is distinct from coalesce(l.actual_kg,0)
 or c.planned_feed_kg is distinct from coalesce(l.planned_kg,0)
 or coalesce(p.issued_kg,0) is distinct from coalesce(l.actual_kg,0)
 or (t.feed_type is not null and d.feed_type is distinct from t.feed_type))
order by c.org_id,c.record_date,c.id;
