"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type ScheduleItem = {
  id: string;
  type: "vaccination" | "cleanup" | "weight";
  date: string;
  farmId: string | null;
  houseId: string | null;
  flockId: string | null;
  batchId?: string | null;
  dueWeekNumber?: number | null;
  weightRecordId?: string | null;
  scheduleReason: string | null;
  status: "scheduled" | "completed" | "missed" | "overdue";
  reason: string | null;
};

type EditScheduleState = {
  open: boolean;
  item: ScheduleItem | null;
  farmId: string;
  houseId: string;
  flockId: string;
  date: string;
  cleanupType: string;
  notes: string;
  vaccineName: string;
  dosage: string;
  route: "water" | "injection" | "spray" | "eye_drop";
};

type ActionMenuState = {
  open: boolean;
  item: ScheduleItem | null;
  top: number;
  left: number;
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
  const [weightFarmId, setWeightFarmId] = useState("");
  const [weightHouseId, setWeightHouseId] = useState("");
  const [weightFlockId, setWeightFlockId] = useState("");
  const [weightBatchId, setWeightBatchId] = useState("");
  const [showVaccineModal, setShowVaccineModal] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [recordWeightModal, setRecordWeightModal] = useState<{ open: boolean; item: ScheduleItem | null }>({
    open: false,
    item: null,
  });
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
  const [actionMenu, setActionMenu] = useState<ActionMenuState>({
    open: false,
    item: null,
    top: 0,
    left: 0,
  });
  const [removeModal, setRemoveModal] = useState<{ open: boolean; item: ScheduleItem | null }>({
    open: false,
    item: null,
  });
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [editModal, setEditModal] = useState<EditScheduleState>({
    open: false,
    item: null,
    farmId: "",
    houseId: "",
    flockId: "",
    date: "",
    cleanupType: "",
    notes: "",
    vaccineName: "",
    dosage: "",
    route: "water",
  });

  const farmName = useMemo(() => filteredFarms.find((f) => f.id === healthFarmId)?.name ?? null, [filteredFarms, healthFarmId]);
  const houseName = useMemo(() => filteredHouses.find((h) => h.id === healthHouseId)?.name ?? null, [filteredHouses, healthHouseId]);
  const flockCode = useMemo(() => filteredFlocks.find((f) => f.id === healthFlockId)?.flock_code ?? null, [filteredFlocks, healthFlockId]);
  const farmNameById = useMemo(() => new Map(filteredFarms.map((f) => [f.id, f.name])), [filteredFarms]);
  const houseNameById = useMemo(() => new Map(filteredHouses.map((h) => [h.id, h.name])), [filteredHouses]);
  const flockCodeById = useMemo(() => new Map(filteredFlocks.map((f) => [f.id, f.flock_code])), [filteredFlocks]);
  const flockById = useMemo(() => new Map(filteredFlocks.map((f) => [f.id, f])), [filteredFlocks]);
  const batchCode = useMemo(
    () => batches.find((b) => b.id === scope.batchId)?.batch_code ?? null,
    [batches, scope.batchId]
  );

  const parseText = (value: FormDataEntryValue | null) => {
    const parsed = value?.toString().trim();
    return parsed && parsed.length > 0 ? parsed : null;
  };
  const parseCleanupReason = (value: string | null) => {
    if (!value) return { cleanupType: "", notes: "" };
    const [cleanupType, ...rest] = value.split("|").map((part) => part.trim());
    return { cleanupType: cleanupType ?? "", notes: rest.join(" | ") };
  };
  const parseVaccinationReason = (value: string | null) => {
    if (!value) return { vaccineName: "", dosage: "", route: "water" as const };
    const parts = value.split("|").map((part) => part.trim());
    const vaccineName = parts[0] ?? "";
    const dosage = parts.find((part) => part.toLowerCase().startsWith("dosage:"))?.split(":")[1]?.trim() ?? "";
    const routeText = parts.find((part) => part.toLowerCase().startsWith("route:"))?.split(":")[1]?.trim().toLowerCase() ?? "water";
    const route = (["water", "injection", "spray", "eye_drop"].includes(routeText) ? routeText : "water") as EditScheduleState["route"];
    return { vaccineName, dosage, route };
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

    const db = supabase as any;
    const [{ data: vaccineEvents }, { data: cleanupRows }, { data: healthRows }, { data: weightTasks }] = await Promise.all([
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
      db
        .from("batch_weight_check_tasks")
        .select("id, batch_id, flock_id, due_week_number, due_date, status, weight_record_id")
        .eq("org_id", profile.org_id)
        .order("due_date", { ascending: false })
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
        scheduleReason: `${v.vaccine_name}${v.dosage ? ` | Dosage: ${v.dosage}` : ""}${v.route ? ` | Route: ${v.route}` : ""}`,
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
        scheduleReason: c.notes?.startsWith("SCHEDULE|") ? c.notes.replace("SCHEDULE|", "").trim() : "Farm cleanup",
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

    const weightSchedules: ScheduleItem[] = ((weightTasks ?? []) as Array<{
      id: string;
      batch_id: string;
      flock_id: string;
      due_week_number: number;
      due_date: string;
      status: "scheduled" | "completed" | "missed";
      weight_record_id: string | null;
    }>).map((task) => {
      const flock = flockById.get(task.flock_id);
      return {
        id: task.id,
        type: "weight",
        date: task.due_date,
        farmId: flock?.farm_id ?? null,
        houseId: flock?.house_id ?? null,
        flockId: task.flock_id,
        batchId: task.batch_id,
        dueWeekNumber: task.due_week_number,
        weightRecordId: task.weight_record_id,
        scheduleReason: `Week ${task.due_week_number} sample body weight`,
        status:
          task.status === "completed" || task.status === "missed"
            ? task.status
            : new Date(task.due_date) < new Date(new Date().toISOString().slice(0, 10))
              ? "overdue"
              : "scheduled",
        reason: task.weight_record_id ? "Weight sample recorded" : null,
      };
    });

    setSchedules([...vaccineSchedules, ...cleanupSchedules, ...weightSchedules].sort((a, b) => (a.date < b.date ? 1 : -1)));
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!actionMenu.open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!actionMenuRef.current) return;
      const target = event.target as Node;
      if (!actionMenuRef.current.contains(target)) {
        setActionMenu({ open: false, item: null, top: 0, left: 0 });
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionMenu({ open: false, item: null, top: 0, left: 0 });
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [actionMenu.open]);

  const submitVaccinationSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
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

      const plannedDate = parseText(formData.get("planned_date"));
      const vaccineName = parseText(formData.get("vaccine_name"));
      const dosage = parseText(formData.get("dosage"));
      const routeText = parseText(formData.get("route"));
      if (!plannedDate || !vaccineName || !dosage || !routeText) {
        throw new Error("Planned date, vaccine name, dosage, and route are required.");
      }
      const vaccineRoutes = ["water", "injection", "spray", "eye_drop"] as const;
      if (!vaccineRoutes.includes(routeText as (typeof vaccineRoutes)[number])) {
        throw new Error("Route is not valid.");
      }
      const route = routeText as (typeof vaccineRoutes)[number];

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
      form.reset();
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
    const form = event.currentTarget;
    const formData = new FormData(form);
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
      const targetFlockId = cleanFlockId || scope.flockId;
      if (newCleanup?.id && targetFlockId) {
        await supabase.from("health_events").insert({
          org_id: profile.org_id,
          flock_id: targetFlockId,
          event_date: date,
          event_type: "observation",
          description: `SCHEDULE_TARGET|${newCleanup.id}|${selectedFarmId}|${cleanHouseId || ""}|${cleanFlockId || ""}`,
          vet_id: user.id,
        });
      }

      setShowCleanupModal(false);
      form.reset();
      setSuccess("Cleanup schedule created.");
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create cleanup schedule.");
    } finally {
      setSaving(false);
    }
  };

  const submitWeightSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const selectedFlockId = weightFlockId || scope.flockId;
      const selectedBatchId =
        weightBatchId ||
        scope.batchId ||
        filteredFlocks.find((flock) => flock.id === selectedFlockId)?.batch_id ||
        "";
      if (!selectedFlockId || !selectedBatchId) throw new Error("Select flock and batch for weight schedule.");

      const dueDate = parseText(formData.get("due_date"));
      const dueWeekNumber = Number(formData.get("due_week_number"));
      if (!dueDate || !Number.isFinite(dueWeekNumber) || dueWeekNumber < 0) {
        throw new Error("Due date and chick age week are required.");
      }

      const supabase = createClient();
      const db = supabase as any;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unable to verify your session.");
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) throw new Error("Organization context not found.");

      const { error: insertError } = await db.from("batch_weight_check_tasks").upsert({
        org_id: profile.org_id,
        batch_id: selectedBatchId,
        flock_id: selectedFlockId,
        template_row_id: null,
        due_week_number: dueWeekNumber,
        due_date: dueDate,
        status: "scheduled",
        created_by: user.id,
      }, { onConflict: "org_id,batch_id,flock_id,due_week_number" });
      if (insertError) throw new Error(insertError.message);

      setShowWeightModal(false);
      form.reset();
      setSuccess("Weight check scheduled.");
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule weight check.");
    } finally {
      setSaving(false);
    }
  };

  const saveWeightRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recordWeightModal.item?.flockId) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const db = supabase as any;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unable to verify your session.");
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) throw new Error("Organization context not found.");

      const averageWeight = Number(formData.get("average_weight_g"));
      if (!Number.isFinite(averageWeight) || averageWeight <= 0) throw new Error("Average weight is required.");

      const payload = {
        org_id: profile.org_id,
        flock_id: recordWeightModal.item.flockId,
        record_date: parseText(formData.get("record_date")) ?? recordWeightModal.item.date,
        sample_count: Number(formData.get("sample_count")) || null,
        average_weight_g: averageWeight,
        min_weight_g: Number(formData.get("min_weight_g")) || null,
        max_weight_g: Number(formData.get("max_weight_g")) || null,
        uniformity_pct: Number(formData.get("uniformity_pct")) || null,
      };

      const { data: weightRow, error: weightError } = recordWeightModal.item.weightRecordId
        ? await supabase.from("weight_records").update(payload).eq("id", recordWeightModal.item.weightRecordId).select("id").single()
        : await supabase.from("weight_records").insert(payload).select("id").single();
      if (weightError || !weightRow?.id) throw new Error(weightError?.message ?? "Failed to save weight record.");

      const { error: taskError } = await db
        .from("batch_weight_check_tasks")
        .update({ status: "completed", weight_record_id: weightRow.id })
        .eq("id", recordWeightModal.item.id);
      if (taskError) throw new Error(taskError.message);

      setRecordWeightModal({ open: false, item: null });
      form.reset();
      setSuccess("Weight sample recorded.");
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record weight sample.");
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

      if (item.type === "weight") {
        const db = supabase as any;
        if (status === "completed") {
          setRecordWeightModal({ open: true, item });
          setSaving(false);
          return;
        }
        const { error: taskError } = await db
          .from("batch_weight_check_tasks")
          .update({ status: "missed" })
          .eq("id", item.id);
        if (taskError) throw new Error(taskError.message);
        setSuccess("Weight check marked as missed.");
        await loadSchedules();
        return;
      }

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

  const openEditModal = (item: ScheduleItem) => {
    if (item.type === "weight") {
      setActionMenu({ open: false, item: null, top: 0, left: 0 });
      return;
    }
    if (item.type === "cleanup") {
      const parsed = parseCleanupReason(item.scheduleReason);
      setEditModal({
        open: true,
        item,
        farmId: item.farmId ?? "",
        houseId: item.houseId ?? "",
        flockId: item.flockId ?? "",
        date: item.date,
        cleanupType: parsed.cleanupType,
        notes: parsed.notes,
        vaccineName: "",
        dosage: "",
        route: "water",
      });
      return;
    }
    const parsed = parseVaccinationReason(item.scheduleReason);
    setEditModal({
      open: true,
      item,
      farmId: item.farmId ?? "",
      houseId: item.houseId ?? "",
      flockId: item.flockId ?? "",
      date: item.date,
      cleanupType: "",
      notes: "",
      vaccineName: parsed.vaccineName,
      dosage: parsed.dosage,
      route: parsed.route,
    });
  };

  const deleteSchedule = async (item: ScheduleItem) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unable to verify your session.");
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) throw new Error("Organization context not found.");

      if (item.type === "weight") {
        const db = supabase as any;
        const { error: delError } = await db.from("batch_weight_check_tasks").delete().eq("id", item.id);
        if (delError) throw new Error(delError.message);
        setSuccess("Weight check removed.");
        await loadSchedules();
        return;
      }

      if (item.type === "cleanup") {
        const { error: delError } = await supabase.from("biosecurity_checks").delete().eq("id", item.id);
        if (delError) throw new Error(delError.message);
      } else {
        const { error: delError } = await supabase.from("vaccination_events").delete().eq("id", item.id);
        if (delError) throw new Error(delError.message);
      }

      const { error: deleteTargetError } = await supabase
        .from("health_events")
        .delete()
        .eq("org_id", profile.org_id)
        .like("description", `SCHEDULE_TARGET|${item.id}|%`);
      if (deleteTargetError) throw new Error(deleteTargetError.message);
      const { error: deleteStatusError } = await supabase
        .from("health_events")
        .delete()
        .eq("org_id", profile.org_id)
        .like("description", `SCHEDULE_STATUS|${item.id}|%`);
      if (deleteStatusError) throw new Error(deleteStatusError.message);

      setSuccess("Schedule removed.");
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove schedule.");
    } finally {
      setSaving(false);
    }
  };

  const saveScheduleEdit = async () => {
    if (!editModal.item) return;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Unable to verify your session.");
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) throw new Error("Organization context not found.");

      if (!editModal.date) throw new Error("Date is required.");
      if (!editModal.farmId) throw new Error("Farm is required.");
      if (editModal.item.type === "vaccination" && (!editModal.houseId || !editModal.flockId)) {
        throw new Error("House and flock are required for vaccination.");
      }

      if (editModal.item.type === "cleanup") {
        if (!editModal.cleanupType.trim()) throw new Error("Cleanup type is required.");
        const scheduleNotes = `SCHEDULE|${editModal.cleanupType.trim()}${editModal.notes.trim() ? ` | ${editModal.notes.trim()}` : ""}`;
        const { error: updateError } = await supabase
          .from("biosecurity_checks")
          .update({ checklist_date: editModal.date, notes: scheduleNotes, farm_id: editModal.farmId })
          .eq("id", editModal.item.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        if (!editModal.vaccineName.trim() || !editModal.dosage.trim()) {
          throw new Error("Vaccine name and dosage are required.");
        }
        const { error: updateError } = await supabase
          .from("vaccination_events")
          .update({
            event_date: editModal.date,
            flock_id: editModal.flockId,
            vaccine_name: editModal.vaccineName.trim(),
            dosage: editModal.dosage.trim(),
            route: editModal.route,
          })
          .eq("id", editModal.item.id);
        if (updateError) throw new Error(updateError.message);
      }

      const targetDescription = `SCHEDULE_TARGET|${editModal.item.id}|${editModal.farmId}|${editModal.houseId || ""}|${editModal.flockId || ""}`;
      const targetUpdate: { event_date: string; description: string; flock_id?: string } = {
        event_date: editModal.date,
        description: targetDescription,
      };
      if (editModal.flockId) targetUpdate.flock_id = editModal.flockId;
      const { error: targetUpdateError } = await supabase
        .from("health_events")
        .update(targetUpdate)
        .eq("org_id", profile.org_id)
        .like("description", `SCHEDULE_TARGET|${editModal.item.id}|%`);
      if (targetUpdateError) throw new Error(targetUpdateError.message);
      const statusUpdate: { event_date: string; flock_id?: string } = { event_date: editModal.date };
      if (editModal.flockId) statusUpdate.flock_id = editModal.flockId;
      const { error: statusUpdateError } = await supabase
        .from("health_events")
        .update(statusUpdate)
        .eq("org_id", profile.org_id)
        .like("description", `SCHEDULE_STATUS|${editModal.item.id}|%`);
      if (statusUpdateError) throw new Error(statusUpdateError.message);

      setEditModal({
        open: false,
        item: null,
        farmId: "",
        houseId: "",
        flockId: "",
        date: "",
        cleanupType: "",
        notes: "",
        vaccineName: "",
        dosage: "",
        route: "water",
      });
      setSuccess("Schedule updated.");
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update schedule.");
    } finally {
      setSaving(false);
    }
  };

  const healthFilteredSchedules = useMemo(() => {
    return schedules.filter((item) => {
      if (scope.farmId && item.farmId !== scope.farmId) return false;
      if (scope.houseId && item.houseId !== scope.houseId) return false;
      if (scope.flockId && item.flockId !== scope.flockId) return false;
      if (healthFarmId && item.farmId !== healthFarmId) return false;
      if (healthHouseId && item.houseId !== healthHouseId) return false;
      if (healthFlockId && item.flockId !== healthFlockId) return false;
      return true;
    });
  }, [schedules, scope.farmId, scope.houseId, scope.flockId, healthFarmId, healthHouseId, healthFlockId]);

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
            onClick={() => setShowWeightModal(true)}
          >
            Schedule weight check
          </button>
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
                  <td colSpan={8} className="px-2 py-4 text-forest-600">Loading schedules...</td>
                </tr>
              ) : healthFilteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-forest-600">No schedules found.</td>
                </tr>
              ) : (
                healthFilteredSchedules.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="border-b border-sand-100">
                    <td className="px-2 py-2">{item.date}</td>
                    <td className="px-2 py-2 capitalize">{item.type}</td>
                    <td className="px-2 py-2">
                      {item.farmId ? (farmNameById.get(item.farmId) ?? flockById.get(item.flockId ?? "")?.farm_id ?? item.farmId) : "-"}
                    </td>
                    <td className="px-2 py-2">
                      {item.houseId ? (houseNameById.get(item.houseId) ?? flockById.get(item.flockId ?? "")?.house_id ?? item.houseId) : "-"}
                    </td>
                    <td className="px-2 py-2">{item.flockId ? (flockCodeById.get(item.flockId) ?? item.flockId) : "-"}</td>
                    <td className="px-2 py-2">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium capitalize ${badgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-2 py-2">{item.reason ?? item.scheduleReason ?? "-"}</td>
                    <td className="px-2 py-2">
                      <div className="relative flex gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-leaf-500/40 px-2 py-1 text-xs text-leaf-600 disabled:opacity-50"
                          disabled={saving || (item.status === "completed" && item.type !== "weight")}
                          onClick={() => void markSchedule(item, "completed")}
                        >
                          {item.type === "weight" ? "Record" : "✓"}
                        </button>
                        {item.status !== "completed" ? (
                          <>
                            <button
                              type="button"
                              className="rounded-full border border-ember-500/40 px-2 py-1 text-xs text-ember-600 disabled:opacity-50"
                              disabled={saving || item.status === "missed"}
                              onClick={() => setMissModal({ open: true, item })}
                            >
                              ✕
                            </button>
                            <button
                              type="button"
                              className="rounded-full border border-sand-300 px-2 py-1 text-xs text-forest-700"
                              onClick={(e) => {
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                const isSameItemOpen = actionMenu.open && actionMenu.item?.id === item.id;
                                if (isSameItemOpen) {
                                  setActionMenu({ open: false, item: null, top: 0, left: 0 });
                                  return;
                                }
                                setActionMenu({
                                  open: true,
                                  item,
                                  top: rect.bottom + 6,
                                  left: rect.right - 140,
                                });
                              }}
                            >
                              ⋯
                            </button>
                          </>
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

      {showWeightModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-forest-900">Schedule Weight Check</h4>
              <button type="button" className="text-sm text-forest-600" onClick={() => setShowWeightModal(false)}>
                Close
              </button>
            </div>
            <form className="mt-4 grid gap-3" onSubmit={submitWeightSchedule}>
              <select
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={weightFarmId}
                onChange={(e) => {
                  setWeightFarmId(e.target.value);
                  setWeightHouseId("");
                  setWeightFlockId("");
                  setWeightBatchId("");
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
                value={weightHouseId}
                onChange={(e) => {
                  setWeightHouseId(e.target.value);
                  setWeightFlockId("");
                  setWeightBatchId("");
                }}
                required
              >
                <option value="">Select house</option>
                {filteredHouses
                  .filter((h) => !weightFarmId || h.farm_id === weightFarmId)
                  .map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
              </select>
              <select
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={weightFlockId}
                onChange={(e) => {
                  const nextFlockId = e.target.value;
                  setWeightFlockId(nextFlockId);
                  setWeightBatchId(filteredFlocks.find((flock) => flock.id === nextFlockId)?.batch_id ?? "");
                }}
                required
              >
                <option value="">Select flock</option>
                {filteredFlocks
                  .filter((f) => (!weightFarmId || f.farm_id === weightFarmId) && (!weightHouseId || f.house_id === weightHouseId))
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.flock_code}</option>
                  ))}
              </select>
              <select
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={weightBatchId}
                onChange={(e) => setWeightBatchId(e.target.value)}
                required
              >
                <option value="">Select batch</option>
                {batches
                  .filter((batch) => !weightFlockId || filteredFlocks.some((flock) => flock.id === weightFlockId && flock.batch_id === batch.id))
                  .map((batch) => (
                    <option key={batch.id} value={batch.id}>{batch.batch_code}</option>
                  ))}
              </select>
              <input name="due_date" type="date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              <input name="due_week_number" type="number" min={0} required placeholder="Chick age week" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              <button type="submit" disabled={saving} className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60">
                {saving ? "Saving..." : "Schedule Weight Check"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

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
              <select
                name="route"
                required
                defaultValue=""
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
              >
                <option value="" disabled>Select route</option>
                <option value="water">Water</option>
                <option value="injection">Injection</option>
                <option value="spray">Spray</option>
                <option value="eye_drop">Eye Drop</option>
              </select>
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

      {actionMenu.open && actionMenu.item ? (
        <div
          ref={actionMenuRef}
          className="fixed z-[70] min-w-36 rounded-xl border border-sand-200 bg-white p-1 shadow-lg"
          style={{ top: actionMenu.top, left: Math.max(12, actionMenu.left) }}
        >
          {actionMenu.item.type !== "weight" ? (
            <button
              type="button"
              className="block w-full rounded-lg px-3 py-2 text-left text-xs text-forest-700 hover:bg-sand-50"
              onClick={() => {
                const selected = actionMenu.item;
                setActionMenu({ open: false, item: null, top: 0, left: 0 });
                if (selected) openEditModal(selected);
              }}
            >
              Edit
            </button>
          ) : null}
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-xs text-ember-600 hover:bg-ember-50"
            onClick={() => {
              const selected = actionMenu.item;
              setActionMenu({ open: false, item: null, top: 0, left: 0 });
              setRemoveModal({ open: true, item: selected });
            }}
          >
            Remove
          </button>
        </div>
      ) : null}

      {recordWeightModal.open && recordWeightModal.item ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-forest-900">Record Sample Weight</h4>
                <p className="text-sm text-forest-600">
                  {recordWeightModal.item.scheduleReason} / {recordWeightModal.item.date}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-forest-600"
                onClick={() => setRecordWeightModal({ open: false, item: null })}
              >
                Close
              </button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveWeightRecord}>
              <label className="grid gap-1 text-sm text-forest-700">
                Record date
                <input name="record_date" type="date" defaultValue={recordWeightModal.item.date} required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Sample count
                <input name="sample_count" type="number" min={1} placeholder="Birds sampled" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Average weight (g)
                <input name="average_weight_g" type="number" min={0.01} step="0.01" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Min weight (g)
                <input name="min_weight_g" type="number" min={0} step="0.01" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Max weight (g)
                <input name="max_weight_g" type="number" min={0} step="0.01" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                Uniformity %
                <input name="uniformity_pct" type="number" min={0} max={100} step="0.01" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <button type="submit" disabled={saving} className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60 md:col-span-2">
                {saving ? "Saving..." : "Save Weight Sample"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {removeModal.open && removeModal.item ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h4 className="text-lg font-semibold text-forest-900">Remove Schedule</h4>
            <p className="mt-2 text-sm text-forest-700">
              Are you sure you want to remove this {removeModal.item.type} schedule? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
                onClick={() => setRemoveModal({ open: false, item: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-ember-500 px-4 py-2 text-sm text-white disabled:opacity-60"
                disabled={saving}
                onClick={async () => {
                  if (!removeModal.item) return;
                  const target = removeModal.item;
                  setRemoveModal({ open: false, item: null });
                  await deleteSchedule(target);
                }}
              >
                {saving ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editModal.open && editModal.item ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-forest-900">Edit Schedule</h4>
              <button
                type="button"
                className="text-sm text-forest-600"
                onClick={() =>
                  setEditModal({
                    open: false,
                    item: null,
                    farmId: "",
                    houseId: "",
                    flockId: "",
                    date: "",
                    cleanupType: "",
                    notes: "",
                    vaccineName: "",
                    dosage: "",
                    route: "water",
                  })
                }
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <select
                value={editModal.farmId}
                onChange={(e) =>
                  setEditModal((prev) => ({ ...prev, farmId: e.target.value, houseId: "", flockId: "" }))
                }
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
              >
                <option value="">Select farm</option>
                {filteredFarms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select
                value={editModal.houseId}
                onChange={(e) => setEditModal((prev) => ({ ...prev, houseId: e.target.value, flockId: "" }))}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
              >
                <option value="">Select house {editModal.item.type === "cleanup" ? "(optional)" : ""}</option>
                {filteredHouses
                  .filter((h) => !editModal.farmId || h.farm_id === editModal.farmId)
                  .map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
              </select>
              <select
                value={editModal.flockId}
                onChange={(e) => setEditModal((prev) => ({ ...prev, flockId: e.target.value }))}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
              >
                <option value="">Select flock {editModal.item.type === "cleanup" ? "(optional)" : ""}</option>
                {filteredFlocks
                  .filter((f) => (!editModal.farmId || f.farm_id === editModal.farmId) && (!editModal.houseId || f.house_id === editModal.houseId))
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.flock_code}</option>
                  ))}
              </select>
              <input
                type="date"
                value={editModal.date}
                onChange={(e) => setEditModal((prev) => ({ ...prev, date: e.target.value }))}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
              />
              {editModal.item.type === "cleanup" ? (
                <>
                  <input
                    value={editModal.cleanupType}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, cleanupType: e.target.value }))}
                    placeholder="Cleanup type"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  />
                  <textarea
                    value={editModal.notes}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notes"
                    className="min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm"
                  />
                </>
              ) : (
                <>
                  <input
                    value={editModal.vaccineName}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, vaccineName: e.target.value }))}
                    placeholder="Vaccine name"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  />
                  <input
                    value={editModal.dosage}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, dosage: e.target.value }))}
                    placeholder="Dosage"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  />
                  <select
                    value={editModal.route}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, route: e.target.value as EditScheduleState["route"] }))}
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  >
                    <option value="water">Water</option>
                    <option value="injection">Injection</option>
                    <option value="spray">Spray</option>
                    <option value="eye_drop">Eye Drop</option>
                  </select>
                </>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
                onClick={() =>
                  setEditModal({
                    open: false,
                    item: null,
                    farmId: "",
                    houseId: "",
                    flockId: "",
                    date: "",
                    cleanupType: "",
                    notes: "",
                    vaccineName: "",
                    dosage: "",
                    route: "water",
                  })
                }
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60"
                disabled={saving}
                onClick={saveScheduleEdit}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
