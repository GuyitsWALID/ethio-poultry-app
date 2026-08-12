"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Ellipsis,
  Eraser,
  HeartPulse,
  RefreshCw,
  Scale,
  ShieldCheck,
  Stethoscope,
  Syringe,
  X,
} from "lucide-react";

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

const addisToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const addDays = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const formatDate = (date: string, includeYear = false) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: includeYear ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

const scheduleTypeLabel = (type: ScheduleItem["type"]) => type === "vaccination" ? "Vaccination" : type === "cleanup" ? "Biosecurity" : "Weight check";

const ScheduleTypeIcon = ({ type, className = "h-4 w-4" }: { type: ScheduleItem["type"]; className?: string }) => {
  const Icon = type === "vaccination" ? Syringe : type === "cleanup" ? Eraser : Scale;
  return <Icon className={className} aria-hidden="true" />;
};

export default function HealthPage() {
  const { scope, filteredFarms, filteredHouses, filteredFlocks, batches } = useFarmScope();
  const [healthFarmId, setHealthFarmId] = useState("");
  const [healthHouseId, setHealthHouseId] = useState("");
  const [healthFlockId, setHealthFlockId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ScheduleItem["status"]>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | ScheduleItem["type"]>("all");
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
  const [showEvidenceModal,setShowEvidenceModal]=useState(false);
  const [currentRole,setCurrentRole]=useState<string|null>(null);
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
  const canOperate=currentRole==="farm_manager"||currentRole==="support";
  useEffect(()=>{void fetch("/api/me/context",{cache:"no-store"}).then(response=>response.ok?response.json():null).then(data=>setCurrentRole(data?.supportSessionId?"support":data?.role??null))},[]);

  const submitHealthEvidence=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setSaving(true);setError(null);const form=new FormData(event.currentTarget);const payload=Object.fromEntries(form.entries());const response=await fetch("/api/health/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const body=await response.json();setSaving(false);if(!response.ok){setError(body.error??"Health evidence could not be recorded.");return}setShowEvidenceModal(false);setSuccess("Health evidence recorded with its veterinarian recommendation and implementation status.");await loadSchedules()};
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
      const reason=window.prompt("Enter the reason for voiding this schedule record:")?.trim();if(!reason)return;const table=item.type==="weight"?"batch_weight_check_tasks":item.type==="cleanup"?"biosecurity_checks":"vaccination_events";const response=await fetch("/api/governance/void",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({table,id:item.id,reason})});const payload=await response.json();if(!response.ok)throw new Error(payload.error??"Unable to void schedule.");
      setSuccess("Schedule voided; the original record remains auditable.");
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
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      return true;
    });
  }, [schedules, scope.farmId, scope.houseId, scope.flockId, healthFarmId, healthHouseId, healthFlockId, statusFilter, typeFilter]);

  const healthSummary = useMemo(() => {
    const today = addisToday();
    const nextSeven = addDays(today, 7);
    const scoped = schedules.filter((item) => {
      if (scope.farmId && item.farmId !== scope.farmId) return false;
      if (scope.houseId && item.houseId !== scope.houseId) return false;
      if (scope.flockId && item.flockId !== scope.flockId) return false;
      if (healthFarmId && item.farmId !== healthFarmId) return false;
      if (healthHouseId && item.houseId !== healthHouseId) return false;
      if (healthFlockId && item.flockId !== healthFlockId) return false;
      return true;
    });
    const resolved = scoped.filter((item) => item.status === "completed" || item.status === "missed");
    return {
      total: scoped.length,
      overdue: scoped.filter((item) => item.status === "overdue").length,
      dueSeven: scoped.filter((item) => item.status === "scheduled" && item.date >= today && item.date <= nextSeven).length,
      completed: scoped.filter((item) => item.status === "completed").length,
      missed: scoped.filter((item) => item.status === "missed").length,
      completionPct: resolved.length ? (scoped.filter((item) => item.status === "completed").length / resolved.length) * 100 : null,
      untargeted: scoped.filter((item) => !item.farmId || (item.type === "vaccination" && !item.flockId)).length,
      scoped,
    };
  }, [healthFarmId, healthFlockId, healthHouseId, schedules, scope.farmId, scope.flockId, scope.houseId]);

  const runway = useMemo(() => {
    const today = addisToday();
    return Array.from({ length: 14 }, (_, index) => {
      const date = addDays(today, index);
      return { date, items: healthSummary.scoped.filter((item) => item.date === date && item.status !== "completed" && item.status !== "missed") };
    });
  }, [healthSummary.scoped]);

  const priorityItems = useMemo(() => {
    const today = addisToday();
    const nextSeven = addDays(today, 7);
    const rank: Record<ScheduleItem["status"], number> = { overdue: 0, missed: 1, scheduled: 2, completed: 3 };
    return healthSummary.scoped
      .filter((item) => item.status === "overdue" || item.status === "missed" || (item.status === "scheduled" && item.date <= nextSeven))
      .sort((a, b) => rank[a.status] - rank[b.status] || a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [healthSummary.scoped]);

  const badgeClass = (status: ScheduleItem["status"]) => {
    if (status === "completed") return "bg-leaf-500/15 text-leaf-500 border border-leaf-500/30";
    if (status === "missed") return "bg-ember-500/15 text-ember-500 border border-ember-500/30";
    if (status === "overdue") return "bg-amber-500/15 text-amber-700 border border-amber-500/30";
    return "bg-amber-500/10 text-amber-700 border border-amber-500/20";
  };

  const targetLabel = (item: ScheduleItem) => ({
    farm: item.farmId ? farmNameById.get(item.farmId) ?? "Assigned farm" : "Farm-wide",
    house: item.houseId ? houseNameById.get(item.houseId) ?? "Assigned house" : "All houses",
    flock: item.flockId ? flockCodeById.get(item.flockId) ?? "Assigned flock" : "All flocks",
  });

  const openActionMenu = (event: React.MouseEvent<HTMLButtonElement>, item: ScheduleItem) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const isSameItemOpen = actionMenu.open && actionMenu.item?.id === item.id;
    setActionMenu(isSameItemOpen ? { open: false, item: null, top: 0, left: 0 } : { open: true, item, top: rect.bottom + 6, left: rect.right - 160 });
  };

  const scheduleActions = (item: ScheduleItem) => !canOperate?<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-forest-500"><ShieldCheck className="h-3.5 w-3.5"/>View only</span>:(
    <div className="flex items-center gap-2">
      <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-leaf-500/35 px-3 text-[11px] font-semibold text-forest-700 transition hover:bg-leaf-500/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={saving || (item.status === "completed" && item.type !== "weight")} onClick={() => void markSchedule(item, "completed")}>
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{item.type === "weight" ? "Record" : "Complete"}
      </button>
      {item.status !== "completed" ? <>
        <button type="button" aria-label={`Mark ${scheduleTypeLabel(item.type)} missed`} className="grid h-9 w-9 place-items-center rounded-lg border border-ember-500/30 text-ember-500 transition hover:bg-ember-500/10 disabled:opacity-40" disabled={saving || item.status === "missed"} onClick={() => setMissModal({ open: true, item })}><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
        <button type="button" aria-label={`More actions for ${scheduleTypeLabel(item.type)}`} className="grid h-9 w-9 place-items-center rounded-lg border border-sand-200 text-forest-700 transition hover:border-forest-400 hover:bg-sand-50" onClick={(event) => openActionMenu(event, item)}><Ellipsis className="h-4 w-4" aria-hidden="true" /></button>
      </> : null}
    </div>
  );

  const filterClass = "h-11 min-w-0 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20";

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-5">
      <header className="relative overflow-hidden rounded-3xl border border-forest-700 bg-forest-900 p-5 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[42px] border-leaf-500/10" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-amber-300"><HeartPulse className="h-4 w-4" aria-hidden="true" />Flock health protection desk</div><h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">Keep every preventive action on the runway</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100">Plan vaccination, biosecurity and weight checks in one clinical operations view. Overdue work rises first, upcoming work stays visible, and every completion leaves an auditable flock record.</p></div>
          {canOperate?<div className="grid gap-2 sm:grid-cols-2 xl:min-w-[600px] xl:grid-cols-4">
            <button type="button" onClick={() => setShowEvidenceModal(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-semibold text-forest-950 transition hover:bg-amber-300"><Stethoscope className="h-4 w-4" aria-hidden="true" />Health evidence</button>
            <button type="button" onClick={() => setShowVaccineModal(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sand-50 px-4 text-xs font-semibold text-forest-900 transition hover:bg-white"><Syringe className="h-4 w-4" aria-hidden="true" />Vaccination</button>
            <button type="button" onClick={() => setShowCleanupModal(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[.07] px-4 text-xs font-semibold text-white transition hover:bg-white/15"><Eraser className="h-4 w-4" aria-hidden="true" />Biosecurity</button>
            <button type="button" onClick={() => setShowWeightModal(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[.07] px-4 text-xs font-semibold text-white transition hover:bg-white/15"><Scale className="h-4 w-4" aria-hidden="true" />Weight check</button>
          </div>:<div className="rounded-xl border border-white/20 bg-white/[.07] px-4 py-3 text-sm text-sand-100"><ShieldCheck className="mb-2 h-5 w-5 text-amber-300"/>Executive evidence view. Operational entry remains with assigned Farm Managers.</div>}
        </div>
      </header>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-500"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Health schedule needs attention</p><p className="mt-1">{error}</p></div></div> : null}
      {success ? <div role="status" className="flex items-start gap-3 rounded-2xl border border-leaf-500/30 bg-leaf-500/10 p-4 text-sm text-forest-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-500" aria-hidden="true" /><p>{success}</p></div> : null}

      <section className="grid overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-6">
        <article className="border-b border-sand-200 p-4 sm:border-r xl:border-b-0"><ClipboardCheck className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">Schedules in scope</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.total}</p><p className="mt-1 text-[11px] text-forest-600">Across all loaded health work</p></article>
        <article className="border-b border-sand-200 p-4 xl:border-b-0 xl:border-r"><AlertTriangle className="h-4 w-4 text-ember-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">Overdue</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.overdue}</p><p className="mt-1 text-[11px] text-forest-600">Requires immediate disposition</p></article>
        <article className="border-b border-sand-200 p-4 sm:border-r xl:border-b-0"><CalendarCheck2 className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">Due next 7 days</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.dueSeven}</p><p className="mt-1 text-[11px] text-forest-600">Scheduled preventive work</p></article>
        <article className="border-b border-sand-200 p-4 xl:border-b-0 xl:border-r"><CheckCircle2 className="h-4 w-4 text-leaf-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">Completed</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.completed}</p><p className="mt-1 text-[11px] text-forest-600">Documented in loaded history</p></article>
        <article className="border-b border-sand-200 p-4 sm:border-b-0 sm:border-r"><ShieldCheck className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">Completion quality</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.completionPct === null ? "Unavailable" : `${healthSummary.completionPct.toFixed(0)}%`}</p><p className="mt-1 text-[11px] text-forest-600">Completed among resolved work</p></article>
        <article className="p-4"><AlertTriangle className={`h-4 w-4 ${healthSummary.untargeted ? "text-amber-500" : "text-leaf-500"}`} aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">Target gaps</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.untargeted}</p><p className="mt-1 text-[11px] text-forest-600">Work missing required farm/flock context</p></article>
      </section>

      <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Forward schedule</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">14-day health runway</h2><p className="mt-1 text-xs text-forest-600">Each lane is one Addis Ababa calendar day. Scroll inside this card to inspect the full runway.</p></div><div className="flex flex-wrap gap-3 text-[10px] text-forest-600"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-leaf-500" />Vaccination</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />Biosecurity</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />Weight</span></div></div>
        <div className="mt-5 max-w-full overflow-x-auto pb-2"><div className="grid min-w-[1260px] grid-cols-14 gap-2">{runway.map((day, index) => <article key={day.date} className={`min-h-36 rounded-xl border p-3 ${index === 0 ? "border-forest-700 bg-forest-900 text-white" : day.items.length ? "border-sand-300 bg-sand-50" : "border-sand-200 bg-white"}`}><p className={`text-[9px] font-semibold uppercase tracking-[.12em] ${index === 0 ? "text-amber-300" : "text-forest-500"}`}>{index === 0 ? "Today" : new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day.date}T00:00:00Z`))}</p><p className={`mt-1 font-display text-lg font-semibold ${index === 0 ? "text-white" : "text-forest-900"}`}>{formatDate(day.date)}</p><div className="mt-4 space-y-2">{day.items.slice(0, 3).map((item) => <div key={`${item.type}-${item.id}`} title={item.scheduleReason ?? scheduleTypeLabel(item.type)} className={`flex items-center gap-1.5 text-[10px] ${index === 0 ? "text-sand-100" : "text-forest-700"}`}><span className={`h-2 w-2 shrink-0 rounded-full ${item.type === "vaccination" ? "bg-leaf-500" : item.type === "cleanup" ? "bg-amber-500" : "bg-sky-500"}`} /><span className="truncate">{item.flockId ? flockCodeById.get(item.flockId) ?? scheduleTypeLabel(item.type) : scheduleTypeLabel(item.type)}</span></div>)}{day.items.length === 0 ? <p className={`text-[10px] ${index === 0 ? "text-sand-300" : "text-forest-400"}`}>No work</p> : null}{day.items.length > 3 ? <p className="text-[10px] font-semibold text-forest-500">+{day.items.length - 3} more</p> : null}</div></article>)}</div></div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-2xl border border-sand-200 bg-sand-50 p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Clinical priority</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Needs action</h2></div><span className="rounded-full bg-forest-900 px-2.5 py-1 text-xs font-semibold text-white">{priorityItems.length}</span></div><div className="mt-4 grid gap-3">{priorityItems.map((item) => { const target = targetLabel(item); return <article key={`priority-${item.type}-${item.id}`} className="rounded-xl border border-sand-200 bg-white p-4"><div className="flex items-start gap-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.status === "overdue" || item.status === "missed" ? "bg-ember-500/10 text-ember-500" : "bg-leaf-500/10 text-forest-700"}`}><ScheduleTypeIcon type={item.type} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-forest-900">{item.scheduleReason ?? scheduleTypeLabel(item.type)}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${badgeClass(item.status)}`}>{item.status}</span></div><p className="mt-1 text-[11px] text-forest-500">{formatDate(item.date, true)} · {target.farm} · {target.flock}</p></div></div><div className="mt-3 border-t border-sand-100 pt-3">{scheduleActions(item)}</div></article>; })}{!loading && priorityItems.length === 0 ? <div className="rounded-xl border border-dashed border-sand-300 bg-white p-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-leaf-500" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-forest-900">No immediate health exceptions</p><p className="mt-1 text-xs text-forest-600">The next seven days are clear in this scope.</p></div> : null}</div></section>

        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Protection mix</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Workload by intervention</h2></div><ShieldCheck className="h-5 w-5 text-forest-500" aria-hidden="true" /></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{(["vaccination", "cleanup", "weight"] as const).map((type) => { const count = healthSummary.scoped.filter((item) => item.type === type).length; const openCount = healthSummary.scoped.filter((item) => item.type === type && (item.status === "scheduled" || item.status === "overdue")).length; return <button key={type} type="button" onClick={() => setTypeFilter(typeFilter === type ? "all" : type)} aria-pressed={typeFilter === type} className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-forest-500 ${typeFilter === type ? "border-forest-700 bg-forest-900 text-white" : "border-sand-200 bg-sand-50 text-forest-900 hover:border-forest-400"}`}><ScheduleTypeIcon type={type} className={`h-5 w-5 ${typeFilter === type ? "text-amber-300" : "text-forest-500"}`} /><p className={`mt-4 text-[10px] font-semibold uppercase tracking-[.12em] ${typeFilter === type ? "text-sand-200" : "text-forest-500"}`}>{scheduleTypeLabel(type)}</p><p className="mt-1 font-display text-2xl font-semibold">{count}</p><p className={`mt-1 text-[11px] ${typeFilter === type ? "text-sand-200" : "text-forest-600"}`}>{openCount} open</p></button>; })}</div><div className="mt-5 rounded-xl border border-sand-200 p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-forest-900">Resolved-work completion</span><span className="text-sm font-semibold text-forest-900">{healthSummary.completionPct === null ? "Unavailable" : `${healthSummary.completionPct.toFixed(0)}%`}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-100"><div className="h-full rounded-full bg-leaf-500" style={{ width: `${Math.min(100, healthSummary.completionPct ?? 0)}%` }} /></div><p className="mt-2 text-[11px] leading-4 text-forest-600">Missed work remains visible so the rate reflects execution quality rather than only planned volume.</p></div></section>
      </div>

      <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="border-b border-sand-200 p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Schedule register</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Health work ledger</h2><p className="mt-1 text-xs text-forest-600">Filter by operating location, intervention, or execution status.</p></div><button type="button" onClick={() => void loadSchedules()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-sand-200 px-4 text-xs font-semibold text-forest-700 hover:border-forest-400 hover:bg-sand-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</button></div>
          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">Farm<select className={filterClass} value={healthFarmId} onChange={(event) => { setHealthFarmId(event.target.value); setHealthHouseId(""); setHealthFlockId(""); }}><option value="">All farms</option>{filteredFarms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">House<select className={filterClass} value={healthHouseId} onChange={(event) => { setHealthHouseId(event.target.value); setHealthFlockId(""); }}><option value="">All houses</option>{filteredHouses.filter((item) => !healthFarmId || item.farm_id === healthFarmId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">Flock<select className={filterClass} value={healthFlockId} onChange={(event) => setHealthFlockId(event.target.value)}><option value="">All flocks</option>{filteredFlocks.filter((item) => (!healthFarmId || item.farm_id === healthFarmId) && (!healthHouseId || item.house_id === healthHouseId)).map((item) => <option key={item.id} value={item.id}>{item.flock_code}</option>)}</select></label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">Intervention<select className={filterClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | ScheduleItem["type"])}><option value="all">All interventions</option><option value="vaccination">Vaccination</option><option value="cleanup">Biosecurity</option><option value="weight">Weight check</option></select></label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">Status<select className={filterClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ScheduleItem["status"])}><option value="all">All statuses</option><option value="overdue">Overdue</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="missed">Missed</option></select></label>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:hidden">{loading ? <div className="h-36 animate-pulse rounded-xl bg-sand-100" /> : healthFilteredSchedules.map((item) => { const target = targetLabel(item); return <article key={`mobile-${item.type}-${item.id}`} className="rounded-2xl border border-sand-200 p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand-50 text-forest-600"><ScheduleTypeIcon type={item.type} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-forest-900">{item.scheduleReason ?? scheduleTypeLabel(item.type)}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${badgeClass(item.status)}`}>{item.status}</span></div><p className="mt-1 text-xs text-forest-500">{formatDate(item.date, true)} · {target.farm}</p><p className="mt-1 text-[11px] text-forest-500">{target.house} · {target.flock}</p></div></div>{item.reason ? <p className="mt-3 rounded-xl bg-sand-50 p-3 text-xs leading-5 text-forest-600">{item.reason}</p> : null}<div className="mt-4 border-t border-sand-100 pt-3">{scheduleActions(item)}</div></article>; })}{!loading && healthFilteredSchedules.length === 0 ? <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 p-8 text-center"><CalendarCheck2 className="mx-auto h-6 w-6 text-forest-400" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-forest-900">No health work matches these filters</p><p className="mt-1 text-xs text-forest-600">Broaden the scope or schedule the next intervention.</p></div> : null}</div>

        <div className="hidden max-w-full overflow-x-auto md:block"><table className="min-w-[1120px] w-full text-left text-sm"><thead><tr className="border-b border-sand-200 bg-sand-50 text-[10px] uppercase tracking-[.12em] text-forest-500"><th className="px-5 py-3">Due date</th><th className="px-4 py-3">Intervention</th><th className="px-4 py-3">Farm / house</th><th className="px-4 py-3">Flock</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Clinical context</th><th className="px-5 py-3">Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="px-5 py-10 text-center text-forest-600">Loading the health work ledger…</td></tr> : healthFilteredSchedules.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center"><CalendarCheck2 className="mx-auto h-6 w-6 text-forest-400" aria-hidden="true" /><p className="mt-3 font-semibold text-forest-900">No health work matches these filters</p><p className="mt-1 text-xs text-forest-600">Broaden the scope or schedule the next intervention.</p></td></tr> : healthFilteredSchedules.map((item) => { const target = targetLabel(item); return <tr key={`${item.type}-${item.id}`} className="border-b border-sand-100 align-top last:border-0 hover:bg-sand-50/50"><td className="px-5 py-4"><p className="font-semibold text-forest-900">{formatDate(item.date, true)}</p><p className="mt-1 text-[11px] text-forest-500">{item.date === addisToday() ? "Due today" : item.date < addisToday() && item.status !== "completed" ? "Past due" : "Scheduled date"}</p></td><td className="px-4 py-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sand-50 text-forest-600"><ScheduleTypeIcon type={item.type} /></span><span className="font-medium text-forest-900">{scheduleTypeLabel(item.type)}</span></div></td><td className="px-4 py-4"><p className="text-forest-900">{target.farm}</p><p className="mt-1 text-[11px] text-forest-500">{target.house}</p></td><td className="px-4 py-4 font-medium text-forest-900">{target.flock}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.06em] ${badgeClass(item.status)}`}>{item.status}</span></td><td className="max-w-[330px] px-4 py-4"><p className="text-xs leading-5 text-forest-800">{item.scheduleReason ?? "No schedule description"}</p>{item.reason ? <p className="mt-1 text-[11px] leading-4 text-forest-500">Outcome: {item.reason}</p> : null}</td><td className="px-5 py-4">{scheduleActions(item)}</td></tr>; })}</tbody></table></div>
      </section>

      {showEvidenceModal ? <div className="fixed inset-0 z-[80] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="health-evidence-title" className="mx-auto my-4 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 bg-forest-900 p-5 text-white"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">Clinical evidence chain</p><h2 id="health-evidence-title" className="mt-1 font-display text-2xl font-semibold">Record health event and external guidance</h2><p className="mt-1 text-xs text-sand-200">The Farm Manager records the event; the consultant remains an external evidence source.</p></div><button type="button" aria-label="Close health evidence form" onClick={()=>setShowEvidenceModal(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15"><X className="h-4 w-4"/></button></div><form onSubmit={submitHealthEvidence} className="grid gap-4 p-5 md:grid-cols-2"><label className="grid gap-1 text-sm text-forest-700">Flock<select name="flock_id" required defaultValue={scope.flockId} className="h-11 rounded-xl border border-sand-200 px-3"><option value="">Select flock</option>{filteredFlocks.map(flock=><option key={flock.id} value={flock.id}>{flock.flock_code}</option>)}</select></label><label className="grid gap-1 text-sm text-forest-700">Event date<input name="event_date" type="date" required defaultValue={addisToday()} max={addisToday()} className="h-11 rounded-xl border border-sand-200 px-3"/></label><label className="grid gap-1 text-sm text-forest-700">Event type<select name="event_type" className="h-11 rounded-xl border border-sand-200 px-3"><option value="observation">Observation</option><option value="disease">Disease</option><option value="treatment">Treatment</option></select></label><label className="grid gap-1 text-sm text-forest-700">Diagnosis<input name="diagnosis" className="h-11 rounded-xl border border-sand-200 px-3"/></label><label className="grid gap-1 text-sm text-forest-700 md:col-span-2">Observed condition<textarea name="description" required className="min-h-20 rounded-xl border border-sand-200 p-3"/></label><label className="grid gap-1 text-sm text-forest-700 md:col-span-2">Action taken or decline reason<textarea name="treatment" className="min-h-20 rounded-xl border border-sand-200 p-3"/></label><fieldset className="grid gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 md:col-span-2 md:grid-cols-2"><legend className="px-2 text-sm font-semibold text-forest-900">External veterinary guidance · optional</legend><label className="grid gap-1 text-sm text-forest-700">Veterinarian name<input name="external_veterinarian_name" className="h-11 rounded-xl border border-sand-200 bg-white px-3"/></label><label className="grid gap-1 text-sm text-forest-700">Implementation status<select name="recommendation_status" className="h-11 rounded-xl border border-sand-200 bg-white px-3"><option value="">No external guidance</option><option value="received">Received</option><option value="planned">Planned</option><option value="implemented">Implemented</option><option value="declined">Declined</option></select></label><label className="grid gap-1 text-sm text-forest-700 md:col-span-2">Recommendation<textarea name="veterinarian_recommendation" className="min-h-20 rounded-xl border border-sand-200 bg-white p-3"/></label><label className="grid gap-1 text-sm text-forest-700">Reference<input name="veterinarian_reference" placeholder="Letter, case, or consultation reference" className="h-11 rounded-xl border border-sand-200 bg-white px-3"/></label><label className="grid gap-1 text-sm text-forest-700">Supporting document URL<input name="attachment_url" type="url" placeholder="https://…" className="h-11 rounded-xl border border-sand-200 bg-white px-3"/></label></fieldset><button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{saving?"Recording…":"Record health evidence"}</button></form></div></div>:null}

      {showWeightModal ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="weight-schedule-title" className="mx-auto my-4 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-forest-900 p-5 text-white"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300"><Scale className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-300">Growth surveillance</p><h4 id="weight-schedule-title" className="mt-1 font-display text-xl font-semibold">Schedule weight check</h4><p className="mt-1 text-xs text-sand-200">Assign one batch and flock to a defined age week.</p></div></div>
              <button type="button" aria-label="Close weight schedule" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-sand-100 hover:bg-white/10" onClick={() => setShowWeightModal(false)}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <form className="grid gap-3 p-5" onSubmit={submitWeightSchedule}>
              <select
                aria-label="Farm"
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
                aria-label="House"
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
                aria-label="Flock"
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
                aria-label="Batch"
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
              <label className="grid gap-1 text-xs font-medium text-forest-600">Due date<input name="due_date" type="date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">Age week<input name="due_week_number" type="number" min={0} required placeholder="Chick age week" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <button type="submit" disabled={saving} className="mt-2 min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 disabled:opacity-60">
                {saving ? "Saving..." : "Schedule Weight Check"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showVaccineModal ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="vaccine-schedule-title" className="mx-auto my-4 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-forest-900 p-5 text-white"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300"><Syringe className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-300">Preventive medicine</p><h4 id="vaccine-schedule-title" className="mt-1 font-display text-xl font-semibold">Schedule vaccination</h4><p className="mt-1 text-xs text-sand-200">Define the flock, product, dosage and administration route.</p></div></div>
              <button type="button" aria-label="Close vaccination schedule" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-sand-100 hover:bg-white/10" onClick={() => setShowVaccineModal(false)}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <form className="grid gap-3 p-5" onSubmit={submitVaccinationSchedule}>
              <select
                aria-label="Farm"
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
                aria-label="House"
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
                aria-label="Flock"
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
              <label className="grid gap-1 text-xs font-medium text-forest-600">Planned date<input name="planned_date" type="date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">Vaccine<input name="vaccine_name" placeholder="Vaccine name" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">Dosage<input name="dosage" placeholder="Dosage" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <select
                aria-label="Administration route"
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
              <button type="submit" disabled={saving} className="mt-2 min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 disabled:opacity-60">
                {saving ? "Saving..." : "Create Schedule"}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showCleanupModal ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="cleanup-schedule-title" className="mx-auto my-4 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-forest-900 p-5 text-white"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300"><Eraser className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-300">Biosecurity control</p><h4 id="cleanup-schedule-title" className="mt-1 font-display text-xl font-semibold">Schedule farm cleanup</h4><p className="mt-1 text-xs text-sand-200">Assign the cleaning work at farm, house or flock level.</p></div></div>
              <button type="button" aria-label="Close cleanup schedule" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-sand-100 hover:bg-white/10" onClick={() => setShowCleanupModal(false)}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <form className="grid gap-3 p-5" onSubmit={submitCleanupSchedule}>
              <select
                aria-label="Farm"
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
                aria-label="House"
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
                aria-label="Flock"
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
              <label className="grid gap-1 text-xs font-medium text-forest-600">Checklist date<input name="checklist_date" type="date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">Cleanup type<input name="cleanup_type" placeholder="Disinfection, litter removal…" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">Notes<textarea name="notes" placeholder="Optional execution notes" className="min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm" /></label>
              <button type="submit" disabled={saving} className="mt-2 min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 disabled:opacity-60">
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
