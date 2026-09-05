/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { usePageFilter, ResetPageFilters } from "@/components/page-filter-controls";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bird,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  Egg,
  FileText,
  Gauge,
  RefreshCw,
  ShieldCheck,
  Wheat,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

import { useFarmScope } from "@/components/farm-scope-context";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ManagementReportCenter } from "@/components/reports/management-report-center";
import { addDays } from "@/lib/farm-manager-dashboard";
import type { ComparisonMetric, FlockAnalyticsRow, OperationsAnalyticsResponse, PeriodSummary } from "@/lib/operational-analytics";

type ReportView = "summary" | "flocks" | "production" | "risk";

const reportViews: Array<{ id: ReportView; label: string; note: string }> = [
  { id: "summary", label: "Management summary", note: "Decision brief" },
  { id: "flocks", label: "Flock performance", note: "Comparative detail" },
  { id: "production", label: "Production evidence", note: "Daily movement" },
  { id: "risk", label: "Risk & data trust", note: "Exceptions" },
];

const chartConfig = {
  hdep: { label: "HDEP %", color: "var(--leaf-500)" },
  feedPerBirdGrams: { label: "Feed g / bird", color: "var(--amber-500)" },
  mortalityPer1000BirdDays: { label: "Deaths / 1,000 bird-days", color: "var(--ember-500)" },
  recordCoveragePct: { label: "Record coverage %", color: "var(--forest-500)" },
} satisfies ChartConfig;

function addisToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value: string | null) {
  if (!value) return "No submitted record";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Addis_Ababa",
  }).format(new Date(value));
}

function number(value: number | null, suffix = "", places = 1) {
  if (value === null) return "Unavailable";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: places })}${suffix}`;
}

function money(value: number | null, places = 2) {
  return value === null ? "Unavailable" : `ETB ${value.toLocaleString(undefined, { maximumFractionDigits: places })}`;
}

function rangeLength(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000) + 1;
}

function deltaText(metric: ComparisonMetric) {
  if (metric.deltaPct === null) return "No prior comparison";
  if (Math.abs(metric.deltaPct) < 0.05) return "No material change";
  return `${metric.deltaPct > 0 ? "+" : ""}${number(metric.deltaPct, "%")} vs previous`;
}

function Delta({ metric, lowerIsBetter = false }: { metric: ComparisonMetric; lowerIsBetter?: boolean }) {
  const Icon = metric.direction === "up" ? ArrowUpRight : metric.direction === "down" ? ArrowDownRight : ArrowRight;
  const favorable = metric.direction === "flat" || metric.direction === "unavailable" || (lowerIsBetter ? metric.direction === "down" : metric.direction === "up");
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${favorable ? "text-forest-600" : "text-ember-500"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {deltaText(metric)}
    </span>
  );
}

function StatusBadge({ status }: { status: FlockAnalyticsRow["status"] }) {
  const classes = status === "critical"
    ? "border-ember-500/30 bg-ember-500/10 text-ember-600"
    : status === "watch"
      ? "border-amber-500/35 bg-amber-500/10 text-amber-700"
      : status === "good"
        ? "border-leaf-500/30 bg-leaf-500/10 text-forest-700"
        : "border-sky-500/30 bg-sky-500/10 text-sky-700";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.08em] ${classes}`}>{status}</span>;
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "Unavailable" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ReadinessGauge({ label, value, detail }: { label: string; value: number | null; detail: string }) {
  const safeValue = value === null ? 0 : Math.max(0, Math.min(100, value));
  const tone = value === null ? "bg-sand-300" : safeValue >= 90 ? "bg-leaf-500" : safeValue >= 70 ? "bg-amber-500" : "bg-ember-500";
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-forest-900">{label}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-forest-600">{detail}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-forest-900">{number(value, "%", 0)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-100" aria-hidden="true"><div className={`h-full rounded-full ${tone}`} style={{ width: `${safeValue}%` }} /></div>
    </div>
  );
}

