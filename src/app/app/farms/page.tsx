"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Egg, Loader2, Plus, Search, Skull, Users, X } from "lucide-react";

import { createClient } from "@/utils/supabase/client";

type Branch = { id: string; name: string };
type Farm = { id: string; name: string; branch_id: string };
type House = { id: string; name: string; farm_id: string };
type Flock = {
  id: string;
  flock_code: string;
  farm_id: string;
  house_id: string;
  current_count: number;
  status: string;
};
type DailyMetric = {
  flock_id: string;
  record_date: string;
  total_eggs: number | null;
  production_percentage: number | null;
  deaths: number | null;
  mortality_percentage: number | null;
};

type HouseDraft = { name: string; capacity: number; flocks: Array<Record<string, never>> };
const today = new Date().toISOString().slice(0, 10);

export default function FarmsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [branchId, setBranchId] = useState("");
  const [farmName, setFarmName] = useState("");
  const [capacityBirds, setCapacityBirds] = useState(0);
  const [draftHouses, setDraftHouses] = useState<HouseDraft[]>([]);

  const loadData = async () => {
    setLoading(true);
    const response = await fetch("/api/scope/options", { method: "GET" });
    if (!response.ok) {
      setLoading(false);
      return;
    }
    const data = await response.json();
    setBranches((data?.branches ?? []) as Branch[]);
    setFarms((data?.farms ?? []) as Farm[]);
    setHouses((data?.houses ?? []) as House[]);
    setFlocks((data?.flocks ?? []) as Flock[]);
    const contextResponse = await fetch("/api/me/context", { method: "GET" });
    const context = contextResponse.ok ? await contextResponse.json() : null;
    const orgId = context?.orgId as string | null;
    if (orgId) {
      const supabase = createClient();
      const { data: records } = await supabase
        .from("daily_farm_records")
        .select("flock_id, record_date, total_eggs, production_percentage, deaths, mortality_percentage")
        .eq("org_id", orgId)
        .eq("record_date", today);
      setDailyMetrics((records ?? []) as DailyMetric[]);
    } else {
      setDailyMetrics([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const filteredFarms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return farms.filter((farm) => {
      if (branchFilter && farm.branch_id !== branchFilter) return false;
      if (!q) return true;
      return farm.name.toLowerCase().includes(q);
    });
  }, [farms, branchFilter, searchQuery]);
  const selectedFarm = useMemo(
    () => filteredFarms.find((farm) => farm.id === selectedFarmId) ?? filteredFarms[0] ?? null,
    [filteredFarms, selectedFarmId]
  );
  const branchNameById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches]);
  const metricByFlockId = useMemo(() => new Map(dailyMetrics.map((metric) => [metric.flock_id, metric])), [dailyMetrics]);
  const selectedFarmHouses = useMemo(
    () => (selectedFarm ? houses.filter((house) => house.farm_id === selectedFarm.id) : []),
    [houses, selectedFarm]
  );

  const addHouseDraft = () => {
    setDraftHouses((prev) => [...prev, { name: "", capacity: 0, flocks: [] }]);
  };

  const updateHouseDraft = (index: number, patch: Partial<HouseDraft>) => {
    setDraftHouses((prev) => prev.map((house, i) => (i === index ? { ...house, ...patch } : house)));
  };

  const removeHouseDraft = (index: number) => {
    setDraftHouses((prev) => prev.filter((_, i) => i !== index));
  };

  const addFlockDraft = (houseIndex: number) => {
    setDraftHouses((prev) =>
      prev.map((house, i) =>
        i === houseIndex ? { ...house, flocks: [...house.flocks, {}] } : house
      )
    );
  };

  const removeFlockDraft = (houseIndex: number, flockIndex: number) => {
    setDraftHouses((prev) =>
      prev.map((house, i) =>
        i === houseIndex
          ? { ...house, flocks: house.flocks.filter((_, j) => j !== flockIndex) }
          : house
      )
    );
  };

  const resetModal = () => {
    setBranchId("");
    setFarmName("");
    setCapacityBirds(0);
    setDraftHouses([]);
    setError(null);
  };

  const onCloseModal = () => {
    setIsModalOpen(false);
    resetModal();
  };

  const onCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!branchId || !farmName.trim()) {
      setError("Branch and farm name are required.");
      return;
    }

    setSaving(true);
    setError(null);
    const response = await fetch("/api/farms/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branchId,
        farmName: farmName.trim(),
        capacityBirds,
        houses: draftHouses,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(data?.error ?? "Failed to create farm.");
      setSaving(false);
      return;
    }

    await loadData();
    setSaving(false);
    onCloseModal();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Farms</p>
          <h2 className="text-2xl font-semibold text-forest-900">Farm directory</h2>
          <p className="mt-2 text-sm text-forest-600">
            Filter farms by branch and create farm, house, and flock structure.
          </p>
        </div>
        <button
          className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New farm
        </button>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-forest-700">
            Branch filter
            <select
              className="h-11 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
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
            Search farms
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-400" />
              <input
                className="h-11 w-full rounded-xl border border-sand-200 bg-white pl-9 pr-3 text-sm text-forest-900"
                placeholder="Search by farm name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-forest-700" />
          </div>
        ) : filteredFarms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-sand-200 bg-sand-50/50 p-8 text-center">
            <p className="text-sm font-semibold text-forest-900">No farms found</p>
            <p className="mt-1 text-sm text-forest-600">Try another branch filter or create a new farm.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-sand-200 text-xs uppercase tracking-[0.15em] text-forest-500">
                  <th className="px-2 py-2">Farm</th>
                  <th className="px-2 py-2">Branch</th>
                  <th className="px-2 py-2">Houses</th>
                  <th className="px-2 py-2">Flocks</th>
                </tr>
              </thead>
              <tbody>
                {filteredFarms.map((farm) => {
                  const branchName = branchNameById.get(farm.branch_id) ?? "-";
                  const farmHouses = houses.filter((h) => h.farm_id === farm.id);
                  const farmFlocks = flocks.filter((f) => f.farm_id === farm.id);
                  const selected = selectedFarm?.id === farm.id;
                  return (
                    <tr
                      key={farm.id}
                      className={`cursor-pointer border-b border-sand-100 transition hover:bg-sand-50 ${selected ? "bg-leaf-500/10" : ""}`}
                      onClick={() => setSelectedFarmId(farm.id)}
                    >
                      <td className="px-2 py-3 font-medium text-forest-900">{farm.name}</td>
                      <td className="px-2 py-3 text-forest-700">{branchName}</td>
                      <td className="px-2 py-3 text-forest-700">{farmHouses.length}</td>
                      <td className="px-2 py-3 text-forest-700">{farmFlocks.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedFarm ? (
        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-forest-500">Farm hierarchy</p>
            <h3 className="mt-1 text-xl font-semibold text-forest-900">{selectedFarm.name}</h3>
            <p className="mt-1 text-sm text-forest-600">
              Houses in this farm with the current active flock and today&apos;s live production signals.
            </p>
          </div>

          {selectedFarmHouses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sand-200 bg-sand-50/60 p-8 text-center">
              <p className="text-sm font-semibold text-forest-900">No houses in this farm</p>
              <p className="mt-1 text-sm text-forest-600">Create houses through the farm structure modal.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {selectedFarmHouses.map((house) => {
                const activeFlocks = flocks.filter((flock) => flock.house_id === house.id && flock.status === "active");
                const activeFlock = activeFlocks[0] ?? flocks.find((flock) => flock.house_id === house.id) ?? null;
                const metric = activeFlock ? metricByFlockId.get(activeFlock.id) : null;
                const eggs = metric?.total_eggs ?? 0;
                const production = metric?.production_percentage ?? null;
                const mortality = metric?.mortality_percentage ?? null;
                const deaths = metric?.deaths ?? 0;
                return (
                  <article key={house.id} className="rounded-lg border border-sand-200 bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-forest-500">House</p>
                        <h4 className="mt-1 text-lg font-semibold text-forest-900">{house.name}</h4>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs capitalize ${activeFlock ? "bg-leaf-500/10 text-leaf-700" : "bg-sand-100 text-forest-600"}`}>
                        {activeFlock ? activeFlock.status : "empty"}
                      </span>
                    </div>

                    <div className="mt-4 rounded-lg border border-sand-100 bg-sand-50 p-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-forest-500">Current flock</p>
                      <p className="mt-1 font-semibold text-forest-900">{activeFlock?.flock_code ?? "No active flock"}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MetricTile icon={Users} label="Live chicks" value={activeFlock ? activeFlock.current_count.toLocaleString() : "-"} />
                      <MetricTile icon={Activity} label="Production" value={production === null ? "Pending" : `${production}%`} />
                      <MetricTile icon={Egg} label="Eggs today" value={eggs.toLocaleString()} />
                      <MetricTile icon={Skull} label="Mortality" value={mortality === null ? `${deaths} deaths` : `${mortality}%`} />
                    </div>

                    <div className="mt-4 flex justify-end">
                      {activeFlock ? (
                        <Link
                          className="text-sm font-medium text-forest-800 underline underline-offset-4"
                          href={`/app/analytics?flock_id=${activeFlock.id}`}
                        >
                          View more
                        </Link>
                      ) : (
                        <span className="text-sm text-forest-500">No flock analytics</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 p-4" onClick={onCloseModal}>
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-sand-200 bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form className="space-y-8" onSubmit={onCreateFarm}>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-forest-900">Create Farm Structure</h3>
                <button type="button" className="p-2 text-forest-500 hover:text-forest-700" onClick={onCloseModal}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div>
              ) : null}

              <section className="space-y-4">
                <h4 className="border-b border-sand-200 pb-2 text-lg font-semibold text-forest-800">1. Farm Core Details</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-2 text-sm text-forest-700">
                    Branch
                    <select
                      required
                      className="h-11 rounded-lg border border-sand-200 px-3 text-sm"
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                    >
                      <option value="">Select branch</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm text-forest-700 md:col-span-2">
                    Farm name
                    <input
                      required
                      className="h-11 rounded-lg border border-sand-200 px-3 text-sm"
                      value={farmName}
                      onChange={(e) => setFarmName(e.target.value)}
                      placeholder="Duo Farm"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-forest-700">
                    Capacity (birds)
                    <input
                      type="number"
                      className="h-11 rounded-lg border border-sand-200 px-3 text-sm"
                      value={capacityBirds}
                      onChange={(e) => setCapacityBirds(parseInt(e.target.value, 10) || 0)}
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-5">
                <div className="flex items-center justify-between border-b border-sand-200 pb-2">
                  <h4 className="text-lg font-semibold text-forest-800">2. Houses and Flocks</h4>
                  <button
                    type="button"
                    onClick={addHouseDraft}
                    className="inline-flex items-center gap-1 rounded-md bg-forest-100 px-3 py-1 text-xs font-bold text-forest-700"
                  >
                    <Plus className="h-3 w-3" />
                    Add House
                  </button>
                </div>

                <div className="space-y-4">
                  {draftHouses.map((house, houseIndex) => (
                    <div key={houseIndex} className="rounded-xl border border-sand-200 bg-sand-50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-forest-600">House {houseIndex + 1}</p>
                        <button
                          type="button"
                          onClick={() => removeHouseDraft(houseIndex)}
                          className="text-xs text-red-500"
                        >
                          Remove House
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1 text-xs text-forest-700">
                          House name
                          <input
                            className="h-10 rounded-lg border border-sand-200 px-3 text-sm"
                            value={house.name}
                            onChange={(e) => updateHouseDraft(houseIndex, { name: e.target.value })}
                          />
                        </label>
                        <label className="grid gap-1 text-xs text-forest-700">
                          Capacity
                          <input
                            type="number"
                            className="h-10 rounded-lg border border-sand-200 px-3 text-sm"
                            value={house.capacity}
                            onChange={(e) =>
                              updateHouseDraft(houseIndex, { capacity: parseInt(e.target.value, 10) || 0 })
                            }
                          />
                        </label>
                      </div>

                      <div className="mt-3 space-y-2 border-l border-sand-300 pl-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-forest-500">Flocks</p>
                          <button
                            type="button"
                            onClick={() => addFlockDraft(houseIndex)}
                            className="inline-flex items-center gap-1 rounded border border-sand-300 bg-white px-2 py-1 text-[10px] font-bold text-forest-600"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            Add Flock
                          </button>
                        </div>
                        {house.flocks.length === 0 ? (
                          <p className="text-[11px] text-forest-500">No flocks added yet.</p>
                        ) : (
                          house.flocks.map((_, flockIndex) => (
                            <div key={flockIndex} className="flex items-center justify-between rounded border border-sand-200 bg-white px-2 py-1">
                              <span className="text-[11px] text-forest-700">Flock {flockIndex + 1} (auto code)</span>
                              <button
                                type="button"
                                onClick={() => removeFlockDraft(houseIndex, flockIndex)}
                                className="text-[11px] text-red-500"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex justify-end gap-3 border-t border-sand-200 pt-5">
                <button type="button" onClick={onCloseModal} className="rounded-full border border-forest-900/20 px-5 py-2 text-sm text-forest-700">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-forest-900 px-5 py-2 text-sm text-sand-50 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Farm
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="min-h-24 rounded-lg border border-sand-100 bg-white p-3">
      <div className="flex items-center gap-2 text-forest-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-[0.12em]">{label}</span>
      </div>
      <p className="mt-3 text-lg font-semibold text-forest-900">{value}</p>
    </div>
  );
}
