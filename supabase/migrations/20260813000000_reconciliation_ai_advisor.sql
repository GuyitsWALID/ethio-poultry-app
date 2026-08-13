-- Read-only AI advice for deterministic reconciliation findings.
-- The source finding remains authoritative; these snapshots are append-only evidence.

create table if not exists public.reconciliation_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete restrict,
  finding_id uuid not null references public.reconciliation_findings(id) on delete restrict,
  finding_fingerprint text not null,
  evidence_hash text not null check (evidence_hash ~ '^[a-f0-9]{64}$'),
  provider text not null default 'groq' check (provider = 'groq'),
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  status text not null check (status in ('completed','failed')),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  analysis_output jsonb,
  error_code text,
  requested_by uuid references public.profiles(id) on delete set null,
  requester_role text not null,
  support_session_id uuid references public.break_glass_sessions(id) on delete set null,
  request_key text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  latency_ms integer not null check (latency_ms >= 0),
  created_at timestamptz not null default now(),
  constraint reconciliation_ai_completed_output check (
    (status = 'completed' and analysis_output is not null and error_code is null)
    or (status = 'failed' and analysis_output is null and error_code is not null)
  ),
  unique(org_id, requested_by, request_key)
);

create index if not exists idx_reconciliation_ai_finding_history
  on public.reconciliation_ai_analyses(finding_id, created_at desc);
create index if not exists idx_reconciliation_ai_user_rate
  on public.reconciliation_ai_analyses(org_id, requested_by, created_at desc);
create index if not exists idx_reconciliation_ai_evidence_cache
  on public.reconciliation_ai_analyses(finding_id, evidence_hash, prompt_version, schema_version, model, created_at desc)
  where status = 'completed';

alter table public.reconciliation_ai_analyses enable row level security;

drop policy if exists reconciliation_ai_analyses_read on public.reconciliation_ai_analyses;
create policy reconciliation_ai_analyses_read on public.reconciliation_ai_analyses
for select to authenticated using (
  exists (
    select 1
    from public.reconciliation_findings f
    where f.id = finding_id
      and f.org_id = reconciliation_ai_analyses.org_id
      and (
        public.reconciliation_farm_scope_allowed(f.org_id, f.farm_id)
        or public.reconciliation_warehouse_scope_allowed(f.org_id, f.warehouse_id)
        or (
          f.farm_id is null and f.warehouse_id is null
          and f.org_id = public.current_org_id()
          and public.current_active_role() = 'ceo'
        )
        or public.has_active_break_glass(f.org_id)
      )
  )
);

create or replace function public.prevent_reconciliation_ai_analysis_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'AI analysis snapshots are append-only.' using errcode = '42501';
end
$$;

drop trigger if exists reconciliation_ai_analyses_immutable on public.reconciliation_ai_analyses;
create trigger reconciliation_ai_analyses_immutable
before update or delete on public.reconciliation_ai_analyses
for each row execute function public.prevent_reconciliation_ai_analysis_change();

revoke insert, update, delete on public.reconciliation_ai_analyses from anon, authenticated;

comment on table public.reconciliation_ai_analyses is
  'Append-only, sanitized AI guidance for deterministic reconciliation findings. AI output never changes source records or finding status.';
comment on column public.reconciliation_ai_analyses.evidence_snapshot is
  'Minimum human-readable evidence sent to the provider; credentials, contacts, UUIDs, and unrelated tenant data are excluded.';
comment on column public.reconciliation_ai_analyses.analysis_output is
  'Schema-validated advisory output. This is not an official finding, decision, or allegation of intent.';
