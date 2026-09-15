"use client";

import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { ReconciliationResolution } from "@/lib/reconciliation-resolution-contract";

export function RecordCheckCorrectionBanner() {
  const [findingId, setFindingId] = useState("");
  const [resolution, setResolution] = useState<ReconciliationResolution | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // URL search state is a browser input, synchronized once after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFindingId(new URLSearchParams(window.location.search).get("finding") ?? "");
  }, []);
  useEffect(() => {
    if (!findingId) return;
    const controller = new AbortController();
    void fetch(`/api/reconciliation/findings/${findingId}/resolution`, { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Could not load this Record Check."); return body; })
      .then(body => { setResolution(body); window.setTimeout(() => document.getElementById("record-check-correction")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); })
      .catch(value => { if (!(value instanceof DOMException && value.name === "AbortError")) setError(value instanceof Error ? value.message : "Could not load this Record Check."); });
    return () => controller.abort();
  }, [findingId]);

  if (!findingId) return null;
  if (!resolution && !error) return <div className="flex min-h-20 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 text-sm text-forest-700"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading the exact Record Check…</div>;
  if (error) return <div role="alert" className="rounded-2xl border border-ember-300 bg-ember-50 p-4 text-sm text-ember-800"><strong>Record Check context could not load.</strong> {error}</div>;
  if (!resolution) return null;
  return <section id="record-check-correction" data-focus-fields={resolution.correction.focusFields.join(",")} className="overflow-hidden rounded-2xl border-2 border-amber-400 bg-white shadow-sm ring-4 ring-amber-100" aria-labelledby="record-check-correction-title">
    <div className="grid gap-5 bg-amber-50 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-amber-800"><AlertTriangle className="h-4 w-4"/>Record Check correction</p><h2 id="record-check-correction-title" className="mt-2 font-display text-2xl font-semibold text-forest-950">{resolution.title}</h2><p className="mt-2 text-sm leading-6 text-forest-700">{resolution.problem}</p><p className="mt-2 text-xs font-semibold text-forest-700">{resolution.scopeLabel}</p></div>
      <div className="grid min-w-[280px] grid-cols-3 overflow-hidden rounded-xl border border-sand-200 bg-white text-center"><Proof label="Should be" value={resolution.comparison.expected}/><Proof label="Recorded" value={resolution.comparison.recorded}/><Proof label="Difference" value={resolution.comparison.difference}/></div>
    </div>
    <div className="p-5"><p className="text-sm font-semibold text-forest-950">What to fix here</p><p className="mt-1 text-sm leading-6 text-forest-700">{resolution.correction.instruction}</p>{resolution.sourceRecords.length ? <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">Exact records used by this check</p><div className="mt-2 grid gap-3 lg:grid-cols-2">{resolution.sourceRecords.map((record, index) => <article key={`${record.label}-${index}`} className="rounded-xl border border-sand-200 bg-sand-50 p-4"><h3 className="text-sm font-semibold text-forest-950">{record.label}</h3><dl className="mt-3 grid grid-cols-2 gap-2">{record.fields.map(field => <div key={field.label}><dt className="text-[9px] font-semibold uppercase tracking-wider text-forest-500">{field.label}</dt><dd className="mt-0.5 text-xs text-forest-900">{field.value}</dd></div>)}</dl></article>)}</div></div> : null}{resolution.choices.length ? <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider text-forest-500">Which record is incorrect?</p><div className="mt-2 grid gap-2 md:grid-cols-2">{resolution.choices.map(choice => <Link key={choice.id} href={choice.href} className="rounded-xl border border-sand-300 p-4 hover:border-forest-700 hover:bg-sand-50"><strong className="text-sm text-forest-950">{choice.label}</strong><span className="mt-1 block text-xs leading-5 text-forest-600">{choice.explanation}</span></Link>)}</div></div> : null}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200 pt-4"><p className="text-xs text-forest-600">After correcting the highlighted source, return and run <strong>Check again</strong>.</p><Link href={`/app/reconciliation?finding=${encodeURIComponent(findingId)}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-forest-900 px-4 text-xs font-semibold text-white"><ArrowLeft className="h-3.5 w-3.5"/>Return to this Record Check</Link></div></div>
  </section>;
}

function Proof({ label, value }: { label: string; value: string }) { return <div className="border-r border-sand-200 p-3 last:border-r-0"><span className="block text-[9px] font-semibold uppercase tracking-wider text-forest-500">{label}</span><strong className="mt-1 block break-words text-xs text-forest-950">{value}</strong></div>; }
