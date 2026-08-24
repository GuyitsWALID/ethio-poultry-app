"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Droplets,
  Egg,
  HeartPulse,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wheat,
  X,
} from "lucide-react";

import { useFarmScope } from "@/components/farm-scope-context";
import type { Database } from "@/types/supabase";
import { createClient } from "@/utils/supabase/client";

type FeedType = Database["public"]["Enums"]["feed_type"];

const feedTypeOptions: Array<{ value: FeedType; label: string; description: string }> = [
  {
    value: "starter_feed",
    label: "Starter Feed",
    description: "High-protein (20-24%) diet for newly hatched chicks to support rapid early growth.",
  },
  {
    value: "grower_pullet_feed",
    label: "Grower (Pullet) Feed",
    description: "Moderate-protein (16-18%) feed for muscle and bone structure in developing chickens.",
  },
  {
    value: "layer_feed",
    label: "Layer Feed",
    description: "High-calcium (16% protein) diet for egg-producing hens and strong shells.",
  },
  {
    value: "broiler_feed",
    label: "Broiler Feed",
    description: "High-energy, high-protein (20-23%) diet for rapid meat-bird weight gain.",
  },
  {
    value: "medicated_feed",
    label: "Medicated Feed",
    description: "Contains a coccidiostat to help prevent parasitic infections in young chicks.",
  },
];

const feedTypeLabels = new Map(feedTypeOptions.map((option) => [option.value, option.label]));

const feedDayKey = (flockId: string, recordDate: string) => `${flockId}:${recordDate}`;

