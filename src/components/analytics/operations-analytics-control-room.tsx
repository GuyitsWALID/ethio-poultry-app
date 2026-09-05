/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { usePageFilter, ResetPageFilters } from "@/components/page-filter-controls";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bird,
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  Egg,
  Gauge,
  Info,
  Layers3,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  Wheat,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { useFarmScope } from "@/components/farm-scope-context";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { addDays } from "@/lib/farm-manager-dashboard";
import type { ComparisonMetric, FlockAnalyticsRow, OperationsAnalyticsResponse } from "@/lib/operational-analytics";

const chartConfig = {
  hdep: { label: "HDEP %", color: "var(--chart-1)" },
  feedPerBirdGrams: { label: "Feed g / bird", color: "var(--chart-2)" },
  mortalityPer1000BirdDays: { label: "Deaths / 1,000 bird-days", color: "var(--chart-4)" },
  marketableRate: { label: "Marketable %", color: "var(--chart-3)" },
  recordCoveragePct: { label: "Record coverage %", color: "var(--chart-5)" },
  value: { label: "Deaths", color: "var(--chart-4)" },
  cumulativePct: { label: "Cumulative %", color: "var(--chart-2)" },
  sharePct: { label: "Share %", color: "var(--chart-3)" },
} satisfies ChartConfig;

const qualityColors = ["var(--leaf-500)", "var(--ember-500)", "var(--amber-500)"];

function number(value: number | null, suffix = "", places = 2) {
  if (value === null) return "Unavailable";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: places })}${suffix}`;
}

function money(value: number | null, places = 2) {
  return value === null ? "Unavailable" : `ETB ${value.toLocaleString(undefined, { maximumFractionDigits: places })}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function addisToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function deltaLabel(metric: ComparisonMetric) {
  if (metric.deltaPct === null) return "No prior comparison";
  if (metric.deltaPct === 0) return "No material change";
  return `${metric.deltaPct > 0 ? "+" : ""}${number(metric.deltaPct, "%")} vs prior`;
}

function DeltaIcon({ direction, inverted = false }: { direction: ComparisonMetric["direction"]; inverted?: boolean }) {
  if (direction === "unavailable" || direction === "flat") return <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />;
  const positive = inverted ? direction === "down" : direction === "up";
  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  return <Icon className={`h-3.5 w-3.5 ${positive ? "text-leaf-500" : "text-ember-500"}`} aria-hidden="true" />;
}

function MetricCell({
  label,
  value,
  unit,
  comparison,
  note,
  icon: Icon,
  inverted = false,
}: {
  label: string;
  value: number | null;
  unit?: string;
  comparison: ComparisonMetric;
  note: string;
  icon: typeof Egg;
  inverted?: boolean;
}) {
  const directionIsGood = comparison.direction === "flat" || comparison.direction === "unavailable" || (inverted ? comparison.direction === "down" : comparison.direction === "up");
  return (
    <article className="min-w-0 border-t border-sand-200 p-4 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 xl:p-5">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-forest-500" aria-hidden="true" />
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${directionIsGood ? "text-forest-600" : "text-ember-500"}`}>
          <DeltaIcon direction={comparison.direction} inverted={inverted} />
          {deltaLabel(comparison)}
        </span>
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-forest-900">{number(value, unit, value !== null && Math.abs(value) < 10 ? 3 : 1)}</p>
      <p className="mt-1 text-[11px] leading-4 text-forest-600">{note}</p>
    </article>
  );
}

function StatusBadge({ status }: { status: FlockAnalyticsRow["status"] }) {
  const classes = status === "critical"
    ? "border-ember-500/30 bg-ember-500/10 text-ember-500"
    : status === "watch"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
      : status === "insufficient"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-700"
        : "border-leaf-500/30 bg-leaf-500/10 text-forest-700";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.08em] ${classes}`}>{status}</span>;
}

