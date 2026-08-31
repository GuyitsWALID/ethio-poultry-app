-- Priority 6: append-only platform monitoring and recovery evidence.
-- Tenant business roles cannot write or read this platform-level control data.

create table if not exists public.platform_operational_evidence (
  id bigint generated always as identity primary key,
  evidence_kind text not null check (evidence_kind in ('application_probe', 'backup_status', 'restore_drill')),
  environment text not null check (environment in ('staging', 'production')),
  status text not null check (status in ('healthy', 'degraded', 'failed')),
  provider text not null check (char_length(provider) between 2 and 80),
  checked_at timestamptz not null,
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 3600000),
  release text check (release is null or char_length(release) between 7 and 128),
  summary text not null check (char_length(summary) between 3 and 500),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  idempotency_key text not null unique check (char_length(idempotency_key) between 12 and 180),
  inserted_at timestamptz not null default now()
);

create index if not exists platform_operational_evidence_latest_idx
  on public.platform_operational_evidence(environment, evidence_kind, checked_at desc);

create or replace function public.prevent_platform_operational_evidence_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Platform operational evidence is append-only.' using errcode = '42501';
end;
$$;

drop trigger if exists platform_operational_evidence_immutable on public.platform_operational_evidence;
create trigger platform_operational_evidence_immutable
before update or delete on public.platform_operational_evidence
for each row execute function public.prevent_platform_operational_evidence_change();

alter table public.platform_operational_evidence enable row level security;

drop policy if exists platform_operational_evidence_system_admin_read on public.platform_operational_evidence;
create policy platform_operational_evidence_system_admin_read
on public.platform_operational_evidence
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active
      and p.role::text in ('system_admin', 'super_admin')
  )
);

revoke all on table public.platform_operational_evidence from anon, authenticated;
grant select on table public.platform_operational_evidence to authenticated;

comment on table public.platform_operational_evidence is
  'Immutable evidence from external application probes, provider backup checks, and isolated restore drills.';
