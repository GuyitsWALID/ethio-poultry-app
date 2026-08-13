"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  HelpCircle,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatReconciliationNumber, type EvidenceEntry } from "@/lib/reconciliation-presentation";
import { reconciliationWorkflow, type ReconciliationWorkflow } from "@/lib/reconciliation-workflow";

type Finding = {
  id: string;
  rule_code: string;
  domain: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  title: string;
  explanation: string;
  recommended_action: string;
  finding_date: string | null;
  expected_value: unknown;
  recorded_value: unknown;
  variance_value?: number | null;
  variance_unit?: string | null;
  evidence: unknown;
  evidence_display?: EvidenceEntry[];
  farm_name: string | null;
  house_name: string | null;
  flock_code: string | null;
  warehouse_name: string | null;
  estimated_impact_etb: number | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count?: number;
  responses: Array<{ id: string; action: string; note: string; actor_name: string | null; created_at: string }>;
};

type Dashboard = {
  meta: { role: string; asOfDate: string; refreshedAt: string; canResolve: boolean; canOperate: boolean };
  summary: { active: number; critical: number; high: number; medium: number; low: number; trustScore: number; estimatedImpactEtb: number; byDomain: Record<string, number> };
  findings: Finding[];
  hotspots: Array<{ id: string; label: string; count: number }>;
  options: { warehouses: Array<{ id: string; name: string }>; items: Array<{ id: string; name: string; unit: string }> };
};

type View = "open" | "verified" | "exceptions" | "all";
type FindingAction = "investigate" | "explain" | "accept_exception" | "reopen";
type ActionRequest = { finding: Finding; action: FindingAction };
type Notice = { tone: "success" | "warning"; text: string } | null;

const domains = ["all", "birds", "feed", "mortality", "eggs_sales", "inventory", "financial", "lineage", "governance"];
const activeStatuses = new Set(["open", "acknowledged", "investigating"]);
const closedStatuses = new Set(["resolved", "cleared"]);
const domainLabel = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const showValue = (value: unknown) => value === null || value === undefined ? "Unavailable" : typeof value === "object" ? JSON.stringify(value) : String(value);

