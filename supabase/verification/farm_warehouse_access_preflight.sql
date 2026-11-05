-- Read-only. No manager, ownership or shared-store permission is inferred.
select 'overlapping_farm_managers' as issue, a.farm_id::text as scope,
  a.id::text as record, b.id::text as conflicting_record
from public.user_farm_access a join public.user_farm_access b on a.farm_id=b.farm_id and a.id<b.id
where a.revoked_at is null and b.revoked_at is null
  and tstzrange(a.starts_at,a.expires_at,'[)') && tstzrange(b.starts_at,b.expires_at,'[)');
select 'ownership_review' as issue, w.id, w.name, w.farm_id, w.type
from public.warehouses w left join public.farms f on f.id=w.farm_id
where (w.farm_id is not null and (f.id is null or f.org_id<>w.org_id or f.branch_id<>w.branch_id))
  or (w.farm_id is null and w.type::text='farm_store');
select 'farm_store_grant_to_supersede' as issue, a.id, w.name, p.full_name
from public.user_warehouse_access a join public.warehouses w on w.id=a.warehouse_id
join public.profiles p on p.id=a.profile_id where w.farm_id is not null and a.revoked_at is null;
select 'scheduled_replacement' as issue, a.id, a.farm_id, a.starts_at
from public.user_farm_access a where a.revoked_at is null and a.starts_at>now()
and exists(select 1 from public.user_farm_access b where b.farm_id=a.farm_id
  and b.profile_id<>a.profile_id and b.revoked_at is null and b.starts_at<a.starts_at);
select distinct 'shared_feeding_permission_review' as issue, w.id, w.name, p.id as manager_id, p.full_name
from public.feeding_session_records s join public.warehouses w on w.id=s.warehouse_id
join public.profiles p on p.id=s.recorded_by
where w.farm_id is null and w.status='active' and p.is_active and p.role::text='farm_manager'
  and s.record_date >= (now() at time zone 'Africa/Addis_Ababa')::date-30
  and not exists(select 1 from public.user_warehouse_access a where a.profile_id=p.id and a.warehouse_id=w.id
    and a.org_id=w.org_id and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()));
select 'unfinished_assignment_work' as issue, a.id, a.title, a.status, a.owner_id, a.farm_id, a.warehouse_id, a.due_at
from public.operational_actions a where a.owner_id is not null and a.status in ('open','assigned','acknowledged','in_progress','escalated')
order by a.due_at;