function ReportFilters({
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
  refresh,
  loading,
}: {
  dateFrom: string;
  dateTo: string;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  refresh: () => void;
  loading: boolean;
}) {
  const { role, scope, setScope, branches, filteredFarms, filteredHouses, filteredFlocks, filteredBatches } = useFarmScope();
  const today = addisToday();
  const days = rangeLength(dateFrom, dateTo);
  const preset = (rangeDays: number) => {
    setDateTo(today);
    setDateFrom(addDays(today, -rangeDays + 1));
  };
  const controlClass = "h-10 min-w-0 rounded-xl border border-white/20 bg-white px-3 text-sm font-normal normal-case tracking-normal text-forest-900 outline-none focus:ring-2 focus:ring-amber-400";
  const labelClass = "grid min-w-0 gap-1 text-[10px] font-semibold uppercase tracking-[.14em] text-sand-100";
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[.06] p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-white/15 bg-forest-950/30 p-1" role="group" aria-label="Report date presets">
            {[7, 30, 90].map((value) => (
              <button key={value} type="button" aria-pressed={days === value} onClick={() => preset(value)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${days === value ? "bg-sand-50 text-forest-900" : "text-sand-100 hover:bg-white/10"}`}>{value} days</button>
            ))}
          </div>
          <p className="text-xs text-sand-100">Previous {days}-day period is compared automatically.</p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          <label className={labelClass}>From<input className={controlClass} type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className={labelClass}>To<input className={controlClass} type="date" value={dateTo} min={dateFrom} max={today} onChange={(event) => setDateTo(event.target.value)} /></label>
          {role === "ceo" ? <label className={labelClass}>Branch<select className={controlClass} value={scope.branchId} onChange={(event) => setScope((current) => ({ ...current, branchId: event.target.value, farmId: "", houseId: "", flockId: "", batchId: "" }))}><option value="">All branches</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
          <label className={labelClass}>Farm<select className={controlClass} value={scope.farmId} onChange={(event) => setScope((current) => ({ ...current, farmId: event.target.value, houseId: "", flockId: "", batchId: "" }))}><option value="">All farms</option>{filteredFarms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className={labelClass}>House<select className={controlClass} value={scope.houseId} onChange={(event) => setScope((current) => ({ ...current, houseId: event.target.value, flockId: "", batchId: "" }))}><option value="">All houses</option>{filteredHouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className={labelClass}>Flock<select className={controlClass} value={scope.flockId} onChange={(event) => setScope((current) => ({ ...current, flockId: event.target.value, batchId: "" }))}><option value="">All flocks</option>{filteredFlocks.map((item) => <option key={item.id} value={item.id}>{item.flock_code}</option>)}</select></label>
          <label className={labelClass}>Batch<select className={controlClass} value={scope.batchId} onChange={(event) => setScope((current) => ({ ...current, batchId: event.target.value }))}><option value="">All batches</option>{filteredBatches.map((item) => <option key={item.id} value={item.id}>{item.batch_code}</option>)}</select></label>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl bg-sand-50 px-4 text-xs font-semibold text-forest-900 transition hover:bg-white disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh report
        </button>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, comparison, icon: Icon, lowerIsBetter = false }: {
  label: string;
  value: string;
  detail: string;
  comparison: ComparisonMetric;
  icon: typeof Egg;
  lowerIsBetter?: boolean;
}) {
  return (
    <article className="min-w-0 border-t border-sand-200 p-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 xl:p-5">
      <div className="flex items-center justify-between gap-3"><Icon className="h-4 w-4 text-forest-500" aria-hidden="true" /><Delta metric={comparison} lowerIsBetter={lowerIsBetter} /></div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-forest-900">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-forest-600">{detail}</p>
    </article>
  );
}

function ManagementSummary({ data }: { data: OperationsAnalyticsResponse }) {
  const current = data.summary.current;
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="grid sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="HDEP" value={number(current.hdep, "%")} detail="Eggs divided by recorded layer bird-days." comparison={data.summary.comparisons.hdep} icon={Egg} />
          <MetricCard label="Feed / bird" value={number(current.feedPerBirdGrams, " g")} detail="Recorded feed divided by feed bird-days." comparison={data.summary.comparisons.feedPerBirdGrams} icon={Wheat} />
          <MetricCard label="Mortality pressure" value={number(current.mortalityPer1000BirdDays, " / 1k", 2)} detail="Deaths per 1,000 recorded bird-days." comparison={data.summary.comparisons.mortalityPer1000BirdDays} icon={AlertTriangle} lowerIsBetter />
          <MetricCard label="Marketable yield" value={number(current.marketableRate, "%")} detail="Normal eggs as a share of classified eggs." comparison={data.summary.comparisons.marketableRate} icon={CheckCircle2} />
          <MetricCard label="Record coverage" value={number(current.recordCoveragePct, "%", 0)} detail={`${current.records} of ${current.expectedRecords} expected flock-days.`} comparison={data.summary.comparisons.recordCoveragePct} icon={ClipboardCheck} />
          <MetricCard label="Feed issued" value={number(current.feedKg, " kg")} detail="Synchronized feed use in this report window." comparison={data.summary.comparisons.feedKg} icon={Database} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Period movement</p><h3 className="mt-1 font-display text-xl font-semibold text-forest-900">Production pulse</h3><p className="mt-1 text-xs text-forest-600">Daily output and record coverage reveal whether performance movement is supported by complete evidence.</p></div>
            <BarChart3 className="h-5 w-5 text-forest-500" aria-hidden="true" />
          </div>
          <div className="mt-5 overflow-x-auto pb-2">
            <div className="h-72 min-w-[720px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={data.trends} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                  <defs><linearGradient id="reportHdep" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-hdep)" stopOpacity={0.28} /><stop offset="95%" stopColor="var(--color-hdep)" stopOpacity={0.02} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="var(--sand-200)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value) => String(value).slice(5)} fontSize={10} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={10} unit="%" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="hdep" stroke="var(--color-hdep)" fill="url(#reportHdep)" strokeWidth={2.5} connectNulls />
                  <Line type="monotone" dataKey="recordCoveragePct" stroke="var(--color-recordCoveragePct)" strokeWidth={1.8} strokeDasharray="5 4" dot={false} connectNulls />
                </AreaChart>
              </ChartContainer>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 border-t border-sand-200 pt-3 text-[11px] text-forest-600"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-leaf-500" />HDEP</span><span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-forest-500" />Record coverage</span></div>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-sand-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Management queue</p><h3 className="mt-1 font-display text-xl font-semibold text-forest-900">Priority findings</h3></div><span className="rounded-full bg-forest-900 px-2.5 py-1 text-xs font-semibold text-white">{data.insights.length}</span></div>
          <div className="mt-4 grid gap-3">
            {data.insights.slice(0, 5).map((item) => (
              <Link key={item.id} href={item.route} className="group rounded-xl border border-sand-200 bg-white p-4 transition hover:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-400">
                <div className="flex items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.severity === "critical" ? "bg-ember-500" : item.severity === "watch" ? "bg-amber-500" : item.severity === "positive" ? "bg-leaf-500" : "bg-sky-500"}`} /><div className="min-w-0"><p className="text-sm font-semibold text-forest-900 group-hover:underline">{item.title}</p><p className="mt-1 text-xs leading-5 text-forest-600">{item.detail}</p></div><ArrowRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 text-forest-400" aria-hidden="true" /></div>
              </Link>
            ))}
            {data.insights.length === 0 ? <div className="rounded-xl border border-dashed border-sand-300 bg-white p-5 text-center text-sm text-forest-600">No priority exceptions were generated for this period.</div> : null}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="border-b border-sand-200 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Farm comparison</p><h3 className="mt-1 font-display text-xl font-semibold text-forest-900">Performance across the selected scope</h3><p className="mt-1 text-xs text-forest-600">Use normalized rates to compare farms of different sizes. Missing values remain unavailable.</p></div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead><tr className="border-b border-sand-200 bg-sand-50 text-[10px] uppercase tracking-[.12em] text-forest-500"><th className="px-5 py-3">Farm</th><th className="px-4 py-3">Live birds</th><th className="px-4 py-3">Flocks</th><th className="px-4 py-3">HDEP</th><th className="px-4 py-3">Feed / bird</th><th className="px-4 py-3">Mortality / 1k</th><th className="px-4 py-3">Marketable</th><th className="px-5 py-3">Records</th></tr></thead>
            <tbody>{data.farms.map((farm) => <tr key={farm.id} className="border-b border-sand-100 last:border-0"><td className="px-5 py-4 font-semibold text-forest-900">{farm.name}</td><td className="px-4 py-4 tabular-nums">{number(farm.liveBirds, "", 0)}</td><td className="px-4 py-4 tabular-nums">{farm.flocks}</td><td className="px-4 py-4 tabular-nums">{number(farm.hdep, "%")}</td><td className="px-4 py-4 tabular-nums">{number(farm.feedPerBirdGrams, " g")}</td><td className="px-4 py-4 tabular-nums">{number(farm.mortalityPer1000BirdDays, "", 2)}</td><td className="px-4 py-4 tabular-nums">{number(farm.marketableRate, "%")}</td><td className="px-5 py-4 tabular-nums">{number(farm.recordCoveragePct, "%", 0)}</td></tr>)}</tbody>
          </table>
          {data.farms.length === 0 ? <p className="p-6 text-center text-sm text-forest-600">No active farms were found in this report scope.</p> : null}
        </div>
      </section>
    </div>
  );
}