export default function ReconciliationPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [domain, setDomain] = useState("all");
  const [view, setView] = useState<View>("open");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [actionRequest, setActionRequest] = useState<ActionRequest | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const closeAction = useCallback(() => setActionRequest(null), []);
  const selected = data && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("finding") ?? "" : "";

  const load = useCallback(async (force = false): Promise<Dashboard | null> => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/reconciliation${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Could not load record checks.");
      setData(body);
      return body as Dashboard;
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not load record checks.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const counts = useMemo(() => ({
    open: data?.findings.filter((item) => activeStatuses.has(item.status)).length ?? 0,
    verified: data?.findings.filter((item) => closedStatuses.has(item.status)).length ?? 0,
    exceptions: data?.findings.filter((item) => item.status === "accepted_exception").length ?? 0,
  }), [data]);

  const findings = useMemo(() => data?.findings.filter((item) => {
    const viewMatch = view === "all"
      || (view === "open" && activeStatuses.has(item.status))
      || (view === "verified" && closedStatuses.has(item.status))
      || (view === "exceptions" && item.status === "accepted_exception");
    const text = `${item.title} ${item.rule_code} ${item.farm_name} ${item.flock_code} ${item.warehouse_name}`.toLowerCase();
    return viewMatch && (domain === "all" || item.domain === domain) && (!query || text.includes(query.toLowerCase()));
  }) ?? [], [data, domain, query, view]);

  useEffect(() => {
    if (selected) document.getElementById(`finding-${selected}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [findings, selected]);

  const act = async (request: ActionRequest, note: string, reference: string) => {
    setBusy(request.finding.id);
    try {
      const evidence = reference.trim() ? [{ type: "supporting_reference", value: reference.trim() }] : [];
      const response = await fetch(`/api/reconciliation/findings/${request.finding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: request.action, note, evidence }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Could not record the review.");
      await load();
      setActionRequest(null);
      setNotice({ tone: "success", text: request.action === "accept_exception" ? "The CEO exception and its reason were recorded." : "The review note was added to this check’s history." });
    } finally {
      setBusy("");
    }
  };

  const verify = async (finding: Finding) => {
    setBusy(finding.id);
    setNotice(null);
    const refreshed = await load(true);
    const updated = refreshed?.findings.find((item) => item.id === finding.id);
    if (updated && closedStatuses.has(updated.status)) {
      setNotice({ tone: "success", text: "Verified: the source records now agree, so the system closed this check automatically." });
    } else {
      setNotice({ tone: "warning", text: "The records still disagree. Review the highlighted source values and correct the original record before checking again." });
    }
    setBusy("");
  };

  if (loading && !data) return <div className="grid min-h-[55vh] place-items-center text-forest-600"><RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true"/><span className="sr-only">Checking operational records</span></div>;
  if (error && !data) return <div className="rounded-2xl border border-ember-300 bg-ember-50 p-6 text-ember-800"><strong>Record checks could not load.</strong><p className="mt-2 text-sm">{error}</p><button onClick={() => void load()} className="mt-4 rounded-xl bg-forest-900 px-4 py-2 text-sm font-semibold text-white">Try again</button></div>;
  if (!data) return null;

  return <main className="space-y-5 pb-12">
    <section className="relative overflow-hidden rounded-[1.75rem] bg-forest-900 px-5 py-7 text-white shadow-sm sm:px-8 sm:py-9">
      <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[38px] border-amber-400/10"/>
      <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-amber-300"><ShieldCheck className="h-4 w-4"/>Automatic record checks</p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">See what does not agree—and exactly where to fix it.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100/80">The system compares bird, feed, egg, sales, stock, and cost records in the background. You correct the original record; the system verifies and closes the check automatically.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs"><span className="block text-sand-200">Checked through</span><strong className="mt-1 block text-sm">{data.meta.asOfDate}</strong></div>
          <button onClick={() => void load(true)} disabled={loading} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-forest-900 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>Check all records again</button>
        </div>
      </div>
    </section>

    {notice ? <div role="status" className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${notice.tone === "success" ? "border-leaf-300 bg-leaf-50 text-forest-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>{notice.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0"/> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/>}<span className="flex-1">{notice.text}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><X className="h-4 w-4"/></button></div> : null}

    <section className="grid overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Needs correction" value={String(counts.open)} note="Open record differences" tone="text-ember-600"/>
      <Metric label="Management attention" value={String(data.summary.critical)} note="Critical controls only" tone="text-amber-700"/>
      <Metric label="Verified automatically" value={String(counts.verified)} note="Source records now agree" tone="text-leaf-700"/>
      <Metric label="Potential exposure" value={formatReconciliationNumber(data.summary.estimatedImpactEtb, "ETB", "0 ETB")} note="Estimate, not confirmed loss" tone="text-forest-900"/>
    </section>

    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">Your review queue</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Work only on records that need attention</h2><p className="mt-1 text-sm text-forest-600">Opening a check does not accuse a person or change any data.</p></div>
        <div className="grid gap-2 sm:grid-cols-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search farm, flock, or issue…" className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm outline-none focus:ring-2 focus:ring-forest-600"/><select value={domain} onChange={(event) => setDomain(event.target.value)} className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm">{domains.map((item) => <option key={item} value={item}>{item === "all" ? "All record types" : domainLabel(item)}</option>)}</select></div>
      </div>
      <div className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-1" aria-label="Record check views">
        <ViewButton active={view === "open"} onClick={() => setView("open")} label="Needs action" count={counts.open}/>
        <ViewButton active={view === "verified"} onClick={() => setView("verified")} label="Verified" count={counts.verified}/>
        <ViewButton active={view === "exceptions"} onClick={() => setView("exceptions")} label="CEO exceptions" count={counts.exceptions}/>
        <ViewButton active={view === "all"} onClick={() => setView("all")} label="Full history" count={data.findings.length}/>
      </div>
    </section>

    <section className="space-y-3" aria-label="Record checks">
      <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">Guided checks</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">{findings.length} {findings.length === 1 ? "item" : "items"} in this view</h2></div><span className="hidden text-xs text-forest-500 sm:block">Correct the source → check again → automatically verified</span></div>
      {findings.length ? findings.map((finding) => <FindingCard key={finding.id} finding={finding} role={data.meta.role} canResolve={data.meta.canResolve} selected={selected === finding.id} busy={busy === finding.id} onVerify={verify} onAction={setActionRequest}/>) : <div className="rounded-2xl border border-leaf-300 bg-leaf-50 p-8 text-center text-forest-800"><CheckCircle2 className="mx-auto h-8 w-8"/><h3 className="mt-3 font-semibold">Nothing needs attention in this view.</h3><p className="mt-1 text-sm">The selected records agree. Physical verification is still required as part of normal farm controls.</p></div>}
    </section>

    {data.meta.canOperate ? <PhysicalCount data={data} onSaved={() => load(true)}/> : null}
    {actionRequest ? <FindingActionModal request={actionRequest} role={data.meta.role} saving={busy === actionRequest.finding.id} onClose={closeAction} onSave={act}/> : null}
  </main>;
}

function FindingCard({ finding, role, canResolve, selected, busy, onVerify, onAction }: { finding: Finding; role: string; canResolve: boolean; selected: boolean; busy: boolean; onVerify: (finding: Finding) => Promise<void>; onAction: (request: ActionRequest) => void }) {
  const workflow = reconciliationWorkflow(finding, role);
  const active = activeStatuses.has(finding.status);
  const context = [finding.farm_name, finding.house_name, finding.flock_code, finding.warehouse_name, finding.finding_date].filter(Boolean).join(" · ") || "Organization-wide check";
  const priorityStyle = workflow.priorityKind === "governance" ? "bg-ember-600 text-white" : workflow.priorityKind === "operational" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-800";
  const stageStyle = workflow.stage === "verified" ? "border-leaf-300 bg-leaf-50 text-leaf-800" : workflow.stage === "exception" ? "border-sky-200 bg-sky-50 text-sky-800" : workflow.stage === "in_review" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-sand-300 bg-white text-forest-700";

  return <article id={`finding-${finding.id}`} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${selected ? "border-amber-500 ring-2 ring-amber-300/40" : "border-sand-200"}`}>
    <div className="grid gap-5 p-5 xl:grid-cols-[1.15fr_.9fr] xl:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${priorityStyle}`}>{workflow.priorityLabel}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${stageStyle}`}>{workflow.stageLabel}</span><span className="text-[10px] font-semibold uppercase tracking-wider text-forest-400">{domainLabel(finding.domain)}</span></div>
        <h3 className="mt-3 text-xl font-semibold text-forest-900">{workflow.plainTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-forest-600">{workflow.plainExplanation}</p>
        <p className="mt-3 text-xs font-semibold text-forest-700">{context}</p>
        <div className="mt-4 rounded-xl border border-sand-200 bg-sand-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">Why this matters</p><p className="mt-1 text-sm leading-6 text-forest-700">{workflow.whyItMatters}</p></div>
      </div>
      <div className="space-y-4">
        <RecordComparison finding={finding}/>
        <WorkflowRail workflow={workflow}/>
        <div className="rounded-xl border border-sand-200 p-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">Who handles this</p><p className="mt-1 text-sm font-semibold text-forest-900">{workflow.owner}</p><p className="mt-1 text-xs leading-5 text-forest-600">{workflow.destination.context}</p></div>
      </div>
    </div>

    <details className="border-t border-sand-200">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-forest-700 hover:bg-sand-50">See likely causes, source values, and review history</summary>
      <div className="grid gap-5 border-t border-sand-100 bg-sand-50/60 p-5 lg:grid-cols-3">
        <div><h4 className="text-xs font-semibold uppercase tracking-wider text-forest-500">Common causes to check</h4><ul className="mt-3 space-y-2 text-sm leading-5 text-forest-700">{workflow.likelyCauses.map((cause) => <li key={cause} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"/>{cause}</li>)}</ul></div>
        <EvidencePanel entries={finding.evidence_display ?? []}/>
        <div><h4 className="text-xs font-semibold uppercase tracking-wider text-forest-500">Review history</h4><p className="mt-1 text-xs leading-5 text-forest-500">Notes are supporting context; they never edit the source record.</p><div className="mt-3 space-y-2">{finding.responses?.length ? finding.responses.map((response) => <div key={response.id} className="rounded-lg border border-sand-200 bg-white p-3 text-xs"><strong>{responseActionLabel(response.action)}</strong> · {response.actor_name ?? "Authorized user"}<p className="mt-1 leading-5 text-forest-600">{response.note}</p></div>) : <p className="rounded-lg border border-sand-200 bg-white p-3 text-xs text-forest-500">No review note has been needed.</p>}</div></div>
      </div>
    </details>

    <div className="flex flex-col gap-3 border-t border-sand-200 bg-white px-5 py-4 lg:flex-row lg:items-center">
      <div className="mr-auto"><p className="text-sm font-semibold text-forest-900">{active ? "Next step" : "Outcome"}</p><p className="mt-0.5 text-xs leading-5 text-forest-600">{active ? workflow.verification : workflow.stageLabel === "Verified automatically" ? "The system confirmed that the underlying records now agree." : "The decision and supporting history remain available for audit."}</p></div>
      <div className="flex flex-wrap gap-2">
        {active ? <>
          <Link href={workflow.destination.href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white hover:bg-forest-800">{workflow.destination.label}<ExternalLink className="h-4 w-4"/></Link>
          <button onClick={() => void onVerify(finding)} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-forest-700 bg-white px-4 text-sm font-semibold text-forest-800 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}/>Check again</button>
          {role === "farm_manager" ? <button onClick={() => onAction({ finding, action: "explain" })} disabled={busy} className="min-h-11 rounded-xl border border-sand-300 px-4 text-sm font-semibold text-forest-700">Explain or request help</button> : <button onClick={() => onAction({ finding, action: "investigate" })} disabled={busy} className="min-h-11 rounded-xl border border-sand-300 px-4 text-sm font-semibold text-forest-700">Record follow-up</button>}
          {canResolve ? <button onClick={() => onAction({ finding, action: "accept_exception" })} disabled={busy} className="min-h-11 rounded-xl px-3 text-xs font-semibold text-forest-600 underline underline-offset-4">Approve a valid exception</button> : null}
        </> : canResolve && finding.status === "accepted_exception" ? <button onClick={() => onAction({ finding, action: "reopen" })} disabled={busy} className="min-h-11 rounded-xl border border-sand-300 px-4 text-sm font-semibold text-forest-700">Withdraw exception and review again</button> : null}
      </div>
    </div>
  </article>;
}

function RecordComparison({ finding }: { finding: Finding }) {
  return <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-xl bg-forest-950 p-4 text-center text-white"><Proof label="Should be" value={showValue(finding.expected_value)}/><ArrowRight className="h-4 w-4 text-sand-400"/><Proof label="System found" value={showValue(finding.recorded_value)}/><ArrowRight className="h-4 w-4 text-sand-400"/><Proof label="Difference" value={formatReconciliationNumber(finding.variance_value, finding.variance_unit ?? "")}/></div>;
}

function WorkflowRail({ workflow }: { workflow: ReconciliationWorkflow }) {
  const steps = [
    { label: "Difference found", done: true },
    { label: "Source corrected", done: workflow.stage === "verified" },
    { label: workflow.stage === "exception" ? "CEO exception" : "System verified", done: workflow.stage === "verified" || workflow.stage === "exception" },
  ];
  return <div className="rounded-xl border border-sand-200 bg-white p-4"><div className="grid grid-cols-3 gap-2">{steps.map((step, index) => <div key={step.label} className="relative text-center"><span className={`mx-auto grid h-7 w-7 place-items-center rounded-full border text-[10px] font-bold ${step.done ? "border-leaf-500 bg-leaf-500 text-white" : index === 1 && workflow.stage === "in_review" ? "border-amber-500 bg-amber-100 text-amber-900" : "border-sand-300 bg-sand-50 text-forest-400"}`}>{step.done ? "✓" : index + 1}</span><span className="mt-1.5 block text-[10px] font-semibold leading-4 text-forest-600">{step.label}</span></div>)}</div></div>;
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone: string }) {
  return <div className="border-b border-sand-200 p-5 last:border-b-0 sm:border-r xl:border-b-0"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">{label}</p><strong className={`mt-2 block font-display text-2xl ${tone}`}>{value}</strong><p className="mt-1 text-xs text-forest-500">{note}</p></div>;
}

function ViewButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return <button onClick={onClick} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${active ? "border-forest-900 bg-forest-900 text-white" : "border-sand-300 bg-white text-forest-700 hover:bg-sand-50"}`}>{label}<span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-white/15" : "bg-sand-100"}`}>{count}</span></button>;
}

