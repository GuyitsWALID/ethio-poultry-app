"use client";

import {useLocale, useTranslations} from "next-intl";
import {formatOperationDate} from "@/i18n/formats";

import { usePageFilter, ResetPageFilters, PageSelectFilter } from "@/components/page-filter-controls";

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
import { ReconciliationAiPanel } from "@/components/reconciliation-ai-panel";
import { ReconciliationAssignmentPanel } from "@/components/reconciliation-assignment-panel";

type Finding = {
  id: string;
  farm_id?: string | null;
  house_id?: string | null;
  flock_id?: string | null;
  batch_id?: string | null;
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
const showValue = (value: unknown) => value === null || value === undefined ? "Unavailable" : typeof value === "object" ? JSON.stringify(value) : String(value);

export default function ReconciliationPage() {
  const rest = useTranslations("OperationRemainder");
  const ui = useTranslations("OperationUI");
  const codes = useTranslations("History.codes");
  const domainLabel = (value: string) => codes.has((value) as Parameters<typeof codes>[0]) ? codes((value) as Parameters<typeof codes>[0]) : value.replaceAll("_", " ");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [domain, setDomain] = usePageFilter<string>("domain", "all");
  const [farm, setFarm] = usePageFilter<string>("farm", "");
  const [warehouse, setWarehouse] = usePageFilter<string>("warehouse", "");
  const [severity, setSeverity] = usePageFilter<string>("severity", "");
  const [view, setView] = usePageFilter<View>("tab", "open");
  const [query, setQuery] = usePageFilter<string>("query", "");
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
      if (!response.ok) throw new Error(body?.error ?? rest("checksFailed"));
      setData(body);
      return body as Dashboard;
    } catch (value) {
      setError(value instanceof Error ? value.message : rest("checksFailed"));
      return null;
    } finally {
      setLoading(false);
    }
  }, [rest]);

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
    if (item.id === selected) return true;
    if (farm && item.farm_name !== farm) return false;
    if (warehouse && item.warehouse_name !== warehouse) return false;
    if (severity && item.severity !== severity) return false;
    const viewMatch = view === "all"
      || (view === "open" && activeStatuses.has(item.status))
      || (view === "verified" && closedStatuses.has(item.status))
      || (view === "exceptions" && item.status === "accepted_exception");
    const text = `${item.title} ${item.rule_code} ${item.farm_name} ${item.flock_code} ${item.warehouse_name}`.toLowerCase();
    return viewMatch && (domain === "all" || item.domain === domain) && (!query || text.includes(query.toLowerCase()));
  }) ?? [], [data, domain, query, view, selected, farm, warehouse, severity]);

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
      if (!response.ok) throw new Error(body?.error ?? rest("reviewFailed"));
      await load();
      setActionRequest(null);
      setNotice({ tone: "success", text: request.action === "accept_exception" ? rest("exceptionSaved") : rest("reviewSaved") });
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
      setNotice({ tone: "success", text: rest("verified") });
    } else {
      setNotice({ tone: "warning", text: rest("stillDifferent") });
    }
    setBusy("");
  };

  if (loading && !data) return <div className="grid min-h-[55vh] place-items-center text-forest-600"><RefreshCw className="h-6 w-6 animate-spin" aria-hidden="true"/><span className="sr-only">{ui("checkingOperationalRecords")}</span></div>;
  if (error && !data) return <div className="rounded-2xl border border-ember-300 bg-ember-50 p-6 text-ember-800"><strong>{ui("recordChecksCouldNotLoad")}</strong><p className="mt-2 text-sm">{error}</p><button onClick={() => void load()} className="mt-4 rounded-xl bg-forest-900 px-4 py-2 text-sm font-semibold text-white">{ui("tryAgain")}</button></div>;
  if (!data) return null;

  return <main className="space-y-5 pb-12">
      <div className="flex justify-end"><ResetPageFilters /></div>
      <div className="grid gap-3 rounded-2xl border border-sand-200 bg-white p-4 sm:grid-cols-3">
        <PageSelectFilter label={ui("farms")} value={farm} onChange={setFarm} options={[...new Set(data?.findings.map(item => item.farm_name).filter((name): name is string => Boolean(name)) ?? [])].map(value => ({value,label:value}))}/>
        <PageSelectFilter label={ui("warehouses")} value={warehouse} onChange={setWarehouse} options={[...new Set(data?.findings.map(item => item.warehouse_name).filter((name): name is string => Boolean(name)) ?? [])].map(value => ({value,label:value}))}/>
        <PageSelectFilter label={ui("severities")} value={severity} onChange={setSeverity} options={[{value:"critical",label:codes("critical")},{value:"high",label:codes("high")},{value:"medium",label:codes("medium")},{value:"low",label:codes("low")}]}/>
      </div>
    <section className="relative overflow-hidden rounded-[1.75rem] bg-forest-900 px-5 py-7 text-white shadow-sm sm:px-8 sm:py-9">
      <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[38px] border-amber-400/10"/>
      <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-amber-300"><ShieldCheck className="h-4 w-4"/>{ui("automaticRecordChecks")}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">{ui("seeWhatDoesNotAgreeAndExactlyWhereToFix")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100/80">{ui("theSystemComparesBirdFeedEggSalesStockAndCost")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs"><span className="block text-sand-200">{ui("checkedThrough")}</span><strong className="mt-1 block text-sm">{data.meta.asOfDate}</strong></div>
          <button onClick={() => void load(true)} disabled={loading} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-forest-900 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>{ui("checkAllRecordsAgain")}</button>
        </div>
      </div>
    </section>

    {notice ? <div role="status" className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${notice.tone === "success" ? "border-leaf-300 bg-leaf-50 text-forest-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>{notice.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0"/> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/>}<span className="flex-1">{notice.text}</span><button aria-label={ui("dismissMessage")} onClick={() => setNotice(null)}><X className="h-4 w-4"/></button></div> : null}

    <section className="grid overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-4">
      <Metric label={ui("needsCorrection")} value={String(counts.open)} note={rest("openDifferences")} tone="text-ember-600"/>
      <Metric label={ui("managementAttention")} value={String(data.summary.critical)} note={rest("criticalOnly")} tone="text-amber-700"/>
      <Metric label={ui("verifiedAutomatically")} value={String(counts.verified)} note={rest("sourcesAgree")} tone="text-leaf-700"/>
      <Metric label={ui("potentialExposure")} value={formatReconciliationNumber(data.summary.estimatedImpactEtb, "ETB", "0 ETB")} note={rest("estimate")} tone="text-forest-900"/>
    </section>

    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">{ui("yourReviewQueue")}</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">{ui("workOnlyOnRecordsThatNeedAttention")}</h2><p className="mt-1 text-sm text-forest-600">{ui("openingACheckDoesNotAccuseAPersonOrChange")}</p></div>
        <div className="grid gap-2 sm:grid-cols-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ui("searchFarmFlockOrIssue")} className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm outline-none focus:ring-2 focus:ring-forest-600"/><select value={domain} onChange={(event) => setDomain(event.target.value)} className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm">{domains.map((item) => <option key={item} value={item}>{item === "all" ? ui("allRecordTypes") : domainLabel(item)}</option>)}</select></div>
      </div>
      <div className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-1" aria-label={ui("recordCheckViews")}>
        <ViewButton active={view === "open"} onClick={() => setView("open")} label={ui("needsAction")} count={counts.open}/>
        <ViewButton active={view === "verified"} onClick={() => setView("verified")} label={ui("verified")} count={counts.verified}/>
        <ViewButton active={view === "exceptions"} onClick={() => setView("exceptions")} label={ui("ceoExceptions")} count={counts.exceptions}/>
        <ViewButton active={view === "all"} onClick={() => setView("all")} label={ui("fullHistory")} count={data.findings.length}/>
      </div>
    </section>

    <section className="space-y-3" aria-label={ui("recordChecks")}>
      <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">{ui("guidedChecks")}</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">{findings.length} {findings.length === 1 ? ui("item") : ui("items")} {ui("inThisView")}</h2></div><span className="hidden text-xs text-forest-500 sm:block">{ui("correctTheSourceCheckAgainAutomaticallyVerified")}</span></div>
      {findings.length ? findings.map((finding) => <FindingCard key={finding.id} finding={finding} role={data.meta.role} canResolve={data.meta.canResolve} selected={selected === finding.id} busy={busy === finding.id} onVerify={verify} onAction={setActionRequest} onChanged={() => load()}/>) : <div className="rounded-2xl border border-leaf-300 bg-leaf-50 p-8 text-center text-forest-800"><CheckCircle2 className="mx-auto h-8 w-8"/><h3 className="mt-3 font-semibold">{ui("nothingNeedsAttentionInThisView")}</h3><p className="mt-1 text-sm">{ui("theSelectedRecordsAgreePhysicalVerificationIsStillRequiredAs")}</p></div>}
    </section>

    {data.meta.canOperate ? <PhysicalCount data={data} onSaved={() => load(true)}/> : null}
    {actionRequest ? <FindingActionModal request={actionRequest} role={data.meta.role} saving={busy === actionRequest.finding.id} onClose={closeAction} onSave={act}/> : null}
  </main>;
}