function FlockReport({ data }: { data: OperationsAnalyticsResponse }) {
  const ordered = [...data.flocks].sort((a, b) => b.attentionScore - a.attentionScore);
  return (
    <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <div className="border-b border-sand-200 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Flock register</p><h3 className="mt-1 font-display text-xl font-semibold text-forest-900">Performance and exceptions by flock</h3><p className="mt-1 text-xs leading-5 text-forest-600">Layers and parent stock use HDEP; broilers and rearing flocks use latest weight. Rows are ordered by attention required.</p></div>
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead><tr className="border-b border-sand-200 bg-sand-50 text-[10px] uppercase tracking-[.12em] text-forest-500"><th className="px-5 py-3">Flock</th><th className="px-4 py-3">Farm / house</th><th className="px-4 py-3">Age</th><th className="px-4 py-3">Primary result</th><th className="px-4 py-3">Target / gap</th><th className="px-4 py-3">Feed / bird</th><th className="px-4 py-3">Mortality / 1k</th><th className="px-4 py-3">Records</th><th className="px-5 py-3">Assessment</th></tr></thead>
          <tbody>{ordered.map((flock) => <tr key={flock.id} className="border-b border-sand-100 align-top last:border-0"><td className="px-5 py-4"><p className="font-semibold text-forest-900">{flock.code}</p><p className="mt-1 text-[11px] capitalize text-forest-500">{flock.type.replaceAll("_", " ")} · {number(flock.liveBirds, " birds", 0)}</p></td><td className="px-4 py-4"><p className="text-forest-900">{flock.farmName}</p><p className="mt-1 text-[11px] text-forest-500">{flock.houseName}</p></td><td className="px-4 py-4 tabular-nums">Week {flock.ageWeeks}</td><td className="px-4 py-4"><p className="font-semibold tabular-nums text-forest-900">{number(flock.primaryValue, flock.primaryUnit)}</p><p className="mt-1 text-[11px] text-forest-500">{flock.primaryLabel}</p></td><td className="px-4 py-4"><p className="tabular-nums text-forest-900">{number(flock.target, flock.primaryUnit)}</p><p className={`mt-1 text-[11px] ${flock.targetGap !== null && flock.targetGap < 0 ? "text-ember-500" : "text-forest-500"}`}>{flock.targetGap === null ? "Target unavailable" : `${flock.targetGap > 0 ? "+" : ""}${number(flock.targetGap, flock.primaryUnit)} gap`}</p></td><td className="px-4 py-4 tabular-nums">{number(flock.feedPerBirdGrams, " g")}</td><td className="px-4 py-4 tabular-nums">{number(flock.mortalityPer1000BirdDays, "", 2)}</td><td className="px-4 py-4 tabular-nums">{number(flock.recordCoveragePct, "%", 0)}</td><td className="max-w-[260px] px-5 py-4"><StatusBadge status={flock.status} /><p className="mt-2 text-[11px] leading-4 text-forest-600">{flock.statusReason}</p></td></tr>)}</tbody>
        </table>
        {ordered.length === 0 ? <p className="p-8 text-center text-sm text-forest-600">No active flocks were found in this report scope.</p> : null}
      </div>
    </section>
  );
}

