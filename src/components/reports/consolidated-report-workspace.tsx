"use client";

import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useEffect, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {useFarmScope} from "@/components/farm-scope-context";
import {usePageFilter} from "@/components/page-filter-controls";
import {OperationDateInput} from "@/components/operation-date-input";
import {BranchReportWorkspace} from "@/components/reports/branch-report-workspace";
import {formatEtb, formatNumber, formatOperationDate} from "@/i18n/formats";
import {loadReport, reportSection, reportSections, type ReportSection, type ReportValue, type ReportView} from "@/lib/report-workspace";

const inputClass = "min-h-12 min-w-0 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-forest-900";

export function ConsolidatedReportWorkspace() {
  const t = useTranslations("ReportWorkspace");
  const locale = useLocale();
  const {role, scope, period, loading: scopeLoading, branches, filteredFarms, filteredHouses, filteredFlocks, filteredBatches, setScope} = useFarmScope();
  const [selected, setSelected] = usePageFilter<ReportSection>("report", "production");
  const section = reportSection(selected);
  const [dateFrom, setDateFrom] = usePageFilter("dateFrom", period.dateFrom);
  const [dateTo, setDateTo] = usePageFilter("dateTo", period.dateTo);
  const [warehouseId, setWarehouseId] = usePageFilter<string>("reportWarehouse", "");
  const [month, setMonth] = usePageFilter("reportMonth", dateTo.slice(0, 7));
  const [result, setResult] = useState<{key: string; view: ReportView | null; error: boolean} | null>(null);
  const [refresh, setRefresh] = useState(0);
  const permitted = role === "ceo" || role === "farm_manager";
  const key = JSON.stringify([section, dateFrom, dateTo, scope, warehouseId, month, refresh, role]);

  useEffect(() => {
    if (scopeLoading || !permitted) return;
    const controller = new AbortController();
    void loadReport(section, {dateFrom, dateTo, ...scope, warehouseId, month}, async (url) => {
      const response = await fetch(url, {cache: "no-store", signal: controller.signal});
      if (!response.ok) throw new Error("REPORT_LOAD_FAILED");
      return response.json();
    }).then(view => {
      if (!controller.signal.aborted) setResult({key, view, error: false});
    }).catch(() => {
      if (!controller.signal.aborted) setResult({key, view: null, error: true});
    });
    return () => controller.abort();
  }, [key, scopeLoading, permitted, section, dateFrom, dateTo, scope, warehouseId, month]);

  if (!scopeLoading && !permitted) return <p role="alert">{t("accessDenied")}</p>;
  const current = result?.key === key ? result : null;
  const view = current?.view;
  const valueLabel = (value: ReportValue) => value.value === null ? t("unavailable") : value.unit === "ETB" ? formatEtb(value.value, locale) : `${formatNumber(value.value, locale)}${value.unit ? ` ${value.unit}` : ""}`;
  const isStock = section === "stock";

  return <div className="min-w-0 space-y-5">
    <header className="rounded-2xl bg-forest-900 p-5 text-white">
      <h1 className="font-display text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm text-sand-100">{t(role === "farm_manager" ? "managerScope" : "ceoScope")}</p>
    </header>
    <nav aria-label={t("sectionsLabel")} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {reportSections.map(id => <button key={id} type="button" aria-pressed={section === id} onClick={() => setSelected(id)} className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${section === id ? "border-forest-900 bg-forest-900 text-white" : "border-sand-300 bg-white text-forest-900"}`}>{t(`sections.${id}`)}</button>)}
    </nav>
    <section aria-label={t("filters")} className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
      {isStock ? <>
        <label className="grid gap-1 text-sm">{t("month")}<input className={inputClass} type="month" value={month} onChange={event => setMonth(event.target.value)}/></label>
        <label className="grid gap-1 text-sm">{t("warehouse")}<select className={inputClass} value={warehouseId} onChange={event => setWarehouseId(event.target.value)}><option value="">{t("chooseWarehouse")}</option>{result?.view?.warehouses.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      </> : <>
        {role === "ceo" ? <label className="grid gap-1 text-sm">{t("branch")}<select className={inputClass} value={scope.branchId} onChange={event => setScope({branchId: event.target.value, farmId: "", houseId: "", flockId: "", batchId: ""})}><option value="">{t("allBranches")}</option>{branches.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label> : null}
        <label className="grid gap-1 text-sm">{t("from")}<OperationDateInput className={inputClass} value={dateFrom} max={dateTo} onChange={event => setDateFrom(event.target.value)}/></label>
        <label className="grid gap-1 text-sm">{t("to")}<OperationDateInput className={inputClass} value={dateTo} min={dateFrom} onChange={event => setDateTo(event.target.value)}/></label>
        <label className="grid gap-1 text-sm">{t("farm")}<select className={inputClass} value={scope.farmId} onChange={event => setScope(previous => ({...previous, farmId: event.target.value, houseId: "", flockId: "", batchId: ""}))}><option value="">{t("allFarms")}</option>{filteredFarms.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        {section === "feed" ? <label className="grid gap-1 text-sm">{t("batch")}<select className={inputClass} value={scope.batchId} onChange={event => setScope(previous => ({...previous, batchId: event.target.value, houseId: "", flockId: ""}))}><option value="">{t("chooseBatch")}</option>{filteredBatches.map(row => <option key={row.id} value={row.id}>{row.batch_code}</option>)}</select></label> : <>
          <label className="grid gap-1 text-sm">{t("house")}<select className={inputClass} value={scope.houseId} onChange={event => setScope(previous => ({...previous, houseId: event.target.value, flockId: "", batchId: ""}))}><option value="">{t("allHouses")}</option>{filteredHouses.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">{t("flock")}<select className={inputClass} value={scope.flockId} onChange={event => setScope(previous => ({...previous, flockId: event.target.value, batchId: ""}))}><option value="">{t("allFlocks")}</option>{filteredFlocks.map(row => <option key={row.id} value={row.id}>{row.flock_code}</option>)}</select></label>
          <label className="grid gap-1 text-sm">{t("batch")}<select className={inputClass} value={scope.batchId} onChange={event => setScope(previous => ({...previous, batchId: event.target.value}))}><option value="">{t("allBatches")}</option>{filteredBatches.map(row => <option key={row.id} value={row.id}>{row.batch_code}</option>)}</select></label>
        </>}
      </>}
      <button type="button" onClick={() => setRefresh(count => count + 1)} className={`${inputClass} font-semibold`}>{t("refresh")}</button>
    </section>
    <section aria-label={t(`sections.${section}`)} aria-busy={!current} className="space-y-4">
      {!current ? <p role="status">{t("loading")}</p> : current.error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{t("loadFailed")}</p> : !view ? <p role="status">{t("chooseBatch")}</p> : <>
        <p className="text-sm text-forest-600">{isStock ? `${view.warehouseName || t("chooseWarehouse")} · ${month}` : `${formatOperationDate(view.dateFrom || dateFrom, locale)} – ${formatOperationDate(view.dateTo || dateTo, locale)}`}</p>
        {view.notices.map(notice => <p key={notice} className="rounded-xl bg-sand-50 p-3 text-sm text-forest-700">{t(`notices.${notice}`)}</p>)}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{view.metrics.map(metric => <div key={metric.key} className="rounded-xl border border-sand-200 bg-white p-4"><p className="text-sm text-forest-600">{t(`metrics.${metric.key}`)}</p><p className="mt-2 text-2xl font-semibold text-forest-900">{valueLabel(metric)}</p></div>)}</div>
        {!view.rows.length ? (view.evidence?.items.length ? null : <p role="status">{t("empty")}</p>) : <div className="grid gap-3 lg:grid-cols-2">{view.rows.map((row, index) => <article key={index} className="min-w-0 rounded-xl border border-sand-200 bg-white p-4"><h2 className="break-words font-semibold text-forest-900">{row.date ? formatOperationDate(row.date, locale) : row.label}</h2><dl className="mt-3 grid gap-3 sm:grid-cols-2">{row.values.map(metric => <div key={metric.key}><dt className="text-xs text-forest-600">{t(`metrics.${metric.key}`)}</dt><dd className="mt-1 font-medium">{valueLabel(metric)}</dd></div>)}</dl></article>)}</div>}
        {view.evidence ? <section aria-label={t("evidenceTitle")} className="space-y-3">
          <h2 className="text-xl font-semibold">{t("evidenceTitle")}</h2>
          {!view.evidence.items.length ? <p>{t("empty")}</p> : <div className="grid gap-3 lg:grid-cols-2">{view.evidence.items.map((item, index) => <article key={index} className="min-w-0 break-words rounded-xl border border-sand-200 bg-white p-4">
            <h3 className="font-semibold">{t(`kinds.${item.kind}`)}{item.label ? ` · ${item.label}` : ""}</h3>
            <p className="mt-1 text-sm">{formatOperationDate(item.date, locale)}{item.endDate ? ` – ${formatOperationDate(item.endDate, locale)}` : ""} · {item.context || t("organizationScope")}</p>
            {item.note ? <p className="mt-2 whitespace-pre-wrap text-sm">{item.note}</p> : null}
            {item.status ? <p className="mt-2 text-sm">{t(`periodStatus.${item.status}`)}</p> : null}
            {item.amount !== undefined ? <p className="mt-2 font-semibold">{item.kind === "period" ? `${t("absorbedCost")}: ` : ""}{formatEtb(item.amount, locale)}</p> : null}
            {item.unallocated !== undefined ? <p className="text-sm">{t("unallocatedCost")}: {formatEtb(item.unallocated, locale)}</p> : null}
            {item.warnings !== undefined ? <p className="text-sm">{t("periodWarnings", {count: item.warnings})}</p> : null}
          </article>)}</div>}
        </section> : null}
      </>}
    </section>
    <p className="text-sm text-forest-600">{t("sourceNote")}</p>
    <Link href="/app/reports?view=advanced" className="inline-flex min-h-12 items-center rounded-xl border border-sand-300 px-4 text-sm font-semibold">{t("advanced")}</Link>
  </div>;
}

export function ReportsWorkspace() {
  // Existing saved-report and correction links retain the advanced workspace.
  const query = useSearchParams();
  const {role, todayWorkspaceEnabled, loading} = useFarmScope();
  const t = useTranslations("ReportWorkspace");
  if (loading) return <p role="status">{t("loading")}</p>;
  const legacy = role === "system_admin" || (role === "farm_manager" && !todayWorkspaceEnabled) || query?.get("view") === "advanced" || ["finding", "governance_request", "financial_period", "cost_entry", "report_id"].some(key => query?.has(key));
  return legacy ? <BranchReportWorkspace/> : <ConsolidatedReportWorkspace/>;
}
