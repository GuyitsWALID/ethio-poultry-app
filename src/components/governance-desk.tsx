/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {useLocale, useTranslations} from "next-intl";
import { formatOperationDateTime} from "@/i18n/formats";

import { usePageFilter, ResetPageFilters, PageSelectFilter } from "@/components/page-filter-controls";

import { ArrowRight, CheckCircle2, ExternalLink, FileCheck2, Paperclip, RefreshCw, ShieldCheck, Upload, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GovernanceAuditHistory } from "@/components/governance-audit-history";
import { FeedTemplateReview } from "@/components/governance-feed-template-review";
import {GovernanceStructuredValue} from "@/components/governance-structured-value";

type DisplayValue = { field: string; label: string; value: unknown };
type Context = { title?: string; sourceLabel?: string; farmName?: string | null; houseName?: string | null; flockName?: string | null; batchName?: string | null; warehouseName?: string | null; currentValues?: DisplayValue[]; proposedValues?: DisplayValue[]; impact?: string };
type Activity = { id: string; action: string; actor_name_snapshot: string; actor_role_snapshot: string; note?: string | null; created_at: string };
type Evidence = { id: string; reference_label?: string | null; reference_url?: string | null; file_name?: string | null; uploaded_at: string };
type RequestRow = {
  id: string; request_type: string; status: string; reason: string; requested_at: string; latest_submitted_at?: string | null;
  decision_note?: string | null; decided_at?: string | null; approval_expires_at?: string | null; applied_at?: string | null;
  source_version?: string | null; conflict_reason?: string | null; requester_name_snapshot: string; requester_role_snapshot: string;
  requester_scope_snapshot?: { farms?: Array<{ id: string; name: string }>; warehouses?: Array<{ id: string; name: string }> };
  context_snapshot?: Context; correction_route?: string | null; changed_fields?: string[]; proposed_values?: Record<string, unknown>;
  activity?: Activity[]; evidence?: Evidence[];
};
type Desk = { meta: { role: string; canApprove: boolean; canRequest: boolean }; requests: RequestRow[] };
type DraftValue = { field: string; value: string };
type Draft = { requestType: string; farmId: string; warehouseId: string; sourceTable: string; sourceId: string; sourceVersion: string; destination: string; correctionRoute: string; findingId: string; sourceChoice: string; reason: string; referenceLabel: string; referenceUrl: string; values: DraftValue[] };

const emptyDraft: Draft = { requestType: "locked_correction", farmId: "", warehouseId: "", sourceTable: "", sourceId: "", sourceVersion: "", destination: "", correctionRoute: "", findingId: "", sourceChoice: "", reason: "", referenceLabel: "", referenceUrl: "", values: [] };
const requestLabels: Record<string, string> = {
  recording_start: "recordingStartingPoint",
  batch_create: "createBatchCycle", batch_archive: "archiveBatchCycle", flock_place: "placeFlock", flock_transfer: "transferFlock",
  flock_close: "closeFlock", flock_archive: "archiveFlock", feed_template: "feedTemplate", breed_target: "breedTarget",
  health_schedule: "healthSchedule", warning_threshold: "warningThresholds", locked_correction: "lockedRecordCorrection", void_record: "voidARecord",
  batch_cycle_create: "placeNewBatchCycle", batch_cycle_close: "finishAndArchiveCycle", archived_cycle_correction: "correctArchivedBirdHistory",
};
const statusText: Record<string, string> = { pending: "awaitingCEO", returned: "returnedForChanges", approved: "readyToFix", rejected: "rejected", applied: "completed", conflict: "sourceChanged", expired: "authorizationExpired", submitted: "submitted2", resubmitted: "resubmitted" };
const statusStyle: Record<string, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-900", returned: "border-sky-300 bg-sky-50 text-sky-800", approved: "border-leaf-300 bg-leaf-50 text-leaf-800",
  applied: "border-leaf-300 bg-leaf-50 text-leaf-800", rejected: "border-sand-300 bg-sand-100 text-forest-600", conflict: "border-ember-300 bg-ember-50 text-ember-800", expired: "border-sand-300 bg-sand-100 text-forest-600",
};

