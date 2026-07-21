/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity, Bird, CheckCircle2, ClipboardCheck, Clock3, Egg,
  Minus, PackageOpen, RefreshCw, Scale, TrendingDown, TrendingUp, Wheat,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { useFarmScope } from "@/components/farm-scope-context";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { AttentionStatus, FarmManagerDashboardResponse, FlockComparison, TrendDirection } from "@/lib/farm-manager-dashboard";

const chartConfig = {
  hdep: { label: "HDEP %", color: "var(--chart-1)" },
  feedPerBirdGrams: { label: "Feed g/bird", color: "var(--chart-2)" },
  mortality: { label: "Mortality %", color: "var(--chart-4)" },
} satisfies ChartConfig;

function number(value: number | null, suffix = "", places = 2) {
  return value === null ? "Unavailable" : `${value.toLocaleString(undefined, { maximumFractionDigits: places })}${suffix}`;
}

function money(value: number | null, places = 2) {
  return value === null ? "Unavailable" : `ETB ${value.toLocaleString(undefined, { maximumFractionDigits: places })}`;
}

function statusStyle(status: AttentionStatus) {
  if (status === "critical") return "border-ember-500/30 bg-ember-500/10 text-ember-500";
  if (status === "watch") return "border-amber-500/30 bg-amber-500/10 text-amber-500";
  if (status === "pending") return "border-sky-500/30 bg-sky-500/10 text-sky-500";
  return "border-leaf-500/30 bg-leaf-500/10 text-forest-700";
}

function TrendIcon({ value }: { value: TrendDirection }) {
  if (value === "up") return <TrendingUp className="h-4 w-4 text-leaf-500" aria-label="Improving" />;
  if (value === "down") return <TrendingDown className="h-4 w-4 text-ember-500" aria-label="Declining" />;
  return <Minus className="h-4 w-4 text-forest-500" aria-label={value === "flat" ? "Stable" : "Trend unavailable"} />;
}

function TargetRail({ flock }: { flock: FlockComparison }) {
  if (flock.actual === null) return <div className="mt-2 text-xs text-forest-500">Awaiting a current measurement</div>;
  if (flock.targetAttainment === null) {
    return <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-100"><div className="h-full w-1/2 rounded-full bg-forest-500/50" /></div>;
  }
  const actualWidth = Math.max(2, Math.min(100, (flock.targetAttainment / 120) * 100));
  return (
    <div className="mt-2" aria-label={`${number(flock.targetAttainment, "%")} of target`}>
      <div className="relative h-2 rounded-full bg-sand-100">
        <div className={`h-full rounded-full ${flock.status === "critical" ? "bg-ember-500" : flock.status === "watch" ? "bg-amber-500" : "bg-leaf-500"}`} style={{ width: `${actualWidth}%` }} />
        <span className="absolute inset-y-[-3px] left-[83.33%] w-px bg-forest-900" aria-hidden="true" />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-forest-500"><span>0</span><span>Target</span><span>120%</span></div>
    </div>
  );
}

