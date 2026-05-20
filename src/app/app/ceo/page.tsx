"use client";

import { useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type Kpi = {
  label: string;
  value: string;
};

type FarmSummaryRow = {
  farmId: string;
  farmName: string;
  housesCount: number;
  flocksCount: number;
  batchesCount: number;
};

export default function AdminOverview() {
  const { scope, setScope, branches, houses, flocks, batches, filteredFarms, filteredFlocks, filteredBatches } =
    useFarmScope();
  const [kpis, setKpis] = useState<Kpi[]>([
    { label: "Live Birds", value: "-" },
    { label: "Egg Output / Day", value: "-" },
    { label: "Open Alerts", value: "-" },
    { label: "Active Farms", value: "-" },
  ]);
  const [kpiLoading, setKpiLoading] = useState(true);

  useEffect(() => {
    const loadKpis = async () => {
      setKpiLoading(true);
      const supabase = createClient();
      const contextResponse = await fetch("/api/me/context", { method: "GET" });
      if (!contextResponse.ok) {
        setKpiLoading(false);
        return;
      }

      const contextData = await contextResponse.json();
      const orgId = contextData?.orgId as string | null;
      if (!orgId) {
        setKpiLoading(false);
        return;
      }

      const scopedFarms = scope.branchId
        ? filteredFarms.filter((f) => f.branch_id === scope.branchId)
        : filteredFarms;
      const scopedFarmIds = scopedFarms.map((f) => f.id);

      const scopedFlocks = filteredFlocks.filter((flock) => {
        if (scope.batchId) {
          return filteredBatches.some((b) => b.id === scope.batchId && b.flock_id === flock.id);
        }
        return true;
      });
      const scopedFlockIds = scopedFlocks.map((f) => f.id);

      const applyScope = <T extends { eq: Function; in: Function }>(query: T) => {
        let next: any = query.eq("org_id", orgId);
        if (scopedFarmIds.length > 0) next = next.in("farm_id", scopedFarmIds);
        if (scope.flockId) next = next.eq("flock_id", scope.flockId);
        else if (scope.batchId && scopedFlockIds.length > 0) next = next.in("flock_id", scopedFlockIds);
        return next;
      };

      const [{ data: latestDailyRow }, { data: latestEggRow }, { count: openAlertsCount }, { count: activeFarmsCount }] =
        await Promise.all([
          applyScope(
            supabase
            .from("daily_farm_records")
            .select("record_date")
            .order("record_date", { ascending: false })
            .limit(1)
            .maybeSingle()
          ),
          applyScope(
            supabase
            .from("daily_egg_records")
            .select("record_date")
            .order("record_date", { ascending: false })
            .limit(1)
            .maybeSingle()
          ),
          applyScope(
            supabase
              .from("alerts")
              .select("id", { count: "exact", head: true })
              .neq("status", "resolved")
          ),
          Promise.resolve({ count: scopedFarms.length }),
        ]);

      let liveBirdsTotal = 0;
      if (latestDailyRow?.record_date) {
        const { data: liveRows } = await applyScope(
          supabase
            .from("daily_farm_records")
            .select("live_count")
            .eq("record_date", latestDailyRow.record_date)
        );
        liveBirdsTotal = (liveRows ?? []).reduce((acc, row) => acc + (row.live_count ?? 0), 0);
      }

      let eggOutputTotal = 0;
      if (latestEggRow?.record_date) {
        const { data: eggRows } = await applyScope(
          supabase
            .from("daily_egg_records")
            .select("total_eggs")
            .eq("record_date", latestEggRow.record_date)
        );
        eggOutputTotal = (eggRows ?? []).reduce((acc, row) => acc + (row.total_eggs ?? 0), 0);
      }

      setKpis([
        { label: "Live Birds", value: liveBirdsTotal.toLocaleString() },
        { label: "Egg Output / Day", value: eggOutputTotal.toLocaleString() },
        { label: "Open Alerts", value: (openAlertsCount ?? 0).toLocaleString() },
        { label: "Active Farms", value: (activeFarmsCount ?? 0).toLocaleString() },
      ]);
      setKpiLoading(false);
    };

    void loadKpis();
  }, [scope.branchId, scope.farmId, scope.batchId, scope.flockId, filteredFarms, filteredFlocks, filteredBatches]);

  const farmSummaryRows = useMemo<FarmSummaryRow[]>(() => {
    return filteredFarms.map((farm) => {
      const housesCount = houses.filter((house) => house.farm_id === farm.id).length;
      const flocksCount = flocks.filter((flock) => flock.farm_id === farm.id).length;
      const batchesCount = batches.filter((batch) => batch.farm_id === farm.id).length;
      return {
        farmId: farm.id,
        farmName: farm.name,
        housesCount,
        flocksCount,
        batchesCount,
      };
    });
  }, [batches, filteredFarms, flocks, houses]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sand-200 bg-gradient-to-r from-forest-900 to-forest-700 p-6 text-sand-50">
        <p className="text-xs uppercase tracking-[0.3em] text-sand-200">Executive Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold">CEO and management control tower</h2>
        <p className="mt-2 text-sm text-sand-100">
          Multi-farm visibility for profitability, production, and operational risk.
        </p>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-forest-900">Executive Scope Filters</h3>
            <p className="text-sm text-forest-600">
              Filter dashboard by branch, farm, batch, and flock.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setScope({ branchId: "", farmId: "", batchId: "", houseId: "", flockId: "" })}
            className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-2 text-sm text-forest-700">
            Branch
            <select
              className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={scope.branchId}
              onChange={(event) =>
                setScope((prev) => ({
                  ...prev,
                  branchId: event.target.value,
                  farmId: "",
                  houseId: "",
                  flockId: "",
                  batchId: "",
                }))
              }
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-forest-700">
            Farm
            <select
              className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={scope.farmId}
              onChange={(event) =>
                setScope((prev) => ({
                  ...prev,
                  farmId: event.target.value,
                  houseId: "",
                  flockId: "",
                  batchId: "",
                }))
              }
            >
              <option value="">All Farms</option>
              {filteredFarms.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-forest-700">
            Batch
            <select
              className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={scope.batchId}
              onChange={(event) => setScope((prev) => ({ ...prev, batchId: event.target.value }))}
            >
              <option value="">All Batches</option>
              {filteredBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.batch_code}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-forest-700">
            Flock
            <select
              className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={scope.flockId}
              onChange={(event) => setScope((prev) => ({ ...prev, flockId: event.target.value }))}
            >
              <option value="">All Flocks</option>
              {filteredFlocks
                .filter((flock) => {
                  if (!scope.batchId) return true;
                  return filteredBatches.some((batch) => batch.id === scope.batchId && batch.flock_id === flock.id);
                })
                .map((flock) => (
                <option key={flock.id} value={flock.id}>
                  {flock.flock_code}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">{kpi.label}</p>
            <p className="mt-3 text-3xl font-semibold text-forest-900">{kpiLoading ? "..." : kpi.value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Farm summary board</h3>
          <p className="mt-1 text-sm text-forest-600">
            Overview of farm structure and active entities.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-xs uppercase tracking-[0.15em] text-forest-500">
                  <th className="px-2 py-2">Farm</th>
                  <th className="px-2 py-2">Houses</th>
                  <th className="px-2 py-2">Flocks</th>
                  <th className="px-2 py-2">Batches</th>
                </tr>
              </thead>
              <tbody>
                {farmSummaryRows.length === 0 ? (
                  <tr>
                    <td className="px-2 py-3 text-forest-700" colSpan={4}>
                      No farms available for the selected scope.
                    </td>
                  </tr>
                ) : (
                  farmSummaryRows.map((row) => (
                    <tr key={row.farmId} className="border-b border-sand-100">
                      <td className="px-2 py-3 font-medium text-forest-900">{row.farmName}</td>
                      <td className="px-2 py-3 text-forest-700">{row.housesCount}</td>
                      <td className="px-2 py-3 text-forest-700">{row.flocksCount}</td>
                      <td className="px-2 py-3 text-forest-700">{row.batchesCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Scope status</h3>
          <div className="mt-4 space-y-3 text-sm text-forest-700">
            <p className="rounded-xl border border-sand-200 bg-sand-50 p-3">
              Branches in scope: {scope.branchId ? 1 : branches.length}
            </p>
            <p className="rounded-xl border border-sand-200 bg-sand-50 p-3">
              Farms in scope: {filteredFarms.length}
            </p>
            <p className="rounded-xl border border-sand-200 bg-sand-50 p-3">
              Flocks in scope: {filteredFlocks.length}
            </p>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Farm Operations Oversight</h3>
          <p className="mt-2 text-sm text-forest-600">
            Capacity utilization, daily records completion, and transfer status.
          </p>
        </section>
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Veterinary Oversight</h3>
          <p className="mt-2 text-sm text-forest-600">
            Active clinical cases, vaccination execution, and biosecurity gaps.
          </p>
        </section>
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Inventory Oversight</h3>
          <p className="mt-2 text-sm text-forest-600">
            Critical stock watchlist, procurement readiness, and warehouse flow.
          </p>
        </section>
      </div>
    </div>
  );
}
