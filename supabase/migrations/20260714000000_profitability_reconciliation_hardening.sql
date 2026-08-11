-- Persist a transparent farm-profit breakdown instead of only a blended cost total.

alter table if exists public.monthly_cost_periods
  add column if not exists total_paid_revenue numeric(14,2) not null default 0,
  add column if not exists total_balance_due numeric(14,2) not null default 0,
  add column if not exists direct_inventory_cost numeric(14,2) not null default 0,
  add column if not exists bird_cogs numeric(14,2) not null default 0,
  add column if not exists overhead_cost numeric(14,2) not null default 0,
  add column if not exists unallocated_cost numeric(14,2) not null default 0,
  add column if not exists excluded_duplicate_cost numeric(14,2) not null default 0,
  add column if not exists operating_profit numeric(14,2) not null default 0,
  add column if not exists cash_operating_surplus numeric(14,2) not null default 0,
  add column if not exists reconciliation_warnings jsonb not null default '[]'::jsonb;

alter table if exists public.monthly_cost_periods
  drop constraint if exists monthly_cost_periods_reconciliation_non_negative;

alter table if exists public.monthly_cost_periods
  add constraint monthly_cost_periods_reconciliation_non_negative check (
    total_paid_revenue >= 0
    and total_balance_due >= 0
    and direct_inventory_cost >= 0
    and bird_cogs >= 0
    and overhead_cost >= 0
    and unallocated_cost >= 0
    and excluded_duplicate_cost >= 0
  );

comment on column public.monthly_cost_periods.unallocated_cost is
  'Shared costs compatible with a selected scope but not explicitly allocated to that scope; excluded from operating profit.';

comment on column public.monthly_cost_periods.excluded_duplicate_cost is
  'Manual inventory-category costs excluded because issued stock already supplied the cost basis for that category.';

-- Bird COGS belongs in total farm cost/profit, but must not inflate the egg
-- break-even price. Only egg-production inventory and overhead form that basis.
create or replace function public.apply_monthly_cost_period_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.total_normal_eggs > 0 then
    new.base_cost_per_egg = round(
      (coalesce(new.direct_inventory_cost, 0) + coalesce(new.overhead_cost, 0)) / new.total_normal_eggs,
      4
    );
  else
    new.base_cost_per_egg = null;
  end if;

  if new.status = 'locked' and new.locked_at is null then
    new.locked_at = now();
  elsif new.status = 'draft' then
    new.locked_at = null;
    new.locked_by = null;
  end if;

  new.updated_at = now();
  return new;
end;
$$;
