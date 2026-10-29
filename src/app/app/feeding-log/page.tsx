"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {useRouter, useSearchParams} from "next/navigation";
import {feedBatchChoices, feedSecondaryMode} from "@/lib/feed-navigation";
import {useLocale, useTranslations} from "next-intl";
import {OperationDateInput} from "@/components/operation-date-input";
import {formatNumber, formatOperationDate, formatOperationDateTime} from "@/i18n/formats";
import {buildHistoryHref} from "@/lib/history/contracts";
import {ReportAnalyticsHandoff} from "@/components/reports/report-analytics-handoff";
import {buildReportHref} from "@/lib/report-workspace";
import { AlertTriangle, Check, ChevronDown, Clock3, PackageOpen, RefreshCw, Scale, Wheat, X } from "lucide-react";

import { useFarmScope } from "@/components/farm-scope-context";
import { FarmScopeFilters } from "@/components/farm-scope-filters";
import { RecordCheckCorrectionBanner } from "@/components/record-check-correction-banner";
import {TodayEntryLink, useTodayEntryMode} from "@/components/today/today-entry-link";

type Metric = { value: number | null; unit: string; status: string; tone?: "neutral" | "good" | "warning" | "critical"; reason?: string; label?: string; actualKg?: number; plannedKg?: number; variancePct?: number | null; uniformityPct?: number | null; sampleCount?: number; kind?: string };
type Session = { id: string | null; session_name: string; session_time: string | null; planned_feed_kg: number; actual_feed_kg: number | null; feeders_count: number; status: string; feed_item_id: string | null; warehouse_id: string | null; feed_type: string | null; notes: string | null };
type TodayFlock = { id: string; flock_code: string; flock_type: string; current_count: number; plannedKg: number; actualKg: number; varianceKg: number; variancePct: number | null; closeStatus: string; sessions: Session[] };
type Trend = { date: string; plannedKg: number; actualKg: number | null; openingBirds: number | null; source: string; sourceLabel?: string };
type Task = { id: string; flock_id: string; due_date: string; due_week_number: number; status: string; result: string | null; displayStatus: string; displayStatusLabel?: string; batch_feed_template_rows?: { target_weight_min_g: number | null; target_weight_max_g: number | null } | null };
type Milestone = { id: string; title: string; notes: string | null; category: string; flockId: string; flockCode: string; dueDate: string; displayStatus: string; displayStatusLabel?: string; execution: { status: string } | null };
type TemplateRow = { week_number: number; age_day_start: number; age_day_end: number; feed_intake_std_g_per_head: number | null; feed_intake_recommended_g_per_head: number | null; target_weight_min_g: number | null; target_weight_max_g: number | null; feed_type_plan: string; light_on_time: string; light_off_time: string };
type FeedData = {
  meta: { batchId: string; today: string; dateFrom: string; dateTo: string; refreshedAt: string; confidence: string; confidenceLabel?: string; sources: Record<string, { status: string; error: string | null }> };
  batch: { batch_code: string; ageDays: number; totalBirds: number; flockTypes: string[] };
  today: { flocks: TodayFlock[] };
  kpis: { planCompletion: Metric; feedVariance: Metric; feedPerBirdDay: Metric; stockCover: Metric; weight: Metric; fcr: Metric; coverage: Metric & { coveredDays: number; expectedDays: number; legacyDays: number } };
  trends: { daily: Trend[] };
  inventory: { balances: Array<{ itemId: string; itemName: string; warehouseId: string; warehouseName: string; onHand: number; unit: string }>; totalOnHand: number; estimatedValue: number };
  financials: { feedCostEtb: number | null; costCoveragePct: number | null; leftoversKg: number; leftoverPct: number | null; confidence: string; confidenceLabel?: string };
  template: ({ id: string; name: string; source_type: string; rows: TemplateRow[]; currentTarget: TemplateRow | null } | null);
  templateVersions: Array<{ id: string; name: string; source_type: string; is_active: boolean; created_at: string }>;
  suggestedRows: TemplateRow[];
  tasks: Task[];
  milestones: Milestone[];
  nextCheck: Partial<Task> & { displayStatus: string };
  exceptions: Array<{ severity: string; title: string; reason: string; action: string; actionTarget?: "template_management" | "today_sessions" | "feed_history" }>;
  settings: { warningVariancePct: number; criticalVariancePct: number };
  permissions: { canManage: boolean; canConfigure: boolean; canRecordWeight: boolean; templateChangeMode: "governance" | "direct" | "read_only" };
};

const feedTypes = [
  ["starter_feed", "Starter feed"], ["grower_pullet_feed", "Grower / pullet feed"], ["layer_feed", "Layer feed"], ["broiler_feed", "Broiler feed"], ["medicated_feed", "Medicated feed"],
] as const;


