"use client";

import { Activity, CalendarClock, CheckCircle2, Database, HardDriveDownload, RefreshCw, ServerCog, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type HealthState = "healthy" | "degraded" | "failed" | "not_configured";
type HealthSignal = { state: HealthState; label: string; detail: string; observedAt: string | null; durationMs: number | null };
type SystemHealth = {
  generatedAt: string;
  environment: string;
  release: string;
  application: HealthSignal;
  database: HealthSignal;
  backup: HealthSignal;
  recovery: HealthSignal;
  scheduler: HealthSignal;
};

const stateStyle: Record<HealthState, { dot: string; badge: string; label: string }> = {
  healthy: { dot: "bg-emerald-500", badge: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "Healthy" },
  degraded: { dot: "bg-amber-500", badge: "border-amber-200 bg-amber-50 text-amber-900", label: "Attention" },
  failed: { dot: "bg-red-500", badge: "border-red-200 bg-red-50 text-red-800", label: "Failed" },
  not_configured: { dot: "bg-slate-400", badge: "border-slate-200 bg-slate-50 text-slate-700", label: "Not verified" },
};

function observedLabel(value: string | null) {
  if (!value) return "No evidence recorded";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function SystemHealthPanel() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/system-health", { cache: "no-store", credentials: "include" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setError(payload?.error ?? "System health could not be loaded.");
      setLoading(false);
      return;
    }
    setHealth(await response.json() as SystemHealth);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial remote health synchronization
    void load();
  }, [load]);

  const signals = health ? [
    { key: "application", title: "Application", subtitle: "Public probe and error capture", icon: Activity, signal: health.application },
    { key: "database", title: "Database", subtitle: "Live privileged round trip", icon: Database, signal: health.database },
    { key: "scheduler", title: "Daily locks", subtitle: "Operating-day automation", icon: CalendarClock, signal: health.scheduler },
    { key: "backup", title: "Backups", subtitle: "Supabase provider evidence", icon: HardDriveDownload, signal: health.backup },
    { key: "recovery", title: "Recovery", subtitle: "Isolated restore drill", icon: ServerCog, signal: health.recovery },
  ] : [];
  const needsAction = signals.filter((item) => item.signal.state !== "healthy").length;

  return (
    <section aria-labelledby="system-health-title" className="overflow-hidden rounded-2xl border border-forest-800 bg-white shadow-sm">
      <div className="flex flex-col gap-5 bg-forest-950 px-6 py-6 text-white md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-moss-300">Operational heartbeat</p>
          <h2 id="system-health-title" className="mt-2 text-2xl font-semibold">System health</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-sand-200">
            Live connectivity plus retained proof that monitoring, backups, and recovery are actually working.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {health ? <div className="text-right text-xs text-sand-300"><p className="font-semibold uppercase tracking-wider text-sand-100">{health.environment}</p><p>Release {health.release.slice(0, 12)}</p></div> : null}
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh health
          </button>
        </div>
      </div>

      {error ? <div role="alert" className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-6 py-4 text-sm text-red-800"><TriangleAlert className="h-5 w-5" />{error}</div> : null}

      {loading && !health ? (
        <div className="grid gap-px bg-sand-200 sm:grid-cols-2 xl:grid-cols-5" aria-label="Loading system health">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-48 animate-pulse bg-sand-50" />)}
        </div>
      ) : (
        <div className="grid gap-px bg-sand-200 sm:grid-cols-2 xl:grid-cols-5">
          {signals.map(({ key, title, subtitle, icon: Icon, signal }) => {
            const style = stateStyle[signal.state];
            return <article key={key} className="relative min-h-52 bg-white p-5">
              <span className={`absolute inset-x-0 top-0 h-1 ${style.dot}`} />
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-xl bg-sand-50 p-2.5 text-forest-800"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}>{style.label}</span>
              </div>
              <h3 className="mt-4 font-semibold text-forest-950">{title}</h3>
              <p className="mt-1 text-xs text-forest-500">{subtitle}</p>
              <p className="mt-4 text-sm font-semibold text-forest-900">{signal.label}</p>
              <p className="mt-1 text-xs leading-5 text-forest-600">{signal.detail}</p>
              <p className="mt-4 border-t border-sand-100 pt-3 text-[11px] text-forest-500">{observedLabel(signal.observedAt)}{signal.durationMs !== null ? ` · ${signal.durationMs} ms` : ""}</p>
            </article>;
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-sand-200 bg-sand-50 px-6 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 font-semibold text-forest-900">
          {needsAction === 0 && health ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <TriangleAlert className="h-4 w-4 text-amber-600" />}
          {health ? (needsAction === 0 ? "All five controls have current evidence." : `${needsAction} control${needsAction === 1 ? "" : "s"} need verification or attention.`) : "Waiting for system evidence."}
        </p>
        <p className="text-xs text-forest-500">Server errors remain searchable in Cloudflare Workers Logs.</p>
      </div>
    </section>
  );
}