function correctionHref(row: RequestRow, includeAuthorization = false) {
  const url = new URL(row.correction_route ?? "/app/governance", "https://internal.invalid");
  if (row.request_type === "feed_template") {
    const batchId = row.proposed_values?.batch_id;
    if (typeof batchId === "string" && batchId) url.searchParams.set("filter_batchId", batchId);
    if (!includeAuthorization) {
      url.searchParams.set("feed_target", "template_management");
      url.hash = "feed-template-management";
    }
  }
  if (includeAuthorization) url.searchParams.set("governance_request", row.id);
  return `${url.pathname}${url.search}${url.hash}`;
}

function useGovernanceFieldLabel() {
  const fields = useTranslations("History.fields");
  return (field: string, fallback = field.replaceAll("_", " ")) => fields.has((field) as Parameters<typeof fields>[0]) ? fields((field) as Parameters<typeof fields>[0]) : fallback;
}

function Difference({ context }: { context: Context }) {
  const fieldLabel = useGovernanceFieldLabel();
  const ui = useTranslations("OperationUI");
  const current = new Map((context.currentValues ?? []).map((item) => [item.field, item]));
  return <div><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">{ui("whatWillChange")}</p><div className="mt-2 overflow-hidden rounded-xl border border-sand-200 bg-white">
    {(context.proposedValues ?? []).map((next) => next.field === "rows" ? <div key={next.field} className="border-b border-sand-100 p-3 last:border-b-0"><strong className="mb-2 block text-sm text-forest-900">{fieldLabel(next.field, next.label)}</strong><FeedTemplateReview rows={next.value}/></div> : <div key={next.field} className="grid gap-2 border-b border-sand-100 p-3 last:border-b-0 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-center">
      <strong className="text-sm text-forest-900">{fieldLabel(next.field, next.label)}</strong><div className="rounded-lg bg-sand-50 px-3 py-2 text-sm text-forest-600"><GovernanceStructuredValue value={current.get(next.field)?.value}/></div><ArrowRight className="hidden h-4 w-4 text-forest-400 sm:block"/><div className="rounded-lg bg-leaf-50 px-3 py-2 text-sm font-semibold text-forest-900"><GovernanceStructuredValue value={next.value}/></div>
    </div>)}
  </div></div>;
}

async function uploadFiles(requestId: string, files: File[], failed: (file: string) => string) {
  for (const file of files) {
    const form = new FormData(); form.set("file", file);
    const response = await fetch(`/api/governance/requests/${requestId}/evidence`, { method: "POST", body: form });
    if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? failed(file.name)); }
  }
}

