/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { Activity, CalendarClock, CheckCircle2, Database, HardDriveDownload, RefreshCw, ServerCog, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type HealthState = "healthy" | "degraded" | "failed" | "not_configured";
type HealthSignal = { state: HealthState; label: string; detail: string; observedAt: string | null; durationMs: number | null };
type SystemHealth = { generatedAt: string; environment: string; release: string; application: HealthSignal; database: HealthSignal; backup: HealthSignal; recovery: HealthSignal; scheduler: HealthSignal };

const presentation: Record<HealthState, { dot: string; badge: string; label: string }> = {
  healthy: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800", label: "Current" },
  degraded: { dot: "bg-[#E7A92F]", badge: "bg-amber-50 text-amber-900", label: "Attention" },
  failed: { dot: "bg-[#D95C45]", badge: "bg-red-50 text-red-800", label: "Failed" },
  not_configured: { dot: "bg-slate-400", badge: "bg-slate-100 text-slate-700", label: "Not verified" },
};

function observedLabel(value: string | null) { if (!value) return "No evidence retained"; return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Addis_Ababa" }).format(new Date(value)); }

export function SystemHealthPanel() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const response = await fetch("/api/admin/system-health", { cache: "no-store", credentials: "include" }); const body = await response.json().catch(() => null) as (SystemHealth & { error?: string }) | null; if (!response.ok) throw new Error(body?.error ?? "System health could not be loaded."); setHealth(body as SystemHealth); } catch (value) { setError(value instanceof Error ? value.message : "System health could not be loaded."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);

  const signals = health ? [
    { key: "application", title: "Application", short: "Public runtime", icon: Activity, signal: health.application },
    { key: "database", title: "Database", short: "Privileged round trip", icon: Database, signal: health.database },
    { key: "scheduler", title: "Daily locks", short: "Operating-day automation", icon: CalendarClock, signal: health.scheduler },
    { key: "backup", title: "Backups", short: "Provider evidence", icon: HardDriveDownload, signal: health.backup },
    { key: "recovery", title: "Recovery", short: "Isolated restore drill", icon: ServerCog, signal: health.recovery },
  ] : [];
  const needsAction = signals.filter((item) => item.signal.state !== "healthy").length;

  return <section aria-labelledby="system-health-title" className="overflow-hidden rounded-2xl border border-[#D7E7DF] bg-white">
    <header className="flex flex-col gap-5 border-b border-[#D7E7DF] px-5 py-6 sm:px-7 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[9px] font-semibold uppercase tracking-[.22em] text-[#587A6B]">Infrastructure evidence</p><h2 id="system-health-title" className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-[#0B1714]">System health custody rail</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#587A6B]">Live connectivity and retained proof are shown separately, so “reachable” is never mistaken for “recoverable.”</p></div><div className="flex items-center gap-3">{health ? <div className="text-right"><p className="text-[9px] font-semibold uppercase tracking-[.16em] text-[#587A6B]">{health.environment}</p><p className="mt-1 font-mono text-[10px] text-[#79998B]">{health.release.slice(0, 12)}</p></div> : null}<button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D7E7DF] px-4 text-xs font-semibold text-[#15382E] hover:bg-[#F5F8F6] disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button></div></header>
    {error ? <div role="alert" className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-6 py-4 text-sm text-red-800"><TriangleAlert className="h-5 w-5" />{error}</div> : null}
    {loading && !health ? <div className="grid gap-px bg-[#D7E7DF] sm:grid-cols-2 xl:grid-cols-5">{[1,2,3,4,5].map((item) => <div key={item} className="h-56 animate-pulse bg-[#F5F8F6]" />)}</div> : <div className="relative grid gap-px bg-[#D7E7DF] sm:grid-cols-2 xl:grid-cols-5 before:absolute before:left-[10%] before:right-[10%] before:top-[50px] before:hidden before:h-px before:bg-[#D7E7DF] xl:before:block">{signals.map(({ key, title, short, icon: Icon, signal }) => { const style = presentation[signal.state]; return <article key={key} className="relative bg-white p-5 pt-6"><div className="relative z-10 flex items-start justify-between gap-3"><span className="grid h-12 w-12 place-items-center rounded-full border border-[#D7E7DF] bg-white text-[#15382E] shadow-[0_0_0_6px_white]"><Icon className="h-5 w-5" /></span><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] ${style.badge}`}>{style.label}</span></div><div className="mt-5 flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${style.dot}`} /><h3 className="text-sm font-semibold text-[#0B1714]">{title}</h3></div><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#79998B]">{short}</p><p className="mt-4 text-sm font-semibold leading-5 text-[#15382E]">{signal.label}</p><p className="mt-1 text-xs leading-5 text-[#587A6B]">{signal.detail}</p><p className="mt-4 border-t border-[#D7E7DF] pt-3 text-[10px] text-[#79998B]">{observedLabel(signal.observedAt)}{signal.durationMs !== null ? ` · ${signal.durationMs} ms` : ""}</p></article>; })}</div>}
    <footer className="flex flex-col gap-2 bg-[#F5F8F6] px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-7"><p className="flex items-center gap-2 font-semibold text-[#15382E]">{needsAction === 0 && health ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <TriangleAlert className="h-4 w-4 text-[#E7A92F]" />}{health ? needsAction === 0 ? "All five controls have current evidence." : `${needsAction} control${needsAction === 1 ? "" : "s"} need attention or evidence.` : "Waiting for platform evidence."}</p><p className="text-xs text-[#79998B]">Worker errors remain searchable in Cloudflare logs.</p></footer>
  </section>;
}
