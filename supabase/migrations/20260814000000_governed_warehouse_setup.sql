-- Governed warehouse setup and assignment-scoped inventory locations.

alter table public.warehouses
  add column if not exists farm_id uuid references public.farms(id) on delete restrict,
  add column if not exists status text not null default 'active';

alter table public.warehouses
  drop constraint if exists warehouses_status_valid;

alter table public.warehouses
  add constraint warehouses_status_valid check (status in ('active', 'inactive'));

create index if not exists warehouses_org_status_idx
  on public.warehouses(org_id, status, name);

create index if not exists warehouses_farm_id_idx
  on public.warehouses(farm_id)
  where farm_id is not null;

create or replace function public.validate_warehouse_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_branch_org uuid;
  v_farm_org uuid;
  v_farm_branch uuid;
begin
  new.name := trim(new.name);
  if length(new.name) < 2 then
    raise exception 'Warehouse name must contain at least two characters.' using errcode = '22023';
  end if;

  select org_id into v_branch_org from public.branches where id = new.branch_id;
  if v_branch_org is null or v_branch_org <> new.org_id then
    raise exception 'Warehouse branch must belong to the same organization.' using errcode = '23514';
  end if;

  if new.farm_id is not null then
    select org_id, branch_id into v_farm_org, v_farm_branch
    from public.farms where id = new.farm_id;
    if v_farm_org is null or v_farm_org <> new.org_id or v_farm_branch <> new.branch_id then
      raise exception 'Warehouse farm must belong to the selected organization and branch.' using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists warehouses_validate_scope on public.warehouses;
create trigger warehouses_validate_scope
before insert or update of org_id, branch_id, farm_id, name, status
on public.warehouses
for each row execute function public.validate_warehouse_scope();

create or replace function public.require_active_ledger_warehouse()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.warehouses w
    where w.id = new.warehouse_id and w.org_id = new.org_id and w.status = 'active'
  ) then
    raise exception 'Inventory movements require an active warehouse in the same organization.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists stock_ledger_active_warehouse on public.stock_ledger;
create trigger stock_ledger_active_warehouse
before insert or update of org_id, warehouse_id
on public.stock_ledger
for each row execute function public.require_active_ledger_warehouse();

drop policy if exists warehouses_org_access on public.warehouses;
drop policy if exists warehouses_scoped_read on public.warehouses;
create policy warehouses_scoped_read
on public.warehouses
for select
using (
  (public.current_active_role() = 'ceo' and org_id = public.current_org_id())
  or (public.current_active_role() = 'farm_manager' and public.has_active_warehouse_access(id))
  or public.has_active_break_glass(org_id)
);

revoke all on table public.warehouses from anon;
revoke insert, update, delete, truncate, references, trigger on table public.warehouses from authenticated;
grant select on table public.warehouses to authenticated;
grant all on table public.warehouses to service_role;

drop policy if exists stock_ledger_org_access on public.stock_ledger;
drop policy if exists stock_ledger_scoped_read on public.stock_ledger;
create policy stock_ledger_scoped_read
on public.stock_ledger
for select
using (
  (public.current_active_role() = 'ceo' and org_id = public.current_org_id())
  or (public.current_active_role() = 'farm_manager' and public.has_active_warehouse_access(warehouse_id))
  or public.has_active_break_glass(org_id)
);

revoke all on table public.stock_ledger from anon;
revoke insert, update, delete, truncate, references, trigger on table public.stock_ledger from authenticated;
grant select on table public.stock_ledger to authenticated;
grant all on table public.stock_ledger to service_role;

comment on column public.warehouses.farm_id is
  'Optional farm association. Central warehouses may remain branch-level.';
comment on column public.warehouses.status is
  'Inactive warehouses remain auditable but cannot receive new operational postings.';
