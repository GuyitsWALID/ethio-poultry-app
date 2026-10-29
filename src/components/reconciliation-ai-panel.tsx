"use client";

import {useLocale, useTranslations} from "next-intl";
import {formatOperationDateTime} from "@/i18n/formats";

import { AlertTriangle, BrainCircuit, CheckCircle2, ChevronDown, Clock3, RefreshCw, SearchCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { type ReconciliationAiAnalysis, type ReconciliationAiEvidenceItem } from "@/lib/reconciliation-ai-contract";

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

function confidenceStyle(value: string) {
  if (value === "high") return "bg-ember-50 text-ember-700 border-ember-200";
  if (value === "medium") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-sand-100 text-forest-600 border-sand-200";
}

function EvidenceReferences({ references, evidence }: { references: string[]; evidence: Map<string, ReconciliationAiEvidenceItem> }) {
  const ui = useTranslations("OperationUI");
  if (!references.length) return <span className="text-[10px] text-forest-400">{ui("generalGuidance")}</span>;
  return <span className="flex flex-wrap gap-1.5">{references.map((reference) => {
    const item = evidence.get(reference);
    return <span key={reference} title={item?.value} className="inline-flex rounded-full border border-leaf-300 bg-leaf-50 px-2 py-0.5 text-[10px] font-semibold text-forest-700">{reference} · {item?.label ?? ui("sourceEvidence")}</span>;
  })}</span>;
}

export function ReconciliationAiPanel({ findingId }: { findingId: string }) {
  const chartText = useTranslations("OperationCharts");
  const errors = useTranslations("AiErrors");
  const errorText = (body: unknown, fallback: string) => {
    if (body && typeof body === "object" && "code" in body && typeof body.code === "string" && errors.has((body.code) as Parameters<typeof errors>[0])) return errors((body.code) as Parameters<typeof errors>[0]);
    return readableError(body, fallback);
  };
  const ui = useTranslations("OperationUI");
  const locale = useLocale();
  const codes = useTranslations("History.codes");
  const formatTime = (value: string) => Number.isNaN(Date.parse(value)) ? ui("unavailable") : formatOperationDateTime(value, locale);
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
      if (!response.ok) throw new Error(errorText(body, ui("aiGuidanceCouldNotLoad")));
      setState(body as AiState);
    } catch (value) {
      setError(value instanceof Error ? value.message : ui("aiGuidanceCouldNotLoad"));
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
      if (!response.ok) throw new Error(errorText(body, ui("aiGuidanceCouldNotBeGenerated")));
      const analysis = (body as { analysis: ReconciliationAiAnalysis }).analysis;
      setState((current) => ({
        enabled: true,
        latest: analysis,
        history: [analysis, ...(current?.history ?? []).filter((item) => item.id !== analysis.id)],
      }));
    } catch (value) {
      setError(value instanceof Error ? value.message : ui("aiGuidanceCouldNotBeGenerated"));
    } finally {
      setGenerating(false);
    }
  };

  if (!opened) {
    return <section className="border-t border-sand-200 bg-forest-900 px-5 py-4 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><BrainCircuit className="h-5 w-5"/></span>
        <div className="mr-auto"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-200">{ui("aiInvestigationAssistant")}</p><p className="mt-1 text-sm text-sand-100/80">{ui("askForAnEvidenceGroundedExplanationAndPracticalChecksNo")}</p></div>
        <button onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-forest-900 hover:bg-sand-100"><Sparkles className="h-4 w-4"/>{ui("openAIAssistant")}</button>
      </div>
    </section>;
  }

  return <section className="border-t border-sand-200 bg-forest-900 px-5 py-5 text-white" aria-label={ui("aiInvestigationAssistant")}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><BrainCircuit className="h-5 w-5"/></span>
      <div className="mr-auto"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-200">{ui("aiInvestigationAssistant")}</p>{state?.latest?.stale ? <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-forest-950">{ui("evidenceChanged")}</span> : state?.latest ? <span className="rounded-full bg-leaf-400/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-leaf-200">{ui("currentEvidence")}</span> : null}</div><p className="mt-1 max-w-3xl text-xs leading-5 text-sand-100/70">{ui("aiGuidanceNotAnOfficialFindingOrDecisionCorrectThe")}</p></div>
      <button onClick={() => setOpened(false)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 px-3 text-xs font-semibold text-white hover:bg-white/10"><ChevronDown className="h-4 w-4"/>{ui("closeAssistant")}</button>
    </div>

    {loading ? <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-sand-100"><RefreshCw className="h-4 w-4 animate-spin"/>{ui("loadingPreservedGuidance")}</div> : null}
    {error ? <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-ember-300 bg-ember-50 p-4 text-sm text-ember-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="font-semibold">{ui("aiAnalysisDidNotComplete")}</p><p className="mt-1 leading-5">{error} {ui("theAutomaticRecordCheckRemainsAvailable")}</p></div></div> : null}
    {!loading && state && !state.enabled ? <div className="mt-5 rounded-xl border border-amber-300 bg-white p-4 text-forest-900"><p className="text-sm font-semibold">{ui("aiAnalysisIsSwitchedOffInThisEnvironment")}</p><p className="mt-1 text-xs leading-5 text-forest-600">{ui("noEvidenceWasSentToGroqAskAnAdministratorTo")}</p></div> : null}
    {!loading && state?.enabled && !state.latest ? <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 lg:grid-cols-[1fr_auto] lg:items-center"><div><p className="text-sm font-semibold">{ui("analyzeThisConfirmedRecordDifference")}</p><p className="mt-1 text-xs leading-5 text-sand-100/70">{ui("groqReceivesOnlyTheVisibleBusinessLabelsRelevantValuesDates")}</p></div><button disabled={generating} onClick={() => void generate(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-semibold text-forest-950 disabled:opacity-60">{generating ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>}{generating ? ui("analyzingEvidence") : ui("askAIToAnalyze")}</button></div> : null}

    {state?.latest?.output ? <div className="mt-5 space-y-4">
      <p className="text-xs text-sand-200">{chartText("analysisLanguage", {language: chartText((state.latest.language === "am" ? "amharic" : "english") as Parameters<typeof chartText>[0])})}</p>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl bg-white p-5 text-forest-900"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-forest-900 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white">{ui("evidence")} {codes((state.latest.output.evidenceSufficiency) as Parameters<typeof codes>[0])}</span>{state.latest.cached ? <span className="text-[10px] text-forest-500">{ui("preservedAnalysisReused")}</span> : null}</div><h4 className="mt-3 font-display text-xl font-semibold">{ui("whatTheEvidenceSuggests")}</h4><p className="mt-2 text-sm leading-6 text-forest-700">{state.latest.output.summary}</p><p className="mt-4 flex items-center gap-2 text-[10px] text-forest-500"><Clock3 className="h-3.5 w-3.5"/>{ui("generated")} {formatTime(state.latest.generatedAt)} · {state.latest.model}</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-200">{ui("evidenceLedger")}</p><div className="mt-3 grid max-h-52 gap-2 overflow-y-auto pr-1">{state.latest.evidence.map((item) => <div key={item.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-white/10 bg-black/10 p-3"><span className="font-mono text-[10px] font-bold text-amber-200">{item.id}</span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-sand-300">{item.label}</p><p className="mt-1 break-words text-xs leading-5 text-white">{item.value}</p></div></div>)}</div></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 text-forest-900"><div className="flex items-center gap-2"><SearchCheck className="h-5 w-5 text-amber-600"/><h4 className="font-semibold">{ui("likelyCausesToTest")}</h4></div><div className="mt-4 space-y-3">{state.latest.output.likelyCauses.length ? state.latest.output.likelyCauses.map((cause, index) => <div key={`${cause.cause}-${index}`} className="rounded-xl border border-sand-200 p-3"><div className="flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sand-100 text-[10px] font-bold">{index + 1}</span><p className="flex-1 text-sm leading-5">{cause.cause}</p><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${confidenceStyle(cause.confidence)}`}>{codes((cause.confidence) as Parameters<typeof codes>[0])}</span></div><div className="mt-2 pl-9"><EvidenceReferences references={cause.evidenceRefs} evidence={evidence}/></div></div>) : <p className="text-sm text-forest-500">{ui("theAvailableEvidenceDoesNotSupportALikelyCauseYet")}</p>}</div></div>
        <div className="rounded-2xl bg-white p-5 text-forest-900"><div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-leaf-700"/><h4 className="font-semibold">{ui("investigationChecklist")}</h4></div><ol className="mt-4 space-y-3">{[...state.latest.output.recommendedSteps].sort((a, b) => a.order - b.order).map((step) => <li key={`${step.order}-${step.title}`} className="grid grid-cols-[auto_1fr] gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-forest-900 text-xs font-bold text-white">{step.order}</span><div><p className="text-sm font-semibold">{step.title}</p><p className="mt-1 text-xs leading-5 text-forest-600">{step.instruction}</p><div className="mt-2"><EvidenceReferences references={step.evidenceRefs} evidence={evidence}/></div></div></li>)}</ol></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GuidanceList title={ui("evidenceStillNeeded")} items={state.latest.output.missingEvidence} empty={ui("noAdditionalEvidenceWasIdentified")} tone="amber"/>
        <div className="rounded-2xl border border-sky-300/30 bg-sky-950/30 p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-sky-200"/><h4 className="font-semibold">{ui("worthChecking")}</h4></div><p className="mt-1 text-[10px] leading-4 text-sky-100/70">{ui("unconfirmedLeadsNotOfficialFindings")}</p><div className="mt-3 space-y-3">{state.latest.output.worthChecking.length ? state.latest.output.worthChecking.map((item, index) => <div key={`${item.concern}-${index}`} className="rounded-xl border border-sky-200/15 bg-white/5 p-3"><p className="text-sm font-semibold">{item.concern}</p><p className="mt-1 text-xs leading-5 text-sky-50/75">{item.reason}</p><p className="mt-2 text-xs leading-5"><strong>{ui("verify")}</strong> {item.howToVerify}</p><div className="mt-2"><EvidenceReferences references={item.evidenceRefs} evidence={evidence}/></div></div>) : <p className="text-xs text-sky-100/70">{ui("noAdditionalConcernWasSupportedByThisEvidence")}</p>}</div></div>
        <GuidanceList title={ui("limitsOfThisAnalysis")} items={state.latest.output.limitations} empty={ui("noLimitationsWereReturned")} tone="sand"/>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center"><p className="mr-auto text-xs leading-5 text-sand-100/70">{ui("correctTheOriginalSourceRecordThenUse")} <strong className="text-white">{ui("checkAgain")}</strong>{ui("aiCannotCloseThisCheck")}</p><button disabled={generating} onClick={() => void generate(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 px-4 text-xs font-semibold hover:bg-white/10 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`}/>{generating ? ui("refreshing") : state.latest.stale ? ui("analyzeChangedEvidence") : "Refresh analysis"}</button></div>
      {state.history.filter((item) => item.id !== state.latest?.id).length ? <details className="rounded-xl border border-white/10 bg-white/5"><summary className="cursor-pointer px-4 py-3 text-xs font-semibold">{ui("previousAnalysisSnapshots")}{state.history.filter((item) => item.id !== state.latest?.id).length})</summary><div className="border-t border-white/10 px-4 py-3"><ul className="space-y-2 text-xs text-sand-100/70">{state.history.filter((item) => item.id !== state.latest?.id).map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2"><span>{formatTime(item.generatedAt)} · {item.model}</span><span className="flex items-center gap-3"><span>{item.status === "failed" ? ui("generationFailed") : item.stale ? ui("supersededEvidence") : ui("sameEvidence")}</span>{item.output ? <button onClick={() => setState((current) => current ? { ...current, latest: item } : current)} className="font-semibold text-amber-200 underline underline-offset-4">{ui("viewSnapshot")}</button> : null}</span></li>)}</ul></div></details> : null}
    </div> : null}
  </section>;
}

function GuidanceList({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: "amber" | "sand" }) {
  const styles = tone === "amber" ? "border-amber-300/30 bg-amber-950/20" : "border-white/10 bg-white/5";
  return <div className={`rounded-2xl border p-5 ${styles}`}><h4 className="font-semibold">{title}</h4>{items.length ? <ul className="mt-3 space-y-2 text-xs leading-5 text-sand-100/80">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300"/>{item}</li>)}</ul> : <p className="mt-3 text-xs text-sand-100/60">{empty}</p>}</div>;
}