function ScopeFilters({ dateFrom, dateTo, setDateFrom, setDateTo, onRefresh, loading }: {
  dateFrom: string;
  dateTo: string;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const { role, scope, setScope, branches, filteredFarms, filteredHouses, filteredFlocks, filteredBatches } = useFarmScope();
  const today = addisToday();
  const applyPreset = (days: number) => {
    setDateTo(today);
    setDateFrom(addDays(today, -days + 1));
  };
  const rangeDays = Math.round((new Date(`${dateTo}T00:00:00Z`).getTime() - new Date(`${dateFrom}T00:00:00Z`).getTime()) / 86400000) + 1;
  return (
    <div className="rounded-2xl border border-white/15 bg-white/[.07] p-4 backdrop-blur-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-sand-200">Analysis window</p>
          <div className="mt-2 inline-flex rounded-xl border border-white/15 bg-forest-900/40 p-1" role="group" aria-label="Date range presets">
            {[7, 30, 90].map((days) => <button key={days} type="button" aria-pressed={rangeDays === days} onClick={() => applyPreset(days)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${rangeDays === days ? "bg-sand-50 text-forest-900" : "text-sand-100 hover:bg-white/10"}`}>{days} days</button>)}
          </div>
        </div>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:max-w-5xl xl:grid-cols-6">
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-sand-200">From<input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} className="h-10 min-w-0 rounded-xl border border-white/15 bg-white px-3 text-sm font-normal tracking-normal text-forest-900" /></label>
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-sand-200">To<input type="date" value={dateTo} min={dateFrom} max={today} onChange={(event) => setDateTo(event.target.value)} className="h-10 min-w-0 rounded-xl border border-white/15 bg-white px-3 text-sm font-normal tracking-normal text-forest-900" /></label>
          {role === "ceo" ? <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-sand-200">Branch<select value={scope.branchId} onChange={(event) => setScope((current) => ({ ...current, branchId: event.target.value, farmId: "", houseId: "", flockId: "", batchId: "" }))} className="h-10 min-w-0 rounded-xl border border-white/15 bg-white px-3 text-sm font-normal tracking-normal text-forest-900"><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label> : null}
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-sand-200">Farm<select value={scope.farmId} onChange={(event) => setScope((current) => ({ ...current, farmId: event.target.value, houseId: "", flockId: "", batchId: "" }))} className="h-10 min-w-0 rounded-xl border border-white/15 bg-white px-3 text-sm font-normal tracking-normal text-forest-900"><option value="">All farms</option>{filteredFarms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-sand-200">House<select value={scope.houseId} onChange={(event) => setScope((current) => ({ ...current, houseId: event.target.value, flockId: "", batchId: "" }))} className="h-10 min-w-0 rounded-xl border border-white/15 bg-white px-3 text-sm font-normal tracking-normal text-forest-900"><option value="">All houses</option>{filteredHouses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></label>
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-sand-200">Flock<select value={scope.flockId} onChange={(event) => setScope((current) => ({ ...current, flockId: event.target.value, batchId: "" }))} className="h-10 min-w-0 rounded-xl border border-white/15 bg-white px-3 text-sm font-normal tracking-normal text-forest-900"><option value="">All flocks</option>{filteredFlocks.map((flock) => <option key={flock.id} value={flock.id}>{flock.flock_code}</option>)}</select></label>
          <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-sand-200">Batch<select value={scope.batchId} onChange={(event) => setScope((current) => ({ ...current, batchId: event.target.value }))} className="h-10 min-w-0 rounded-xl border border-white/15 bg-white px-3 text-sm font-normal tracking-normal text-forest-900"><option value="">All batches</option>{filteredBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_code}</option>)}</select></label>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-sand-50 px-4 text-xs font-semibold text-forest-900 transition hover:bg-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</button>
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-sand-200 bg-sand-50 px-6 text-center text-sm text-forest-600">{message}</div>;
}

function ChartScroll({ children, minWidth = 720 }: { children: React.ReactNode; minWidth?: number }) {
  return <div className="max-w-full overflow-x-auto overscroll-x-contain pb-2"><div style={{ minWidth }}>{children}</div></div>;
}

function ProductionFingerprint({ data }: { data: OperationsAnalyticsResponse }) {
  const width = Math.max(720, data.trends.length * 15);
  const hasData = data.trends.some((row) => row.records > 0);
  const tick = (value: string) => data.trends.length > 45 ? value.slice(8) : shortDate(value);
  const tracks = [
    { key: "hdep" as const, title: "Production pressure", value: number(data.summary.current.hdep, "%"), note: "Eggs ÷ recorded layer bird-days", color: "var(--chart-1)", target: data.targets.hdep, targetLabel: "Weighted age target" },
    { key: "feedPerBirdGrams" as const, title: "Feed response", value: number(data.summary.current.feedPerBirdGrams, " g"), note: "Synchronized feed ÷ recorded bird-days", color: "var(--chart-2)", target: data.targets.feedPerBirdGrams, targetLabel: "Weighted age target" },
    { key: "mortalityPer1000BirdDays" as const, title: "Mortality intensity", value: number(data.summary.current.mortalityPer1000BirdDays), note: "Deaths per 1,000 recorded bird-days", color: "var(--chart-4)", target: null, targetLabel: "" },
    { key: "recordCoveragePct" as const, title: "Evidence coverage", value: number(data.summary.current.recordCoveragePct, "%"), note: "Recorded ÷ expected active flock-days", color: "var(--chart-5)", target: 100, targetLabel: "Complete" },
  ];
  return (
    <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm" aria-labelledby="fingerprint-title">
      <div className="flex flex-col gap-3 border-b border-sand-200 bg-[#f3efe5] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">Aligned operating signals</p><h2 id="fingerprint-title" className="mt-1 font-display text-2xl font-semibold text-forest-900">Production fingerprint</h2><p className="mt-1 max-w-3xl text-sm text-forest-600">Read vertically by date: a feed change, production response, mortality event, and missing record stay aligned instead of being separated into unrelated charts.</p></div>
        <div className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs text-forest-600"><strong className="text-forest-900">{data.meta.days} days</strong> · gaps mean unavailable</div>
      </div>
      {!hasData ? <div className="p-5"><EmptyChart message="No Daily Records are available in this window. Expand the date range or select another flock." /></div> : (
        <div className="divide-y divide-sand-200">
          {tracks.map((track, index) => <article key={track.key} className="grid min-w-0 lg:grid-cols-[210px_minmax(0,1fr)]">
            <div className="border-b border-sand-100 p-5 lg:border-b-0 lg:border-r"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: track.color }} /><p className="text-xs font-semibold text-forest-900">{track.title}</p></div><p className="mt-3 font-display text-2xl font-semibold tabular-nums text-forest-900">{track.value}</p><p className="mt-1 text-[11px] leading-4 text-forest-500">{track.note}</p></div>
            <div className="min-w-0 overflow-hidden px-2 py-3">
              <ChartScroll minWidth={width}><ChartContainer config={chartConfig} className="h-[138px] w-full"><AreaChart data={data.trends} syncId="operations-fingerprint" margin={{ left: index === 2 ? 5 : -10, right: 16, top: 12, bottom: 0 }}><defs><linearGradient id={`fill-${track.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={track.color} stopOpacity={0.3}/><stop offset="95%" stopColor={track.color} stopOpacity={0.02}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--sand-200)" strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={tick} tickLine={false} axisLine={false} minTickGap={data.trends.length > 45 ? 22 : 36} fontSize={10}/><YAxis tickLine={false} axisLine={false} width={48} fontSize={10}/><ChartTooltip content={<ChartTooltipContent indicator="line"/>}/>{track.target !== null ? <ReferenceLine y={track.target} stroke="var(--amber-500)" strokeDasharray="5 4" label={{ value: track.targetLabel, position: "insideTopRight", fill: "var(--forest-500)", fontSize: 10 }}/>:null}<Area type="monotone" dataKey={track.key} stroke={track.color} fill={`url(#fill-${track.key})`} strokeWidth={2.5} connectNulls={false} activeDot={{ r: 4 }}/></AreaChart></ChartContainer></ChartScroll>
            </div>
          </article>)}
        </div>
      )}
    </section>
  );
}

function InsightQueue({ insights }: { insights: OperationsAnalyticsResponse["insights"] }) {
  const style = (severity: OperationsAnalyticsResponse["insights"][number]["severity"]) => severity === "critical" ? "border-ember-500/25 bg-ember-500/[.07]" : severity === "watch" ? "border-amber-500/30 bg-amber-500/[.07]" : severity === "positive" ? "border-leaf-500/25 bg-leaf-500/[.07]" : "border-sky-500/25 bg-sky-500/[.06]";
  const icon = (severity: OperationsAnalyticsResponse["insights"][number]["severity"]) => severity === "critical" ? <CircleAlert className="h-4 w-4 text-ember-500"/> : severity === "watch" ? <Gauge className="h-4 w-4 text-amber-500"/> : severity === "positive" ? <CheckCircle2 className="h-4 w-4 text-leaf-500"/> : <Info className="h-4 w-4 text-sky-600"/>;
  return <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Analytical verdict</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">What deserves attention first</h2></div><div className="mt-4 space-y-3">{insights.map((item) => <Link key={item.id} href={item.route} className={`group block rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${style(item.severity)}`}><div className="flex items-start gap-3">{icon(item.severity)}<div className="min-w-0 flex-1"><p className="text-sm font-semibold text-forest-900">{item.title}</p><p className="mt-1 text-xs leading-5 text-forest-600">{item.detail}</p></div><ArrowUpRight className="h-4 w-4 shrink-0 text-forest-400 transition group-hover:text-forest-800"/></div></Link>)}</div></section>;
}

