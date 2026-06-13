"use client";

import { useEffect, useState } from "react";

import { FarmKpiDashboard } from "@/components/farm-kpi-dashboard";
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

export default function FarmManagerDashboardPage() {
  const { scope, filteredFlocks, filteredBatches } = useFarmScope();
  const [scheduleRows, setScheduleRows] = useState<ScheduleStatus[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [missModal, setMissModal] = useState<{ open: boolean; row: ScheduleStatus | null }>({ open: false, row: null });
  const [missReason, setMissReason] = useState("");

  const scopeKey = `${scope.farmId}|${scope.houseId}|${scope.flockId}|${scope.batchId}|${filteredFlocks.length}|${filteredBatches.length}`;
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

    const statusFlockId = row.flock_id ?? scope.flockId;
    if (statusFlockId) {
      await supabase.from("health_events").insert({
        org_id: profile.org_id,
        flock_id: statusFlockId,
        event_date: row.date,
        event_type: "observation",
        description: `SCHEDULE_STATUS|${row.id}|${status}|${row.type}`,
        diagnosis: reason ?? null,
        vet_id: user.id,
      });
    }

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
      .filter((flock) => !scope.batchId || flock.batch_id === scope.batchId)
        .map((flock) => flock.id);

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

      <FarmKpiDashboard mode="operations" />

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
