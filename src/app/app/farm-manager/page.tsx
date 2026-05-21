"use client";

import { useEffect, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type ScheduleStatus = {
  id: string;
  type: "vaccination" | "cleanup";
  date: string;
  farm_id: string | null;
  house_id: string | null;
  flock_id: string | null;
  status: "scheduled" | "completed" | "missed";
  reason: string | null;
  scheduleReason: string | null;
  farm_name: string | null;
  house_name: string | null;
  flock_code: string | null;
};

type OperationsCard = {
  label: string;
  value: string;
  note: string;
};

export default function FarmManagerDashboardPage() {
  const { scope, setScope, filteredFarms, filteredHouses, filteredFlocks, filteredBatches } = useFarmScope();
  const [operationsCards, setOperationsCards] = useState<OperationsCard[]>([
    { label: "Active Farms", value: "-", note: "Current farm scope" },
    { label: "Active Houses", value: "-", note: "Houses with active flocks" },
    { label: "Active Flocks", value: "-", note: "Status = active" },
    { label: "Total Daily Live Count", value: "-", note: "Latest recorded date" },
  ]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleStatus[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [missModal, setMissModal] = useState<{ open: boolean; row: ScheduleStatus | null }>({ open: false, row: null });
  const [missReason, setMissReason] = useState("");

  const scopeKey = `${scope.farmId}|${scope.houseId}|${scope.flockId}|${scope.batchId}|${filteredFarms.length}|${filteredHouses.length}|${filteredFlocks.length}|${filteredBatches.length}`;
  const badgeClass = (status: ScheduleStatus["status"]) => {
    if (status === "completed") return "bg-leaf-500/15 text-leaf-600 border border-leaf-500/30";
    if (status === "missed") return "bg-ember-500/15 text-ember-600 border border-ember-500/30";
    return "bg-amber-500/10 text-amber-700 border border-amber-500/20";
  };

  const markSchedule = async (row: ScheduleStatus, status: "completed" | "missed", reason?: string) => {
    setSavingStatus(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingStatus(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id) {
      setSavingStatus(false);
      return;
    }

    if (row.type === "cleanup" && status === "completed") {
      await supabase.from("biosecurity_checks").update({ completed_by: user.id }).eq("id", row.id);
    }

    await supabase.from("health_events").insert({
      org_id: profile.org_id,
      flock_id: row.flock_id,
      event_date: row.date,
      event_type: "observation",
      description: `SCHEDULE_STATUS|${row.id}|${status}|${row.type}`,
      diagnosis: reason ?? null,
      vet_id: user.id,
    });

    setSavingStatus(false);
    setMissModal({ open: false, row: null });
    setMissReason("");
  };

  useEffect(() => {
    const loadScheduleStatus = async () => {
      setLoadingSchedules(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoadingSchedules(false);
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) {
        setLoadingSchedules(false);
        return;
      }
      const orgId = profile.org_id;

      const scopedFlockIds = filteredFlocks
        .filter((flock) => {
          if (!scope.batchId) return true;
          return filteredBatches.some((batch) => batch.id === scope.batchId && batch.flock_id === flock.id);
        })
        .map((flock) => flock.id);

      const [farmsCountRes, activeFlocksRes, latestDailyRes] = await Promise.all([
        scope.farmId
          ? Promise.resolve({ count: filteredFarms.length })
          : supabase.from("farms").select("id", { count: "exact", head: true }).eq("org_id", orgId),
        scope.flockId
          ? supabase.from("flocks").select("id, house_id").eq("org_id", orgId).eq("status", "active").eq("id", scope.flockId)
          : scopedFlockIds.length > 0
            ? supabase.from("flocks").select("id, house_id").eq("org_id", orgId).eq("status", "active").in("id", scopedFlockIds)
            : scope.farmId || scope.houseId || scope.batchId
              ? Promise.resolve({ data: [] as Array<{ id: string; house_id: string | null }> })
              : supabase.from("flocks").select("id, house_id").eq("org_id", orgId).eq("status", "active"),
        supabase
          .from("daily_farm_records")
          .select("record_date")
          .eq("org_id", orgId)
          .order("record_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      let totalLiveCount = 0;
      if (latestDailyRes.data?.record_date) {
        const latestDate = latestDailyRes.data.record_date;
        const { data: datesRows } = await supabase
          .from("daily_farm_records")
          .select("record_date")
          .eq("org_id", orgId)
          .lt("record_date", latestDate)
          .order("record_date", { ascending: false })
          .limit(1);

        const previousDate = datesRows?.[0]?.record_date ?? null;

        let todayQuery = supabase
          .from("daily_farm_records")
          .select("flock_id, deaths, culls")
          .eq("org_id", orgId)
          .eq("record_date", latestDate);
        let previousQuery = previousDate
          ? supabase
              .from("daily_farm_records")
              .select("flock_id, live_count")
              .eq("org_id", orgId)
              .eq("record_date", previousDate)
          : Promise.resolve({ data: [] as Array<{ flock_id: string; live_count: number | null }> });

        if (scope.flockId) {
          todayQuery = todayQuery.eq("flock_id", scope.flockId);
          previousQuery = previousDate
            ? supabase
                .from("daily_farm_records")
                .select("flock_id, live_count")
                .eq("org_id", orgId)
                .eq("record_date", previousDate)
                .eq("flock_id", scope.flockId)
            : previousQuery;
        } else if (scopedFlockIds.length > 0) {
          todayQuery = todayQuery.in("flock_id", scopedFlockIds);
          previousQuery = previousDate
            ? supabase
                .from("daily_farm_records")
                .select("flock_id, live_count")
                .eq("org_id", orgId)
                .eq("record_date", previousDate)
                .in("flock_id", scopedFlockIds)
            : previousQuery;
        }

        const [{ data: todayRows }, { data: previousRows }] = await Promise.all([todayQuery, previousQuery]);

        const previousLiveByFlock = new Map<string, number>();
        (previousRows ?? []).forEach((r) => previousLiveByFlock.set(r.flock_id, r.live_count ?? 0));

        totalLiveCount = (todayRows ?? []).reduce((acc, r) => {
          const prevLive = previousLiveByFlock.get(r.flock_id) ?? 0;
          const losses = (r.deaths ?? 0) + (r.culls ?? 0);
          return acc + Math.max(0, prevLive - losses);
        }, 0);
      }

      const latestDateLabel = latestDailyRes.data?.record_date
        ? `Derived from yesterday minus losses on ${latestDailyRes.data.record_date}`
        : "No daily records yet";

      const activeFlocks = activeFlocksRes.data ?? [];
      const activeHousesCount = new Set(activeFlocks.map((row) => row.house_id).filter(Boolean)).size;
      setOperationsCards([
        {
          label: "Active Farms",
          value: (farmsCountRes.count ?? filteredFarms.length ?? 0).toLocaleString(),
          note: "Current farm scope",
        },
        {
          label: "Active Houses",
          value: activeHousesCount.toLocaleString(),
          note: "Houses with active flocks",
        },
        {
          label: "Active Flocks",
          value: activeFlocks.length.toLocaleString(),
          note: "Status = active",
        },
        {
          label: "Total Daily Live Count",
          value: totalLiveCount.toLocaleString(),
          note: latestDateLabel,
        },
      ]);

      let vaccineQuery = supabase
        .from("vaccination_events")
        .select("id, event_date, flock_id, vaccine_name, dosage, route")
        .eq("org_id", orgId)
        .order("event_date", { ascending: false })
        .limit(100);
      let cleanupQuery = supabase
        .from("biosecurity_checks")
        .select("id, checklist_date, farm_id, notes, completed_by")
        .eq("org_id", orgId)
        .order("checklist_date", { ascending: false })
        .limit(100);
      const healthQuery = supabase
        .from("health_events")
        .select("description, diagnosis, event_date")
        .eq("org_id", orgId)
        .or("description.like.SCHEDULE_STATUS|%,description.like.SCHEDULE_TARGET|%")
        .order("event_date", { ascending: false })
        .limit(600);

      if (scope.flockId) {
        vaccineQuery = vaccineQuery.eq("flock_id", scope.flockId);
      } else if (scopedFlockIds.length > 0) {
        vaccineQuery = vaccineQuery.in("flock_id", scopedFlockIds);
      } else if (scope.farmId || scope.houseId || scope.batchId) {
        setScheduleRows([]);
        setLoadingSchedules(false);
        return;
      }

      if (scope.farmId) cleanupQuery = cleanupQuery.eq("farm_id", scope.farmId);

      const [{ data: vaccineEvents }, { data: cleanupRows }, { data: healthRows }] = await Promise.all([
        vaccineQuery,
        cleanupQuery,
        healthQuery,
      ]);

      const statusMap = new Map<string, { status: "completed" | "missed"; reason: string | null }>();
      const targetMap = new Map<string, { farm_id: string | null; house_id: string | null; flock_id: string | null }>();
      (healthRows ?? []).forEach((row) => {
        const d = row.description ?? "";
        if (d.startsWith("SCHEDULE_STATUS|")) {
          const parts = d.split("|");
          if (parts.length < 3) return;
          const scheduleId = parts[1] ?? "";
          const status = (parts[2] ?? "") as "completed" | "missed";
          if (!scheduleId || (status !== "completed" && status !== "missed")) return;
          statusMap.set(scheduleId, { status, reason: row.diagnosis ?? null });
        }
        if (d.startsWith("SCHEDULE_TARGET|")) {
          const parts = d.split("|");
          const scheduleId = parts[1] ?? "";
          if (!scheduleId) return;
          targetMap.set(scheduleId, {
            farm_id: parts[2] || null,
            house_id: parts[3] || null,
            flock_id: parts[4] || null,
          });
        }
      });

      const scheduleList: ScheduleStatus[] = [];

      (vaccineEvents ?? []).forEach((v) => {
        const s = statusMap.get(v.id);
        const t = targetMap.get(v.id);
        const item: ScheduleStatus = {
          id: v.id,
          type: "vaccination",
          date: v.event_date,
          farm_id: t?.farm_id ?? null,
          house_id: t?.house_id ?? null,
          flock_id: t?.flock_id ?? v.flock_id,
          status: s?.status ?? "scheduled",
          reason: s?.reason ?? null,
          scheduleReason: `${v.vaccine_name}${v.dosage ? ` | Dosage: ${v.dosage}` : ""}${v.route ? ` | Route: ${v.route}` : ""}`,
          farm_name: null,
          house_name: null,
          flock_code: null,
        };
        scheduleList.push(item);
      });

      (cleanupRows ?? []).forEach((c) => {
        const s = statusMap.get(c.id);
        const t = targetMap.get(c.id);
        const item: ScheduleStatus = {
          id: c.id,
          type: "cleanup",
          date: c.checklist_date,
          farm_id: t?.farm_id ?? c.farm_id,
          house_id: t?.house_id ?? null,
          flock_id: t?.flock_id ?? null,
          status: s?.status ?? (c.completed_by ? "completed" : "scheduled"),
          reason: s?.reason ?? null,
          scheduleReason: c.notes?.startsWith("SCHEDULE|") ? c.notes.replace("SCHEDULE|", "").trim() : "Farm cleanup",
          farm_name: null,
          house_name: null,
          flock_code: null,
        };
        scheduleList.push(item);
      });

      const scopedSchedules = scheduleList.filter((item) => {
        if (scope.farmId && item.farm_id !== scope.farmId) return false;
        if (scope.houseId && item.house_id !== scope.houseId) return false;
        if (scope.flockId && item.flock_id !== scope.flockId) return false;
        return true;
      });

      const farmIds = Array.from(new Set(scopedSchedules.map((s) => s.farm_id).filter(Boolean))) as string[];
      const houseIds = Array.from(new Set(scopedSchedules.map((s) => s.house_id).filter(Boolean))) as string[];
      const flockIds = Array.from(new Set(scopedSchedules.map((s) => s.flock_id).filter(Boolean))) as string[];

      const [farmsRes, housesRes, flocksRes] = await Promise.all([
        farmIds.length
          ? supabase.from("farms").select("id, name").in("id", farmIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
        houseIds.length
          ? supabase.from("houses").select("id, name").in("id", houseIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
        flockIds.length
          ? supabase.from("flocks").select("id, flock_code").in("id", flockIds)
          : Promise.resolve({ data: [] as Array<{ id: string; flock_code: string }> }),
      ]);

      const farmMap = new Map((farmsRes.data ?? []).map((f) => [f.id, f.name]));
      const houseMap = new Map((housesRes.data ?? []).map((h) => [h.id, h.name]));
      const flockMap = new Map((flocksRes.data ?? []).map((f) => [f.id, f.flock_code]));

      const namedSchedules = scopedSchedules.map((s) => ({
        ...s,
        farm_name: s.farm_id ? farmMap.get(s.farm_id) ?? s.farm_id : null,
        house_name: s.house_id ? houseMap.get(s.house_id) ?? s.house_id : null,
        flock_code: s.flock_id ? flockMap.get(s.flock_id) ?? s.flock_id : null,
      }));

      setScheduleRows(namedSchedules.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20));
      setLoadingSchedules(false);
    };

    void loadScheduleStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Unified Operations Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold text-forest-900">Farm manager command center</h2>
        <p className="mt-2 text-sm text-forest-600">
          Farm operations, veterinary monitoring, and inventory control in one workflow.
        </p>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-forest-900">Operations Scope</h3>
            <p className="text-sm text-forest-600">Filter by farm, batch, house, and flock within your assigned branch.</p>
          </div>
          <button
            type="button"
            onClick={() => setScope((prev) => ({ ...prev, farmId: "", batchId: "", houseId: "", flockId: "" }))}
            className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs text-forest-600">
            Farm
            <select
              className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
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
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            Batch
            <select
              className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={scope.batchId}
              onChange={(e) => setScope((prev) => ({ ...prev, batchId: e.target.value, flockId: "" }))}
            >
              <option value="">All Batches</option>
              {filteredBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.batch_code}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            House
            <select
              className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={scope.houseId}
              onChange={(e) => setScope((prev) => ({ ...prev, houseId: e.target.value, flockId: "" }))}
            >
              <option value="">All Houses</option>
              {filteredHouses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            Flock
            <select
              className="h-10 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900"
              value={scope.flockId}
              onChange={(e) => setScope((prev) => ({ ...prev, flockId: e.target.value }))}
            >
              <option value="">All Flocks</option>
              {filteredFlocks
                .filter((f) => {
                  if (!scope.batchId) return true;
                  return filteredBatches.some((b) => b.id === scope.batchId && b.flock_id === f.id);
                })
                .map((f) => (
                  <option key={f.id} value={f.id}>{f.flock_code}</option>
                ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {operationsCards.map((card) => (
          <article key={card.label} className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-forest-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-forest-900">{card.value}</p>
            <p className="mt-2 text-xs text-forest-600">{card.note}</p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Schedule Compliance</h3>
        <p className="mt-1 text-sm text-forest-600">
          Daily schedules where farm manager can mark completion or missed reason.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.12em] text-forest-600">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Farm</th>
                <th className="px-2 py-2">House</th>
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Reason</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingSchedules ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-forest-600">Loading schedule visibility...</td>
                </tr>
              ) : scheduleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-forest-600">No schedules available yet.</td>
                </tr>
              ) : (
                scheduleRows.map((row) => (
                  <tr key={`${row.type}-${row.id}`} className="border-b border-sand-100">
                    <td className="px-2 py-2">{row.date}</td>
                    <td className="px-2 py-2 capitalize">{row.type}</td>
                    <td className="px-2 py-2">{row.farm_name ?? "-"}</td>
                    <td className="px-2 py-2">{row.house_name ?? "-"}</td>
                    <td className="px-2 py-2">{row.flock_code ?? "-"}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${badgeClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2 py-2">{row.reason ?? row.scheduleReason ?? "-"}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-leaf-500/40 px-2 py-1 text-xs text-leaf-600 disabled:opacity-50"
                          disabled={savingStatus || row.status === "completed"}
                          onClick={() => void markSchedule(row, "completed")}
                        >
                          ✓
                        </button>
                        {row.status !== "completed" ? (
                          <button
                            type="button"
                            className="rounded-full border border-ember-500/40 px-2 py-1 text-xs text-ember-600 disabled:opacity-50"
                            disabled={savingStatus || row.status === "missed"}
                            onClick={() => setMissModal({ open: true, row })}
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {missModal.open && missModal.row ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-forest-900">Reason For Missed Schedule</h4>
              <button
                type="button"
                className="text-sm text-forest-600"
                onClick={() => {
                  setMissModal({ open: false, row: null });
                  setMissReason("");
                }}
              >
                Close
              </button>
            </div>
            <textarea
              value={missReason}
              onChange={(e) => setMissReason(e.target.value)}
              placeholder="Why was this schedule missed?"
              className="mt-4 min-h-[120px] w-full rounded-xl border border-sand-200 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
                onClick={() => {
                  setMissModal({ open: false, row: null });
                  setMissReason("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-ember-500 px-4 py-2 text-sm text-white disabled:opacity-60"
                disabled={savingStatus || missReason.trim().length === 0}
                onClick={async () => {
                  if (!missModal.row) return;
                  await markSchedule(missModal.row, "missed", missReason.trim());
                }}
              >
                Mark Missed
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
