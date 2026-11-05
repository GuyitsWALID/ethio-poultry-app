"use client";

import {useLocale, useTranslations} from "next-intl";
import {formatOperationDate, formatHeaderDate} from "@/i18n/formats";

import {OperationDateInput} from "@/components/operation-date-input";
import { usePageFilter, ResetPageFilters } from "@/components/page-filter-controls";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
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
import {TodayEntryLink, useTodayEntryMode} from "@/components/today/today-entry-link";
import { governanceGuidanceUrl, type GovernanceGuidance } from "@/lib/governance-guidance";
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

type HealthInventoryItem={id:string;name:string;category:string;unit:string};
type HealthWarehouse={id:string;name:string};

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

const ScheduleTypeIcon = ({ type, className = "h-4 w-4" }: { type: ScheduleItem["type"]; className?: string }) => {
  const Icon = type === "vaccination" ? Syringe : type === "cleanup" ? Eraser : Scale;
  return <Icon className={className} aria-hidden="true" />;
};

export default function HealthPage() {
  const rest = useTranslations("OperationRemainder");
  const ui = useTranslations("OperationUI");
  const feedback = useTranslations("OperationFeedback");
  const chartText = useTranslations("OperationCharts");
async function saveHealthEvent(payload: Record<string, unknown>) {
  const response = await fetch("/api/health/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 423 && body.governance) {
    window.location.assign(governanceGuidanceUrl(body.governance as GovernanceGuidance));
    throw new Error(ui("openingAPrefilledGovernedChangeRequest"));
  }
  if (!response.ok) throw new Error(body.error ?? ui("healthEvidenceCouldNotBeSaved"));
  return body;
}

  const locale = useLocale();
  const formatDate = (date: string, includeYear = false) => includeYear ? formatOperationDate(`${date}T12:00:00Z`, locale) : formatHeaderDate(`${date}T12:00:00Z`, locale);
  const scheduleTypeLabel = (type: ScheduleItem["type"]) => ui((type === "vaccination" ? "vaccination" : type === "cleanup" ? "biosecurity" : "weightCheck") as Parameters<typeof ui>[0]);
  const { scope, filteredFarms, filteredHouses, filteredFlocks, batches } = useFarmScope();
  const {enabled: todayEntryEnabled, todayHref} = useTodayEntryMode();
  const [healthFarmId, setHealthFarmId] = usePageFilter<string>("healthFarmId", "");
  const [healthHouseId, setHealthHouseId] = usePageFilter<string>("healthHouseId", "");
  const [healthFlockId, setHealthFlockId] = usePageFilter<string>("healthFlockId", "");
  const [statusFilter, setStatusFilter] = usePageFilter<"all" | ScheduleItem["status"]>("statusFilter", "all");
  const [typeFilter, setTypeFilter] = usePageFilter<"all" | ScheduleItem["type"]>("typeFilter", "all");
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
  const [showTreatmentInventoryModal,setShowTreatmentInventoryModal]=useState(false);
  const [healthInventoryItems,setHealthInventoryItems]=useState<HealthInventoryItem[]>([]);
  const [healthWarehouses,setHealthWarehouses]=useState<HealthWarehouse[]>([]);
  const [vaccinationInventoryModal,setVaccinationInventoryModal]=useState<{open:boolean;item:ScheduleItem|null}>({open:false,item:null});
  const [vaccinationCompletionError,setVaccinationCompletionError]=useState<string|null>(null);
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
  const runwayRef = useRef<HTMLDivElement | null>(null);
  const [runwayCanScrollLeft, setRunwayCanScrollLeft] = useState(false);
  const [runwayCanScrollRight, setRunwayCanScrollRight] = useState(true);
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
  useEffect(()=>{void Promise.all([fetch("/api/inventory/catalog",{cache:"no-store"}),fetch("/api/inventory/warehouses",{cache:"no-store"})]).then(async([itemsResponse,warehousesResponse])=>{const items=itemsResponse.ok?await itemsResponse.json():{};const warehouses=warehousesResponse.ok?await warehousesResponse.json():{};setHealthInventoryItems((items.items??[]) as HealthInventoryItem[]);setHealthWarehouses((warehouses.warehouses??[]) as HealthWarehouse[])})},[]);

  const submitHealthEvidence=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setSaving(true);setError(null);const form=new FormData(event.currentTarget);const payload=Object.fromEntries(form.entries());const response=await fetch("/api/health/events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const body=await response.json();setSaving(false);if(!response.ok){setError(body.error??ui("healthEvidenceCouldNotBeRecorded"));return}setShowEvidenceModal(false);setSuccess(ui("healthEvidenceRecordedWithItsVeterinarianRecommendationAndImplementationStatus"));await loadSchedules()};
  const submitTreatmentInventory=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setSaving(true);setError(null);const form=new FormData(event.currentTarget);try{await saveHealthEvent({...Object.fromEntries(form.entries()),event_type:"treatment",quantity:Number(form.get("quantity"))});setShowTreatmentInventoryModal(false);setSuccess(ui("treatmentAndMedicineUsageSavedTogether"));await loadSchedules()}catch(cause){setError(cause instanceof Error?cause.message:ui("treatmentCouldNotBeRecorded"))}finally{setSaving(false)}};
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
    const [{ data: vaccineEvents }, { data: cleanupRows }, healthResponse, { data: weightTasks }] = await Promise.all([
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
      fetch("/api/health/events"),
      db
        .from("batch_weight_check_tasks")
        .select("id, batch_id, flock_id, due_week_number, due_date, status, weight_record_id")
        .eq("org_id", profile.org_id)
        .order("due_date", { ascending: false })
        .limit(200),
    ]);
    const healthPayload = healthResponse.ok ? await healthResponse.json() : { events: [] };
    const healthRows = healthPayload.events ?? [];

    const statusBySchedule = new Map<string, { status: "completed" | "missed"; reason: string | null }>();
    const targetBySchedule = new Map<string, { farmId: string | null; houseId: string | null; flockId: string | null }>();
    (healthRows ?? []).forEach((row: { description: string | null; diagnosis: string | null }) => {
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
        scheduleReason: c.notes?.startsWith("SCHEDULE|") ? c.notes.replace("SCHEDULE|", "").trim() : rest("cleanup"),
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
        scheduleReason: chartText("weekSample", {week: task.due_week_number}),
        status:
          task.status === "completed" || task.status === "missed"
            ? task.status
            : new Date(task.due_date) < new Date(new Date().toISOString().slice(0, 10))
              ? "overdue"
              : "scheduled",
        reason: task.weight_record_id ? rest("weightRecorded") : null,
      };
    });

    setSchedules([...vaccineSchedules, ...cleanupSchedules, ...weightSchedules].sort((a, b) => (a.date < b.date ? 1 : -1)));
    setLoading(false);
  };

  useEffect(() => {
    void loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

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
        throw new Error(ui("selectFarmHouseAndFlockInVaccinationModal"));
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(ui("unableToVerifyYourSession"));
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      if (!profile?.org_id) throw new Error(ui("organizationContextNotFound"));

      const plannedDate = parseText(formData.get("planned_date"));
      const vaccineName = parseText(formData.get("vaccine_name"));
      const dosage = parseText(formData.get("dosage"));
      const routeText = parseText(formData.get("route"));
      if (!plannedDate || !vaccineName || !dosage || !routeText) {
        throw new Error(ui("plannedDateVaccineNameDosageAndRouteAreRequired"));
      }
      const vaccineRoutes = ["water", "injection", "spray", "eye_drop"] as const;
      if (!vaccineRoutes.includes(routeText as (typeof vaccineRoutes)[number])) {
        throw new Error(ui("routeIsNotValid"));
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
        await saveHealthEvent({
          flock_id: selectedFlockId,
          event_date: plannedDate,
          event_type: "observation",
          description: `SCHEDULE_TARGET|${newVaccine.id}|${selectedFarmId}|${selectedHouseId}|${selectedFlockId}`,
        });
      }

      setShowVaccineModal(false);
      form.reset();
      setSuccess(rest("vaccinationCreated"));
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui("failedToCreateSchedule"));
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
      if (!selectedFarmId) throw new Error(ui("selectAFarmInCleanupModal"));
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(ui("unableToVerifyYourSession"));
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      if (!profile?.org_id) throw new Error(ui("organizationContextNotFound"));

      const date = parseText(formData.get("checklist_date"));
      const type = parseText(formData.get("cleanup_type"));
      if (!date || !type) throw new Error(ui("cleanupDateAndCleanupTypeAreRequired"));
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
        await saveHealthEvent({
          flock_id: targetFlockId,
          event_date: date,
          event_type: "observation",
          description: `SCHEDULE_TARGET|${newCleanup.id}|${selectedFarmId}|${cleanHouseId || ""}|${cleanFlockId || ""}`,
        });
      }

      setShowCleanupModal(false);
      form.reset();
      setSuccess(rest("cleanupCreated"));
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui("failedToCreateCleanupSchedule"));
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
      if (!selectedFlockId || !selectedBatchId) throw new Error(ui("selectFlockAndBatchForWeightSchedule"));

      const dueDate = parseText(formData.get("due_date"));
      const dueWeekNumber = Number(formData.get("due_week_number"));
      if (!dueDate || !Number.isFinite(dueWeekNumber) || dueWeekNumber < 0) {
        throw new Error(ui("dueDateAndChickAgeWeekAreRequired"));
      }

      const supabase = createClient();
      const db = supabase as any;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(ui("unableToVerifyYourSession"));
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) throw new Error(ui("organizationContextNotFound"));

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
      setSuccess(rest("weightScheduled"));
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui("failedToScheduleWeightCheck"));
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
      if (!user) throw new Error(ui("unableToVerifyYourSession"));
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) throw new Error(ui("organizationContextNotFound"));

      const averageWeight = Number(formData.get("average_weight_g"));
      if (!Number.isFinite(averageWeight) || averageWeight <= 0) throw new Error(ui("averageWeightIsRequired"));

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
      if (weightError || !weightRow?.id) throw new Error(weightError?.message ?? ui("failedToSaveWeightRecord"));

      const { error: taskError } = await db
        .from("batch_weight_check_tasks")
        .update({ status: "completed", weight_record_id: weightRow.id })
        .eq("id", recordWeightModal.item.id);
      if (taskError) throw new Error(taskError.message);

      setRecordWeightModal({ open: false, item: null });
      form.reset();
      setSuccess(rest("sampleSaved"));
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui("failedToRecordWeightSample"));
    } finally {
      setSaving(false);
    }
  };

  const markSchedule = async (item: ScheduleItem, status: "completed" | "missed", reason?: string) => {
    if (todayEntryEnabled && item.type === "vaccination" && status === "completed") {
      window.location.assign(todayHref("health_deaths", {flockId: item.flockId ?? undefined}));
      return;
    }
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error(ui("unableToVerifyYourSession"));
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", user.id)
        .single();
      if (!profile?.org_id) throw new Error(ui("organizationContextNotFound"));

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
        setSuccess(rest("weightMissed"));
        await loadSchedules();
        return;
      }

      if(item.type==="vaccination"&&status==="completed"){
        setVaccinationCompletionError(null);setVaccinationInventoryModal({open:true,item});setSaving(false);return;
      }

      if (item.type === "cleanup" && status === "completed") {
        const { error: upd } = await supabase
          .from("biosecurity_checks")
          .update({ completed_by: user.id })
          .eq("id", item.id);
        if (upd) throw new Error(upd.message);
      }

      await saveHealthEvent({
        flock_id: item.flockId ?? scope.flockId ?? null,
        event_date: item.date,
        event_type: "observation",
        description: `SCHEDULE_STATUS|${item.id}|${status}|${item.type}`,
        diagnosis: reason ?? null,
      });

      setSuccess(status === "completed" ? rest("completed") : rest("missed"));
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui("failedToUpdateScheduleStatus"));
    } finally {
      setSaving(false);
    }
  };

  const completeVaccination=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();const schedule=vaccinationInventoryModal.item;if(!schedule)return;setSaving(true);setVaccinationCompletionError(null);const form=new FormData(event.currentTarget);try{const administeredOn=String(form.get("administered_on")??"");await saveHealthEvent({vaccination_schedule_id:schedule.id,inventory_item_id:form.get("inventory_item_id"),warehouse_id:form.get("warehouse_id"),quantity:Number(form.get("quantity")),administered_on:administeredOn});setVaccinationInventoryModal({open:false,item:null});setSuccess(feedback("vaccinated", {date: formatOperationDate(`${administeredOn}T12:00:00Z`, locale)}));await loadSchedules()}catch(cause){setVaccinationCompletionError(cause instanceof Error?cause.message:ui("vaccinationCouldNotBeCompleted"))}finally{setSaving(false)}};

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
      const reason=window.prompt(rest("voidReason"))?.trim();if(!reason)return;const table=item.type==="weight"?"batch_weight_check_tasks":item.type==="cleanup"?"biosecurity_checks":"vaccination_events";const response=await fetch("/api/governance/void",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({table,id:item.id,reason})});const payload=await response.json();if(response.status===423&&payload?.governance){window.location.assign(governanceGuidanceUrl(payload.governance as GovernanceGuidance));return}if(!response.ok)throw new Error(payload.error??ui("unableToVoidSchedule"));
      setSuccess(rest("voided"));
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui("failedToRemoveSchedule"));
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
      if (!user) throw new Error(ui("unableToVerifyYourSession"));
      const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
      if (!profile?.org_id) throw new Error(ui("organizationContextNotFound"));

      if (!editModal.date) throw new Error(ui("dateIsRequired"));
      if (!editModal.farmId) throw new Error(ui("farmIsRequired"));
      if (editModal.item.type === "vaccination" && (!editModal.houseId || !editModal.flockId)) {
        throw new Error(ui("houseAndFlockAreRequiredForVaccination"));
      }

      if (editModal.item.type === "cleanup") {
        if (!editModal.cleanupType.trim()) throw new Error(ui("cleanupTypeIsRequired"));
        const scheduleNotes = `SCHEDULE|${editModal.cleanupType.trim()}${editModal.notes.trim() ? ` | ${editModal.notes.trim()}` : ""}`;
        const { error: updateError } = await supabase
          .from("biosecurity_checks")
          .update({ checklist_date: editModal.date, notes: scheduleNotes, farm_id: editModal.farmId })
          .eq("id", editModal.item.id);
        if (updateError) throw new Error(updateError.message);
      } else {
        if (!editModal.vaccineName.trim() || !editModal.dosage.trim()) {
          throw new Error(ui("vaccineNameAndDosageAreRequired"));
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

      const evidenceResponse = await fetch("/api/health/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule_id: editModal.item.id, event_date: editModal.date, farm_id: editModal.farmId, house_id: editModal.houseId, flock_id: editModal.flockId }),
      });
      const evidenceBody = await evidenceResponse.json().catch(() => ({}));
      if (!evidenceResponse.ok) throw new Error(evidenceBody.error ?? ui("scheduleEvidenceCouldNotBeUpdated"));

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
      setSuccess(rest("updated"));
      await loadSchedules();
    } catch (e) {
      setError(e instanceof Error ? e.message : ui("failedToUpdateSchedule"));
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

  useEffect(() => {
    const track = runwayRef.current;
    if (!track) return;
    const updateControls = () => {
      setRunwayCanScrollLeft(track.scrollLeft > 4);
      setRunwayCanScrollRight(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
    };
    updateControls();
    track.addEventListener("scroll", updateControls, { passive: true });
    window.addEventListener("resize", updateControls);
    return () => {
      track.removeEventListener("scroll", updateControls);
      window.removeEventListener("resize", updateControls);
    };
  }, [runway]);

  const moveRunway = (direction: -1 | 1) => {
    const track = runwayRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.max(230, track.clientWidth - 230), behavior: "smooth" });
  };

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
    farm: item.farmId ? farmNameById.get(item.farmId) ?? rest("assignedFarm") : rest("farmWide"),
    house: item.houseId ? houseNameById.get(item.houseId) ?? rest("assignedHouse") : rest("allHouses"),
    flock: item.flockId ? flockCodeById.get(item.flockId) ?? rest("assignedFlock") : rest("allFlocks"),
  });

  const openActionMenu = (event: React.MouseEvent<HTMLButtonElement>, item: ScheduleItem) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const isSameItemOpen = actionMenu.open && actionMenu.item?.id === item.id;
    setActionMenu(isSameItemOpen ? { open: false, item: null, top: 0, left: 0 } : { open: true, item, top: rect.bottom + 6, left: rect.right - 160 });
  };

  const scheduleActions = (item: ScheduleItem) => !canOperate?<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-forest-500"><ShieldCheck className="h-3.5 w-3.5"/>{ui("viewOnly")}</span>:(
    <div className="flex items-center gap-2">
      <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-leaf-500/35 px-3 text-[11px] font-semibold text-forest-700 transition hover:bg-leaf-500/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={saving || (item.status === "completed" && item.type !== "weight")} onClick={() => void markSchedule(item, "completed")}>
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />{item.type === "weight" ? ui("record") : ui("complete")}
      </button>
      {item.status !== "completed" ? <>
        <button type="button" aria-label={feedback("missSchedule", {type: scheduleTypeLabel(item.type)})} className="grid h-9 w-9 place-items-center rounded-lg border border-ember-500/30 text-ember-500 transition hover:bg-ember-500/10 disabled:opacity-40" disabled={saving || item.status === "missed"} onClick={() => setMissModal({ open: true, item })}><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
        <button type="button" aria-label={feedback("scheduleActions", {type: scheduleTypeLabel(item.type)})} className="grid h-9 w-9 place-items-center rounded-lg border border-sand-200 text-forest-700 transition hover:border-forest-400 hover:bg-sand-50" onClick={(event) => openActionMenu(event, item)}><Ellipsis className="h-4 w-4" aria-hidden="true" /></button>
      </> : null}
    </div>
  );

  const filterClass = "h-11 min-w-0 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20";

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-5">
      <div className="flex justify-end"><ResetPageFilters /></div>
      <header className="relative overflow-hidden rounded-3xl border border-forest-700 bg-forest-900 p-5 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[42px] border-leaf-500/10" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl"><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-amber-300"><HeartPulse className="h-4 w-4" aria-hidden="true" />{ui("flockHealthProtectionDesk")}</div><h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">{ui("keepEveryPreventiveActionOnTheRunway")}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100">{ui("planVaccinationBiosecurityAndWeightChecksInOneClinicalOperations")}</p></div>
          {canOperate?<div className="grid gap-2 sm:grid-cols-2 xl:min-w-[600px] xl:grid-cols-4">
            {todayEntryEnabled?<TodayEntryLink task="health_deaths" target={{farmId:healthFarmId||undefined,houseId:healthHouseId||undefined,flockId:healthFlockId||undefined}} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-semibold text-forest-950 transition hover:bg-amber-300"><Stethoscope className="h-4 w-4" aria-hidden="true" />{ui("recordTodaySHealthWork")}</TodayEntryLink>:<><button type="button" onClick={() => setShowEvidenceModal(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-semibold text-forest-950 transition hover:bg-amber-300"><Stethoscope className="h-4 w-4" aria-hidden="true" />{ui("healthEvidence")}</button><button type="button" onClick={()=>setShowTreatmentInventoryModal(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-semibold text-white transition hover:bg-white/15"><HeartPulse className="h-4 w-4" aria-hidden="true"/>{ui("recordTreatment")}</button><button type="button" onClick={() => setShowVaccineModal(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sand-50 px-4 text-xs font-semibold text-forest-900 transition hover:bg-white"><Syringe className="h-4 w-4" aria-hidden="true" />{ui("vaccination")}</button></>}
            <button type="button" onClick={() => setShowCleanupModal(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[.07] px-4 text-xs font-semibold text-white transition hover:bg-white/15"><Eraser className="h-4 w-4" aria-hidden="true" />{ui("biosecurity")}</button>
            <button type="button" onClick={() => setShowWeightModal(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[.07] px-4 text-xs font-semibold text-white transition hover:bg-white/15"><Scale className="h-4 w-4" aria-hidden="true" />{ui("weightCheck")}</button>
          </div>:<div className="rounded-xl border border-white/20 bg-white/[.07] px-4 py-3 text-sm text-sand-100"><ShieldCheck className="mb-2 h-5 w-5 text-amber-300"/>{ui("executiveEvidenceViewOperationalEntryRemainsWithAssignedFarmManagers")}</div>}
        </div>
      </header>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-500"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="font-semibold">{ui("healthScheduleNeedsAttention")}</p><p className="mt-1">{error}</p></div></div> : null}
      {success ? <div role="status" className="flex items-start gap-3 rounded-2xl border border-leaf-500/30 bg-leaf-500/10 p-4 text-sm text-forest-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-500" aria-hidden="true" /><p>{success}</p></div> : null}

      <section className="grid overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-6">
        <article className="border-b border-sand-200 p-4 sm:border-r xl:border-b-0"><ClipboardCheck className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">{ui("schedulesInScope")}</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.total}</p><p className="mt-1 text-[11px] text-forest-600">{ui("acrossAllLoadedHealthWork")}</p></article>
        <article className="border-b border-sand-200 p-4 xl:border-b-0 xl:border-r"><AlertTriangle className="h-4 w-4 text-ember-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">{ui("overdue")}</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.overdue}</p><p className="mt-1 text-[11px] text-forest-600">{ui("requiresImmediateDisposition")}</p></article>
        <article className="border-b border-sand-200 p-4 sm:border-r xl:border-b-0"><CalendarCheck2 className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">{ui("dueNext7Days")}</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.dueSeven}</p><p className="mt-1 text-[11px] text-forest-600">{ui("scheduledPreventiveWork")}</p></article>
        <article className="border-b border-sand-200 p-4 xl:border-b-0 xl:border-r"><CheckCircle2 className="h-4 w-4 text-leaf-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">{ui("completed")}</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.completed}</p><p className="mt-1 text-[11px] text-forest-600">{ui("documentedInLoadedHistory")}</p></article>
        <article className="border-b border-sand-200 p-4 sm:border-b-0 sm:border-r"><ShieldCheck className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">{ui("completionQuality")}</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.completionPct === null ? ui("unavailable") : `${healthSummary.completionPct.toFixed(0)}%`}</p><p className="mt-1 text-[11px] text-forest-600">{ui("completedAmongResolvedWork")}</p></article>
        <article className="p-4"><AlertTriangle className={`h-4 w-4 ${healthSummary.untargeted ? "text-amber-500" : "text-leaf-500"}`} aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-forest-500">{ui("targetGaps")}</p><p className="mt-1 font-display text-2xl font-semibold text-forest-900">{healthSummary.untargeted}</p><p className="mt-1 text-[11px] text-forest-600">{ui("workMissingRequiredFarmFlockContext")}</p></article>
      </section>

      <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">{ui("forwardSchedule")}</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">{ui("text14DayHealthRunway")}</h2><p className="mt-1 text-xs text-forest-600">{ui("eachLaneIsOneAddisAbabaCalendarDayScrollInside")}</p></div><div className="flex flex-wrap gap-3 text-[10px] text-forest-600"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-leaf-500" />{ui("vaccination")}</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />{ui("biosecurity")}</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" />{ui("weight")}</span></div></div>
        <div className="relative mt-5">
          <div id="health-runway-track" ref={runwayRef} className="runway-scroll max-w-full overflow-x-auto overscroll-x-contain px-11 pb-1" role="region" aria-label={ui("fourteenDayHealthSchedule")} tabIndex={0}><div className="flex w-max snap-x snap-mandatory gap-3 pr-5">{runway.map((day, index) => <article key={day.date} className={`min-h-52 w-[220px] shrink-0 snap-start rounded-xl border p-4 sm:w-[230px] ${index === 0 ? "border-forest-700 bg-forest-900 text-white" : day.items.length ? "border-sand-300 bg-sand-50" : "border-sand-200 bg-white"}`}><p className={`text-[9px] font-semibold uppercase tracking-[.12em] ${index === 0 ? "text-amber-300" : "text-forest-500"}`}>{index === 0 ? ui("today") : new Intl.DateTimeFormat(locale === "am" ? "am-ET" : "en-ET", { weekday: "long", timeZone: "Africa/Addis_Ababa" }).format(new Date(`${day.date}T00:00:00Z`))}</p><p className={`mt-2 font-display text-xl font-semibold ${index === 0 ? "text-white" : "text-forest-900"}`}>{formatDate(day.date)}</p><div className="mt-5 space-y-2.5">{day.items.slice(0, 3).map((item) => <div key={`${item.type}-${item.id}`} title={item.scheduleReason ?? scheduleTypeLabel(item.type)} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] ${index === 0 ? "bg-white/10 text-sand-50" : "bg-white text-forest-700"}`}><span className={`h-2 w-2 shrink-0 rounded-full ${item.type === "vaccination" ? "bg-leaf-500" : item.type === "cleanup" ? "bg-amber-500" : "bg-sky-500"}`} /><span className="truncate">{item.flockId ? flockCodeById.get(item.flockId) ?? scheduleTypeLabel(item.type) : scheduleTypeLabel(item.type)}</span></div>)}{day.items.length === 0 ? <p className={`text-[11px] ${index === 0 ? "text-sand-300" : "text-forest-400"}`}>{ui("noWorkScheduled")}</p> : null}{day.items.length > 3 ? <p className={`text-[10px] font-semibold ${index === 0 ? "text-amber-300" : "text-forest-500"}`}>+{day.items.length - 3} {ui("more")}</p> : null}</div></article>)}</div></div>
          <div className={`pointer-events-none absolute inset-y-0 left-0 flex w-14 items-center bg-gradient-to-r from-white via-white/90 to-transparent transition-opacity ${runwayCanScrollLeft ? "opacity-100" : "opacity-0"}`} aria-hidden={!runwayCanScrollLeft}><button type="button" onClick={() => moveRunway(-1)} disabled={!runwayCanScrollLeft} aria-label={ui("showEarlierHealthScheduleDays")} aria-controls="health-runway-track" className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-sand-300 bg-white text-forest-900 shadow-md transition hover:border-forest-600 hover:bg-forest-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-forest-500 disabled:pointer-events-none"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button></div>
          <div className={`pointer-events-none absolute inset-y-0 right-0 flex w-14 items-center justify-end bg-gradient-to-l from-white via-white/90 to-transparent transition-opacity ${runwayCanScrollRight ? "opacity-100" : "opacity-0"}`} aria-hidden={!runwayCanScrollRight}><button type="button" onClick={() => moveRunway(1)} disabled={!runwayCanScrollRight} aria-label={ui("showLaterHealthScheduleDays")} aria-controls="health-runway-track" className="pointer-events-auto grid h-10 w-10 place-items-center rounded-full border border-sand-300 bg-white text-forest-900 shadow-md transition hover:border-forest-600 hover:bg-forest-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-forest-500 disabled:pointer-events-none"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button></div>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <section className="rounded-2xl border border-sand-200 bg-sand-50 p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">{ui("clinicalPriority")}</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">{ui("needsAction")}</h2></div><span className="rounded-full bg-forest-900 px-2.5 py-1 text-xs font-semibold text-white">{priorityItems.length}</span></div><div className="mt-4 grid gap-3">{priorityItems.map((item) => { const target = targetLabel(item); return <article key={`priority-${item.type}-${item.id}`} className="rounded-xl border border-sand-200 bg-white p-4"><div className="flex items-start gap-3"><div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.status === "overdue" || item.status === "missed" ? "bg-ember-500/10 text-ember-500" : "bg-leaf-500/10 text-forest-700"}`}><ScheduleTypeIcon type={item.type} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-forest-900">{item.scheduleReason ?? scheduleTypeLabel(item.type)}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${badgeClass(item.status)}`}>{ui((item.status) as Parameters<typeof ui>[0])}</span></div><p className="mt-1 text-[11px] text-forest-500">{formatDate(item.date, true)} · {target.farm} · {target.flock}</p></div></div><div className="mt-3 border-t border-sand-100 pt-3">{scheduleActions(item)}</div></article>; })}{!loading && priorityItems.length === 0 ? <div className="rounded-xl border border-dashed border-sand-300 bg-white p-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-leaf-500" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-forest-900">{ui("noImmediateHealthExceptions")}</p><p className="mt-1 text-xs text-forest-600">{ui("theNextSevenDaysAreClearInThisScope")}</p></div> : null}</div></section>

        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">{ui("protectionMix")}</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">{ui("workloadByIntervention")}</h2></div><ShieldCheck className="h-5 w-5 text-forest-500" aria-hidden="true" /></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{(["vaccination", "cleanup", "weight"] as const).map((type) => { const count = healthSummary.scoped.filter((item) => item.type === type).length; const openCount = healthSummary.scoped.filter((item) => item.type === type && (item.status === "scheduled" || item.status === "overdue")).length; return <button key={type} type="button" onClick={() => setTypeFilter(typeFilter === type ? "all" : type)} aria-pressed={typeFilter === type} className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-forest-500 ${typeFilter === type ? "border-forest-700 bg-forest-900 text-white" : "border-sand-200 bg-sand-50 text-forest-900 hover:border-forest-400"}`}><ScheduleTypeIcon type={type} className={`h-5 w-5 ${typeFilter === type ? "text-amber-300" : "text-forest-500"}`} /><p className={`mt-4 text-[10px] font-semibold uppercase tracking-[.12em] ${typeFilter === type ? "text-sand-200" : "text-forest-500"}`}>{scheduleTypeLabel(type)}</p><p className="mt-1 font-display text-2xl font-semibold">{count}</p><p className={`mt-1 text-[11px] ${typeFilter === type ? "text-sand-200" : "text-forest-600"}`}>{openCount} {ui("open")}</p></button>; })}</div><div className="mt-5 rounded-xl border border-sand-200 p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-forest-900">{ui("resolvedWorkCompletion")}</span><span className="text-sm font-semibold text-forest-900">{healthSummary.completionPct === null ? ui("unavailable") : `${healthSummary.completionPct.toFixed(0)}%`}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-100"><div className="h-full rounded-full bg-leaf-500" style={{ width: `${Math.min(100, healthSummary.completionPct ?? 0)}%` }} /></div><p className="mt-2 text-[11px] leading-4 text-forest-600">{ui("missedWorkRemainsVisibleSoTheRateReflectsExecutionQuality")}</p></div></section>
      </div>

      <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="border-b border-sand-200 p-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">{ui("scheduleRegister")}</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">{ui("healthWorkLedger")}</h2><p className="mt-1 text-xs text-forest-600">{ui("filterByOperatingLocationInterventionOrExecutionStatus")}</p></div><button type="button" onClick={() => void loadSchedules()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-sand-200 px-4 text-xs font-semibold text-forest-700 hover:border-forest-400 hover:bg-sand-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />{ui("refresh")}</button></div>
          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">{ui("farm")}<select className={filterClass} value={healthFarmId} onChange={(event) => { setHealthFarmId(event.target.value); setHealthHouseId(""); setHealthFlockId(""); }}><option value="">{ui("allFarms")}</option>{filteredFarms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">{ui("house")}<select className={filterClass} value={healthHouseId} onChange={(event) => { setHealthHouseId(event.target.value); setHealthFlockId(""); }}><option value="">{ui("allHouses")}</option>{filteredHouses.filter((item) => !healthFarmId || item.farm_id === healthFarmId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">{ui("flock")}<select className={filterClass} value={healthFlockId} onChange={(event) => setHealthFlockId(event.target.value)}><option value="">{ui("allFlocks")}</option>{filteredFlocks.filter((item) => (!healthFarmId || item.farm_id === healthFarmId) && (!healthHouseId || item.house_id === healthHouseId)).map((item) => <option key={item.id} value={item.id}>{item.flock_code}</option>)}</select></label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">{ui("intervention")}<select className={filterClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | ScheduleItem["type"])}><option value="all">{ui("allInterventions")}</option><option value="vaccination">{ui("vaccination")}</option><option value="cleanup">{ui("biosecurity")}</option><option value="weight">{ui("weightCheck")}</option></select></label>
            <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-forest-500">{ui("status")}<select className={filterClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ScheduleItem["status"])}><option value="all">{ui("allStatuses")}</option><option value="overdue">{ui("overdue")}</option><option value="scheduled">{ui("scheduled")}</option><option value="completed">{ui("completed")}</option><option value="missed">{ui("missed")}</option></select></label>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:hidden">{loading ? <div className="h-36 animate-pulse rounded-xl bg-sand-100" /> : healthFilteredSchedules.map((item) => { const target = targetLabel(item); return <article key={`mobile-${item.type}-${item.id}`} className="rounded-2xl border border-sand-200 p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand-50 text-forest-600"><ScheduleTypeIcon type={item.type} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-forest-900">{item.scheduleReason ?? scheduleTypeLabel(item.type)}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${badgeClass(item.status)}`}>{ui((item.status) as Parameters<typeof ui>[0])}</span></div><p className="mt-1 text-xs text-forest-500">{formatDate(item.date, true)} · {target.farm}</p><p className="mt-1 text-[11px] text-forest-500">{target.house} · {target.flock}</p></div></div>{item.reason ? <p className="mt-3 rounded-xl bg-sand-50 p-3 text-xs leading-5 text-forest-600">{item.reason}</p> : null}<div className="mt-4 border-t border-sand-100 pt-3">{scheduleActions(item)}</div></article>; })}{!loading && healthFilteredSchedules.length === 0 ? <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 p-8 text-center"><CalendarCheck2 className="mx-auto h-6 w-6 text-forest-400" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-forest-900">{ui("noHealthWorkMatchesTheseFilters")}</p><p className="mt-1 text-xs text-forest-600">{ui("broadenTheScopeOrScheduleTheNextIntervention")}</p></div> : null}</div>

        <div className="hidden max-w-full overflow-x-auto md:block"><table className="min-w-[1120px] w-full text-left text-sm"><thead><tr className="border-b border-sand-200 bg-sand-50 text-[10px] uppercase tracking-[.12em] text-forest-500"><th className="px-5 py-3">{ui("dueDate")}</th><th className="px-4 py-3">{ui("intervention")}</th><th className="px-4 py-3">{ui("farmHouse")}</th><th className="px-4 py-3">{ui("flock")}</th><th className="px-4 py-3">{ui("status")}</th><th className="px-4 py-3">{ui("clinicalContext")}</th><th className="px-5 py-3">{ui("actions")}</th></tr></thead><tbody>{loading ? <tr><td colSpan={7} className="px-5 py-10 text-center text-forest-600">{ui("loadingTheHealthWorkLedger")}</td></tr> : healthFilteredSchedules.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center"><CalendarCheck2 className="mx-auto h-6 w-6 text-forest-400" aria-hidden="true" /><p className="mt-3 font-semibold text-forest-900">{ui("noHealthWorkMatchesTheseFilters")}</p><p className="mt-1 text-xs text-forest-600">{ui("broadenTheScopeOrScheduleTheNextIntervention")}</p></td></tr> : healthFilteredSchedules.map((item) => { const target = targetLabel(item); return <tr key={`${item.type}-${item.id}`} className="border-b border-sand-100 align-top last:border-0 hover:bg-sand-50/50"><td className="px-5 py-4"><p className="font-semibold text-forest-900">{formatDate(item.date, true)}</p><p className="mt-1 text-[11px] text-forest-500">{item.date === addisToday() ? ui("dueToday") : item.date < addisToday() && item.status !== "completed" ? ui("pastDue") : ui("scheduledDate")}</p></td><td className="px-4 py-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sand-50 text-forest-600"><ScheduleTypeIcon type={item.type} /></span><span className="font-medium text-forest-900">{scheduleTypeLabel(item.type)}</span></div></td><td className="px-4 py-4"><p className="text-forest-900">{target.farm}</p><p className="mt-1 text-[11px] text-forest-500">{target.house}</p></td><td className="px-4 py-4 font-medium text-forest-900">{target.flock}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.06em] ${badgeClass(item.status)}`}>{ui((item.status) as Parameters<typeof ui>[0])}</span></td><td className="max-w-[330px] px-4 py-4"><p className="text-xs leading-5 text-forest-800">{item.scheduleReason ?? rest("noDescription")}</p>{item.reason ? <p className="mt-1 text-[11px] leading-4 text-forest-500">{ui("outcome")} {item.reason}</p> : null}</td><td className="px-5 py-4">{scheduleActions(item)}</td></tr>; })}</tbody></table></div>
      </section>

      {showTreatmentInventoryModal?<div className="fixed inset-0 z-[90] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="treatment-stock-title" className="mx-auto my-8 w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between bg-forest-900 p-5 text-white"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">{ui("treatmentAndStock")}</p><h2 id="treatment-stock-title" className="mt-1 font-display text-2xl font-semibold">{ui("recordIllnessTreatment")}</h2><p className="mt-1 text-xs text-sand-200">{ui("ifMedicineStockIsInsufficientNeitherTheTreatmentNorThe")}</p></div><button type="button" aria-label={ui("close")} onClick={()=>setShowTreatmentInventoryModal(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15"><X className="h-4 w-4"/></button></div><form onSubmit={submitTreatmentInventory} className="grid gap-4 p-5 md:grid-cols-2"><label className="grid gap-1 text-sm text-forest-700">{ui("flock")}<select name="flock_id" required defaultValue={scope.flockId} className="h-11 rounded-xl border border-sand-200 px-3"><option value="">{ui("selectFlock")}</option>{filteredFlocks.map(flock=><option key={flock.id} value={flock.id}>{flock.flock_code}</option>)}</select></label><label className="grid gap-1 text-sm text-forest-700">{ui("treatmentDate")}<OperationDateInput name="event_date" required defaultValue={addisToday()} max={addisToday()} className="h-11 rounded-xl border border-sand-200 px-3"/></label><label className="grid gap-1 text-sm text-forest-700">{ui("diagnosis")}<input name="diagnosis" required className="h-11 rounded-xl border border-sand-200 px-3"/></label><label className="grid gap-1 text-sm text-forest-700">{ui("medicine")}<select name="inventory_item_id" required className="h-11 rounded-xl border border-sand-200 px-3"><option value="">{ui("selectMedicine")}</option>{healthInventoryItems.filter(item=>item.category==="medicine").map(item=><option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label><label className="grid gap-1 text-sm text-forest-700">{ui("warehouse")}<select name="warehouse_id" required className="h-11 rounded-xl border border-sand-200 px-3"><option value="">{ui("selectAssignedWarehouse")}</option>{healthWarehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label className="grid gap-1 text-sm text-forest-700">{ui("quantityAdministered")}<input name="quantity" required type="number" min="0.001" step="0.001" className="h-11 rounded-xl border border-sand-200 px-3"/></label><label className="grid gap-1 text-sm text-forest-700 md:col-span-2">{ui("observedCondition")}<textarea name="description" required className="min-h-20 rounded-xl border border-sand-200 p-3"/></label><label className="grid gap-1 text-sm text-forest-700 md:col-span-2">{ui("treatmentAction")}<textarea name="treatment" required className="min-h-20 rounded-xl border border-sand-200 p-3"/></label><button disabled={saving} className="h-11 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{saving?ui("savingTreatment"):ui("saveTreatmentAndDeductMedicine")}</button></form></div></div>:null}

      {vaccinationInventoryModal.open&&vaccinationInventoryModal.item?<div className="fixed inset-0 z-[90] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="complete-vaccination-title" className="mx-auto my-12 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between bg-forest-900 p-5 text-white"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">{ui("vaccinationCompletion")}</p><h2 id="complete-vaccination-title" className="mt-1 font-display text-2xl font-semibold">{ui("completeVaccination")}</h2><p className="mt-1 text-xs text-sand-200">{ui("recordWhenItWasActuallyAdministeredCompletionAndVaccineDeduction")}</p></div><button type="button" aria-label={ui("close")} onClick={()=>{setVaccinationCompletionError(null);setVaccinationInventoryModal({open:false,item:null})}} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15"><X className="h-4 w-4"/></button></div><form onSubmit={completeVaccination} className="grid gap-4 p-5"><div className="rounded-xl bg-sand-50 p-4 text-sm text-forest-700"><strong className="block text-forest-900">{vaccinationInventoryModal.item.scheduleReason}</strong><span className="mt-1 block">{ui("scheduledFor")} {vaccinationInventoryModal.item.date}{ui("thePlannedDateRemainsUnchangedForScheduleReporting")}</span></div><label className="grid gap-1 text-sm text-forest-700">{ui("actualAdministrationDate")}<OperationDateInput name="administered_on" required defaultValue={addisToday()} max={addisToday()} className="h-11 rounded-xl border border-sand-200 px-3"/><span className="text-xs text-forest-500">{ui("useTodayWhenAnOverdueTaskWasPerformedTodayDates")}</span></label><label className="grid gap-1 text-sm text-forest-700">{ui("vaccineItem")}<select name="inventory_item_id" required className="h-11 rounded-xl border border-sand-200 px-3"><option value="">{ui("selectVaccine")}</option>{healthInventoryItems.filter(item=>item.category==="vaccine").map(item=><option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select></label><label className="grid gap-1 text-sm text-forest-700">{ui("warehouse")}<select name="warehouse_id" required className="h-11 rounded-xl border border-sand-200 px-3"><option value="">{ui("selectAssignedWarehouse")}</option>{healthWarehouses.map(warehouse=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></label><label className="grid gap-1 text-sm text-forest-700">{ui("quantityAdministered")}<input name="quantity" required type="number" min="0.001" step="0.001" className="h-11 rounded-xl border border-sand-200 px-3"/></label>{vaccinationCompletionError?<div role="alert" className="rounded-xl border border-ember-300 bg-ember-50 p-3 text-sm leading-6 text-ember-800"><strong className="block">{ui("completionWasNotSaved")}</strong>{vaccinationCompletionError}</div>:null}<button disabled={saving} className="h-11 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white disabled:opacity-50">{saving?ui("savingCompletion"):ui("completeAndDeductVaccine")}</button></form></div></div>:null}

      {showEvidenceModal ? <div className="fixed inset-0 z-[80] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="health-evidence-title" className="mx-auto my-4 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 bg-forest-900 p-5 text-white"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">{ui("clinicalEvidenceChain")}</p><h2 id="health-evidence-title" className="mt-1 font-display text-2xl font-semibold">{ui("recordHealthEventAndExternalGuidance")}</h2><p className="mt-1 text-xs text-sand-200">{ui("theFarmManagerRecordsTheEventTheConsultantRemainsAn")}</p></div><button type="button" aria-label={ui("closeHealthEvidenceForm")} onClick={()=>setShowEvidenceModal(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/15"><X className="h-4 w-4"/></button></div><form onSubmit={submitHealthEvidence} className="grid gap-4 p-5 md:grid-cols-2"><label className="grid gap-1 text-sm text-forest-700">{ui("flock")}<select name="flock_id" required defaultValue={scope.flockId} className="h-11 rounded-xl border border-sand-200 px-3"><option value="">{ui("selectFlock")}</option>{filteredFlocks.map(flock=><option key={flock.id} value={flock.id}>{flock.flock_code}</option>)}</select></label><label className="grid gap-1 text-sm text-forest-700">{ui("eventDate")}<OperationDateInput name="event_date" required defaultValue={addisToday()} max={addisToday()} className="h-11 rounded-xl border border-sand-200 px-3"/></label><label className="grid gap-1 text-sm text-forest-700">{ui("eventType")}<select name="event_type" className="h-11 rounded-xl border border-sand-200 px-3"><option value="observation">{ui("observation")}</option><option value="disease">{ui("disease")}</option><option value="treatment">{ui("treatment")}</option></select></label><label className="grid gap-1 text-sm text-forest-700">{ui("diagnosis")}<input name="diagnosis" className="h-11 rounded-xl border border-sand-200 px-3"/></label><label className="grid gap-1 text-sm text-forest-700 md:col-span-2">{ui("observedCondition")}<textarea name="description" required className="min-h-20 rounded-xl border border-sand-200 p-3"/></label><label className="grid gap-1 text-sm text-forest-700 md:col-span-2">{ui("actionTakenOrDeclineReason")}<textarea name="treatment" className="min-h-20 rounded-xl border border-sand-200 p-3"/></label><fieldset className="grid gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 md:col-span-2 md:grid-cols-2"><legend className="px-2 text-sm font-semibold text-forest-900">{ui("externalVeterinaryGuidanceOptional")}</legend><label className="grid gap-1 text-sm text-forest-700">{ui("veterinarianName")}<input name="external_veterinarian_name" className="h-11 rounded-xl border border-sand-200 bg-white px-3"/></label><label className="grid gap-1 text-sm text-forest-700">{ui("implementationStatus")}<select name="recommendation_status" className="h-11 rounded-xl border border-sand-200 bg-white px-3"><option value="">{ui("noExternalGuidance")}</option><option value="received">{ui("received")}</option><option value="planned">{ui("planned")}</option><option value="implemented">{ui("implemented")}</option><option value="declined">{ui("declined")}</option></select></label><label className="grid gap-1 text-sm text-forest-700 md:col-span-2">{ui("recommendation")}<textarea name="veterinarian_recommendation" className="min-h-20 rounded-xl border border-sand-200 bg-white p-3"/></label><label className="grid gap-1 text-sm text-forest-700">{ui("reference")}<input name="veterinarian_reference" placeholder={ui("letterCaseOrConsultationReference")} className="h-11 rounded-xl border border-sand-200 bg-white px-3"/></label><label className="grid gap-1 text-sm text-forest-700">{ui("supportingDocumentURL")}<input name="attachment_url" type="url" placeholder={ui("https")} className="h-11 rounded-xl border border-sand-200 bg-white px-3"/></label></fieldset><button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2">{saving?ui("recording"):ui("recordHealthEvidence")}</button></form></div></div>:null}

      {showWeightModal ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="weight-schedule-title" className="mx-auto my-4 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-forest-900 p-5 text-white"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300"><Scale className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-300">{ui("growthSurveillance")}</p><h4 id="weight-schedule-title" className="mt-1 font-display text-xl font-semibold">{ui("scheduleWeightCheck")}</h4><p className="mt-1 text-xs text-sand-200">{ui("assignOneBatchAndFlockToADefinedAgeWeek")}</p></div></div>
              <button type="button" aria-label={ui("closeWeightSchedule")} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-sand-100 hover:bg-white/10" onClick={() => setShowWeightModal(false)}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <form className="grid gap-3 p-5" onSubmit={submitWeightSchedule}>
              <select
                aria-label={ui("farm")}
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
                <option value="">{ui("selectFarm")}</option>
                {filteredFarms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select
                aria-label={ui("house")}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={weightHouseId}
                onChange={(e) => {
                  setWeightHouseId(e.target.value);
                  setWeightFlockId("");
                  setWeightBatchId("");
                }}
                required
              >
                <option value="">{ui("selectHouse")}</option>
                {filteredHouses
                  .filter((h) => !weightFarmId || h.farm_id === weightFarmId)
                  .map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
              </select>
              <select
                aria-label={ui("flock")}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={weightFlockId}
                onChange={(e) => {
                  const nextFlockId = e.target.value;
                  setWeightFlockId(nextFlockId);
                  setWeightBatchId(filteredFlocks.find((flock) => flock.id === nextFlockId)?.batch_id ?? "");
                }}
                required
              >
                <option value="">{ui("selectFlock")}</option>
                {filteredFlocks
                  .filter((f) => (!weightFarmId || f.farm_id === weightFarmId) && (!weightHouseId || f.house_id === weightHouseId))
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.flock_code}</option>
                  ))}
              </select>
              <select
                aria-label={ui("batch")}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={weightBatchId}
                onChange={(e) => setWeightBatchId(e.target.value)}
                required
              >
                <option value="">{ui("selectBatch")}</option>
                {batches
                  .filter((batch) => !weightFlockId || filteredFlocks.some((flock) => flock.id === weightFlockId && flock.batch_id === batch.id))
                  .map((batch) => (
                    <option key={batch.id} value={batch.id}>{batch.batch_code}</option>
                  ))}
              </select>
              <label className="grid gap-1 text-xs font-medium text-forest-600">{ui("dueDate")}<OperationDateInput name="due_date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">{ui("ageWeek")}<input name="due_week_number" type="number" min={0} required placeholder={ui("chickAgeWeek")} className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <button type="submit" disabled={saving} className="mt-2 min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 disabled:opacity-60">
                {saving ? ui("saving2") : ui("scheduleWeightCheck2")}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showVaccineModal ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="vaccine-schedule-title" className="mx-auto my-4 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-forest-900 p-5 text-white"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300"><Syringe className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-300">{ui("preventiveMedicine")}</p><h4 id="vaccine-schedule-title" className="mt-1 font-display text-xl font-semibold">{ui("scheduleVaccination")}</h4><p className="mt-1 text-xs text-sand-200">{ui("defineTheFlockProductDosageAndAdministrationRoute")}</p></div></div>
              <button type="button" aria-label={ui("closeVaccinationSchedule")} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-sand-100 hover:bg-white/10" onClick={() => setShowVaccineModal(false)}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <form className="grid gap-3 p-5" onSubmit={submitVaccinationSchedule}>
              <select
                aria-label={ui("farm")}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={vaccFarmId}
                onChange={(e) => {
                  setVaccFarmId(e.target.value);
                  setVaccHouseId("");
                  setVaccFlockId("");
                }}
                required
              >
                <option value="">{ui("selectFarm")}</option>
                {filteredFarms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select
                aria-label={ui("house")}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={vaccHouseId}
                onChange={(e) => {
                  setVaccHouseId(e.target.value);
                  setVaccFlockId("");
                }}
                required
              >
                <option value="">{ui("selectHouse")}</option>
                {filteredHouses
                  .filter((h) => !vaccFarmId || h.farm_id === vaccFarmId)
                  .map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
              </select>
              <select
                aria-label={ui("flock")}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={vaccFlockId}
                onChange={(e) => setVaccFlockId(e.target.value)}
                required
              >
                <option value="">{ui("selectFlock")}</option>
                {filteredFlocks
                  .filter((f) => (!vaccFarmId || f.farm_id === vaccFarmId) && (!vaccHouseId || f.house_id === vaccHouseId))
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.flock_code}</option>
                  ))}
              </select>
              <label className="grid gap-1 text-xs font-medium text-forest-600">{ui("plannedDate")}<OperationDateInput name="planned_date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">{ui("vaccine")}<input name="vaccine_name" placeholder={ui("vaccineName")} required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">{ui("dosage")}<input name="dosage" placeholder={ui("dosage")} required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <select
                aria-label={ui("administrationRoute")}
                name="route"
                required
                defaultValue=""
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
              >
                <option value="" disabled>{ui("selectRoute")}</option>
                <option value="water">{ui("water")}</option>
                <option value="injection">{ui("injection")}</option>
                <option value="spray">{ui("spray")}</option>
                <option value="eye_drop">{ui("eyeDrop")}</option>
              </select>
              <button type="submit" disabled={saving} className="mt-2 min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 disabled:opacity-60">
                {saving ? ui("saving2") : ui("createSchedule")}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {showCleanupModal ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-forest-900/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="cleanup-schedule-title" className="mx-auto my-4 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 bg-forest-900 p-5 text-white"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-amber-300"><Eraser className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-amber-300">{ui("biosecurityControl")}</p><h4 id="cleanup-schedule-title" className="mt-1 font-display text-xl font-semibold">{ui("scheduleFarmCleanup")}</h4><p className="mt-1 text-xs text-sand-200">{ui("assignTheCleaningWorkAtFarmHouseOrFlockLevel")}</p></div></div>
              <button type="button" aria-label={ui("closeCleanupSchedule")} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-sand-100 hover:bg-white/10" onClick={() => setShowCleanupModal(false)}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>
            <form className="grid gap-3 p-5" onSubmit={submitCleanupSchedule}>
              <select
                aria-label={ui("farm")}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={cleanFarmId}
                onChange={(e) => {
                  setCleanFarmId(e.target.value);
                  setCleanHouseId("");
                  setCleanFlockId("");
                }}
                required
              >
                <option value="">{ui("selectFarm")}</option>
                {filteredFarms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select
                aria-label={ui("house")}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={cleanHouseId}
                onChange={(e) => {
                  setCleanHouseId(e.target.value);
                  setCleanFlockId("");
                }}
              >
                <option value="">{ui("selectHouseOptional")}</option>
                {filteredHouses
                  .filter((h) => !cleanFarmId || h.farm_id === cleanFarmId)
                  .map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
              </select>
              <select
                aria-label={ui("flock")}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                value={cleanFlockId}
                onChange={(e) => setCleanFlockId(e.target.value)}
              >
                <option value="">{ui("selectFlockOptional")}</option>
                {filteredFlocks
                  .filter((f) => (!cleanFarmId || f.farm_id === cleanFarmId) && (!cleanHouseId || f.house_id === cleanHouseId))
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.flock_code}</option>
                  ))}
              </select>
              <label className="grid gap-1 text-xs font-medium text-forest-600">{ui("checklistDate")}<OperationDateInput name="checklist_date" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">{ui("cleanupType")}<input name="cleanup_type" placeholder={ui("disinfectionLitterRemoval")} required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" /></label>
              <label className="grid gap-1 text-xs font-medium text-forest-600">{ui("notes")}<textarea name="notes" placeholder={ui("optionalExecutionNotes")} className="min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm" /></label>
              <button type="submit" disabled={saving} className="mt-2 min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 disabled:opacity-60">
                {saving ? ui("saving2") : ui("createSchedule")}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {missModal.open && missModal.item ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-forest-900">{ui("reasonForMissedSchedule")}</h4>
              <button
                type="button"
                className="text-sm text-forest-600"
                onClick={() => {
                  setMissModal({ open: false, item: null });
                  setMissReason("");
                }}
              >
                {ui("close")}
              </button>
            </div>
            <textarea
              value={missReason}
              onChange={(e) => setMissReason(e.target.value)}
              placeholder={ui("whyWasThisScheduleMissed")}
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
                {ui("cancel")}
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
                {ui("markMissed")}
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
              {ui("edit")}
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
            {ui("remove")}
          </button>
        </div>
      ) : null}

      {recordWeightModal.open && recordWeightModal.item ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-forest-900">{ui("recordSampleWeight")}</h4>
                <p className="text-sm text-forest-600">
                  {recordWeightModal.item.scheduleReason} / {recordWeightModal.item.date}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-forest-600"
                onClick={() => setRecordWeightModal({ open: false, item: null })}
              >
                {ui("close")}
              </button>
            </div>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveWeightRecord}>
              <label className="grid gap-1 text-sm text-forest-700">
                {ui("recordDate")}
                <OperationDateInput name="record_date" defaultValue={recordWeightModal.item.date} required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                {ui("sampleCount")}
                <input name="sample_count" type="number" min={1} placeholder={ui("birdsSampled")} className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                {ui("averageWeightG")}
                <input name="average_weight_g" type="number" min={0.01} step="0.01" required className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                {ui("minWeightG")}
                <input name="min_weight_g" type="number" min={0} step="0.01" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                {ui("maxWeightG")}
                <input name="max_weight_g" type="number" min={0} step="0.01" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-sm text-forest-700">
                {ui("uniformity")}
                <input name="uniformity_pct" type="number" min={0} max={100} step="0.01" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
              </label>
              <button type="submit" disabled={saving} className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60 md:col-span-2">
                {saving ? ui("saving2") : ui("saveWeightSample")}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {removeModal.open && removeModal.item ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h4 className="text-lg font-semibold text-forest-900">{ui("removeSchedule")}</h4>
            <p className="mt-2 text-sm text-forest-700">
              {ui("areYouSureYouWantToRemoveThis")} {removeModal.item.type} {ui("scheduleThisActionCannotBeUndone")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
                onClick={() => setRemoveModal({ open: false, item: null })}
              >
                {ui("cancel")}
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
                {saving ? ui("removing") : ui("remove")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editModal.open && editModal.item ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-semibold text-forest-900">{ui("editSchedule")}</h4>
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
                {ui("close")}
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
                <option value="">{ui("selectFarm")}</option>
                {filteredFarms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <select
                value={editModal.houseId}
                onChange={(e) => setEditModal((prev) => ({ ...prev, houseId: e.target.value, flockId: "" }))}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
              >
                <option value="">{ui("selectHouse")} {editModal.item.type === "cleanup" ? ui("optional") : ""}</option>
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
                <option value="">{ui("selectFlock")} {editModal.item.type === "cleanup" ? ui("optional") : ""}</option>
                {filteredFlocks
                  .filter((f) => (!editModal.farmId || f.farm_id === editModal.farmId) && (!editModal.houseId || f.house_id === editModal.houseId))
                  .map((f) => (
                    <option key={f.id} value={f.id}>{f.flock_code}</option>
                  ))}
              </select>
              <OperationDateInput
                value={editModal.date}
                onChange={(e) => setEditModal((prev) => ({ ...prev, date: e.target.value }))}
                className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
              />
              {editModal.item.type === "cleanup" ? (
                <>
                  <input
                    value={editModal.cleanupType}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, cleanupType: e.target.value }))}
                    placeholder={ui("cleanupType")}
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  />
                  <textarea
                    value={editModal.notes}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder={ui("notes")}
                    className="min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm"
                  />
                </>
              ) : (
                <>
                  <input
                    value={editModal.vaccineName}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, vaccineName: e.target.value }))}
                    placeholder={ui("vaccineName")}
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  />
                  <input
                    value={editModal.dosage}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, dosage: e.target.value }))}
                    placeholder={ui("dosage")}
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  />
                  <select
                    value={editModal.route}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, route: e.target.value as EditScheduleState["route"] }))}
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                  >
                    <option value="water">{ui("water")}</option>
                    <option value="injection">{ui("injection")}</option>
                    <option value="spray">{ui("spray")}</option>
                    <option value="eye_drop">{ui("eyeDrop")}</option>
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
                {ui("cancel")}
              </button>
              <button
                type="button"
                className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60"
                disabled={saving}
                onClick={saveScheduleEdit}
              >
                {saving ? ui("saving2") : ui("saveChanges")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
