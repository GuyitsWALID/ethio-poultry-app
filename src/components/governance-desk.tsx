/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { usePageFilter, ResetPageFilters, PageSelectFilter } from "@/components/page-filter-controls";

import { ArrowRight, CheckCircle2, ExternalLink, FileCheck2, Paperclip, RefreshCw, ShieldCheck, Upload, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GovernanceAuditHistory } from "@/components/governance-audit-history";

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
  batch_create: "Create batch cycle", batch_archive: "Archive batch cycle", flock_place: "Place flock", flock_transfer: "Transfer flock",
  flock_close: "Close flock", flock_archive: "Archive flock", feed_template: "Feed template", breed_target: "Breed target",
  health_schedule: "Health schedule", warning_threshold: "Warning thresholds", locked_correction: "Locked record correction", void_record: "Void a record",
};
const statusText: Record<string, string> = { pending: "Awaiting CEO", returned: "Returned for changes", approved: "Ready to fix", rejected: "Rejected", applied: "Completed", conflict: "Source changed", expired: "Authorization expired", submitted: "Submitted", resubmitted: "Resubmitted" };
const statusStyle: Record<string, string> = {
  pending: "border-amber-300 bg-amber-50 text-amber-900", returned: "border-sky-300 bg-sky-50 text-sky-800", approved: "border-leaf-300 bg-leaf-50 text-leaf-800",
  applied: "border-leaf-300 bg-leaf-50 text-leaf-800", rejected: "border-sand-300 bg-sand-100 text-forest-600", conflict: "border-ember-300 bg-ember-50 text-ember-800", expired: "border-sand-300 bg-sand-100 text-forest-600",
};

function dateTime(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Addis_Ababa" }).format(new Date(value));
}
function roleLabel(value: string) { return value === "farm_manager" ? "Farm Manager" : value.replaceAll("_", " "); }
function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return "Structured details attached";
  return String(value);
}

function Difference({ context }: { context: Context }) {
  const current = new Map((context.currentValues ?? []).map((item) => [item.field, item]));
  return <div><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">What will change</p><div className="mt-2 overflow-hidden rounded-xl border border-sand-200 bg-white">
    {(context.proposedValues ?? []).map((next) => <div key={next.field} className="grid gap-2 border-b border-sand-100 p-3 last:border-b-0 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-center">
      <strong className="text-sm text-forest-900">{next.label}</strong><span className="rounded-lg bg-sand-50 px-3 py-2 text-sm text-forest-600">{displayValue(current.get(next.field)?.value)}</span><ArrowRight className="hidden h-4 w-4 text-forest-400 sm:block"/><span className="rounded-lg bg-leaf-50 px-3 py-2 text-sm font-semibold text-forest-900">{displayValue(next.value)}</span>
    </div>)}
  </div></div>;
}

async function uploadFiles(requestId: string, files: File[]) {
  for (const file of files) {
    const form = new FormData(); form.set("file", file);
    const response = await fetch(`/api/governance/requests/${requestId}/evidence`, { method: "POST", body: form });
    if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? `${file.name} could not be uploaded.`); }
  }
}

