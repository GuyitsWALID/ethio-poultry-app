"use client";

import { useEffect, useState } from "react";

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
  title: string;
  farm_name: string | null;
  house_name: string | null;
  flock_code: string | null;
};

const operationsCards = [
  { label: "Active Farms", value: "6", note: "2 with expansion plans" },
  { label: "Open Health Cases", value: "11", note: "4 need review today" },
  { label: "Low Stock Items", value: "17", note: "5 critical SKUs" },
  { label: "Feed Days Left", value: "18", note: "Main risk: Bishoftu" },
];

export default function FarmManagerDashboardPage() {
  const [scheduleRows, setScheduleRows] = useState<ScheduleStatus[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);

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

      const [{ data: vaccineEvents }, { data: cleanupRows }, { data: healthRows }] = await Promise.all([
        supabase
          .from("vaccination_events")
          .select("id, event_date, flock_id, vaccine_name, dosage, route")
          .eq("org_id", profile.org_id)
          .order("event_date", { ascending: false })
          .limit(50),
        supabase
          .from("biosecurity_checks")
          .select("id, checklist_date, farm_id, notes, completed_by")
          .eq("org_id", profile.org_id)
          .order("checklist_date", { ascending: false })
          .limit(50),
        supabase
          .from("health_events")
          .select("description, diagnosis")
          .eq("org_id", profile.org_id)
          .like("description", "SCHEDULE_STATUS|%")
          .order("event_date", { ascending: false })
          .limit(200),
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
        scheduleList.push({
          id: v.id,
          type: "vaccination",
          date: v.event_date,
          farm_id: t?.farm_id ?? null,
          house_id: t?.house_id ?? null,
          flock_id: t?.flock_id ?? v.flock_id,
          status: s?.status ?? "scheduled",
          reason: s?.reason ?? null,
          title: `${v.vaccine_name} (${v.dosage}, ${v.route})`,
          farm_name: null,
          house_name: null,
          flock_code: null,
        });
      });

      (cleanupRows ?? []).forEach((c) => {
        const s = statusMap.get(c.id);
        const t = targetMap.get(c.id);
        scheduleList.push({
          id: c.id,
          type: "cleanup",
          date: c.checklist_date,
          farm_id: t?.farm_id ?? c.farm_id,
          house_id: t?.house_id ?? null,
          flock_id: t?.flock_id ?? null,
          status: s?.status ?? (c.completed_by ? "completed" : "scheduled"),
          reason: s?.reason ?? null,
          title: c.notes ?? "Cleanup schedule",
          farm_name: null,
          house_name: null,
          flock_code: null,
        });
      });

      const farmIds = Array.from(new Set(scheduleList.map((s) => s.farm_id).filter(Boolean))) as string[];
      const houseIds = Array.from(new Set(scheduleList.map((s) => s.house_id).filter(Boolean))) as string[];
      const flockIds = Array.from(new Set(scheduleList.map((s) => s.flock_id).filter(Boolean))) as string[];

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

      const namedSchedules = scheduleList.map((s) => ({
        ...s,
        farm_name: s.farm_id ? farmMap.get(s.farm_id) ?? s.farm_id : null,
        house_name: s.house_id ? houseMap.get(s.house_id) ?? s.house_id : null,
        flock_code: s.flock_id ? flockMap.get(s.flock_id) ?? s.flock_id : null,
      }));

      setScheduleRows(
        namedSchedules.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12)
      );
      setLoadingSchedules(false);
    };

    void loadScheduleStatus();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Unified Operations Dashboard</p>
        <h2 className="mt-2 text-2xl font-semibold text-forest-900">Farm manager command center</h2>
        <p className="mt-2 text-sm text-forest-600">
          Farm operations, veterinary monitoring, and inventory control in one workflow.
        </p>
      </div>

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
          Visibility into scheduled vaccination and cleanup by farm/flock and completion status.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.12em] text-forest-600">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Farm</th>
                <th className="px-2 py-2">House</th>
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Miss Reason</th>
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
                    <td className="px-2 py-2">{row.title}</td>
                    <td className="px-2 py-2">{row.farm_name ?? "-"}</td>
                    <td className="px-2 py-2">{row.house_name ?? "-"}</td>
                    <td className="px-2 py-2">{row.flock_code ?? "-"}</td>
                    <td className="px-2 py-2 capitalize">{row.status}</td>
                    <td className="px-2 py-2">{row.reason ?? "-"}</td>
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
