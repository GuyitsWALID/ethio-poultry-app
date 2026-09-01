-- Priority 7: accountable ownership and evidence for operational alerts.

create table if not exists public.operational_actions(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_key text not null,
  source_name text not null,
  source_route text not null,
  title text not null,
  context text not null,
  severity text not null check(severity in ('high','medium','low')),
  farm_id uuid references public.farms(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  status text not null default 'open' check(status in ('open','assigned','acknowledged','in_progress','awaiting_verification','escalated','resolved')),
  owner_id uuid references public.profiles(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete restrict,
  assigned_at timestamptz,
  due_at timestamptz not null,
  acknowledged_by uuid references public.profiles(id) on delete restrict,
  acknowledged_at timestamptz,
  escalated_at timestamptz,
  escalation_reason text,
  resolution_summary text,
  resolution_evidence text,
  resolution_submitted_by uuid references public.profiles(id) on delete restrict,
  resolution_submitted_at timestamptz,
  source_first_seen_at timestamptz not null,
  source_last_seen_at timestamptz not null,
  source_resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id,source_key)
);

create index if not exists operational_actions_org_status_due on public.operational_actions(org_id,status,due_at);
create index if not exists operational_actions_owner_status on public.operational_actions(owner_id,status);
create index if not exists operational_actions_farm on public.operational_actions(farm_id) where farm_id is not null;
create index if not exists operational_actions_warehouse on public.operational_actions(warehouse_id) where warehouse_id is not null;

create table if not exists public.operational_action_events(
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  action_id uuid not null references public.operational_actions(id) on delete cascade,
  event_type text not null check(event_type in ('discovered','assigned','claimed','acknowledged','work_started','resolution_submitted','verification_failed','system_verified','escalated','reopened','due_date_changed')),
  actor_id uuid references public.profiles(id) on delete restrict,
  actor_name_snapshot text not null,
  actor_role_snapshot text not null,
  note text,
  evidence text,
  before_status text,
  after_status text,
  support_session_id uuid references public.break_glass_sessions(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists operational_action_events_action_time on public.operational_action_events(action_id,created_at desc);

create or replace function public.prevent_operational_action_event_change() returns trigger
language plpgsql as $$ begin raise exception 'Operational action history is append-only.' using errcode='42501'; end $$;
drop trigger if exists operational_action_events_append_only on public.operational_action_events;
create trigger operational_action_events_append_only before update or delete on public.operational_action_events
for each row execute function public.prevent_operational_action_event_change();

alter table public.operational_actions enable row level security;
alter table public.operational_action_events enable row level security;

drop policy if exists operational_actions_read_scope on public.operational_actions;
create policy operational_actions_read_scope on public.operational_actions for select using(
  org_id=public.current_org_id() and (
    public.current_active_role()='ceo'
    or public.has_active_break_glass(org_id)
    or owner_id=auth.uid()
    or (farm_id is not null and public.has_active_farm_access(farm_id))
    or (warehouse_id is not null and public.has_active_warehouse_access(warehouse_id))
  )
);

drop policy if exists operational_action_events_read_scope on public.operational_action_events;
create policy operational_action_events_read_scope on public.operational_action_events for select using(
  exists(select 1 from public.operational_actions a where a.id=action_id and a.org_id=public.current_org_id() and (
    public.current_active_role()='ceo'
    or public.has_active_break_glass(a.org_id)
    or a.owner_id=auth.uid()
    or (a.farm_id is not null and public.has_active_farm_access(a.farm_id))
    or (a.warehouse_id is not null and public.has_active_warehouse_access(a.warehouse_id))
  ))
);

grant select on public.operational_actions,public.operational_action_events to authenticated;
revoke insert,update,delete on public.operational_actions,public.operational_action_events from anon,authenticated;
revoke all on sequence public.operational_action_events_id_seq from anon,authenticated;

comment on table public.operational_actions is 'Role-scoped responsibility state for deterministic operational alerts; source systems remain authoritative for closure.';
comment on table public.operational_action_events is 'Permanent append-only ownership, acknowledgement, escalation, and resolution evidence history.';
