"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {formatOperationDateTime} from "@/i18n/formats";
import type {AppLocale} from "@/i18n/locale";
import {canSubmitTodayRollout, type TodayRolloutEvent} from "@/lib/today-rollout";

const endpoint = "/api/ceo/feature-flags/today-workspace";

export function TodayRolloutControl() {
  const t = useTranslations("TodayRollout");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [events, setEvents] = useState<TodayRolloutEvent[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"loadFailed" | "saveFailed" | null>(null);
  const [notice, setNotice] = useState(false);
  const submitting = useRef(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, {cache: "no-store"});
      const data = await response.json();
      if (!response.ok || typeof data.enabled !== "boolean" || !Array.isArray(data.events)) throw new Error("Invalid rollout response");
      setError(null);
      setEnabled(data.enabled);
      setEvents(data.events);
    } catch {
      setEnabled(null);
      setEvents([]);
      setError("loadFailed");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    // Only asynchronous network results update state; initial loading is already true.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save() {
    if (submitting.current || loading || !canSubmitTodayRollout(enabled, saving, reason)) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    setNotice(false);
    try {
      const response = await fetch(endpoint, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({enabled: !enabled, reason: reason.trim()})});
      const data = await response.json();
      if (!response.ok || typeof data.today_workspace_enabled !== "boolean") throw new Error("Invalid rollout result");
      setEnabled(data.today_workspace_enabled);
      setReason("");
      setNotice(true);
      router.refresh();
      await load();
    } catch { setEnabled(null); setError("saveFailed"); }
    finally { submitting.current = false; setSaving(false); }
  }

  return <section aria-labelledby="today-rollout-title" className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 id="today-rollout-title" className="font-display text-2xl font-semibold text-forest-900">{t("title")}</h2>
    <p className="mt-2 text-sm text-forest-600">{t("description")}</p>
    <p className="mt-2 text-sm text-forest-600">{t("rollbackHelp")}</p>
    <p role="status" className="my-4 font-semibold">{loading ? t("loading") : enabled === null ? t("unavailable") : enabled ? t("enabled") : t("disabled")}</p>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <label className="grid gap-1 text-sm font-semibold">{t("reason")}
        <input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} disabled={saving || loading} aria-describedby="today-rollout-reason-help" className="min-h-12 rounded-xl border border-sand-300 px-3 font-normal"/>
        <span id="today-rollout-reason-help" className="text-xs font-normal">{t("reasonHelp")}</span>
      </label>
      <button type="button" disabled={loading || !canSubmitTodayRollout(enabled, saving, reason)} onClick={() => void save()} className="min-h-12 self-start rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:mt-6">{saving ? t("saving") : enabled ? t("disable") : t("enable")}</button>
    </div>
    {notice ? <p role="status" className="mt-3 text-sm text-leaf-700">{t("saved")}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{t(error)}</p> : null}
    <button type="button" onClick={() => { setLoading(true); setError(null); void load(); }} disabled={loading || saving} className="mt-3 min-h-12 rounded-xl border border-sand-300 px-4 text-sm">{t("refresh")}</button>
    <h3 className="mt-6 font-semibold">{t("history")}</h3>
    {!loading && !error && !events.length ? <p className="mt-2 text-sm text-forest-600">{t("empty")}</p> : null}
    <ol className="mt-3 space-y-3">{events.map((event) => <li key={event.sequence} className="rounded-xl bg-sand-50 p-4 text-sm">
      <p className="font-semibold">{event.enabled ? t("enabled") : t("disabled")}</p>
      <p>{event.source === "system_release" ? t("systemRelease") : event.actorName} · <time dateTime={event.occurredAt}>{formatOperationDateTime(event.occurredAt, locale)}</time></p>
      <p className="mt-1 whitespace-pre-wrap break-words">{event.reason}</p>
      {event.releaseReference ? <p className="mt-1 break-words">{t("release", {reference: event.releaseReference})}</p> : null}
    </li>)}</ol>
  </section>;
}
