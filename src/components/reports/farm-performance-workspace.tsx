"use client";

import Link from "next/link";
import {usePathname, useRouter, useSearchParams} from "next/navigation";
import {useEffect, useState} from "react";
import {NextIntlClientProvider, useLocale, useMessages} from "next-intl";
import en from "../../../messages/en.json";
import am from "../../../messages/am.json";
import {EvidenceRibbon, MetricCards, PerformancePlot, usePerformanceText} from "@/components/reports/performance-visuals";
import {dashboardCharts} from "@/lib/performance-dashboard";
import {useFarmScope} from "@/components/farm-scope-context";
import {usePageFilter} from "@/components/page-filter-controls";
import {OperationDateInput} from "@/components/operation-date-input";
import {ManagementReportCenter} from "@/components/reports/management-report-center";
import {formatOperationDate} from "@/i18n/formats";
import {reportTimestampBounds} from "@/lib/report-safety";
import {performanceParams, type PerformanceMetric, type PerformanceResponse, type PerformanceSection} from "@/lib/farm-performance";
import {legacyPerformanceView, performanceConcerns, performancePreset, performanceView, performanceViews, rowFieldUnit, type PerformanceView} from "@/lib/farm-performance-view";

const inputClass = "min-h-12 min-w-0 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-forest-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
const actionClass = "inline-flex min-h-12 items-center justify-center rounded-xl border border-sand-300 px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
function SupportingFigures({section}: {section: PerformanceSection}) {
  const {t, locale, label, number, unit} = usePerformanceText();
  return <details className="rounded-2xl border border-sand-200 bg-white px-5"><summary className="min-h-12 cursor-pointer py-4 font-semibold focus-visible:outline">{t("figures")}</summary>
    {section.rowsLimited ? <p className="mb-3 text-sm">{t("preview", {shown: section.rows?.length ?? 0, total: section.rowCount ?? 0})}</p> : null}
    <div className="grid gap-3 pb-4 lg:grid-cols-2">{section.rows?.map((row, index) => <article key={index} className="min-w-0 rounded-xl border border-sand-200 p-4"><h3 className="break-words font-semibold">{row.label}</h3><p className="mt-1 break-words text-xs text-forest-600">{row.context}{row.date ? ` · ${formatOperationDate(row.date, locale)}` : ""}</p><dl className="mt-3 grid grid-cols-2 gap-3">{Object.entries(row.values).map(([key, value]) => <div key={key}><dt className="text-xs text-forest-600">{label(key)}</dt><dd className="mt-1 break-words tabular-nums">{number(value, rowFieldUnit(key, row.unit))} {value !== null && rowFieldUnit(key, row.unit) !== "ETB" ? unit(rowFieldUnit(key, row.unit)) : ""}</dd></div>)}</dl>{row.evidenceHref ? <Link className={`${actionClass} mt-3`} href={row.evidenceHref}>{t("check")}</Link> : null}</article>)}</div>
    <Link className={`${actionClass} mb-4`} href={section.evidenceHref}>{t("check")}</Link>
  </details>;
}

