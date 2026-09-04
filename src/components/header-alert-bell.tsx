/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { AlertTriangle, Bell, CheckCheck, CheckCircle2, ChevronRight, RefreshCw, Settings2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { NotificationCenter, NotificationItem } from "@/lib/notification-contract";

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Current";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Addis_Ababa" }).format(date);
}

const severityStyle = {
  high: { dot: "bg-ember-500", badge: "border-ember-500/25 bg-ember-500/10 text-ember-500", label: "Urgent" },
  medium: { dot: "bg-amber-500", badge: "border-amber-500/25 bg-amber-500/10 text-amber-700", label: "Review" },
  low: { dot: "bg-sky-500", badge: "border-sky-500/25 bg-sky-500/10 text-sky-700", label: "Update" },
} as const;

export function HeaderAlertBell() {
  const [center, setCenter] = useState<NotificationCenter | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Notification request failed");
      setCenter(await response.json() as NotificationCenter);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const command = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true });
    if (response.ok) setCenter(await response.json() as NotificationCenter);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", escape); };
  }, [open]);

  const notifications = center?.notifications ?? [];
  const unreadCount = center?.unreadCount ?? 0;

  const openNotification = (notification: NotificationItem) => {
    setOpen(false);
    if (!notification.readAt) void command({ command: "mark_read", notificationId: notification.id });
  };

  return (
    <div ref={rootRef} className="relative z-[160]">
      <button type="button" className={`relative grid h-10 w-10 place-items-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-forest-500 ${open ? "border-forest-700 bg-forest-900 text-white" : "border-sand-200 bg-white text-forest-700 hover:border-forest-400 hover:bg-sand-50"}`} onClick={() => setOpen((value) => !value)} aria-label={`${unreadCount} unread notifications`} aria-expanded={open} aria-controls="header-notification-panel">
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 ? <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-ember-500 px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <section id="header-notification-panel" aria-label="Notifications" className="fixed inset-x-3 top-[70px] z-[170] max-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-[0_24px_70px_rgba(29,42,31,.22)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+12px)] sm:w-[410px]">
          <div className="border-b border-sand-200 bg-forest-900 p-4 text-white">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">Responsibility updates</p><h2 className="mt-1 font-display text-xl font-semibold">Notifications</h2><p className="mt-1 text-xs text-sand-200">Assignments, deadlines, and verified outcomes.</p></div><div className="rounded-xl border border-white/10 bg-white/[.07] px-3 py-2 text-center"><strong className="block text-lg leading-none">{unreadCount}</strong><span className="mt-1 block text-[9px] uppercase tracking-[.1em] text-sand-200">Unread</span></div></div>
            {unreadCount > 0 ? <button type="button" onClick={() => void command({ command: "mark_all_read" })} className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-sand-100"><CheckCheck className="h-3.5 w-3.5" />Mark all as read</button> : null}
          </div>

          <div className="max-h-[min(440px,calc(100vh-14rem))] overflow-y-auto overscroll-contain">
            {loading ? <div className="grid gap-3 p-4">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-sand-100" />)}</div> : error ? <div className="p-5 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-ember-500" /><p className="mt-3 text-sm font-semibold text-forest-900">Notifications could not be refreshed</p><button type="button" onClick={() => void load()} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-sand-200 px-4 text-xs font-semibold text-forest-700"><RefreshCw className="h-3.5 w-3.5" />Try again</button></div> : notifications.length === 0 ? <div className="p-7 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-leaf-500/10 text-leaf-500"><CheckCircle2 className="h-5 w-5" /></div><p className="mt-3 text-sm font-semibold text-forest-900">You are up to date</p><p className="mt-1 text-xs leading-5 text-forest-600">New responsibility updates will appear here.</p></div> : notifications.map((notification) => {
              const style = severityStyle[notification.severity];
              return <Link key={notification.id} href={notification.route} onClick={() => openNotification(notification)} className={`group flex items-start gap-3 border-b border-sand-100 px-4 py-3.5 transition last:border-0 hover:bg-sand-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-forest-500 ${notification.readAt ? "bg-white" : "bg-amber-50/35"}`}><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5 text-forest-900">{notification.title}</span><span className="mt-1 block text-xs leading-5 text-forest-600">{notification.message}</span><span className="mt-2 flex items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.08em] ${style.badge}`}>{style.label}</span><span className="text-[10px] text-forest-400">{timeLabel(notification.createdAt)}</span>{notification.readAt ? null : <span className="text-[9px] font-semibold uppercase tracking-wider text-forest-700">New</span>}</span></span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-forest-400 transition group-hover:translate-x-0.5 group-hover:text-forest-700" /></Link>;
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-sand-200 bg-sand-50 p-3"><Link href="/app/alerts" onClick={() => setOpen(false)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-forest-800 text-xs font-semibold text-forest-800 transition hover:bg-forest-900 hover:text-white">Open action desk <ChevronRight className="h-3.5 w-3.5" /></Link><Link href="/app/alerts#notification-settings" onClick={() => setOpen(false)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sand-300 bg-white text-xs font-semibold text-forest-700"><Settings2 className="h-3.5 w-3.5" />Preferences</Link></div>
        </section>
      ) : null}
    </div>
  );
}
