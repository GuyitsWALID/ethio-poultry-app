/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { AlertTriangle, Bell, CheckCheck, CheckCircle2, ChevronRight, Clock3, RefreshCw, Settings2 } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import type { AppLocale } from "@/i18n/locale";
import type { ActionCard, ActionStatus } from "@/lib/action-desk-contract";
import type { NotificationCenter, NotificationItem } from "@/lib/notification-contract";

function timeLabel(value: string, locale: AppLocale, currentLabel: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return currentLabel;
  return new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-ET", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Africa/Addis_Ababa" }).format(date);
}

const severityStyle = {
  high: { dot: "bg-ember-500", badge: "border-ember-500/25 bg-ember-500/10 text-ember-500", label: "severity.high" },
  medium: { dot: "bg-amber-500", badge: "border-amber-500/25 bg-amber-500/10 text-amber-700", label: "severity.medium" },
  low: { dot: "bg-sky-500", badge: "border-sky-500/25 bg-sky-500/10 text-sky-700", label: "severity.low" },
} as const;

const statusMessageKey: Record<ActionStatus, `status.${ActionStatus}`> = {
  open: "status.open", assigned: "status.assigned", acknowledged: "status.acknowledged", in_progress: "status.in_progress",
  awaiting_verification: "status.awaiting_verification", escalated: "status.escalated", resolved: "status.resolved",
};

export function HeaderAlertBell() {
  const t = useTranslations("Notifications");
  const [center, setCenter] = useState<NotificationCenter | null>(null);
  const [attention, setAttention] = useState<ActionCard[]>([]);
  const [view, setView] = useState<"attention" | "updates">("attention");
  const [open, setOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [attentionLoading, setAttentionLoading] = useState(true);
  const [notificationError, setNotificationError] = useState(false);
  const [attentionError, setAttentionError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    setNotificationError(false);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error("Notification request failed");
      setCenter(await response.json() as NotificationCenter);
    } catch { setNotificationError(true); }
    finally { setNotificationLoading(false); }
  }, []);

  const loadAttention = useCallback(async () => {
    setAttentionError(false);
    try {
      const response = await fetch("/api/alerts/header", { cache: "no-store" });
      if (!response.ok) throw new Error("Attention request failed");
      const body = await response.json() as { alerts?: ActionCard[] };
      setAttention(body.alerts ?? []);
    } catch { setAttentionError(true); }
    finally { setAttentionLoading(false); }
  }, []);

  const load = useCallback(async () => {
    await loadAttention();
    await loadNotifications();
  }, [loadAttention, loadNotifications]);

  const command = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true });
    if (response.ok) setCenter(await response.json() as NotificationCenter);
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60000);
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
  const attentionCount = attention.length;
  const badgeCount = attentionCount || unreadCount;

  const openNotification = (notification: NotificationItem) => {
    setOpen(false);
    if (!notification.readAt) void command({ command: "mark_read", notificationId: notification.id });
  };

  const toggleBell = () => {
    if (!open) load();
    if (!open && unreadCount > 0) setView("updates");
    setOpen((value) => !value);
  };

  return (
    <div ref={rootRef} className="relative z-[160]">
      <button type="button" className={`relative grid h-10 w-10 place-items-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-forest-500 ${open ? "border-forest-700 bg-forest-900 text-white" : "border-sand-200 bg-white text-forest-700 hover:border-forest-400 hover:bg-sand-50"}`} onClick={toggleBell} aria-label={t("bellLabel", { attentionCount, unreadCount })} aria-expanded={open} aria-controls="header-notification-panel">
        <Bell className="h-4 w-4" aria-hidden="true" />
        {badgeCount > 0 ? <span className={`absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-bold text-white ${attentionCount ? "bg-ember-500" : "bg-amber-500"}`}>{badgeCount > 99 ? "99+" : badgeCount}</span> : null}
      </button>

      {open ? (
        <section id="header-notification-panel" aria-label={t("panelLabel")} className="fixed inset-x-3 top-[70px] z-[170] max-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-[0_24px_70px_rgba(29,42,31,.22)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+12px)] sm:w-[430px]">
          <div className="border-b border-sand-200 bg-forest-900 p-4 text-white">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">{t("eyebrow")}</p><h2 className="mt-1 font-display text-xl font-semibold">{t("title")}</h2><p className="mt-1 text-xs text-sand-200">{t("description")}</p></div><div className="flex gap-2"><div className="rounded-xl border border-ember-400/20 bg-ember-400/10 px-2.5 py-2 text-center"><strong className="block text-lg leading-none">{attentionCount}</strong><span className="mt-1 block text-[8px] uppercase tracking-[.1em] text-sand-200">{t("attention")}</span></div><div className="rounded-xl border border-white/10 bg-white/[.07] px-2.5 py-2 text-center"><strong className="block text-lg leading-none">{unreadCount}</strong><span className="mt-1 block text-[8px] uppercase tracking-[.1em] text-sand-200">{t("unread")}</span></div></div></div>
          </div>

          <div className="grid grid-cols-2 border-b border-sand-200 bg-sand-50 p-1.5" role="tablist" aria-label={t("sectionsLabel")}>
            <button type="button" role="tab" aria-selected={view === "attention"} onClick={() => setView("attention")} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${view === "attention" ? "bg-white text-forest-900 shadow-sm" : "text-forest-600"}`}>{t("needsAttention")} <span className="ml-1 text-ember-500">{attentionCount}</span></button>
            <button type="button" role="tab" aria-selected={view === "updates"} onClick={() => setView("updates")} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${view === "updates" ? "bg-white text-forest-900 shadow-sm" : "text-forest-600"}`}>{t("updates")} <span className="ml-1 text-amber-700">{unreadCount}</span></button>
          </div>

          <div className="max-h-[min(440px,calc(100vh-16rem))] overflow-y-auto overscroll-contain">
            {view === "attention" ? <AttentionList items={attention} loading={attentionLoading} error={attentionError} retry={loadAttention} close={() => setOpen(false)} /> : <UpdateList notifications={notifications} loading={notificationLoading} error={notificationError} retry={loadNotifications} openNotification={openNotification} markAll={() => void command({ command: "mark_all_read" })} unreadCount={unreadCount} />}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-sand-200 bg-sand-50 p-3"><Link href="/app/alerts" onClick={() => setOpen(false)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-forest-800 text-xs font-semibold text-forest-800 transition hover:bg-forest-900 hover:text-white">{t("openActionDesk")} <ChevronRight className="h-3.5 w-3.5" /></Link><Link href="/app/alerts#notification-settings" onClick={() => setOpen(false)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sand-300 bg-white text-xs font-semibold text-forest-700"><Settings2 className="h-3.5 w-3.5" />{t("settings")}</Link></div>
        </section>
      ) : null}
    </div>
  );
}