function FlockIntelligence({ rows }: { rows: FlockAnalyticsRow[] }) {
  const [sort, setSort] = useState<"attention" | "performance" | "coverage">("attention");
  const sorted = useMemo(() => [...rows].sort((a, b) => sort === "attention" ? b.attentionScore - a.attentionScore || a.code.localeCompare(b.code) : sort === "coverage" ? (a.recordCoveragePct ?? -1) - (b.recordCoveragePct ?? -1) : (b.targetAttainmentPct ?? b.primaryValue ?? -1) - (a.targetAttainmentPct ?? a.primaryValue ?? -1)), [rows, sort]);
  return (
    <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-sand-200 p-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Adaptive flock comparison</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Flock intelligence board</h2><p className="mt-1 text-sm text-forest-600">Layers use HDEP; broilers and rearing flocks use the latest weight against their age target.</p></div><div className="inline-flex w-fit rounded-xl border border-sand-200 bg-sand-50 p-1" role="group" aria-label="Sort flocks">{(["attention", "performance", "coverage"] as const).map((value) => <button key={value} type="button" aria-pressed={sort === value} onClick={() => setSort(value)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold capitalize ${sort === value ? "bg-forest-900 text-white" : "text-forest-600 hover:bg-white"}`}>{value}</button>)}</div></div>
      {rows.length === 0 ? <div className="p-8 text-sm text-forest-600">No active flocks are available in this scope.</div> : <>
        <div className="hidden max-w-full overflow-x-auto lg:block"><table className="w-full min-w-[1120px] table-fixed text-left text-sm"><thead><tr className="border-b border-sand-200 bg-sand-50 text-[10px] uppercase tracking-[.14em] text-forest-500"><th className="w-[18%] px-5 py-3">Flock</th><th className="w-[24%] px-4 py-3">Primary performance</th><th className="w-[21%] px-4 py-3">Inputs and risk</th><th className="w-[13%] px-4 py-3">Coverage</th><th className="w-[24%] px-5 py-3">Interpretation</th></tr></thead><tbody>{sorted.map((flock) => <tr key={flock.id} className="border-b border-sand-100 align-top last:border-0"><td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2"><Link href={`/app/flocks/${flock.id}`} className="font-semibold text-forest-900 underline decoration-sand-200 underline-offset-4 hover:decoration-forest-700">{flock.code}</Link><StatusBadge status={flock.status}/></div><p className="mt-1 text-xs text-forest-600">{flock.farmName} · {flock.houseName}</p><p className="mt-1 text-[11px] capitalize text-forest-500">{flock.type.replaceAll("_", " ")} · week {flock.ageWeeks} · {flock.liveBirds.toLocaleString()} birds</p></td><td className="px-4 py-4"><div className="flex items-center justify-between"><span className="text-xs text-forest-500">{flock.primaryLabel}</span><span className="inline-flex items-center gap-1 text-[11px] capitalize text-forest-600"><DeltaIcon direction={flock.trend}/>{flock.trend}</span></div><p className="mt-1 font-display text-xl font-semibold tabular-nums text-forest-900">{number(flock.primaryValue, flock.primaryUnit)} <span className="text-xs font-normal text-forest-500">/ target {number(flock.target, flock.primaryUnit)}</span></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-sand-100"><div className={`h-full rounded-full ${flock.status === "critical" ? "bg-ember-500" : flock.status === "watch" ? "bg-amber-500" : "bg-leaf-500"}`} style={{ width: `${Math.min(100, Math.max(2, flock.targetAttainmentPct ?? 45))}%` }}/></div><p className="mt-1 text-[10px] text-forest-500">Previous {number(flock.baseline, flock.primaryUnit)} · gap {number(flock.targetGap, flock.primaryUnit)}</p></td><td className="px-4 py-4"><div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><div><span className="block text-forest-500">Feed / bird</span><strong>{number(flock.feedPerBirdGrams, " g")}</strong></div><div><span className="block text-forest-500">Feed variance</span><strong>{number(flock.feedVariancePct, "%")}</strong></div><div><span className="block text-forest-500">Mortality / 1k</span><strong>{number(flock.mortalityPer1000BirdDays)}</strong></div><div><span className="block text-forest-500">{flock.type === "layer" || flock.type === "parent_stock" ? "Marketable" : "Uniformity"}</span><strong>{number(flock.type === "layer" || flock.type === "parent_stock" ? flock.marketableRate : flock.uniformityPct, "%")}</strong></div></div></td><td className="px-4 py-4"><p className="font-semibold tabular-nums text-forest-900">{number(flock.recordCoveragePct, "%", 0)}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-100"><div className="h-full rounded-full bg-forest-500" style={{ width: `${Math.min(100, flock.recordCoveragePct ?? 0)}%` }}/></div><p className="mt-2 text-[11px] text-forest-500">{number(flock.deaths)} deaths · {number(flock.eggs)} eggs</p></td><td className="px-5 py-4"><p className="text-xs leading-5 text-forest-700">{flock.statusReason}</p>{flock.target === null ? <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Target unavailable · baseline used</p> : null}</td></tr>)}</tbody></table></div>
        <div className="grid gap-3 p-4 lg:hidden">{sorted.map((flock) => <article key={flock.id} className="rounded-xl border border-sand-200 p-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/app/flocks/${flock.id}`} className="font-semibold text-forest-900">{flock.code}</Link><p className="mt-1 text-xs text-forest-600">{flock.farmName} · {flock.houseName} · W{flock.ageWeeks}</p></div><StatusBadge status={flock.status}/></div><div className="mt-4 rounded-xl bg-sand-50 p-3"><div className="flex justify-between text-xs text-forest-500"><span>{flock.primaryLabel}</span><span>Target {number(flock.target, flock.primaryUnit)}</span></div><p className="mt-1 font-display text-2xl font-semibold">{number(flock.primaryValue, flock.primaryUnit)}</p></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><span className="block text-forest-500">Feed / bird</span><strong>{number(flock.feedPerBirdGrams, " g")}</strong></div><div><span className="block text-forest-500">Mortality / 1k</span><strong>{number(flock.mortalityPer1000BirdDays)}</strong></div><div><span className="block text-forest-500">Coverage</span><strong>{number(flock.recordCoveragePct, "%")}</strong></div><div><span className="block text-forest-500">Target gap</span><strong>{number(flock.targetGap, flock.primaryUnit)}</strong></div></div><p className="mt-4 border-t border-sand-200 pt-3 text-xs leading-5 text-forest-600">{flock.statusReason}</p></article>)}</div>
      </>}
    </section>
  );
}

