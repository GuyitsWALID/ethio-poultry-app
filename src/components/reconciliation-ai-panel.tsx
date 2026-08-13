"use client";

import { AlertTriangle, BrainCircuit, CheckCircle2, ChevronDown, Clock3, RefreshCw, SearchCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { RECONCILIATION_AI_DISCLAIMER, type ReconciliationAiAnalysis, type ReconciliationAiEvidenceItem } from "@/lib/reconciliation-ai-contract";

type AiState = {
  enabled: boolean;
  latest: ReconciliationAiAnalysis | null;
  history: ReconciliationAiAnalysis[];
};

function readableError(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") return body.error;
  return fallback;
}

async function jsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  return response.json().catch(() => null);
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function confidenceStyle(value: string) {
  if (value === "high") return "bg-ember-50 text-ember-700 border-ember-200";
  if (value === "medium") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-sand-100 text-forest-600 border-sand-200";
}

function EvidenceReferences({ references, evidence }: { references: string[]; evidence: Map<string, ReconciliationAiEvidenceItem> }) {
  if (!references.length) return <span className="text-[10px] text-forest-400">General guidance</span>;
  return <span className="flex flex-wrap gap-1.5">{references.map((reference) => {
    const item = evidence.get(reference);
    return <span key={reference} title={item?.value} className="inline-flex rounded-full border border-leaf-300 bg-leaf-50 px-2 py-0.5 text-[10px] font-semibold text-forest-700">{reference} · {item?.label ?? "Source evidence"}</span>;
  })}</span>;
}

export function ReconciliationAiPanel({ findingId }: { findingId: string }) {
  const [opened, setOpened] = useState(false);
  const [state, setState] = useState<AiState | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const evidence = useMemo(() => new Map((state?.latest?.evidence ?? []).map((item) => [item.id, item])), [state]);

  const load = async () => {
    setOpened(true);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/reconciliation/findings/${findingId}/ai-analysis`, { cache: "no-store" });
      const body = await jsonResponse(response);
      if (!response.ok) throw new Error(readableError(body, "AI guidance could not load."));
      setState(body as AiState);
    } catch (value) {
      setError(value instanceof Error ? value.message : "AI guidance could not load.");
    } finally {
      setLoading(false);
    }
  };

  const generate = async (regenerate: boolean) => {
    setGenerating(true);
    setError("");
    try {
      const response = await fetch(`/api/reconciliation/findings/${findingId}/ai-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate, requestKey: crypto.randomUUID() }),
      });
      const body = await jsonResponse(response);
      if (!response.ok) throw new Error(readableError(body, "AI guidance could not be generated."));
      const analysis = (body as { analysis: ReconciliationAiAnalysis }).analysis;
      setState((current) => ({
        enabled: true,
        latest: analysis,
        history: [analysis, ...(current?.history ?? []).filter((item) => item.id !== analysis.id)],
      }));
    } catch (value) {
      setError(value instanceof Error ? value.message : "AI guidance could not be generated.");
    } finally {
      setGenerating(false);
    }
  };

  if (!opened) {
    return <section className="border-t border-sand-200 bg-forest-950 px-5 py-4 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><BrainCircuit className="h-5 w-5"/></span>
        <div className="mr-auto"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-200">AI investigation assistant</p><p className="mt-1 text-sm text-sand-100/80">Ask for an evidence-grounded explanation and practical checks. No records or decisions will be changed.</p></div>
        <button onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-forest-900 hover:bg-sand-100"><Sparkles className="h-4 w-4"/>Open AI assistant</button>
      </div>
    </section>;
  }

  return <section className="border-t border-sand-200 bg-forest-950 px-5 py-5 text-white" aria-label="AI investigation assistant">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><BrainCircuit className="h-5 w-5"/></span>
      <div className="mr-auto"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-200">AI investigation assistant</p>{state?.latest?.stale ? <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-forest-950">Evidence changed</span> : state?.latest ? <span className="rounded-full bg-leaf-400/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-leaf-200">Current evidence</span> : null}</div><p className="mt-1 max-w-3xl text-xs leading-5 text-sand-100/70">{RECONCILIATION_AI_DISCLAIMER}</p></div>
      <button onClick={() => setOpened(false)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 px-3 text-xs font-semibold text-white hover:bg-white/10"><ChevronDown className="h-4 w-4"/>Close assistant</button>
    </div>

    {loading ? <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-sand-100"><RefreshCw className="h-4 w-4 animate-spin"/>Loading preserved guidance…</div> : null}
    {error ? <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-ember-400/30 bg-ember-500/10 p-4 text-sm text-ember-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><span>{error} The deterministic Record Check remains available.</span></div> : null}
    {!loading && state && !state.enabled ? <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-sm font-semibold">AI guidance is not enabled for this deployment.</p><p className="mt-1 text-xs text-sand-100/70">The automatic Record Check and its correction workflow continue to work normally.</p></div> : null}
    {!loading && state?.enabled && !state.latest ? <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-semibold">Analyze this confirmed record difference</p><p className="mt-1 text-xs leading-5 text-sand-100/70">Groq receives only the visible business labels, relevant values, dates, and review notes for this check.</p></div><button disabled={generating} onClick={() => void generate(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-semibold text-forest-950 disabled:opacity-60">{generating ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>}{generating ? "Analyzing evidence…" : "Ask AI to analyze"}</button></div> : null}

    {state?.latest?.output ? <div className="mt-5 space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl bg-white p-5 text-forest-900"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-forest-900 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white">Evidence {state.latest.output.evidenceSufficiency}</span>{state.latest.cached ? <span className="text-[10px] text-forest-500">Preserved analysis reused</span> : null}</div><h4 className="mt-3 font-display text-xl font-semibold">What the evidence suggests</h4><p className="mt-2 text-sm leading-6 text-forest-700">{state.latest.output.summary}</p><p className="mt-4 flex items-center gap-2 text-[10px] text-forest-500"><Clock3 className="h-3.5 w-3.5"/>Generated {formatTime(state.latest.generatedAt)} · {state.latest.model}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-200">Evidence ledger</p><div className="mt-3 grid max-h-52 gap-2 overflow-y-auto pr-1">{state.latest.evidence.map((item) => <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-white/10 bg-black/10 p-3"><span className="font-mono text-[10px] font-bold text-amber-200">{item.id}</span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-sand-300">{item.label}</p><p className="mt-1 break-words text-xs leading-5 text-white">{item.value}</p></div></div>)}</div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 text-forest-900"><div className="flex items-center gap-2"><SearchCheck className="h-5 w-5 text-amber-600"/><h4 className="font-semibold">Likely causes to test</h4></div><div className="mt-4 space-y-3">{state.latest.output.likelyCauses.length ? state.latest.output.likelyCauses.map((cause, index) => <div key={`${cause.cause}-${index}`} className="rounded-xl border border-sand-200 p-3"><div className="flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sand-100 text-[10px] font-bold">{index + 1}</span><p className="flex-1 text-sm leading-5">{cause.cause}</p><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${confidenceStyle(cause.confidence)}`}>{cause.confidence}</span></div><div className="mt-2 pl-9"><EvidenceReferences references={cause.evidenceRefs} evidence={evidence}/></div></div>) : <p className="text-sm text-forest-500">The available evidence does not support a likely cause yet.</p>}</div></div>
        <div className="rounded-2xl bg-white p-5 text-forest-900"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-leaf-700"/><h4 className="font-semibold">Investigation checklist</h4></div><ol className="mt-4 space-y-3">{[...state.latest.output.recommendedSteps].sort((a, b) => a.order - b.order).map((step) => <li key={`${step.order}-${step.title}`} className="grid grid-cols-[auto_1fr] gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-forest-900 text-xs font-bold text-white">{step.order}</span><div><p className="text-sm font-semibold">{step.title}</p><p className="mt-1 text-xs leading-5 text-forest-600">{step.instruction}</p><div className="mt-2"><EvidenceReferences references={step.evidenceRefs} evidence={evidence}/></div></div></li>)}</ol></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GuidanceList title="Evidence still needed" items={state.latest.output.missingEvidence} empty="No additional evidence was identified." tone="amber"/>
        <div className="rounded-2xl border border-sky-300/30 bg-sky-950/30 p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-200"/><h4 className="font-semibold">Worth checking</h4></div><p className="mt-1 text-[10px] leading-4 text-sky-100/70">Unconfirmed leads—not official findings.</p><div className="mt-3 space-y-3">{state.latest.output.worthChecking.length ? state.latest.output.worthChecking.map((item, index) => <div key={`${item.concern}-${index}`} className="rounded-xl border border-sky-200/15 bg-white/5 p-3"><p className="text-sm font-semibold">{item.concern}</p><p className="mt-1 text-xs leading-5 text-sky-50/75">{item.reason}</p><p className="mt-2 text-xs leading-5"><strong>Verify:</strong> {item.howToVerify}</p><div className="mt-2"><EvidenceReferences references={item.evidenceRefs} evidence={evidence}/></div></div>) : <p className="text-xs text-sky-100/70">No additional concern was supported by this evidence.</p>}</div></div>
        <GuidanceList title="Limits of this analysis" items={state.latest.output.limitations} empty="No limitations were returned." tone="sand"/>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center"><p className="mr-auto text-xs leading-5 text-sand-100/70">Correct the original source record, then use <strong className="text-white">Check again</strong>. AI cannot close this check.</p><button disabled={generating} onClick={() => void generate(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-xs font-semibold hover:bg-white/10 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`}/>{generating ? "Refreshing…" : state.latest.stale ? "Analyze changed evidence" : "Refresh analysis"}</button></div>
      {state.history.filter((item) => item.id !== state.latest?.id).length ? <details className="rounded-xl border border-white/10 bg-white/5"><summary className="cursor-pointer px-4 py-3 text-xs font-semibold">Previous analysis snapshots ({state.history.filter((item) => item.id !== state.latest?.id).length})</summary><div className="border-t border-white/10 px-4 py-3"><ul className="space-y-2 text-xs text-sand-100/70">{state.history.filter((item) => item.id !== state.latest?.id).map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2"><span>{formatTime(item.generatedAt)} · {item.model}</span><span className="flex items-center gap-3"><span>{item.status === "failed" ? "Generation failed" : item.stale ? "Superseded evidence" : "Same evidence"}</span>{item.output ? <button onClick={() => setState((current) => current ? { ...current, latest: item } : current)} className="font-semibold text-amber-200 underline underline-offset-4">View snapshot</button> : null}</span></li>)}</ul></div></details> : null}
    </div> : null}
  </section>;
}

function GuidanceList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "amber" | "sand" }) {
  const styles = tone === "amber" ? "border-amber-300/30 bg-amber-950/20" : "border-white/10 bg-white/5";
  return <div className={`rounded-2xl border p-5 ${styles}`}><h4 className="font-semibold">{title}</h4>{items.length ? <ul className="mt-3 space-y-2 text-xs leading-5 text-sand-100/80">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300"/>{item}</li>)}</ul> : <p className="mt-3 text-xs text-sand-100/60">{empty}</p>}</div>;
}
