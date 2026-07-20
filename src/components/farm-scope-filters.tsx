 "use client";

import { reportingPeriodFor, useFarmScope, type PeriodPreset } from "@/components/farm-scope-context";

export function FarmScopeFilters() {
  const {
    role,
    loading,
    scope,
    setScope,
    period,
    setPeriod,
    branches,
    filteredFarms,
    filteredHouses,
    filteredFlocks,
    filteredBatches,
  } = useFarmScope();

  const showFilters = role === "ceo";
  if (!showFilters || loading) {
    return null;
  }

  const selectClass = "h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900";

  return (
    <div className="mb-4 rounded-2xl border border-sand-200 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-forest-500">
        {role === "ceo" ? "Executive Scope Filters" : "Branch Scope Filters"}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        <label className="grid gap-1 text-xs text-forest-600">
          Reporting Period
          <select
            className={selectClass}
            value={period.preset}
            onChange={(event) => {
              const preset = event.target.value as PeriodPreset;
              if (preset === "custom") setPeriod((prev) => ({ ...prev, preset }));
              else setPeriod(reportingPeriodFor(preset));
            }}
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="mtd">Month to date</option>
            <option value="qtd">Quarter to date</option>
            <option value="custom">Custom range</option>
          </select>
        </label>
        {period.preset === "custom" ? (
          <>
            <label className="grid gap-1 text-xs text-forest-600">
              From
              <input type="date" className={selectClass} value={period.dateFrom} max={period.dateTo} onChange={(event) => setPeriod((prev) => ({ ...prev, dateFrom: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs text-forest-600">
              To
              <input type="date" className={selectClass} value={period.dateTo} min={period.dateFrom} onChange={(event) => setPeriod((prev) => ({ ...prev, dateTo: event.target.value }))} />
            </label>
          </>
        ) : null}
        <label className="grid gap-1 text-xs text-forest-600">
          Branch
          <select
            className={selectClass}
            value={scope.branchId}
            onChange={(e) =>
              setScope({
                branchId: e.target.value,
                farmId: "",
                batchId: "",
                houseId: "",
                flockId: "",
              })
            }
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs text-forest-600">
          Farm
          <select
            className={selectClass}
            value={scope.farmId}
            onChange={(e) =>
              setScope((prev) => ({
                ...prev,
                farmId: e.target.value,
                batchId: "",
                houseId: "",
                flockId: "",
              }))
            }
          >
            <option value="">All Farms</option>
            {filteredFarms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs text-forest-600">
          Batch
          <select
            className={selectClass}
            value={scope.batchId}
            onChange={(e) => setScope((prev) => ({ ...prev, batchId: e.target.value }))}
          >
            <option value="">All Batches</option>
            {filteredBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batch_code}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs text-forest-600">
          House
          <select
            className={selectClass}
            value={scope.houseId}
            onChange={(e) =>
              setScope((prev) => ({ ...prev, houseId: e.target.value, flockId: "" }))
            }
          >
            <option value="">All Houses</option>
            {filteredHouses.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs text-forest-600">
          Flock
          <select
            className={selectClass}
            value={scope.flockId}
            onChange={(e) => setScope((prev) => ({ ...prev, flockId: e.target.value }))}
          >
            <option value="">All Flocks</option>
            {filteredFlocks
              .filter((f) => {
                if (!scope.batchId) return true;
                return f.batch_id === scope.batchId;
              })
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.flock_code}
                </option>
              ))}
          </select>
        </label>
      </div>
    </div>
  );
}