function feedConclusion(flock: FlockAnalyticsRow) {
  const feedVariance = flock.feedVariancePct;
  const productionGap = flock.targetGap;
  if (flock.feedPerBirdGrams === null || flock.hdep === null) return "Record both feed and egg production to receive an interpretation.";
  if (feedVariance !== null && feedVariance > 5 && productionGap !== null && productionGap < -3) return "Feed use is above target while egg production is below target. Check feed quality, disease, heat stress, water, and flock condition.";
  if (feedVariance !== null && feedVariance < -5 && productionGap !== null && productionGap < -3) return "Feed use and egg production are both below target. Check whether birds are receiving and accessing enough feed.";
  if (feedVariance !== null && feedVariance > 5 && productionGap !== null && productionGap >= -3) return "Egg production is holding, but feed use is above target. Review wastage and ration efficiency before reducing feed.";
  if (Math.abs(feedVariance ?? 0) <= 5 && (productionGap === null || productionGap >= -3)) return "Feed use and egg production are aligned with the available targets. Continue the current program and monitor the trend.";
  if (productionGap !== null && productionGap < -3) return "Egg production is below target. Compare feed, water, mortality, health, and environmental records for the same dates.";
  return "The flock is producing well for the recorded feed level. Use the age target and previous period to confirm that performance is sustainable.";
}

function TargetMeasure({ label, actual, target, unit, goodWhenNear = false }: { label: string; actual: number | null; target: number | null; unit: string; goodWhenNear?: boolean }) {
  const attainment = actual !== null && target !== null && target > 0 ? (actual / target) * 100 : null;
  const width = attainment === null ? 0 : Math.min(100, Math.max(2, (attainment / 120) * 100));
  const acceptable = attainment !== null && (goodWhenNear ? Math.abs(attainment - 100) <= 5 : attainment >= 97);
  const caution = attainment !== null && (goodWhenNear ? Math.abs(attainment - 100) <= 10 : attainment >= 92);
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-[11px] font-medium text-forest-600">{label}</p><p className="mt-0.5 text-lg font-semibold tabular-nums text-forest-900">{number(actual, unit)}</p></div>
        <p className="text-right text-[11px] text-forest-500">Target<br/><strong className="text-forest-700">{number(target, unit)}</strong></p>
      </div>
      {attainment === null ? <div className="mt-2 rounded-lg bg-sand-50 px-3 py-2 text-[11px] text-forest-500">Target comparison unavailable</div> : <>
        <div className="relative mt-2 h-2.5 rounded-full bg-sand-100"><div className={`h-full rounded-full ${acceptable ? "bg-leaf-500" : caution ? "bg-amber-500" : "bg-ember-500"}`} style={{ width: `${width}%` }}/><span className="absolute inset-y-[-3px] left-[83.33%] w-px bg-forest-900" aria-hidden="true"/></div>
        <div className="mt-1 flex justify-between text-[9px] text-forest-500"><span>0</span><span>Target</span><span>120%</span></div>
      </>}
    </div>
  );
}

