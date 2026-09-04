-- Priority 9: branded, reproducible, scheduled management reports.

create table if not exists public.management_report_schedules(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check(char_length(trim(name)) between 3 and 100),
  cadence text not null check(cadence in ('weekly','monthly')),
  run_day smallint not null check(run_day between 1 and 28),
  run_hour smallint not null default 7 check(run_hour between 0 and 23),
  lookback_days smallint not null default 30 check(lookback_days between 1 and 366),
  scope jsonb not null default '{}'::jsonb,
  recipient_ids uuid[] not null default '{}'::uuid[],
  is_active boolean not null default true,
  next_run_at timestamptz not null,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists management_report_schedules_due on public.management_report_schedules(next_run_at) where is_active;
create index if not exists management_report_schedules_org on public.management_report_schedules(org_id,created_at desc);

create table if not exists public.management_report_runs(
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid references public.management_report_schedules(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_role text not null,
  report_name text not null,
  period_from date not null,
  period_to date not null check(period_to >= period_from),
  scope jsonb not null default '{}'::jsonb,
  recipient_ids uuid[] not null default '{}'::uuid[],
  organization_name text not null,
  report_snapshot jsonb,
  snapshot_sha256 text,
  report_version text not null default 'management-report-v1',
  status text not null check(status in ('generating','completed','failed')),
  failure_message text,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists management_report_runs_org on public.management_report_runs(org_id,created_at desc);
create index if not exists management_report_runs_recipients on public.management_report_runs using gin(recipient_ids);
create unique index if not exists management_report_runs_completed_period on public.management_report_runs(schedule_id,period_from,period_to) where schedule_id is not null and status='completed';

create or replace function public.prevent_management_report_run_change() returns trigger
language plpgsql as $$ begin raise exception 'Management report history is append-only.' using errcode='42501'; end $$;

drop trigger if exists management_report_runs_append_only on public.management_report_runs;
create trigger management_report_runs_append_only before update or delete on public.management_report_runs
for each row execute function public.prevent_management_report_run_change();

alter table public.management_report_schedules enable row level security;
alter table public.management_report_runs enable row level security;

drop policy if exists management_report_schedules_read on public.management_report_schedules;
create policy management_report_schedules_read on public.management_report_schedules for select using(
  org_id=public.current_org_id() and (
    public.current_active_role()='ceo' or (
      public.current_active_role()='farm_manager' and auth.uid()=any(recipient_ids) and scope ? 'farmId' and exists(
        select 1 from public.user_farm_access a where a.org_id=management_report_schedules.org_id and a.profile_id=auth.uid()
        and a.farm_id=(scope->>'farmId')::uuid and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())
      )
    )
  )
);

drop policy if exists management_report_runs_read on public.management_report_runs;
create policy management_report_runs_read on public.management_report_runs for select using(
  org_id=public.current_org_id() and (
    public.current_active_role()='ceo' or (
      public.current_active_role()='farm_manager' and (requested_by=auth.uid() or auth.uid()=any(recipient_ids)) and scope ? 'farmId' and exists(
        select 1 from public.user_farm_access a where a.org_id=management_report_runs.org_id and a.profile_id=auth.uid()
        and a.farm_id=(scope->>'farmId')::uuid and a.revoked_at is null and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())
      )
    )
  )
);

grant select on public.management_report_schedules,public.management_report_runs to authenticated;
revoke insert,update,delete on public.management_report_schedules,public.management_report_runs from anon,authenticated;

comment on table public.management_report_schedules is 'CEO-governed schedule definitions for reproducible management reports in Africa/Addis_Ababa time.';
comment on table public.management_report_runs is 'Append-only branded management report snapshots generated from authoritative operational analytics.';