function DecisionPanel({ row, onClose, onDone }: { row: RequestRow; onClose: () => void; onDone: () => Promise<void> }) {
  const ui = useTranslations("OperationUI");
  const locale = useLocale();
  const roles = useTranslations("History.codes");
  const roleLabel = (value: string) => roles.has((value) as Parameters<typeof roles>[0]) ? roles((value) as Parameters<typeof roles>[0]) : value.replaceAll("_", " ");
  const dateTime = (value?: string | null) => value ? formatOperationDateTime(value, locale) : ui("unavailable");
  const [decision, setDecision] = useState<"approved" | "returned" | "rejected">("approved"); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async () => {
    if (note.trim().length < 4) return setError(ui("explainTheDecisionInAtLeastFourCharacters"));
    setBusy(true); const response = await fetch(`/api/governance/requests/${row.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) }); const data = await response.json().catch(() => null); setBusy(false);
    if (!response.ok) return setError(data?.error ?? ui("decisionCouldNotBeSaved")); await onDone(); onClose();
  };
  return <div className="fixed inset-0 z-[210] grid place-items-center overflow-y-auto bg-forest-950/60 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}><section className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="decision-title">
    <header className="flex items-start justify-between bg-forest-900 p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-300">{ui("ceoDecision")}</p><h2 id="decision-title" className="mt-1 font-display text-2xl font-semibold">{ui("review")} {row.context_snapshot?.sourceLabel ?? ui((requestLabels[row.request_type] ?? "unavailable") as Parameters<typeof ui>[0])}</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/20" aria-label={ui("closeDecisionPanel")}><X className="h-4 w-4"/></button></header>
    <div className="space-y-5 p-5"><div className="rounded-xl bg-sand-50 p-4 text-sm"><strong>{row.requester_name_snapshot}</strong><span className="text-forest-500"> · {roleLabel(row.requester_role_snapshot)} {ui("submitted")} {dateTime(row.latest_submitted_at ?? row.requested_at)}</span></div><Difference context={row.context_snapshot ?? {}}/>
      <fieldset><legend className="text-sm font-semibold text-forest-900">{ui("decision")}</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{(["approved", "returned", "rejected"] as const).map((value) => <label key={value} className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${decision === value ? "border-forest-800 bg-forest-900 text-white" : "border-sand-200"}`}><input className="sr-only" type="radio" checked={decision === value} onChange={() => setDecision(value)}/>{value === "approved" ? ui("approveAndAuthorize") : value === "returned" ? ui("returnForChanges") : ui("reject")}</label>)}</div></fieldset>
      <label className="grid gap-2 text-sm font-semibold text-forest-900">{ui("decisionNote")}<textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-28 rounded-xl border border-sand-200 p-3 font-normal" placeholder={decision === "approved" ? ui("stateWhyThisExactChangeIsAuthorized") : ui("explainWhatMustChangeOrWhyItWasRejected")}/></label>
      {decision === "approved" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-forest-700">{ui("approvalDoesNotEditTheRecordItGivesAnAssigned")}</p> : null}{error ? <p role="alert" className="text-sm text-ember-700">{error}</p> : null}<button type="button" disabled={busy} onClick={() => void submit()} className="min-h-11 w-full rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? ui("savingDecision") : ui("saveDecision")}</button>
    </div>
  </section></div>;
}