function Proof({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><span className="block text-[9px] font-semibold uppercase tracking-wider text-sand-300">{label}</span><strong className="mt-1 block break-words text-xs text-white">{value}</strong></div>;
}

function EvidencePanel({ entries }: { entries: EvidenceEntry[] }) {
  return <div><h4 className="text-xs font-semibold uppercase tracking-wider text-forest-500">Values used by the check</h4><p className="mt-1 text-xs leading-5 text-forest-500">Related records are shown by their farm name, flock code, document, or operating date—not by database identifiers.</p>{entries.length ? <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{entries.map((entry) => <div key={entry.key} className="rounded-xl border border-sand-200 bg-white p-3"><dt className="text-[9px] font-semibold uppercase tracking-wider text-forest-400">{entry.label}</dt><dd className="mt-1 break-words text-xs font-semibold text-forest-900">{entry.value}</dd></div>)}</dl> : <p className="mt-3 rounded-xl border border-sand-200 bg-white p-3 text-xs leading-5 text-forest-500">No additional source values are needed for this check.</p>}</div>;
}

function responseActionLabel(action: string) {
  return ({ investigate: "Follow-up recorded", explain: "Operational explanation", accept_exception: "CEO exception", reopen: "Review reopened", system_clear: "Verified automatically", resolve: "Closed after review", acknowledge: "Previously acknowledged" } as Record<string, string>)[action] ?? domainLabel(action);
}

const actionCopy: Record<FindingAction, { eyebrow: string; title: string; purpose: string; prompt: string; placeholder: string; submit: string; impact: string; icon: typeof HelpCircle }> = {
  investigate: { eyebrow: "Follow-up instruction", title: "Record what should happen next", purpose: "Use this to leave a clear instruction or review note. The source record stays unchanged and the check remains open.", prompt: "What should be checked or corrected, and who should follow it up?", placeholder: "Example: Farm Manager should assign the July payroll cost to Duo and Uno, then run this check again.", submit: "Save follow-up", impact: "The note becomes part of the control history. The system will close the check only after the records agree.", icon: Clock3 },
  explain: { eyebrow: "Operational context", title: "Explain the issue or request help", purpose: "Use this when you cannot safely correct the record yourself or the CEO needs additional context.", prompt: "What happened, what have you already checked, and what help or approval is needed?", placeholder: "Example: The feed transfer happened after the day was locked. I verified the warehouse issue and need an approved correction.", submit: "Send explanation", impact: "The explanation becomes visible to the CEO. The check stays open until the source records agree or an exception is approved.", icon: HelpCircle },
  accept_exception: { eyebrow: "CEO decision", title: "Approve this as a valid exception", purpose: "Use only when the difference is legitimate and should remain. This is not a shortcut for an uncorrected mistake.", prompt: "Why is the difference valid, who authorized it, and what evidence supports the decision?", placeholder: "Example: This payroll cost is an approved head-office expense and intentionally has no farm allocation. Authority: July board budget.", submit: "Approve exception", impact: "The check closes as a CEO-approved exception while retaining the source difference and your justification.", icon: ShieldCheck },
  reopen: { eyebrow: "Exception withdrawn", title: "Return this item to review", purpose: "Use when new evidence shows that an accepted exception should be corrected or investigated again.", prompt: "What new evidence or change requires another review?", placeholder: "Describe the new information and the correction now required.", submit: "Reopen review", impact: "The check returns to the active queue and all prior history remains available.", icon: RefreshCw },
};

function FindingActionModal({ request, role, saving, onClose, onSave }: { request: ActionRequest; role: string; saving: boolean; onClose: () => void; onSave: (request: ActionRequest, note: string, reference: string) => Promise<void> }) {
  const copy = actionCopy[request.action];
  const workflow = reconciliationWorkflow(request.finding, role);
  const Icon = copy.icon;
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    textareaRef.current?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = prior; window.removeEventListener("keydown", keydown); };
  }, [onClose, saving]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = note.trim();
    if (clean.length < 8) { setError("Add a short but useful explanation of at least 8 characters."); return; }
    setError("");
    try { await onSave(request, clean, reference); } catch (value) { setError(value instanceof Error ? value.message : "The review could not be recorded."); }
  };
  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-forest-950/70 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="finding-action-title" className="my-6 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-sand-200 bg-white shadow-2xl"><header className="relative overflow-hidden border-b border-sand-200 bg-forest-900 px-5 py-5 text-white sm:px-7"><div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border-[22px] border-amber-400/10"/><div className="relative flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[.18em] text-amber-200"><Icon className="h-3.5 w-3.5"/>{copy.eyebrow}</span><h2 id="finding-action-title" className="mt-3 font-display text-2xl font-semibold">{copy.title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-sand-100/80">{copy.purpose}</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close form" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 hover:bg-white/10 disabled:opacity-50"><X className="h-4 w-4"/></button></div></header><form onSubmit={(event) => void submit(event)}><div className="space-y-5 p-5 sm:p-7"><div className="rounded-xl border border-sand-200 bg-sand-50 p-4"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-forest-500">Issue</p><h3 className="mt-1 text-sm font-semibold text-forest-900">{workflow.plainTitle}</h3><p className="mt-1 text-xs leading-5 text-forest-600">{workflow.destination.context}</p></div><label className="block"><span className="text-sm font-semibold text-forest-900">Explanation <span className="text-ember-600">*</span></span><span className="mt-1 block text-xs leading-5 text-forest-600">{copy.prompt}</span><textarea ref={textareaRef} value={note} onChange={(event) => { setNote(event.target.value); if (error) setError(""); }} rows={5} placeholder={copy.placeholder} className="mt-2 w-full resize-y rounded-xl border border-sand-300 px-3 py-3 text-sm leading-6 text-forest-900 outline-none placeholder:text-forest-400 focus:border-forest-700 focus:ring-2 focus:ring-forest-600/20"/><span className={`mt-1 block text-right text-[10px] ${note.trim().length < 8 ? "text-forest-400" : "text-leaf-700"}`}>{note.trim().length} characters · minimum 8</span></label><label className="block"><span className="text-sm font-semibold text-forest-900">Supporting reference <span className="font-normal text-forest-500">(optional)</span></span><span className="mt-1 block text-xs leading-5 text-forest-600">Invoice number, document, photo reference, governance request, or another source someone can verify.</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Example: Invoice DEMO-202607-PAY" className="mt-2 min-h-11 w-full rounded-xl border border-sand-300 px-3 text-sm outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-600/20"/></label><div className="flex gap-3 rounded-xl border border-leaf-300 bg-leaf-50 p-4"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-leaf-700"/><div><p className="text-xs font-semibold text-forest-900">What happens next</p><p className="mt-1 text-xs leading-5 text-forest-600">{copy.impact}</p></div></div>{error ? <p role="alert" className="rounded-xl border border-ember-300 bg-ember-50 px-4 py-3 text-sm text-ember-800">{error}</p> : null}</div><footer className="flex flex-col-reverse gap-2 border-t border-sand-200 bg-sand-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7"><button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-sand-300 bg-white px-5 text-sm font-semibold text-forest-800 hover:bg-sand-100 disabled:opacity-50">Cancel</button><button type="submit" disabled={saving || note.trim().length < 8} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <><RefreshCw className="h-4 w-4 animate-spin"/>Saving…</> : copy.submit}</button></footer></form></section></div>, document.body);
}

