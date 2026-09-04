/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, Download, FileClock, Loader2, Pause, Play, Plus, RefreshCw } from "lucide-react";

type Scope = { branchId?: string; farmId?: string; houseId?: string; flockId?: string; batchId?: string };
type Recipient = { id: string; full_name: string; role: string };
type Schedule = { id: string; name: string; cadence: "weekly" | "monthly"; run_day: number; run_hour: number; lookback_days: number; is_active: boolean; next_run_at: string; recipient_ids: string[] };
type Run = { id: string; report_name: string; period_from: string; period_to: string; status: "completed" | "failed"; failure_message: string | null; generated_at: string | null; created_at: string };
type Center = { currentUserId: string; capabilities: { canSchedule: boolean; canGenerate: boolean }; schedules: Schedule[]; runs: Run[]; recipients: Recipient[] };

function timestamp(value: string | null) {
  if (!value) return "Not generated";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Addis_Ababa" }).format(new Date(value));
}

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options); const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "The report request failed."); return body;
}

export function ManagementReportCenter({ scope, dateFrom, dateTo, scopeLabel }: { scope: Scope; dateFrom: string; dateTo: string; scopeLabel: string }) {
  const [center, setCenter] = useState<Center | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null); const [showSchedule, setShowSchedule] = useState(false);
  const [name, setName] = useState("Weekly management brief"); const [cadence, setCadence] = useState<"weekly" | "monthly">("weekly"); const [runDay, setRunDay] = useState(1); const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const cleanScope = useMemo(() => Object.fromEntries(Object.entries(scope).filter(([, value]) => Boolean(value))) as Scope, [scope]);
  const shareRecipients = useMemo(() => center?.recipients.filter((recipient) => recipient.id !== center.currentUserId) ?? [], [center]);
  const load = useCallback(async () => { try { setCenter(await requestJson("/api/reports/management")); setError(null); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load saved reports."); } }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, body: unknown) => {
    setBusy(key); setError(null);
    try { await requestJson("/api/reports/management", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); await load(); }
    catch (caught) {
      const message = caught instanceof Error ? caught.message : "The report request failed.";
      await load();
      setError(message);
    }
    finally { setBusy(null); }
  };
  const generate = () => act("generate", { action: "run_now", report: { name: `${scopeLabel} management brief`, scope: cleanScope, periodFrom: dateFrom, periodTo: dateTo, recipientIds } });
  const createSchedule = async () => {
    await act("schedule", { action: "create_schedule", schedule: { name, cadence, runDay, runHour: 7, lookbackDays: cadence === "weekly" ? 7 : 30, scope: cleanScope, recipientIds } });
    setShowSchedule(false);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm" aria-labelledby="saved-reports-heading">
      <div className="flex flex-col gap-4 border-b border-sand-200 bg-forest-900 p-5 text-white lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-amber-300">Management reporting</p><h2 id="saved-reports-heading" className="mt-1 font-display text-2xl font-semibold">Downloadable reports & schedules</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-sand-100">Create a permanent management report from the current evidence and download it whenever needed. Sharing with another manager is optional.</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={generate} disabled={busy !== null || !center?.capabilities.canGenerate} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-forest-900 disabled:opacity-50">{busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileClock className="h-4 w-4" />}Create downloadable report</button>{center?.capabilities.canSchedule ? <button type="button" onClick={() => setShowSchedule((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-4 text-xs font-semibold hover:bg-white/10"><CalendarClock className="h-4 w-4" />Schedule report</button> : null}</div>
      </div>
      {error ? <div role="alert" className="border-b border-ember-500/30 bg-ember-500/10 px-5 py-3 text-sm text-ember-700">{error}</div> : null}
      {showSchedule && center?.capabilities.canSchedule ? <div className="grid gap-4 border-b border-sand-200 bg-sand-50 p-5 lg:grid-cols-[1.2fr_.8fr_.7fr_1.3fr_auto] lg:items-end">
        <label className="grid gap-1 text-xs font-semibold text-forest-700">Report name<input value={name} onChange={(event) => setName(event.target.value)} className="h-11 rounded-xl border border-sand-300 bg-white px-3 font-normal" /></label>
        <label className="grid gap-1 text-xs font-semibold text-forest-700">Frequency<select value={cadence} onChange={(event) => { const value = event.target.value as "weekly" | "monthly"; setCadence(value); setRunDay(1); }} className="h-11 rounded-xl border border-sand-300 bg-white px-3 font-normal"><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
        <label className="grid gap-1 text-xs font-semibold text-forest-700">{cadence === "weekly" ? "Run day" : "Day of month"}{cadence === "weekly" ? <select value={runDay} onChange={(event) => setRunDay(Number(event.target.value))} className="h-11 rounded-xl border border-sand-300 bg-white px-3 font-normal"><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option><option value={6}>Saturday</option><option value={7}>Sunday</option></select> : <input type="number" min={1} max={28} value={runDay} onChange={(event) => setRunDay(Number(event.target.value))} className="h-11 rounded-xl border border-sand-300 bg-white px-3 font-normal" />}</label>
        <fieldset><legend className="text-xs font-semibold text-forest-700">Optional in-app sharing</legend><div className="mt-1 flex min-h-11 flex-wrap items-center gap-3 rounded-xl border border-sand-300 bg-white px-3">{shareRecipients.length ? shareRecipients.map((recipient) => <label key={recipient.id} className="inline-flex items-center gap-1.5 text-xs text-forest-700"><input type="checkbox" checked={recipientIds.includes(recipient.id)} onChange={(event) => setRecipientIds((current) => event.target.checked ? [...current, recipient.id] : current.filter((id) => id !== recipient.id))} />{recipient.full_name}</label>) : <span className="text-xs text-forest-500">No other eligible managers in this scope.</span>}</div><p className="mt-1 text-[11px] text-forest-500">You already have access as the report creator.</p></fieldset>
        <button type="button" onClick={() => void createSchedule()} disabled={busy !== null || name.trim().length < 3} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-xs font-semibold text-white disabled:opacity-50"><Plus className="h-4 w-4" />Save schedule</button>
      </div> : null}
      <div className="grid lg:grid-cols-[.9fr_1.1fr]">
        <div className="border-b border-sand-200 p-5 lg:border-b-0 lg:border-r"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-forest-900">Automatic reports</h3><p className="mt-1 text-xs text-forest-500">Generated even when nobody has the dashboard open.</p></div><button type="button" onClick={() => void load()} aria-label="Refresh saved reports" className="rounded-lg border border-sand-200 p-2 text-forest-600"><RefreshCw className="h-4 w-4" /></button></div><div className="mt-4 space-y-2">{center?.schedules.length ? center.schedules.map((schedule) => <div key={schedule.id} className="flex items-center gap-3 rounded-xl border border-sand-200 p-3"><div className={`grid h-9 w-9 place-items-center rounded-full ${schedule.is_active ? "bg-leaf-500/15 text-leaf-600" : "bg-sand-100 text-forest-400"}`}>{schedule.is_active ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-forest-900">{schedule.name}</p><p className="mt-0.5 text-[11px] text-forest-500">{schedule.cadence} · next {timestamp(schedule.next_run_at)}</p></div>{center.capabilities.canSchedule ? <button type="button" disabled={busy !== null} onClick={() => void act(schedule.id, { action: "set_active", scheduleId: schedule.id, active: !schedule.is_active })} className="rounded-lg border border-sand-200 px-2.5 py-1.5 text-[11px] font-semibold text-forest-700">{schedule.is_active ? "Pause" : "Resume"}</button> : null}</div>) : <div className="rounded-xl border border-dashed border-sand-300 p-5 text-center text-xs text-forest-500">No automatic report schedule is visible in your scope.</div>}</div></div>
        <div className="p-5"><h3 className="font-semibold text-forest-900">Saved report history</h3><p className="mt-1 text-xs text-forest-500">Completed reports remain downloadable. Failed attempts are retained so the problem is visible and auditable.</p><div className="mt-4 space-y-2">{center?.runs.length ? center.runs.map((run) => <div key={run.id} className="flex flex-col gap-3 rounded-xl border border-sand-200 p-3 sm:flex-row sm:items-center"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${run.status === "completed" ? "bg-leaf-500/15 text-leaf-600" : "bg-ember-500/10 text-ember-600"}`}>{run.status === "completed" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-forest-900">{run.report_name}</p><p className="mt-0.5 text-[11px] text-forest-500">{run.period_from} – {run.period_to} · {timestamp(run.generated_at ?? run.created_at)}</p>{run.failure_message ? <p className="mt-1 text-[11px] text-ember-600"><strong>Report was not created.</strong> {run.failure_message}</p> : null}</div>{run.status === "completed" ? <div className="flex gap-2"><a href={`/api/reports/management/${run.id}/download?format=html`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-forest-900 px-3 text-[11px] font-semibold text-white"><Download className="h-3.5 w-3.5" />Download report</a><a href={`/api/reports/management/${run.id}/download?format=csv`} className="inline-flex min-h-9 items-center rounded-lg border border-sand-300 px-3 text-[11px] font-semibold text-forest-700">CSV</a></div> : null}</div>) : <div className="rounded-xl border border-dashed border-sand-300 p-5 text-center text-xs text-forest-500">Create the first downloadable management report for this reporting period.</div>}</div></div>
      </div>
    </section>
  );
}