function RevisionPanel({ row, onClose, onDone }: { row: RequestRow; onClose: () => void; onDone: () => Promise<void> }) {
  const ui = useTranslations("OperationUI");
  const feedback = useTranslations("OperationFeedback");
  const fieldLabel = useGovernanceFieldLabel();
  const [reason, setReason] = useState(row.reason);
  const [values, setValues] = useState<DraftValue[]>(Object.entries(row.proposed_values ?? {}).map(([field, value]) => ({ field, value: String(value ?? "") })));
  const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); const proposed = Object.fromEntries(values.map((item) => [item.field, item.value])); setBusy(true);
    const response = await fetch(`/api/governance/requests/${row.id}/resubmit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, proposed_values: proposed, changed_fields: values.map((item) => item.field) }) });
    const data = await response.json().catch(() => null); if (!response.ok) { setBusy(false); return setError(data?.error ?? ui("revisionCouldNotBeSubmitted")); }
    try { await uploadFiles(row.id, files, file => feedback("uploadFailed", {file})); } catch (uploadError) { setBusy(false); return setError(uploadError instanceof Error ? feedback("revisionSubmitted", {error: uploadError.message}) : ui("theRevisedRequestWasSubmittedButEvidenceUploadFailed")); }
    setBusy(false); await onDone(); onClose();
  };
  return <div className="fixed inset-0 z-[210] grid place-items-center overflow-y-auto bg-forest-950/60 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}><section className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="revision-title">
    <header className="flex items-start justify-between bg-forest-900 p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-300">{ui("returnedRequest")}</p><h2 id="revision-title" className="mt-1 font-display text-2xl">{ui("reviseAndResubmit")}</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/20" aria-label={ui("closeRevisionPanel")}><X className="h-4 w-4"/></button></header>
    <form onSubmit={submit} className="space-y-4 p-5"><p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-forest-700"><strong>{ui("ceoFeedback")}</strong> {row.decision_note}</p><div className="grid gap-3 sm:grid-cols-2">{values.map((item, index) => <label key={item.field} className="grid gap-1 text-sm font-semibold">{fieldLabel(item.field)}<input value={item.value} onChange={(event) => setValues((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, value: event.target.value } : value))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal"/></label>)}</div>
      <label className="grid gap-2 text-sm font-semibold">{ui("updatedReason")}<textarea required minLength={8} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 rounded-xl border border-sand-200 p-3 font-normal"/></label><label className="grid gap-2 text-sm font-semibold">{ui("addSupportingFiles")}<span className="text-xs font-normal text-forest-500">{ui("pdfJPEGPNGOrWebPFiveFilesMaximumAcrossThe")}</span><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} className="rounded-xl border border-dashed border-sand-300 p-3 font-normal"/></label>
      {error ? <p role="alert" className="text-sm text-ember-700">{error}</p> : null}<button disabled={busy} className="min-h-11 w-full rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? ui("resubmitting") : ui("resubmitToCEO")}</button>
    </form>
  </section></div>;
}

function RequestCard({ row, role, onDecide, onRevise }: { row: RequestRow; role: string; onDecide: (row: RequestRow) => void; onRevise: (row: RequestRow) => void }) {
  const ui = useTranslations("OperationUI");
  const feedback = useTranslations("OperationFeedback");
  const locale = useLocale();
  const roles = useTranslations("History.codes");
  const roleLabel = (value: string) => roles.has((value) as Parameters<typeof roles>[0]) ? roles((value) as Parameters<typeof roles>[0]) : value.replaceAll("_", " ");
  const dateTime = (value?: string | null) => value ? formatOperationDateTime(value, locale) : ui("unavailable");
  const context = row.context_snapshot ?? {}; const [open, setOpen] = useState(false);
  const scope = [context.farmName, context.houseName, context.flockName, context.batchName, context.warehouseName].filter(Boolean).join(" · ") || "Organization-wide";
  const assignedScope = [...(row.requester_scope_snapshot?.farms ?? []).map((item) => item.name), ...(row.requester_scope_snapshot?.warehouses ?? []).map((item) => item.name)].join(", ") || scope;
  const resubmitted = row.latest_submitted_at && row.latest_submitted_at !== row.requested_at;
  return <article id={`request-${row.id}`} className={`scroll-mt-28 overflow-hidden rounded-2xl border bg-white ${row.status === "pending" && role === "ceo" ? "border-amber-300" : "border-sand-200"}`}>
    <div className="grid gap-5 p-5 xl:grid-cols-[1.3fr_.9fr_auto] xl:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[row.status] ?? statusStyle.expired}`}>{ui((statusText[row.status] ?? "unavailable") as Parameters<typeof ui>[0])}</span><span className="text-xs font-semibold uppercase tracking-wider text-forest-500">{ui((requestLabels[row.request_type] ?? "unavailable") as Parameters<typeof ui>[0]) }</span></div><h3 className="mt-3 text-lg font-semibold text-forest-950">{context.sourceLabel ?? ui((requestLabels[row.request_type] ?? "unavailable") as Parameters<typeof ui>[0])}</h3><p className="mt-1 text-sm leading-6 text-forest-600">{row.reason}</p><p className="mt-2 text-xs font-semibold text-forest-700">{scope}</p>{row.conflict_reason ? <p className="mt-3 rounded-lg bg-ember-50 p-2 text-xs text-ember-800">{row.conflict_reason}</p> : null}</div>
      <div className="rounded-xl bg-sand-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">{ui("proposedBy")}</p><div className="mt-2 flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-forest-900 text-white"><UserRound className="h-4 w-4"/></div><div><p className="font-semibold text-forest-950">{row.requester_name_snapshot}</p><p className="text-xs text-forest-500">{roleLabel(row.requester_role_snapshot)}</p><p className="mt-1 text-xs text-forest-600">{ui("assignedAtSubmission")} {assignedScope}</p><p className="mt-2 text-xs text-forest-500">{ui("submitted2")} {dateTime(row.requested_at)}</p>{resubmitted ? <p className="text-xs font-semibold text-sky-700">{ui("latestRevision")} {dateTime(row.latest_submitted_at)}</p> : null}</div></div></div>
      <div className="flex min-w-48 flex-col gap-2">{role === "ceo" && row.status === "pending" ? <button onClick={() => onDecide(row)} className="min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white">{ui("reviewProposal")}</button> : null}{role === "farm_manager" && row.status === "returned" ? <button onClick={() => onRevise(row)} className="min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white">{ui("reviseProposal")}</button> : null}{role === "farm_manager" && row.status === "approved" ? <Link href={correctionHref(row, true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white">{ui("fixNow")} <ExternalLink className="h-4 w-4"/></Link> : null}{row.correction_route ? <Link href={correctionHref(row)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sand-200 px-3 text-xs font-semibold text-forest-800">{ui("inspectAffectedRecord")} <ExternalLink className="h-3.5 w-3.5"/></Link> : null}<button onClick={() => setOpen((value) => !value)} className="min-h-10 text-xs font-semibold text-forest-700">{open ? ui("hideDetails") : ui("seeProposalDetails")}</button></div>
    </div>
    {open ? <div className="border-t border-sand-200 bg-sand-50/60 p-5"><Difference context={context}/><div className="mt-4 grid gap-4 lg:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">{ui("evidenceAndImpact")}</p><p className="mt-2 text-sm text-forest-700">{context.impact ?? feedback("reviewedValues")}</p>{row.evidence?.length ? <div className="mt-3 space-y-2">{row.evidence.map((item) => <a key={item.id} href={item.reference_url ?? `/api/governance/requests/${row.id}/evidence?evidence_id=${item.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-forest-800 underline"><Paperclip className="h-3.5 w-3.5"/>{item.reference_label ?? item.file_name ?? feedback("supportingEvidence")}</a>)}</div> : <p className="mt-2 text-xs text-forest-500">{ui("noSupportingFileOrReferenceWasAttached")}</p>}<p className="mt-3 text-xs text-forest-500">{ui("sourceFreshnessCaptured")} {dateTime(row.source_version)}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">{ui("decisionAndReviewHistory")}</p><div className="mt-2 space-y-2">{row.activity?.map((item) => <div key={item.id} className="rounded-xl border border-sand-200 bg-white p-3 text-xs"><strong>{item.actor_name_snapshot}</strong> · {ui((statusText[item.action] ?? "unavailable") as Parameters<typeof ui>[0])}<p className="mt-1 text-forest-600">{item.note || feedback("noNote")}</p><p className="mt-1 text-forest-400">{dateTime(item.created_at)}</p></div>)}</div></div></div></div> : null}
  </article>;
}

export function GovernanceDesk() {
  const ui = useTranslations("OperationUI");
  const feedback = useTranslations("OperationFeedback");
  const fieldLabel = useGovernanceFieldLabel();
  const [requester,setRequester]=usePageFilter<string>("requester","");
  const [farmFilter,setFarmFilter]=usePageFilter<string>("farm","");
  const [warehouseFilter,setWarehouseFilter]=usePageFilter<string>("warehouse","");
  const [requestType,setRequestType]=usePageFilter<string>("requestType","");
  const [statusFilter,setStatusFilter]=usePageFilter<string>("status","");
  const [desk, setDesk] = useState<Desk | null>(null); const [loading, setLoading] = useState(true); const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft); const [files, setFiles] = useState<File[]>([]); const [decision, setDecision] = useState<RequestRow | null>(null); const [revision, setRevision] = useState<RequestRow | null>(null);
  const load = useCallback(async () => { setLoading(true); const response = await fetch("/api/governance/desk", { cache: "no-store" }); const data = await response.json().catch(() => null); if (response.ok) setDesk(data); else setMessage(data?.error ?? ui("governanceDeskCouldNotLoad")); setLoading(false); }, [ui]);
  useEffect(() => {
    void load(); const params = new URLSearchParams(window.location.search); const proposed = params.get("proposed_values"); let values: DraftValue[] = [];
    if (proposed) try { values = Object.entries(JSON.parse(proposed) as Record<string, unknown>).map(([field, value]) => ({ field, value: String(value ?? "") })); } catch { /* Invalid query context is ignored safely. */ }
    setDraft((current) => ({ ...current, requestType: params.get("request_type") ?? current.requestType, farmId: params.get("farm_id") ?? "", warehouseId: params.get("warehouse_id") ?? "", reason: params.get("reason") ?? "", sourceTable: params.get("source_table") ?? "", sourceId: params.get("source_id") ?? "", sourceVersion: params.get("source_version") ?? "", destination: params.get("destination") ?? "", correctionRoute: params.get("correction_route") ?? "", findingId: params.get("finding") ?? "", sourceChoice: params.get("source") ?? current.sourceChoice, values }));
    const requestId = params.get("request"); if (requestId) window.setTimeout(() => document.getElementById(`request-${requestId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 500);
  }, [load]);
  const contextual = Boolean(draft.sourceId || draft.destination || draft.findingId);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (draft.findingId && !draft.sourceChoice) return setMessage(ui("chooseWhichSourceRecordIsWrongBeforeSubmittingThisCorrection"));
    const proposed = Object.fromEntries(draft.values.filter((item) => item.field.trim()).map((item) => [item.field.trim(), item.value]));
    const response = await fetch("/api/governance/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_type: draft.requestType, intent: draft.findingId ? `${draft.requestType}:${draft.sourceChoice}` : draft.requestType, farm_id: draft.farmId || null, warehouse_id: draft.warehouseId || null, source_table: draft.sourceTable || null, source_id: draft.sourceId || null, source_version: draft.sourceVersion || null, reason: draft.reason, changed_fields: Object.keys(proposed), proposed_values: proposed, correction_route: draft.correctionRoute || null, finding_id: draft.findingId || null, references: draft.referenceUrl ? [{ label: draft.referenceLabel, url: draft.referenceUrl }] : [] }) });
    const data = await response.json().catch(() => null); if (!response.ok) return setMessage(data?.error ?? ui("proposalCouldNotBeSubmitted"));
    try { await uploadFiles(data.request.id, files, file => feedback("uploadFailed", {file})); } catch (error) { setMessage(error instanceof Error ? feedback("proposalSubmitted", {error: error.message}) : ui("theProposalWasSubmittedButEvidenceUploadFailed")); await load(); return; }
    setMessage(ui("proposalSentToTheCEOWithItsFullContextAnd")); setDraft(emptyDraft); setFiles([]); await load();
  };
  const role = desk?.meta.role ?? "";
  const sections = useMemo(() => role === "farm_manager" ? [
    { title: ui("readyToFix"), statuses: ["approved"] }, { title: ui("returnedForChanges"), statuses: ["returned"] }, { title: ui("awaitingCEO"), statuses: ["pending"] }, { title: ui("history"), statuses: ["applied", "rejected", "expired", "conflict", "cancelled"] },
  ] : [
    { title: ui("needsYourDecision"), statuses: ["pending"] }, { title: ui("authorizedAndAwaitingCorrection"), statuses: ["approved"] }, { title: ui("decisionHistory"), statuses: ["returned", "applied", "rejected", "expired", "conflict", "cancelled"] },
  ], [role, ui]);
  return <main className="space-y-6 pb-10">
    <div className="grid items-end gap-3 rounded-2xl border border-sand-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-3">
      <PageSelectFilter label={ui("requesters")} value={requester} onChange={setRequester} options={[...new Set(desk?.requests.map(row=>row.requester_name_snapshot)??[])].map(value=>({value,label:value}))}/>
      <PageSelectFilter label={ui("farms")} value={farmFilter} onChange={setFarmFilter} options={[...new Set(desk?.requests.map(row=>row.context_snapshot?.farmName).filter((value):value is string=>Boolean(value))??[])].map(value=>({value,label:value}))}/>
      <PageSelectFilter label={ui("warehouses")} value={warehouseFilter} onChange={setWarehouseFilter} options={[...new Set(desk?.requests.map(row=>row.context_snapshot?.warehouseName).filter((value):value is string=>Boolean(value))??[])].map(value=>({value,label:value}))}/>
      <PageSelectFilter label={ui("requestTypes")} value={requestType} onChange={setRequestType} options={[...new Set(desk?.requests.map(row=>row.request_type)??[])].map(value=>({value,label:ui((requestLabels[value] ?? "unavailable") as Parameters<typeof ui>[0])}))}/>
      <PageSelectFilter label={ui("statuses")} value={statusFilter} onChange={setStatusFilter} options={[...new Set(desk?.requests.map(row=>row.status)??[])].map(value=>({value,label:ui((statusText[value] ?? "unavailable") as Parameters<typeof ui>[0])}))}/>
      <ResetPageFilters />
    </div>
    <section className="overflow-hidden rounded-2xl bg-forest-900 p-7 text-white"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-300">{ui("controlledChange")}</p><h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold text-balance">{ui("approveTheReasonThenCorrectTheExactRecordOnce")}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-sand-100/80">{ui("farmManagersExplainAProtectedChangeTheCEOSeesWho")}</p></div><button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-semibold"><RefreshCw className="h-4 w-4"/>{ui("refreshDesk")}</button></div><div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{[ui("differenceFoundStep"), ui("managerProposesStep"), ui("ceoAuthorizesStep"), ui("managerFixesOnceStep")].map((label, index) => <div key={label} className="flex items-center gap-2 rounded-xl bg-white/[.07] p-3 text-xs font-semibold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10">{index + 1}</span>{label}</div>)}</div></section>
    {message ? <p role="status" className="rounded-xl border border-sand-200 bg-white p-3 text-sm text-forest-800">{message}</p> : null}
    {role === "farm_manager" ? <section className="rounded-2xl border border-sand-200 bg-white p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 text-forest-700"/><div><h2 className="font-display text-2xl text-forest-950">{ui("requestAControlledChange")}</h2><p className="mt-1 text-sm text-forest-600">{ui("startFromThePageWhereTheProblemAppearsSoIts")}</p></div></div>
      {contextual ? <form onSubmit={submit} className="mt-5 grid gap-4"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-amber-800">{ui("affectedRecord")}</p><p className="mt-1 font-semibold text-forest-950">{draft.destination || ui((requestLabels[draft.requestType] ?? "unavailable") as Parameters<typeof ui>[0]) || feedback("protectedRecord")}</p></div>
        {draft.findingId ? <label className="grid gap-2 text-sm font-semibold">{ui("whichRecordIsWrong")}<select required value={draft.sourceChoice} onChange={(event) => setDraft((current) => ({ ...current, sourceChoice: event.target.value }))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal"><option value="">{ui("chooseTheSourceToCorrect")}</option><option value="selected_source">{ui("theSelectedOperationalRecord")}</option><option value="comparison_source">{ui("theRecordItWasComparedAgainst")}</option></select></label> : null}
        <div className="grid gap-3 md:grid-cols-2">{draft.values.map((item, index) => item.field.endsWith("_id") ? <input key={`${item.field}-${index}`} type="hidden" value={item.value} readOnly/> : <label key={`${item.field}-${index}`} className="grid gap-1 text-sm font-semibold">{fieldLabel(item.field)}<input value={item.value} onChange={(event) => setDraft((current) => ({ ...current, values: current.values.map((value, itemIndex) => itemIndex === index ? { ...value, value: event.target.value } : value) }))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal"/></label>)}</div>
        <label className="grid gap-2 text-sm font-semibold">{ui("whyIsThisChangeNeeded")}<textarea required minLength={8} value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} className="min-h-24 rounded-xl border border-sand-200 p-3 font-normal" placeholder={ui("explainWhatWasObservedAndWhyTheProtectedValueIs")}/></label>
        <div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">{ui("supportingReferenceLabel")}<input value={draft.referenceLabel} onChange={(event) => setDraft((current) => ({ ...current, referenceLabel: event.target.value }))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal" placeholder={ui("countSheetOrInvoice")}/></label><label className="grid gap-1 text-sm font-semibold">{ui("referenceLink")}<input type="url" value={draft.referenceUrl} onChange={(event) => setDraft((current) => ({ ...current, referenceUrl: event.target.value }))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal" placeholder={ui("https2")}/></label></div>
        <label className="grid gap-2 text-sm font-semibold">{ui("supportingFiles")}<span className="text-xs font-normal text-forest-500">{ui("optionalPDFOrPhotoUpToFiveFilesAnd8")}</span><span className="flex items-center gap-2 rounded-xl border border-dashed border-sand-300 p-3"><Upload className="h-4 w-4"/><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} className="text-sm font-normal"/></span></label><button className="min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white">{ui("sendProposalToCEO")}</button>
      </form> : <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[{ title: ui("lifecycleChange"), copy: ui("createPlaceTransferCloseOrArchiveBirds"), href: "/app/flocks" }, { title: ui("lockedDailyRecord"), copy: ui("openTheAffectedDateAndRequestItsExactCorrection"), href: "/app/daily-records" }, { title: ui("feedConfiguration"), copy: ui("proposeFeedTemplatesOrWarningThresholds"), href: "/app/feeding-log" }, { title: ui("recordCheck"), copy: ui("startWithTheMismatchAndIdentifyWhichSourceIsWrong"), href: "/app/reconciliation" }].map((card) => <Link key={card.title} href={card.href} className="group rounded-xl border border-sand-200 p-4 transition hover:border-forest-500 hover:bg-sand-50"><FileCheck2 className="h-5 w-5 text-forest-700"/><h3 className="mt-3 font-semibold text-forest-950">{card.title}</h3><p className="mt-1 text-sm leading-5 text-forest-600">{card.copy}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-forest-800">{ui("openSourcePage")} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1"/></span></Link>)}</div>}
    </section> : null}
    {loading ? <section className="grid gap-3">{[1, 2, 3].map((value) => <div key={value} className="h-36 animate-pulse rounded-2xl bg-sand-100"/>)}</section> : sections.map((section) => { const rows = (desk?.requests ?? []).filter((row) => section.statuses.includes(row.status) && (!requester || row.requester_name_snapshot===requester) && (!farmFilter || row.context_snapshot?.farmName===farmFilter) && (!warehouseFilter || row.context_snapshot?.warehouseName===warehouseFilter) && (!requestType || row.request_type===requestType) && (!statusFilter || row.status===statusFilter)); return <section key={section.title} className="space-y-3"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">{ui("governanceQueue")}</p><h2 className="mt-1 font-display text-2xl text-forest-950">{section.title}</h2></div><span className="text-sm text-forest-500">{feedback("requests", {count: rows.length})}</span></div>{rows.length ? rows.map((row) => <RequestCard key={row.id} row={row} role={role} onDecide={setDecision} onRevise={setRevision}/>) : <div className="rounded-2xl border border-dashed border-sand-300 bg-white p-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-leaf-600"/><p className="mt-2 text-sm font-semibold text-forest-900">{ui("nothingWaitingHere")}</p></div>}</section>; })}
    {role ? <GovernanceAuditHistory role={role}/> : null}
    {decision ? <DecisionPanel row={decision} onClose={() => setDecision(null)} onDone={load}/> : null}{revision ? <RevisionPanel row={revision} onClose={() => setRevision(null)} onDone={load}/> : null}
  </main>;
}