function FindingCard({ finding, role, canResolve, selected, busy, onVerify, onAction, onChanged }: { finding: Finding; role: string; canResolve: boolean; selected: boolean; busy: boolean; onVerify: (finding: Finding) => Promise<void>; onAction: (request: ActionRequest) => void; onChanged: () => Promise<unknown> }) {
  const rest = useTranslations("OperationRemainder");
  const ui = useTranslations("OperationUI");
  const codes = useTranslations("History.codes");
  const domainLabel = (value: string) => codes.has((value) as Parameters<typeof codes>[0]) ? codes((value) as Parameters<typeof codes>[0]) : value.replaceAll("_", " ");
  const responseActionLabel = domainLabel;
  const locale = useLocale();
  const guidance = useTranslations("RecordCheckGuidance");
  const workflow = reconciliationWorkflow(finding, role, locale === "am" ? key => guidance(key as Parameters<typeof guidance>[0]) : undefined);
  const active = activeStatuses.has(finding.status);
  const context = [finding.farm_name, finding.house_name, finding.flock_code, finding.warehouse_name, finding.finding_date ? formatOperationDate(`${finding.finding_date}T12:00:00Z`, locale) : null].filter(Boolean).join(" · ") || rest("organization");
  const priorityStyle = workflow.priorityKind === "governance" ? "bg-ember-600 text-white" : workflow.priorityKind === "operational" ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-800";
  const stageStyle = workflow.stage === "verified" ? "border-leaf-300 bg-leaf-50 text-leaf-800" : workflow.stage === "exception" ? "border-sky-200 bg-sky-50 text-sky-800" : workflow.stage === "in_review" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-sand-300 bg-white text-forest-700";

  return <article id={`finding-${finding.id}`} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${selected ? "border-amber-500 ring-2 ring-amber-300/40" : "border-sand-200"}`}>
    <div className="grid gap-5 p-5 xl:grid-cols-[1.15fr_.9fr] xl:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${priorityStyle}`}>{workflow.priorityLabel}</span><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${stageStyle}`}>{workflow.stageLabel}</span><span className="text-[10px] font-semibold uppercase tracking-wider text-forest-400">{domainLabel(finding.domain)}</span></div>
        <h3 className="mt-3 text-xl font-semibold text-forest-900">{workflow.plainTitle}</h3>
        <p className="mt-2 text-sm leading-6 text-forest-600">{workflow.plainExplanation}</p>
        <p className="mt-3 text-xs font-semibold text-forest-700">{context}</p>
        <div className="mt-4 rounded-xl border border-sand-200 bg-sand-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">{ui("whyThisMatters")}</p><p className="mt-1 text-sm leading-6 text-forest-700">{workflow.whyItMatters}</p></div>
      </div>
      <div className="space-y-4">
        <RecordComparison finding={finding}/>
        <WorkflowRail workflow={workflow}/>
        <div className="rounded-xl border border-sand-200 p-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">{ui("whoHandlesThis")}</p><p className="mt-1 text-sm font-semibold text-forest-900">{workflow.owner}</p><p className="mt-1 text-xs leading-5 text-forest-600">{workflow.destination.context}</p></div>
      </div>
    </div>

    <details className="border-t border-sand-200">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-forest-700 hover:bg-sand-50">{ui("seeLikelyCausesSourceValuesAndReviewHistory")}</summary>
      <div className="grid gap-5 border-t border-sand-100 bg-sand-50/60 p-5 lg:grid-cols-3">
        <div><h4 className="text-xs font-semibold uppercase tracking-wider text-forest-500">{ui("commonCausesToCheck")}</h4><ul className="mt-3 space-y-2 text-sm leading-5 text-forest-700">{workflow.likelyCauses.map((cause) => <li key={cause} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"/>{cause}</li>)}</ul></div>
        <div><EvidencePanel entries={finding.evidence_display ?? []}/>{workflow.recordedExplanation ? <div className="mt-3 rounded-xl border border-sand-200 p-3 text-xs"><p className="font-semibold">{guidance("recordedExplanation")}</p><p className="mt-1">{workflow.recordedExplanation}</p></div> : null}</div>
        <div><h4 className="text-xs font-semibold uppercase tracking-wider text-forest-500">{ui("reviewHistory")}</h4><p className="mt-1 text-xs leading-5 text-forest-500">{ui("notesAreSupportingContextTheyNeverEditTheSourceRecord")}</p><div className="mt-3 space-y-2">{finding.responses?.length ? finding.responses.map((response) => <div key={response.id} className="rounded-lg border border-sand-200 bg-white p-3 text-xs"><strong>{responseActionLabel(response.action)}</strong> · {response.actor_name ?? rest("authorizedUser")}<p className="mt-1 leading-5 text-forest-600">{response.note}</p></div>) : <p className="rounded-lg border border-sand-200 bg-white p-3 text-xs text-forest-500">{ui("noReviewNoteHasBeenNeeded")}</p>}</div></div>
      </div>
    </details>

    <ReconciliationAiPanel findingId={finding.id}/>

    <ReconciliationAssignmentPanel findingId={finding.id} findingStatus={finding.status} role={role} onChanged={onChanged}/>

    <div className="flex flex-col gap-3 border-t border-sand-200 bg-white px-5 py-4 lg:flex-row lg:items-center">
      <div className="mr-auto"><p className="text-sm font-semibold text-forest-900">{active ? ui("nextStep") : ui("outcome2")}</p><p className="mt-0.5 text-xs leading-5 text-forest-600">{active ? workflow.verification : finding.status === "cleared" ? ui("theSystemConfirmedThatTheUnderlyingRecordsNowAgree") : ui("theDecisionAndSupportingHistoryRemainAvailableForAudit")}</p></div>
      <div className="flex flex-wrap gap-2">
        {active ? <>
          <Link href={workflow.destination.href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white hover:bg-forest-800">{workflow.destination.label}<ExternalLink className="h-4 w-4"/></Link>
          <button onClick={() => void onVerify(finding)} disabled={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-forest-700 bg-white px-4 text-sm font-semibold text-forest-800 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}/>{ui("checkAgain")}</button>
          {role === "farm_manager" ? <button onClick={() => onAction({ finding, action: "explain" })} disabled={busy} className="min-h-11 rounded-xl border border-sand-300 px-4 text-sm font-semibold text-forest-700">{ui("explainOrRequestHelp")}</button> : null}
          {canResolve ? <button onClick={() => onAction({ finding, action: "accept_exception" })} disabled={busy} className="min-h-11 rounded-xl px-3 text-xs font-semibold text-forest-600 underline underline-offset-4">{ui("approveAValidException")}</button> : null}
        </> : canResolve && finding.status === "accepted_exception" ? <button onClick={() => onAction({ finding, action: "reopen" })} disabled={busy} className="min-h-11 rounded-xl border border-sand-300 px-4 text-sm font-semibold text-forest-700">{ui("withdrawExceptionAndReviewAgain")}</button> : null}
      </div>
    </div>
  </article>;
}

function RecordComparison({ finding }: { finding: Finding }) {
  const ui = useTranslations("OperationUI");
  const locale = useLocale();
  const codes = useTranslations("History.codes");
  const value = (input: unknown) => input == null ? ui("unavailable") : typeof input === "number" ? formatReconciliationNumber(input, "", ui("unavailable"), locale) : showValue(input);
  return <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-xl bg-forest-950 p-4 text-center text-white"><Proof label={ui("shouldBe")} value={value(finding.expected_value)}/><ArrowRight className="h-4 w-4 text-sand-400"/><Proof label={ui("systemFound")} value={value(finding.recorded_value)}/><ArrowRight className="h-4 w-4 text-sand-400"/><Proof label={ui("difference")} value={formatReconciliationNumber(finding.variance_value, finding.variance_unit && codes.has((finding.variance_unit) as Parameters<typeof codes>[0]) ? codes((finding.variance_unit) as Parameters<typeof codes>[0]) : finding.variance_unit ?? "", ui("unavailable"), locale)}/></div>;
}

function WorkflowRail({ workflow }: { workflow: ReconciliationWorkflow }) {
  const rest = useTranslations("OperationRemainder");
  const steps = [
    { label: rest("difference"), done: true },
    { label: rest("corrected"), done: workflow.stage === "verified" },
    { label: workflow.stage === "exception" ? rest("exception") : rest("systemVerified"), done: workflow.stage === "verified" || workflow.stage === "exception" },
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
  const ui = useTranslations("OperationUI");
  return <div><h4 className="text-xs font-semibold uppercase tracking-wider text-forest-500">{ui("valuesUsedByTheCheck")}</h4><p className="mt-1 text-xs leading-5 text-forest-500">{ui("relatedRecordsAreShownByTheirFarmNameFlockCode")}</p>{entries.length ? <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{entries.map((entry) => <div key={entry.key} className="rounded-xl border border-sand-200 bg-white p-3"><dt className="text-[9px] font-semibold uppercase tracking-wider text-forest-400">{entry.label}</dt><dd className="mt-1 break-words text-xs font-semibold text-forest-900">{entry.value}</dd></div>)}</dl> : <p className="mt-3 rounded-xl border border-sand-200 bg-white p-3 text-xs leading-5 text-forest-500">{ui("noAdditionalSourceValuesAreNeededForThisCheck")}</p>}</div>;
}


function FindingActionModal({ request, role, saving, onClose, onSave }: { request: ActionRequest; role: string; saving: boolean; onClose: () => void; onSave: (request: ActionRequest, note: string, reference: string) => Promise<void> }) {
  const rest = useTranslations("OperationRemainder");
  const ui = useTranslations("OperationUI");
const actionCopy: Record<FindingAction, { eyebrow: string; title: string; purpose: string; prompt: string; placeholder: string; submit: string; impact: string; icon: typeof HelpCircle }> = {
  investigate: { eyebrow: ui("followUpInstruction"), title: ui("recordWhatShouldHappenNext"), purpose: ui("useThisToLeaveAClearInstructionOrReviewNote"), prompt: ui("whatShouldBeCheckedOrCorrectedAndWhoShouldFollow"), placeholder: ui("exampleFarmManagerShouldAssignTheJulyPayrollCostTo"), submit: ui("saveFollowUp"), impact: ui("theNoteBecomesPartOfTheControlHistoryTheSystem"), icon: Clock3 },
  explain: { eyebrow: ui("operationalContext"), title: ui("explainTheIssueOrRequestHelp"), purpose: ui("useThisWhenYouCannotSafelyCorrectTheRecordYourself"), prompt: ui("whatHappenedWhatHaveYouAlreadyCheckedAndWhatHelp"), placeholder: ui("exampleTheFeedTransferHappenedAfterTheDayWasLocked"), submit: ui("sendExplanation"), impact: ui("theExplanationBecomesVisibleToTheCEOTheCheckStays"), icon: HelpCircle },
  accept_exception: { eyebrow: ui("ceoDecision"), title: ui("approveThisAsAValidException"), purpose: ui("useOnlyWhenTheDifferenceIsLegitimateAndShouldRemain"), prompt: ui("whyIsTheDifferenceValidWhoAuthorizedItAndWhat"), placeholder: ui("exampleThisPayrollCostIsAnApprovedHeadOfficeExpense"), submit: ui("approveException"), impact: ui("theCheckClosesAsACEOApprovedExceptionWhileRetaining"), icon: ShieldCheck },
  reopen: { eyebrow: ui("exceptionWithdrawn"), title: ui("returnThisItemToReview"), purpose: ui("useWhenNewEvidenceShowsThatAnAcceptedExceptionShould"), prompt: ui("whatNewEvidenceOrChangeRequiresAnotherReview"), placeholder: ui("describeTheNewInformationAndTheCorrectionNowRequired"), submit: ui("reopenReview"), impact: ui("theCheckReturnsToTheActiveQueueAndAllPrior"), icon: RefreshCw },
};

  const locale = useLocale();
  const guidance = useTranslations("RecordCheckGuidance");
  const copy = actionCopy[request.action];
  const workflow = reconciliationWorkflow(request.finding, role, locale === "am" ? key => guidance(key as Parameters<typeof guidance>[0]) : undefined);
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
    if (clean.length < 8) { setError(ui("addAShortButUsefulExplanationOfAtLeast8")); return; }
    if (request.action === "accept_exception" && reference.trim().length < 3) { setError(ui("addASupportingReferenceThatAnotherReviewerCanVerify")); return; }
    setError("");
    try { await onSave(request, clean, reference); } catch (value) { setError(value instanceof Error ? value.message : rest("reviewNotSaved")); }
  };
  return createPortal(<div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-forest-950/70 p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="finding-action-title" className="my-6 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-sand-200 bg-white shadow-2xl"><header className="relative overflow-hidden border-b border-sand-200 bg-forest-900 px-5 py-5 text-white sm:px-7"><div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border-[22px] border-amber-400/10"/><div className="relative flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[9px] font-bold uppercase tracking-[.18em] text-amber-200"><Icon className="h-3.5 w-3.5"/>{copy.eyebrow}</span><h2 id="finding-action-title" className="mt-3 font-display text-2xl font-semibold">{copy.title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-sand-100/80">{copy.purpose}</p></div><button type="button" onClick={onClose} disabled={saving} aria-label={ui("closeForm")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/20 hover:bg-white/10 disabled:opacity-50"><X className="h-4 w-4"/></button></div></header><form onSubmit={(event) => void submit(event)}><div className="space-y-5 p-5 sm:p-7"><div className="rounded-xl border border-sand-200 bg-sand-50 p-4"><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-forest-500">{ui("issue")}</p><h3 className="mt-1 text-sm font-semibold text-forest-900">{workflow.plainTitle}</h3><p className="mt-1 text-xs leading-5 text-forest-600">{workflow.destination.context}</p></div><label className="block"><span className="text-sm font-semibold text-forest-900">{ui("explanation")} <span className="text-ember-600">*</span></span><span className="mt-1 block text-xs leading-5 text-forest-600">{copy.prompt}</span><textarea ref={textareaRef} value={note} onChange={(event) => { setNote(event.target.value); if (error) setError(""); }} rows={5} placeholder={copy.placeholder} className="mt-2 w-full resize-y rounded-xl border border-sand-300 px-3 py-3 text-sm leading-6 text-forest-900 outline-none placeholder:text-forest-400 focus:border-forest-700 focus:ring-2 focus:ring-forest-600/20"/><span className={`mt-1 block text-right text-[10px] ${note.trim().length < 8 ? "text-forest-400" : "text-leaf-700"}`}>{note.trim().length} {ui("charactersMinimum8")}</span></label><label className="block"><span className="text-sm font-semibold text-forest-900">{ui("supportingReference")} {request.action === "accept_exception" ? <span className="text-ember-600">*</span> : <span className="font-normal text-forest-500">{ui("optional")}</span>}</span><span className="mt-1 block text-xs leading-5 text-forest-600">{ui("invoiceNumberDocumentPhotoReferenceGovernanceRequestOrAnotherSource")}</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={ui("exampleInvoiceDEMO202607PAY")} className="mt-2 min-h-11 w-full rounded-xl border border-sand-300 px-3 text-sm outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-600/20"/></label><div className="flex gap-3 rounded-xl border border-leaf-300 bg-leaf-50 p-4"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-leaf-700"/><div><p className="text-xs font-semibold text-forest-900">{ui("whatHappensNext")}</p><p className="mt-1 text-xs leading-5 text-forest-600">{copy.impact}</p></div></div>{error ? <p role="alert" className="rounded-xl border border-ember-300 bg-ember-50 px-4 py-3 text-sm text-ember-800">{error}</p> : null}</div><footer className="flex flex-col-reverse gap-2 border-t border-sand-200 bg-sand-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7"><button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-sand-300 bg-white px-5 text-sm font-semibold text-forest-800 hover:bg-sand-100 disabled:opacity-50">{ui("cancel")}</button><button type="submit" disabled={saving || note.trim().length < 8} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <><RefreshCw className="h-4 w-4 animate-spin"/>{ui("saving")}</> : copy.submit}</button></footer></form></section></div>, document.body);
}

function PhysicalCount({ data, onSaved }: { data: Dashboard; onSaved: () => Promise<Dashboard | null> }) {
  const rest = useTranslations("OperationRemainder");
  const ui = useTranslations("OperationUI");
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
      if (!response.ok) throw new Error(body?.error ?? rest("countFailed"));
      setQuantity(""); setNotes(""); await onSaved();
      setMessage({ tone: "success", text: rest("countSaved") });
    } catch (value) { setMessage({ tone: "warning", text: value instanceof Error ? value.message : rest("countFailed") }); }
    finally { setSaving(false); }
  };
  return <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-leaf-500/10 text-forest-700"><Scale className="h-5 w-5"/></span><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">{ui("routineStockVerification")}</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">{ui("compareShelfStockWithTheSystem")}</h2><p className="mt-1 text-sm text-forest-600">{ui("enterWhatYouPhysicallyCountedTheSystemComparesItWith")}</p></div></div><form onSubmit={(event) => void submit(event)} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1.5fr)_auto] [&>input]:min-w-0 [&>select]:min-w-0 [&>button]:min-h-12"><select required value={warehouseId} onChange={(event) => setWarehouse(event.target.value)} className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm"><option value="">{ui("selectWarehouse")}</option>{data.options.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select required value={itemId} onChange={(event) => setItem(event.target.value)} className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm"><option value="">{ui("selectItem")}</option>{data.options.items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select><input required aria-label={ui("physicallyCountedQuantity")} type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={ui("countedQuantity")} className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm"/><input aria-label={ui("countNotes")} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={ui("witnessOrCountCircumstances")} className="min-h-11 rounded-xl border border-sand-300 px-3 text-sm"/><button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white disabled:opacity-50"><ClipboardCheck className="h-4 w-4"/>{saving ? ui("comparing") : ui("recordAndCompare")}</button></form>{message ? <p role="status" className={`mt-3 rounded-xl px-4 py-3 text-sm ${message.tone === "success" ? "bg-leaf-50 text-forest-800" : "bg-amber-50 text-amber-900"}`}>{message.text}</p> : null}</section>;
}