function FlockDetail({ flock }: { flock: FlockComparison }) {
  return (
    <>
      <div>
        <div className="flex items-center gap-2"><strong className="text-forest-900">{flock.code}</strong><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyle(flock.status)}`}>{flock.status}</span></div>
        <p className="mt-1 text-xs text-forest-600">{flock.houseName} · week {flock.ageWeeks} · {flock.type.replace("_", " ")}</p>
      </div>
      <div>
        <div className="flex items-center justify-between gap-2"><span className="text-xs text-forest-500">{flock.metricLabel}</span><TrendIcon value={flock.trend} /></div>
        <p className="mt-1 text-lg font-semibold tabular-nums text-forest-900">{number(flock.actual, flock.unit)}</p>
        <p className="text-[11px] text-forest-500">Target {number(flock.target, flock.unit)} · 7d/previous {number(flock.baseline, flock.unit)}</p>
        <TargetRail flock={flock} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="block text-forest-500">Feed / bird</span><strong className="text-forest-800">{number(flock.feedPerBirdGrams, " g")}</strong></div>
        <div><span className="block text-forest-500">Mortality</span><strong className="text-forest-800">{number(flock.mortalityRate, "%")}</strong></div>
        <div><span className="block text-forest-500">{flock.metricKind === "hdep" ? "Marketable" : "Uniformity"}</span><strong className="text-forest-800">{number(flock.metricKind === "hdep" ? flock.marketableRate : flock.uniformityPct, "%")}</strong></div>
        <div><span className="block text-forest-500">Data</span><strong className="capitalize text-forest-800">{flock.dataStatus}</strong></div>
      </div>
      <Link href={flock.actionRoute} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-forest-900/15 px-3 text-center text-xs font-semibold text-forest-800 hover:bg-sand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700">{flock.nextAction}</Link>
    </>
  );
}

function ComparisonBoard({ groups }: { groups: FarmManagerDashboardResponse["farmGroups"] }) {
  const [sort, setSort] = useState<"attention" | "performance">("attention");
  const sorted = (rows: FlockComparison[]) => [...rows].sort((a, b) => sort === "attention"
    ? b.attentionScore - a.attentionScore || a.code.localeCompare(b.code)
    : (b.targetAttainment ?? -1) - (a.targetAttainment ?? -1) || a.code.localeCompare(b.code));
  return (
    <section aria-labelledby="flock-board-title" className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-sand-200 bg-[#f3efe5] p-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[11px] font-semibold uppercase tracking-[.2em] text-forest-500">Today against target and recent form</p><h2 id="flock-board-title" className="mt-1 font-display text-2xl font-semibold text-forest-900">Flock performance lanes</h2><p className="mt-1 text-sm text-forest-600">Age-adjusted comparisons make different flock sizes and production stages comparable.</p></div>
        <div className="inline-flex w-fit rounded-xl border border-sand-200 bg-white p-1" role="group" aria-label="Sort flock comparison">
          {(["attention", "performance"] as const).map((value) => <button key={value} type="button" onClick={() => setSort(value)} aria-pressed={sort === value} className={`min-h-9 rounded-lg px-3 text-xs font-semibold capitalize ${sort === value ? "bg-forest-900 text-white" : "text-forest-600 hover:bg-sand-50"}`}>{value === "attention" ? "Needs attention" : "Performance"}</button>)}
        </div>
      </div>
      {groups.length === 0 ? <div className="p-8 text-sm text-forest-600">No active flocks are available. Add or activate a flock to begin comparison.</div> : groups.map((group) => (
        <div key={group.id} className="border-b border-sand-200 last:border-0">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-sand-50 px-5 py-3"><div><h3 className="font-semibold text-forest-900">{group.name}</h3><p className="text-xs text-forest-600">{group.flocks.length} flocks · {group.liveBirds.toLocaleString()} live birds</p></div><div className="flex gap-3 text-xs text-forest-600"><span>Records {number(group.recordCoveragePct, "%", 0)}</span><span>Feed closed {number(group.feedClosurePct, "%", 0)}</span></div></div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1050px] w-full table-fixed text-left text-sm">
              <thead><tr className="border-b border-sand-100 text-[10px] uppercase tracking-[.14em] text-forest-500"><th className="w-[18%] px-5 py-3">Flock</th><th className="w-[28%] px-4 py-3">Performance lane</th><th className="w-[24%] px-4 py-3">Operational signals</th><th className="w-[12%] px-4 py-3">Data</th><th className="w-[18%] px-5 py-3">Next move</th></tr></thead>
              <tbody>{sorted(group.flocks).map((flock) => <tr key={flock.id} className="border-b border-sand-100 align-top last:border-0"><td className="px-5 py-4"><div><strong>{flock.code}</strong><span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusStyle(flock.status)}`}>{flock.status}</span></div><p className="mt-1 text-xs text-forest-600">{flock.houseName} · W{flock.ageWeeks} · {flock.type.replace("_", " ")}</p></td><td className="px-4 py-4"><div className="flex items-center justify-between"><span className="text-xs text-forest-500">{flock.metricLabel}</span><TrendIcon value={flock.trend} /></div><p className="mt-1 text-xl font-semibold tabular-nums">{number(flock.actual, flock.unit)} <span className="text-xs font-normal text-forest-500">/ target {number(flock.target, flock.unit)}</span></p><TargetRail flock={flock} /></td><td className="px-4 py-4"><div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><div><span className="block text-forest-500">Feed / bird</span><strong>{number(flock.feedPerBirdGrams, " g")}</strong></div><div><span className="block text-forest-500">Mortality</span><strong>{number(flock.mortalityRate, "%")}</strong></div><div><span className="block text-forest-500">{flock.metricKind === "hdep" ? "Marketable" : "Uniformity"}</span><strong>{number(flock.metricKind === "hdep" ? flock.marketableRate : flock.uniformityPct, "%")}</strong></div><div><span className="block text-forest-500">Feed day</span><strong>{flock.feedClosed ? "Closed" : "Open"}</strong></div></div></td><td className="px-4 py-4"><span className="capitalize">{flock.dataStatus}</span><p className="mt-1 text-[11px] text-forest-500">{flock.targetAvailable ? "Age target found" : "No age target"}</p></td><td className="px-5 py-4"><Link href={flock.actionRoute} className="font-semibold text-forest-800 underline decoration-sand-200 underline-offset-4 hover:decoration-forest-700">{flock.nextAction}</Link></td></tr>)}</tbody>
            </table>
          </div>
          <div className="grid gap-3 p-4 lg:hidden">{sorted(group.flocks).map((flock) => <article key={flock.id} className="grid gap-4 rounded-xl border border-sand-200 p-4"><FlockDetail flock={flock} /></article>)}</div>
        </div>
      ))}
    </section>
  );
}

