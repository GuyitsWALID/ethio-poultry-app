-- Review candidates, not proof of wrongdoing; historical reason text is retained.
select c.org_id,c.id closure_id,f.flock_code,c.record_date,c.actual_feed_kg,c.override_reason
from public.feed_day_closures c join public.flocks f on f.id=c.flock_id and f.org_id=c.org_id
where c.status='closed' and nullif(btrim(c.override_reason),'') is not null
order by c.org_id,c.record_date,c.id;

-- Current deficits stay item/store-specific. No automatic balancing entries.
select s.org_id,s.warehouse_id,s.item_id,i.name,i.unit,
 sum(public.stock_movement_delta(s.transaction_type,s.quantity)) on_hand
from public.stock_ledger s join public.inventory_items i on i.id=s.item_id and i.org_id=s.org_id
where i.category='feed' group by s.org_id,s.warehouse_id,s.item_id,i.name,i.unit
having sum(public.stock_movement_delta(s.transaction_type,s.quantity))<0
order by s.org_id,s.warehouse_id,s.item_id;
