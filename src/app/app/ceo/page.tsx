"use client";

import { useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type Kpi = {
  label: string;
  value: string;
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
  const kpiScopeKey = `${scope.branchId}|${scope.farmId}|${scope.batchId}|${scope.flockId}|${filteredFarms.length}|${filteredFlocks.length}|${filteredBatches.length}`;
  const liveBirdsValue = useMemo(
    () => kpis.find((kpi) => kpi.label === "Live Birds")?.value ?? "0",
    [kpis]
  );
  const activeBranchesCount = scope.branchId ? 1 : branches.length;
  const activeFarmsCount = filteredFarms.length;
  const activeFlocksCount = filteredFlocks.length;

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

      const applyFlockScope = <T extends { eq: Function; in: Function }>(query: T) => {
        let next: any = query.eq("org_id", orgId);
        if (scope.flockId) next = next.eq("flock_id", scope.flockId);
        else if (scopedFlockIds.length > 0) next = next.in("flock_id", scopedFlockIds);
        return next;
      };

      const [{ data: latestDailyRow }, { data: latestEggRow }, { count: openAlertsCount }, { count: activeFarmsCount }] =
        await Promise.all([
          applyFlockScope(
            supabase
            .from("daily_farm_records")
            .select("record_date")
            .order("record_date", { ascending: false })
            .limit(1)
            .maybeSingle()
          ),
          applyFlockScope(
            supabase
            .from("daily_egg_records")
            .select("record_date")
            .order("record_date", { ascending: false })
            .limit(1)
            .maybeSingle()
          ),
          supabase.from("alerts").select("id", { count: "exact", head: true }).eq("org_id", orgId).neq("status", "resolved"),
          Promise.resolve({ count: scopedFarms.length }),
        ]);

      let liveBirdsTotal = 0;
      if (latestDailyRow?.record_date) {
        const { data: liveRows } = await applyFlockScope(
          supabase
            .from("daily_farm_records")
            .select("live_count")
            .eq("record_date", latestDailyRow.record_date)
        );
        liveBirdsTotal = (liveRows ?? []).reduce((acc, row) => acc + (row.live_count ?? 0), 0);
      }

      let eggOutputTotal = 0;
      if (latestEggRow?.record_date) {
        const { data: eggRows } = await applyFlockScope(
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
  }, [kpiScopeKey]);

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
        <h3 className="text-base font-semibold text-forest-900">Overview Snapshot</h3>
        <p className="mt-1 text-sm text-forest-600">Current scope summary before deep filtering.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-sand-200 bg-sand-50/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Active Branches</p>
            <p className="mt-2 text-3xl font-semibold text-forest-900">{activeBranchesCount}</p>
          </article>
          <article className="rounded-2xl border border-sand-200 bg-sand-50/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Active Farms</p>
            <p className="mt-2 text-3xl font-semibold text-forest-900">{activeFarmsCount}</p>
          </article>
          <article className="rounded-2xl border border-sand-200 bg-sand-50/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Active Flocks</p>
            <p className="mt-2 text-3xl font-semibold text-forest-900">{activeFlocksCount}</p>
          </article>
          <article className="rounded-2xl border border-sand-200 bg-sand-50/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Live Bird Count</p>
            <p className="mt-2 text-3xl font-semibold text-forest-900">{kpiLoading ? "..." : liveBirdsValue}</p>
          </article>
        </div>
      </section>

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

      
    </div>
  );
}