function MetricStrip({ data }: { data: FarmManagerDashboardResponse }) {
  const metrics = [
    ["Live birds", number(data.summary.liveBirds), `${data.summary.activeFlocks} active flocks`, Bird],
    ["Marketable eggs", number(data.summary.marketableEggs), `${number(data.summary.todayEggs)} total today`, Egg],
    ["Feed / bird", number(data.summary.feedPerBirdGrams, " g"), "Today’s recorded intake", Wheat],
    ["Mortality", number(data.summary.mortalityRate, "%"), "Today’s bird-day rate", Activity],
    ["Records", `${data.summary.recordsComplete}/${data.summary.recordsExpected}`, "Today completed", ClipboardCheck],
    ["Feed closed", `${data.summary.feedDaysClosed}/${data.summary.feedDaysExpected}`, "Inventory finalized", CheckCircle2],
  ] as const;
  return <section aria-label="Today’s operational summary" className="grid overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-6">{metrics.map(([label, value, note, Icon], index) => <article key={label} className={`p-4 ${index ? "border-t border-sand-200 sm:border-l sm:border-t-0" : ""}`}><Icon className="h-4 w-4 text-forest-500"/><p className="mt-3 text-[10px] font-semibold uppercase tracking-[.14em] text-forest-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-forest-900">{value}</p><p className="mt-1 text-[11px] text-forest-600">{note}</p></article>)}</section>;
}

