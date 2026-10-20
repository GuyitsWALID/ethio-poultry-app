"use client";

import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useEffect, useRef, useState} from "react";
import {useSavedReportText} from "@/components/reports/use-saved-report-text";
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
  const {copy, date, locale} = useSavedReportText();
  const router = useRouter(), pathname = usePathname(), search = useSearchParams();
  const selected = search.get("saved_report") ?? search.get("report_id") ?? "";
  const [loaded, setLoaded] = useState({...page, source: page}), [moreBusy, setMoreBusy] = useState(false), [moreError, setMoreError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{id: string; locale: string; page: SavedReportPage; attempt: number; data?: Detail; error?: string} | null>(null);
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
    void read<Detail>(`/api/reports/management/${encodeURIComponent(selected)}?locale=${locale}`, controller.signal)
      .then(data => {if (!controller.signal.aborted) setDetail({id: selected, locale, page, attempt: retry, data});})
      .catch(() => {if (!controller.signal.aborted) setDetail({id: selected, locale, page, attempt: retry, error: copy.requestFailed});});
    return () => controller.abort();
  }, [selected, validSelection, retry, page, copy.requestFailed, locale]);
  const select = (id: string) => {
    const params = new URLSearchParams(search.toString());
    params.delete("report_id");
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
        setMoreError(copy.requestFailed);
      }
    } finally {if (!controller.signal.aborted) setMoreBusy(false);}
  };
  const showDetail = () => {
    const current = !validSelection ? {error: copy.unavailable, data: undefined}
      : detail?.id === selected && detail.locale === locale && detail.page === page && detail.attempt === retry ? detail : null;
    return <div className="mt-3 border-t border-sand-200 pt-3" role="region" aria-label={copy.details} aria-live="polite">
      {!current || (!current.data && !current.error) ? <p role="status">{copy.loadingDetail}</p> : current.error ? <div role="alert"><p>{current.error}</p><button className={button} onClick={() => setRetry(value => value + 1)}>{copy.retry}</button></div> : current.data ? <>
        <h4 className="font-semibold">{current.data.report_name}</h4>
        <p className="my-2 text-xs text-forest-600">{copy.frozen} · {date(current.data.period_from)} – {date(current.data.period_to)}</p>
        {current.data.status === "completed" && current.data.html ? <>
          <iframe title={copy.preview} sandbox="" srcDoc={current.data.html} className="h-[700px] w-full rounded-lg border border-sand-200 bg-white" />
          <div className="mt-3 flex flex-wrap gap-2"><a className={button} href={`/api/reports/management/${current.data.id}/download?format=html&locale=${locale}`}>{copy.download}</a><a className={button} href={`/api/reports/management/${current.data.id}/download?format=csv&locale=${locale}`}>CSV</a></div>
        </> : <p role="status">{copy.notCreated}</p>}
      </> : null}
    </div>;
  };
  return <div className="p-5">
    <h3 className="font-semibold text-forest-900">{copy.history}</h3>
    <p className="mt-1 text-xs text-forest-500">{copy.frozenNote}</p>
    {selected && !loaded.runs.some(row => row.id === selected) ? <div className="mt-4 rounded-xl border border-sand-200 p-3">{showDetail()}<button className={`${button} mt-2`} onClick={() => select(selected)}>{copy.close}</button></div> : null}
    <div className="mt-4 space-y-2">{loaded.runs.map(run => <article key={run.id} className="rounded-xl border border-sand-200 p-3">
      <h4 className="font-semibold text-forest-900">{run.report_name}</h4>
      <p className="mt-1 text-xs text-forest-600">{date(run.period_from)} – {date(run.period_to)} · {run.status === "completed" ? copy.completed : copy.failed}</p>
      <button type="button" aria-expanded={selected === run.id} className={`${button} mt-2`} onClick={() => select(run.id)}>{selected === run.id ? copy.hide : copy.view}</button>
      {selected === run.id ? showDetail() : null}
    </article>)}</div>
    {!loaded.runs.length && !moreError ? <p className="mt-4 text-sm text-forest-500">{copy.none}</p> : null}
    {moreError ? <p role="alert" className="mt-3 text-sm text-ember-700">{moreError}</p> : null}
    {loaded.nextCursor ? <button type="button" className={`${button} mt-4`} disabled={moreBusy} onClick={() => void loadMore()}>{moreBusy ? copy.loadingMore : moreError ? copy.retryMore : copy.more}</button> : null}
    <p role="status" className="mt-2 text-xs text-forest-500">{copy.loaded.replace("{count}", String(loaded.runs.length))}</p>
  </div>;
}
