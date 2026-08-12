-- Item 3: evidence-backed operational reconciliation and exception custody.
-- Evaluation is performed by the application reconciliation module; PostgreSQL
-- owns durable findings, assignment-scoped visibility, and append-only responses.

create table if not exists public.reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  status text not null default 'running' check (status in ('running','completed','failed')),
  triggered_by uuid references public.profiles(id) on delete set null,
  trigger_source text not null default 'application' check (trigger_source in ('application','manual','scheduler')),
  finding_count integer not null default 0,
  critical_count integer not null default 0,
  high_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reconciliation_run_range check (date_to >= date_from)
);

create table if not exists public.reconciliation_findings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  run_id uuid references public.reconciliation_runs(id) on delete set null,
  fingerprint text not null,
  rule_code text not null,
  domain text not null check (domain in ('birds','feed','mortality','eggs_sales','inventory','financial','lineage','governance')),
  severity text not null check (severity in ('critical','high','medium','low')),
  status text not null default 'open' check (status in ('open','acknowledged','investigating','resolved','accepted_exception','cleared')),
  title text not null,
  explanation text not null,
  recommended_action text not null,
  branch_id uuid references public.branches(id) on delete set null,
  farm_id uuid references public.farms(id) on delete set null,
  house_id uuid references public.houses(id) on delete set null,
  flock_id uuid references public.flocks(id) on delete set null,
  batch_id uuid references public.batches(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  record_date date,
  expected_value numeric,
  recorded_value numeric,
  variance numeric,
  unit text,
  estimated_impact_etb numeric,
  evidence jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  reopened_count integer not null default 0 check (reopened_count >= 0),
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  resolution_evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,fingerprint)
);

create table if not exists public.reconciliation_finding_responses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  finding_id uuid not null references public.reconciliation_findings(id) on delete cascade,
  action text not null check (action in ('acknowledge','investigate','explain','resolve','accept_exception','reopen','system_clear','system_reopen')),
  note text not null,
  evidence jsonb not null default '[]'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  support_session_id uuid references public.break_glass_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_physical_counts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  count_date date not null,
  ledger_quantity numeric(14,3) not null,
  counted_quantity numeric(14,3) not null check (counted_quantity >= 0),
  variance numeric(14,3) generated always as (counted_quantity-ledger_quantity) stored,
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  counted_by uuid not null references public.profiles(id) on delete restrict,
  notes text,
  evidence jsonb not null default '[]'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,warehouse_id,item_id,count_date)
);

create table if not exists public.sales_unit_conversions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_category text not null,
  unit text not null,
  base_unit text not null,
  multiplier numeric(12,4) not null check (multiplier > 0),
  source text not null default 'organization' check (source in ('system_default','organization')),
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,product_category,unit)
);

create index if not exists idx_reconciliation_runs_org_completed on public.reconciliation_runs(org_id,completed_at desc);
create index if not exists idx_reconciliation_findings_queue on public.reconciliation_findings(org_id,status,severity,last_seen_at desc);
create index if not exists idx_reconciliation_findings_farm on public.reconciliation_findings(org_id,farm_id,status);
create index if not exists idx_reconciliation_findings_warehouse on public.reconciliation_findings(org_id,warehouse_id,status);
create index if not exists idx_reconciliation_responses_finding on public.reconciliation_finding_responses(finding_id,created_at);
create index if not exists idx_inventory_physical_counts_scope on public.inventory_physical_counts(org_id,warehouse_id,count_date desc);

insert into public.sales_unit_conversions(org_id,product_category,unit,base_unit,multiplier,source)
select o.id,'egg',v.unit,'egg',v.multiplier,'system_default'
from public.organizations o
cross join (values ('egg',1::numeric),('eggs',1),('piece',1),('pieces',1),('dozen',12),('tray',30)) v(unit,multiplier)
on conflict(org_id,product_category,unit) do nothing;

alter table public.reconciliation_runs enable row level security;
alter table public.reconciliation_findings enable row level security;
alter table public.reconciliation_finding_responses enable row level security;
alter table public.inventory_physical_counts enable row level security;
alter table public.sales_unit_conversions enable row level security;

create or replace function public.reconciliation_farm_scope_allowed(p_org_id uuid,p_farm_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.org_id=p_org_id and p.is_active
      and (p.role='ceo' or (p.role='farm_manager' and p_farm_id is not null and exists(
        select 1 from public.user_farm_access a where a.org_id=p_org_id and a.profile_id=p.id and a.farm_id=p_farm_id
          and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())
      )))
  )
$$;

create or replace function public.reconciliation_warehouse_scope_allowed(p_org_id uuid,p_warehouse_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.org_id=p_org_id and p.is_active
      and (p.role='ceo' or (p.role='farm_manager' and p_warehouse_id is not null and exists(
        select 1 from public.user_warehouse_access a where a.org_id=p_org_id and a.profile_id=p.id and a.warehouse_id=p_warehouse_id
          and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())
      )))
  )
$$;

drop policy if exists reconciliation_runs_read on public.reconciliation_runs;
create policy reconciliation_runs_read on public.reconciliation_runs for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.org_id=reconciliation_runs.org_id and p.is_active and p.role='ceo')
);

drop policy if exists reconciliation_findings_read on public.reconciliation_findings;
create policy reconciliation_findings_read on public.reconciliation_findings for select to authenticated using (
  public.reconciliation_farm_scope_allowed(org_id,farm_id)
  or public.reconciliation_warehouse_scope_allowed(org_id,warehouse_id)
  or (farm_id is null and warehouse_id is null and exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.org_id=reconciliation_findings.org_id and p.is_active and p.role='ceo'
  ))
);

drop policy if exists reconciliation_responses_read on public.reconciliation_finding_responses;
create policy reconciliation_responses_read on public.reconciliation_finding_responses for select to authenticated using (
  exists(select 1 from public.reconciliation_findings f where f.id=finding_id)
);

drop policy if exists physical_counts_read on public.inventory_physical_counts;
create policy physical_counts_read on public.inventory_physical_counts for select to authenticated using (
  public.reconciliation_warehouse_scope_allowed(org_id,warehouse_id)
);

drop policy if exists sales_unit_conversions_read on public.sales_unit_conversions;
create policy sales_unit_conversions_read on public.sales_unit_conversions for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.org_id=sales_unit_conversions.org_id and p.is_active and p.role in ('ceo','farm_manager'))
);

revoke insert,update,delete on public.reconciliation_runs from anon,authenticated;
revoke insert,update,delete on public.reconciliation_findings from anon,authenticated;
revoke insert,update,delete on public.reconciliation_finding_responses from anon,authenticated;
revoke insert,update,delete on public.inventory_physical_counts from anon,authenticated;
revoke insert,update,delete on public.sales_unit_conversions from anon,authenticated;

comment on table public.reconciliation_findings is 'Durable evidence-backed exceptions. A finding describes a contradiction or missing custody evidence, never an accusation of intent.';
comment on column public.reconciliation_findings.fingerprint is 'Stable rule and source identity used to deduplicate recurring evaluations and reopen unresolved evidence.';
comment on column public.inventory_physical_counts.ledger_quantity is 'Immutable system balance captured at the moment of the physical count.';
