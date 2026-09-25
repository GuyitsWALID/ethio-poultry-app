/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { usePageFilter, ResetPageFilters, PageSelectFilter } from "@/components/page-filter-controls";
import { useFarmScope } from "@/components/farm-scope-context";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BellRing, CheckCircle2, Clock3, History, RefreshCw, Search, ShieldAlert, UserCheck, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ActionCard, ActionDesk, ActionStatus } from "@/lib/action-desk-contract";
import { NotificationSettingsPanel } from "@/components/notifications/notification-settings-panel";
import { formatOperationDateTime } from "@/i18n/formats";
import type { AppLocale } from "@/i18n/locale";

const tone = { high: "border-red-200 bg-red-50 text-red-700", medium: "border-amber-200 bg-amber-50 text-amber-800", low: "border-sand-200 bg-sand-50 text-forest-700" };
const statusTone: Record<ActionStatus, string> = { open: "bg-sand-100 text-forest-700", assigned: "bg-sky-50 text-sky-700", acknowledged: "bg-sky-50 text-sky-700", in_progress: "bg-amber-50 text-amber-800", awaiting_verification: "bg-violet-50 text-violet-700", escalated: "bg-red-50 text-red-700", resolved: "bg-green-50 text-green-700" };
const roleMessageKeys = { ceo: "roles.ceo", farm_manager: "roles.farm_manager", system_admin: "roles.system_admin" } as const;
const eventMessageKeys = { assigned: "events.assigned", claimed: "events.claimed", acknowledge: "events.acknowledge", work_started: "events.work_started", due_date_changed: "events.due_date_changed", resolution_submitted: "events.resolution_submitted", verification_failed: "events.verification_failed", system_verified: "events.system_verified" } as const;

function dateTime(value: string, locale: AppLocale, unavailable: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? unavailable : formatOperationDateTime(date, locale); }

type DialogState = { action: ActionCard; command: "acknowledge" | "start" | "submit_resolution" } | null;