function ProductionReport({ data }: { data: OperationsAnalyticsResponse }) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Daily evidence</p><h3 className="mt-1 font-display text-xl font-semibold text-forest-900">Feed, output and mortality movement</h3><p className="mt-1 text-xs text-forest-600">Each chart scrolls inside this card for long ranges, keeping the report page width stable.</p></div>
        <div className="mt-5 overflow-x-auto pb-2">
          <div className="h-80 min-w-[820px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart data={data.trends} margin={{ top: 10, right: 24, left: -8, bottom: 0 }}>
                <defs><linearGradient id="reportFeed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--color-feedPerBirdGrams)" stopOpacity={0.24} /><stop offset="95%" stopColor="var(--color-feedPerBirdGrams)" stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--sand-200)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(value) => String(value).slice(5)} fontSize={10} />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} fontSize={10} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} fontSize={10} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area yAxisId="left" type="monotone" dataKey="feedPerBirdGrams" fill="url(#reportFeed)" stroke="var(--color-feedPerBirdGrams)" strokeWidth={2} connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="hdep" stroke="var(--color-hdep)" strokeWidth={2.5} dot={false} connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="mortalityPer1000BirdDays" stroke="var(--color-mortalityPer1000BirdDays)" strokeWidth={1.8} dot={false} connectNulls />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-sand-200 pt-3 text-[11px] text-forest-600"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" />Feed g / bird</span><span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-leaf-500" />HDEP</span><span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-ember-500" />Deaths / 1,000 bird-days</span></div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="border-b border-sand-200 p-5"><h3 className="font-display text-xl font-semibold text-forest-900">Daily production ledger</h3><p className="mt-1 text-xs text-forest-600">A report-ready audit trail of the period totals and normalized rates.</p></div>
        <div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-left text-sm"><thead><tr className="border-b border-sand-200 bg-sand-50 text-[10px] uppercase tracking-[.12em] text-forest-500"><th className="px-5 py-3">Date</th><th className="px-4 py-3">Records</th><th className="px-4 py-3">Eggs</th><th className="px-4 py-3">HDEP</th><th className="px-4 py-3">Feed / bird</th><th className="px-4 py-3">Deaths</th><th className="px-4 py-3">Mortality / 1k</th><th className="px-4 py-3">Marketable</th><th className="px-5 py-3">Coverage</th></tr></thead><tbody>{data.trends.map((day) => <tr key={day.date} className="border-b border-sand-100 last:border-0"><td className="px-5 py-3 font-medium text-forest-900">{formatDate(day.date)}</td><td className="px-4 py-3 tabular-nums">{day.records} / {day.expectedRecords}</td><td className="px-4 py-3 tabular-nums">{number(day.eggs, "", 0)}</td><td className="px-4 py-3 tabular-nums">{number(day.hdep, "%")}</td><td className="px-4 py-3 tabular-nums">{number(day.feedPerBirdGrams, " g")}</td><td className="px-4 py-3 tabular-nums">{number(day.deaths, "", 0)}</td><td className="px-4 py-3 tabular-nums">{number(day.mortalityPer1000BirdDays, "", 2)}</td><td className="px-4 py-3 tabular-nums">{number(day.marketableRate, "%")}</td><td className="px-5 py-3 tabular-nums">{number(day.recordCoveragePct, "%", 0)}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}

