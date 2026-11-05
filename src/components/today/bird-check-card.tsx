"use client";

import Link from "next/link";
import {useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {Bird, ChevronDown, ChevronUp, Save} from "lucide-react";

import {formatNumber} from "@/i18n/formats";
import {todayErrorMessageKeys} from "@/i18n/today-copy";
import {buildHistoryHref} from "@/lib/history/contracts";
import type {AppLocale} from "@/i18n/locale";
import type {TodayFlockContext, TodayTask} from "@/lib/today-workspace/contracts";
import {assessBirdCheck} from "@/lib/today-workspace/bird-check";
import {TaskDraftScope, useDraftSubmit,useTodayOffline} from "@/components/today/offline-context";
import {RecordingStartForm} from "@/components/today/recording-start-form";

type BirdCheckProps = {
  flock: TodayFlockContext; task: TodayTask; farmId: string; workDate: string;
  online: boolean; expanded: boolean; onToggle: () => void; onSaved: () => void;
};
export function BirdCheckCard(props:BirdCheckProps) {
  return <TaskDraftScope selection={{farmId:props.farmId,flockId:props.flock.id,workDate:props.workDate}} task="birds" revision={props.flock.birdCheck.resourceRevision??undefined}><BirdCheckContent {...props}/></TaskDraftScope>;
}
function BirdCheckContent({flock, task, farmId, workDate, online, expanded, onToggle, onSaved}:BirdCheckProps) {
  const send=useDraftSubmit();
  const pending=useTodayOffline().queue.some(row=>row.command.type==="save_daily_record"&&row.command.flock_id===flock.id&&row.command.work_date===workDate&&row.taskKey?.endsWith(":birds"));
  const offlineText=useTranslations("Today.offline");
  const t = useTranslations("Today");
  const errors = useTranslations("Errors");
  const locale = useLocale() as AppLocale;
  const initial = flock.birdCheck;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const assessment = assessBirdCheck(initial);
  const unusualMovement = initial.transfersIn > 0 || initial.transfersOut > 0 || initial.otherRemovals > 0;
  const openingReady = initial.openingBirds !== null && Number.isInteger(initial.openingBirds) && initial.openingBirds >= 0;
  const closing = initial.dailyRecordId ? initial.closingBirds : initial.openingBirds;
  const stateLabel = task.state === "complete" ? t("states.complete")
    : task.state === "needs_attention" ? t("states.needsAttention") : task.state === "waiting_to_sync" ? t("states.waiting") : task.state === "draft_on_tablet" ? t("states.draft") : t("states.notStarted");
  const correctionHref = buildHistoryHref({category: "daily", farm: farmId, flock: flock.id, from: workDate, to: workDate}, initial.dailyRecordId ? {kind: "daily_record", id: initial.dailyRecordId} : undefined);

  async function startDay() {
    if (flock.canRecord === false || !openingReady || initial.dailyRecordId || saving || pending) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await send({
        schema_version: 1, command_id: crypto.randomUUID(), type: "save_daily_record",
        farm_id: farmId, flock_id: flock.id, work_date: workDate,
        payload: {daily_record_id: null, record: {
          record_date: workDate, opening_birds: initial.openingBirds, closing_birds: initial.openingBirds,
          _today_opening: {source: initial.openingSource, count: initial.openingBirds},
          deaths: 0, culls: 0, transfers_in: 0, transfers_out: 0, other_removals: 0,
        }, usages: null},
      });
      if (result.status === "applied") onSaved();
      else if(result.status === "queued"){setMessage(offlineText("waiting"));onSaved();}
      else setMessage(errors(result.error_code ? todayErrorMessageKeys[result.error_code] : "unknown"));
    } catch { setMessage(errors("unknown")); }
    finally { setSaving(false); }
  }

  return <article id="today-task-birds" className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
    <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-h-16 w-full flex-wrap items-start justify-between gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-forest-700">
      <span className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-sand-300 bg-sand-50 text-forest-700"><Bird className="h-5 w-5" aria-hidden="true" /></span><span><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-forest-900">{t("birdCheck.title")}</span><span className="rounded-full bg-sand-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-forest-600">{t("required")}</span></span><span className="mt-1 block text-sm leading-5 text-forest-600">{t("birdCheck.help")}</span></span></span>
      <span className="flex items-center gap-2"><span className="rounded-full border border-sand-300 bg-sand-50 px-2.5 py-1 text-[11px] font-semibold text-forest-700">{stateLabel}</span>{expanded ? <ChevronUp className="h-5 w-5"/> : <ChevronDown className="h-5 w-5"/>}</span>
    </button>
    {expanded ? <div className="grid gap-4 border-t border-sand-200 p-4">
      {flock.canRecord === false ? <p className="rounded-xl bg-sand-50 p-3 text-sm text-forest-700">{t("closedFlockReadOnly")}</p> : null}
      <div className="rounded-xl bg-forest-900 p-4 text-white"><span className="text-xs text-sand-100/70">{t("birdCheck.opening")}</span><div className="mt-1 flex flex-wrap items-baseline justify-between gap-2"><strong className="text-2xl tabular-nums">{initial.openingBirds === null ? "—" : formatNumber(initial.openingBirds, locale)}</strong><span className="text-xs text-sand-100/75">{t(`birdCheck.sources.${initial.openingSource}`)}</span></div></div>
      {!openingReady ? <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t("birdCheck.missingOpening")} <Link href={correctionHref} className="font-semibold underline">{t("birdCheck.openRecord")}</Link></p> : null}
      {!openingReady && !initial.dailyRecordId && flock.canRecord !== false ? <RecordingStartForm farmId={farmId} flockId={flock.id} workDate={workDate} eggProducing={flock.type === "layer" || flock.type === "parent_stock"} online={online}/> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-sand-200 p-3"><span className="text-xs text-forest-600">{t("birdCheck.deaths")}</span><strong className="mt-1 block text-xl">{formatNumber(initial.deaths, locale)}</strong></div>
        <div className="rounded-xl border border-sand-200 p-3"><span className="text-xs text-forest-600">{t("birdCheck.culls")}</span><strong className="mt-1 block text-xl">{formatNumber(initial.culls, locale)}</strong></div>
        <div className="rounded-xl border border-leaf-500/30 bg-leaf-500/10 p-3"><span className="text-xs text-forest-600">{t("birdCheck.closing")}</span><strong className="mt-1 block text-xl">{closing === null ? "—" : formatNumber(closing, locale)}</strong></div>
      </div>
      <p className="rounded-xl bg-sand-50 p-3 text-sm text-forest-700">{t("birdCheck.healthEntry")}</p>
      {initial.dailyRecordId && (!assessment.valid || unusualMovement) ? <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t("birdCheck.legacyMovements")} <Link href={correctionHref} className="font-semibold underline">{t("birdCheck.openRecord")}</Link></p> : null}
      {message ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p> : null}
      {!online && !initial.dailyRecordId ? <p role="status" className="text-sm text-amber-800">{offlineText("birdHelp")}</p> : null}
      {!initial.dailyRecordId && flock.canRecord !== false ? <div className="flex justify-end"><button type="button" onClick={startDay} disabled={saving || !openingReady || pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{saving ? t("birdCheck.saving") : t("birdCheck.save")}</button></div> : null}
    </div> : null}
  </article>;
}
