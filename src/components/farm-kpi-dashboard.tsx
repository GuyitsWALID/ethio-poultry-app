"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { useFarmScope } from "@/components/farm-scope-context";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type DashboardMode = "management" | "operations";
type DashboardDepth = "overview" | "analytics";

type KpiResponse = {
  general: {
    liveBirds: number;
    activeFlocks: number;
    activeFarms: number;
    activeHouses: number;
    mortalityRate: number;
    productionRate: number;
    eggs: { total: number; normal: number; broken: number };
    feed: { grams: number; kg: number; quantity: number; leftoverGrams: number };
    lowStockCount: number;
    upcomingVaccinations: number;
  };
  operational: {
    feedPerBirdGrams: number;
    feedLeftoverGrams: number;
    dailyDeaths: number;
    latestFlockAges: Array<{ flock: string; weeks: number | null; days: number | null }>;
  };
  charts: {
    trends: Array<{ date: string; deaths: number; eggs: number; feedKg: number }>;
    flockComparison: Array<{
      id: string;
      label: string;
      farm: string;
      house: string;
      liveBirds: number;
      deaths: number;
      eggs: number;
      feedKg: number;
      productionRate: number;
      mortalityRate: number;
    }>;
    eggQuality: Array<{ label: string; value: number }>;
    mortalityCauses: Array<{ label: string; value: number }>;
    feedTypes: Array<{ label: string; value: number }>;
  };
  recentRecords: Array<{
    id: string;
    date: string;
    flock: string;
    farm: string;
    age: string;
    deaths: number;
    eggs: number;
    productionRate: number;
    mortalityRate: number;
    vaccinationStatus: string;
    treatment: string;
  }>;
  alerts: Array<{ title: string; severity: "high" | "medium" | "low"; route: string }>;
};

const emptyResponse: KpiResponse = {
  general: {
    liveBirds: 0,
    activeFlocks: 0,
    activeFarms: 0,
    activeHouses: 0,
    mortalityRate: 0,
    productionRate: 0,
    eggs: { total: 0, normal: 0, broken: 0 },
    feed: { grams: 0, kg: 0, quantity: 0, leftoverGrams: 0 },
    lowStockCount: 0,
    upcomingVaccinations: 0,
  },
  operational: { feedPerBirdGrams: 0, feedLeftoverGrams: 0, dailyDeaths: 0, latestFlockAges: [] },
  charts: { trends: [], flockComparison: [], eggQuality: [], mortalityCauses: [], feedTypes: [] },
  recentRecords: [],
  alerts: [],
};