function DecisionPanel({ row, onClose, onDone }: { row: RequestRow; onClose: () => void; onDone: () => Promise<void> }) {
  const [decision, setDecision] = useState<"approved" | "returned" | "rejected">("approved"); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async () => {
    if (note.trim().length < 4) return setError("Explain the decision in at least four characters.");
    setBusy(true); const response = await fetch(`/api/governance/requests/${row.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) }); const data = await response.json().catch(() => null); setBusy(false);
    if (!response.ok) return setError(data?.error ?? "Decision could not be saved."); await onDone(); onClose();
  };
  return <div className="fixed inset-0 z-[210] grid place-items-center overflow-y-auto bg-forest-950/60 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}><section className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="decision-title">
    <header className="flex items-start justify-between bg-forest-900 p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-300">CEO decision</p><h2 id="decision-title" className="mt-1 font-display text-2xl font-semibold">Review {row.context_snapshot?.sourceLabel ?? requestLabels[row.request_type]}</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/20" aria-label="Close decision panel"><X className="h-4 w-4"/></button></header>
    <div className="space-y-5 p-5"><div className="rounded-xl bg-sand-50 p-4 text-sm"><strong>{row.requester_name_snapshot}</strong><span className="text-forest-500"> · {roleLabel(row.requester_role_snapshot)} · submitted {dateTime(row.latest_submitted_at ?? row.requested_at)}</span></div><Difference context={row.context_snapshot ?? {}}/>
      <fieldset><legend className="text-sm font-semibold text-forest-900">Decision</legend><div className="mt-2 grid gap-2 sm:grid-cols-3">{(["approved", "returned", "rejected"] as const).map((value) => <label key={value} className={`cursor-pointer rounded-xl border p-3 text-sm font-semibold ${decision === value ? "border-forest-800 bg-forest-900 text-white" : "border-sand-200"}`}><input className="sr-only" type="radio" checked={decision === value} onChange={() => setDecision(value)}/>{value === "approved" ? "Approve and authorize" : value === "returned" ? "Return for changes" : "Reject"}</label>)}</div></fieldset>
      <label className="grid gap-2 text-sm font-semibold text-forest-900">Decision note<textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-28 rounded-xl border border-sand-200 p-3 font-normal" placeholder={decision === "approved" ? "State why this exact change is authorized." : "Explain what must change or why it was rejected."}/></label>
      {decision === "approved" ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-forest-700">Approval does not edit the record. It gives an assigned Farm Manager seven days to apply only these values once.</p> : null}{error ? <p role="alert" className="text-sm text-ember-700">{error}</p> : null}<button type="button" disabled={busy} onClick={() => void submit()} className="min-h-11 w-full rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving decision…" : "Save decision"}</button>
    </div>
  </section></div>;
}

function RevisionPanel({ row, onClose, onDone }: { row: RequestRow; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState(row.reason);
  const [values, setValues] = useState<DraftValue[]>(Object.entries(row.proposed_values ?? {}).map(([field, value]) => ({ field, value: String(value ?? "") })));
  const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); const proposed = Object.fromEntries(values.map((item) => [item.field, item.value])); setBusy(true);
    const response = await fetch(`/api/governance/requests/${row.id}/resubmit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, proposed_values: proposed, changed_fields: values.map((item) => item.field) }) });
    const data = await response.json().catch(() => null); if (!response.ok) { setBusy(false); return setError(data?.error ?? "Revision could not be submitted."); }
    try { await uploadFiles(row.id, files); } catch (uploadError) { setBusy(false); return setError(uploadError instanceof Error ? `${uploadError.message} The revised request was submitted.` : "The revised request was submitted, but evidence upload failed."); }
    setBusy(false); await onDone(); onClose();
  };
  return <div className="fixed inset-0 z-[210] grid place-items-center overflow-y-auto bg-forest-950/60 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}><section className="my-6 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="revision-title">
    <header className="flex items-start justify-between bg-forest-900 p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Returned request</p><h2 id="revision-title" className="mt-1 font-display text-2xl">Revise and resubmit</h2></div><button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/20" aria-label="Close revision panel"><X className="h-4 w-4"/></button></header>
    <form onSubmit={submit} className="space-y-4 p-5"><p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-forest-700"><strong>CEO feedback:</strong> {row.decision_note}</p><div className="grid gap-3 sm:grid-cols-2">{values.map((item, index) => <label key={item.field} className="grid gap-1 text-sm font-semibold">{item.field.replaceAll("_", " ")}<input value={item.value} onChange={(event) => setValues((current) => current.map((value, itemIndex) => itemIndex === index ? { ...value, value: event.target.value } : value))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal"/></label>)}</div>
      <label className="grid gap-2 text-sm font-semibold">Updated reason<textarea required minLength={8} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 rounded-xl border border-sand-200 p-3 font-normal"/></label><label className="grid gap-2 text-sm font-semibold">Add supporting files<span className="text-xs font-normal text-forest-500">PDF, JPEG, PNG, or WebP. Five files maximum across the request.</span><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} className="rounded-xl border border-dashed border-sand-300 p-3 font-normal"/></label>
      {error ? <p role="alert" className="text-sm text-ember-700">{error}</p> : null}<button disabled={busy} className="min-h-11 w-full rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Resubmitting…" : "Resubmit to CEO"}</button>
    </form>
  </section></div>;
}

