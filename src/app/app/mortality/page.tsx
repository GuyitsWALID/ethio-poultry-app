"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type DailyRecord = {
  id: string;
  flock_id: string;
  record_date: string;
  deaths: number | null;
  deaths_cause: string | null;
};

const fmt = (value: number) => value.toLocaleString();
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const chartColors = ["#245c45", "#e0a13a", "#b85c38", "#6f8f72", "#8265c9", "#2f7d91", "#c56b8c", "#8f6a35"];

const dayLabel = (dateStr: string) =>
  new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${dateStr}T00:00:00`));

const previousMonthStart = () => {
  const today = new Date();
  return isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
};

const eachDateInRange = (start: string, end: string) => {
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    dates.push(isoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const readableDateTick = (dateStr: string) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
};

export default function MortalityPage() {
  const {
    role,
    scope,
    setScope,
    filteredFlocks,
    filteredFarms,
    filteredHouses,
    farms,
    branches,
  } = useFarmScope();
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => previousMonthStart());
  const [dateTo, setDateTo] = useState(() => isoDate(new Date()));
  const canFilterBranch = role !== "farm_manager";
  const canSeeBranchComparison = role === "ceo" || role === "system_admin" || role === "super_admin";

  const flockToFarm = useMemo(() => {
    const map = new Map<string, string>();
    filteredFlocks.forEach((flock) => map.set(flock.id, flock.farm_id));
    return map;
  }, [filteredFlocks]);

  const flockPopulation = useMemo(() => {
    const map = new Map<string, number>();
    filteredFlocks.forEach((flock) => map.set(flock.id, flock.current_count ?? 0));
    return map;
  }, [filteredFlocks]);

  const flockInitialPopulation = useMemo(() => {
    const map = new Map<string, number>();
    filteredFlocks.forEach((flock) => map.set(flock.id, flock.initial_count ?? flock.current_count ?? 0));
    return map;
  }, [filteredFlocks]);

  const farmToBranch = useMemo(() => {
    const map = new Map<string, string>();
    farms.forEach((farm) => map.set(farm.id, farm.branch_id));
    return map;
  }, [farms]);

  const branchNameMap = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach((branch) => map.set(branch.id, branch.name));
    return map;
  }, [branches]);

  const farmNameMap = useMemo(() => {
    const map = new Map<string, string>();
    farms.forEach((farm) => map.set(farm.id, farm.name));
    return map;
  }, [farms]);

  const flockNameMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredFlocks.forEach((flock) => map.set(flock.id, flock.flock_code));
    return map;
  }, [filteredFlocks]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setDailyRecords([]);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) {
        setDailyRecords([]);
        setLoading(false);
        return;
      }

      const scopedFlockIds = filteredFlocks
        .filter((flock) => !scope.batchId || flock.batch_id === scope.batchId)
        .map((flock) => flock.id);

      let dailyQuery = supabase
        .from("daily_farm_records")
        .select("id, flock_id, record_date, deaths, deaths_cause")
        .eq("org_id", profile.org_id)
        .order("record_date", { ascending: false })
        .limit(2400);

      if (dateTo) {
        dailyQuery = dailyQuery.lte("record_date", dateTo);
      }

      if (scope.flockId) {
        dailyQuery = dailyQuery.eq("flock_id", scope.flockId);
      } else if (scopedFlockIds.length > 0) {
        dailyQuery = dailyQuery.in("flock_id", scopedFlockIds);
      } else if (scope.branchId || scope.farmId || scope.houseId || scope.batchId) {
        setDailyRecords([]);
        setLoading(false);
        return;
      }

      const { data: dailyRows } = await dailyQuery;
      setDailyRecords((dailyRows ?? []) as DailyRecord[]);
      setLoading(false);
    };

    void load();
  }, [scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId, filteredFlocks, dateFrom, dateTo]);

  const filteredDailyRecords = useMemo(
    () =>
      dailyRecords.filter((record) => (!dateFrom || record.record_date >= dateFrom) && (!dateTo || record.record_date <= dateTo)),
    [dailyRecords, dateFrom, dateTo]
  );

  const dailyMortality = useMemo(() => {
    const map = new Map<string, number>();
    filteredDailyRecords.forEach((record) => {
      map.set(record.record_date, (map.get(record.record_date) ?? 0) + (record.deaths ?? 0));
    });
    return Array.from(map.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [filteredDailyRecords]);

  const chartFlockIds = useMemo(
    () =>
      Array.from(new Set(filteredDailyRecords.map((record) => record.flock_id))).sort((a, b) =>
        (flockNameMap.get(a) ?? a).localeCompare(flockNameMap.get(b) ?? b)
      ),
    [filteredDailyRecords, flockNameMap]
  );

  const populationFlockIds = useMemo(
    () =>
      filteredFlocks
        .filter((flock) => !scope.batchId || flock.batch_id === scope.batchId)
        .map((flock) => flock.id)
        .sort((a, b) => (flockNameMap.get(a) ?? a).localeCompare(flockNameMap.get(b) ?? b)),
    [filteredFlocks, flockNameMap, scope.batchId]
  );

  const dailyMortalityChart = useMemo(() => {
    const map = new Map<string, Record<string, number | string>>();
    filteredDailyRecords.forEach((record) => {
      const row = map.get(record.record_date) ?? {
        date: record.record_date,
        day: `${dayLabel(record.record_date)} ${record.record_date.slice(5)}`,
        total: 0,
      };
      row[record.flock_id] = Number(row[record.flock_id] ?? 0) + (record.deaths ?? 0);
      row.total = Number(row.total ?? 0) + (record.deaths ?? 0);
      map.set(record.record_date, row);
    });

    return Array.from(map.values()).sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1));
  }, [filteredDailyRecords]);

  const weeklyMortality = useMemo(() => {
    const weekKey = (dateStr: string) => {
      const date = new Date(`${dateStr}T00:00:00`);
      const day = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() + 4 - day);
      const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    };

    const map = new Map<string, number>();
    filteredDailyRecords.forEach((record) => {
      const key = weekKey(record.record_date);
      map.set(key, (map.get(key) ?? 0) + (record.deaths ?? 0));
    });
    return Array.from(map.entries())
      .map(([week, total]) => ({ week, total }))
      .sort((a, b) => (a.week < b.week ? -1 : 1));
  }, [filteredDailyRecords]);

  const monthlyMortality = useMemo(() => {
    const map = new Map<string, number>();
    filteredDailyRecords.forEach((record) => {
      const month = record.record_date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + (record.deaths ?? 0));
    });
    return Array.from(map.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));
  }, [filteredDailyRecords]);

  const causeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    filteredDailyRecords.forEach((record) => {
      if ((record.deaths ?? 0) <= 0) return;
      const cause = (record.deaths_cause || "unspecified").trim();
      map.set(cause, (map.get(cause) ?? 0) + (record.deaths ?? 0));
    });
    return Array.from(map.entries())
      .map(([cause, total]) => ({ cause, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredDailyRecords]);

  const populationByDate = useMemo(() => {
    const map = new Map<string, number>();
    filteredDailyRecords.forEach((row) => {
      map.set(row.record_date, (map.get(row.record_date) ?? 0) + (flockPopulation.get(row.flock_id) ?? 0));
    });
    return Array.from(map.entries())
      .map(([date, live]) => ({ date, live }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [filteredDailyRecords, flockPopulation]);

  const populationChart = useMemo(() => {
    const sortedRows = [...dailyRecords].sort((a, b) => (a.record_date < b.record_date ? -1 : 1));
    const dailyDeathsByFlockDate = new Map<string, number>();
    const liveByFlock = new Map(
      populationFlockIds.map((flockId) => [flockId, flockInitialPopulation.get(flockId) ?? flockPopulation.get(flockId) ?? 0])
    );

    sortedRows.forEach((record) => {
      if (!populationFlockIds.includes(record.flock_id)) return;
      const key = `${record.record_date}:${record.flock_id}`;
      dailyDeathsByFlockDate.set(key, (dailyDeathsByFlockDate.get(key) ?? 0) + (record.deaths ?? 0));
    });

    sortedRows.forEach((record) => {
      if (!populationFlockIds.includes(record.flock_id)) return;
      if (dateFrom && record.record_date >= dateFrom) return;
      const startingLive = liveByFlock.get(record.flock_id) ?? flockInitialPopulation.get(record.flock_id) ?? 0;
      liveByFlock.set(record.flock_id, Math.max(startingLive - (record.deaths ?? 0), 0));
    });

    return eachDateInRange(dateFrom, dateTo).map((date) => {
      const row: Record<string, number | string> = {
        date,
        day: `${dayLabel(date)} ${date.slice(5)}`,
      };

      populationFlockIds.forEach((flockId) => {
        const startingLive = liveByFlock.get(flockId) ?? flockInitialPopulation.get(flockId) ?? 0;
        const live = Math.max(startingLive - (dailyDeathsByFlockDate.get(`${date}:${flockId}`) ?? 0), 0);
        liveByFlock.set(flockId, live);
        row[flockId] = live;
      });

      return row;
    });
  }, [dailyRecords, dateFrom, dateTo, flockInitialPopulation, flockPopulation, populationFlockIds]);

  const populationXAxisTicks = useMemo(() => {
    const dates = populationChart.map((row) => String(row.date));
    if (dates.length <= 8) return dates;
    const step = Math.ceil(dates.length / 8);
    const ticks = dates.filter((_, index) => index % step === 0);
    const last = dates.at(-1);
    if (last && ticks.at(-1) !== last) ticks.push(last);
    return ticks;
  }, [populationChart]);

  const mortalityRateTrend = useMemo(() => {
    const popMap = new Map(populationByDate.map((item) => [item.date, item.live]));
    return dailyMortality.map((item) => {
      const baseline = popMap.get(item.date) ?? 0;
      const rate = baseline > 0 ? (item.total / baseline) * 100 : 0;
      return { date: item.date, rate: Number(rate.toFixed(2)), deaths: item.total, baseline };
    });
  }, [dailyMortality, populationByDate]);

  const branchComparison = useMemo(() => {
    const map = new Map<string, number>();
    filteredDailyRecords.forEach((record) => {
      if ((record.deaths ?? 0) <= 0) return;
      const farmId = flockToFarm.get(record.flock_id);
      const branchId = farmId ? farmToBranch.get(farmId) : null;
      const key = branchId ?? "unassigned";
      map.set(key, (map.get(key) ?? 0) + (record.deaths ?? 0));
    });
    return Array.from(map.entries())
      .map(([branchId, total]) => ({
        branchId,
        branchName: branchId === "unassigned" ? "Unassigned branch" : branchNameMap.get(branchId) ?? "Unknown branch",
        total,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredDailyRecords, flockToFarm, farmToBranch, branchNameMap]);

  const farmComparison = useMemo(() => {
    const map = new Map<string, number>();
    filteredDailyRecords.forEach((record) => {
      if ((record.deaths ?? 0) <= 0) return;
      const farmId = flockToFarm.get(record.flock_id) ?? "unassigned";
      map.set(farmId, (map.get(farmId) ?? 0) + (record.deaths ?? 0));
    });
    return Array.from(map.entries())
      .map(([farmId, total]) => ({ farmId, farmName: farmNameMap.get(farmId) ?? farmId, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredDailyRecords, flockToFarm, farmNameMap]);

  const maxBar = (values: number[]) => Math.max(1, ...values);

  const totalDeaths = filteredDailyRecords.reduce((acc, record) => acc + (record.deaths ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayDeaths = dailyMortality.find((row) => row.date === today)?.total ?? 0;
  const isSingleFlockView = Boolean(scope.flockId);
  const mortalityRecords = filteredDailyRecords
    .filter((record) => (record.deaths ?? 0) > 0)
    .sort((a, b) => (a.record_date < b.record_date ? 1 : -1));

  return (
    <div className="max-w-full min-w-0 overflow-x-hidden space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Mortality Analytics</p>
        <h2 className="text-2xl font-semibold text-forest-900">Mortality causes, rates, and population trends</h2>
        <p className="mt-2 text-sm text-forest-600">Branch-aware dashboard for mortality risk monitoring and root-cause visibility.</p>
      </div>

      <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1 text-sm text-forest-700">
            <span className="text-xs uppercase tracking-[0.18em] text-forest-500">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-forest-900 outline-none focus:border-forest-500"
            />
          </label>
          <label className="space-y-1 text-sm text-forest-700">
            <span className="text-xs uppercase tracking-[0.18em] text-forest-500">To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-forest-900 outline-none focus:border-forest-500"
            />
          </label>
          {canFilterBranch ? (
            <label className="space-y-1 text-sm text-forest-700">
              <span className="text-xs uppercase tracking-[0.18em] text-forest-500">Branch</span>
              <select
                value={scope.branchId}
                onChange={(event) =>
                  setScope((prev) => ({ ...prev, branchId: event.target.value, farmId: "", houseId: "", flockId: "", batchId: "" }))
                }
                className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-forest-900 outline-none focus:border-forest-500"
              >
                <option value="">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="space-y-1 text-sm text-forest-700">
            <span className="text-xs uppercase tracking-[0.18em] text-forest-500">Farm</span>
            <select
              value={scope.farmId}
              onChange={(event) =>
                setScope((prev) => ({ ...prev, farmId: event.target.value, houseId: "", flockId: "", batchId: "" }))
              }
              className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-forest-900 outline-none focus:border-forest-500"
            >
              <option value="">All farms</option>
              {filteredFarms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-forest-700">
            <span className="text-xs uppercase tracking-[0.18em] text-forest-500">House</span>
            <select
              value={scope.houseId}
              onChange={(event) => setScope((prev) => ({ ...prev, houseId: event.target.value, flockId: "", batchId: "" }))}
              className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-forest-900 outline-none focus:border-forest-500"
            >
              <option value="">All houses</option>
              {filteredHouses.map((house) => (
                <option key={house.id} value={house.id}>
                  {house.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm text-forest-700">
            <span className="text-xs uppercase tracking-[0.18em] text-forest-500">Flock</span>
            <select
              value={scope.flockId}
              onChange={(event) => setScope((prev) => ({ ...prev, flockId: event.target.value, batchId: "" }))}
              className="w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-sm text-forest-900 outline-none focus:border-forest-500"
            >
              <option value="">All flocks</option>
              {filteredFlocks.map((flock) => (
                <option key={flock.id} value={flock.id}>
                  {flock.flock_code}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 md:grid-cols-3">
        <article className="min-w-0 rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Total Deaths</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{fmt(totalDeaths)}</p>
        </article>
        <article className="min-w-0 rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Today</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{fmt(todayDeaths)}</p>
        </article>
        <article className="min-w-0 rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Farms In Scope</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{fmt(filteredFarms.length)}</p>
        </article>
      </div>

      <div className="grid min-w-0 gap-6">
        <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Daily Mortality Trend</h3>
          <p className="mt-1 text-sm text-forest-600">
            {isSingleFlockView ? "Daily deaths for the selected flock." : "Daily deaths stacked by flock for the selected scope."}
          </p>
          <div className="mt-4 h-[320px] min-h-[320px]">
            {loading ? <p className="text-sm text-forest-600">Loading...</p> : null}
            {!loading && dailyMortalityChart.length === 0 ? <p className="text-sm text-forest-600">No data for selected scope.</p> : null}
            {!loading && dailyMortalityChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyMortalityChart} margin={{ top: 10, right: 18, left: -12, bottom: 8 }}>
                  <CartesianGrid stroke="#eadfcb" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    ticks={populationXAxisTicks}
                    tickFormatter={readableDateTick}
                    tick={{ fill: "#4d5f4f", fontSize: 12 }}
                    minTickGap={24}
                    height={42}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: "#4d5f4f", fontSize: 12 }} />
                  <Tooltip
                    formatter={(value, name) => [fmt(Number(value)), flockNameMap.get(String(name)) ?? String(name)]}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                  />
                  <Legend
                    formatter={(value) => flockNameMap.get(String(value)) ?? String(value)}
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                  {chartFlockIds.map((flockId, index) => (
                    <Bar
                      key={flockId}
                      dataKey={flockId}
                      stackId={isSingleFlockView ? undefined : "mortality"}
                      fill={chartColors[index % chartColors.length]}
                      radius={isSingleFlockView ? [6, 6, 0, 0] : undefined}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </section>

        <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Population Trend</h3>
          <p className="mt-1 text-sm text-forest-600">
            {isSingleFlockView ? "Live birds for the selected flock." : "Live birds by flock for the selected scope."}
          </p>
          <div className="mt-4 h-[320px] min-h-[320px] max-w-full overflow-hidden">
            {loading ? <p className="text-sm text-forest-600">Loading...</p> : null}
            {!loading && populationChart.length === 0 ? <p className="text-sm text-forest-600">No population data for selected scope.</p> : null}
            {!loading && populationChart.length > 0 ? (
              <div className="h-full max-w-full overflow-x-auto overflow-y-hidden pb-2">
                <div className="h-full shrink-0" style={{ width: `${Math.max(900, populationChart.length * 42)}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={populationChart} margin={{ top: 10, right: 28, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke="#eadfcb" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        ticks={populationXAxisTicks}
                        tickFormatter={readableDateTick}
                        tick={{ fill: "#4d5f4f", fontSize: 12 }}
                        interval={0}
                        minTickGap={28}
                        height={42}
                      />
                      <YAxis allowDecimals={false} tick={{ fill: "#4d5f4f", fontSize: 12 }} />
                      <Tooltip
                        formatter={(value, name) => [fmt(Number(value)), flockNameMap.get(String(name)) ?? String(name)]}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                      />
                      <Legend
                        formatter={(value) => flockNameMap.get(String(value)) ?? String(value)}
                        wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      />
                      {populationFlockIds.map((flockId, index) => (
                        <Line
                          key={flockId}
                          type="monotone"
                          dataKey={flockId}
                          stroke={chartColors[index % chartColors.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid min-w-0 gap-6">
        <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Mortality Rate Trend (%)</h3>
          <div className="mt-4 space-y-2">
            {mortalityRateTrend.length === 0 ? <p className="text-sm text-forest-600">No mortality rate data for selected scope.</p> : null}
            {mortalityRateTrend.slice(-14).map((row) => (
              <div key={row.date} className="grid grid-cols-[90px_1fr_90px] items-center gap-2">
                <span className="text-xs text-forest-600">{row.date}</span>
                <div className="h-3 rounded bg-sand-100">
                  <div
                    className="h-3 rounded bg-amber-500"
                    style={{ width: `${Math.max(2, Math.round((row.rate / maxBar(mortalityRateTrend.map((x) => x.rate))) * 100))}%` }}
                  />
                </div>
                <span className="text-xs text-forest-700">{row.rate.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Cause Breakdown</h3>
          <div className="mt-4 space-y-2">
            {causeBreakdown.length === 0 ? <p className="text-sm text-forest-600">No mortality causes logged for selected scope.</p> : null}
            {causeBreakdown.slice(0, 10).map((row) => (
              <div key={row.cause} className="grid grid-cols-[1fr_80px] gap-2 text-sm">
                <span className="text-forest-700">{row.cause}</span>
                <span className="text-right font-semibold text-forest-900">{fmt(row.total)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid min-w-0 gap-6">
        <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Weekly Trend</h3>
          <div className="mt-4 space-y-2">
            {weeklyMortality.length === 0 ? <p className="text-sm text-forest-600">No weekly data.</p> : null}
            {weeklyMortality.slice(-12).map((row) => (
              <div key={row.week} className="grid grid-cols-[90px_1fr_60px] items-center gap-2">
                <span className="text-xs text-forest-600">{row.week}</span>
                <div className="h-3 rounded bg-sand-100">
                  <div
                    className="h-3 rounded bg-ember-500"
                    style={{ width: `${Math.max(2, Math.round((row.total / maxBar(weeklyMortality.map((x) => x.total))) * 100))}%` }}
                  />
                </div>
                <span className="text-xs text-forest-700">{row.total}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Monthly Trend</h3>
          <div className="mt-4 space-y-2">
            {monthlyMortality.length === 0 ? <p className="text-sm text-forest-600">No monthly data.</p> : null}
            {monthlyMortality.slice(-12).map((row) => (
              <div key={row.month} className="grid grid-cols-[90px_1fr_60px] items-center gap-2">
                <span className="text-xs text-forest-600">{row.month}</span>
                <div className="h-3 rounded bg-sand-100">
                  <div
                    className="h-3 rounded bg-ember-500"
                    style={{ width: `${Math.max(2, Math.round((row.total / maxBar(monthlyMortality.map((x) => x.total))) * 100))}%` }}
                  />
                </div>
                <span className="text-xs text-forest-700">{row.total}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {canSeeBranchComparison ? (
          <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-forest-900">Branch Comparison</h3>
            <div className="mt-4 space-y-2">
              {branchComparison.length === 0 ? <p className="text-sm text-forest-600">No branch mortality data.</p> : null}
              {branchComparison.map((row) => (
                <div key={row.branchId} className="grid grid-cols-[1fr_80px] gap-2 text-sm">
                  <span className="text-forest-700">{row.branchName}</span>
                  <span className="text-right font-semibold text-forest-900">{fmt(row.total)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Farm Comparison</h3>
          <div className="mt-4 space-y-2">
            {farmComparison.length === 0 ? <p className="text-sm text-forest-600">No farm mortality data.</p> : null}
            {farmComparison.slice(0, 12).map((row) => (
              <div key={row.farmId} className="grid grid-cols-[1fr_80px] gap-2 text-sm">
                <span className="text-forest-700">{row.farmName}</span>
                <span className="text-right font-semibold text-forest-900">{fmt(row.total)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Mortality Records</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Cause</th>
                <th className="px-2 py-2">Deaths</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={4}>Loading records...</td>
                </tr>
              ) : mortalityRecords.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={4}>No recorded deaths found for selected scope.</td>
                </tr>
              ) : (
                mortalityRecords.slice(0, 200).map((record) => (
                  <tr key={record.id} className="border-b border-sand-100">
                    <td className="px-2 py-2 text-forest-700">{record.record_date}</td>
                    <td className="px-2 py-2 text-forest-700">{flockNameMap.get(record.flock_id) ?? record.flock_id}</td>
                    <td className="px-2 py-2 text-forest-700">{record.deaths_cause ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-900 font-semibold">{record.deaths ?? 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
