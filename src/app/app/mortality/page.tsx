"use client";

import { useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type MortalityEvent = {
  id: string;
  flock_id: string;
  record_date: string;
  recorded_time: string | null;
  count: number;
  cause: string;
  notes: string | null;
  diagnosis: string | null;
};

type DailyRecord = {
  flock_id: string;
  record_date: string;
};

const fmt = (value: number) => value.toLocaleString();

export default function MortalityPage() {
  const { scope, filteredFlocks, filteredFarms, farms, branches, filteredBatches } = useFarmScope();
  const [events, setEvents] = useState<MortalityEvent[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setEvents([]);
        setDailyRecords([]);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) {
        setEvents([]);
        setDailyRecords([]);
        setLoading(false);
        return;
      }

      const scopedFlockIds = filteredFlocks
      .filter((flock) => !scope.batchId || flock.batch_id === scope.batchId)
        .map((flock) => flock.id);

      let eventsQuery = supabase
        .from("mortality_events")
        .select("id, flock_id, record_date, recorded_time, count, cause, notes, diagnosis")
        .eq("org_id", profile.org_id)
        .order("record_date", { ascending: false })
        .limit(1200);

      let dailyQuery = supabase
        .from("daily_farm_records")
        .select("flock_id, record_date")
        .eq("org_id", profile.org_id)
        .order("record_date", { ascending: false })
        .limit(2400);

      if (scope.flockId) {
        eventsQuery = eventsQuery.eq("flock_id", scope.flockId);
        dailyQuery = dailyQuery.eq("flock_id", scope.flockId);
      } else if (scopedFlockIds.length > 0) {
        eventsQuery = eventsQuery.in("flock_id", scopedFlockIds);
        dailyQuery = dailyQuery.in("flock_id", scopedFlockIds);
      } else if (scope.branchId || scope.farmId || scope.houseId || scope.batchId) {
        setEvents([]);
        setDailyRecords([]);
        setLoading(false);
        return;
      }

      const [{ data: eventRows }, { data: dailyRows }] = await Promise.all([eventsQuery, dailyQuery]);
      setEvents((eventRows ?? []) as MortalityEvent[]);
      setDailyRecords((dailyRows ?? []) as DailyRecord[]);
      setLoading(false);
    };

    void load();
  }, [scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId, filteredFlocks, filteredBatches]);

  const dailyMortality = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((event) => {
      map.set(event.record_date, (map.get(event.record_date) ?? 0) + (event.count ?? 0));
    });
    return Array.from(map.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [events]);

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
    events.forEach((event) => {
      const key = weekKey(event.record_date);
      map.set(key, (map.get(key) ?? 0) + (event.count ?? 0));
    });
    return Array.from(map.entries())
      .map(([week, total]) => ({ week, total }))
      .sort((a, b) => (a.week < b.week ? -1 : 1));
  }, [events]);

  const monthlyMortality = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((event) => {
      const month = event.record_date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + (event.count ?? 0));
    });
    return Array.from(map.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));
  }, [events]);

  const causeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((event) => {
      const cause = (event.cause || "unspecified").trim();
      map.set(cause, (map.get(cause) ?? 0) + (event.count ?? 0));
    });
    return Array.from(map.entries())
      .map(([cause, total]) => ({ cause, total }))
      .sort((a, b) => b.total - a.total);
  }, [events]);

  const populationByDate = useMemo(() => {
    const map = new Map<string, number>();
    dailyRecords.forEach((row) => {
      map.set(row.record_date, (map.get(row.record_date) ?? 0) + (flockPopulation.get(row.flock_id) ?? 0));
    });
    return Array.from(map.entries())
      .map(([date, live]) => ({ date, live }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [dailyRecords, flockPopulation]);

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
    events.forEach((event) => {
      const farmId = flockToFarm.get(event.flock_id);
      const branchId = farmId ? farmToBranch.get(farmId) : null;
      const key = branchId ?? "unassigned";
      map.set(key, (map.get(key) ?? 0) + (event.count ?? 0));
    });
    return Array.from(map.entries())
      .map(([branchId, total]) => ({ branchId, branchName: branchNameMap.get(branchId) ?? branchId, total }))
      .sort((a, b) => b.total - a.total);
  }, [events, flockToFarm, farmToBranch, branchNameMap]);

  const farmComparison = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((event) => {
      const farmId = flockToFarm.get(event.flock_id) ?? "unassigned";
      map.set(farmId, (map.get(farmId) ?? 0) + (event.count ?? 0));
    });
    return Array.from(map.entries())
      .map(([farmId, total]) => ({ farmId, farmName: farmNameMap.get(farmId) ?? farmId, total }))
      .sort((a, b) => b.total - a.total);
  }, [events, flockToFarm, farmNameMap]);

  const maxBar = (values: number[]) => Math.max(1, ...values);

  const totalDeaths = events.reduce((acc, event) => acc + (event.count ?? 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayDeaths = dailyMortality.find((row) => row.date === today)?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Mortality Analytics</p>
        <h2 className="text-2xl font-semibold text-forest-900">Mortality causes, rates, and population trends</h2>
        <p className="mt-2 text-sm text-forest-600">Branch-aware dashboard for mortality risk monitoring and root-cause visibility.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Total Deaths</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{fmt(totalDeaths)}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Today</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{fmt(todayDeaths)}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Events</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{fmt(events.length)}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Farms In Scope</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{fmt(filteredFarms.length)}</p>
        </article>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Daily Mortality Trend</h3>
          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-forest-600">Loading...</p> : null}
            {!loading && dailyMortality.length === 0 ? <p className="text-sm text-forest-600">No data for selected scope.</p> : null}
            {!loading
              ? dailyMortality.slice(-14).map((row) => (
                  <div key={row.date} className="grid grid-cols-[90px_1fr_60px] items-center gap-2">
                    <span className="text-xs text-forest-600">{row.date}</span>
                    <div className="h-3 rounded bg-sand-100">
                      <div
                        className="h-3 rounded bg-ember-500"
                        style={{ width: `${Math.max(2, Math.round((row.total / maxBar(dailyMortality.map((x) => x.total))) * 100))}%` }}
                      />
                    </div>
                    <span className="text-xs text-forest-700">{row.total}</span>
                  </div>
                ))
              : null}
          </div>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Population Trend</h3>
          <div className="mt-4 space-y-2">
            {loading ? <p className="text-sm text-forest-600">Loading...</p> : null}
            {!loading && populationByDate.length === 0 ? <p className="text-sm text-forest-600">No population data for selected scope.</p> : null}
            {!loading
              ? populationByDate.slice(-14).map((row) => (
                  <div key={row.date} className="grid grid-cols-[90px_1fr_90px] items-center gap-2">
                    <span className="text-xs text-forest-600">{row.date}</span>
                    <div className="h-3 rounded bg-sand-100">
                      <div
                        className="h-3 rounded bg-forest-700"
                        style={{ width: `${Math.max(2, Math.round((row.live / maxBar(populationByDate.map((x) => x.live))) * 100))}%` }}
                      />
                    </div>
                    <span className="text-xs text-forest-700">{fmt(row.live)}</span>
                  </div>
                ))
              : null}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
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

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
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

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
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

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
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

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Event Drill-down</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Time</th>
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Cause</th>
                <th className="px-2 py-2">Count</th>
                <th className="px-2 py-2">Diagnosis</th>
                <th className="px-2 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={7}>Loading events...</td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={7}>No mortality events found for selected scope.</td>
                </tr>
              ) : (
                events.slice(0, 200).map((event) => (
                  <tr key={event.id} className="border-b border-sand-100">
                    <td className="px-2 py-2 text-forest-700">{event.record_date}</td>
                    <td className="px-2 py-2 text-forest-700">{event.recorded_time ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{event.flock_id}</td>
                    <td className="px-2 py-2 text-forest-700">{event.cause}</td>
                    <td className="px-2 py-2 text-forest-900 font-semibold">{event.count}</td>
                    <td className="px-2 py-2 text-forest-700">{event.diagnosis ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{event.notes ?? "-"}</td>
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
