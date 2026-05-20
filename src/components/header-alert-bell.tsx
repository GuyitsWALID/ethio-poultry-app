"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

type HeaderAlert = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  route: string;
  createdAt: string;
};

export function HeaderAlertBell() {
  const [alerts, setAlerts] = useState<HeaderAlert[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/alerts/header", { method: "GET" });
      if (!response.ok) return;
      const data = await response.json();
      setAlerts((data?.alerts ?? []) as HeaderAlert[]);
    };
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-full border border-sand-200 p-2 text-forest-700 hover:bg-sand-50"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Alerts"
      >
        <Bell className="h-4 w-4" />
        {alerts.length > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ember-500 px-1 text-[10px] text-white">
            {alerts.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-sand-200 bg-white shadow-lg">
          <div className="border-b border-sand-100 px-3 py-2 text-sm font-semibold text-forest-900">
            Alerts
          </div>
          <div className="max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-3 py-4 text-sm text-forest-600">No active alerts.</p>
            ) : (
              alerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.route}
                  onClick={() => setOpen(false)}
                  className="block border-b border-sand-100 px-3 py-3 hover:bg-sand-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-forest-900">{alert.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                        alert.severity === "high"
                          ? "bg-ember-500/15 text-ember-600"
                          : alert.severity === "medium"
                            ? "bg-amber-500/15 text-amber-700"
                            : "bg-leaf-500/15 text-leaf-600"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
