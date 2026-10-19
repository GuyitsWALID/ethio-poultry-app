"use client";

import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useEffect, useRef, useState} from "react";
import type {SavedReportPage, SavedReportSummary} from "@/lib/saved-report-page";

type Detail = SavedReportSummary & {report_version: string; html: string | null};
const button = "inline-flex min-h-12 items-center justify-center rounded-lg border border-sand-300 px-3 text-sm font-semibold text-forest-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 disabled:opacity-50";
class ReportReadError extends Error {constructor(message: string, readonly status: number) {super(message);}}
async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {cache: "no-store", signal});
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new ReportReadError(body?.error ?? "Saved reports could not be loaded. Try again.", response.status);
  return body as T;
}

export function SavedReportHistory({page}: {page: SavedReportPage}) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const selected = search.get("saved_report") ?? "";
  const [loaded, setLoaded] = useState({...page, source: page}), [moreBusy, setMoreBusy] = useState(false), [moreError, setMoreError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{id: string; page: SavedReportPage; attempt: number; data?: Detail; error?: string} | null>(null);
  const [retry, setRetry] = useState(0);
  const more = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  if (loaded.source !== page) {
    setLoaded({...page, source: page}); setMoreBusy(false); setMoreError(null);
  }
  useEffect(() => {
    more.current?.abort();
    return () => more.current?.abort();
  }, [page]);
  const validSelection = /^[0-9a-f-]{36}$/i.test(selected);
  useEffect(() => {
    if (!selected || !validSelection) return;
    const controller = new AbortController();
    detailRequest.current = controller;
    void read<Detail>(`/api/reports/management/${encodeURIComponent(selected)}`, controller.signal)
      .then(data => {if (!controller.signal.aborted) setDetail({id: selected, page, attempt: retry, data});})
      .catch(error => {if (!controller.signal.aborted) setDetail({id: selected, page, attempt: retry, error: error instanceof Error ? error.message : "Could not load this saved report."});});
    return () => controller.abort();
  }, [selected, validSelection, retry, page]);
  const select = (id: string) => {
    const params = new URLSearchParams(search.toString());
    if (selected === id) params.delete("saved_report"); else params.set("saved_report", id);
    router.push(`${pathname}?${params}`, {scroll: false});
  };
  const loadMore = async () => {
    if (!loaded.nextCursor || moreBusy) return;
    const controller = new AbortController(); more.current = controller;
    setMoreBusy(true); setMoreError(null);
    try {
      const next = await read<SavedReportPage>(`/api/reports/management?cursor=${encodeURIComponent(loaded.nextCursor)}`, controller.signal);
      if (!controller.signal.aborted) {
        setLoaded(current => current.source !== page ? current : ({...current, runs: [...current.runs, ...next.runs.filter(row => !current.runs.some(old => old.id === row.id))], nextCursor: next.nextCursor}));
        setRetry(value => value + 1);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (error instanceof ReportReadError && [401, 403].includes(error.status)) {detailRequest.current?.abort(); setLoaded({source: page, runs: [], nextCursor: null}); setDetail(null);}
        setMoreError(error instanceof Error ? error.message : "Could not load more saved reports.");
      }
    } finally {if (!controller.signal.aborted) setMoreBusy(false);}
  };
  const showDetail = () => {
    const current = !validSelection ? {error: "This saved report is unavailable or you no longer have access.", data: undefined}
      : detail?.id === selected && detail.page === page && detail.attempt === retry ? detail : null;
    return <div className="mt-3 border-t border-sand-200 pt-3" role="region" aria-label="Saved report details" aria-live="polite">
      {!current || (!current.data && !current.error) ? <p role="status">Loading saved report…</p> : current.error ? <div role="alert"><p>{current.error}</p><button className={button} onClick={() => setRetry(value => value + 1)}>Retry report</button></div> : current.data ? <>
        <h4 className="font-semibold">{current.data.report_name}</h4>
        <p className="my-2 text-xs text-forest-600">Frozen report · {current.data.period_from} – {current.data.period_to} · {current.data.report_version}</p>
        {current.data.status === "completed" && current.data.html ? <>
          <iframe title="Frozen saved report preview" sandbox="" srcDoc={current.data.html} className="h-[700px] w-full rounded-lg border border-sand-200 bg-white" />
          <div className="mt-3 flex flex-wrap gap-2"><a className={button} href={`/api/reports/management/${current.data.id}/download?format=html`}>Download report</a><a className={button} href={`/api/reports/management/${current.data.id}/download?format=csv`}>CSV</a></div>
        </> : <p role="status">Report was not created. {current.data.failure_message}</p>}
      </> : null}
    </div>;
  };
  return <div className="p-5">
    <h3 className="font-semibold text-forest-900">Saved report history</h3>
    <p className="mt-1 text-xs text-forest-500">Inspect frozen reports here. Failed attempts remain visible; these are not live results.</p>
    {selected && !loaded.runs.some(row => row.id === selected) ? <div className="mt-4 rounded-xl border border-sand-200 p-3">{showDetail()}<button className={`${button} mt-2`} onClick={() => select(selected)}>Close report</button></div> : null}
    <div className="mt-4 space-y-2">{loaded.runs.map(run => <article key={run.id} className="rounded-xl border border-sand-200 p-3">
      <h4 className="font-semibold text-forest-900">{run.report_name}</h4>
      <p className="mt-1 text-xs text-forest-600">{run.period_from} – {run.period_to} · {run.status === "completed" ? "Completed" : "Failed"}</p>
      <button type="button" aria-expanded={selected === run.id} className={`${button} mt-2`} onClick={() => select(run.id)}>{selected === run.id ? "Hide report" : "View report"}</button>
      {selected === run.id ? showDetail() : null}
    </article>)}</div>
    {!loaded.runs.length && !moreError ? <p className="mt-4 text-sm text-forest-500">No saved reports are available.</p> : null}
    {moreError ? <p role="alert" className="mt-3 text-sm text-ember-700">{moreError}</p> : null}
    {loaded.nextCursor ? <button type="button" className={`${button} mt-4`} disabled={moreBusy} onClick={() => void loadMore()}>{moreBusy ? "Loading reports…" : moreError ? "Retry loading reports" : "Load more reports"}</button> : null}
    <p role="status" className="mt-2 text-xs text-forest-500">{loaded.runs.length} reports loaded</p>
  </div>;
}