function BreakdownList({ title, description, rows, valueLabel }: { title: string; description: string; rows: Array<{ label: string; value: number; sharePct: number }>; valueLabel: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Concentration</p><h3 className="mt-1 font-display text-xl font-semibold text-forest-900">{title}</h3><p className="mt-1 text-xs leading-5 text-forest-600">{description}</p>
      <div className="mt-5 grid gap-4">{rows.slice(0, 8).map((row, index) => <div key={row.label}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium text-forest-900">{index + 1}. {row.label}</span><span className="tabular-nums text-forest-600">{number(row.value, ` ${valueLabel}`, 1)} · {number(row.sharePct, "%", 1)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-100"><div className={`h-full rounded-full ${title.startsWith("Mortality") ? "bg-ember-500" : "bg-leaf-500"}`} style={{ width: `${(row.value / max) * 100}%` }} /></div></div>)}</div>
      {rows.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-sand-300 bg-sand-50 p-5 text-center text-sm text-forest-600">No classified entries are available for this period.</p> : null}
    </section>
  );
}

function RiskReport({ data, readiness }: { data: OperationsAnalyticsResponse; readiness: number | null }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <BreakdownList title="Mortality causes" description="Ranked causes show where prevention and investigation effort will have the greatest effect. Unspecified deaths reduce confidence." rows={data.breakdowns.mortalityCauses} valueLabel="deaths" />
        <BreakdownList title="Egg quality losses" description="Marketable, broken and dirty egg shares show how much output becomes saleable product and where handling or hygiene may need attention." rows={data.breakdowns.eggQuality} valueLabel="eggs" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-2xl border border-sand-200 bg-forest-900 p-5 text-white shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">Operating cost signals</p><h3 className="mt-1 font-display text-xl font-semibold">Feed cost and stock exposure</h3><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/10 bg-white/[.07] p-4"><p className="text-xs text-sand-200">Period feed cost</p><p className="mt-2 font-display text-xl font-semibold">{money(data.economics.feedCost)}</p></div><div className="rounded-xl border border-white/10 bg-white/[.07] p-4"><p className="text-xs text-sand-200">Feed cost / egg</p><p className="mt-2 font-display text-xl font-semibold">{money(data.economics.feedCostPerEgg)}</p></div><div className="rounded-xl border border-white/10 bg-white/[.07] p-4"><p className="text-xs text-sand-200">Feed cost / bird-day</p><p className="mt-2 font-display text-xl font-semibold">{money(data.economics.feedCostPerBirdDay, 3)}</p></div><div className="rounded-xl border border-white/10 bg-white/[.07] p-4"><p className="text-xs text-sand-200">Low-stock items</p><p className="mt-2 font-display text-xl font-semibold">{data.economics.lowStockCount}</p></div></div><p className="mt-4 text-xs leading-5 text-sand-200">Cost values show “Unavailable” when inventory valuation cannot support a defensible calculation.</p>
        </section>
        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Report qualification</p><h3 className="mt-1 font-display text-xl font-semibold text-forest-900">Data trust notes</h3></div><span className="font-display text-3xl font-semibold text-forest-900">{number(readiness, "%", 0)}</span></div>
          <div className="mt-5 grid gap-3">{data.dataTrust.notes.map((note, index) => <div key={`${note}-${index}`} className="flex gap-3 rounded-xl bg-sand-50 p-4"><Database className="mt-0.5 h-4 w-4 shrink-0 text-forest-500" aria-hidden="true" /><p className="text-xs leading-5 text-forest-700">{note}</p></div>)}</div>
          {data.dataTrust.notes.length === 0 ? <div className="mt-5 flex gap-3 rounded-xl bg-leaf-500/10 p-4"><ShieldCheck className="h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" /><p className="text-xs leading-5 text-forest-700">No data-trust exceptions were generated for this report.</p></div> : null}
        </section>
      </div>
    </div>
  );
}