function TopicView({view, section, scopeLabel, dateFrom, dateTo, onRetry}: {onRetry: () => void; view: Exclude<PerformanceView, "overview" | "saved">; section: PerformanceSection; scopeLabel: string; dateFrom: string; dateTo: string}) {
  const {t, number, explanation} = usePerformanceText();
  return <div className="space-y-4" aria-label={t(`views.${view}`)}>
    <p role={section.state === "failed" ? "alert" : "status"} className={`rounded-xl p-4 text-sm ${section.state === "failed" ? "bg-red-50 text-red-800" : "bg-sand-100 text-forest-900"}`}>{t(`states.${section.state}`)} · {t(`notices.${view}`)}</p>
    {section.coverage ? <p className="text-sm">{section.coverage.percent === null ? t("coverageUnknown") : t("coverage", {recorded: section.coverage.recorded, expected: section.coverage.expected, percent: number(section.coverage.percent)})}</p> : null}
    {view === "production" && section.rows?.some(row => row.date && (row.date < dateFrom || row.date > dateTo)) ? <p className="rounded-xl bg-sand-100 p-4 text-sm">{t("outsidePeriod")}</p> : null}
    {section.state === "failed" ? <div className="performance-section-error"><p>{t("dashboard.sectionFailed")}</p><button type="button" className={actionClass} onClick={onRetry}>{t("refresh")}</button><Link className={actionClass} href={section.evidenceHref}>{t("check")}</Link></div> : <><MetricCards metrics={section.metrics}/><div className="performance-plots">{dashboardCharts(view, section).map(chart => <PerformancePlot key={chart.key} chart={chart} scopeLabel={scopeLabel}/>)}</div>
      <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-forest-700">{section.explanations.map(code => <li key={code}>{explanation(code)}</li>)}</ul><SupportingFigures section={section}/></>}
  </div>;
}

export function FarmPerformanceWorkspace() {
  const locale = useLocale();
  const messages = useMessages();
  // Retained app layouts may hold the pre-upgrade catalog during navigation.
  // Supply this feature's namespace explicitly while preserving calendar/shared copy.
  return <NextIntlClientProvider locale={locale} messages={{...messages, FarmPerformance: (locale === "am" ? am : en).FarmPerformance}}>
    <FarmPerformanceContent/>
  </NextIntlClientProvider>;
}

function FarmPerformanceContent() {
  const {t, locale} = usePerformanceText();
  const search = useSearchParams(), router = useRouter(), pathname = usePathname();
  const context = useFarmScope();
  const {role, scope, setScope, branches, filteredFarms, filteredHouses, filteredFlocks, filteredBatches, loading} = context;
  const [defaults] = useState(() => performancePreset(30));
  const defaultView = legacyPerformanceView(new URLSearchParams(search.toString()));
  const [selected, setSelected] = usePageFilter<string>("performance", pathname === "/app/analytics" && defaultView === "overview" ? "production" : defaultView);
  const view = search.has("saved_report") || search.has("report_id") ? "saved" : performanceView(selected);
  const selectView = (id: string) => {
    const query = new URLSearchParams(search.toString());
    query.set("filter_view", "1"); query.set("filter_page_performance", id);
    query.delete("filter_page_report");
    if (query.get("view") === "advanced") query.delete("view");
    if (id !== "saved") {query.delete("saved_report"); query.delete("report_id");}
    setSelected(id); router.push(`/app/reports?${query}`, {scroll: false});
  };
  const [dateFrom, setFrom] = usePageFilter("dateFrom", defaults.dateFrom);
  const [dateTo, setTo] = usePageFilter("dateTo", defaults.dateTo);
  const [warehouseId, setWarehouse] = usePageFilter<string>("reportWarehouse", "");
  const [refresh, setRefresh] = useState(0);
  const [offline, setOffline] = useState(false);
  const [result, setResult] = useState<{key: string; data: PerformanceResponse | null; error: string | null} | null>(null);
  const permitted = role === "ceo" || role === "farm_manager";
  let valid = true;
  try {reportTimestampBounds(dateFrom, dateTo);} catch {valid = false;}
  const params = performanceParams({dateFrom, dateTo, ...scope});
  if (warehouseId) params.set("warehouse_id", warehouseId);
  const query = params.toString(), key = `${query}|${refresh}|${role}`;
  useEffect(() => {
    const online = () => {setOffline(false); setRefresh(value => value + 1);};
    const disconnected = () => {setOffline(true); setResult(null);};
    window.addEventListener("online", online); window.addEventListener("offline", disconnected);
    if (!navigator.onLine) disconnected();
    return () => {window.removeEventListener("online", online); window.removeEventListener("offline", disconnected);};
  }, []);
  useEffect(() => {
    if (loading || !permitted || offline || !valid || view === "saved") return;
    const controller = new AbortController();
    void fetch(`/api/reports/performance?${query}`, {cache: "no-store", signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error(response.status === 401 ? "session" : response.status === 403 ? "denied" : response.status === 400 ? "invalid" : response.status === 409 ? "conflict" : "failed");
      const data = await response.json() as PerformanceResponse;
      if (!controller.signal.aborted) setResult({key, data, error: null});
    }).catch(error => {if (!controller.signal.aborted) setResult({key, data: null, error: error instanceof Error && ["session", "denied", "invalid", "conflict"].includes(error.message) ? error.message : "failed"});});
    return () => controller.abort();
  }, [key, query, loading, permitted, offline, valid, view]);
  const current = result?.key === key ? result : null;
  const data = current?.data;
  const selectScope = (name: "branchId" | "farmId" | "houseId" | "flockId" | "batchId", value: string) => {
    setWarehouse("");
    setScope(previous => ({...previous, [name]: value, ...(name === "branchId" ? {farmId: "", houseId: "", flockId: "", batchId: ""} : name === "farmId" ? {houseId: "", flockId: "", batchId: ""} : name === "houseId" ? {flockId: "", batchId: ""} : name === "flockId" ? {batchId: ""} : {})}));
  };
  const choices = [
    ...(role === "ceo" ? [{name: "branchId" as const, label: "branch" as const, options: branches.map(row => ({id: row.id, name: row.name}))}] : []),
    {name: "farmId" as const, label: "farm" as const, options: filteredFarms.map(row => ({id: row.id, name: row.name}))},
    {name: "houseId" as const, label: "house" as const, options: filteredHouses.map(row => ({id: row.id, name: row.name}))},
    {name: "flockId" as const, label: "flock" as const, options: filteredFlocks.map(row => ({id: row.id, name: row.flock_code}))},
    {name: "batchId" as const, label: "batch" as const, options: filteredBatches.map(row => ({id: row.id, name: row.batch_code}))},
  ];
  if (!permitted && !loading) return <p role="alert">{t("denied")}</p>;
  const overview = data ? [
    data.sections.production.metrics.find(row => row.key === "eggs"),
    data.sections.production.metrics.find(row => row.key === "hdep"),
    data.sections.feeding.metrics.find(row => row.key === "sessionActualKg") ?? data.sections.feeding.metrics.find(row => row.key === "feedKg"),
    data.sections.health.metrics.find(row => row.key === "deaths"),
    data.sections.salesCosts.metrics.find(row => row.key === "revenue"),
    data.sections.stock.metrics.find(row => row.key === "currentLowStockItems"),
  ].filter((row): row is PerformanceMetric => row !== undefined) : [];
  const overviewCharts = data ? [
    ...dashboardCharts("production", data.sections.production).filter(chart => ["eggs", "eggQuality"].includes(chart.key)),
    ...dashboardCharts("feeding", data.sections.feeding).filter(chart => chart.key === "session_actual"),
    ...dashboardCharts("health", data.sections.health).filter(chart => chart.key === "deaths"),
    ...dashboardCharts("salesCosts", data.sections.salesCosts).filter(chart => ["revenue", "expenseCategories"].includes(chart.key)),
    ...dashboardCharts("stock", data.sections.stock).filter(chart => chart.key.startsWith("stock:")).slice(0, 2),
  ] : [];
  return <div data-locale={locale} className="performance-workspace min-w-0 space-y-5 text-forest-900">
    <header className="performance-heading"><div><h1 className="font-display text-3xl font-semibold">{t("title")}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-forest-700">{t("subtitle")}</p></div><button className={actionClass} type="button" onClick={() => setRefresh(value => value + 1)}>{t("refresh")}</button></header>
    <section aria-label={t("filters")} className="performance-filters space-y-4">
      <div className="flex flex-wrap gap-2">{([7, 30, 90] as const).map(days => <button type="button" key={days} className={`${actionClass} aria-pressed:bg-forest-900 aria-pressed:text-white`} aria-pressed={dateFrom === performancePreset(days).dateFrom && dateTo === performancePreset(days).dateTo} onClick={() => {const period = performancePreset(days); setFrom(period.dateFrom); setTo(period.dateTo);}}>{t("days", {count: days})}</button>)}</div>
      <div className="performance-filter-grid"><label className="grid min-w-0 gap-1 text-sm">{t("from")}<OperationDateInput className={inputClass} value={dateFrom} max={dateTo} onChange={event => setFrom(event.target.value)}/></label><label className="grid min-w-0 gap-1 text-sm">{t("to")}<OperationDateInput className={inputClass} value={dateTo} min={dateFrom} onChange={event => setTo(event.target.value)}/></label>
        {choices.filter(choice => choice.name !== "batchId" && choice.name !== "branchId").map(choice => <label key={choice.name} className="grid min-w-0 gap-1 text-sm">{t(choice.label)}<select className={inputClass} value={scope[choice.name]} onChange={event => selectScope(choice.name, event.target.value)}><option value="">{t("all")}</option>{choice.options.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>)}
        {view === "stock" ? <label className="grid min-w-0 gap-1 text-sm">{t("warehouse")}<select className={inputClass} value={warehouseId} onChange={event => setWarehouse(event.target.value)}><option value="">{t("all")}</option>{data?.options?.warehouses.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label> : null}
      </div>
      <details className="performance-more-filters"><summary>{t("dashboard.moreFilters")}{choices.filter(choice => choice.name === "batchId" || choice.name === "branchId").map(choice => choice.options.find(row => row.id === scope[choice.name])?.name).filter(Boolean).map(name => <span key={name}>{name}</span>)}</summary><div className="grid gap-4 sm:grid-cols-2">{choices.filter(choice => choice.name === "batchId" || choice.name === "branchId").map(choice => <label key={choice.name} className="grid min-w-0 gap-1 text-sm">{t(choice.label)}<select className={inputClass} value={scope[choice.name]} onChange={event => selectScope(choice.name, event.target.value)}><option value="">{t("all")}</option>{choice.options.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>)}</div></details>
    </section>
    <nav aria-label={t("title")} className="performance-navigation flex flex-wrap">{performanceViews.map(id => <button type="button" key={id} onClick={() => selectView(id)} aria-pressed={view === id} className={`${actionClass} ${view === id ? "border-forest-900 bg-forest-900 text-white" : "bg-white"}`}>{t(`views.${id}`)}</button>)}</nav>
    <div aria-live="polite" aria-busy={view !== "saved" && !current && valid && !offline}>
      {offline ? <p role="status" className="rounded-xl bg-sand-100 p-4">{t("offline")}</p> : !valid ? <p role="alert">{t("invalid")}</p> : view === "saved" ? <div className="space-y-4"><p className="rounded-xl bg-sand-100 p-4 text-sm">{t("savedNote")}</p><ManagementReportCenter scope={{...scope, farmId: scope.farmId || (role === "farm_manager" && filteredFarms.length === 1 ? filteredFarms[0].id : undefined), warehouseId: warehouseId || undefined}} dateFrom={dateFrom} dateTo={dateTo} scopeLabel={data?.meta.scopeLabel ?? t("title")}/></div> : current?.error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{t(current.error as "failed")}</p> : !data ? <p role="status">{t("loading")}</p> : <div className="space-y-5">
        <p className="text-sm text-forest-700">{t("scope", {scope: data.meta.scopeLabel})} · {t("period", {from: formatOperationDate(data.meta.dateFrom, locale), to: formatOperationDate(data.meta.dateTo, locale)})}<br/>{t("comparison", {from: formatOperationDate(data.meta.previousFrom, locale), to: formatOperationDate(data.meta.previousTo, locale)})}</p>
        {view === "overview" ? <>
          <EvidenceRibbon data={data} onSelect={selectView}/><MetricCards metrics={overview}/><div className="performance-overview-heading"><h2>{t("dashboard.operations")}</h2><p>{t("notices.overview")}</p></div><div className="performance-plots performance-overview-plots">{overviewCharts.map(chart => <PerformancePlot key={chart.key} chart={chart} scopeLabel={data.meta.scopeLabel}/>)}</div>
          <section className="rounded-2xl border border-sand-200 bg-white p-5"><h2 className="text-xl font-semibold">{t("concerns")}</h2>
            <ul className="mt-3 space-y-3">
              {data.concerns?.map((item, index) => <li key={index} className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-100 py-2"><span>{t(`concernLabels.${item.key}`)}{item.flockLabel ? ` · ${item.flockLabel}` : ""}</span><Link className={actionClass} href={item.evidenceHref}>{t("check")}</Link></li>)}
              {performanceConcerns(data).map(item => <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-100 py-2"><span>{t(`views.${item.key as "production"}`)} · {t(`states.${item.state}`)}</span><button className={actionClass} onClick={() => selectView(item.key)} type="button">{t("figures")}</button></li>)}
            </ul>
            {!performanceConcerns(data).length && !data.concerns?.length ? <p className="mt-3 text-sm">{t("noConcerns")}</p> : null}
          </section>
        </> : <TopicView key={view} view={view} section={data.sections[view]} scopeLabel={data.meta.scopeLabel} dateFrom={dateFrom} dateTo={dateTo} onRetry={() => setRefresh(value => value + 1)}/>}
      </div>}
    </div>
  </div>;
}
