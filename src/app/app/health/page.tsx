"use client";

import { useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type ScheduleItem = {
  id: string;
  type: "vaccination" | "cleanup";
  date: string;
  farmId: string | null;
  houseId: string | null;
  flockId: string | null;
  title: string;
  status: "scheduled" | "completed" | "missed" | "overdue";
  reason: string | null;
};

export default function HealthPage() {
  const { scope, filteredFarms, filteredHouses, filteredFlocks, batches } = useFarmScope();
  const [healthFarmId, setHealthFarmId] = useState("");
  const [healthHouseId, setHealthHouseId] = useState("");
  const [healthFlockId, setHealthFlockId] = useState("");
  const [vaccFarmId, setVaccFarmId] = useState("");
  const [vaccHouseId, setVaccHouseId] = useState("");
  const [vaccFlockId, setVaccFlockId] = useState("");
  const [cleanFarmId, setCleanFarmId] = useState("");
  const [cleanHouseId, setCleanHouseId] = useState("");
  const [cleanFlockId, setCleanFlockId] = useState("");
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [missModal, setMissModal] = useState<{ open: boolean; item: ScheduleItem | null }>({
    open: false,
    item: null,
  });
  const [missReason, setMissReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);

  const farmName = useMemo(() => filteredFarms.find((f) => f.id === healthFarmId)?.name ?? null, [filteredFarms, healthFarmId]);
  const houseName = useMemo(() => filteredHouses.find((h) => h.id === healthHouseId)?.name ?? null, [filteredHouses, healthHouseId]);
  const flockCode = useMemo(() => filteredFlocks.find((f) => f.id === healthFlockId)?.flock_code ?? null, [filteredFlocks, healthFlockId]);
  const batchCode = useMemo(
    () => batches.find((b) => b.id === scope.batchId)?.batch_code ?? null,
    [batches, scope.batchId]
  );

  const parseText = (value: FormDataEntryValue | null) => {
    const parsed = value?.toString().trim();
    return parsed && parsed.length > 0 ? parsed : null;
  };

  const loadSchedules = async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (!profile?.org_id) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    const [{ data: vaccineEvents }, { data: cleanupRows }, { data: healthRows }] = await Promise.all([
      supabase
        .from("vaccination_events")
        .select("id, event_date, flock_id, vaccine_name, dosage, route, batch_number")
        .eq("org_id", profile.org_id)
        .order("event_date", { ascending: false })
        .limit(100),
      supabase
        .from("biosecurity_checks")
        .select("id, checklist_date, farm_id, notes, completed_by")
        .eq("org_id", profile.org_id)
        .order("checklist_date", { ascending: false })
        .limit(100),
      supabase
        .from("health_events")
        .select("id, event_date, description, diagnosis, treatment, flock_id")
        .eq("org_id", profile.org_id)
        .order("event_date", { ascending: false })
        .limit(200),
    ]);

    const statusBySchedule = new Map<string, { status: "completed" | "missed"; reason: string | null }>();
    const targetBySchedule = new Map<string, { farmId: string | null; houseId: string | null; flockId: string | null }>();
    (healthRows ?? []).forEach((row) => {
      const d = row.description ?? "";
      if (d.startsWith("SCHEDULE_STATUS|")) {
        const parts = d.split("|");
        const scheduleId = parts[1] ?? "";
        const status = (parts[2] ?? "") as "completed" | "missed";
        const reason = row.diagnosis ?? null;
        if (scheduleId && (status === "completed" || status === "missed")) {
          statusBySchedule.set(scheduleId, { status, reason });
        }
      }
      if (d.startsWith("SCHEDULE_TARGET|")) {
        const parts = d.split("|");
        const scheduleId = parts[1] ?? "";
        const farmId = parts[2] || null;
        const houseId = parts[3] || null;
        const flockId = parts[4] || null;
        if (scheduleId) {
          targetBySchedule.set(scheduleId, { farmId, houseId, flockId });
        }
      }
    });

    const vaccineSchedules: ScheduleItem[] = (vaccineEvents ?? []).map((v) => {
      const s = statusBySchedule.get(v.id);
      const target = targetBySchedule.get(v.id);
      return {
        id: v.id,
        type: "vaccination",
        date: v.event_date,
        farmId: target?.farmId ?? null,
        houseId: target?.houseId ?? null,
        flockId: target?.flockId ?? v.flock_id,
        title: `Vaccination: ${v.vaccine_name} (${v.dosage}, ${v.route})`,
        status:
          s?.status ??
          (new Date(v.event_date) < new Date(new Date().toISOString().slice(0, 10))
            ? "overdue"
            : "scheduled"),
        reason: s?.reason ?? null,
      };
    });

    const cleanupSchedules: ScheduleItem[] = (cleanupRows ?? []).map((c) => {
      const s = statusBySchedule.get(c.id);
      const target = targetBySchedule.get(c.id);
      return {
        id: c.id,
        type: "cleanup",
        date: c.checklist_date,
        farmId: target?.farmId ?? c.farm_id,
        houseId: target?.houseId ?? null,
        flockId: target?.flockId ?? null,
        title: c.notes?.startsWith("SCHEDULE|") ? c.notes.replace("SCHEDULE|", "") : "Farm cleanup",
        status:
          s?.status ??
          (c.completed_by
            ? "completed"
            : new Date(c.checklist_date) < new Date(new Date().toISOString().slice(0, 10))
              ? "overdue"
              : "scheduled"),
        reason: s?.reason ?? null,
      };
    });

    setSchedules([...vaccineSchedules, ...cleanupSchedules].sort((a, b) => (a.date < b.date ? 1 : -1)));
    setLoading(false);
  };

  useEffect(() => {
    void loadSchedules();
  }, []);

  const validateScopeForFlock = () => {
    if (!scope.farmId || !scope.houseId || !scope.flockId) {
      throw new Error("Select farm, house, and flock from scope filters first.");
    }
    if (!filteredHouses.some((h) => h.id === scope.houseId && h.farm_id === scope.farmId)) {
      throw new Error("Selected house is not valid for selected farm.");
    }
    if (!filteredFlocks.some((f) => f.id === scope.flockId && f.house_id === scope.houseId)) {
      throw new Error("Selected flock is not valid for selected house.");
    }
  };

  const submitVaccinationSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const selectedFarmId = vaccFarmId || scope.farmId;
      const selectedHouseId = vaccHouseId || scope.houseId;
      const selectedFlockId = vaccFlockId || scope.flockId;
      if (!selectedFarmId || !selectedHouseId || !selectedFlockId) {
        throw new Error("Select farm, house, and flock in vaccination modal.");
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unable to verify your session.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      if (!profile?.org_id) throw new Error("Organization context not found.");

      const formData = new FormData(event.currentTarget);
      const plannedDate = parseText(formData.get("planned_date"));
      const vaccineName = parseText(formData.get("vaccine_name"));
      const dosage = parseText(formData.get("dosage"));
      const route = parseText(formData.get("route"));
      if (!plannedDate || !vaccineName || !dosage || !route) {
        throw new Error("Planned date, vaccine name, dosage, and route are required.");
      }

      const { data: newVaccine, error: vaccineError } = await supabase
        .from("vaccination_events")
        .insert({
        org_id: profile.org_id,
        flock_id: selectedFlockId,
        event_date: plannedDate,
        vaccine_name: vaccineName,
        dosage,
        route,
        birds_vaccinated: null,
        vet_id: user.id,
        batch_number: batchCode,
          expiry_date: parseText(formData.get("expiry_date")),
        })
        .select("id")
        .single();
      if (vaccineError) throw new Error(vaccineError.message);
      if (newVaccine?.id) {
        await supabase.from("health_events").insert({
          org_id: profile.org_id,
          flock_id: selectedFlockId,
          event_date: plannedDate,
          event_type: "observation",
          description: `SCHEDULE_TARGET|${newVaccine.id}|${selectedFarmId}|${selectedHouseId}|${selectedFlockId}`,
          vet_id: user.id,
        });
      }

      setShowVaccineModal(false);
      event.currentTarget.reset();
      setSuccess("Vaccination schedule created.");
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create schedule.");
    } finally {
      setSaving(false);
    }
  };

  const submitCleanupSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const selectedFarmId = cleanFarmId || scope.farmId;
      if (!selectedFarmId) throw new Error("Select a farm in cleanup modal.");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unable to verify your session.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      if (!profile?.org_id) throw new Error("Organization context not found.");

      const formData = new FormData(event.currentTarget);
      const date = parseText(formData.get("checklist_date"));
      const type = parseText(formData.get("cleanup_type"));
      if (!date || !type) throw new Error("Cleanup date and cleanup type are required.");
      const notes = parseText(formData.get("notes"));

      const { data: newCleanup, error: cleanupError } = await supabase
        .from("biosecurity_checks")
        .insert({
        org_id: profile.org_id,
        farm_id: selectedFarmId,
        checklist_date: date,
        completed_by: null,
        notes: `SCHEDULE|${type}${notes ? ` | ${notes}` : ""}`,
        })
        .select("id")
        .single();
      if (cleanupError) throw new Error(cleanupError.message);
      if (newCleanup?.id) {
        await supabase.from("health_events").insert({
          org_id: profile.org_id,
          flock_id: cleanFlockId || null,
          event_date: date,
          event_type: "observation",
          description: `SCHEDULE_TARGET|${newCleanup.id}|${selectedFarmId}|${cleanHouseId || ""}|${cleanFlockId || ""}`,
          vet_id: user.id,
        });
      }

      setShowCleanupModal(false);
      event.currentTarget.reset();
      setSuccess("Cleanup schedule created.");
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create cleanup schedule.");
    } finally {
      setSaving(false);
    }
  };

  const markSchedule = async (item: ScheduleItem, status: "completed" | "missed", reason?: string) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unable to verify your session.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      if (!profile?.org_id) throw new Error("Organization context not found.");

      if (item.type === "cleanup" && status === "completed") {
        const { error: upd } = await supabase
          .from("biosecurity_checks")
          .update({ completed_by: user.id })
          .eq("id", item.id);
        if (upd) throw new Error(upd.message);
      }

      const { error: statusError } = await supabase.from("health_events").insert({
        org_id: profile.org_id,
        flock_id: item.flockId ?? scope.flockId ?? null,
        event_date: item.date,
        event_type: "observation",
        description: `SCHEDULE_STATUS|${item.id}|${status}|${item.type}`,
        diagnosis: reason ?? null,
        vet_id: user.id,
      });
      if (statusError) throw new Error(statusError.message);

      setSuccess(status === "completed" ? "Marked as completed." : "Marked as missed.");
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update schedule status.");
    } finally {
      setSaving(false);
    }
  };

  const healthFilteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      if (healthFarmId && item.farmId !== healthFarmId) return false;
      if (healthHouseId && item.houseId !== healthHouseId) return false;
      if (healthFlockId && item.flockId !== healthFlockId) return false;
      return true;
    });
  }, [schedules, healthFarmId, healthHouseId, healthFlockId]);

  const badgeClass = (status: ScheduleItem["status"]) => {
    if (status === "completed") return "bg-leaf-500/15 text-leaf-600 border border-leaf-500/30";
    if (status === "missed") return "bg-ember-500/15 text-ember-600 border border-ember-500/30";
    if (status === "overdue") return "bg-amber-500/15 text-amber-700 border border-amber-500/30";
    return "bg-amber-500/10 text-amber-700 border border-amber-500/20";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Health Module</p>
          <h2 className="text-2xl font-semibold text-forest-900">Scheduled Health Operations</h2>
          <p className="mt-1 text-sm text-forest-600">
            Plan vaccination and cleanup, then track completion against schedule.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
            onClick={() => setShowCleanupModal(true)}
          >
            Schedule cleanup
          </button>
          <button
            type="button"
            className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50"
            onClick={() => setShowVaccineModal(true)}
          >
            Schedule vaccination
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-white p-4">
        <p className="text-xs text-forest-600">
          Current scope: {farmName ?? "No farm selected"} · {houseName ?? "No house selected"} ·{" "}
          {flockCode ?? "No flock selected"}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select
            className="h-10 rounded-xl border border-sand-200 px-3 text-sm"
            value={healthFarmId}
            onChange={(e) => {
              setHealthFarmId(e.target.value);
              setHealthHouseId("");
              setHealthFlockId("");
            }}
          >
            <option value="">All Farms</option>
            {filteredFarms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-sand-200 px-3 text-sm"
            value={healthHouseId}
            onChange={(e) => {
              setHealthHouseId(e.target.value);
              setHealthFlockId("");
            }}
          >
            <option value="">All Houses</option>
            {filteredHouses
              .filter((h) => !healthFarmId || h.farm_id === healthFarmId)
              .map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
          </select>
          <select
            className="h-10 rounded-xl border border-sand-200 px-3 text-sm"
            value={healthFlockId}
            onChange={(e) => setHealthFlockId(e.target.value)}
          >
            <option value="">All Flocks</option>
            {filteredFlocks
              .filter((f) => (!healthFarmId || f.farm_id === healthFarmId) && (!healthHouseId || f.house_id === healthHouseId))
              .map((f) => (
                <option key={f.id} value={f.id}>{f.flock_code}</option>
              ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-sm text-ember-500">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-leaf-500/40 bg-leaf-500/10 px-3 py-2 text-sm text-leaf-500">
          {success}
        </p>
      ) : null}

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-forest-900">Schedules</h3>
        <div className="mt-3 overflow-x-auto">
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
                <th className="px-2 py-2">Reason</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-forest-600">Loading schedules...</td>
                </tr>
              ) : healthFilteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-2 py-4 text-forest-600">No schedules found.</td>
                </tr>
              ) : (
                healthFilteredSchedules.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="border-b border-sand-100">
                    <td className="px-2 py-2">{item.date}</td>
                    <td className="px-2 py-2 capitalize">{item.type}</td>
                    <td className="px-2 py-2">{item.title}</td>
                    <td className="px-2 py-2">{item.farmId ?? "-"}</td>
                    <td className="px-2 py-2">{item.houseId ?? "-"}</td>
                    <td className="px-2 py-2">{item.flockId ?? "-"}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${badgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-2 py-2">{item.reason ?? "-"}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-leaf-500/40 px-2 py-1 text-xs text-leaf-600 disabled:opacity-50"
                          disabled={saving || item.status === "completed"}
                          onClick={() => void markSchedule(item, "completed")}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-ember-500/40 px-2 py-1 text-xs text-ember-600 disabled:opacity-50"
                          disabled={saving || item.status === "missed"}
                          onClick={() => setMissModal({ open: true, item })}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showVaccineModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-forest-900">Schedule Vaccination</h4>
              <button type="button" className="text-sm text-forest-600" onClick={() => setShowVaccineModal(false)}>
                Close
              </button>
            </div>
            <form className="mt-4 grid gap-3" onSubmit={submitVaccinationSchedule}>
              <select
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={vaccFarmId}
                onChange={(e) => {
                  setVaccFarmId(e.target.value);
                  setVaccHouseId("");
                  setVaccFlockId("");
                }}
                required
              >
                <option value="">Select farm</option>
                {filteredFarms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={vaccHouseId}
                onChange={(e) => {
                  setVaccHouseId(e.target.value);
                  setVaccFlockId("");
                }}
                required
              >
                <option value="">Select house</option>
                {filteredHouses
                  .filter((h) => !vaccFarmId || h.farm_id === vaccFarmId)
                  .map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
              </select>
              <select
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={vaccFlockId}
                onChange={(e) => setVaccFlockId(e.target.value)}
                required
              >
                <option value="">Select flock</option>
                {filteredFlocks
                  .filter((f) => (!vaccFarmId || f.farm_id === vaccFarmId) && (!vaccHouseId || f.house_id === vaccHouseId))
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.flock_code}</option>
                  ))}
              </select>
              <input name="planned_date" type="date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              <input name="vaccine_name" placeholder="Vaccine name" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              <input name="dosage" placeholder="Dosage" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              <input name="route" placeholder="Route (water/injection/spray/eye_drop)" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              <input name="expiry_date" type="date" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              <button type="submit" disabled={saving} className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60">
                {saving ? "Saving..." : "Create Schedule"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showCleanupModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-forest-900">Schedule Farm Cleanup</h4>
              <button type="button" className="text-sm text-forest-600" onClick={() => setShowCleanupModal(false)}>
                Close
              </button>
            </div>
            <form className="mt-4 grid gap-3" onSubmit={submitCleanupSchedule}>
              <select
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={cleanFarmId}
                onChange={(e) => {
                  setCleanFarmId(e.target.value);
                  setCleanHouseId("");
                  setCleanFlockId("");
                }}
                required
              >
                <option value="">Select farm</option>
                {filteredFarms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={cleanHouseId}
                onChange={(e) => {
                  setCleanHouseId(e.target.value);
                  setCleanFlockId("");
                }}
              >
                <option value="">Select house (optional)</option>
                {filteredHouses
                  .filter((h) => !cleanFarmId || h.farm_id === cleanFarmId)
                  .map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
              </select>
              <select
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={cleanFlockId}
                onChange={(e) => setCleanFlockId(e.target.value)}
              >
                <option value="">Select flock (optional)</option>
                {filteredFlocks
                  .filter((f) => (!cleanFarmId || f.farm_id === cleanFarmId) && (!cleanHouseId || f.house_id === cleanHouseId))
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.flock_code}</option>
                  ))}
              </select>
              <input name="checklist_date" type="date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              <input name="cleanup_type" placeholder="Cleanup type" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              <textarea name="notes" placeholder="Optional notes" className="min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm" />
              <button type="submit" disabled={saving} className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60">
                {saving ? "Saving..." : "Create Schedule"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {missModal.open && missModal.item ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-forest-900">Reason For Missed Schedule</h4>
              <button
                type="button"
                className="text-sm text-forest-600"
                onClick={() => {
                  setMissModal({ open: false, item: null });
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
                  setMissModal({ open: false, item: null });
                  setMissReason("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-ember-500 px-4 py-2 text-sm text-white disabled:opacity-60"
                disabled={saving || missReason.trim().length === 0}
                onClick={async () => {
                  if (!missModal.item) return;
                  await markSchedule(missModal.item, "missed", missReason.trim());
                  setMissModal({ open: false, item: null });
                  setMissReason("");
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