function exportRows(view: ReportView, data: OperationsAnalyticsResponse): unknown[][] {
  if (view === "flocks") return [
    ["Flock", "Type", "Farm", "House", "Age weeks", "Live birds", "Primary metric", "Primary value", "Target", "Target gap", "Feed g/bird", "Mortality/1k bird-days", "Record coverage %", "Status", "Assessment"],
    ...data.flocks.map((item) => [item.code, item.type, item.farmName, item.houseName, item.ageWeeks, item.liveBirds, item.primaryLabel, item.primaryValue, item.target, item.targetGap, item.feedPerBirdGrams, item.mortalityPer1000BirdDays, item.recordCoveragePct, item.status, item.statusReason]),
  ];
  if (view === "production") return [
    ["Date", "Records", "Expected records", "Eggs", "HDEP %", "Feed g/bird", "Deaths", "Mortality/1k bird-days", "Marketable %", "Record coverage %"],
    ...data.trends.map((item) => [item.date, item.records, item.expectedRecords, item.eggs, item.hdep, item.feedPerBirdGrams, item.deaths, item.mortalityPer1000BirdDays, item.marketableRate, item.recordCoveragePct]),
  ];
  if (view === "risk") return [
    ["Section", "Label", "Value", "Share %", "Cumulative %"],
    ...data.breakdowns.mortalityCauses.map((item) => ["Mortality cause", item.label, item.value, item.sharePct, item.cumulativePct]),
    ...data.breakdowns.eggQuality.map((item) => ["Egg quality", item.label, item.value, item.sharePct, null]),
    ["Data trust", "Record coverage", data.dataTrust.recordCoveragePct, null, null],
    ["Data trust", "Feed data coverage", data.dataTrust.feedDataCoveragePct, null, null],
    ["Data trust", "Mortality cause coverage", data.dataTrust.mortalityCauseCoveragePct, null, null],
    ["Data trust", "Target coverage", data.dataTrust.targetCoveragePct, null, null],
  ];
  const summary: PeriodSummary = data.summary.current;
  return [
    ["Branch report", data.meta.scopeLabel],
    ["Period", `${data.meta.dateFrom} to ${data.meta.dateTo}`],
    ["Metric", "Current", "Previous", "Change %"],
    ["HDEP %", summary.hdep, data.summary.previous.hdep, data.summary.comparisons.hdep.deltaPct],
    ["Feed g/bird", summary.feedPerBirdGrams, data.summary.previous.feedPerBirdGrams, data.summary.comparisons.feedPerBirdGrams.deltaPct],
    ["Mortality/1k bird-days", summary.mortalityPer1000BirdDays, data.summary.previous.mortalityPer1000BirdDays, data.summary.comparisons.mortalityPer1000BirdDays.deltaPct],
    ["Marketable %", summary.marketableRate, data.summary.previous.marketableRate, data.summary.comparisons.marketableRate.deltaPct],
    ["Record coverage %", summary.recordCoveragePct, data.summary.previous.recordCoveragePct, data.summary.comparisons.recordCoveragePct.deltaPct],
    ["Feed kg", summary.feedKg, data.summary.previous.feedKg, data.summary.comparisons.feedKg.deltaPct],
    ["Eggs", summary.eggs], ["Deaths", summary.deaths], ["Live birds", data.summary.liveBirds], ["Active flocks", data.summary.activeFlocks],
  ];
}

