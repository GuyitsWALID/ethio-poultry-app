"use client";

import Link from "next/link";
import {useLocale, useTranslations} from "next-intl";
import {Bird, RefreshCw} from "lucide-react";

import {formatNumber, formatOperationDate} from "@/i18n/formats";
import {buildHistoryHref} from "@/lib/history/contracts";
import type {AppLocale} from "@/i18n/locale";
import type {TodayFlockContext} from "@/lib/today-workspace/contracts";
import {assessBirdCheck} from "@/lib/today-workspace/bird-check";
import {TaskDraftScope, useTodayOffline} from "@/components/today/offline-context";
import {RecordingStartForm} from "@/components/today/recording-start-form";
import {BirdOpeningGap} from "@/components/today/bird-opening-gap";

type BirdCheckProps = {
  flock: TodayFlockContext; farmId: string; workDate: string;
  online: boolean; refreshing: boolean; onRefresh: () => void;
};
export function BirdCheckCard({flock, farmId, workDate, online, refreshing, onRefresh}:BirdCheckProps) {
  const offline=useTodayOffline();
  const dailyCommands=offline.queue.filter(row=>row.command.type==="save_daily_record" && row.command.flock_id===flock.id && row.command.work_date===workDate);
  const pending=dailyCommands.some(row=>row.state==="queued" || row.state==="sending");
  const needsAttention=dailyCommands.some(row=>row.state==="conflict" || row.state==="rejected");
  const openingConflict=offline.queue.some(row=>row.command.flock_id===flock.id && row.command.work_date===workDate && row.taskKey?.endsWith(":birds") && (row.state==="conflict" || row.state==="rejected"));
  const t = useTranslations("Today");
  const locale = useLocale() as AppLocale;
  const initial = flock.birdCheck;
  const assessment = assessBirdCheck(initial);
  const unusualMovement = initial.transfersIn > 0 || initial.transfersOut > 0 || initial.otherRemovals > 0;
  const openingReady = initial.openingBirds !== null && Number.isInteger(initial.openingBirds) && initial.openingBirds >= 0;
  const closing = initial.dailyRecordId ? initial.closingBirds : initial.openingBirds;
  const correctionHref = buildHistoryHref({category: "daily", farm: farmId, flock: flock.id, from: workDate, to: workDate}, initial.dailyRecordId ? {kind: "daily_record", id: initial.dailyRecordId} : undefined);
  const flockHistoryHref = buildHistoryHref({category: "daily", farm: farmId, flock: flock.id});

  return <>
    <article id="today-bird-count" className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-sand-300 bg-sand-50 text-forest-700"><Bird className="h-5 w-5" aria-hidden="true" /></span><div><h3 className="font-semibold text-forest-900">{t("birdCheck.title")}</h3><p className="mt-1 text-sm leading-5 text-forest-600">{t("birdCheck.help")}</p></div></div>
        <button type="button" onClick={onRefresh} disabled={!online || refreshing} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sand-300 px-3 text-sm font-semibold text-forest-800 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true"/>{t("birdCheck.refresh")}</button>
      </header>
      <div className="grid gap-3 border-t border-sand-200 p-4">
        <div className="rounded-xl bg-forest-900 p-5 text-white"><span className="text-sm text-sand-100/80">{t("birdCheck.current",{date:formatOperationDate(workDate,locale)})}</span><strong className="mt-1 block font-display text-4xl tabular-nums">{closing === null ? "—" : formatNumber(closing, locale)}</strong>{closing === null ? <span className="mt-2 block text-xs text-sand-100/75">{t("birdCheck.noSavedCount")}</span> : null}</div>
        <p role="status" className="text-sm text-forest-600">{needsAttention ? t("states.needsAttention") : pending ? t("states.waiting") : flock.healthSummary.confirmedNone ? t("embedded.healthNoneSummary") : initial.deaths + initial.culls > 0 ? t("birdCheck.lossesRecorded") : t("birdCheck.lossesNotConfirmed")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-sand-200 p-3"><span className="text-xs text-forest-600">{t("birdCheck.opening")}</span><strong className="mt-1 block text-xl">{initial.openingBirds === null ? "—" : formatNumber(initial.openingBirds, locale)}</strong><span className="mt-1 block text-xs text-forest-500">{t(`birdCheck.sources.${initial.openingSource}`)}</span></div>
          <div className="rounded-xl border border-sand-200 p-3"><span className="text-xs text-forest-600">{t("birdCheck.deaths")}</span><strong className="mt-1 block text-xl">{formatNumber(initial.deaths, locale)}</strong></div>
          <div className="rounded-xl border border-sand-200 p-3"><span className="text-xs text-forest-600">{t("birdCheck.culls")}</span><strong className="mt-1 block text-xl">{formatNumber(initial.culls, locale)}</strong></div>
        </div>
      </div>
    </article>
    {(!openingReady || openingConflict || initial.dailyRecordId && (!assessment.valid || unusualMovement)) ? <section id="today-task-birds" tabIndex={-1} className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
      {openingConflict ? <TaskDraftScope selection={{farmId,flockId:flock.id,workDate}} task="birds" revision={initial.resourceRevision}><span/></TaskDraftScope> : null}
      <BirdOpeningGap flock={flock}/>
      {!openingReady ? <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{initial.dailyRecordId ? <>{t("birdCheck.missingOpening")} <Link href={correctionHref} className="font-semibold underline">{t("birdCheck.openRecord")}</Link></> : initial.recordingStartBlocker === null && flock.canRecord !== false ? t("birdCheck.missingStart") : <>{t("birdCheck.startUnavailable")} <Link href={flockHistoryHref} className="font-semibold underline">{t("birdCheck.reviewHistory")}</Link></>}</p> : null}
      {!openingReady && !initial.dailyRecordId && initial.recordingStartBlocker === null && flock.canRecord !== false ? <RecordingStartForm farmId={farmId} flockId={flock.id} workDate={workDate} eggProducing={flock.type === "layer" || flock.type === "parent_stock"} online={online}/> : null}
      {initial.dailyRecordId && (!assessment.valid || unusualMovement) ? <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t("birdCheck.legacyMovements")} <Link href={correctionHref} className="font-semibold underline">{t("birdCheck.openRecord")}</Link></p> : null}
    </section> : null}
  </>;
}