function FeedProductionComparison({ flocks }: { flocks: FlockAnalyticsRow[] }) {
  const rows = flocks.filter((flock) => flock.type === "layer" || flock.type === "parent_stock");
  return (
    <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <div className="border-b border-sand-200 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Feed and egg production</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Is each laying flock converting feed into eggs?</h2><p className="mt-1 text-sm leading-6 text-forest-600">Each flock has two rails: feed consumed per bird and HDEP, which is eggs per 100 hens. The black marker is the breed-and-age target.</p></div>
      <div className="border-b border-sand-200 bg-[#f3efe5] px-5 py-3 text-xs leading-5 text-forest-700"><strong>How to read:</strong> HDEP should be at or above target. Feed should be close to target—not simply as low as possible. High feed with low HDEP needs investigation.</div>
      {rows.length === 0 ? <div className="p-5"><EmptyChart message="No active laying or parent-stock flock is available in this scope."/></div> : <div className="divide-y divide-sand-200">{rows.map((flock) => <article key={flock.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Link href={`/app/flocks/${flock.id}`} className="font-semibold text-forest-900 underline decoration-sand-200 underline-offset-4">{flock.code}</Link><StatusBadge status={flock.status}/></div><p className="mt-1 text-xs text-forest-500">{flock.farmName} · {flock.houseName} · week {flock.ageWeeks}</p></div><p className="text-xs text-forest-500">{flock.liveBirds.toLocaleString()} live birds</p></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><TargetMeasure label="Feed consumed per bird-day" actual={flock.feedPerBirdGrams} target={flock.feedTargetGrams} unit=" g" goodWhenNear/><TargetMeasure label="Egg production (HDEP)" actual={flock.hdep} target={flock.target} unit="%"/></div><div className={`mt-4 rounded-xl border px-4 py-3 text-xs leading-5 ${flock.status === "critical" ? "border-ember-500/25 bg-ember-500/[.07]" : flock.status === "watch" ? "border-amber-500/25 bg-amber-500/[.07]" : "border-leaf-500/25 bg-leaf-500/[.07]"}`}><strong className="text-forest-900">Interpretation: </strong><span className="text-forest-700">{feedConclusion(flock)}</span></div></article>)}</div>}
    </section>
  );
}

function FarmComparison({ farms }: { farms: OperationsAnalyticsResponse["farms"] }) {
  const width = Math.max(620, farms.length * 120);
  return <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Farm-to-farm normalization</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Production and evidence by farm</h2><p className="mt-1 text-sm text-forest-600">Percentage metrics allow differently sized farms to be compared without rewarding scale.</p></div>{farms.length === 0 ? <div className="mt-5"><EmptyChart message="No farm comparison is available."/></div> : <div className="mt-4"><ChartScroll minWidth={width}><ChartContainer config={chartConfig} className="h-[330px] w-full"><BarChart data={farms} margin={{ left: -4, right: 12, top: 16, bottom: 18 }}><CartesianGrid vertical={false} stroke="var(--sand-200)"/><XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} interval={0}/><YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={38} fontSize={10}/><ChartTooltip content={<ChartTooltipContent/>}/><Bar dataKey="hdep" fill="var(--chart-1)" radius={[5,5,0,0]} maxBarSize={28}/><Bar dataKey="marketableRate" fill="var(--chart-3)" radius={[5,5,0,0]} maxBarSize={28}/><Bar dataKey="recordCoveragePct" fill="var(--chart-2)" radius={[5,5,0,0]} maxBarSize={28}/></BarChart></ChartContainer></ChartScroll><div className="mt-2 flex flex-wrap gap-4 text-[11px] text-forest-600"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-leaf-500"/>HDEP</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-amber-500"/>Marketable</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-forest-600"/>Record coverage</span></div></div>}</section>;
}

function MortalityCauses({ rows }: { rows: OperationsAnalyticsResponse["breakdowns"]["mortalityCauses"] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const top = rows[0] ?? null;
  const inconsistentLabels = rows.some((row) => row.label.includes("|") || row.label.includes("/"));
  return (
    <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <div className="border-b border-sand-200 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Recorded causes</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">What is causing the deaths?</h2><p className="mt-1 text-sm leading-6 text-forest-600">Causes are ranked from the largest death count to the smallest. The percentage shows each cause’s share of all deaths in this period.</p></div>
      {rows.length === 0 ? <div className="p-5"><EmptyChart message="No deaths with cause information are available in this period."/></div> : <div className="p-5">
        <div className="rounded-xl border border-ember-500/20 bg-ember-500/[.06] p-4"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-ember-500">Main finding</p><p className="mt-1 text-sm leading-6 text-forest-800"><strong>{top?.label}</strong> is the leading recorded cause with <strong>{top?.value} deaths</strong>, representing <strong>{number(top?.sharePct ?? null, "%")}</strong> of the {total} deaths shown.</p></div>
        <div className="mt-5 space-y-4">{rows.map((row, index) => <article key={row.label}><div className="mb-2 flex items-end justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-900 text-xs font-semibold text-white">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-forest-900">{row.label}</p><p className="text-[11px] text-forest-500">{row.value} death{row.value === 1 ? "" : "s"}</p></div></div><strong className="shrink-0 text-sm tabular-nums text-forest-900">{number(row.sharePct, "%")}</strong></div><div className="ml-10 h-3 overflow-hidden rounded-full bg-sand-100"><div className={`h-full rounded-full ${index === 0 ? "bg-ember-500" : index === 1 ? "bg-amber-500" : "bg-forest-500"}`} style={{ width: `${Math.max(2, row.sharePct)}%` }}/></div></article>)}</div>
        <div className="mt-5 border-t border-sand-200 pt-4 text-xs leading-5 text-forest-600"><p><strong className="text-forest-900">How to use this:</strong> investigate the first cause before smaller causes because it offers the largest opportunity to reduce deaths.</p>{inconsistentLabels ? <p className="mt-2 flex gap-2 text-amber-700"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0"/>Some cause names combine multiple labels. Standardize them so one problem is not split across several categories.</p> : null}</div>
      </div>}
    </section>
  );
}

type FeedScatterTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: FlockAnalyticsRow }>;
};

function FeedScatterTooltip({ active, payload }: FeedScatterTooltipProps) {
  const flock = payload?.[0]?.payload;
  if (!active || !flock) return null;
  return <div className="min-w-[210px] rounded-xl border border-sand-200 bg-white p-3 text-xs shadow-lg"><div className="flex items-center justify-between gap-3"><strong className="text-forest-900">{flock.code}</strong><StatusBadge status={flock.status}/></div><p className="mt-1 text-forest-500">{flock.farmName} · {flock.houseName}</p><div className="mt-3 grid grid-cols-2 gap-3"><div><span className="block text-forest-500">Feed / bird</span><strong className="text-forest-900">{number(flock.feedPerBirdGrams, " g")}</strong></div><div><span className="block text-forest-500">HDEP</span><strong className="text-forest-900">{number(flock.hdep, "%")}</strong></div><div><span className="block text-forest-500">Feed target</span><strong className="text-forest-900">{number(flock.feedTargetGrams, " g")}</strong></div><div><span className="block text-forest-500">HDEP target</span><strong className="text-forest-900">{number(flock.target, "%")}</strong></div></div></div>;
}

function FeedResponseScatter({ flocks }: { flocks: FlockAnalyticsRow[] }) {
  const rows = flocks.filter((flock) => (flock.type === "layer" || flock.type === "parent_stock") && flock.hdep !== null && flock.feedPerBirdGrams !== null);
  const points = rows.map((flock) => ({ ...flock, bubbleSize: Math.max(40, Math.sqrt(flock.liveBirds) * 3) }));
  const highFeedWeakOutput = rows.find((flock) => (flock.feedVariancePct ?? 0) > 5 && (flock.targetGap ?? 0) < -3);
  const summary = rows.length === 1
    ? `Only ${rows[0]?.code} is available, so this point describes that flock but does not yet provide a flock-to-flock comparison.`
    : highFeedWeakOutput
      ? `${highFeedWeakOutput.code} is the clearest concern: feed is above its target while HDEP is below target.`
      : "No flock currently combines above-target feed with a material HDEP shortfall. Compare point movement across periods before changing the ration.";
  return (
    <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <div className="border-b border-sand-200 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Advanced relationship view</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Feed response by laying flock</h2><p className="mt-1 text-sm leading-6 text-forest-600">This chart shows whether flocks consuming more feed are also producing more eggs. It helps locate inefficient combinations; it does not prove that feed alone caused the result.</p></div>
      <div className="grid border-b border-sand-200 bg-[#f3efe5] sm:grid-cols-2"><div className="border-b border-sand-200 p-4 text-xs leading-5 text-forest-700 sm:border-b-0 sm:border-r"><strong className="text-forest-900">Horizontal position:</strong> farther right means more feed consumed per bird each day.</div><div className="p-4 text-xs leading-5 text-forest-700"><strong className="text-forest-900">Vertical position:</strong> higher means better HDEP—more eggs per 100 recorded hens.</div><div className="border-t border-sand-200 p-4 text-xs leading-5 text-forest-700 sm:border-r"><strong className="text-forest-900">Circle size:</strong> larger circles represent flocks with more live birds.</div><div className="border-t border-sand-200 p-4 text-xs leading-5 text-forest-700"><strong className="text-forest-900">Circle color:</strong> green is on track, amber needs review, and red requires attention.</div></div>
      {rows.length === 0 ? <div className="p-5"><EmptyChart message="Record feed and egg production for a laying flock to populate this relationship chart."/></div> : <div className="p-5"><ChartScroll minWidth={680}><ChartContainer config={chartConfig} className="h-[330px] w-full"><ScatterChart margin={{ left: 4, right: 22, top: 20, bottom: 20 }}><CartesianGrid stroke="var(--sand-200)" strokeDasharray="3 3"/><XAxis type="number" dataKey="feedPerBirdGrams" name="Feed per bird" unit=" g" tickLine={false} axisLine={false} fontSize={10} label={{ value: "Feed consumed per bird-day →", position: "insideBottom", offset: -12, fill: "var(--forest-500)", fontSize: 11 }}/><YAxis type="number" dataKey="hdep" name="HDEP" unit="%" tickLine={false} axisLine={false} width={48} fontSize={10} label={{ value: "HDEP ↑", angle: -90, position: "insideLeft", fill: "var(--forest-500)", fontSize: 11 }}/><ZAxis type="number" dataKey="bubbleSize" range={[80, 650]}/><ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<FeedScatterTooltip/>}/><Scatter name="Laying flocks" data={points}>{points.map((flock) => <Cell key={flock.id} fill={flock.status === "critical" ? "var(--ember-500)" : flock.status === "watch" ? "var(--amber-500)" : "var(--leaf-500)"} fillOpacity={0.92}/>)}</Scatter></ScatterChart></ChartContainer></ChartScroll><div className="mt-4 rounded-xl border border-forest-900/10 bg-sand-50 px-4 py-3 text-xs leading-5 text-forest-700"><strong className="text-forest-900">What this chart currently says: </strong>{summary}</div><div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2"><p className="rounded-lg bg-leaf-500/[.07] px-3 py-2 text-forest-700"><strong>Upper-left:</strong> strong HDEP with lower feed; confirm feed is still near the flock’s target.</p><p className="rounded-lg bg-amber-500/[.08] px-3 py-2 text-forest-700"><strong>Upper-right:</strong> strong production with high feed; check whether the extra feed is justified.</p><p className="rounded-lg bg-amber-500/[.08] px-3 py-2 text-forest-700"><strong>Lower-left:</strong> weak production with low feed; check intake access, health, water, and age.</p><p className="rounded-lg bg-ember-500/[.07] px-3 py-2 text-forest-700"><strong>Lower-right:</strong> high feed with weak production; investigate first.</p></div></div>}
    </section>
  );
}

function MortalityParetoAdvanced({ rows }: { rows: OperationsAnalyticsResponse["breakdowns"]["mortalityCauses"] }) {
  const width = Math.max(620, rows.length * 110);
  const firstEightyIndex = rows.findIndex((row) => row.cumulativePct >= 80);
  const priorityCount = firstEightyIndex >= 0 ? firstEightyIndex + 1 : rows.length;
  const priorityShare = priorityCount > 0 ? rows[priorityCount - 1]?.cumulativePct ?? 0 : 0;
  return (
    <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <div className="border-b border-sand-200 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Advanced cause-priority view</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Mortality Pareto</h2><p className="mt-1 text-sm leading-6 text-forest-600">This chart identifies the few causes responsible for most deaths, helping management focus investigation and prevention where it can have the greatest effect.</p></div>
      <div className="grid border-b border-sand-200 bg-[#f3efe5] sm:grid-cols-3"><div className="border-b border-sand-200 p-4 text-xs leading-5 text-forest-700 sm:border-b-0 sm:border-r"><strong className="text-forest-900">Orange bars:</strong> deaths assigned to each cause. Read their values using the left axis.</div><div className="border-b border-sand-200 p-4 text-xs leading-5 text-forest-700 sm:border-b-0 sm:border-r"><strong className="text-forest-900">Green line:</strong> the running share of all deaths after each cause. Read it using the right percentage axis.</div><div className="p-4 text-xs leading-5 text-forest-700"><strong className="text-forest-900">Cause order:</strong> largest death count first. Start intervention on the left and work toward the right.</div></div>
      {rows.length === 0 ? <div className="p-5"><EmptyChart message="No mortality causes are available for the Pareto analysis."/></div> : <div className="p-5"><ChartScroll minWidth={width}><ChartContainer config={chartConfig} className="h-[320px] w-full"><ComposedChart data={rows} margin={{ left: -8, right: 8, top: 18, bottom: 38 }}><CartesianGrid vertical={false} stroke="var(--sand-200)"/><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} interval={0} angle={-18} textAnchor="end" height={58}/><YAxis yAxisId="count" tickLine={false} axisLine={false} width={42} fontSize={10} label={{ value: "Deaths", angle: -90, position: "insideLeft", fill: "var(--forest-500)", fontSize: 10 }}/><YAxis yAxisId="share" orientation="right" domain={[0,100]} tickLine={false} axisLine={false} width={42} fontSize={10} label={{ value: "Cumulative %", angle: 90, position: "insideRight", fill: "var(--forest-500)", fontSize: 10 }}/><ChartTooltip content={<ChartTooltipContent/>}/><ReferenceLine yAxisId="share" y={80} stroke="var(--amber-500)" strokeDasharray="4 4" label={{ value: "80% focus line", position: "insideTopRight", fill: "var(--forest-500)", fontSize: 10 }}/><Bar yAxisId="count" dataKey="value" fill="var(--chart-4)" radius={[5,5,0,0]} maxBarSize={36}/><Line yAxisId="share" type="monotone" dataKey="cumulativePct" stroke="var(--chart-2)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--chart-2)" }}/></ComposedChart></ChartContainer></ChartScroll><div className="mt-4 rounded-xl border border-forest-900/10 bg-sand-50 px-4 py-3 text-xs leading-5 text-forest-700"><strong className="text-forest-900">What this chart currently says: </strong>The first {priorityCount} cause{priorityCount === 1 ? "" : "s"} account for {number(priorityShare, "%")} of recorded deaths. Investigating these causes first addresses most of the current mortality burden.</div></div>}
    </section>
  );
}