function LoadingReport() {
  return <div className="space-y-5" aria-label="Loading Branch Reports"><div className="h-[420px] animate-pulse rounded-2xl bg-forest-900/20" /><div className="h-28 animate-pulse rounded-2xl bg-sand-100" /><div className="h-[420px] animate-pulse rounded-2xl bg-sand-100" /></div>;
}

export function BranchReportWorkspace() {
  const { scope, period, filteredFlocks, filteredBatches } = useFarmScope();
  const [dateFrom, setDateFrom] = usePageFilter<string>("dateFrom", period.dateFrom);
  const [dateTo, setDateTo] = usePageFilter<string>("dateTo", period.dateTo);
  const [view, setView] = usePageFilter<ReportView>("tab", "summary");
  const [data, setData] = useState<OperationsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);


  const scopeKey = `${scope.branchId}|${scope.farmId}|${scope.houseId}|${scope.flockId}|${scope.batchId}|${filteredFlocks.length}|${filteredBatches.length}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, branch_id: scope.branchId, farm_id: scope.farmId, house_id: scope.houseId, flock_id: scope.flockId, batch_id: scope.batchId });
      const response = await fetch(`/api/operations-analytics?${params}`, { signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? "Could not prepare the branch report.");
      setData(body as OperationsAnalyticsResponse);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Could not prepare the branch report.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [dateFrom, dateTo, scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId]);

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey, scopeKey, dateFrom, dateTo]);

  const readiness = useMemo(() => {
    if (!data) return null;
    const values = [data.dataTrust.recordCoveragePct, data.dataTrust.feedDataCoveragePct, data.dataTrust.mortalityCauseCoveragePct, data.dataTrust.targetCoveragePct].filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }, [data]);

  if (!data && loading) return <LoadingReport />;

  return (
    <main className="min-w-0 space-y-5">
      <div className="flex justify-end"><ResetPageFilters /></div>
      <header className="relative overflow-hidden rounded-3xl border border-forest-700 bg-forest-900 p-5 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border-[46px] border-amber-400/10" aria-hidden="true" />
        <div className="relative">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-amber-300"><FileText className="h-4 w-4" aria-hidden="true" />Branch intelligence dossier</div><h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">Branch reporting desk</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100">Turn Daily Records, Feed Control and flock performance into a management-ready report. Every result is scoped to your assigned farms and compared with the immediately preceding period.</p></div>
            {data ? <div className="grid shrink-0 grid-cols-2 gap-x-7 gap-y-3 rounded-2xl border border-white/10 bg-white/[.06] p-4 text-xs"><div><p className="text-sand-300">Report scope</p><p className="mt-1 max-w-[180px] font-semibold text-white">{data.meta.scopeLabel}</p></div><div><p className="text-sand-300">Report dates</p><p className="mt-1 font-semibold text-white">{formatDate(data.meta.dateFrom)} – {formatDate(data.meta.dateTo)}</p></div><div><p className="text-sand-300">Latest record</p><p className="mt-1 font-semibold text-white">{formatTimestamp(data.meta.latestRecordAt)}</p></div><div><p className="text-sand-300">Refreshed</p><p className="mt-1 font-semibold text-white">{formatTimestamp(data.meta.refreshedAt)}</p></div></div> : null}
          </div>
          <div className="mt-6"><ReportFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} refresh={() => setRefreshKey((value) => value + 1)} loading={loading} /></div>
        </div>
      </header>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Report could not be refreshed</p><p className="mt-1">{error}</p></div></div> : null}

      {data ? <>
        <section className="grid overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm lg:grid-cols-[.72fr_1.28fr]">
          <div className="border-b border-sand-200 bg-sand-50 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Report readiness</p><p className="mt-1 font-display text-3xl font-semibold text-forest-900">{number(readiness, "%", 0)}</p></div><div className={`grid h-12 w-12 place-items-center rounded-full ${readiness !== null && readiness >= 90 ? "bg-leaf-500/15 text-leaf-600" : "bg-amber-500/15 text-amber-700"}`}><Gauge className="h-5 w-5" aria-hidden="true" /></div></div><p className="mt-2 text-xs leading-5 text-forest-600">A confidence signal based on the available record, feed, cause and target coverage—not a performance score.</p>
          </div>
          <div className="grid gap-5 p-5 sm:grid-cols-2"><ReadinessGauge label="Daily Records" value={data.dataTrust.recordCoveragePct} detail="Submitted flock-days versus expected flock-days." /><ReadinessGauge label="Feed synchronization" value={data.dataTrust.feedDataCoveragePct} detail="Daily records carrying Feed Control totals." /><ReadinessGauge label="Mortality causes" value={data.dataTrust.mortalityCauseCoveragePct} detail="Recorded deaths with a classified cause." /><ReadinessGauge label="Breed targets" value={data.dataTrust.targetCoveragePct} detail="Active flocks with an age-matched standard." /></div>
        </section>

        <ManagementReportCenter scope={{ branchId: scope.branchId || undefined, farmId: scope.farmId || undefined, houseId: scope.houseId || undefined, flockId: scope.flockId || undefined, batchId: scope.batchId || undefined }} dateFrom={dateFrom} dateTo={dateTo} scopeLabel={data.meta.scopeLabel} />

        <div className="flex flex-col gap-3 rounded-2xl border border-sand-200 bg-white p-2 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-1 sm:grid-cols-2 lg:flex" role="tablist" aria-label="Branch report sections">{reportViews.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className={`min-h-12 rounded-xl px-4 text-left transition focus:outline-none focus:ring-2 focus:ring-forest-400 ${view === item.id ? "bg-forest-900 text-white" : "text-forest-700 hover:bg-sand-50"}`}><span className="block text-xs font-semibold">{item.label}</span><span className={`mt-0.5 block text-[10px] ${view === item.id ? "text-sand-200" : "text-forest-500"}`}>{item.note}</span></button>)}</div>
          <button type="button" onClick={() => downloadCsv(`branch-report-${view}-${data.meta.dateFrom}-to-${data.meta.dateTo}.csv`, exportRows(view, data))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-forest-900 px-4 text-xs font-semibold text-forest-900 transition hover:bg-forest-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-forest-400"><Download className="h-4 w-4" aria-hidden="true" />Export current view (.csv)</button>
        </div>

        {loading ? <div className="h-1 overflow-hidden rounded-full bg-sand-100"><div className="h-full w-1/3 animate-pulse rounded-full bg-amber-500" /></div> : null}
        {view === "summary" ? <ManagementSummary data={data} /> : null}
        {view === "flocks" ? <FlockReport data={data} /> : null}
        {view === "production" ? <ProductionReport data={data} /> : null}
        {view === "risk" ? <RiskReport data={data} readiness={readiness} /> : null}

        <footer className="flex flex-col gap-3 rounded-2xl border border-sand-200 bg-sand-50 p-4 text-xs text-forest-600 sm:flex-row sm:items-center sm:justify-between"><p className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-forest-500" aria-hidden="true" />Generated from permission-scoped operational records. Missing values are never converted to zero.</p><p className="font-medium text-forest-700">Africa/Addis_Ababa · {data.meta.days} report days</p></footer>
      </> : <div className="rounded-2xl border border-dashed border-sand-300 bg-white p-10 text-center"><Bird className="mx-auto h-7 w-7 text-forest-400" aria-hidden="true" /><h2 className="mt-3 font-display text-xl font-semibold text-forest-900">No report data available</h2><p className="mt-2 text-sm text-forest-600">Choose a scope with active flocks or adjust the report period.</p></div>}
    </main>
  );
}