export default function AlertsPage() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("AlertsPage");
  const tNotifications = useTranslations("Notifications");
  const { farms } = useFarmScope();
  const [farm, setFarm] = usePageFilter<string>("farm", "");
  const [severity, setSeverity] = usePageFilter<string>("severity", "");
  const [owner, setOwner] = usePageFilter<string>("owner", "");
  const [status, setStatus] = usePageFilter<string>("status", "");
  const [desk, setDesk] = useState<ActionDesk | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = usePageFilter<string>("query", "");
  const [view, setView] = usePageFilter<"all" | "mine" | "unassigned" | "escalated" | "verification">("tab", "all");
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<DialogState>(null);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/alerts/actions", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? t("errors.load"));
      setDesk(body as ActionDesk);
    } catch (value) { setError(value instanceof Error ? value.message : t("errors.load")); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (window.location.hash !== "#notification-settings") return;
    window.requestAnimationFrame(() => document.getElementById("notification-settings")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const update = useCallback(async (actionId: string, body: Record<string, unknown>) => {
    setBusy(actionId); setError("");
    try {
      const response = await fetch(`/api/alerts/actions/${actionId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error ?? t("errors.update"));
      setDialog(null); setNote(""); setEvidence(""); await load();
    } catch (value) { setError(value instanceof Error ? value.message : t("errors.update")); }
    finally { setBusy(null); }
  }, [load, t]);

  const actions = desk?.actions ?? [];
  const visible = actions.filter((item) => {
    if (farm && item.farmId !== farm) return false;
    if (severity && item.severity !== severity) return false;
    if (owner && item.ownerId !== owner) return false;
    if (status && item.status !== status) return false;
    if (view === "mine" && item.ownerId !== desk?.viewerId) return false;
    if (view === "unassigned" && item.ownerId) return false;
    if (view === "escalated" && item.status !== "escalated") return false;
    if (view === "verification" && item.status !== "awaiting_verification") return false;
    const terms = query.trim().toLowerCase();
    return !terms || `${item.title} ${item.context} ${item.source} ${item.ownerName ?? ""}`.toLowerCase().includes(terms);
  });

  const openDialog = (action: ActionCard, command: NonNullable<DialogState>["command"]) => { setDialog({ action, command }); setNote(""); setEvidence(""); };
  const dialogTitle = dialog?.command === "submit_resolution" ? t("dialog.completeTitle") : dialog?.command === "start" ? t("dialog.startTitle") : t("dialog.acknowledgeTitle");
  const statusLabel = (value: ActionStatus) => tNotifications(`status.${value}`);
  const roleLabel = (value: string) => value in roleMessageKeys ? t(roleMessageKeys[value as keyof typeof roleMessageKeys]) : value.replaceAll("_", " ");
  const eventLabel = (value: string) => value in eventMessageKeys ? t(eventMessageKeys[value as keyof typeof eventMessageKeys]) : value.replaceAll("_", " ");

  return <main className="space-y-5 pb-8">
      <div className="flex justify-end"><ResetPageFilters /></div>
      <div className="grid gap-3 rounded-2xl border border-sand-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <PageSelectFilter label={t("filters.farms")} value={farm} onChange={setFarm} options={farms.map(item=>({value:item.id,label:item.name}))}/>
        <PageSelectFilter label={t("filters.owners")} value={owner} onChange={setOwner} options={(desk?.owners??[]).map(item=>({value:item.id,label:item.name}))}/>
        <PageSelectFilter label={t("filters.priorities")} value={severity} onChange={setSeverity} options={[{value:"high",label:t("filters.high")},{value:"medium",label:t("filters.medium")},{value:"low",label:t("filters.low")}]}/>
        <PageSelectFilter label={t("filters.statuses")} value={status} onChange={setStatus} options={(["open", "assigned", "acknowledged", "in_progress", "awaiting_verification", "escalated", "resolved"] as ActionStatus[]).map((value)=>({value,label:statusLabel(value)}))}/>
      </div>
    <section className="relative overflow-hidden rounded-[28px] bg-forest-900 px-6 py-7 text-sand-50 sm:px-8 lg:px-10 lg:py-9">
      <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[44px] border-ember-500/10" />
      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.24em] text-amber-500"><BellRing className="h-4 w-4" />{t("hero.eyebrow")}</div><h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold sm:text-4xl">{t("hero.title")}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100/80">{t("hero.copy")}</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl bg-sand-50 px-4 py-2 text-sm font-semibold text-forest-900 xl:self-auto"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("hero.refresh")}</button></div>
    </section>

    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

    <section className="grid overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-5">
      {([
        [t("summary.unassigned"), desk?.summary.unassigned ?? 0, UserCheck, "text-forest-500"],
        [t("summary.mine"), desk?.summary.mine ?? 0, CheckCircle2, "text-leaf-500"],
        [t("summary.dueSoon"), desk?.summary.dueSoon ?? 0, Clock3, "text-amber-600"],
        [t("summary.escalated"), desk?.summary.escalated ?? 0, ShieldAlert, "text-ember-500"],
        [t("summary.awaiting"), desk?.summary.awaitingVerification ?? 0, RefreshCw, "text-violet-600"],
      ] as Array<[string, number, LucideIcon, string]>).map(([label, value, Icon, color]) => <div key={label} className="border-b border-r border-sand-200 p-5 last:border-r-0 xl:border-b-0"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">{label}</p><Icon className={`h-4 w-4 ${color}`} /></div><p className="mt-2 font-display text-3xl font-semibold text-forest-900">{loading ? "—" : value}</p></div>)}
    </section>

    <NotificationSettingsPanel />

    <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-sand-200 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">{t("queue.eyebrow")}</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">{t("queue.title")}</h2><p className="mt-1 text-sm text-forest-600">{loading ? t("queue.refreshing") : t("queue.count", { visible: visible.length, total: actions.length })}</p></div><div className="flex flex-wrap gap-2"><label className="relative min-w-0 flex-1 sm:flex-none"><span className="sr-only">{t("queue.search")}</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-forest-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("queue.search")} className="h-11 w-full min-w-0 rounded-xl border border-sand-200 pl-9 pr-3 text-sm" /></label><select aria-label={t("queue.filter")} value={view} onChange={(event) => setView(event.target.value as typeof view)} className="min-h-11 max-w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"><option value="all">{t("queue.all")}</option><option value="mine">{t("queue.mine")}</option><option value="unassigned">{t("queue.unassigned")}</option><option value="escalated">{t("queue.escalated")}</option><option value="verification">{t("queue.verification")}</option></select></div></div>

      <div className="divide-y divide-sand-100">{loading ? <div className="p-10 text-center text-sm text-forest-600">{t("queue.collecting")}</div> : visible.length ? visible.map((item) => <article id={`action-${item.actionId}`} key={item.actionId} className="scroll-mt-24 p-5 sm:p-6 target:bg-amber-50/40">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${tone[item.severity]}`}>{t(`severity.${item.severity}`)}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone[item.status]}`}>{statusLabel(item.status)}</span><span className="text-[10px] font-semibold uppercase tracking-wider text-forest-500">{item.source}</span></div><h3 className="mt-3 text-lg font-semibold text-forest-900">{item.title}</h3><p className="mt-1 text-sm leading-6 text-forest-600">{item.context}</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-forest-600"><span><strong className="text-forest-900">{t("card.owner")}</strong> {item.ownerName ?? t("card.notAssigned")}</span><span><strong className="text-forest-900">{t("card.due")}</strong> {dateTime(item.dueAt, locale, t("timeUnavailable"))}</span>{item.escalatedAt ? <span className="font-semibold text-red-700">{t("card.escalated", { date: dateTime(item.escalatedAt, locale, t("timeUnavailable")) })}</span> : null}</div></div>
          <div className="rounded-xl border border-sand-200 bg-sand-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">{t("card.responsibility")}</p>{item.canAssign ? <div className="mt-2 space-y-2"><select aria-label={`${t("card.assign")} ${item.title}`} value={owners[item.actionId] ?? item.ownerId ?? ""} onChange={(event) => setOwners((current) => ({ ...current, [item.actionId]: event.target.value }))} className="min-h-10 w-full rounded-lg border border-sand-200 bg-white px-3 py-2 text-xs"><option value="">{t("card.chooseManager")}</option>{desk?.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} · {owner.scope}</option>)}</select><button type="button" disabled={!(owners[item.actionId] ?? item.ownerId) || busy === item.actionId} onClick={() => void update(item.actionId, { command: "assign", ownerId: owners[item.actionId] ?? item.ownerId })} className="min-h-10 w-full rounded-lg bg-forest-900 px-3 py-2 text-xs font-semibold text-white">{item.ownerId ? t("card.reassign") : t("card.assign")}</button></div> : item.ownerName ? <p className="mt-2 text-sm font-semibold text-forest-900">{item.ownerName}</p> : item.canClaim ? <button type="button" disabled={busy === item.actionId} onClick={() => void update(item.actionId, { command: "claim" })} className="mt-2 min-h-10 w-full rounded-lg bg-forest-900 px-3 py-2 text-xs font-semibold text-white">{t("card.claim")}</button> : <p className="mt-2 text-xs leading-5 text-forest-600">{t("card.ceoRequired")}</p>}</div></div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-sand-100 pt-4"><Link href={item.route} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-forest-900 px-4 py-2 text-xs font-semibold text-white">{item.status === "awaiting_verification" && desk?.role === "ceo" ? t("card.reviewSource") : t("card.inspectSource")} <ArrowRight className="h-3.5 w-3.5" /></Link>{item.canWork && item.status === "assigned" ? <button type="button" onClick={() => openDialog(item, "acknowledge")} className="min-h-10 rounded-xl border border-sand-200 px-4 py-2 text-xs font-semibold text-forest-800">{t("card.acknowledge")}</button> : null}{item.canWork && ["acknowledged", "escalated"].includes(item.status) ? <button type="button" onClick={() => openDialog(item, "start")} className="min-h-10 rounded-xl border border-sand-200 px-4 py-2 text-xs font-semibold text-forest-800">{t("card.start")}</button> : null}{desk?.role === "farm_manager" && item.canWork && ["assigned", "acknowledged", "in_progress", "escalated"].includes(item.status) ? <button type="button" onClick={() => openDialog(item, "submit_resolution")} className="min-h-10 rounded-xl border border-forest-800 bg-forest-900 px-4 py-2 text-xs font-semibold text-white">{t("card.complete")}</button> : null}{desk?.role === "ceo" && item.status === "awaiting_verification" ? <button type="button" disabled={busy === item.actionId} onClick={() => void update(item.actionId, { command: "verify" })} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-forest-800 px-4 py-2 text-xs font-semibold text-forest-800"><RefreshCw className="h-3.5 w-3.5" />{t("card.verify")}</button> : null}{desk?.role === "farm_manager" && item.status === "awaiting_verification" ? <span className="rounded-xl bg-violet-50 px-4 py-2.5 text-xs font-semibold text-violet-700">{t("card.sent")}</span> : null}<details className="ml-auto max-w-full"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-forest-700"><History className="h-4 w-4" />{t("card.history", { count: item.events.length })}</summary><div className="mt-3 min-w-[280px] max-w-lg space-y-2 rounded-xl border border-sand-200 bg-white p-3 shadow-lg">{item.events.map((entry) => <div key={entry.id} className="border-b border-sand-100 pb-2 text-xs last:border-0 last:pb-0"><strong className="text-forest-900">{eventLabel(entry.eventType)}</strong><span className="text-forest-500"> · {entry.actorName} ({roleLabel(entry.actorRole)}) · {dateTime(entry.createdAt, locale, t("timeUnavailable"))}</span>{entry.note ? <p className="mt-1 leading-5 text-forest-600">{entry.note}</p> : null}</div>)}</div></details></div>
      </article>) : <div className="p-10 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-leaf-500" /><p className="mt-2 font-semibold text-forest-900">{t("empty.title")}</p><p className="mt-1 text-sm text-forest-600">{t("empty.copy")}</p></div>}</div>
    </section>

    {dialog ? <div className="fixed inset-0 z-[220] grid place-items-center bg-forest-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><section role="dialog" aria-modal="true" aria-labelledby="action-dialog-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-sand-200 bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 bg-forest-900 p-5 text-white"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-400">{t("dialog.eyebrow")}</p><h2 id="action-dialog-title" className="mt-1 font-display text-2xl font-semibold">{dialogTitle}</h2><p className="mt-2 text-xs leading-5 text-sand-200">{dialog.action.title}</p></div><button type="button" onClick={() => setDialog(null)} aria-label={t("dialog.close")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15"><X className="h-4 w-4" /></button></header><div className="space-y-4 p-5">{dialog.command === "submit_resolution" ? <div className="rounded-xl border border-leaf-500/25 bg-leaf-500/10 p-3 text-xs leading-5 text-forest-800">{t("dialog.completeHelp")}</div> : null}<label className="block text-sm font-semibold text-forest-900">{dialog.command === "submit_resolution" ? t("dialog.whatFixed") : t("dialog.workNote")}<textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder={dialog.command === "submit_resolution" ? t("dialog.fixedPlaceholder") : t("dialog.notePlaceholder")} className="mt-2 w-full rounded-xl border border-sand-200 p-3 text-sm font-normal" /></label>{dialog.command === "submit_resolution" ? <label className="block text-sm font-semibold text-forest-900">{t("dialog.evidence")} <span className="font-normal text-forest-500">{t("dialog.optional")}</span><textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} rows={3} placeholder={t("dialog.evidencePlaceholder")} className="mt-2 w-full rounded-xl border border-sand-200 p-3 text-sm font-normal" /><span className="mt-1 block text-xs font-normal text-forest-500">{t("dialog.evidenceHelp")}</span></label> : null}</div><footer className="flex flex-wrap justify-end gap-2 border-t border-sand-200 p-4"><button type="button" onClick={() => setDialog(null)} className="min-h-10 rounded-xl border border-sand-200 px-4 py-2 text-xs font-semibold">{t("dialog.cancel")}</button><button type="button" disabled={note.trim().length < (dialog.command === "submit_resolution" ? 8 : 4) || busy === dialog.action.actionId} onClick={() => void update(dialog.action.actionId, dialog.command === "submit_resolution" ? { command: dialog.command, note, evidence } : { command: dialog.command, note })} className="min-h-10 rounded-xl bg-forest-900 px-4 py-2 text-xs font-semibold text-white">{dialog.command === "submit_resolution" ? t("dialog.completeAction") : t("dialog.save")}</button></footer></section></div> : null}
  </main>;
}
