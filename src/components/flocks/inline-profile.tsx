"use client";

import {WholeFlockMove} from "@/components/flocks/whole-flock-move";

import Link from "next/link";
import {useEffect, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {ChevronRight, Loader2, RefreshCw} from "lucide-react";
import {formatNumber, formatOperationDate} from "@/i18n/formats";
import type {AppLocale} from "@/i18n/locale";
import {profilePeriods, type FlockProfile, type ProfileDays} from "@/lib/flock-lifecycle/profile";
import type {TodayTaskCode} from "@/lib/today-workspace/contracts";
import {todayTaskMessageKeys} from "@/i18n/today-copy";

export function InlineFlockProfile({flockId, open}: {flockId: string; open: boolean}) {
  const t = useTranslations("FlockProfile"), todayT = useTranslations("Today");
  const locale = useLocale() as AppLocale;
  const [days, setDays] = useState<ProfileDays>(30);
  const [loaded, setLoaded] = useState<{id: string; days: number; data: FlockProfile} | null>(null);
  const [error, setError] = useState<{id: string; days: number; code: "unavailable" | "loadFailed"} | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const panel = document.getElementById("selected-flock-details");
      panel?.scrollIntoView({block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
    });
    return () => window.cancelAnimationFrame(frame);
  }, [flockId, open]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/flocks/${encodeURIComponent(flockId)}/profile?days=${days}`, {cache: "no-store", signal: controller.signal});
        if (!response.ok) {setError({id: flockId, days, code: response.status === 404 ? "unavailable" : "loadFailed"}); return;}
        const data = await response.json() as FlockProfile;
        if (controller.signal.aborted) return;
        setError(null); setLoaded({id: flockId, days, data});
      } catch {if (!controller.signal.aborted) setError({id: flockId, days, code: "loadFailed"});}
    })();
    return () => controller.abort();
  }, [flockId, days, open, retry]);
  const failure = error?.id === flockId && error.days === days ? error.code : null;
  const profile = loaded?.id === flockId && loaded.days === days && !failure ? loaded.data : null;
  const date = (value: string) => formatOperationDate(`${value}T12:00:00Z`, locale);
  const number = (value: number | null) => value === null ? t("unknown") : formatNumber(value, locale);
  const metric = (label: string, value: number | null, evidenceDays?: number, target?: number | null) => <div className="min-w-0 rounded-xl bg-sand-50 p-4" key={label}>
    <dt className="text-sm text-forest-600">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-forest-950">{number(value)}</dd>
    {evidenceDays !== undefined ? <p className="mt-1 text-xs text-forest-600">{t("evidenceDays", {days: formatNumber(evidenceDays, locale)})}</p> : null}
    {target !== undefined ? <p className="mt-1 text-xs text-forest-600">{t("target", {value: number(target)})}</p> : null}
  </div>;
  const archived = profile && !["active", "quarantined"].includes(profile.flock.status);
  return <section id="selected-flock-details" aria-labelledby="flock-profile-title" aria-hidden={!open} inert={!open}
    className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
    <div className="min-h-0 overflow-hidden"><div className="space-y-5 rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="flock-profile-title" className="font-display text-2xl font-semibold text-forest-950">{profile?.flock.code ?? t("title")}</h2>
        {profile?.period.from && profile.period.to ? <p className="mt-1 text-sm text-forest-600">{t("period", {from: date(profile.period.from), to: date(profile.period.to)})}</p> : null}</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("periods")}>{profilePeriods.map(period => <button type="button" key={period} aria-pressed={days === period} onClick={() => setDays(period)} className={`min-h-11 rounded-xl border px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 ${days === period ? "border-forest-900 bg-forest-900 text-white" : "border-sand-300 text-forest-900 hover:bg-sand-50"}`}>{t("days", {days: formatNumber(period, locale)})}</button>)}</div>
      </header>
      {failure ? <div role="alert" className="rounded-xl border border-ember-300 bg-ember-50 p-4 text-ember-800"><p>{t(failure)}</p><button type="button" onClick={() => {setError(null); setRetry(value => value + 1);}} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-ember-300 px-4"><RefreshCw className="size-4"/>{t("retry")}</button></div> : !profile ? <p role="status" className="flex items-center gap-2 py-6 text-forest-700"><Loader2 className="size-5 animate-spin motion-reduce:animate-none"/>{t("loading")}</p> : <>
        <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">{([
          [t("farm"), profile.flock.farmName || t("unknown")], [t("house"), profile.flock.houseName || t("unknown")],
          [t("batch"), profile.flock.batchLabel ?? t("unknown")], [t("breed"), profile.flock.breedName ?? t("unknown")],
          [t("type"), t(`types.${profile.flock.type}`)], [t("placement"), date(profile.flock.placementDate)],
          [t("age"), profile.flock.ageDays === null ? t("unknown") : t("ageDays", {days: formatNumber(profile.flock.ageDays, locale)})],
          [t("starting"), number(profile.flock.startingBirds)], [t(archived && !profile.period.to ? "historicalPopulation" : "current"), number(profile.flock.currentBirds)],
          [t("lifecycle"), t(`statuses.${profile.flock.status as "active"}`)],
        ]).map(([label, value]) => <div key={label}><dt className="text-xs text-forest-600">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-forest-900">{value}</dd></div>)}</dl>
        {archived ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-forest-800"><p>{profile.period.to ? t("archiveNote") : t("completionUnknown")}</p>{profile.flock.beforeClearanceBirds !== null ? <p className="mt-2">{t("beforeClearance")}: {number(profile.flock.beforeClearanceBirds)}</p> : null}</div> : null}
        <article className="space-y-5 border-t border-sand-200 pt-5"><h3 className="font-display text-xl font-semibold text-forest-950">{t("attention")}</h3><p className="text-sm text-forest-600">{t("partial")}</p>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-sand-200 p-4"><p className="text-sm text-forest-600">{t("records")}</p><strong>{profile.period.to ? t("coverage", {complete: formatNumber(profile.coverage.records, locale), expected: formatNumber(profile.coverage.expected, locale)}) : t("unknown")}</strong></div><div className="rounded-xl border border-sand-200 p-4"><p className="text-sm text-forest-600">{t("feedClosed")}</p><strong>{profile.period.to ? t("coverage", {complete: formatNumber(profile.coverage.feedClosed, locale), expected: formatNumber(profile.coverage.expected, locale)}) : t("unknown")}</strong></div></div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metric(t("deaths"), profile.results.deaths, profile.coverage.deathDays)}{metric(t("culls"), profile.results.culls, profile.coverage.cullDays)}{metric(t("losses"), profile.results.losses)}
            {metric(t("feedKg"), profile.results.feedKg, profile.coverage.feedQuantityDays)}{metric(t("feedPerBird"), profile.results.feedPerBirdGrams, profile.coverage.feedDays, profile.results.feedTargetGrams)}
            {metric(t("mortality"), profile.results.mortalityPct, profile.coverage.deathDays, profile.results.mortalityTargetPct)}
            {["layer", "parent_stock"].includes(profile.flock.type) ? <>{metric(t("eggs"), profile.results.eggs, profile.coverage.eggsDays)}{metric(t("production"), profile.results.productionPct, profile.coverage.productionDays, profile.results.productionTargetPct)}{metric(t("saleable"), profile.results.saleablePct, profile.coverage.qualityDays)}</> : <>{metric(t("latestWeight"), profile.results.latestWeight?.average_weight_g ?? null, undefined, profile.results.latestWeight?.targetWeightGrams)}{metric(t("growth"), profile.results.growthPerDay)}</>}
          </dl>
          {profile.results.latestWeight ? <p className="text-sm text-forest-600">{t("sampleDate", {date: date(profile.results.latestWeight.record_date)})}{profile.results.latestWeight.outsidePeriod ? ` · ${t("outside")}` : ""}</p> : null}
          {!["layer", "parent_stock"].includes(profile.flock.type) ? <section><h4 className="font-semibold text-forest-900">{t("weights")}</h4><ul className="mt-2 space-y-2">{profile.results.measurements.map((sample, index) => <li key={`${sample.record_date}:${index}`} className="flex flex-wrap justify-between gap-2 rounded-lg bg-sand-50 p-3 text-sm"><span>{date(sample.record_date)}</span><span>{number(sample.average_weight_g)} g · {t("target", {value: number(sample.targetWeightGrams)})}</span></li>)}</ul>{!profile.results.measurements.length ? <p className="mt-2 text-sm text-forest-600">{t("noWeights")}</p> : null}</section> : null}
          {(["missingDates", "missingFeedDates"] as const).map(key => profile.coverage[key].length ? <details className="rounded-xl border border-sand-200" key={key}><summary className="min-h-11 cursor-pointer p-3 font-semibold text-forest-900">{t(key)} ({formatNumber(profile.coverage[key].length, locale)})</summary><ul className="flex flex-wrap gap-2 p-3 pt-0 text-sm text-forest-700">{profile.coverage[key].map(value => <li key={value} className="rounded bg-sand-50 px-2 py-1">{date(value)}</li>)}</ul></details> : null)}
          {!archived ? <section className="rounded-xl border border-sand-200 p-4"><h4 className="font-semibold text-forest-900">{t("today", {date: date(profile.today)})}</h4>{profile.todayTasksAvailable ? profile.todayTasks.length ? <ul className="mt-2 space-y-2">{profile.todayTasks.map(task => <li key={task.code}><Link href={task.href} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 font-semibold text-forest-800 underline underline-offset-4">{todayT(todayTaskMessageKeys[task.code as TodayTaskCode])}<ChevronRight className="size-4"/></Link></li>)}</ul> : <p className="mt-2 text-sm text-forest-600">{t("todayComplete")}</p> : <p className="mt-2 text-sm text-forest-600">{t("todayUnavailable")}</p>}</section> : null}
          <section><h4 className="font-semibold text-forest-900">{t("nextSteps")}</h4><ul className="mt-3 space-y-3">{profile.steps.map(step => <li key={step.code} className={`rounded-xl border p-4 ${step.severity === "critical" ? "border-ember-300 bg-ember-50" : "border-sand-200 bg-sand-50"}`}><p className="text-xs font-semibold text-forest-700">{t(`severity.${step.severity}`)}{step.date ? ` · ${date(step.date)}` : ""}</p><p className="mt-1 text-sm leading-6 text-forest-900">{t(`steps.${step.code}`)}</p><Link href={step.href} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg font-semibold text-forest-800 underline underline-offset-4">{t(`actions.${step.href.startsWith("/app/today") ? step.code === "missing_records" ? "todayBirds" : "todayFeeding" : step.code}`)}<ChevronRight className="size-4"/></Link></li>)}</ul>{!profile.steps.length ? <p className="mt-2 text-sm text-forest-600">{t("noConcerns")}</p> : null}</section>
        </article>
      </>}
      <footer className="border-t border-sand-200 pt-4"><button type="button" disabled title={t("historyHelp")} className="min-h-11 cursor-not-allowed rounded-xl border border-sand-300 bg-sand-50 px-4 text-sm text-forest-600">{t("history")}</button><p className="mt-2 text-xs text-forest-600">{t("historyHelp")}</p>{profile&&!archived?<WholeFlockMove flockId={profile.flock.id}/>:null}</footer>
    </div></div>
  </section>;
}