function RequestCard({ row, role, onDecide, onRevise }: { row: RequestRow; role: string; onDecide: (row: RequestRow) => void; onRevise: (row: RequestRow) => void }) {
  const context = row.context_snapshot ?? {}; const [open, setOpen] = useState(false);
  const scope = [context.farmName, context.houseName, context.flockName, context.batchName, context.warehouseName].filter(Boolean).join(" · ") || "Organization-wide";
  const assignedScope = [...(row.requester_scope_snapshot?.farms ?? []).map((item) => item.name), ...(row.requester_scope_snapshot?.warehouses ?? []).map((item) => item.name)].join(", ") || scope;
  const resubmitted = row.latest_submitted_at && row.latest_submitted_at !== row.requested_at;
  return <article id={`request-${row.id}`} className={`scroll-mt-28 overflow-hidden rounded-2xl border bg-white ${row.status === "pending" && role === "ceo" ? "border-amber-300" : "border-sand-200"}`}>
    <div className="grid gap-5 p-5 xl:grid-cols-[1.3fr_.9fr_auto] xl:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyle[row.status] ?? statusStyle.expired}`}>{statusText[row.status] ?? row.status}</span><span className="text-xs font-semibold uppercase tracking-wider text-forest-500">{requestLabels[row.request_type] ?? row.request_type.replaceAll("_", " ")}</span></div><h3 className="mt-3 text-lg font-semibold text-forest-950">{context.sourceLabel ?? requestLabels[row.request_type]}</h3><p className="mt-1 text-sm leading-6 text-forest-600">{row.reason}</p><p className="mt-2 text-xs font-semibold text-forest-700">{scope}</p>{row.conflict_reason ? <p className="mt-3 rounded-lg bg-ember-50 p-2 text-xs text-ember-800">{row.conflict_reason}</p> : null}</div>
      <div className="rounded-xl bg-sand-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">Proposed by</p><div className="mt-2 flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-forest-900 text-white"><UserRound className="h-4 w-4"/></div><div><p className="font-semibold text-forest-950">{row.requester_name_snapshot}</p><p className="text-xs text-forest-500">{roleLabel(row.requester_role_snapshot)}</p><p className="mt-1 text-xs text-forest-600">Assigned at submission: {assignedScope}</p><p className="mt-2 text-xs text-forest-500">Submitted {dateTime(row.requested_at)}</p>{resubmitted ? <p className="text-xs font-semibold text-sky-700">Latest revision {dateTime(row.latest_submitted_at)}</p> : null}</div></div></div>
      <div className="flex min-w-48 flex-col gap-2">{role === "ceo" && row.status === "pending" ? <button onClick={() => onDecide(row)} className="min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white">Review proposal</button> : null}{role === "farm_manager" && row.status === "returned" ? <button onClick={() => onRevise(row)} className="min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white">Revise proposal</button> : null}{role === "farm_manager" && row.status === "approved" ? <Link href={`${row.correction_route ?? "/app/governance"}${(row.correction_route ?? "").includes("?") ? "&" : "?"}governance_request=${row.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white">Fix now <ExternalLink className="h-4 w-4"/></Link> : null}{row.correction_route ? <Link href={row.correction_route} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sand-200 px-3 text-xs font-semibold text-forest-800">Inspect affected record <ExternalLink className="h-3.5 w-3.5"/></Link> : null}<button onClick={() => setOpen((value) => !value)} className="min-h-10 text-xs font-semibold text-forest-700">{open ? "Hide details" : "See proposal details"}</button></div>
    </div>
    {open ? <div className="border-t border-sand-200 bg-sand-50/60 p-5"><Difference context={context}/><div className="mt-4 grid gap-4 lg:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">Evidence and impact</p><p className="mt-2 text-sm text-forest-700">{context.impact ?? "Only the reviewed values may change."}</p>{row.evidence?.length ? <div className="mt-3 space-y-2">{row.evidence.map((item) => <a key={item.id} href={item.reference_url ?? `/api/governance/requests/${row.id}/evidence?evidence_id=${item.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-forest-800 underline"><Paperclip className="h-3.5 w-3.5"/>{item.reference_label ?? item.file_name ?? "Supporting evidence"}</a>)}</div> : <p className="mt-2 text-xs text-forest-500">No supporting file or reference was attached.</p>}<p className="mt-3 text-xs text-forest-500">Source freshness captured {dateTime(row.source_version)}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">Decision and review history</p><div className="mt-2 space-y-2">{row.activity?.map((item) => <div key={item.id} className="rounded-xl border border-sand-200 bg-white p-3 text-xs"><strong>{item.actor_name_snapshot}</strong> · {statusText[item.action] ?? item.action}<p className="mt-1 text-forest-600">{item.note || "No note"}</p><p className="mt-1 text-forest-400">{dateTime(item.created_at)}</p></div>)}</div></div></div></div> : null}
  </article>;
}

export function GovernanceDesk() {
  const [requester,setRequester]=usePageFilter<string>("requester","");
  const [farmFilter,setFarmFilter]=usePageFilter<string>("farm","");
  const [warehouseFilter,setWarehouseFilter]=usePageFilter<string>("warehouse","");
  const [requestType,setRequestType]=usePageFilter<string>("requestType","");
  const [statusFilter,setStatusFilter]=usePageFilter<string>("status","");
  const [desk, setDesk] = useState<Desk | null>(null); const [loading, setLoading] = useState(true); const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft); const [files, setFiles] = useState<File[]>([]); const [decision, setDecision] = useState<RequestRow | null>(null); const [revision, setRevision] = useState<RequestRow | null>(null);
  const load = useCallback(async () => { setLoading(true); const response = await fetch("/api/governance/desk", { cache: "no-store" }); const data = await response.json().catch(() => null); if (response.ok) setDesk(data); else setMessage(data?.error ?? "Governance desk could not load."); setLoading(false); }, []);
  useEffect(() => {
    void load(); const params = new URLSearchParams(window.location.search); const proposed = params.get("proposed_values"); let values: DraftValue[] = [];
    if (proposed) try { values = Object.entries(JSON.parse(proposed) as Record<string, unknown>).map(([field, value]) => ({ field, value: String(value ?? "") })); } catch { /* Invalid query context is ignored safely. */ }
    setDraft((current) => ({ ...current, requestType: params.get("request_type") ?? current.requestType, farmId: params.get("farm_id") ?? "", warehouseId: params.get("warehouse_id") ?? "", reason: params.get("reason") ?? "", sourceTable: params.get("source_table") ?? "", sourceId: params.get("source_id") ?? "", sourceVersion: params.get("source_version") ?? "", destination: params.get("destination") ?? "", correctionRoute: params.get("correction_route") ?? "", findingId: params.get("finding") ?? "", values }));
    const requestId = params.get("request"); if (requestId) window.setTimeout(() => document.getElementById(`request-${requestId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 500);
  }, [load]);
  const contextual = Boolean(draft.sourceId || draft.destination || draft.findingId);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (draft.findingId && !draft.sourceChoice) return setMessage("Choose which source record is wrong before submitting this correction.");
    const proposed = Object.fromEntries(draft.values.filter((item) => item.field.trim()).map((item) => [item.field.trim(), item.value]));
    const response = await fetch("/api/governance/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_type: draft.requestType, intent: draft.findingId ? `${draft.requestType}:${draft.sourceChoice}` : draft.requestType, farm_id: draft.farmId || null, warehouse_id: draft.warehouseId || null, source_table: draft.sourceTable || null, source_id: draft.sourceId || null, source_version: draft.sourceVersion || null, reason: draft.reason, changed_fields: Object.keys(proposed), proposed_values: proposed, correction_route: draft.correctionRoute || null, finding_id: draft.findingId || null, references: draft.referenceUrl ? [{ label: draft.referenceLabel, url: draft.referenceUrl }] : [] }) });
    const data = await response.json().catch(() => null); if (!response.ok) return setMessage(data?.error ?? "Proposal could not be submitted.");
    try { await uploadFiles(data.request.id, files); } catch (error) { setMessage(error instanceof Error ? `${error.message} The proposal itself was submitted.` : "The proposal was submitted, but evidence upload failed."); await load(); return; }
    setMessage("Proposal sent to the CEO with its full context and requester identity."); setDraft(emptyDraft); setFiles([]); await load();
  };
  const role = desk?.meta.role ?? "";
  const sections = useMemo(() => role === "farm_manager" ? [
    { title: "Ready to fix", statuses: ["approved"] }, { title: "Returned for changes", statuses: ["returned"] }, { title: "Awaiting CEO", statuses: ["pending"] }, { title: "History", statuses: ["applied", "rejected", "expired", "conflict", "cancelled"] },
  ] : [
    { title: "Needs your decision", statuses: ["pending"] }, { title: "Authorized and awaiting correction", statuses: ["approved"] }, { title: "Decision history", statuses: ["returned", "applied", "rejected", "expired", "conflict", "cancelled"] },
  ], [role]);
  return <main className="space-y-6 pb-10">
    <div className="grid items-end gap-3 rounded-2xl border border-sand-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-3">
      <PageSelectFilter label="Requesters" value={requester} onChange={setRequester} options={[...new Set(desk?.requests.map(row=>row.requester_name_snapshot)??[])].map(value=>({value,label:value}))}/>
      <PageSelectFilter label="Farms" value={farmFilter} onChange={setFarmFilter} options={[...new Set(desk?.requests.map(row=>row.context_snapshot?.farmName).filter((value):value is string=>Boolean(value))??[])].map(value=>({value,label:value}))}/>
      <PageSelectFilter label="Warehouses" value={warehouseFilter} onChange={setWarehouseFilter} options={[...new Set(desk?.requests.map(row=>row.context_snapshot?.warehouseName).filter((value):value is string=>Boolean(value))??[])].map(value=>({value,label:value}))}/>
      <PageSelectFilter label="Request types" value={requestType} onChange={setRequestType} options={[...new Set(desk?.requests.map(row=>row.request_type)??[])].map(value=>({value,label:requestLabels[value]??value.replaceAll("_"," ")}))}/>
      <PageSelectFilter label="Statuses" value={statusFilter} onChange={setStatusFilter} options={[...new Set(desk?.requests.map(row=>row.status)??[])].map(value=>({value,label:value.replaceAll("_"," ")}))}/>
      <ResetPageFilters />
    </div>
    <section className="overflow-hidden rounded-2xl bg-forest-900 p-7 text-white"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Controlled change</p><h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold text-balance">Approve the reason, then correct the exact record once</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-sand-100/80">Farm Managers explain a protected change. The CEO sees who requested it and exactly what will change. Approval creates a seven-day authorization; it never edits the record by itself.</p></div><button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-semibold"><RefreshCw className="h-4 w-4"/>Refresh desk</button></div><div className="mt-6 grid gap-2 sm:grid-cols-4">{["Difference found", "Manager proposes", "CEO authorizes", "Manager fixes once"].map((label, index) => <div key={label} className="flex items-center gap-2 rounded-xl bg-white/[.07] p-3 text-xs font-semibold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10">{index + 1}</span>{label}</div>)}</div></section>
    {message ? <p role="status" className="rounded-xl border border-sand-200 bg-white p-3 text-sm text-forest-800">{message}</p> : null}
    {role === "farm_manager" ? <section className="rounded-2xl border border-sand-200 bg-white p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-5 w-5 text-forest-700"/><div><h2 className="font-display text-2xl text-forest-950">Request a controlled change</h2><p className="mt-1 text-sm text-forest-600">Start from the page where the problem appears so its readable record context and requested values arrive automatically.</p></div></div>
      {contextual ? <form onSubmit={submit} className="mt-5 grid gap-4"><div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Affected record</p><p className="mt-1 font-semibold text-forest-950">{draft.destination || requestLabels[draft.requestType] || "Protected record"}</p></div>
        {draft.findingId ? <label className="grid gap-2 text-sm font-semibold">Which record is wrong?<select required value={draft.sourceChoice} onChange={(event) => setDraft((current) => ({ ...current, sourceChoice: event.target.value }))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal"><option value="">Choose the source to correct</option><option value="selected_source">The selected operational record</option><option value="comparison_source">The record it was compared against</option></select></label> : null}
        <div className="grid gap-3 md:grid-cols-2">{draft.values.map((item, index) => <label key={`${item.field}-${index}`} className="grid gap-1 text-sm font-semibold">{item.field.replaceAll("_", " ")}<input value={item.value} onChange={(event) => setDraft((current) => ({ ...current, values: current.values.map((value, itemIndex) => itemIndex === index ? { ...value, value: event.target.value } : value) }))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal"/></label>)}</div>
        <label className="grid gap-2 text-sm font-semibold">Why is this change needed?<textarea required minLength={8} value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} className="min-h-24 rounded-xl border border-sand-200 p-3 font-normal" placeholder="Explain what was observed and why the protected value is incorrect."/></label>
        <div className="grid gap-3 md:grid-cols-2"><label className="grid gap-1 text-sm font-semibold">Supporting reference label<input value={draft.referenceLabel} onChange={(event) => setDraft((current) => ({ ...current, referenceLabel: event.target.value }))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal" placeholder="Count sheet or invoice"/></label><label className="grid gap-1 text-sm font-semibold">Reference link<input type="url" value={draft.referenceUrl} onChange={(event) => setDraft((current) => ({ ...current, referenceUrl: event.target.value }))} className="h-11 rounded-xl border border-sand-200 px-3 font-normal" placeholder="https://"/></label></div>
        <label className="grid gap-2 text-sm font-semibold">Supporting files<span className="text-xs font-normal text-forest-500">Optional PDF or photo, up to five files and 8 MB each.</span><span className="flex items-center gap-2 rounded-xl border border-dashed border-sand-300 p-3"><Upload className="h-4 w-4"/><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))} className="text-sm font-normal"/></span></label><button className="min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white">Send proposal to CEO</button>
      </form> : <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[{ title: "Lifecycle change", copy: "Create, place, transfer, close, or archive birds.", href: "/app/flocks" }, { title: "Locked Daily Record", copy: "Open the affected date and request its exact correction.", href: "/app/daily-records" }, { title: "Feed configuration", copy: "Propose feed templates or warning thresholds.", href: "/app/feeding-log" }, { title: "Record Check", copy: "Start with the mismatch and identify which source is wrong.", href: "/app/reconciliation" }].map((card) => <Link key={card.title} href={card.href} className="group rounded-xl border border-sand-200 p-4 transition hover:border-forest-500 hover:bg-sand-50"><FileCheck2 className="h-5 w-5 text-forest-700"/><h3 className="mt-3 font-semibold text-forest-950">{card.title}</h3><p className="mt-1 text-sm leading-5 text-forest-600">{card.copy}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-forest-800">Open source page <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1"/></span></Link>)}</div>}
    </section> : null}
    {loading ? <section className="grid gap-3">{[1, 2, 3].map((value) => <div key={value} className="h-36 animate-pulse rounded-2xl bg-sand-100"/>)}</section> : sections.map((section) => { const rows = (desk?.requests ?? []).filter((row) => section.statuses.includes(row.status) && (!requester || row.requester_name_snapshot===requester) && (!farmFilter || row.context_snapshot?.farmName===farmFilter) && (!warehouseFilter || row.context_snapshot?.warehouseName===warehouseFilter) && (!requestType || row.request_type===requestType) && (!statusFilter || row.status===statusFilter)); return <section key={section.title} className="space-y-3"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">Governance queue</p><h2 className="mt-1 font-display text-2xl text-forest-950">{section.title}</h2></div><span className="text-sm text-forest-500">{rows.length} request{rows.length === 1 ? "" : "s"}</span></div>{rows.length ? rows.map((row) => <RequestCard key={row.id} row={row} role={role} onDecide={setDecision} onRevise={setRevision}/>) : <div className="rounded-2xl border border-dashed border-sand-300 bg-white p-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-leaf-600"/><p className="mt-2 text-sm font-semibold text-forest-900">Nothing waiting here</p></div>}</section>; })}
    {role ? <GovernanceAuditHistory role={role}/> : null}
    {decision ? <DecisionPanel row={decision} onClose={() => setDecision(null)} onDone={load}/> : null}{revision ? <RevisionPanel row={revision} onClose={() => setRevision(null)} onDone={load}/> : null}
  </main>;
}