function QualityAndFeed({ data }: { data: OperationsAnalyticsResponse }) {
  const quality = data.breakdowns.eggQuality.filter((item) => item.value > 0);
  const totalEggs = quality.reduce((sum, item) => sum + item.value, 0);
  const [activeQualityLabel, setActiveQualityLabel] = useState<string | null>(null);
  const defaultQuality = quality.find((item) => item.label === "Marketable") ?? quality[0] ?? null;
  const activeQuality = quality.find((item) => item.label === activeQualityLabel) ?? defaultQuality;
  const activeIndex = Math.max(0, quality.findIndex((item) => item.label === activeQuality?.label));
  const activeColor = qualityColors[activeIndex % qualityColors.length];
  return <div className="grid min-w-0 gap-4 xl:grid-cols-2"><section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Output quality</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Egg quality yield</h2><p className="mt-1 text-xs text-forest-500">Hover a slice or focus a category to inspect its correctly matched count, percentage, and color.</p>{quality.length === 0 ? <div className="mt-5"><EmptyChart message="No classified egg data are available."/></div> : <div className="mt-4 grid items-center gap-4 sm:grid-cols-[220px_1fr]"><div className="relative"><ChartContainer config={chartConfig} className="h-[220px] w-full"><PieChart><Pie data={quality} dataKey="value" nameKey="label" innerRadius={65} outerRadius={92} paddingAngle={2} stroke="white" strokeWidth={3} onMouseEnter={(_,index)=>setActiveQualityLabel(quality[index]?.label??null)} onMouseLeave={()=>setActiveQualityLabel(null)}>{quality.map((item,index)=>{const active=!activeQualityLabel||item.label===activeQualityLabel;return <Cell key={item.label} fill={qualityColors[index % qualityColors.length]} fillOpacity={active?1:0.42} className="transition-opacity duration-150"/>;})}</Pie></PieChart></ChartContainer><div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center"><div className="max-w-[112px]"><span className="mx-auto block h-2 w-2 rounded-full" style={{backgroundColor:activeColor}}/><p className="mt-1 font-display text-2xl font-semibold tabular-nums" style={{color:activeColor}}>{number(activeQuality?.sharePct??null,"%",1)}</p><p className="truncate text-[10px] font-semibold uppercase tracking-wide" style={{color:activeColor}}>{activeQuality?.label??"Unavailable"}</p><p className="mt-0.5 text-[10px] tabular-nums text-forest-500">{activeQuality?.value.toLocaleString()??""} eggs</p></div></div></div><div className="space-y-2">{quality.map((item,index)=>{const selected=item.label===activeQuality?.label;const color=qualityColors[index%qualityColors.length];return <button key={item.label} type="button" onMouseEnter={()=>setActiveQualityLabel(item.label)} onMouseLeave={()=>setActiveQualityLabel(null)} onFocus={()=>setActiveQualityLabel(item.label)} onBlur={()=>setActiveQualityLabel(null)} onClick={()=>setActiveQualityLabel(item.label)} aria-pressed={selected} className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 ${selected?"border-sand-200 bg-sand-50":"border-transparent hover:bg-sand-50"}`}><span className="flex items-center gap-2 font-medium" style={{color}}><i className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:color}}/>{item.label}</span><span className="text-right"><strong className="block tabular-nums" style={{color}}>{item.value.toLocaleString()}</strong><small className="text-forest-500">{number(item.sharePct,"%")}</small></span></button>;})}<p className="border-t border-sand-200 pt-3 text-xs text-forest-500">{totalEggs.toLocaleString()} classified eggs</p></div></div>}</section><section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Ration mix</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Feed used by type</h2><p className="mt-1 text-sm text-forest-600">Quantity share, based on synchronized feed intake.</p><div className="mt-5 space-y-4">{data.breakdowns.feedTypes.length === 0 ? <EmptyChart message="No synchronized feed type data are available."/> : data.breakdowns.feedTypes.map((item,index)=><div key={item.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="capitalize font-medium text-forest-800">{item.label}</span><span className="tabular-nums text-forest-600">{number(item.valueKg," kg")} · {number(item.sharePct,"%")}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-sand-100"><div className={`h-full rounded-full ${index===0?"bg-forest-700":index===1?"bg-leaf-500":index===2?"bg-amber-500":"bg-forest-500/50"}`} style={{width:`${Math.max(2,item.sharePct)}%`}}/></div></div>)}</div></section></div>;
}