function Status({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warning" | "critical" }) {
  const styles = tone === "good" ? "bg-emerald-50 text-emerald-800" : tone === "warning" ? "bg-amber-50 text-amber-900" : tone === "critical" ? "bg-red-50 text-red-800" : "bg-stone-100 text-stone-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}>{children}</span>;
}

function KpiCard({ title, metric, icon }: { title: string; metric: Metric; icon: React.ReactNode }) {
  const ui = useTranslations("OperationUI");
  const evidence = useTranslations("FeedEvidence");
  const locale = useLocale();
  const fmt = (value: number | null, places = 1) => value === null ? ui("unavailable") : formatNumber(value, locale, places);
  const tone = metric.value === null ? "neutral" : metric.tone ?? (metric.label?.includes("Critical") || metric.status === "Review" ? "critical" : metric.label?.includes("Review") ? "warning" : "good");
  return <article className="rounded-2xl border border-[#e5d9c4] bg-white p-4 shadow-[0_1px_2px_rgba(36,51,40,.04)]">
    <div className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#f2eee4] text-[#274331]">{icon}</span><Status tone={tone}>{metric.value === null ? metric.status ?? ui("unavailable") : metric.label ?? metric.status ?? ui("unavailable")}</Status></div>
    <h3 className="mt-5 text-[11px] font-semibold uppercase tracking-[.19em] text-[#536958]">{title}</h3>
    <p className="mt-1 text-2xl font-semibold text-[#142c20]">{fmt(metric.value)}{metric.value !== null && <span className="ml-1 text-sm font-medium text-[#657468]">{({g: evidence("grams"), kg: evidence("kilograms"), days: evidence("days"), "g/bird/day": evidence("gramsBirdDay"), "kg/kg": evidence("kgRatio")} as Record<string, string>)[metric.unit] ?? metric.unit}</span>}</p>
    {metric.reason && <p className="mt-2 text-xs leading-5 text-[#657468]">{metric.reason}</p>}
  </article>;
}

export default function FeedControlPage() {
  const ui = useTranslations("OperationUI");
  const evidence = useTranslations("FeedEvidence");
  const locale = useLocale();
  const t = useTranslations("ManagerDestinations");
  const navigation = useTranslations("Navigation");
  const { scope, setScope, period, batches, flocks, loading: scopeLoading } = useFarmScope();
  const {enabled: todayEntryEnabled} = useTodayEntryMode();
  const router = useRouter();
  const queryString = useSearchParams().toString();
  const secondaryMode = feedSecondaryMode(new URLSearchParams(queryString), todayEntryEnabled);
  const [data, setData] = useState<FeedData | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [templateOpen, setTemplateOpen] = useState(() => secondaryMode === "template_management"); const [weightTask, setWeightTask] = useState<Task | null>(null);
  const deepLinkHandled = useRef(false);

  const openFeedAction = useCallback((target: NonNullable<FeedData["exceptions"][number]["actionTarget"]>) => {
    if (todayEntryEnabled && target === "feed_history" && new URLSearchParams(window.location.search).get("feed_target") !== "feed_history") {router.push(buildReportHref("feed", {...period, ...scope})); return;}
    if (target === "template_management") setTemplateOpen(true);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const targetId = target === "template_management" ? "feed-template-management" : target === "today_sessions" ? "today-feed-sessions" : "feed-history";
      const section = document.getElementById(targetId);
      if (target === "feed_history") section?.querySelector("details")?.setAttribute("open", "");
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
      section?.focus({ preventScroll: true });
    }));
  }, [todayEntryEnabled, router, scope, period]);

  const activeBatches = useMemo(() => {
    const scopedFlock = scope.flockId ? flocks.find((flock) => flock.id === scope.flockId) : null;
    const eligible = batches
      .filter((batch) => !scope.branchId || batch.branch_id === scope.branchId)
      .filter((batch) => !scope.farmId || batch.farm_id === scope.farmId)
      .filter((batch) => !scope.houseId || batch.house_id === scope.houseId)
      .filter((batch) => !scopedFlock || scopedFlock.batch_id === batch.id)
      .sort((left, right) => String(right.placement_date ?? "").localeCompare(String(left.placement_date ?? "")));
    return feedBatchChoices(eligible, scope.batchId, new URLSearchParams(queryString));
  }, [batches, flocks, scope.branchId, scope.farmId, scope.flockId, scope.houseId, scope.batchId, queryString]);
  const batchQuery = new URLSearchParams(queryString);
  const requestedBatch = batchQuery.get("filter_batchId");
  // FarmScope restores only filter_batchId; never substitute a remembered batch for an alias.
  const secondaryTargetUnavailable = Boolean(secondaryMode && ((batchQuery.has("batch_id") && batchQuery.get("batch_id") !== requestedBatch) || (requestedBatch && !activeBatches.some(batch => batch.id === requestedBatch))));

  useEffect(() => {
    if (scopeLoading || secondaryTargetUnavailable || activeBatches.length === 0) return;
    if (activeBatches.some((batch) => batch.id === scope.batchId)) return;
    setScope((current) => ({ ...current, batchId: activeBatches[0].id }));
  }, [activeBatches, scope.batchId, scopeLoading, secondaryTargetUnavailable, setScope]);

  const load = useCallback(async () => {
    if (!scope.batchId || secondaryTargetUnavailable) { setData(null); setError(""); return; }
    setLoading(true); setError(""); setData((current) => current?.meta.batchId === scope.batchId ? current : null);
    const params = new URLSearchParams({ batch_id: scope.batchId, date_from: period.dateFrom, date_to: period.dateTo });
    try { const response = await fetch(`/api/feed/control?${params}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? evidence("loadFailed")); setData(body as FeedData); }
    catch (cause) { setError(cause instanceof Error ? cause.message : evidence("loadFailed")); } finally { setLoading(false); }
  }, [period.dateFrom, period.dateTo, scope.batchId, secondaryTargetUnavailable, evidence]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!data || deepLinkHandled.current) return;
    const target = new URLSearchParams(window.location.search).get("feed_target");
    if (target !== "template_management" && target !== "today_sessions" && target !== "feed_history") return;
    deepLinkHandled.current = true;
    openFeedAction(target);
  }, [data, openFeedAction]);

  if (scopeLoading) return <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 lg:p-10"><LoadingState /></main>;
  if (secondaryTargetUnavailable) return <main className="p-6"><p role="alert">{t("noBatch")}</p></main>;
  if (!scope.batchId && activeBatches.length > 0) return <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 lg:p-10"><LoadingState /></main>;

  if (!scope.batchId && !secondaryMode) return <main className="mx-auto w-full max-w-[1560px] p-4 sm:p-6 lg:p-10">
    <FarmScopeFilters title={ui("feedControlFilters")} fields={["branch", "farm"]} showPeriod />
    <section className="rounded-3xl border border-[#ded2bc] bg-[#183324] p-7 text-white shadow-sm sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[.25em] text-[#d8c89a]">{ui("feedControl")}</p><h1 className="mt-3 text-3xl font-semibold">{ui("noActiveBatchIsAvailable")}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d6dfd8]">{ui("feedControlOpensActiveBatchesOnlyActivateOrCreateA")}</p>
      <Link href="/app/batches" className="mt-7 inline-flex min-h-11 items-center rounded-xl border border-white/20 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{ui("manageBatches")}</Link>
    </section>
  </main>;

  if (secondaryMode) return <main className="mx-auto w-full max-w-[1560px] space-y-5 p-4 sm:p-6 lg:p-10">
    <header className="rounded-2xl bg-forest-900 p-6 text-white"><h1 className="font-display text-3xl">{secondaryMode === "template_management" ? navigation("templates") : t("weights")}</h1><p className="mt-2 text-sm text-sand-100">{t((secondaryMode === "template_management" ? "configurationHelp" : "weightsHelp") as Parameters<typeof t>[0])}</p><nav className="mt-4 flex flex-wrap gap-3" aria-label={t("related")}><TodayEntryLink task="feeding" className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-4">{navigation("today")}</TodayEntryLink><Link className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-4" href={buildHistoryHref({category: "feeding", from: period.dateFrom, to: period.dateTo, farm: scope.farmId, house: scope.houseId, flock: scope.flockId, batch: scope.batchId})}>{navigation("history")}</Link><Link className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-4" href={buildReportHref("feed", {...period, ...scope})}>{navigation("performance")}</Link></nav></header>
    <FarmScopeFilters title={t("scope")} fields={["branch", "farm"]}/>
    <label className="grid gap-2 text-sm font-semibold">{t("batch")}<select value={scope.batchId} onChange={event => setScope(current => ({...current, batchId: event.target.value}))} className="min-h-12 rounded-xl border border-sand-300 bg-white px-3"><option value="">{t("chooseBatch")}</option>{activeBatches.map(batch => <option key={batch.id} value={batch.id}>{batch.batch_code}</option>)}</select></label>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p> : null}{message ? <p role="status">{message}</p> : null}
    {!scope.batchId ? <p role="status">{t("noBatch")}</p> : loading && !data ? <LoadingState/> : data ? secondaryMode === "template_management" ? <TemplateManager data={data} open={templateOpen} setOpen={setTemplateOpen} reload={load} announce={setMessage} batchId={scope.batchId}/> : <><WeightTasks data={data} onRecord={setWeightTask}/>{weightTask ? <WeightDrawer task={weightTask} date={data.meta.today} close={() => setWeightTask(null)} reload={load} announce={setMessage}/> : null}</> : null}
  </main>;

  return <main className="mx-auto w-full max-w-[1560px] space-y-6 p-4 sm:p-6 lg:p-10">
    <RecordCheckCorrectionBanner />
    <FarmScopeFilters title={ui("feedControlFilters")} fields={["branch", "farm"]} showPeriod />
    <header className="flex flex-col gap-4 rounded-3xl border border-[#ded2bc] bg-[#183324] p-6 text-white shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[11px] font-semibold uppercase tracking-[.25em] text-[#dac99c]">{ui("dailyRationLedger")}</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{ui("feedControl2")}</h1><p className="mt-2 text-sm text-[#d6dfd8]">{data ? evidence("batchSummary", {name: data.batch.batch_code, age: data.batch.ageDays, birds: data.batch.totalBirds}) : ui("loadingBatchContext")}</p></div>
      <div className="flex flex-wrap items-end gap-2 text-xs">
        <label className="grid gap-1 text-[#d6dfd8]">{ui("activeBatch")}<select value={scope.batchId} onChange={(event) => setScope((current) => ({ ...current, batchId: event.target.value }))} className="min-h-11 min-w-52 rounded-xl border border-white/20 bg-white/10 px-3 font-semibold text-white outline-none focus:ring-2 focus:ring-[#d8c89a]"><option value="" className="text-[#183324]">{ui("selectBatch")}</option>{activeBatches.map((batch) => <option key={batch.id} value={batch.id} className="text-[#183324]">{batch.batch_code}</option>)}</select></label>
        <Status tone={data?.meta.confidence === "Actual" ? "good" : "warning"}>{data?.meta.confidenceLabel ?? (data?.meta.confidence === "Actual" ? evidence("actual") : data?.meta.confidence === "Estimate" ? evidence("estimate") : evidence("loading"))}</Status><span className="pb-3">{period.dateFrom} — {period.dateTo}</span><button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><RefreshCw className={`size-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />{ui("refresh")}</button>
      </div>
    </header>
    <div aria-live="polite" className="sr-only">{message || error || (loading ? "Loading Feed Control" : "")}</div>
    {error && <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => void load()} className="underline">{ui("retry")}</button></div>}
    {loading && !data ? <LoadingState /> : data && <>
      <TodayFeeding data={data} reload={load} announce={setMessage} todayEntryEnabled={todayEntryEnabled} />
      <section aria-labelledby="feed-actions-title"><div className="mb-3 flex items-end justify-between"><div><h2 id="feed-actions-title" className="text-xl font-semibold text-[#173225]">{ui("actionQueue")}</h2><p className="mt-1 text-sm text-[#647267]">{ui("onlyExceptionsWithAPreciseCauseAndRecoveryAction")}</p></div><Status tone={data.exceptions.length ? "warning" : "good"}>{data.exceptions.length ? `${data.exceptions.length} open` : ui("clear")}</Status></div>
        {data.exceptions.length ? <div className="grid gap-3 lg:grid-cols-2">{data.exceptions.map((item) => <article key={`${item.title}-${item.reason}`} className="rounded-2xl border border-[#e5d9c4] bg-white p-4"><div className="flex gap-3"><AlertTriangle className={`mt-0.5 size-5 shrink-0 ${item.severity === "critical" ? "text-red-600" : "text-amber-600"}`} /><div><h3 className="font-semibold text-[#193426]">{item.title}</h3><p className="mt-1 text-sm leading-6 text-[#637167]">{item.reason}</p>{item.actionTarget ? <button type="button" onClick={() => openFeedAction(item.actionTarget!)} className="mt-2 min-h-11 rounded-lg text-left text-xs font-semibold uppercase tracking-wide text-[#8a6735] underline decoration-[#cbb98f] underline-offset-4 hover:text-[#173225] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#244b35]">{item.action}</button> : <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#8a6735]">{item.action}</p>}</div></div></article>)}</div> : <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{ui("noFeedControlExceptionsInThisScope")}</div>}
      </section>
      <ReportAnalyticsHandoff section="feed">
      <section aria-labelledby="feed-kpis-title"><h2 id="feed-kpis-title" className="mb-3 text-xl font-semibold text-[#173225]">{ui("controlMetrics")}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><KpiCard title={ui("planCompletion")} metric={data.kpis.planCompletion} icon={<Check className="size-4" />} /><KpiCard title={ui("feedVariance")} metric={data.kpis.feedVariance} icon={<Wheat className="size-4" />} /><KpiCard title={ui("feedBirdDay")} metric={data.kpis.feedPerBirdDay} icon={<Clock3 className="size-4" />} /><KpiCard title={ui("stockCover")} metric={data.kpis.stockCover} icon={<PackageOpen className="size-4" />} /><KpiCard title={ui("weightResponse")} metric={data.kpis.weight} icon={<Scale className="size-4" />} /><KpiCard title={data.kpis.fcr.kind ?? "Applicable FCR"} metric={data.kpis.fcr} icon={<span className="text-xs font-bold">{ui("fcr")}</span>} /></div></section>
      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]"><FeedTrend data={data} /><InventoryPanel data={data} /></div>
      </ReportAnalyticsHandoff>
      <WeightTasks data={data} onRecord={setWeightTask} />
      <MilestoneTimeline data={data} reload={load} announce={setMessage} />
      <TemplateManager data={data} open={templateOpen} setOpen={setTemplateOpen} reload={load} announce={setMessage} batchId={scope.batchId} />
      <details className="rounded-2xl border border-[#e5d9c4] bg-white p-5"><summary className="min-h-11 cursor-pointer text-base font-semibold text-[#173225]">{ui("dataTrustAndSourceStatus")}</summary><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(data.meta.sources).map(([name, source]) => <div key={name} className="rounded-xl bg-[#f7f4ed] p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold capitalize text-[#173225]">{evidence.has((`sources.${name}`) as Parameters<typeof evidence>[0]) ? evidence((`sources.${name}`) as Parameters<typeof evidence>[0]) : name.replaceAll(/([A-Z])/g, " $1")}</span><Status tone={source.status === "available" ? "good" : "critical"}>{source.status === "available" ? evidence("available") : evidence("sourceFailed")}</Status></div>{source.error && <p className="mt-2 text-xs text-red-700">{source.error}</p>}</div>)}</div><p className="mt-4 text-xs text-[#68766b]">{ui("refreshed")} {formatOperationDateTime(data.meta.refreshedAt, locale)} {ui("addisAbabaReportingBoundaryConfidence")} {data.meta.confidenceLabel ?? (data.meta.confidence === "Actual" ? evidence("actual") : data.meta.confidence === "Estimate" ? evidence("estimate") : evidence("unavailable"))}.</p></details>
      {weightTask && <WeightDrawer task={weightTask} date={data.meta.today} close={() => setWeightTask(null)} reload={load} announce={setMessage} />}
    </>}
  </main>;
}

function LoadingState() {
  const ui = useTranslations("OperationUI"); return <div className="grid animate-pulse gap-4 motion-reduce:animate-none sm:grid-cols-2 xl:grid-cols-3" aria-label={ui("loadingFeedData")}>{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-40 rounded-2xl bg-stone-200" />)}</div>; }

function TodayFeeding({ data, reload, announce, todayEntryEnabled }: { data: FeedData; reload: () => Promise<void>; announce: (value: string) => void; todayEntryEnabled: boolean }) {
  const ui = useTranslations("OperationUI");
  const evidence = useTranslations("FeedEvidence");
  const locale = useLocale();
  return <section id="today-feed-sessions" tabIndex={-1} aria-labelledby="today-feed-title" className="scroll-mt-6 rounded-3xl border border-[#ded2bc] bg-[#f7f2e7] p-4 outline-none focus-visible:ring-2 focus-visible:ring-[#244b35] sm:p-6"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#7e6537]">{formatOperationDate(`${data.meta.today}T12:00:00Z`, locale)}</p><h2 id="today-feed-title" className="mt-1 text-2xl font-semibold text-[#173225]">{ui("todaySFeeding")}</h2><p className="mt-1 text-sm text-[#657468]">{ui("completeEachRationThenCloseTheFlockDayToSynchronize")}</p></div><div className="text-xs text-[#657468]">{evidence("coverage", {covered: formatNumber(data.kpis.coverage.coveredDays, locale), expected: data.kpis.coverage.expectedDays == null ? evidence("unavailable") : formatNumber(data.kpis.coverage.expectedDays, locale)})}{data.kpis.coverage.legacyDays ? ` · ${evidence("legacyDays", {count: data.kpis.coverage.legacyDays})}` : ""}</div></div>
    <div className="mt-5 space-y-4">{data.today.flocks.map((flock) => todayEntryEnabled && flock.closeStatus !== "closed" ? <article key={flock.id} className="rounded-2xl border border-amber-300 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-semibold text-[#173225]">{flock.flock_code}</h3><p className="mt-1 text-sm text-[#657468]">{ui("recordAndCloseThisFlockSFeedingInsideTodayFeed")}</p></div><TodayEntryLink task="feeding" target={{flockId:flock.id,date:data.meta.today}} className="inline-flex min-h-11 items-center rounded-xl bg-[#244b35] px-4 text-sm font-semibold text-white">{ui("openTodaySFeeding")}</TodayEntryLink></div></article> : <FlockLedger key={`${flock.id}-${data.meta.refreshedAt}`} flock={flock} data={data} reload={reload} announce={announce} />)}</div>
  </section>;
}

function FlockLedger({ flock, data, reload, announce }: { flock: TodayFlock; data: FeedData; reload: () => Promise<void>; announce: (value: string) => void }) {
  const ui = useTranslations("OperationUI");
  const evidence = useTranslations("FeedEvidence");
  const types = useTranslations("History.codes");
  const locale = useLocale();
  const [sessions, setSessions] = useState(flock.sessions); const [saving, setSaving] = useState(""); const [override, setOverride] = useState(""); const [reopen, setReopen] = useState("");
  const dirty = JSON.stringify(sessions) !== JSON.stringify(flock.sessions);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  function addSession() { setSessions((current) => [...current, { id: null, session_name: evidence("additionalSession", {number: current.length + 1}), session_time: null, planned_feed_kg: 0, actual_feed_kg: null, feeders_count: 1, status: "planned", feed_item_id: null, warehouse_id: null, feed_type: current[0]?.feed_type ?? null, notes: null }]); }
  async function save(session: Session) { setSaving(session.session_name); const response = await fetch("/api/feed/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: data.meta.batchId, flockId: flock.id, recordDate: data.meta.today, sessionName: session.session_name, sessionTime: session.session_time, plannedFeedKg: session.planned_feed_kg, actualFeedKg: session.actual_feed_kg, feedersCount: session.feeders_count, status: session.status, feedItemId: session.feed_item_id, warehouseId: session.warehouse_id, feedType: session.feed_type, notes: session.notes }) }); const body = await response.json(); setSaving(""); if (!response.ok) { announce(body.error); return; } announce(evidence("sessionSaved", {name: session.session_name})); await reload(); }
  async function remove(session: Session, index: number) { if (!session.id) { setSessions((rows) => rows.filter((_, i) => i !== index)); return; } const response = await fetch("/api/feed/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: session.id, batchId: data.meta.batchId }) }); const body = await response.json(); if (!response.ok) { announce(body.error); return; } announce(evidence("sessionRemoved", {name: session.session_name})); await reload(); }
  async function closeDay(method: "POST" | "DELETE") { const reason = method === "POST" ? override : reopen; const response = await fetch("/api/feed/day-close", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: data.meta.batchId, flockId: flock.id, recordDate: data.meta.today, overrideReason: method === "POST" ? reason : undefined, reason: method === "DELETE" ? reason : undefined }) }); const body = await response.json(); if (!response.ok) { announce(body.error); return; } announce(method === "POST" ? evidence("dayClosed") : evidence("dayReopened")); await reload(); }
  const balances = data.inventory.balances;
  return <article className="overflow-hidden rounded-2xl border border-[#ded2bc] bg-white"><header className="flex flex-col gap-3 border-b border-[#eee5d5] px-4 py-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><h3 className="font-semibold text-[#173225]">{flock.flock_code}</h3><Status tone={flock.closeStatus === "closed" ? "good" : "warning"}>{flock.closeStatus === "closed" ? ui("dayClosed") : ui("dayOpen")}</Status></div><p className="mt-1 text-xs text-[#68766b]">{types.has((flock.flock_type) as Parameters<typeof types>[0]) ? types((flock.flock_type) as Parameters<typeof types>[0]) : flock.flock_type} · {formatNumber(flock.current_count, locale)} {ui("birds2")} {flock.actualKg} / {flock.plannedKg} {ui("kg")}</p></div><div className="flex items-center gap-3"><div className="h-2 w-full overflow-hidden rounded-full bg-[#ebe5d8] lg:w-64" aria-label={evidence("recordedQuantity", {actual: formatNumber(flock.actualKg, locale), planned: formatNumber(flock.plannedKg, locale)})}><div className="h-full rounded-full bg-[#bd8a36] transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, flock.plannedKg ? flock.actualKg / flock.plannedKg * 100 : 0)}%` }} /></div>{flock.closeStatus !== "closed" && data.permissions.canManage && <button type="button" onClick={addSession} className="min-h-11 whitespace-nowrap rounded-xl border border-[#bba981] px-3 text-xs font-semibold text-[#173225]">{ui("addSession")}</button>}</div></header>
    <div className="divide-y divide-[#eee5d5]">{sessions.map((session, index) => <div key={`${session.session_name}-${index}`} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1.1fr_.8fr_.8fr_.8fr_1fr_1fr_auto] xl:items-end">
      <label className="text-xs font-medium text-[#4e6253]">{ui("session")}<input name={`session-${flock.id}-${index}`} value={session.session_name} disabled={flock.closeStatus === "closed" || Boolean(session.id)} onChange={(event) => setSessions((rows) => rows.map((row, i) => i === index ? { ...row, session_name: event.target.value } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] bg-white px-3 text-sm text-[#183225] disabled:bg-stone-50" /></label>
      <label className="text-xs font-medium text-[#4e6253]">{ui("time")}<input name={`time-${flock.id}-${index}`} type="time" value={session.session_time?.slice(0, 5) ?? ""} disabled={flock.closeStatus === "closed"} onChange={(event) => setSessions((rows) => rows.map((row, i) => i === index ? { ...row, session_time: event.target.value } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] px-3 text-sm" /></label>
      <label className="text-xs font-medium text-[#4e6253]">{ui("plannedKg")}<input name={`plan-${flock.id}-${index}`} type="number" min="0.01" step="0.01" value={session.planned_feed_kg} disabled={flock.closeStatus === "closed"} onChange={(event) => setSessions((rows) => rows.map((row, i) => i === index ? { ...row, planned_feed_kg: Number(event.target.value) } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] px-3 text-sm" /></label>
      <label className="text-xs font-medium text-[#4e6253]">{ui("actualKg")}<input name={`actual-${flock.id}-${index}`} type="number" min="0" step="0.01" value={session.actual_feed_kg ?? ""} disabled={flock.closeStatus === "closed"} onChange={(event) => setSessions((rows) => rows.map((row, i) => i === index ? { ...row, actual_feed_kg: event.target.value === "" ? null : Number(event.target.value), status: event.target.value === "" ? "planned" : "completed" } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] px-3 text-sm" /></label>
      <label className="text-xs font-medium text-[#4e6253]">{ui("feedStock")}<select name={`item-${flock.id}-${index}`} value={session.feed_item_id ?? ""} disabled={flock.closeStatus === "closed"} onChange={(event) => setSessions((rows) => rows.map((row, i) => i === index ? { ...row, feed_item_id: event.target.value || null } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] bg-white px-3 text-sm"><option value="">{ui("selectItem")}</option>{Array.from(new Map(balances.map((row) => [row.itemId, row])).values()).map((row) => <option key={row.itemId} value={row.itemId}>{row.itemName}</option>)}</select></label>
      <label className="text-xs font-medium text-[#4e6253]">{ui("warehouse")}<select name={`warehouse-${flock.id}-${index}`} value={session.warehouse_id ?? ""} disabled={flock.closeStatus === "closed"} onChange={(event) => setSessions((rows) => rows.map((row, i) => i === index ? { ...row, warehouse_id: event.target.value || null } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] bg-white px-3 text-sm"><option value="">{ui("selectWarehouse")}</option>{Array.from(new Map(balances.map((row) => [row.warehouseId, row])).values()).map((row) => <option key={row.warehouseId} value={row.warehouseId}>{row.warehouseName}</option>)}</select></label>
      <button type="button" disabled={!data.permissions.canManage || flock.closeStatus === "closed" || saving === session.session_name} onClick={() => void save(session)} className="min-h-11 rounded-xl bg-[#244b35] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving === session.session_name ? ui("saving") : ui("save")}</button>
      <label className="text-xs font-medium text-[#4e6253] xl:col-span-2">{ui("feedType")}<select name={`feedtype-${flock.id}-${index}`} value={session.feed_type ?? ""} disabled={flock.closeStatus === "closed"} onChange={(event) => setSessions((rows) => rows.map((row, i) => i === index ? { ...row, feed_type: event.target.value } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] bg-white px-3 text-sm"><option value="">{ui("selectType")}</option>{feedTypes.map(([value]) => <option key={value} value={value}>{types((value) as Parameters<typeof types>[0])}</option>)}</select></label>
      <label className="text-xs font-medium text-[#4e6253] xl:col-span-4">{ui("notes")}<input name={`notes-${flock.id}-${index}`} value={session.notes ?? ""} disabled={!data.permissions.canManage||flock.closeStatus === "closed"} onChange={(event) => setSessions((rows) => rows.map((row, i) => i === index ? { ...row, notes: event.target.value } : row))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] px-3 text-sm disabled:bg-stone-50" /></label>{flock.closeStatus !== "closed" && data.permissions.canManage && <button type="button" onClick={() => void remove(session, index)} className="min-h-11 rounded-xl px-3 text-xs font-semibold text-red-700 underline">{ui("remove")}</button>}
    </div>)}</div>
    <footer className="flex flex-col gap-3 bg-[#fbf8f1] p-4 sm:flex-row sm:items-end sm:justify-end">{!data.permissions.canManage?<span className="rounded-xl border border-[#d9ceb9] px-4 py-3 text-xs font-semibold text-[#4e6253]">{ui("executiveEvidenceViewFeedEntryIsDisabled")}</span>:flock.closeStatus === "closed" ? <><label className="w-full text-xs font-medium text-[#4e6253] sm:max-w-sm">{ui("reasonToReopen")}<input name={`reopen-${flock.id}`} value={reopen} onChange={(event) => setReopen(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] px-3 text-sm" /></label><button type="button" disabled={!reopen.trim()} onClick={() => void closeDay("DELETE")} className="min-h-11 rounded-xl border border-[#bba981] px-4 text-sm font-semibold text-[#173225] disabled:opacity-50">{ui("reopenDay")}</button></> : <><label className="w-full text-xs font-medium text-[#4e6253] sm:max-w-md">{ui("stockOverrideReason")} <span className="font-normal">{ui("onlyIfNeeded")}</span><input name={`override-${flock.id}`} value={override} onChange={(event) => setOverride(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ceb9] px-3 text-sm" /></label><button type="button" onClick={() => void closeDay("POST")} className="min-h-11 rounded-xl bg-[#b77b21] px-5 text-sm font-semibold text-white hover:bg-[#9a6519]">{ui("closeFeedingDay")}</button></>}</footer>
  </article>;
}

function FeedTrend({ data }: { data: FeedData }) {
  const ui = useTranslations("OperationUI");
  const evidence = useTranslations("FeedEvidence");
  const locale = useLocale();
  const dateLabel = (value: string) => formatOperationDate(`${value}T12:00:00Z`, locale);
  const visible = data.trends.daily.slice(-30); const max = Math.max(1, ...visible.flatMap((row) => [row.plannedKg, row.actualKg ?? 0]));
  return <section id="feed-history" tabIndex={-1} aria-labelledby="feed-history-title" className="scroll-mt-6 rounded-2xl border border-[#e5d9c4] bg-white p-5 outline-none focus-visible:ring-2 focus-visible:ring-[#244b35]"><div className="flex items-end justify-between"><div><h2 id="feed-history-title" className="text-lg font-semibold text-[#173225]">{ui("feedVersusTarget")}</h2><p className="mt-1 text-sm text-[#68766b]">{ui("closedSessionsAreAuthoritativeLegacyTotalsAreLabelled")}</p></div><div className="flex gap-3 text-xs text-[#68766b]"><span><i className="mr-1 inline-block size-2 rounded-full bg-[#c08a32]" />{ui("plan")}</span><span><i className="mr-1 inline-block size-2 rounded-full bg-[#244b35]" />{ui("actual")}</span></div></div>
    <div className="mt-6 flex h-52 items-end gap-1" role="img" aria-label={evidence("chartRange", {from: formatOperationDate(`${data.meta.dateFrom}T12:00:00Z`, locale), to: formatOperationDate(`${data.meta.dateTo}T12:00:00Z`, locale)})}>{visible.map((row) => <div key={row.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-px"><span className="w-[42%] rounded-t-sm bg-[#c08a32]/55" style={{ height: `${row.plannedKg / max * 100}%` }} /><span className="w-[42%] rounded-t-sm bg-[#244b35]" style={{ height: `${(row.actualKg ?? 0) / max * 100}%` }} /><span className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded bg-[#173225] px-2 py-1 text-[10px] text-white group-hover:block group-focus-within:block">{dateLabel(row.date)}: {row.actualKg ?? evidence("unavailable")} / {row.plannedKg} {ui("kg")}</span></div>)}</div>
    <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[#365340]">{ui("exactDailyValues")}</summary><div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-[#68766b]"><tr><th className="p-2">{ui("date")}</th><th className="p-2">{ui("plan")}</th><th className="p-2">{ui("actual")}</th><th className="p-2">{ui("source")}</th></tr></thead><tbody>{visible.map((row) => <tr key={row.date} className="border-t border-[#eee5d5]"><td className="p-2">{dateLabel(row.date)}</td><td className="p-2">{row.plannedKg} {ui("kg")}</td><td className="p-2">{row.actualKg === null ? ui("missing") : `${formatNumber(row.actualKg, locale)} ${ui("kg")}`}</td><td className="p-2">{row.sourceLabel ?? row.source}</td></tr>)}</tbody></table></div></details>
  </section>;
}

function InventoryPanel({ data }: { data: FeedData }) {
  const fmt = (value: number | null, places = 1) => value === null ? ui("unavailable") : formatNumber(value, locale, places);
  const locale = useLocale();
  const ui = useTranslations("OperationUI");
  const evidence = useTranslations("FeedEvidence"); return <section className="rounded-2xl border border-[#e5d9c4] bg-white p-5"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-[#173225]">{ui("feedAvailabilityAndCost")}</h2><p className="mt-1 text-sm text-[#68766b]">{ui("compatibleKilogramStockByWarehouse")}</p></div><Status tone={data.kpis.stockCover.value !== null && data.kpis.stockCover.value >= 7 ? "good" : "warning"}>{fmt(data.kpis.stockCover.value)} {ui("days")}</Status></div><div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[#f7f4ed] p-3"><div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#68766b]">{ui("periodFeedCost")}</p><p className="mt-1 font-semibold text-[#173225]">{data.financials.feedCostEtb === null ? ui("unavailable") : `ETB ${fmt(data.financials.feedCostEtb, 0)}`}</p><p className="mt-1 text-[10px] text-[#68766b]">{data.financials.confidenceLabel ?? (data.financials.confidence === "Actual" ? evidence("actual") : evidence("unavailable"))} · {fmt(data.financials.costCoveragePct)}{ui("costed")}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#68766b]">{ui("recordedLeftovers")}</p><p className="mt-1 font-semibold text-[#173225]">{fmt(data.financials.leftoversKg)} {ui("kg")}</p><p className="mt-1 text-[10px] text-[#68766b]">{fmt(data.financials.leftoverPct)}{ui("ofRecordedFeed")}</p></div></div><div className="mt-3 divide-y divide-[#eee5d5]">{data.inventory.balances.length ? data.inventory.balances.map((row) => <div key={`${row.itemId}-${row.warehouseId}`} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-semibold text-[#173225]">{row.itemName}</p><p className="text-xs text-[#68766b]">{row.warehouseName}</p></div><p className="text-sm font-semibold tabular-nums text-[#173225]">{fmt(row.onHand)} {row.unit}</p></div>) : <p className="py-8 text-center text-sm text-[#68766b]">{ui("noCompatibleFeedInventoryBalanceIsAvailable")}</p>}</div><Link href="/app/inventory" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[#365b42] underline underline-offset-4">{ui("openInventory")}</Link></section>; }

function WeightTasks({ data, onRecord }: { data: FeedData; onRecord: (task: Task) => void }) { const t = useTranslations("FeedChecks"); const locale = useLocale(); const relevant = data.tasks.filter((task) => task.status !== "completed").slice(0, 10); return <section className="rounded-2xl border border-[#e5d9c4] bg-white p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-[#173225]">{t("title")}</h2><p className="mt-1 text-sm text-[#68766b]">{t("help")}</p></div><Status tone={relevant.some((task) => task.displayStatus === "Overdue") ? "warning" : "good"}>{relevant.length ? t("open", {count: relevant.length}) : t("complete")}</Status></div><div className="mt-4 grid gap-2">{relevant.map((task) => <div key={task.id} className="flex flex-col gap-3 rounded-xl border border-[#eee5d5] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[#173225]">{t("week", {week: formatNumber(task.due_week_number, locale)})}</p><p className="mt-1 text-xs text-[#68766b]">{t("due", {date: formatOperationDate(`${task.due_date}T12:00:00Z`, locale), status: task.displayStatusLabel ?? (task.displayStatus === "Overdue" ? t("overdue") : task.displayStatus === "Scheduled" ? t("scheduled") : task.displayStatus)})}</p></div>{data.permissions.canRecordWeight && <button type="button" onClick={() => onRecord(task)} className="min-h-12 rounded-xl border border-[#bba981] px-4 text-sm font-semibold text-[#173225]">{t("record")}</button>}</div>)}{!relevant.length && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{t("empty")}</p>}</div></section>; }

function MilestoneTimeline({ data, reload, announce }: { data: FeedData; reload: () => Promise<void>; announce: (value: string) => void }) {
  const ui = useTranslations("OperationUI");
  const evidence = useTranslations("FeedEvidence");
  const locale = useLocale();
  const relevant = data.milestones.filter((item) => !item.execution).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 12);
  async function complete(item: Milestone, status: "completed" | "skipped") { const response = await fetch("/api/feed/milestones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ milestoneId: item.id, flockId: item.flockId, status }) }); const body = await response.json(); if (!response.ok) { announce(body.error); return; } announce(status === "completed" ? evidence("milestoneCompleted") : evidence("milestoneSkipped")); await reload(); }
  return <section className="rounded-2xl border border-[#e5d9c4] bg-white p-5"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-[#173225]">{ui("executionMilestones")}</h2><p className="mt-1 text-sm text-[#68766b]">{ui("pastMilestonesStayOverdueUntilSomeoneRecordsCompletionOrA")}</p></div><Status tone={relevant.some((item) => item.displayStatus === "Overdue") ? "warning" : "good"}>{relevant.length ? evidence("actionable", {count: relevant.length}) : ui("allMilestonesComplete")}</Status></div><div className="mt-4 grid gap-2 lg:grid-cols-2">{relevant.map((item) => <article key={`${item.id}-${item.flockId}`} className="rounded-xl border border-[#eee5d5] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#173225]">{item.title}</p><p className="mt-1 text-xs text-[#68766b]">{item.flockCode} {ui("due")} {formatOperationDate(`${item.dueDate}T12:00:00Z`, locale)} · {item.displayStatusLabel ?? (item.displayStatus === "Overdue" ? evidence("overdue") : evidence("upcoming"))}</p>{item.notes && <p className="mt-2 text-xs leading-5 text-[#68766b]">{item.notes}</p>}</div><Status tone={item.displayStatus === "Overdue" ? "warning" : "neutral"}>{item.displayStatusLabel ?? (item.displayStatus === "Overdue" ? evidence("overdue") : evidence("upcoming"))}</Status></div>{data.permissions.canManage && <div className="mt-3 flex gap-2"><button type="button" onClick={() => void complete(item, "completed")} className="min-h-11 rounded-xl bg-[#244b35] px-3 text-xs font-semibold text-white">{ui("markComplete")}</button><button type="button" onClick={() => void complete(item, "skipped")} className="min-h-11 rounded-xl border border-[#bba981] px-3 text-xs font-semibold text-[#173225]">{ui("skip")}</button></div>}</article>)}{!relevant.length && <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 lg:col-span-2">{ui("noUnexecutedFeedOrLightingMilestonesRemain")}</p>}</div></section>;
}

function TemplateManager({ data, open, setOpen, reload, announce, batchId }: { data: FeedData; open: boolean; setOpen: (value: boolean) => void; reload: () => Promise<void>; announce: (value: string) => void; batchId: string }) {
  const t = useTranslations("FeedTemplates");
  const types = useTranslations("History.codes");
  const locale = useLocale();
  const [defaultName] = useState(() => t("defaultName"));
  const sourceLabel = (source: string) => source === "breed_standard" ? t("breedStandard") : source === "manual" ? t("manual") : source === "upload" ? t("upload") : source;
  const columns = {week_number: t("week"), age_day_start: t("ageStart"), age_day_end: t("ageEnd"), feed_intake_recommended_g_per_head: t("feedPerBird"), target_weight_min_g: t("weightMin"), target_weight_max_g: t("weightMax")};
  const [rows, setRows] = useState<TemplateRow[]>(data.template?.rows ?? data.suggestedRows); const [name, setName] = useState(data.template?.name ?? defaultName); const [saving, setSaving] = useState(false); const [imported, setImported] = useState(false); const [uploading, setUploading] = useState(false); const [thresholds, setThresholds] = useState({ warning: String(data.settings.warningVariancePct), critical: String(data.settings.criticalVariancePct) });
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  useEffect(() => { setRows(data.template?.rows ?? data.suggestedRows); setName(data.template?.name ?? defaultName); setImported(false); setFeedback(null); }, [batchId, data.template, data.suggestedRows, defaultName]);
  const templateDirty = JSON.stringify(rows) !== JSON.stringify(data.template?.rows ?? data.suggestedRows) || name !== (data.template?.name ?? defaultName);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (templateDirty) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [templateDirty]);
  async function save(sourceType: string) {
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch("/api/feed/templates", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({batchId, name, sourceType, rows})});
      const body = await response.json();
      if (!response.ok) { const text = body.error ? `${t("failed")} ${body.error}` : t("failed"); setFeedback({tone: "error", text}); announce(text); return; }
      const text = t((body.request ? "proposalSent" : "saved") as Parameters<typeof t>[0]);
      setFeedback({tone: "success", text}); announce(text); await reload();
    } catch { const text = t("networkFailed"); setFeedback({tone: "error", text}); announce(text); }
    finally { setSaving(false); }
  }
  async function importFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/feed-template/import", {method: "POST", body: form});
      const body = await response.json();
      if (!response.ok) { announce(`${t("failed")} ${body.error ?? ""}`.trim()); return; }
      setRows(body.rows as TemplateRow[]); setName(file.name.replace(/\.[^.]+$/, "") || t("importedName")); setImported(true);
      announce(t("rowsImported", {count: body.rows.length}));
    } catch { announce(t("networkFailed")); }
    finally { setUploading(false); }
  }
  async function saveThresholds() {
    try {
      const response = await fetch("/api/feed/settings", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({warningVariancePct: Number(thresholds.warning), criticalVariancePct: Number(thresholds.critical)})});
      const body = await response.json();
      if (!response.ok) { announce(`${t("failed")} ${body.error ?? ""}`.trim()); return; }
      announce(t((body.request ? "thresholdsProposed" : "thresholdsSaved") as Parameters<typeof t>[0])); await reload();
    } catch { announce(t("networkFailed")); }
  }
  return <section id="feed-template-management" tabIndex={-1} aria-labelledby="feed-template-management-title" className="scroll-mt-6 overflow-hidden rounded-2xl border border-[#e5d9c4] bg-white outline-none focus-visible:ring-2 focus-visible:ring-[#244b35]"><button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-16 w-full items-center justify-between gap-4 p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#244b35]"><div><h2 id="feed-template-management-title" className="text-lg font-semibold text-[#173225]">{t("title")}</h2><p className="mt-1 text-sm text-[#68766b]">{data.template ? `${data.template.name} · ${sourceLabel(data.template.source_type)}` : t("notConfigured")}</p></div><ChevronDown className={`size-5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} /></button>{open && <div className="border-t border-[#eee5d5] p-5">{data.permissions.templateChangeMode === "governance" && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">{t("governanceHelp")}</p>}{data.permissions.templateChangeMode === "read_only" && <p className="mb-5 rounded-xl border border-[#d9ceb9] bg-[#f7f4ed] p-4 text-sm leading-6 text-[#4e6253]">{t("readOnlyHelp")}</p>}{feedback && <p role={feedback.tone === "error" ? "alert" : "status"} className={`mb-5 rounded-xl border p-4 text-sm ${feedback.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>{feedback.text}</p>}{data.permissions.canConfigure && <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl bg-[#f7f4ed] p-4"><label className="text-xs font-medium text-[#4e6253]">{t("warning")}<input name="warning-threshold" type="number" min="0.1" step="0.1" value={thresholds.warning} onChange={(event) => setThresholds((current) => ({ ...current, warning: event.target.value }))} className="mt-1 min-h-12 w-36 rounded-xl border border-[#d9ceb9] bg-white px-3" /></label><label className="text-xs font-medium text-[#4e6253]">{t("critical")}<input name="critical-threshold" type="number" min="0.2" step="0.1" value={thresholds.critical} onChange={(event) => setThresholds((current) => ({ ...current, critical: event.target.value }))} className="mt-1 min-h-12 w-36 rounded-xl border border-[#d9ceb9] bg-white px-3" /></label><button type="button" onClick={() => void saveThresholds()} className="min-h-12 rounded-xl border border-[#bba981] px-4 text-sm font-semibold text-[#173225]">{t("saveThresholds")}</button></div>}<div className="flex flex-col gap-4 sm:flex-row sm:items-end"><label className="block max-w-xl flex-1 text-sm font-medium text-[#4e6253]">{t("name")}<input name="template-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-[#d9ceb9] px-3" /></label><label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-[#bba981] px-4 text-sm font-semibold text-[#173225]">{uploading ? t("extracting") : t("import")}<input name="template-import" type="file" accept=".csv,.txt,image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; }} className="sr-only" /></label></div><p className="mt-2 text-xs text-[#68766b]">{t("importHelp")}</p>{rows.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-[920px] w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-[#68766b]"><tr><th className="p-2">{t("week")}</th><th className="p-2">{t("ageStart")}</th><th className="p-2">{t("ageEnd")}</th><th className="p-2">{t("feedPerBird")}</th><th className="p-2">{t("weightMin")}</th><th className="p-2">{t("weightMax")}</th><th className="p-2">{t("feedType")}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.week_number}-${index}`} className="border-t border-[#eee5d5]">{(["week_number", "age_day_start", "age_day_end", "feed_intake_recommended_g_per_head", "target_weight_min_g", "target_weight_max_g"] as const).map((field) => <td key={field} className="p-2"><label className="sr-only" htmlFor={`${field}-${index}`}>{t("rowLabel", {label: columns[field], row: index + 1})}</label><input id={`${field}-${index}`} name={`${field}-${index}`} type="number" min="0" value={row[field] ?? ""} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, [field]: event.target.value === "" ? null : Number(event.target.value) } : item))} className="min-h-12 w-24 rounded-lg border border-[#d9ceb9] px-2" /></td>)}<td className="p-2"><label className="sr-only" htmlFor={`template-feed-${index}`}>{t("rowLabel", {label: t("feedType"), row: index + 1})}</label><select id={`template-feed-${index}`} name={`template-feed-${index}`} value={row.feed_type_plan} onChange={(event) => setRows((current) => current.map((item, i) => i === index ? { ...item, feed_type_plan: event.target.value } : item))} className="min-h-12 rounded-lg border border-[#d9ceb9] bg-white px-2">{feedTypes.map(([value]) => <option key={value} value={value}>{types((value) as Parameters<typeof types>[0])}</option>)}</select></td></tr>)}</tbody></table></div> : <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{t("noStandards")}</p>}<div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={!rows.length || saving || !data.permissions.canManage} onClick={() => void save(imported ? "upload" : data.template ? "manual" : "breed_standard")} className="min-h-12 rounded-xl bg-[#244b35] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? t("submitting") : data.permissions.templateChangeMode === "governance" ? t("submit") : t("save")}</button><button type="button" onClick={() => setRows((current) => [...current, { week_number: current.length ? Math.max(...current.map((row) => row.week_number)) + 1 : 0, age_day_start: current.length ? Math.max(...current.map((row) => row.age_day_end)) + 1 : 0, age_day_end: current.length ? Math.max(...current.map((row) => row.age_day_end)) + 7 : 6, feed_intake_std_g_per_head: null, feed_intake_recommended_g_per_head: null, target_weight_min_g: null, target_weight_max_g: null, feed_type_plan: "grower_pullet_feed", light_on_time: "06:00", light_off_time: "18:00" }])} className="min-h-12 rounded-xl border border-[#bba981] px-4 text-sm font-semibold text-[#173225]">{t("addRow")}</button></div><div className="mt-6 border-t border-[#eee5d5] pt-4"><h3 className="text-sm font-semibold text-[#173225]">{t("versions")}</h3><ul className="mt-2 space-y-2 text-sm text-[#68766b]">{data.templateVersions.map((version) => <li key={version.id}>{version.name} · {sourceLabel(version.source_type)} · {formatOperationDate(version.created_at, locale)}{version.is_active ? ` · ${t("active")}` : ""}</li>)}</ul></div></div>}</section>;
}

function WeightDrawer({ task, date, close, reload, announce }: { task: Task; date: string; close: () => void; reload: () => Promise<void>; announce: (value: string) => void }) {
  const t = useTranslations("FeedWeight");
  const locale = useLocale();
  const value = (number: number | null | undefined) => number == null ? "—" : formatNumber(number, locale);
  const ref = useRef<HTMLDivElement>(null); const [form, setForm] = useState({ recordDate: date, sampleCount: "30", averageWeightG: "", minWeightG: "", maxWeightG: "", uniformityPct: "" }); const [saving, setSaving] = useState(false);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.focus(); const key = (event: KeyboardEvent) => { if (event.key === "Escape") close(); if (event.key === "Tab" && ref.current) { const focusable = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]; if (!focusable.length) return; const first = focusable[0], last = focusable.at(-1)!; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }; document.addEventListener("keydown", key); return () => { document.removeEventListener("keydown", key); previous?.focus(); }; }, [close]);
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); const response = await fetch("/api/feed/weights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId: task.id, ...form }) }); const body = await response.json(); setSaving(false); if (!response.ok) { announce(body.error ?? t("failed")); return; } announce(t("saved")); close(); await reload(); }
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/35" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="weight-drawer-title" className="h-full w-full max-w-lg overflow-y-auto bg-[#fbf9f4] p-6 shadow-2xl outline-none"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#7e6537]">{t("eyebrow")}</p><h2 id="weight-drawer-title" className="mt-1 text-2xl font-semibold text-[#173225]">{t("title")}</h2></div><button type="button" aria-label={t("close")} onClick={close} className="grid size-12 place-items-center rounded-xl hover:bg-stone-200"><X /></button></div><form onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2">{Object.entries({ recordDate: t("recordDate"), sampleCount: t("sampleCount"), averageWeightG: t("averageWeightG"), minWeightG: t("minWeightG"), maxWeightG: t("maxWeightG"), uniformityPct: t("uniformityPct") }).map(([field, label]) => <label key={field} className="text-sm font-medium text-[#4e6253]">{label}{field === "recordDate" ? <OperationDateInput name={field} required value={form.recordDate} onChange={(event) => setForm((current) => ({...current, recordDate: event.target.value}))} className="mt-1 min-h-12 w-full rounded-xl border border-[#d9ceb9] bg-white px-3"/> : <input name={field} type="number" min={field === "uniformityPct" ? "0" : "1"} max={field === "uniformityPct" ? "100" : undefined} step={field === "sampleCount" ? undefined : ".01"} required value={form[field as keyof typeof form]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 min-h-12 w-full rounded-xl border border-[#d9ceb9] bg-white px-3" />}</label>)}<div className="sm:col-span-2"><p className="text-xs text-[#68766b]">{t("target", {min: value(task.batch_feed_template_rows?.target_weight_min_g), max: value(task.batch_feed_template_rows?.target_weight_max_g)})}</p><button type="submit" disabled={saving} className="mt-5 min-h-12 w-full rounded-xl bg-[#244b35] px-4 font-semibold text-white">{saving ? t("saving") : t("save")}</button></div></form></div></div>;
}
