"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CurrentAlert = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  source: "Alert Rule" | "Inventory" | "Mortality" | "Daily Records" | "Health" | "Production";
  context: string;
  route: string;
  createdAt: string;
};

const severityClass: Record<CurrentAlert["severity"], string> = {
  high: "border-ember-500/30 bg-ember-500/10 text-ember-700",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-800",
  low: "border-leaf-500/30 bg-leaf-500/10 text-leaf-700",
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<CurrentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<"all" | CurrentAlert["severity"]>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | CurrentAlert["source"]>("all");

  useEffect(() => {
    const loadAlerts = async () => {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/alerts/header", { method: "GET" });
      if (!response.ok) {
        setError("Could not load current alerts.");
        setLoading(false);
        return;
      }
      const data = await response.json();
      setAlerts((data?.alerts ?? []) as CurrentAlert[]);
      setLoading(false);
    };

    void loadAlerts().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load current alerts.");
      setLoading(false);
    });
  }, []);

  const sources = useMemo(
    () => Array.from(new Set(alerts.map((alert) => alert.source))).sort(),
    [alerts]
  );

  const filteredAlerts = alerts.filter((alert) => {
    if (severityFilter !== "all" && alert.severity !== severityFilter) return false;
    if (sourceFilter !== "all" && alert.source !== sourceFilter) return false;
    return true;
  });

  const counts = {
    high: alerts.filter((alert) => alert.severity === "high").length,
    medium: alerts.filter((alert) => alert.severity === "medium").length,
    low: alerts.filter((alert) => alert.severity === "low").length,
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Alerts</p>
          <h2 className="text-2xl font-semibold text-forest-900">Operational Alerts Console</h2>
          <p className="mt-2 text-sm text-forest-600">
            Current inventory, mortality, health schedule, KPI, and daily-record alerts.
          </p>
        </div>
        <Link href="/app" className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700">
          Back to dashboard
        </Link>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {(["high", "medium", "low"] as const).map((severity) => (
          <button
            key={severity}
            type="button"
            onClick={() => setSeverityFilter((prev) => (prev === severity ? "all" : severity))}
            className={`rounded-xl border p-4 text-left transition ${severityClass[severity]} ${
              severityFilter === severity ? "ring-2 ring-forest-900/20" : ""
            }`}
          >
            <p className="text-xs uppercase tracking-[0.18em]">{severity}</p>
            <p className="mt-2 text-3xl font-semibold">{counts[severity]}</p>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-forest-900">Current Alerts</h3>
            <p className="text-sm text-forest-600">
              {loading ? "Refreshing alert sources..." : `${filteredAlerts.length} of ${alerts.length} alert(s) shown`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)}
              className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
            >
              <option value="all">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}
              className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
            >
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-sand-100">
          {loading ? (
            <p className="p-4 text-sm text-forest-600">Loading alerts...</p>
          ) : filteredAlerts.length === 0 ? (
            <p className="p-4 text-sm text-forest-600">No current alerts match these filters.</p>
          ) : (
            <div className="divide-y divide-sand-100">
              {filteredAlerts.map((alert) => (
                <article key={alert.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${severityClass[alert.severity]}`}>
                        {alert.severity}
                      </span>
                      <span className="rounded-full bg-sand-100 px-2.5 py-1 text-xs text-forest-700">
                        {alert.source}
                      </span>
                      <span className="text-xs text-forest-500">{formatTimestamp(alert.createdAt)}</span>
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-forest-900">{alert.title}</h4>
                    <p className="mt-1 text-sm text-forest-600">{alert.context}</p>
                  </div>
                  <Link
                    href={alert.route}
                    className="self-center rounded-full bg-forest-900 px-4 py-2 text-center text-sm text-sand-50"
                  >
                    Open source
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