const chartConfig = {
  eggs: { label: "Eggs", color: "var(--chart-1)" },
  deaths: { label: "Deaths", color: "var(--chart-4)" },
  feedKg: { label: "Feed kg", color: "var(--chart-2)" },
  productionRate: { label: "Production %", color: "var(--chart-1)" },
  mortalityRate: { label: "Mortality %", color: "var(--chart-4)" },
  liveBirds: { label: "Live Birds", color: "var(--chart-2)" },
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig;

const pieColors = ["var(--chart-1)", "var(--chart-4)", "var(--chart-3)", "var(--chart-2)", "var(--chart-5)"];

function defaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return date.toISOString().slice(0, 10);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatNumber(value: number, suffix = "") {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function KpiCard({
  label,
  value,
  note,
  href,
}: {
  label: string;
  value: string;
  note: string;
  href?: string;
}) {
  const content = (
    <article className="h-full rounded-2xl border border-sand-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-xs uppercase tracking-[0.2em] text-forest-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-forest-900">{value}</p>
      <p className="mt-2 text-xs text-forest-600">{note}</p>
    </article>
  );

  if (!href) return content;
  return <a href={href}>{content}</a>;
}

function ScopeAndDateFilters({
  mode,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
}: {
  mode: DashboardMode;
  dateFrom: string;
  dateTo: string;
  setDateFrom: (value: string) => void;
  setDateTo: (value: string) => void;
}) {
  const {
    scope,
    setScope,
    branches,
    filteredFarms,
    filteredHouses,
    filteredFlocks,
    filteredBatches,
  } = useFarmScope();

  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-forest-900">Analysis Filters</h3>
          <p className="text-sm text-forest-600">Filter by date, branch, farm, house, flock, and batch.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDateFrom(defaultFromDate());
            setDateTo(todayDate());
            setScope({ branchId: "", farmId: "", batchId: "", houseId: "", flockId: "" });
          }}
          className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
        >
          Reset filters
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-xs text-forest-600">
          From
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900" />
        </label>
        <label className="grid gap-1 text-xs text-forest-600">
          To
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900" />
        </label>
        {mode === "management" ? (
          <label className="grid gap-1 text-xs text-forest-600">
            Branch
            <select value={scope.branchId} onChange={(event) => setScope((prev) => ({ ...prev, branchId: event.target.value, farmId: "", houseId: "", flockId: "", batchId: "" }))} className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900">
              <option value="">All Branches</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
        ) : null}
        <label className="grid gap-1 text-xs text-forest-600">
          Farm
          <select value={scope.farmId} onChange={(event) => setScope((prev) => ({ ...prev, farmId: event.target.value, houseId: "", flockId: "", batchId: "" }))} className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900">
            <option value="">All Farms</option>
            {filteredFarms.map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-forest-600">
          House
          <select value={scope.houseId} onChange={(event) => setScope((prev) => ({ ...prev, houseId: event.target.value, flockId: "", batchId: "" }))} className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900">
            <option value="">All Houses</option>
            {filteredHouses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-forest-600">
          Flock
          <select value={scope.flockId} onChange={(event) => setScope((prev) => ({ ...prev, flockId: event.target.value, batchId: "" }))} className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900">
            <option value="">All Flocks</option>
            {filteredFlocks.map((flock) => <option key={flock.id} value={flock.id}>{flock.flock_code}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-forest-600">
          Batch
          <select value={scope.batchId} onChange={(event) => setScope((prev) => ({ ...prev, batchId: event.target.value }))} className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900">
            <option value="">All Batches</option>
            {filteredBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_code}</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

function TrendChart({
  title,
  rows,
  keys,
}: {
  title: string;
  rows: KpiResponse["charts"]["trends"];
  keys: Array<"eggs" | "deaths" | "feedKg">;
}) {
  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-forest-900">{title}</h3>
      <ChartContainer config={chartConfig} className="mt-4 h-[260px] w-full">
        <AreaChart data={rows} margin={{ left: 0, right: 12, top: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--sand-200)" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value: string) => value.slice(5)} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={42} />
          <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
          {keys.map((key) => (
            <Area key={key} type="monotone" dataKey={key} stroke={`var(--color-${key})`} fill={`var(--color-${key})`} fillOpacity={0.18} strokeWidth={2} />
          ))}
        </AreaChart>
      </ChartContainer>
    </section>
  );
}

function FlockBarChart({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: KpiResponse["charts"]["flockComparison"];
  metric: "eggs" | "deaths" | "feedKg" | "productionRate" | "mortalityRate" | "liveBirds";
}) {
  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-forest-900">{title}</h3>
      <ChartContainer config={chartConfig} className="mt-4 h-[300px] w-full">
        <BarChart data={rows} margin={{ left: 0, right: 12, top: 12 }}>
          <CartesianGrid vertical={false} stroke="var(--sand-200)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={42} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey={metric} fill={`var(--color-${metric})`} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </section>
  );
}

function PieBreakdown({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  const data = rows.filter((row) => row.value > 0);
  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-forest-900">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-4 text-sm text-forest-600">No data yet.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {data.map((row, index) => (
                  <Cell key={row.label} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="space-y-2 self-center">
            {data.map((row, index) => (
              <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-forest-700">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="font-medium text-forest-900">{row.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ActionAlerts({ alerts }: { alerts: KpiResponse["alerts"] }) {
  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-forest-900">Management Attention</h3>
          <p className="text-sm text-forest-600">Items that need review before they become bigger problems.</p>
        </div>
        <a href="/app/alerts" className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700">View alerts</a>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {alerts.length === 0 ? (
          <p className="text-sm text-forest-600">No KPI alerts for this scope.</p>
        ) : (
          alerts.map((alert) => (
            <a key={alert.title} href={alert.route} className="rounded-xl border border-sand-200 bg-sand-50 p-4 text-sm text-forest-800">
              <span className="font-medium capitalize text-forest-900">{alert.severity}</span> · {alert.title}
            </a>
          ))
        )}
      </div>
    </section>
  );
}

function RecentRecords({ rows }: { rows: KpiResponse["recentRecords"] }) {
  return (
    <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-forest-900">Recent Daily Records</h3>
          <p className="text-sm text-forest-600">Operational entries feeding the analytics.</p>
        </div>
        <a href="/app/daily-records" className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50">Open daily records</a>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.12em] text-forest-600">
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2">Farm</th>
              <th className="px-2 py-2">Flock</th>
              <th className="px-2 py-2">Eggs</th>
              <th className="px-2 py-2">Production %</th>
              <th className="px-2 py-2">Deaths</th>
              <th className="px-2 py-2">Death %</th>
              <th className="px-2 py-2">Vaccination</th>
              <th className="px-2 py-2">Treatment</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={9} className="px-2 py-4 text-forest-600">No recent daily records found.</td></tr>
            ) : (
              rows.map((record) => (
                <tr key={record.id} className="border-b border-sand-100">
                  <td className="px-2 py-2">{record.date}</td>
                  <td className="px-2 py-2">{record.farm}</td>
                  <td className="px-2 py-2">{record.flock}</td>
                  <td className="px-2 py-2">{record.eggs.toLocaleString()}</td>
                  <td className="px-2 py-2">{record.productionRate}%</td>
                  <td className="px-2 py-2">{record.deaths.toLocaleString()}</td>
                  <td className="px-2 py-2">{record.mortalityRate}%</td>
                  <td className="px-2 py-2">{record.vaccinationStatus}</td>
                  <td className="px-2 py-2">{record.treatment}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function FarmKpiDashboard({ mode, depth = "overview" }: { mode: DashboardMode; depth?: DashboardDepth }) {
  const { scope, filteredFlocks, filteredBatches } = useFarmScope();
  const [dateFrom, setDateFrom] = useState(defaultFromDate());
  const [dateTo, setDateTo] = useState(todayDate());
  const [data, setData] = useState<KpiResponse>(emptyResponse);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scopeKey = `${scope.branchId}|${scope.farmId}|${scope.houseId}|${scope.flockId}|${scope.batchId}|${filteredFlocks.length}|${filteredBatches.length}`;

  useEffect(() => {
    const controller = new AbortController();
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo,
        branch_id: scope.branchId,
        farm_id: scope.farmId,
        house_id: scope.houseId,
        flock_id: scope.flockId,
        batch_id: scope.batchId,
      });
      const response = await fetch(`/api/farm-kpis?${params.toString()}`, { signal: controller.signal });
      if (!response.ok) {
        setError("Could not load KPI dashboard data.");
        setLoading(false);
        return;
      }
      setData((await response.json()) as KpiResponse);
      setLoading(false);
    };

    void loadDashboard().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Could not load KPI dashboard data.");
      setLoading(false);
    });

    return () => controller.abort();
  }, [dateFrom, dateTo, scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId, scopeKey]);

  const managementCards = [
    { label: "Live Birds", value: formatNumber(data.general.liveBirds), note: "Current active flock count", href: "/app/flocks" },
    { label: "Active Flocks", value: formatNumber(data.general.activeFlocks), note: "Flocks currently in production", href: "/app/flocks" },
    { label: "Mortality Rate", value: formatNumber(data.general.mortalityRate, "%"), note: "Period deaths vs live-bird baseline", href: "/app/analytics" },
    { label: "Production Rate", value: formatNumber(data.general.productionRate, "%"), note: "Egg output against live birds", href: "/app/analytics" },
    { label: "Eggs Produced", value: formatNumber(data.general.eggs.total), note: "Selected period output", href: "/app/analytics" },
    { label: "Low Stock Alerts", value: formatNumber(data.general.lowStockCount), note: "Inventory needing attention", href: "/app/inventory" },
  ];

  const operationsCards = [
    { label: "Daily Deaths", value: formatNumber(data.operational.dailyDeaths), note: "Deaths in selected period", href: "/app/daily-records" },
    { label: "Feed / Bird", value: formatNumber(data.operational.feedPerBirdGrams, " g"), note: "Feed intake efficiency", href: "/app/analytics" },
    { label: "Feed Leftover", value: formatNumber(data.operational.feedLeftoverGrams / 1000, " kg"), note: "Waste or unused feed", href: "/app/analytics" },
    { label: "Broken Eggs", value: formatNumber(data.general.eggs.broken), note: "Quality and handling signal", href: "/app/analytics" },
    { label: "Active Houses", value: formatNumber(data.general.activeHouses), note: "Houses with live flocks", href: "/app/farms" },
    { label: "Upcoming Vaccines", value: formatNumber(data.general.upcomingVaccinations), note: "Next 14 days", href: "/app/health" },
  ];

  const cards = mode === "management" ? managementCards : operationsCards;

  return (
    <div className="space-y-6">
      <ScopeAndDateFilters mode={mode} dateFrom={dateFrom} dateTo={dateTo} setDateFrom={setDateFrom} setDateTo={setDateTo} />

      {error ? <div className="rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-500">{error}</div> : null}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-forest-900">
              {depth === "analytics" ? "KPI Analysis Summary" : mode === "management" ? "Management Overview" : "Operations Overview"}
            </h3>
            <p className="text-sm text-forest-600">{loading ? "Refreshing KPI data..." : `${dateFrom} to ${dateTo}`}</p>
          </div>
          {depth === "overview" ? (
            <a href="/app/analytics" className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50">Open deep analytics</a>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => <KpiCard key={card.label} {...card} />)}
        </div>
      </section>

      {depth === "overview" ? (
        <>
          <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-forest-900">Managerial Readout</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-sand-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-forest-500">Productivity</p>
                <p className="mt-2 text-sm text-forest-700">Production is currently {formatNumber(data.general.productionRate, "%")} with {formatNumber(data.general.eggs.total)} eggs recorded.</p>
              </div>
              <div className="rounded-xl bg-sand-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-forest-500">Risk</p>
                <p className="mt-2 text-sm text-forest-700">Mortality is {formatNumber(data.general.mortalityRate, "%")} with {formatNumber(data.operational.dailyDeaths)} deaths in scope.</p>
              </div>
              <div className="rounded-xl bg-sand-50 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-forest-500">Input Use</p>
                <p className="mt-2 text-sm text-forest-700">{formatNumber(data.general.feed.kg, " kg")} feed consumed and {formatNumber(data.operational.feedPerBirdGrams, " g")} per bird.</p>
              </div>
            </div>
          </section>
          <ActionAlerts alerts={data.alerts} />
        </>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <TrendChart title="Production, Mortality, and Feed Trends" rows={data.charts.trends} keys={["eggs", "deaths", "feedKg"]} />
            <FlockBarChart title="Live Birds by Flock" rows={data.charts.flockComparison} metric="liveBirds" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <FlockBarChart title="Egg Production by Flock" rows={data.charts.flockComparison} metric="eggs" />
            <FlockBarChart title="Mortality Rate by Flock" rows={data.charts.flockComparison} metric="mortalityRate" />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <PieBreakdown title="Egg Quality Split" rows={data.charts.eggQuality} />
            <PieBreakdown title="Mortality Causes" rows={data.charts.mortalityCauses} />
            <PieBreakdown title="Feed Type Usage" rows={data.charts.feedTypes} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <KpiCard label="Feed Cost / Egg" value="Not available" note="Requires feed cost allocation from inventory usage." href="/app/inventory" />
            <KpiCard label="Profit / Flock" value="Not available" note="Requires sales revenue and flock-level cost allocation." href="/app/sales" />
          </div>
          <ActionAlerts alerts={data.alerts} />
          <RecentRecords rows={data.recentRecords} />
        </>
      )}
    </div>
  );
}