function AttentionList({ items, loading, error, retry, close }: { items: ActionCard[]; loading: boolean; error: boolean; retry: () => void; close: () => void }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Notifications");
  if (loading) return <LoadingRows />;
  if (error) return <LoadError title={t("errors.attention")} retry={retry} />;
  if (!items.length) return <EmptyState title={t("empty.attentionTitle")} copy={t("empty.attentionCopy")} />;
  return <>{items.map((action) => {
    const style = severityStyle[action.severity];
    return <Link key={action.actionId} href={action.route} onClick={close} className="group flex items-start gap-3 border-b border-sand-100 px-4 py-3.5 transition last:border-0 hover:bg-sand-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-forest-500"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5 text-forest-900">{action.title}</span><span className="mt-1 block text-xs leading-5 text-forest-600">{action.context}</span><span className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.08em] ${style.badge}`}>{t(style.label)}</span><span className="text-[10px] font-semibold text-forest-600">{t(statusMessageKey[action.status])}</span><span className="inline-flex items-center gap-1 text-[10px] text-forest-400"><Clock3 className="h-3 w-3" />{t("due", { time: timeLabel(action.dueAt, locale, t("current")) })}</span></span><span className="mt-1 block text-[10px] text-forest-500">{t("owner", { name: action.ownerName ?? t("notAssigned") })}</span></span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-forest-400 transition group-hover:translate-x-0.5 group-hover:text-forest-700" /></Link>;
  })}</>;
}

function UpdateList({ notifications, loading, error, retry, openNotification, markAll, unreadCount }: { notifications: NotificationItem[]; loading: boolean; error: boolean; retry: () => void; openNotification: (item: NotificationItem) => void; markAll: () => void; unreadCount: number }) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Notifications");
  if (loading) return <LoadingRows />;
  if (error) return <LoadError title={t("errors.updates")} retry={retry} />;
  if (!notifications.length) return <EmptyState title={t("empty.updatesTitle")} copy={t("empty.updatesCopy")} />;
  return <>{unreadCount > 0 ? <div className="border-b border-sand-100 px-4 py-2 text-right"><button type="button" onClick={markAll} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-sand-200 px-3 text-[10px] font-semibold text-forest-700"><CheckCheck className="h-3.5 w-3.5" />{t("markAllRead")}</button></div> : null}{notifications.map((notification) => {
    const style = severityStyle[notification.severity];
    return <Link key={notification.id} href={notification.route} onClick={() => openNotification(notification)} className={`group flex items-start gap-3 border-b border-sand-100 px-4 py-3.5 transition last:border-0 hover:bg-sand-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-forest-500 ${notification.readAt ? "bg-white" : "bg-amber-50/35"}`}><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-5 text-forest-900">{notification.title}</span><span className="mt-1 block text-xs leading-5 text-forest-600">{notification.message}</span><span className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.08em] ${style.badge}`}>{t(style.label)}</span><span className="text-[10px] text-forest-400">{timeLabel(notification.createdAt, locale, t("current"))}</span>{notification.dueAt ? <span className="inline-flex items-center gap-1 text-[10px] text-forest-500"><Clock3 className="h-3 w-3" />{t("due", { time: timeLabel(notification.dueAt, locale, t("current")) })}</span> : null}{notification.readAt ? null : <span className="text-[9px] font-semibold uppercase tracking-wider text-forest-700">{t("new")}</span>}</span>{notification.eventType === "assigned" ? <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-forest-800">{t("openAssignedTask")} <ChevronRight className="h-3 w-3" /></span> : null}</span><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-forest-400 transition group-hover:translate-x-0.5 group-hover:text-forest-700" /></Link>;
  })}</>;
}

function LoadingRows() { const t = useTranslations("Common"); return <div role="status" className="grid gap-3 p-4"><span className="sr-only">{t("loading")}</span>{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-sand-100" />)}</div>; }
function LoadError({ title, retry }: { title: string; retry: () => void }) { const t = useTranslations("Common"); return <div className="p-5 text-center"><AlertTriangle className="mx-auto h-6 w-6 text-ember-500" /><p className="mt-3 text-sm font-semibold text-forest-900">{title}</p><button type="button" onClick={retry} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-sand-200 px-4 text-xs font-semibold text-forest-700"><RefreshCw className="h-3.5 w-3.5" />{t("retry")}</button></div>; }
function EmptyState({ title, copy }: { title: string; copy: string }) { return <div className="p-7 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-leaf-500/10 text-leaf-500"><CheckCircle2 className="h-5 w-5" /></div><p className="mt-3 text-sm font-semibold text-forest-900">{title}</p><p className="mt-1 text-xs leading-5 text-forest-600">{copy}</p></div>; }
