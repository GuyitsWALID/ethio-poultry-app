"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search } from "lucide-react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";
import type { Database } from "@/types/supabase";

type FlockRow = {
  id: string;
  flock_code: string;
  farm_id: string;
  house_id: string;
  intake_batch_id: string | null;
  flock_type: Database["public"]["Enums"]["flock_type"];
  source: Database["public"]["Enums"]["flock_source"];
  status: Database["public"]["Enums"]["flock_status"];
  placement_date: string;
  initial_count: number;
  current_count: number;
  notes: string | null;
};

type IntakeBatchRef = { id: string; batch_code: string; source: string | null };

export default function FlocksPage() {
  const { scope, filteredFarms, filteredHouses, filteredFlocks, filteredBatches, farms, houses, role } = useFarmScope();
  const [rows, setRows] = useState<FlockRow[]>([]);
  const [intakeBatches, setIntakeBatches] = useState<IntakeBatchRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Database["public"]["Enums"]["flock_status"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | Database["public"]["Enums"]["flock_type"]>("all");
  const [showModal, setShowModal] = useState(false);

  const canCreate = role === "farm_manager";

  const [formFarmId, setFormFarmId] = useState("");
  const [formHouseId, setFormHouseId] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formType, setFormType] = useState<Database["public"]["Enums"]["flock_type"]>("broiler");
  const [formSource, setFormSource] = useState<Database["public"]["Enums"]["flock_source"]>("external_purchase");
  const [formPlacementDate, setFormPlacementDate] = useState("");
  const [formInitialCount, setFormInitialCount] = useState(0);
  const [formCurrentCount, setFormCurrentCount] = useState(0);
  const [formNotes, setFormNotes] = useState("");

  const farmNameMap = useMemo(() => new Map(farms.map((f) => [f.id, f.name])), [farms]);
  const houseNameMap = useMemo(() => new Map(houses.map((h) => [h.id, h.name])), [houses]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const contextResponse = await fetch("/api/me/context", { method: "GET" });
    if (!contextResponse.ok) {
      setRows([]);
      setIntakeBatches([]);
      setLoading(false);
      return;
    }
    const context = await contextResponse.json();
    const orgId = context?.orgId as string | null;
    if (!orgId) {
      setRows([]);
      setIntakeBatches([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const scopedFlockIds = filteredFlocks
      .filter((flock) => {
        if (!scope.batchId) return true;
        return filteredBatches.some((batch) => batch.id === scope.batchId && batch.flock_id === flock.id);
      })
      .map((flock) => flock.id);

    let flockQuery = supabase
      .from("flocks")
      .select("id, flock_code, farm_id, house_id, intake_batch_id, flock_type, source, status, placement_date, initial_count, current_count, notes")
      .eq("org_id", orgId)
      .order("placement_date", { ascending: false })
      .limit(500);

    if (scope.flockId) {
      flockQuery = flockQuery.eq("id", scope.flockId);
    } else if (scopedFlockIds.length > 0) {
      flockQuery = flockQuery.in("id", scopedFlockIds);
    } else if (scope.branchId || scope.farmId || scope.houseId || scope.batchId) {
      setRows([]);
      setIntakeBatches([]);
      setLoading(false);
      return;
    }

    const { data: flockData, error: flockError } = await flockQuery;

    if (flockError) {
      setError(flockError.message ?? "Failed to load flocks.");
      setRows([]);
      setIntakeBatches([]);
      setLoading(false);
      return;
    }

    const flockRows = (flockData ?? []) as FlockRow[];
    const intakeIds = Array.from(new Set(flockRows.map((row) => row.intake_batch_id).filter((id): id is string => Boolean(id))));
    if (intakeIds.length > 0) {
      // Supabase generated types in this repo don't yet include branch_intake_batches.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: intakeData, error: intakeError } = await (supabase as any)
        .from("branch_intake_batches")
        .select("id, batch_code, source")
        .in("id", intakeIds);
      if (intakeError) {
        setError(intakeError.message ?? "Failed to load intake batches.");
      }
      setIntakeBatches((intakeData ?? []) as IntakeBatchRef[]);
    } else {
      setIntakeBatches([]);
    }

    setRows(flockRows);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId, filteredFlocks, filteredBatches]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (typeFilter !== "all" && row.flock_type !== typeFilter) return false;
      if (!q) return true;
      const farmName = farmNameMap.get(row.farm_id) ?? "";
      const houseName = houseNameMap.get(row.house_id) ?? "";
      return (
        row.flock_code.toLowerCase().includes(q) ||
        farmName.toLowerCase().includes(q) ||
        houseName.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, typeFilter, farmNameMap, houseNameMap]);

  const intakeBatchById = useMemo(() => {
    const map = new Map<string, IntakeBatchRef>();
    intakeBatches.forEach((batch) => {
      map.set(batch.id, batch);
    });
    return map;
  }, [intakeBatches]);

  const totalBirds = useMemo(() => filteredRows.reduce((sum, row) => sum + (row.current_count ?? 0), 0), [filteredRows]);
  const activeFlocks = useMemo(() => filteredRows.filter((row) => row.status === "active").length, [filteredRows]);

  const resetForm = () => {
    setFormFarmId("");
    setFormHouseId("");
    setFormCode("");
    setFormType("broiler");
    setFormSource("external_purchase");
    setFormPlacementDate("");
    setFormInitialCount(0);
    setFormCurrentCount(0);
    setFormNotes("");
  };

  const onCreateFlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || saving) return;
    if (!formFarmId || !formHouseId || !formCode.trim() || !formPlacementDate) {
      setError("Farm, house, flock code, and placement date are required.");
      return;
    }

    if (!filteredHouses.some((house) => house.id === formHouseId && house.farm_id === formFarmId)) {
      setError("Selected house is not valid for selected farm.");
      return;
    }

    const contextResponse = await fetch("/api/me/context", { method: "GET" });
    if (!contextResponse.ok) {
      setError("Unable to verify your organization context.");
      return;
    }
    const context = await contextResponse.json();
    const orgId = context?.orgId as string | null;
    if (!orgId) {
      setError("Organization context is missing.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("flocks").insert({
      org_id: orgId,
      farm_id: formFarmId,
      house_id: formHouseId,
      flock_code: formCode.trim(),
      flock_type: formType,
      source: formSource,
      placement_date: formPlacementDate,
      initial_count: formInitialCount,
      current_count: formCurrentCount,
      notes: formNotes.trim() || null,
      status: "active",
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowModal(false);
    resetForm();
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Flocks</p>
          <h2 className="text-2xl font-semibold text-forest-900">Flock registry</h2>
          <p className="mt-2 text-sm text-forest-600">Track flock status, population, source, and linked intake batch.</p>
        </div>
        {canCreate ? (
          <button
            className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50"
            type="button"
            onClick={() => setShowModal(true)}
          >
            <Plus className="h-4 w-4" />
            New flock
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Flocks In Scope</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{filteredRows.length}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Active Flocks</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{activeFlocks}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Current Birds</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{totalBirds.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Avg Birds/Flock</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">
            {filteredRows.length ? Math.round(totalBirds / filteredRows.length).toLocaleString() : "0"}
          </p>
        </article>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2 text-sm text-forest-700 md:col-span-1">
            Search
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-400" />
              <input
                className="h-11 w-full rounded-xl border border-sand-200 bg-white pl-9 pr-3 text-sm text-forest-900"
                placeholder="Search by flock, farm, or house"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </label>
          <label className="grid gap-2 text-sm text-forest-700">
            Status
            <select
              className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="transferred">Transferred</option>
              <option value="sold">Sold</option>
              <option value="culled">Culled</option>
              <option value="quarantined">Quarantined</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-forest-700">
            Type
            <select
              className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            >
              <option value="all">All Types</option>
              <option value="broiler">Broiler</option>
              <option value="layer">Layer</option>
              <option value="rearing">Rearing</option>
              <option value="parent_stock">Parent Stock</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-forest-700" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sand-200 bg-sand-50/50 p-8 text-center">
            <p className="text-sm font-semibold text-forest-900">No flocks found</p>
            <p className="mt-1 text-sm text-forest-600">Adjust scope/filters or create a new flock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-xs uppercase tracking-[0.15em] text-forest-500">
                  <th className="px-2 py-2">Flock</th>
                  <th className="px-2 py-2">Farm</th>
                  <th className="px-2 py-2">House</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Placement</th>
                  <th className="px-2 py-2">Current Birds</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Batch</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-sand-100">
                    <td className="px-2 py-3 font-medium text-forest-900">{row.flock_code}</td>
                    <td className="px-2 py-3 text-forest-700">{farmNameMap.get(row.farm_id) ?? row.farm_id}</td>
                    <td className="px-2 py-3 text-forest-700">{houseNameMap.get(row.house_id) ?? row.house_id}</td>
                    <td className="px-2 py-3 text-forest-700">{row.flock_type}</td>
                    <td className="px-2 py-3 text-forest-700">
                      {row.intake_batch_id ? (intakeBatchById.get(row.intake_batch_id)?.source ?? row.source) : row.source}
                    </td>
                    <td className="px-2 py-3 text-forest-700">{row.placement_date}</td>
                    <td className="px-2 py-3 text-forest-900">{row.current_count.toLocaleString()}</td>
                    <td className="px-2 py-3">
                      <span className="rounded-full bg-sand-100 px-2 py-1 text-xs capitalize text-forest-700">{row.status}</span>
                    </td>
                    <td className="px-2 py-3 text-forest-700">
                      {row.intake_batch_id ? (intakeBatchById.get(row.intake_batch_id)?.batch_code ?? "-") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-ember-600">{error}</p> : null}
      </section>

      {showModal && canCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 p-4" onClick={() => setShowModal(false)}>
          <div
            className="w-full max-w-3xl rounded-2xl border border-sand-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-semibold text-forest-900">Create New Flock</h3>
            <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={onCreateFlock}>
              <label className="grid gap-1 text-sm text-forest-700">
                Farm
                <select
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  value={formFarmId}
                  onChange={(e) => {
                    setFormFarmId(e.target.value);
                    setFormHouseId("");
                  }}
                  required
                >
                  <option value="">Select farm</option>
                  {filteredFarms.map((farm) => (
                    <option key={farm.id} value={farm.id}>{farm.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                House
                <select
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  value={formHouseId}
                  onChange={(e) => setFormHouseId(e.target.value)}
                  required
                >
                  <option value="">Select house</option>
                  {filteredHouses
                    .filter((house) => !formFarmId || house.farm_id === formFarmId)
                    .map((house) => (
                      <option key={house.id} value={house.id}>{house.name}</option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Flock code
                <input
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="FLK-0001"
                  required
                />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Placement date
                <input
                  type="date"
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  value={formPlacementDate}
                  onChange={(e) => setFormPlacementDate(e.target.value)}
                  required
                />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Flock type
                <select
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as Database["public"]["Enums"]["flock_type"])}
                >
                  <option value="broiler">Broiler</option>
                  <option value="layer">Layer</option>
                  <option value="rearing">Rearing</option>
                  <option value="parent_stock">Parent Stock</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Source
                <select
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value as Database["public"]["Enums"]["flock_source"])}
                >
                  <option value="external_purchase">External Purchase</option>
                  <option value="internal_transfer">Internal Transfer</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Initial count
                <input
                  type="number"
                  min={0}
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  value={formInitialCount}
                  onChange={(e) => setFormInitialCount(Number(e.target.value) || 0)}
                />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Current count
                <input
                  type="number"
                  min={0}
                  className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  value={formCurrentCount}
                  onChange={(e) => setFormCurrentCount(Number(e.target.value) || 0)}
                />
              </label>
              <label className="grid gap-1 text-sm text-forest-700 md:col-span-2">
                Notes
                <textarea
                  className="min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </label>

              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="rounded-full border border-forest-900/20 px-5 py-2 text-sm text-forest-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-5 py-2 text-sm text-sand-50 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save flock
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