function EconomicsStrip({ data }: { data: OperationsAnalyticsResponse }) {
  const items = [
    ["Feed cost", money(data.economics.feedCost), data.economics.confidence === "actual" ? "Costed inventory issues" : "Add feed issue costs", Wheat],
    ["Feed cost / egg", money(data.economics.feedCostPerEgg, 4), "Layer output efficiency", Egg],
    ["Feed cost / bird-day", money(data.economics.feedCostPerBirdDay, 4), "Normalized input cost", Bird],
    ["Layer FCR", number(data.summary.current.layerFcr), "Feed kg / egg mass kg", Scale],
    ["Water : feed", number(data.summary.current.waterFeedRatio), "Liters / feed kg", Activity],
    ["Low-stock items", data.economics.lowStockCount.toLocaleString(), "Items at reorder level", CircleAlert],
  ] as const;
  return <section className="overflow-hidden rounded-2xl border border-sand-200 bg-forest-900 text-sand-50 shadow-sm"><div className="border-b border-white/10 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-sand-200">Operational economics</p><h2 className="mt-1 font-display text-xl font-semibold">Cost and resource efficiency</h2></div><div className="grid sm:grid-cols-2 xl:grid-cols-6">{items.map(([label,value,note,Icon],index)=><article key={label} className={`p-4 ${index ? "border-t border-white/10 sm:border-l sm:border-t-0" : ""}`}><Icon className="h-4 w-4 text-leaf-400"/><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.12em] text-sand-200">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p><p className="mt-1 text-[11px] text-sand-200/80">{note}</p></article>)}</div></section>;
}

function DataTrust({ data }: { data: OperationsAnalyticsResponse }) {
  const scores = [["Daily Records",data.dataTrust.recordCoveragePct],["Synchronized feed",data.dataTrust.feedDataCoveragePct],["Mortality causes",data.dataTrust.mortalityCauseCoveragePct],["Breed targets",data.dataTrust.targetCoveragePct]] as const;
  return <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><div className="rounded-xl bg-forest-900 p-2 text-white"><ShieldCheck className="h-5 w-5"/></div><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Data trust</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">How much confidence to place in this view</h2></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2">{scores.map(([label,value])=><div key={label}><div className="flex justify-between text-xs"><span className="text-forest-600">{label}</span><strong className="text-forest-900">{number(value,"%",0)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-100"><div className={`h-full rounded-full ${(value??0)>=90?"bg-leaf-500":(value??0)>=70?"bg-amber-500":"bg-ember-500"}`} style={{width:`${Math.min(100,value??0)}%`}}/></div></div>)}</div><div className="mt-5 space-y-2 border-t border-sand-200 pt-4">{data.dataTrust.notes.map((note)=><p key={note} className="flex gap-2 text-xs leading-5 text-forest-600"><DatabaseZap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-500"/>{note}</p>)}</div></section>;
}

function RecentEvidence({ rows }: { rows: OperationsAnalyticsResponse["recentRecords"] }) {
  return <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm"><div className="flex items-end justify-between gap-3 border-b border-sand-200 p-5"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Source evidence</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Recent records behind the analysis</h2></div><Link href="/app/daily-records" className="shrink-0 text-xs font-semibold text-forest-800 underline decoration-sand-200 underline-offset-4">Open Daily Records</Link></div><div className="max-w-full overflow-x-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead><tr className="border-b border-sand-200 bg-sand-50 text-[10px] uppercase tracking-[.14em] text-forest-500"><th className="px-5 py-3">Date</th><th className="px-4 py-3">Farm / flock</th><th className="px-4 py-3">Birds</th><th className="px-4 py-3">Eggs</th><th className="px-4 py-3">HDEP</th><th className="px-4 py-3">Feed / bird</th><th className="px-4 py-3">Deaths</th><th className="px-4 py-3">Marketable</th><th className="px-5 py-3">Updated</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan={9} className="px-5 py-8 text-center text-forest-600">No records are available in this period.</td></tr>:rows.map((row)=><tr key={row.id} className="border-b border-sand-100 last:border-0"><td className="px-5 py-3 font-medium text-forest-900">{shortDate(row.date)}</td><td className="px-4 py-3"><strong className="block text-forest-900">{row.flock}</strong><span className="text-xs text-forest-500">{row.farm}</span></td><td className="px-4 py-3 tabular-nums">{number(row.birds)}</td><td className="px-4 py-3 tabular-nums">{number(row.eggs)}</td><td className="px-4 py-3 tabular-nums">{number(row.hdep,"%")}</td><td className="px-4 py-3 tabular-nums">{number(row.feedPerBirdGrams," g")}</td><td className="px-4 py-3 tabular-nums">{number(row.deaths)}</td><td className="px-4 py-3 tabular-nums">{number(row.marketableRate,"%")}</td><td className="px-5 py-3 text-xs text-forest-500">{new Date(row.updatedAt).toLocaleString()}</td></tr>)}</tbody></table></div></section>;
}

function LoadingState() {
  return <div className="space-y-5" aria-label="Loading Operations Analytics"><div className="h-72 animate-pulse rounded-2xl bg-forest-900/20"/><div className="grid gap-4 sm:grid-cols-3">{[1,2,3].map((value)=><div key={value} className="h-36 animate-pulse rounded-2xl bg-sand-100"/>)}</div><div className="h-[520px] animate-pulse rounded-2xl bg-sand-100"/></div>;
}

export function OperationsAnalyticsControlRoom() {
  const { scope, period, filteredFlocks, filteredBatches } = useFarmScope();
  const [dateFrom, setDateFrom] = usePageFilter<string>("dateFrom", period.dateFrom);
  const [dateTo, setDateTo] = usePageFilter<string>("dateTo", period.dateTo);
  const [data, setData] = useState<OperationsAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);


  const scopeKey = `${scope.branchId}|${scope.farmId}|${scope.houseId}|${scope.flockId}|${scope.batchId}|${filteredFlocks.length}|${filteredBatches.length}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, branch_id: scope.branchId, farm_id: scope.farmId, house_id: scope.houseId, flock_id: scope.flockId, batch_id: scope.batchId });
    const response = await fetch(`/api/operations-analytics?${params}`, { signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error ?? "Could not load Operations Analytics.");
    setData(body as OperationsAnalyticsResponse);
    setLoading(false);
  }, [dateFrom, dateTo, scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId]);

  useEffect(() => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) return;
    const controller = new AbortController();
    void load(controller.signal).catch((reason: unknown) => { if (reason instanceof DOMException && reason.name === "AbortError") return; setError(reason instanceof Error ? reason.message : "Could not load Operations Analytics."); setLoading(false); });
    return () => controller.abort();
  }, [load, scopeKey, refreshKey, dateFrom, dateTo]);

  if (loading && !data) return <LoadingState/>;
  if (error && !data) return <div className="rounded-2xl border border-ember-500/30 bg-ember-500/10 p-6"><CircleAlert className="h-6 w-6 text-ember-500"/><h2 className="mt-3 font-display text-xl font-semibold text-forest-900">Analytics could not be loaded</h2><p className="mt-1 text-sm text-forest-600">{error}</p><button type="button" onClick={()=>setRefreshKey((value)=>value+1)} className="mt-4 rounded-xl bg-forest-900 px-4 py-2 text-sm font-semibold text-white">Try again</button></div>;
  if (!data) return null;

  return (
    <div className="max-w-full min-w-0 space-y-5 overflow-x-clip">
      <div className="flex justify-end"><ResetPageFilters /></div>
      <header className="overflow-hidden rounded-2xl border border-forest-700 bg-forest-900 text-sand-50 shadow-sm">
        <div className="relative p-5 sm:p-7"><div className="pointer-events-none absolute right-8 top-0 h-36 w-36 rounded-full border border-white/10"/><div className="pointer-events-none absolute right-20 top-10 h-24 w-24 rounded-full border border-leaf-400/20"/><div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div className="max-w-3xl"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.24em] text-leaf-400"><Sparkles className="h-3.5 w-3.5"/>Operations intelligence</div><h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">Read the farm as a connected production system.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-sand-200">See whether feed, flock output, mortality, quality, and record coverage moved together—then identify exactly which farm or flock explains the change.</p></div><div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4 xl:grid-cols-2"><div><span className="block text-sand-200/70">Scope</span><strong className="mt-1 block text-sm">{data.meta.scopeLabel}</strong></div><div><span className="block text-sand-200/70">Window</span><strong className="mt-1 block text-sm">{formatDate(data.meta.dateFrom)} – {formatDate(data.meta.dateTo)}</strong></div><div><span className="block text-sand-200/70">Live birds</span><strong className="mt-1 block text-sm">{data.summary.liveBirds.toLocaleString()}</strong></div><div><span className="block text-sand-200/70">Evidence</span><strong className="mt-1 block text-sm">{number(data.summary.current.recordCoveragePct,"%",0)}</strong></div></div></div><div className="relative mt-6"><ScopeFilters dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} onRefresh={()=>setRefreshKey((value)=>value+1)} loading={loading}/></div></div>
      </header>

      {error ? <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-forest-700"><span>{error} Showing the last successful result.</span><button type="button" onClick={()=>setRefreshKey((value)=>value+1)} className="font-semibold underline">Retry</button></div>:null}

      <section className="grid overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-6" aria-label="Period performance summary">
        <MetricCell label="HDEP" value={data.summary.current.hdep} unit="%" comparison={data.summary.comparisons.hdep} note="Bird-day normalized layer output" icon={Egg}/>
        <MetricCell label="Feed / bird-day" value={data.summary.current.feedPerBirdGrams} unit=" g" comparison={data.summary.comparisons.feedPerBirdGrams} note="Only records with feed values" icon={Wheat}/>
        <MetricCell label="Mortality intensity" value={data.summary.current.mortalityPer1000BirdDays} comparison={data.summary.comparisons.mortalityPer1000BirdDays} note="Deaths per 1,000 bird-days" icon={Activity} inverted/>
        <MetricCell label="Marketable eggs" value={data.summary.current.marketableRate} unit="%" comparison={data.summary.comparisons.marketableRate} note="Normal ÷ quality-classified eggs" icon={Target}/>
        <MetricCell label="Feed consumed" value={data.summary.current.feedKg} unit=" kg" comparison={data.summary.comparisons.feedKg} note="Synchronized period total" icon={Scale}/>
        <MetricCell label="Record coverage" value={data.summary.current.recordCoveragePct} unit="%" comparison={data.summary.comparisons.recordCoveragePct} note={`${data.summary.current.records}/${data.summary.current.expectedRecords} expected flock-days`} icon={DatabaseZap}/>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.75fr)]"><ProductionFingerprint data={data}/><InsightQueue insights={data.insights}/></div>
      <FlockIntelligence rows={data.flocks}/>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2"><FeedProductionComparison flocks={data.flocks}/><FarmComparison farms={data.farms}/></div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]"><MortalityCauses rows={data.breakdowns.mortalityCauses}/><DataTrust data={data}/></div>
      <section className="rounded-2xl border border-sand-200 bg-[#f3efe5] px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">Advanced analysis</p><div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-display text-xl font-semibold text-forest-900">Relationship and cause-priority charts</h2><p className="mt-1 text-sm text-forest-600">Use these after the simpler summaries above. Each chart includes a reading guide and an automatic interpretation of the current data.</p></div><span className="w-fit rounded-full border border-forest-900/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-forest-600">Manager detail</span></div></section>
      <div className="grid min-w-0 gap-5 xl:grid-cols-2"><FeedResponseScatter flocks={data.flocks}/><MortalityParetoAdvanced rows={data.breakdowns.mortalityCauses}/></div>
      <QualityAndFeed data={data}/>
      <EconomicsStrip data={data}/>
      <RecentEvidence rows={data.recentRecords}/>
      <p className="flex items-center justify-end gap-2 text-[11px] text-forest-500"><Layers3 className="h-3.5 w-3.5"/>Refreshed {new Date(data.meta.refreshedAt).toLocaleString()} · Addis Ababa reporting date</p>
    </div>
  );
}
