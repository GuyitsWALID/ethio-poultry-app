-- First canonical post-baseline migration.
-- Restore system-owned reference rows and extension-owned scheduler state that a
-- schema-only pg_dump intentionally excludes.

insert into public.roles(code,display_name,default_route)
values
  ('ceo','CEO / Manager','/app/admin'),
  ('farm_manager','Farm Manager','/app/farms'),
  ('system_admin','System Administrator','/app/admin')
on conflict(code) do update
set display_name=excluded.display_name,
    default_route=excluded.default_route,
    updated_at=now();

insert into public.role_aliases(alias,role_code)
values
  ('manager','ceo'),
  ('ceo','ceo'),
  ('farm_manager','farm_manager'),
  ('system_admin','system_admin')
on conflict(alias) do update set role_code=excluded.role_code;

create or replace function public.seed_sales_unit_conversions_for_org()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.sales_unit_conversions(org_id,product_category,unit,base_unit,multiplier,source)
  select new.id,'egg',v.unit,'egg',v.multiplier,'system_default'
  from (values
    ('egg',1::numeric),('eggs',1),('piece',1),('pieces',1),('dozen',12),('tray',30)
  ) v(unit,multiplier)
  on conflict(org_id,product_category,unit) do nothing;
  return new;
end
$$;

drop trigger if exists trg_organizations_seed_sales_unit_conversions on public.organizations;
create trigger trg_organizations_seed_sales_unit_conversions
after insert on public.organizations
for each row execute function public.seed_sales_unit_conversions_for_org();

insert into public.sales_unit_conversions(org_id,product_category,unit,base_unit,multiplier,source)
select o.id,'egg',v.unit,'egg',v.multiplier,'system_default'
from public.organizations o
cross join (values
  ('egg',1::numeric),('eggs',1),('piece',1),('pieces',1),('dozen',12),('tray',30)
) v(unit,multiplier)
on conflict(org_id,product_category,unit) do nothing;

insert into public.governance_scheduler_health(scheduler_key,updated_at)
values('operating_day_lock',now())
on conflict(scheduler_key) do update set updated_at=excluded.updated_at;

create extension if not exists pg_cron;
do $$
declare v_job record;
begin
  for v_job in select jobid from cron.job where jobname='lock-overdue-farm-operating-days' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  perform cron.schedule(
    'lock-overdue-farm-operating-days',
    '*/15 * * * *',
    'select public.lock_overdue_operating_days()'
  );
end
$$;

revoke all on function public.seed_sales_unit_conversions_for_org() from public,anon,authenticated;