function TrendPanel({ dataKey, title, unit, rows }: { dataKey: "hdep" | "feedPerBirdGrams" | "mortality"; title: string; unit: string; rows: FarmManagerDashboardResponse["trends"] }) {
  return <article><div className="flex items-end justify-between"><div><p className="text-xs font-semibold text-forest-900">{title}</p><p className="text-[11px] text-forest-500">Last seven days · {unit}</p></div><span className="text-sm font-semibold tabular-nums text-forest-800">{number(rows.at(-1)?.[dataKey] ?? null, unit)}</span></div><ChartContainer config={chartConfig} className="mt-2 h-[145px] w-full"><AreaChart data={rows} margin={{ left: -25, right: 5, top: 8, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--sand-200)"/><XAxis dataKey="date" tickFormatter={(value: string) => value.slice(8)} tickLine={false} axisLine={false} fontSize={10}/><YAxis tickLine={false} axisLine={false} fontSize={10}/><ChartTooltip content={<ChartTooltipContent indicator="line"/>}/><Area type="monotone" dataKey={dataKey} stroke={`var(--color-${dataKey})`} fill={`var(--color-${dataKey})`} fillOpacity={0.14} strokeWidth={2} connectNulls/></AreaChart></ChartContainer></article>;
}

function LoadingSkeleton() {
  return <div className="space-y-4" aria-label="Loading Farm Manager dashboard"><div className="h-44 animate-pulse rounded-2xl bg-forest-900/20"/><div className="h-80 animate-pulse rounded-2xl bg-sand-100"/><div className="grid gap-3 sm:grid-cols-3">{[1,2,3].map((item)=><div key={item} className="h-32 animate-pulse rounded-2xl bg-sand-100"/>)}</div></div>;
}

export function ProductionControlRoom() {
  const { scope, setScope, farms, filteredHouses, filteredFlocks, filteredBatches } = useFarmScope();
  const [data, setData] = useState<FarmManagerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ farm_id: scope.farmId, house_id: scope.houseId, flock_id: scope.flockId, batch_id: scope.batchId });
    const response = await fetch(`/api/farm-manager/dashboard?${params}`, { signal });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error ?? "Could not load the Farm Manager dashboard.");
    setData(body as FarmManagerDashboardResponse); setLoading(false);
  }, [scope.batchId, scope.farmId, scope.flockId, scope.houseId]);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch((reason: unknown) => { if (reason instanceof DOMException && reason.name === "AbortError") return; setError(reason instanceof Error ? reason.message : "Could not load dashboard."); setLoading(false); }); return () => controller.abort(); }, [load]);

  if (loading && !data) return <LoadingSkeleton />;
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-2xl bg-forest-900 p-5 text-white shadow-sm sm:p-6">
      <div className="absolute inset-y-0 right-0 w-1/3 opacity-20 grain" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[.24em] text-leaf-400">Farm pulse · {data?.meta.asOf}</p><h1 className="mt-2 font-display text-3xl font-semibold">Production control room</h1><p className="mt-2 max-w-2xl text-sm text-sand-100">See which flock needs you first, then move directly to the record or workflow that changes the outcome.</p><div className="mt-4 flex flex-wrap gap-4 text-xs text-sand-100"><span>{data?.meta.scopeLabel}</span><span>Updated {data ? new Date(data.meta.refreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span><span>Addis Ababa time</span></div></div><button type="button" onClick={() => void load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Refresh failed."))} disabled={loading} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}/>Refresh now</button></div>
      <div className="relative mt-5 grid gap-3 border-t border-white/15 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs text-sand-100">Farm<select value={scope.farmId} onChange={(event)=>setScope((current)=>({...current,farmId:event.target.value,houseId:"",flockId:"",batchId:""}))} className="min-h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-white outline-none focus:ring-2 focus:ring-leaf-400"><option className="text-forest-900" value="">All assigned farms</option>{farms.map((farm)=><option className="text-forest-900" key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-sand-100">House<select value={scope.houseId} onChange={(event)=>setScope((current)=>({...current,houseId:event.target.value,flockId:"",batchId:""}))} className="min-h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-white outline-none focus:ring-2 focus:ring-leaf-400"><option className="text-forest-900" value="">All houses</option>{filteredHouses.map((house)=><option className="text-forest-900" key={house.id} value={house.id}>{house.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-sand-100">Flock<select value={scope.flockId} onChange={(event)=>setScope((current)=>({...current,flockId:event.target.value,batchId:""}))} className="min-h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-white outline-none focus:ring-2 focus:ring-leaf-400"><option className="text-forest-900" value="">All flocks</option>{filteredFlocks.map((flock)=><option className="text-forest-900" key={flock.id} value={flock.id}>{flock.flock_code}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-sand-100">Batch<select value={scope.batchId} onChange={(event)=>setScope((current)=>({...current,batchId:event.target.value}))} className="min-h-11 rounded-xl border border-white/20 bg-white/10 px-3 text-white outline-none focus:ring-2 focus:ring-leaf-400"><option className="text-forest-900" value="">All batches</option>{filteredBatches.map((batch)=><option className="text-forest-900" key={batch.id} value={batch.id}>{batch.batch_code}</option>)}</select></label>
      </div>
    </section>
    {error ? <div role="alert" className="rounded-xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-500">{error} <button type="button" onClick={()=>void load()} className="ml-2 font-semibold underline">Retry</button></div> : null}
    {data ? <>
      <ComparisonBoard groups={data.farmGroups}/>
      <MetricStrip data={data}/>
      <div className="grid gap-4 xl:grid-cols-[.9fr_1.5fr]">
        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-forest-900">Work queue</h2><p className="text-sm text-forest-600">Highest-impact work first.</p></div><span className="rounded-full bg-ember-500/10 px-2.5 py-1 text-xs font-semibold text-ember-500">{data.actions.filter((item)=>item.severity==="high").length} urgent</span></div><div className="mt-4 space-y-2">{data.actions.length ? data.actions.slice(0,8).map((action)=><Link key={action.id} href={action.route} className="flex min-h-14 items-start gap-3 rounded-xl border border-sand-200 p-3 hover:bg-sand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${action.severity==="high"?"bg-ember-500":action.severity==="medium"?"bg-amber-500":action.severity==="pending"?"bg-sky-500":"bg-leaf-500"}`}/><span><strong className="block text-sm text-forest-900">{action.title}</strong><span className="mt-0.5 block text-xs text-forest-600">{action.context}</span></span></Link>):<div className="rounded-xl bg-leaf-500/10 p-4 text-sm text-forest-700">No current exceptions. Continue the planned routine.</div>}</div><Link href="/app/alerts" className="mt-4 inline-flex text-sm font-semibold text-forest-700 underline underline-offset-4">View all alerts</Link></section>
        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div><h2 className="text-base font-semibold text-forest-900">Seven-day operating form</h2><p className="text-sm text-forest-600">Production, input use, and mortality are calculated from recorded bird-days.</p></div><div className="mt-5 grid gap-5 md:grid-cols-3"><TrendPanel dataKey="hdep" title="Layer HDEP" unit="%" rows={data.trends}/><TrendPanel dataKey="feedPerBirdGrams" title="Feed per bird" unit=" g" rows={data.trends}/><TrendPanel dataKey="mortality" title="Daily mortality" unit="%" rows={data.trends}/></div></section>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-forest-600"/><h2 className="text-base font-semibold text-forest-900">Operational cost signals</h2></div><p className="mt-1 text-sm text-forest-600">Feed cost only; revenue and profit remain in Sales and Reports.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["7-day feed cost",money(data.operationalCosts.feedCost7d),"Posted feed issues"],["Feed cost / egg",money(data.operationalCosts.feedCostPerEgg,4),"Laying flocks"],["Cost / growing bird-day",money(data.operationalCosts.feedCostPerGrowingBirdDay,4),"Broiler and rearing"],["Low-stock items",number(data.operationalCosts.lowStockCount),"Assigned stock scope"]].map(([label,value,note])=><div key={label} className="rounded-xl bg-sand-50 p-4"><p className="text-xs text-forest-500">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-forest-900">{value}</p><p className="mt-1 text-[11px] text-forest-600">{note}</p></div>)}</div></section>
        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Scale className="h-5 w-5 text-forest-600"/><h2 className="text-base font-semibold text-forest-900">Data trust</h2></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="text-lg font-semibold">{number(data.dataTrust.recordCoveragePct,"%",0)}</p><p className="text-[10px] text-forest-500">Records</p></div><div><p className="text-lg font-semibold">{number(data.dataTrust.feedClosurePct,"%",0)}</p><p className="text-[10px] text-forest-500">Feed close</p></div><div><p className="text-lg font-semibold">{number(data.dataTrust.targetCoveragePct,"%",0)}</p><p className="text-[10px] text-forest-500">Targets</p></div></div><ul className="mt-4 space-y-2 text-xs text-forest-600">{data.dataTrust.notes.map((note)=><li key={note} className="flex gap-2"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{note}</li>)}</ul></section>
      </div>
    </> : null}
  </div>;
}