function PhysicalCount({ data, onSaved }: { data: Dashboard; onSaved: () => Promise<Dashboard | null> }) {
  const [warehouseId, setWarehouse] = useState(data.options.warehouses[0]?.id ?? "");
  const [itemId, setItem] = useState(data.options.items[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Notice>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/reconciliation/physical-counts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ warehouseId, itemId, countDate: data.meta.asOfDate, countedQuantity: Number(quantity), notes, evidence: [] }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Could not save the physical count.");
      setQuantity(""); setNotes(""); await onSaved();
      setMessage({ tone: "success", text: "Physical count recorded and inventory checks refreshed." });
    } catch (value) { setMessage({ tone: "warning", text: value instanceof Error ? value.message : "Could not save the physical count." }); }
    finally { setSaving(false); }
  };
  return <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-leaf-500/10 text-forest-700"><Scale className="h-5 w-5"/></span><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">Routine stock verification</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Compare shelf stock with the system</h2><p className="mt-1 text-sm text-forest-600">Enter what you physically counted. The system compares it with the inventory balance and creates a guided check only when they differ.</p></div></div><form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_.7fr_1.5fr_auto]"><select required value={warehouseId} onChange={(event) => setWarehouse(event.target.value)} className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm"><option value="">Select warehouse</option>{data.options.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select required value={itemId} onChange={(event) => setItem(event.target.value)} className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm"><option value="">Select item</option>{data.options.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select><input required aria-label="Physically counted quantity" type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Counted quantity" className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm"/><input aria-label="Count notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Witness or count circumstances" className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm"/><button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white disabled:opacity-50"><ClipboardCheck className="h-4 w-4"/>{saving ? "Comparing…" : "Record and compare"}</button></form>{message ? <p role="status" className={`mt-3 rounded-xl px-4 py-3 text-sm ${message.tone === "success" ? "bg-leaf-50 text-forest-800" : "bg-amber-50 text-amber-900"}`}>{message.text}</p> : null}</section>;
}