const addisToday = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const formatRecordDate = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`)
  );

const displayNumber = (value: number | null, suffix = "", places = 1) =>
  value === null ? "Unavailable" : `${value.toLocaleString(undefined, { maximumFractionDigits: places })}${suffix}`;

const expectedClosingBirds = (row: DailyRow) => {
  if (row.opening_birds === null) return null;
  return (
    row.opening_birds +
    (row.transfers_in ?? 0) -
    (row.deaths ?? 0) -
    (row.culls ?? 0) -
    (row.transfers_out ?? 0) -
    (row.other_removals ?? 0)
  );
};

const calculateFlockAge = (
  placementDate: string | null | undefined,
  recordDate: string | null | undefined,
  ageAtPlacementDays: number | null | undefined = 0
) => {
  if (!placementDate || !recordDate) return null;
  const placed = new Date(`${placementDate}T00:00:00`);
  const recorded = new Date(`${recordDate}T00:00:00`);
  const diffDays = Math.floor((recorded.getTime() - placed.getTime()) / 86400000);
  if (!Number.isFinite(diffDays) || diffDays < 0) return null;
  const totalAgeDays = diffDays + Math.max(0, ageAtPlacementDays ?? 0);
  return {
    weeks: Math.floor(totalAgeDays / 7),
    days: totalAgeDays,
  };
};

type DailyRow = {
  id: string;
  record_date: string;
  flock_id: string;
  flock_age_weeks: number | null;
  flock_age_days: number | null;
  feed_intake_grams: number | null;
  feed_intake_quantity: number | null;
  feed_leftover_grams: number | null;
  feed_type: FeedType | null;
  normal_eggs: number | null;
  broken_eggs: number | null;
  total_eggs: number | null;
  production_percentage: number | null;
  deaths: number | null;
  mortality_percentage: number | null;
  deaths_cause: string | null;
  vaccination_status: string | null;
  medication_vitamins: string | null;
  opening_birds: number | null;
  closing_birds: number | null;
  culls: number | null;
  transfers_in: number | null;
  transfers_out: number | null;
  other_removals: number | null;
  dirty_eggs: number | null;
  average_egg_weight_g: number | null;
  water_consumed_liters: number | null;
};

type AgeSource = {
  placement_date: string | null;
  age_at_placement_days: number | null;
};

type InventoryUsageItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  unit_cost: number | null;
};

type WarehouseRow = {
  id: string;
  branch_id: string;
  name: string;
  type: string;
};

type RoutineUsageRow = { key:string; itemId:string; warehouseId:string; quantity:string; notes:string };

export default function DailyRecordsPage() {
  const { role, scope, setScope, branches, filteredFarms, filteredFlocks, filteredBatches, filteredHouses } =
    useFarmScope();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [dateFilterMode, setDateFilterMode] = useState<"single" | "range">("single");
  const [filterDate, setFilterDate] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [formTotalEggs, setFormTotalEggs] = useState("");
  const [formDeaths, setFormDeaths] = useState("");
  const [editingRow, setEditingRow] = useState<DailyRow | null>(null);
  const [newRecordDate, setNewRecordDate] = useState(addisToday);
  const [editRecordDate, setEditRecordDate] = useState("");
  const [newAgeSource, setNewAgeSource] = useState<AgeSource | null>(null);
  const [editAgeSource, setEditAgeSource] = useState<AgeSource | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryUsageItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [routineUsages,setRoutineUsages]=useState<RoutineUsageRow[]>([]);
  const [closedFeedDayKeys, setClosedFeedDayKeys] = useState<Set<string>>(() => new Set());
  const canCreateRecord = currentRole === "farm_manager";

  const parseNumber = (value: FormDataEntryValue | null) => {
    if (value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const parseText = (value: FormDataEntryValue | null) => {
    const parsed = value?.toString().trim();
    return parsed && parsed.length > 0 ? parsed : null;
  };
  const loadRows = async () => {
    setLoadingRows(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setRows([]);
      setClosedFeedDayKeys(new Set());
      setLoadingRows(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id) {
      setRows([]);
      setClosedFeedDayKeys(new Set());
      setLoadingRows(false);
      return;
    }

    let query = supabase
      .from("daily_farm_records")
      .select(
        "id, record_date, flock_id, flock_age_weeks, flock_age_days, feed_intake_grams, feed_intake_quantity, feed_leftover_grams, feed_type, normal_eggs, broken_eggs, dirty_eggs, average_egg_weight_g, total_eggs, production_percentage, deaths, mortality_percentage, deaths_cause, vaccination_status, medication_vitamins, opening_birds, closing_birds, culls, transfers_in, transfers_out, other_removals, water_consumed_liters"
      )
      .eq("org_id", profile.org_id)
      .is("voided_at",null)
      .order("record_date", { ascending: false })
      .limit(200);

    const scopedFlockIds = filteredFlocks
      .filter((flock) => !scope.batchId || flock.batch_id === scope.batchId)
      .map((flock) => flock.id);

    if (scope.flockId) query = query.eq("flock_id", scope.flockId);
    else if (scopedFlockIds.length > 0) query = query.in("flock_id", scopedFlockIds);
    else if (scope.branchId || scope.farmId || scope.houseId || scope.batchId) {
      setRows([]);
      setClosedFeedDayKeys(new Set());
      setLoadingRows(false);
      return;
    }

    if (dateFilterMode === "single" && filterDate) query = query.eq("record_date", filterDate);
    if (dateFilterMode === "range") {
      if (filterDateFrom) query = query.gte("record_date", filterDateFrom);
      if (filterDateTo) query = query.lte("record_date", filterDateTo);
    }

    const { data } = await query;
    const dailyRows = (data ?? []) as DailyRow[];
    setRows(dailyRows);

    if (dailyRows.length === 0) {
      setClosedFeedDayKeys(new Set());
    } else {
      const dates = dailyRows.map((row) => row.record_date).sort();
      const flockIds = [...new Set(dailyRows.map((row) => row.flock_id))];
      const { data: closures } = await supabase
        .from("feed_day_closures")
        .select("flock_id, record_date")
        .eq("org_id", profile.org_id)
        .eq("status", "closed")
        .in("flock_id", flockIds)
        .gte("record_date", dates[0])
        .lte("record_date", dates[dates.length - 1]);
      setClosedFeedDayKeys(new Set((closures ?? []).map((row) => feedDayKey(row.flock_id, row.record_date))));
    }
    setLoadingRows(false);
  };

  useEffect(() => {
    const loadRole = async () => {
      const response = await fetch("/api/me/context", { method: "GET" });
      if (!response.ok) return;
      const data = await response.json();
      setCurrentRole(String(data?.role ?? ""));
    };
    void loadRole();
  }, []);

  useEffect(() => {
    const loadInventoryOptions = async () => {
      const response = await fetch("/api/me/context", { method: "GET" });
      if (!response.ok) return;
      const context = await response.json();
      const orgId = context?.orgId as string | null;
      if (!orgId) return;

      const [catalogResponse, warehousesResponse] = await Promise.all([
        fetch("/api/inventory/catalog"),
        fetch("/api/inventory/warehouses"),
      ]);
      const catalog = catalogResponse.ok ? await catalogResponse.json() : { items: [] };
      const warehouseData = warehousesResponse.ok ? await warehousesResponse.json() : { warehouses: [] };
      const supportedCategories = new Set(["medicine", "vaccine", "vitamin", "supplement", "packaging", "miscellaneous"]);
      setInventoryItems(((catalog.items ?? []) as InventoryUsageItem[]).filter((item) => supportedCategories.has(item.category)));
      setWarehouses(((warehouseData.warehouses ?? []) as WarehouseRow[]).filter((warehouse) => !scope.branchId || warehouse.branch_id === scope.branchId));
    };

    void loadInventoryOptions();
  }, [scope.branchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scope.branchId,
    scope.farmId,
    scope.houseId,
    scope.flockId,
    scope.batchId,
    dateFilterMode,
    filterDate,
    filterDateFrom,
    filterDateTo,
    filteredFlocks,
    filteredBatches,
  ]);

  const selectedFlock = useMemo(
    () => filteredFlocks.find((flock) => flock.id === scope.flockId) ?? null,
    [filteredFlocks, scope.flockId]
  );
  const selectedBatch = useMemo(() => {
    const batchId = scope.batchId || selectedFlock?.batch_id;
    const directBatch = filteredBatches.find((batch) => batch.id === batchId);
    if (directBatch) return directBatch;
    if (!selectedFlock) return null;
    return (
      filteredBatches.find((batch) => batch.farm_id === selectedFlock.farm_id && batch.house_id === selectedFlock.house_id) ??
      null
    );
  }, [filteredBatches, scope.batchId, selectedFlock]);

  useEffect(() => {
    const loadAgeSource = async () => {
      if (!scope.flockId) {
        setNewAgeSource(null);
        return;
      }

      const localSource = selectedBatch?.placement_date
        ? {
            placement_date: selectedBatch.placement_date,
            age_at_placement_days: selectedBatch.age_at_placement_days ?? 0,
          }
        : null;
      if (localSource) {
        setNewAgeSource(localSource);
        return;
      }

      const supabase = createClient();
      const { data: flock } = await supabase
        .from("flocks")
        .select("batch_id, farm_id, house_id, placement_date, age_at_placement_days")
        .eq("id", scope.flockId)
        .maybeSingle();

      if (!flock) {
        setNewAgeSource(null);
        return;
      }

      if (flock.batch_id) {
        const { data: batch } = await supabase
          .from("batches")
          .select("placement_date, age_at_placement_days")
          .eq("id", flock.batch_id)
          .maybeSingle();
        if (batch?.placement_date) {
          setNewAgeSource({
            placement_date: batch.placement_date,
            age_at_placement_days: batch.age_at_placement_days ?? 0,
          });
          return;
        }
      }

      const { data: batch } = await supabase
        .from("batches")
        .select("placement_date, age_at_placement_days")
        .eq("farm_id", flock.farm_id)
        .eq("house_id", flock.house_id)
        .order("placement_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      setNewAgeSource({
        placement_date: batch?.placement_date ?? flock.placement_date ?? null,
        age_at_placement_days: batch?.age_at_placement_days ?? flock.age_at_placement_days ?? 0,
      });
    };

    void loadAgeSource();
  }, [scope.flockId, selectedBatch]);

  useEffect(() => {
    const loadAgeSource = async () => {
      if (!editingRow) {
        setEditAgeSource(null);
        return;
      }

      const flock = filteredFlocks.find((item) => item.id === editingRow.flock_id);
      const localBatch =
        filteredBatches.find((item) => item.id === flock?.batch_id || item.id === scope.batchId) ??
        filteredBatches.find((item) => item.farm_id === flock?.farm_id && item.house_id === flock?.house_id);
      if (localBatch?.placement_date) {
        setEditAgeSource({
          placement_date: localBatch.placement_date,
          age_at_placement_days: localBatch.age_at_placement_days ?? 0,
        });
        return;
      }

      const supabase = createClient();
      const { data: remoteFlock } = await supabase
        .from("flocks")
        .select("batch_id, farm_id, house_id, placement_date, age_at_placement_days")
        .eq("id", editingRow.flock_id)
        .maybeSingle();

      if (!remoteFlock) {
        setEditAgeSource(null);
        return;
      }

      if (remoteFlock.batch_id) {
        const { data: batch } = await supabase
          .from("batches")
          .select("placement_date, age_at_placement_days")
          .eq("id", remoteFlock.batch_id)
          .maybeSingle();
        if (batch?.placement_date) {
          setEditAgeSource({
            placement_date: batch.placement_date,
            age_at_placement_days: batch.age_at_placement_days ?? 0,
          });
          return;
        }
      }

      const { data: batch } = await supabase
        .from("batches")
        .select("placement_date, age_at_placement_days")
        .eq("farm_id", remoteFlock.farm_id)
        .eq("house_id", remoteFlock.house_id)
        .order("placement_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      setEditAgeSource({
        placement_date: batch?.placement_date ?? remoteFlock.placement_date ?? null,
        age_at_placement_days: batch?.age_at_placement_days ?? remoteFlock.age_at_placement_days ?? 0,
      });
    };

    void loadAgeSource();
  }, [editRecordDate, editingRow, filteredBatches, filteredFlocks, scope.batchId]);

  const newRecordAge = useMemo(
    () => calculateFlockAge(newAgeSource?.placement_date, newRecordDate, newAgeSource?.age_at_placement_days),
    [newAgeSource, newRecordDate]
  );
  const editRecordAge = useMemo(() => {
    if (!editingRow) return null;
    return calculateFlockAge(editAgeSource?.placement_date, editRecordDate || editingRow.record_date, editAgeSource?.age_at_placement_days);
  }, [editAgeSource, editRecordDate, editingRow]);
  const currentLiveBirds = selectedFlock?.current_count ?? null;
  const previewProductionPercentage =
    currentLiveBirds && currentLiveBirds > 0 && formTotalEggs !== ""
      ? Number(((Number(formTotalEggs) / currentLiveBirds) * 100).toFixed(2))
      : "";
  const previewMortalityPercentage =
    currentLiveBirds && currentLiveBirds > 0 && formDeaths !== ""
      ? Number(((Number(formDeaths) / currentLiveBirds) * 100).toFixed(2))
      : "";
  const healthInventoryItems = inventoryItems.filter((item)=>["vitamin","supplement","packaging","miscellaneous"].includes(item.category));
  const defaultWarehouseId = warehouses[0]?.id ?? "";
  const addRoutineUsage=()=>setRoutineUsages((rows)=>[...rows,{key:crypto.randomUUID(),itemId:"",warehouseId:defaultWarehouseId,quantity:"",notes:""}]);
  const updateRoutineUsage=(key:string,field:keyof Omit<RoutineUsageRow,"key">,value:string)=>setRoutineUsages((rows)=>rows.map((row)=>row.key===key?{...row,[field]:value}:row));
  const flockLabelMap = useMemo(
    () => new Map(filteredFlocks.map((flock) => [flock.id, flock.flock_code])),
    [filteredFlocks]
  );
  const visibleScopeLabel = scope.flockId
    ? flockLabelMap.get(scope.flockId) ?? "Selected flock"
    : scope.farmId
      ? filteredFarms.find((farm) => farm.id === scope.farmId)?.name ?? "Selected farm"
      : `${filteredFarms.length} farm${filteredFarms.length === 1 ? "" : "s"}`;
  const recordSummary = useMemo(() => {
    const eggRows = rows.filter((row) => row.total_eggs !== null);
    const deathRows = rows.filter((row) => row.deaths !== null);
    const feedRows = rows.filter((row) => row.feed_intake_grams !== null);
    const eggBirdDays = eggRows.reduce((sum, row) => sum + (row.opening_birds ?? row.closing_birds ?? 0), 0);
    const deathBirdDays = deathRows.reduce((sum, row) => sum + (row.opening_birds ?? row.closing_birds ?? 0), 0);
    const eggs = eggRows.length ? eggRows.reduce((sum, row) => sum + (row.total_eggs ?? 0), 0) : null;
    const deaths = deathRows.length ? deathRows.reduce((sum, row) => sum + (row.deaths ?? 0), 0) : null;
    const reconciledRows = rows.filter((row) => expectedClosingBirds(row) !== null && row.closing_birds !== null);
    const balancedRows = reconciledRows.filter((row) => expectedClosingBirds(row) === row.closing_birds);
    const needsReview = rows.filter((row) => {
      const expected = expectedClosingBirds(row);
      return (expected !== null && row.closing_birds !== null && expected !== row.closing_birds) || ((row.deaths ?? 0) > 0 && !row.deaths_cause?.trim());
    }).length;
    const dates = rows.map((row) => row.record_date).sort();
    return {
      eggs,
      deaths,
      feedKg: feedRows.length ? feedRows.reduce((sum, row) => sum + (row.feed_intake_grams ?? 0), 0) / 1000 : null,
      hdep: eggs !== null && eggBirdDays > 0 ? (eggs / eggBirdDays) * 100 : null,
      mortalityPerThousand: deaths !== null && deathBirdDays > 0 ? (deaths / deathBirdDays) * 1000 : null,
      syncedFeedRows: rows.filter((row) => closedFeedDayKeys.has(feedDayKey(row.flock_id, row.record_date))).length,
      reconciliationPct: reconciledRows.length ? (balancedRows.length / reconciledRows.length) * 100 : null,
      needsReview,
      dateFrom: dates[0] ?? null,
      dateTo: dates.at(-1) ?? null,
      todayRows: rows.filter((row) => row.record_date === addisToday()).length,
    };
  }, [closedFeedDayKeys, rows]);

  const buildDailyInventoryUsages = () => {
    const usages: Array<{
      item_id: string;
      warehouse_id: string;
      quantity: number;
      unit_cost: number;
      notes: string;
    }> = [];

    for(const usage of routineUsages){
      const quantity=Number(usage.quantity);
      if(!usage.itemId&&!usage.warehouseId&&!usage.quantity&&!usage.notes)continue;
      if(!usage.itemId||!usage.warehouseId||!Number.isFinite(quantity)||quantity<=0)throw new Error("Complete the item, warehouse, and positive quantity for every routine supply row.");
      const item=healthInventoryItems.find((candidate)=>candidate.id===usage.itemId);
      if(!item)throw new Error("Daily Records accepts only vitamins, supplements, packaging, and general supplies.");
      usages.push({
        item_id: usage.itemId,
        warehouse_id: usage.warehouseId,
        quantity,
        unit_cost: item?.unit_cost ?? 0,
        notes: usage.notes.trim() || "Routine Daily Record supply usage",
      });
    }

    return usages;
  };

  const saveDailyRecord = async (form: HTMLFormElement, rowId?: string) => {
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    if (!canCreateRecord) {
      setFormError("Only farm managers can change daily records.");
      setIsSubmitting(false);
      return;
    }

    if (!scope.farmId || !scope.houseId || !scope.flockId) {
      setFormError("Select farm, house, and flock from scope filters first.");
      setIsSubmitting(false);
      return;
    }

    if (!filteredHouses.some((house) => house.id === scope.houseId)) {
      setFormError("Selected house is not valid for selected farm.");
      setIsSubmitting(false);
      return;
    }

    if (!filteredFlocks.some((flock) => flock.id === scope.flockId && flock.house_id === scope.houseId)) {
      setFormError("Selected flock is not valid for selected house.");
      setIsSubmitting(false);
      return;
    }

    if (scope.batchId && !filteredFlocks.some((flock) => flock.id === scope.flockId && flock.batch_id === scope.batchId)) {
      setFormError("Selected batch is not valid for selected flock.");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(form);
    const recordDate = formData.get("record_date")?.toString();
    if (!recordDate) {
      setFormError("Record date is required.");
      setIsSubmitting(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setFormError("Unable to verify your session.");
      setIsSubmitting(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.org_id) {
      setFormError("Organization not found for this user.");
      setIsSubmitting(false);
      return;
    }

    const { data: flockMeta, error: flockError } = await supabase
      .from("flocks")
      .select("current_count, batch_id, farm_id, house_id")
      .eq("id", scope.flockId)
      .single();
    if (flockError || !flockMeta) {
      setFormError("Unable to load current flock count.");
      setIsSubmitting(false);
      return;
    }

    const currentBirds = flockMeta.current_count ?? 0;
    const batchIdForAge = scope.batchId || flockMeta.batch_id;
    const localBatch =
      filteredBatches.find((batch) => batch.id === batchIdForAge) ??
      filteredBatches.find((batch) => batch.farm_id === flockMeta.farm_id && batch.house_id === flockMeta.house_id);
    let placementDate = localBatch?.placement_date ?? null;
    let ageAtPlacementDays = localBatch?.age_at_placement_days ?? 0;

    if (!placementDate && batchIdForAge) {
      const { data: batchMeta } = await supabase
        .from("batches")
        .select("placement_date, age_at_placement_days")
        .eq("id", batchIdForAge)
        .maybeSingle();
      placementDate = batchMeta?.placement_date ?? null;
      ageAtPlacementDays = batchMeta?.age_at_placement_days ?? 0;
    }

    if (!placementDate) {
      const { data: batchMeta } = await supabase
        .from("batches")
        .select("placement_date, age_at_placement_days")
        .eq("org_id", profile.org_id)
        .eq("farm_id", flockMeta.farm_id)
        .eq("house_id", flockMeta.house_id)
        .order("placement_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      placementDate = batchMeta?.placement_date ?? null;
      ageAtPlacementDays = batchMeta?.age_at_placement_days ?? 0;
    }

    const flockAge = calculateFlockAge(placementDate, recordDate, ageAtPlacementDays);
    if (!flockAge) {
      setFormError("Unable to calculate flock age. Check that the selected batch has a placement date and the record date is not before placement.");
      setIsSubmitting(false);
      return;
    }

    const totalEggs = parseNumber(formData.get("total_eggs"));
    const deaths = parseNumber(formData.get("deaths")) ?? 0;
    const productionPercentage =
      currentBirds > 0 && totalEggs !== null ? Number(((totalEggs / currentBirds) * 100).toFixed(2)) : null;
    const mortalityPercentage =
      currentBirds > 0 ? Number(((deaths / currentBirds) * 100).toFixed(2)) : null;

    const payload = {
      org_id: profile.org_id,
      flock_id: scope.flockId,
      record_date: recordDate,
      flock_age_weeks: flockAge.weeks,
      flock_age_days: flockAge.days,
      feed_leftover_grams: parseNumber(formData.get("feed_leftover_grams")),
      normal_eggs: parseNumber(formData.get("normal_eggs")),
      broken_eggs: parseNumber(formData.get("broken_eggs")),
      total_eggs: totalEggs,
      production_percentage: productionPercentage,
      deaths,
      mortality_percentage: mortalityPercentage,
      deaths_cause: parseText(formData.get("deaths_cause")),
      vaccination_status: parseText(formData.get("vaccination_status")),
      medication_vitamins: parseText(formData.get("medication_vitamins")),
      opening_birds: parseNumber(formData.get("opening_birds")),
      closing_birds: parseNumber(formData.get("closing_birds")),
      culls: parseNumber(formData.get("culls")) ?? 0,
      transfers_in: parseNumber(formData.get("transfers_in")) ?? 0,
      transfers_out: parseNumber(formData.get("transfers_out")) ?? 0,
      other_removals: parseNumber(formData.get("other_removals")) ?? 0,
      dirty_eggs: parseNumber(formData.get("dirty_eggs")),
      average_egg_weight_g: parseNumber(formData.get("average_egg_weight_g")),
      water_consumed_liters: parseNumber(formData.get("water_consumed_liters")),
      recorded_by: user.id,
    };

    let usages;
    try {
      usages = buildDailyInventoryUsages();
    } catch (usageError) {
      setFormError(usageError instanceof Error ? usageError.message : "Inventory usage is invalid.");
      setIsSubmitting(false);
      return;
    }

    const saveResponse = await fetch("/api/inventory/daily-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        daily_record_id: rowId ?? null,
        flock_id: scope.flockId,
        record: payload,
        usages: rowId && usages.length === 0 ? null : usages,
      }),
    });
    const saveResult = await saveResponse.json();
    if (!saveResponse.ok) {
      setFormError(saveResult?.error ?? "Could not save the daily record and inventory usage.");
      setIsSubmitting(false);
      return;
    }

    setFormSuccess(
      rowId
        ? "Daily record updated successfully."
        : usages.length > 0
          ? "Daily record saved and inventory usage issued."
          : "Daily record saved successfully."
    );
    form.reset();
    setNewRecordDate(addisToday());
    setEditRecordDate("");
    setFormTotalEggs("");
    setFormDeaths("");
    setRoutineUsages([]);
    setEditingRow(null);
    setIsSubmitting(false);
    setIsModalOpen(false);
    await loadRows();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await saveDailyRecord(event.currentTarget);
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingRow) return;
    await saveDailyRecord(event.currentTarget, editingRow.id);
  };

  const deleteRecord = async (row: DailyRow) => {
    if (closedFeedDayKeys.has(feedDayKey(row.flock_id, row.record_date))) {
      setFormError("Reopen the feeding day before deleting its Daily Record.");
      return;
    }
    if (!canCreateRecord) return;const reason=window.prompt(`Void daily record for ${row.record_date}? Enter the reason:`)?.trim();if(!reason)return;
    setFormError(null);
    const response=await fetch("/api/governance/void",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({table:"daily_farm_records",id:row.id,reason})});const payload=await response.json();
    if (!response.ok) {
      setFormError(payload.error??"Unable to void record.");
      return;
    }
    setFormSuccess("Daily record voided. Its original values remain in the audit history.");
    await loadRows();
  };

  const inputClass = "h-11 w-full min-w-0 rounded-xl border border-sand-200 bg-white px-3 text-sm text-forest-900 outline-none transition focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20";
  const filterLabelClass = "grid min-w-0 gap-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-forest-500";

  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0 space-y-5 overflow-x-hidden px-3 sm:px-4">
      <header className="relative overflow-hidden rounded-3xl border border-forest-700 bg-forest-900 p-5 text-white shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border-[40px] border-amber-400/10" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.22em] text-amber-300"><ClipboardCheck className="h-4 w-4" aria-hidden="true" />Daily operations closebook</div>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">Close the day with a record you can trust</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100">Reconcile bird movement, capture production and losses, and preserve the evidence behind farm decisions. Feed totals arrive from Feed Control after the feeding day is closed.</p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-white/10 bg-white/[.07] px-4 py-3 text-xs">
              <p className="text-sand-300">Current scope</p><p className="mt-1 max-w-[220px] font-semibold text-white">{visibleScopeLabel}</p>
            </div>
            {canCreateRecord ? (
              <button type="button" onClick={() => { setNewRecordDate(addisToday()); setFormError(null); setFormSuccess(null); setIsModalOpen(true); }} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sand-50 px-5 text-sm font-semibold text-forest-900 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
                <Plus className="h-4 w-4" aria-hidden="true" />New daily record
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {!canCreateRecord ? <div className="flex items-start gap-3 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 text-sm text-sky-800"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="font-semibold">View-only access</p><p className="mt-1 text-xs leading-5">Only farm managers can create, correct, or delete Daily Records.</p></div></div> : null}
      {formError ? <div role="alert" className="flex items-start gap-3 rounded-2xl border border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-500"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Daily record needs attention</p><p className="mt-1">{formError}</p></div></div> : null}
      {formSuccess ? <div role="status" className="flex items-start gap-3 rounded-2xl border border-leaf-500/30 bg-leaf-500/10 p-4 text-sm text-forest-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" aria-hidden="true" /><div><p className="font-semibold">Daily Records updated</p><p className="mt-1">{formSuccess}</p></div></div> : null}

      <section className="grid overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm sm:grid-cols-2 xl:grid-cols-6">
        <article className="border-b border-sand-200 p-4 sm:border-r xl:border-b-0"><ClipboardCheck className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">Visible records</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums text-forest-900">{loadingRows ? "…" : rows.length.toLocaleString()}</p><p className="mt-1 text-[11px] text-forest-600">{recordSummary.todayRows} dated today in this view</p></article>
        <article className="border-b border-sand-200 p-4 xl:border-b-0 xl:border-r"><ShieldCheck className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">Bird reconciliation</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums text-forest-900">{displayNumber(recordSummary.reconciliationPct, "%", 0)}</p><p className="mt-1 text-[11px] text-forest-600">Opening-to-closing ledger balance</p></article>
        <article className="border-b border-sand-200 p-4 sm:border-r xl:border-b-0"><Egg className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">Recorded eggs</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums text-forest-900">{displayNumber(recordSummary.eggs, "", 0)}</p><p className="mt-1 text-[11px] text-forest-600">Period HDEP {displayNumber(recordSummary.hdep, "%")}</p></article>
        <article className="border-b border-sand-200 p-4 xl:border-b-0 xl:border-r"><Wheat className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">Synchronized feed</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums text-forest-900">{displayNumber(recordSummary.feedKg, " kg")}</p><p className="mt-1 text-[11px] text-forest-600">{recordSummary.syncedFeedRows} Feed Control close{recordSummary.syncedFeedRows === 1 ? "" : "s"}</p></article>
        <article className="border-b border-sand-200 p-4 sm:border-b-0 sm:border-r"><HeartPulse className="h-4 w-4 text-forest-500" aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">Mortality pressure</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums text-forest-900">{displayNumber(recordSummary.mortalityPerThousand, " / 1k", 2)}</p><p className="mt-1 text-[11px] text-forest-600">{displayNumber(recordSummary.deaths, " deaths", 0)}</p></article>
        <article className="p-4"><AlertTriangle className={`h-4 w-4 ${recordSummary.needsReview > 0 ? "text-ember-500" : "text-leaf-600"}`} aria-hidden="true" /><p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">Requires review</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums text-forest-900">{recordSummary.needsReview}</p><p className="mt-1 text-[11px] text-forest-600">Ledger gaps or deaths without cause</p></article>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-leaf-500/30 bg-leaf-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-forest-700 shadow-sm"><Wheat className="h-5 w-5" aria-hidden="true" /></div><div><p className="text-sm font-semibold text-forest-900">Feed stays controlled by Today’s Feeding</p><p className="mt-1 text-xs leading-5 text-forest-600">Close the flock’s feeding day to synchronize its actual total and feed type here. Daily Records keeps feed leftover editable and will not issue feed twice.</p></div></div>
        <Link href="/app/feeding-log" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-forest-700 px-4 text-xs font-semibold text-forest-800 transition hover:bg-white">Open Today’s Feeding <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Record scope</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Find a daily close sheet</h2><p className="mt-1 text-xs text-forest-600">Scope and date filters update the ledger below.</p></div>
          <button type="button" onClick={() => void loadRows()} disabled={loadingRows} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-sand-200 px-4 text-xs font-semibold text-forest-700 transition hover:border-forest-400 hover:bg-sand-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loadingRows ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</button>
        </div>
        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          {role === "ceo" ? <label className={filterLabelClass}>Branch<select className={inputClass} value={scope.branchId} onChange={(event) => setScope((prev) => ({ ...prev, branchId: event.target.value, farmId: "", houseId: "", flockId: "", batchId: "" }))}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label> : null}
          <label className={filterLabelClass}>Farm
            <select
              className={inputClass}
              value={scope.farmId}
              onChange={(event) =>
                setScope((prev) => ({
                  ...prev,
                  farmId: event.target.value,
                  houseId: "",
                  flockId: "",
                  batchId: "",
                }))
              }
            >
              <option value="">All farms</option>
              {filteredFarms.map((farm) => (
                <option key={farm.id} value={farm.id}>{farm.name}</option>
              ))}
            </select>
          </label>
          <label className={filterLabelClass}>House
            <select
              className={inputClass}
              value={scope.houseId}
              onChange={(event) =>
                setScope((prev) => ({
                  ...prev,
                  houseId: event.target.value,
                  flockId: "",
                  batchId: "",
                }))
              }
            >
              <option value="">All houses</option>
              {filteredHouses.map((house) => (
                <option key={house.id} value={house.id}>{house.name}</option>
              ))}
            </select>
          </label>
          <label className={filterLabelClass}>Flock
            <select
              className={inputClass}
              value={scope.flockId}
              onChange={(event) =>
                setScope((prev) => ({
                  ...prev,
                  flockId: event.target.value,
                  batchId: "",
                }))
              }
            >
              <option value="">All flocks</option>
              {filteredFlocks.map((flock) => (
                <option key={flock.id} value={flock.id}>{flock.flock_code}</option>
              ))}
            </select>
          </label>
          <label className={filterLabelClass}>Batch
            <select
              className={inputClass}
              value={scope.batchId}
              onChange={(event) => setScope((prev) => ({ ...prev, batchId: event.target.value }))}
            >
              <option value="">All batches</option>
              {filteredBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.batch_code}</option>
              ))}
            </select>
          </label>
          <label className={filterLabelClass}>Date mode
            <select
              className={inputClass}
              value={dateFilterMode}
              onChange={(event) => setDateFilterMode(event.target.value as "single" | "range")}
            >
              <option value="single">Single day</option><option value="range">Date range</option>
            </select>
          </label>
          {dateFilterMode === "single" ? (
            <label className={filterLabelClass}>Date<input className={inputClass} type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} /></label>
          ) : null}
          {dateFilterMode === "range" ? (
            <label className={filterLabelClass}>From<input className={inputClass} type="date" value={filterDateFrom} onChange={(event) => setFilterDateFrom(event.target.value)} /></label>
          ) : null}
          {dateFilterMode === "range" ? (
            <label className={filterLabelClass}>To<input className={inputClass} type="date" value={filterDateTo} onChange={(event) => setFilterDateTo(event.target.value)} /></label>
          ) : null}
          <label className={filterLabelClass}>Reset
            <button
              type="button"
              className="h-11 rounded-xl border border-sand-200 px-3 text-sm font-medium normal-case tracking-normal text-forest-700 transition hover:border-forest-400 hover:bg-sand-50"
              onClick={() => {
                setScope((prev) => ({ ...prev, farmId: "", houseId: "", flockId: "", batchId: "" }));
                setDateFilterMode("single");
                setFilterDate("");
                setFilterDateFrom("");
                setFilterDateTo("");
              }}
            >
              Clear filters
            </button>
          </label>
        </div>
      </section>

      <section className="max-w-full min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-sand-200 p-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Operational evidence</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Daily record ledger</h2><p className="mt-1 text-xs text-forest-600">{recordSummary.dateFrom && recordSummary.dateTo ? `${formatRecordDate(recordSummary.dateFrom)} – ${formatRecordDate(recordSummary.dateTo)}` : "No dates in the current view"}. Wide detail scrolls only inside this card.</p></div><div className="flex items-center gap-2 text-[11px] text-forest-600"><span className="h-2.5 w-2.5 rounded-full bg-leaf-500" />Balanced <span className="ml-2 h-2.5 w-2.5 rounded-full bg-ember-500" />Review</div></div>

        <div className="grid gap-3 p-4 md:hidden">
          {loadingRows ? <div className="h-40 animate-pulse rounded-xl bg-sand-100" /> : rows.map((row) => {
            const expected = expectedClosingBirds(row);
            const balanced = expected !== null && row.closing_birds !== null ? expected === row.closing_birds : null;
            const feedClosed = closedFeedDayKeys.has(feedDayKey(row.flock_id, row.record_date));
            return <article key={row.id} className="rounded-2xl border border-sand-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-display text-lg font-semibold text-forest-900">{flockLabelMap.get(row.flock_id) ?? "Unknown flock"}</p><p className="mt-1 inline-flex items-center gap-1.5 text-xs text-forest-500"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{formatRecordDate(row.record_date)} · week {row.flock_age_weeks ?? "—"}</p></div>{balanced === false || ((row.deaths ?? 0) > 0 && !row.deaths_cause) ? <span className="rounded-full bg-ember-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-ember-600">Review</span> : <span className="rounded-full bg-leaf-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-forest-700">Recorded</span>}</div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-sand-50 p-3"><span className="text-[10px] uppercase tracking-[.1em] text-forest-500">Birds</span><strong className="mt-1 block text-sm text-forest-900">{displayNumber(row.opening_birds, "", 0)} → {displayNumber(row.closing_birds, "", 0)}</strong><span className="mt-1 block text-[10px] text-forest-500">{balanced === null ? "Not reconciled" : balanced ? "Ledger balanced" : `Expected ${expected}`}</span></div><div className="rounded-xl bg-sand-50 p-3"><span className="text-[10px] uppercase tracking-[.1em] text-forest-500">Eggs / HDEP</span><strong className="mt-1 block text-sm text-forest-900">{displayNumber(row.total_eggs, "", 0)} · {displayNumber(row.production_percentage, "%")}</strong></div><div className="rounded-xl bg-sand-50 p-3"><span className="text-[10px] uppercase tracking-[.1em] text-forest-500">Feed</span><strong className="mt-1 block text-sm text-forest-900">{displayNumber(row.feed_intake_grams === null ? null : row.feed_intake_grams / 1000, " kg")}</strong><span className="mt-1 block text-[10px] text-forest-500">{feedClosed ? "Synced from Feed Control" : row.feed_intake_grams !== null ? "Legacy record" : "Not recorded"}</span></div><div className="rounded-xl bg-sand-50 p-3"><span className="text-[10px] uppercase tracking-[.1em] text-forest-500">Deaths</span><strong className="mt-1 block text-sm text-forest-900">{displayNumber(row.deaths, "", 0)} · {displayNumber(row.mortality_percentage, "%")}</strong><span className="mt-1 block truncate text-[10px] text-forest-500">{row.deaths_cause || "No cause recorded"}</span></div></div>{canCreateRecord ? <div className="mt-4 flex gap-2 border-t border-sand-200 pt-3"><button type="button" onClick={() => { const flock = filteredFlocks.find((item) => item.id === row.flock_id); if (flock) setScope((prev) => ({ ...prev, farmId: flock.farm_id, houseId: flock.house_id, flockId: flock.id, batchId: "" })); setEditRecordDate(row.record_date); setEditingRow(row); }} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-sand-200 text-xs font-semibold text-forest-700"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button><button type="button" disabled={feedClosed} title={feedClosed ? "Reopen the feeding day before deleting this record." : "Delete daily record"} onClick={() => void deleteRecord(row)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-ember-500/30 px-4 text-xs font-semibold text-ember-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete</button></div> : null}</article>;
          })}
          {!loadingRows && rows.length === 0 ? <div className="rounded-2xl border border-dashed border-sand-300 bg-sand-50 p-8 text-center"><ClipboardCheck className="mx-auto h-6 w-6 text-forest-400" aria-hidden="true" /><p className="mt-3 text-sm font-semibold text-forest-900">No daily records match this view</p><p className="mt-1 text-xs text-forest-600">Adjust the date or farm filters, or create the first close sheet.</p></div> : null}
        </div>

        <div className="hidden max-w-full overflow-x-auto md:block">
          <table className="min-w-[1420px] w-full text-left text-sm">
            <thead><tr className="border-b border-sand-200 bg-sand-50 text-[10px] uppercase tracking-[.12em] text-forest-500"><th className="sticky left-0 z-10 min-w-[210px] bg-sand-50 px-5 py-3">Date / flock</th><th className="px-4 py-3">Age</th><th className="px-4 py-3">Bird ledger</th><th className="px-4 py-3">Egg output</th><th className="px-4 py-3">Feed control</th><th className="px-4 py-3">Mortality</th><th className="px-4 py-3">Water</th><th className="px-4 py-3">Health notes</th>{canCreateRecord ? <th className="px-5 py-3">Actions</th> : null}</tr></thead>
            <tbody>{loadingRows ? <tr><td colSpan={canCreateRecord ? 9 : 8} className="px-5 py-10 text-center text-forest-600">Loading the daily ledger…</td></tr> : rows.length === 0 ? <tr><td colSpan={canCreateRecord ? 9 : 8} className="px-5 py-12 text-center"><ClipboardCheck className="mx-auto h-6 w-6 text-forest-400" aria-hidden="true" /><p className="mt-3 font-semibold text-forest-900">No daily records match this view</p><p className="mt-1 text-xs text-forest-600">Adjust the date or farm filters, or create the first close sheet.</p></td></tr> : rows.map((row) => {
              const expected = expectedClosingBirds(row);
              const balanced = expected !== null && row.closing_birds !== null ? expected === row.closing_birds : null;
              const feedClosed = closedFeedDayKeys.has(feedDayKey(row.flock_id, row.record_date));
              return <tr key={row.id} className="border-b border-sand-100 align-top last:border-0 hover:bg-sand-50/50"><td className="sticky left-0 z-[5] bg-white px-5 py-4"><p className="font-semibold text-forest-900">{flockLabelMap.get(row.flock_id) ?? row.flock_id}</p><p className="mt-1 text-xs text-forest-500">{formatRecordDate(row.record_date)}</p></td><td className="px-4 py-4"><p className="tabular-nums text-forest-900">Week {row.flock_age_weeks ?? "—"}</p><p className="mt-1 text-[11px] text-forest-500">Day {row.flock_age_days ?? "—"}</p></td><td className="px-4 py-4"><p className="font-medium tabular-nums text-forest-900">{displayNumber(row.opening_birds, "", 0)} → {displayNumber(row.closing_birds, "", 0)}</p><p className={`mt-1 text-[11px] ${balanced === false ? "text-ember-600" : "text-forest-500"}`}>{balanced === null ? "Not reconciled" : balanced ? "Balanced" : `Expected closing ${expected}`}</p><p className="mt-1 text-[10px] text-forest-400">In {row.transfers_in ?? 0} · out {(row.transfers_out ?? 0) + (row.culls ?? 0) + (row.other_removals ?? 0)}</p></td><td className="px-4 py-4"><p className="font-medium tabular-nums text-forest-900">{displayNumber(row.total_eggs, " eggs", 0)} · {displayNumber(row.production_percentage, "%")}</p><p className="mt-1 text-[11px] text-forest-500">Normal {row.normal_eggs ?? "—"} · broken {row.broken_eggs ?? "—"} · dirty {row.dirty_eggs ?? "—"}</p><p className="mt-1 text-[10px] text-forest-400">Avg weight {displayNumber(row.average_egg_weight_g, " g")}</p></td><td className="px-4 py-4"><p className="font-medium tabular-nums text-forest-900">{displayNumber(row.feed_intake_grams === null ? null : row.feed_intake_grams / 1000, " kg")}</p><p className="mt-1 text-[11px] text-forest-500">{row.feed_type ? feedTypeLabels.get(row.feed_type) ?? row.feed_type : "Type unavailable"}</p><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${feedClosed ? "bg-leaf-500/15 text-forest-800" : row.feed_intake_grams !== null ? "bg-sand-100 text-forest-700" : "bg-sky-500/10 text-sky-700"}`}>{feedClosed ? "Synced from Feed Control" : row.feed_intake_grams !== null ? "Legacy record" : "Not recorded"}</span><p className="mt-1 text-[10px] text-forest-400">Leftover {displayNumber(row.feed_leftover_grams, " g")}</p></td><td className="px-4 py-4"><p className="font-medium tabular-nums text-forest-900">{displayNumber(row.deaths, " deaths", 0)} · {displayNumber(row.mortality_percentage, "%")}</p><p className={`mt-1 max-w-[180px] text-[11px] leading-4 ${(row.deaths ?? 0) > 0 && !row.deaths_cause ? "font-semibold text-ember-600" : "text-forest-500"}`}>{row.deaths_cause || ((row.deaths ?? 0) > 0 ? "Cause required" : "No loss recorded")}</p></td><td className="px-4 py-4"><p className="inline-flex items-center gap-1.5 tabular-nums text-forest-900"><Droplets className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />{displayNumber(row.water_consumed_liters, " L")}</p></td><td className="max-w-[220px] px-4 py-4"><p className="text-[11px] leading-4 text-forest-700">{row.vaccination_status || "No vaccination note"}</p><p className="mt-1 text-[10px] leading-4 text-forest-500">{row.medication_vitamins || "No treatment or vitamin note"}</p></td>{canCreateRecord ? <td className="px-5 py-4"><div className="flex gap-2"><button type="button" onClick={() => { const flock = filteredFlocks.find((item) => item.id === row.flock_id); if (flock) setScope((prev) => ({ ...prev, farmId: flock.farm_id, houseId: flock.house_id, flockId: flock.id, batchId: "" })); setEditRecordDate(row.record_date); setEditingRow(row); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-sand-200 px-3 text-xs font-semibold text-forest-700 hover:border-forest-400"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button><button type="button" disabled={feedClosed} title={feedClosed ? "Reopen the feeding day before deleting this record." : "Delete daily record"} onClick={() => void deleteRecord(row)} className="grid h-9 w-9 place-items-center rounded-lg border border-ember-500/30 text-ember-600 hover:bg-ember-500/10 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">Delete record</span></button></div></td> : null}</tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      {isModalOpen && canCreateRecord ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-900/70 p-3 backdrop-blur-sm sm:p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="new-daily-record-title" className="mx-auto min-h-full w-full max-w-6xl overflow-hidden rounded-3xl bg-sand-50 shadow-2xl">
            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/10 bg-forest-900 px-5 py-4 text-white sm:px-6">
              <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">Daily close sheet</p><h3 id="new-daily-record-title" className="mt-1 font-display text-2xl font-semibold">New Daily Record</h3><p className="mt-1 text-xs text-sand-200">Work from identity through reconciliation, production, feed context and health notes.</p></div>
              <button aria-label="Close new daily record" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-sand-100 transition hover:bg-white/10" type="button" onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <form className="grid gap-4 p-4 sm:p-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-4 md:grid-cols-4">
                <div className="md:col-span-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">01 · Bird movement</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Reconcile the flock count</h4><p className="mt-1 text-xs text-forest-600">Start with opening birds, then account for every movement before entering the close.</p></div>
                <label className="grid gap-2 text-sm text-forest-700">Opening Birds<input name="opening_birds" type="number" min={0} defaultValue={currentLiveBirds ?? ""} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Closing Birds<input name="closing_birds" type="number" min={0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Culls<input name="culls" type="number" min={0} defaultValue={0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Transfers In<input name="transfers_in" type="number" min={0} defaultValue={0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Transfers Out<input name="transfers_out" type="number" min={0} defaultValue={0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Other Removals<input name="other_removals" type="number" min={0} defaultValue={0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Water Consumed (L)<input name="water_consumed_liters" type="number" min={0} step="0.01" className={inputClass} /></label>
                <div className="rounded-xl bg-sand-50 p-3 text-xs text-forest-600">Closing birds should reconcile to opening + transfers in − deaths − culls − transfers out − other removals.</div>
              </div>

              <div className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-4 md:grid-cols-4">
                <div className="md:col-span-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">02 · Record identity</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Fix the record to one flock and date</h4></div>
                <label className="grid gap-2 text-sm text-forest-700">
                  Record Date
                  <input
                    name="record_date"
                    type="date"
                    required
                    value={newRecordDate}
                    onChange={(event) => setNewRecordDate(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Age Weeks
                  <input
                    name="flock_age_weeks"
                    type="number"
                    min={0}
                    readOnly
                    value={newRecordAge?.weeks ?? ""}
                    className={`${inputClass} bg-sand-50 text-forest-600`}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Age Days
                  <input
                    name="flock_age_days"
                    type="number"
                    min={0}
                    readOnly
                    value={newRecordAge?.days ?? ""}
                    className={`${inputClass} bg-sand-50 text-forest-600`}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Farm
                  <select
                    className={inputClass}
                    value={scope.farmId}
                    onChange={(event) =>
                      setScope((prev) => ({ ...prev, farmId: event.target.value, houseId: "", flockId: "", batchId: "" }))
                    }
                  >
                    <option value="">Select Farm</option>
                    {filteredFarms.map((farm) => (
                      <option key={farm.id} value={farm.id}>{farm.name}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  House
                  <select
                    className={inputClass}
                    value={scope.houseId}
                    onChange={(event) =>
                      setScope((prev) => ({ ...prev, houseId: event.target.value, flockId: "", batchId: "" }))
                    }
                  >
                    <option value="">Select House</option>
                    {filteredHouses.map((house) => (
                      <option key={house.id} value={house.id}>{house.name}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Flock
                  <select
                    className={inputClass}
                    value={scope.flockId}
                    onChange={(event) => setScope((prev) => ({ ...prev, flockId: event.target.value, batchId: "" }))}
                  >
                    <option value="">Select Flock</option>
                    {filteredFlocks.map((flock) => (
                      <option key={flock.id} value={flock.id}>{flock.flock_code}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Batch
                  <select
                    className={inputClass}
                    value={scope.batchId}
                    onChange={(event) => setScope((prev) => ({ ...prev, batchId: event.target.value }))}
                  >
                    <option value="">Select Batch</option>
                    {filteredBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>{batch.batch_code}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 rounded-2xl border border-leaf-500/30 bg-leaf-500/5 p-4 md:grid-cols-4">
                <div className="md:col-span-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">03 · Feed handoff</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Record leftovers; Feed Control supplies consumption</h4></div>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Leftover (grams)
                  <input name="feed_leftover_grams" type="number" min={0} step="0.01" className={inputClass} />
                </label>
                <div className="rounded-xl border border-leaf-500/30 bg-leaf-500/10 p-3 text-sm text-forest-700 md:col-span-3">
                  Feed intake and feed type will be synchronized after this flock’s feeding day is closed.
                  <Link href="/app/feeding-log" className="ml-1 font-semibold underline underline-offset-4">Open Today’s Feeding</Link>
                </div>
              </div>

              <div className="rounded-2xl border border-sand-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">04 · Routine supplies</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Record every routine item used today</h4><p className="mt-1 text-xs text-forest-600">Vitamins, supplements, packaging, and general supplies only. Treatments and vaccines belong in Health Log.</p></div><button type="button" onClick={addRoutineUsage} className="rounded-xl border border-forest-900 px-4 py-2 text-xs font-semibold text-forest-900">+ Add usage row</button></div>
                <div className="mt-4 space-y-3">{routineUsages.map((usage)=><div key={usage.key} className="grid gap-3 rounded-xl bg-sand-50 p-3 md:grid-cols-[1.2fr_1fr_.7fr_1.2fr_auto]"><select aria-label="Routine supply item" value={usage.itemId} onChange={(event)=>updateRoutineUsage(usage.key,"itemId",event.target.value)} className={inputClass}><option value="">Select item</option>{healthInventoryItems.map((item)=><option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select><select aria-label="Routine supply warehouse" value={usage.warehouseId} onChange={(event)=>updateRoutineUsage(usage.key,"warehouseId",event.target.value)} className={inputClass}><option value="">Select warehouse</option>{warehouses.map((warehouse)=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select><input aria-label="Routine supply quantity" value={usage.quantity} onChange={(event)=>updateRoutineUsage(usage.key,"quantity",event.target.value)} type="number" min={0} step="0.001" placeholder="Quantity" className={inputClass}/><input aria-label="Routine supply reason" value={usage.notes} onChange={(event)=>updateRoutineUsage(usage.key,"notes",event.target.value)} placeholder="Purpose or area used" className={inputClass}/><button type="button" aria-label="Remove usage row" onClick={()=>setRoutineUsages((rows)=>rows.filter((row)=>row.key!==usage.key))} className="h-11 rounded-xl border border-red-200 px-3 text-red-600">Remove</button></div>)}</div>
                {!routineUsages.length?<p className="mt-4 rounded-xl bg-sand-50 p-4 text-sm text-forest-600">No routine supplies recorded. Add a row only when stock was actually used.</p>:null}
              </div>

              <div className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-4 md:grid-cols-4">
                <div className="md:col-span-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">05 · Production and loss</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Capture output, water and mortality</h4><p className="mt-1 text-xs text-forest-600">Calculated percentages update from the selected flock’s current bird count.</p></div>
                <label className="grid gap-2 text-sm text-forest-700">
                  Current Live Birds
                  <input value={currentLiveBirds ?? ""} readOnly className={`${inputClass} bg-sand-50 text-forest-600`} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Normal Eggs
                  <input name="normal_eggs" type="number" min={0} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Broken Eggs
                  <input name="broken_eggs" type="number" min={0} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">Dirty Eggs<input name="dirty_eggs" type="number" min={0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Average Egg Weight (g)<input name="average_egg_weight_g" type="number" min={0} step="0.01" className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Total Eggs
                  <input
                    name="total_eggs"
                    type="number"
                    min={0}
                    className={inputClass}
                    value={formTotalEggs}
                    onChange={(event) => setFormTotalEggs(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Production %
                  <input
                    name="production_percentage"
                    type="number"
                    min={0}
                    step="0.01"
                    readOnly
                    value={previewProductionPercentage}
                    className={`${inputClass} bg-sand-50 text-forest-600`}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Number of Deaths
                  <input
                    name="deaths"
                    type="number"
                    min={0}
                    className={inputClass}
                    value={formDeaths}
                    onChange={(event) => setFormDeaths(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Death %
                  <input
                    name="mortality_percentage"
                    type="number"
                    min={0}
                    step="0.01"
                    readOnly
                    value={previewMortalityPercentage}
                    className={`${inputClass} bg-sand-50 text-forest-600`}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Cause of Death
                  <input name="deaths_cause" type="text" className={inputClass} />
                </label>
              </div>

              <div className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-4 md:grid-cols-2">
                <div className="md:col-span-2"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">06 · Health notes</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Leave context for the next shift</h4></div>
                <label className="grid gap-2 text-sm text-forest-700">
                  Vaccination Status
                  <input name="vaccination_status" type="text" placeholder="ND booster, IB, none..." className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Treatment/Vitamins
                  <input name="medication_vitamins" type="text" placeholder="Vit-C in water, probiotics..." className={inputClass} />
                </label>
              </div>

              {formError ? (
                <p className="rounded-xl border border-ember-500/40 bg-ember-500/10 px-4 py-3 text-sm text-ember-500">
                  {formError}
                </p>
              ) : null}
              {formSuccess ? (
                <p className="rounded-xl border border-leaf-500/40 bg-leaf-500/10 px-4 py-3 text-sm text-leaf-500">
                  {formSuccess}
                </p>
              ) : null}

              <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col-reverse gap-3 border-t border-sand-200 bg-white/95 p-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:p-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="min-h-11 rounded-xl border border-forest-900/20 px-4 text-sm font-semibold text-forest-700"
                >
                  Cancel
                </button>
                <button
                  className="min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-sand-50 disabled:opacity-60"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Daily Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingRow && canCreateRecord ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-forest-900/70 p-3 backdrop-blur-sm sm:p-6">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-daily-record-title" className="mx-auto min-h-full w-full max-w-6xl overflow-hidden rounded-3xl bg-sand-50 shadow-2xl">
            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-white/10 bg-forest-900 px-5 py-4 text-white sm:px-6">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">Correction sheet</p>
                <h3 id="edit-daily-record-title" className="mt-1 font-display text-2xl font-semibold">Edit Daily Record</h3>
                <p className="mt-1 text-xs text-sand-200">Correct this canonical flock-day without overwriting Feed Control totals.</p>
              </div>
              <button aria-label="Close daily record editor" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-sand-100 transition hover:bg-white/10" type="button" onClick={() => setEditingRow(null)}><X className="h-4 w-4" aria-hidden="true" /></button>
            </div>

            <form className="grid gap-4 p-4 sm:p-6" onSubmit={handleEditSubmit}>
              <div className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-4 md:grid-cols-4">
                <div className="md:col-span-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">01 · Bird movement</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Correct the flock reconciliation</h4></div>
                <label className="grid gap-2 text-sm text-forest-700">Opening Birds<input name="opening_birds" type="number" min={0} defaultValue={editingRow.opening_birds ?? ""} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Closing Birds<input name="closing_birds" type="number" min={0} defaultValue={editingRow.closing_birds ?? ""} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Culls<input name="culls" type="number" min={0} defaultValue={editingRow.culls ?? 0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Transfers In<input name="transfers_in" type="number" min={0} defaultValue={editingRow.transfers_in ?? 0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Transfers Out<input name="transfers_out" type="number" min={0} defaultValue={editingRow.transfers_out ?? 0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Other Removals<input name="other_removals" type="number" min={0} defaultValue={editingRow.other_removals ?? 0} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Water Consumed (L)<input name="water_consumed_liters" type="number" min={0} step="0.01" defaultValue={editingRow.water_consumed_liters ?? ""} className={inputClass} /></label>
              </div>

              <div className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-4 md:grid-cols-4">
                <div className="md:col-span-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">02 · Record identity</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Confirm flock, date and calculated age</h4></div>
                <label className="grid gap-2 text-sm text-forest-700">
                  Record Date
                  <input
                    name="record_date"
                    type="date"
                    required
                    readOnly={closedFeedDayKeys.has(feedDayKey(editingRow.flock_id, editingRow.record_date))}
                    value={editRecordDate || editingRow.record_date}
                    onChange={(event) => setEditRecordDate(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Age Weeks
                  <input
                    name="flock_age_weeks"
                    type="number"
                    min={0}
                    readOnly
                    value={editRecordAge?.weeks ?? ""}
                    className={`${inputClass} bg-sand-50 text-forest-600`}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Age Days
                  <input
                    name="flock_age_days"
                    type="number"
                    min={0}
                    readOnly
                    value={editRecordAge?.days ?? ""}
                    className={`${inputClass} bg-sand-50 text-forest-600`}
                  />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Flock
                  <input
                    readOnly
                    value={filteredFlocks.find((flock) => flock.id === editingRow.flock_id)?.flock_code ?? editingRow.flock_id}
                    className={`${inputClass} bg-sand-50 text-forest-600`}
                  />
                </label>
              </div>

              <div className="grid gap-4 rounded-2xl border border-leaf-500/30 bg-leaf-500/5 p-4 md:grid-cols-4">
                <div className="md:col-span-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">03 · Feed Control record</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Consumption stays read-only here</h4></div>
                <div className="rounded-xl bg-sand-50 p-3 text-sm text-forest-700">
                  <span className="block text-xs text-forest-500">Feed Intake (grams)</span>
                  <strong>{editingRow.feed_intake_grams ?? "Not recorded"}</strong>
                </div>
                <div className="rounded-xl bg-sand-50 p-3 text-sm text-forest-700">
                  <span className="block text-xs text-forest-500">Feed Quantity (kg)</span>
                  <strong>{editingRow.feed_intake_quantity ?? "Not recorded"}</strong>
                </div>
                <div className="rounded-xl bg-sand-50 p-3 text-sm text-forest-700">
                  <span className="block text-xs text-forest-500">Feed Type</span>
                  <strong>{editingRow.feed_type ? feedTypeLabels.get(editingRow.feed_type) ?? editingRow.feed_type : "Not recorded"}</strong>
                </div>
                <div className="rounded-xl bg-sand-50 p-3 text-sm text-forest-700">
                  <span className="block text-xs text-forest-500">Source</span>
                  <strong>{closedFeedDayKeys.has(feedDayKey(editingRow.flock_id, editingRow.record_date)) ? "Synced from Feed Control" : editingRow.feed_intake_quantity !== null || editingRow.feed_type !== null ? "Legacy record" : "Not recorded"}</strong>
                </div>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Leftover (grams)
                  <input name="feed_leftover_grams" type="number" min={0} step="0.01" defaultValue={editingRow.feed_leftover_grams ?? ""} className={inputClass} />
                </label>
                <div className="rounded-xl border border-leaf-500/30 bg-leaf-500/10 p-3 text-sm text-forest-700 md:col-span-3">
                  To correct synchronized feed values, reopen the feeding day, update its sessions, and close it again.
                  <Link href="/app/feeding-log" className="ml-1 font-semibold underline underline-offset-4">Open Today’s Feeding</Link>
                </div>
              </div>

              <div className="rounded-2xl border border-sand-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">04 · Routine supplies</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Replace usage only when explicitly entered</h4><p className="mt-1 text-xs text-forest-600">Leaving this list empty preserves existing usage. Adding rows explicitly replaces it with routine supplies only.</p></div><button type="button" onClick={addRoutineUsage} className="rounded-xl border border-forest-900 px-4 py-2 text-xs font-semibold text-forest-900">+ Add replacement row</button></div>
                <div className="mt-4 space-y-3">{routineUsages.map((usage)=><div key={usage.key} className="grid gap-3 rounded-xl bg-sand-50 p-3 md:grid-cols-[1.2fr_1fr_.7fr_1.2fr_auto]"><select aria-label="Routine supply item" value={usage.itemId} onChange={(event)=>updateRoutineUsage(usage.key,"itemId",event.target.value)} className={inputClass}><option value="">Select item</option>{healthInventoryItems.map((item)=><option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select><select aria-label="Routine supply warehouse" value={usage.warehouseId} onChange={(event)=>updateRoutineUsage(usage.key,"warehouseId",event.target.value)} className={inputClass}><option value="">Select warehouse</option>{warehouses.map((warehouse)=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select><input aria-label="Routine supply quantity" value={usage.quantity} onChange={(event)=>updateRoutineUsage(usage.key,"quantity",event.target.value)} type="number" min={0} step="0.001" placeholder="Quantity" className={inputClass}/><input aria-label="Routine supply reason" value={usage.notes} onChange={(event)=>updateRoutineUsage(usage.key,"notes",event.target.value)} placeholder="Purpose or area used" className={inputClass}/><button type="button" aria-label="Remove usage row" onClick={()=>setRoutineUsages((rows)=>rows.filter((row)=>row.key!==usage.key))} className="h-11 rounded-xl border border-red-200 px-3 text-red-600">Remove</button></div>)}</div>
              </div>

              <div className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-4 md:grid-cols-4">
                <div className="md:col-span-4"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-forest-500">05 · Production, mortality and health</p><h4 className="mt-1 font-display text-lg font-semibold text-forest-900">Correct the operational evidence</h4></div>
                <label className="grid gap-2 text-sm text-forest-700">
                  Normal Eggs
                  <input name="normal_eggs" type="number" min={0} defaultValue={editingRow.normal_eggs ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Broken Eggs
                  <input name="broken_eggs" type="number" min={0} defaultValue={editingRow.broken_eggs ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">Dirty Eggs<input name="dirty_eggs" type="number" min={0} defaultValue={editingRow.dirty_eggs ?? ""} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">Average Egg Weight (g)<input name="average_egg_weight_g" type="number" min={0} step="0.01" defaultValue={editingRow.average_egg_weight_g ?? ""} className={inputClass} /></label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Total Eggs
                  <input name="total_eggs" type="number" min={0} defaultValue={editingRow.total_eggs ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Number of Deaths
                  <input name="deaths" type="number" min={0} defaultValue={editingRow.deaths ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Cause of Death
                  <input name="deaths_cause" type="text" defaultValue={editingRow.deaths_cause ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Vaccination Status
                  <input name="vaccination_status" type="text" defaultValue={editingRow.vaccination_status ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700 md:col-span-2">
                  Treatment/Vitamins
                  <input name="medication_vitamins" type="text" defaultValue={editingRow.medication_vitamins ?? ""} className={inputClass} />
                </label>
              </div>

              {formError ? (
                <p className="rounded-xl border border-ember-500/40 bg-ember-500/10 px-4 py-3 text-sm text-ember-500">
                  {formError}
                </p>
              ) : null}

              <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col-reverse gap-3 border-t border-sand-200 bg-white/95 p-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:p-5">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="min-h-11 rounded-xl border border-forest-900/20 px-4 text-sm font-semibold text-forest-700"
                >
                  Cancel
                </button>
                <button
                  className="min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-sand-50 disabled:opacity-60"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Update Daily Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
