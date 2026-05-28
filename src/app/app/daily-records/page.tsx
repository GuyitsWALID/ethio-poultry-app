"use client";

import { useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type DailyRow = {
  id: string;
  record_date: string;
  flock_id: string;
  live_count: number | null;
  deaths: number | null;
  culls: number | null;
  feed_consumed_kg: number | null;
  feed_type: string | null;
  water_liters: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  flock_age_weeks: number | null;
  flock_age_days: number | null;
  feed_given_kg: number | null;
  feed_leftover_kg: number | null;
  normal_eggs: number | null;
  broken_eggs: number | null;
  total_eggs: number | null;
  production_percentage: number | null;
  mortality_percentage: number | null;
  vaccination_status: string | null;
  medication_vitamins: string | null;
  has_egg_record: boolean;
  has_weight_record: boolean;
  has_health_record: boolean;
  has_mortality_event: boolean;
};

export default function DailyRecordsPage() {
  const { scope, setScope, filteredFarms, filteredFlocks, filteredBatches, filteredHouses, batches } =
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
      setLoadingRows(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id) {
      setRows([]);
      setLoadingRows(false);
      return;
    }

    let query = supabase
      .from("daily_farm_records")
      .select(
        "id, record_date, flock_id, live_count, deaths, culls, feed_consumed_kg, feed_type, water_liters, temperature_c, humidity_pct, flock_age_weeks, flock_age_days, feed_given_kg, feed_leftover_kg, normal_eggs, broken_eggs, total_eggs, production_percentage, mortality_percentage, vaccination_status, medication_vitamins"
      )
      .eq("org_id", profile.org_id)
      .order("record_date", { ascending: false })
      .limit(200);

    const scopedFlockIds = filteredFlocks
      .filter((flock) => {
        if (!scope.batchId) return true;
        return filteredBatches.some((batch) => batch.id === scope.batchId && batch.flock_id === flock.id);
      })
      .map((flock) => flock.id);

    if (scope.flockId) query = query.eq("flock_id", scope.flockId);
    else if (scopedFlockIds.length > 0) query = query.in("flock_id", scopedFlockIds);
    else if (scope.branchId || scope.farmId || scope.houseId || scope.batchId) {
      setRows([]);
      setLoadingRows(false);
      return;
    }
    if (dateFilterMode === "single" && filterDate) {
      query = query.eq("record_date", filterDate);
    }
    if (dateFilterMode === "range") {
      if (filterDateFrom) query = query.gte("record_date", filterDateFrom);
      if (filterDateTo) query = query.lte("record_date", filterDateTo);
    }

    const { data } = await query;
    const dailyRows = (data ?? []) as Array<Omit<DailyRow, "has_egg_record" | "has_weight_record" | "has_health_record" | "has_mortality_event">>;

    if (dailyRows.length === 0) {
      setRows([]);
      setLoadingRows(false);
      return;
    }

    const flockIds = Array.from(new Set(dailyRows.map((r) => r.flock_id)));
    const recordDates = Array.from(new Set(dailyRows.map((r) => r.record_date)));

    const [eggRes, weightRes, healthRes, mortalityRes] = await Promise.all([
      supabase
        .from("daily_egg_records")
        .select("flock_id, record_date")
        .eq("org_id", profile.org_id)
        .in("flock_id", flockIds)
        .in("record_date", recordDates),
      supabase
        .from("weight_records")
        .select("flock_id, record_date")
        .eq("org_id", profile.org_id)
        .in("flock_id", flockIds)
        .in("record_date", recordDates),
      supabase
        .from("health_events")
        .select("flock_id, event_date, description")
        .eq("org_id", profile.org_id)
        .in("flock_id", flockIds)
        .in("event_date", recordDates),
      supabase
        .from("mortality_events")
        .select("flock_id, record_date")
        .eq("org_id", profile.org_id)
        .in("flock_id", flockIds)
        .in("record_date", recordDates),
    ]);

    const key = (flockId: string, date: string) => `${flockId}::${date}`;
    const eggKeys = new Set((eggRes.data ?? []).map((r) => key(r.flock_id, r.record_date)));
    const weightKeys = new Set((weightRes.data ?? []).map((r) => key(r.flock_id, r.record_date)));
    const healthKeys = new Set(
      (healthRes.data ?? [])
        .filter((r) => !(r.description ?? "").startsWith("SCHEDULE_"))
        .map((r) => key(r.flock_id, r.event_date))
    );
    const mortalityKeys = new Set((mortalityRes.data ?? []).map((r) => key(r.flock_id, r.record_date)));

    const enrichedRows: DailyRow[] = dailyRows.map((row) => {
      const rowKey = key(row.flock_id, row.record_date);
      return {
        ...row,
        has_egg_record: eggKeys.has(rowKey),
        has_weight_record: weightKeys.has(rowKey),
        has_health_record: healthKeys.has(rowKey),
        has_mortality_event: mortalityKeys.has(rowKey),
      };
    });

    setRows(enrichedRows);
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

  const flockLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredFlocks.forEach((f) => map.set(f.id, f.flock_code));
    return map;
  }, [filteredFlocks]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);
    if (!canCreateRecord) {
      setFormError("Only farm managers can create daily records.");
      setIsSubmitting(false);
      return;
    }

    if (!scope.farmId || !scope.houseId || !scope.flockId) {
      setFormError("Select farm, house, and flock from scope filters first.");
      setIsSubmitting(false);
      return;
    }

    if (!filteredHouses.some((h) => h.id === scope.houseId)) {
      setFormError("Selected house is not valid for selected farm.");
      setIsSubmitting(false);
      return;
    }

    if (!filteredFlocks.some((f) => f.id === scope.flockId && f.house_id === scope.houseId)) {
      setFormError("Selected flock is not valid for selected house.");
      setIsSubmitting(false);
      return;
    }

    if (scope.batchId && !batches.some((b) => b.id === scope.batchId && b.flock_id === scope.flockId)) {
      setFormError("Selected batch is not valid for selected flock.");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
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

    const orgId = profile.org_id;
    const flockId = scope.flockId;

    const { data: flockMeta } = await supabase
      .from("flocks")
      .select("placement_date, initial_count")
      .eq("id", flockId)
      .single();

    const liveCount = parseNumber(formData.get("live_count"));
    const deaths = parseNumber(formData.get("deaths")) ?? 0;
    const culls = parseNumber(formData.get("culls")) ?? 0;
    const feedGivenKg = parseNumber(formData.get("feed_given_kg"));
    const feedLeftoverKg = parseNumber(formData.get("feed_leftover_kg"));
    const computedFeedConsumed =
      feedGivenKg !== null
        ? Math.max(Number((feedGivenKg - (feedLeftoverKg ?? 0)).toFixed(2)), 0)
        : parseNumber(formData.get("feed_consumed_kg"));

    const normalEggs = parseNumber(formData.get("normal_eggs")) ?? parseNumber(formData.get("good_eggs")) ?? 0;
    const brokenEggs = parseNumber(formData.get("broken_eggs")) ?? 0;
    const totalEggs = normalEggs + brokenEggs;

    const totalLiveBirds =
      (liveCount ?? 0) > 0
        ? (liveCount as number)
        : ((flockMeta?.initial_count ?? 0) - deaths - culls > 0 ? (flockMeta?.initial_count ?? 0) - deaths - culls : 0);
    const productionPercentage =
      totalLiveBirds > 0 ? Number(((totalEggs / totalLiveBirds) * 100).toFixed(2)) : null;
    const mortalityPercentage =
      totalLiveBirds > 0 ? Number((((deaths + culls) / totalLiveBirds) * 100).toFixed(2)) : null;

    let flockAgeDays: number | null = null;
    let flockAgeWeeks: number | null = null;
    if (flockMeta?.placement_date) {
      const placement = new Date(flockMeta.placement_date);
      const record = new Date(recordDate);
      const diffMs = record.getTime() - placement.getTime();
      const days = Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 0);
      flockAgeDays = days;
      flockAgeWeeks = Math.floor(days / 7);
    }

    const medication = parseText(formData.get("medication"));
    const medicationDosage = parseText(formData.get("medication_dosage"));
    const medicationRoute = parseText(formData.get("medication_route"));
    const medicationDuration = parseText(formData.get("medication_duration_days"));
    const diseaseObservation = parseText(formData.get("disease_observation"));
    const diseaseDiagnosis = parseText(formData.get("disease_diagnosis"));
    const vaccinationStatus = parseText(formData.get("vaccination_status"));
    const medicationVitaminsSummary = parseText(formData.get("medication_vitamins"));

    const { error: dailyError } = await supabase.from("daily_farm_records").insert({
      org_id: orgId,
      flock_id: flockId,
      record_date: recordDate,
      live_count: liveCount,
      deaths,
      culls,
      feed_consumed_kg: computedFeedConsumed,
      feed_type: parseText(formData.get("feed_type")),
      feed_given_kg: feedGivenKg,
      feed_leftover_kg: feedLeftoverKg,
      normal_eggs: normalEggs,
      broken_eggs: brokenEggs,
      total_eggs: totalEggs,
      production_percentage: productionPercentage,
      mortality_percentage: mortalityPercentage,
      flock_age_weeks: flockAgeWeeks,
      flock_age_days: flockAgeDays,
      vaccination_status: vaccinationStatus,
      medication_vitamins: medicationVitaminsSummary,
      water_liters: parseNumber(formData.get("water_liters")),
      temperature_c: parseNumber(formData.get("temperature_c")),
      humidity_pct: parseNumber(formData.get("humidity_pct")),
      recorded_by: user.id,
    });
    if (dailyError) {
      setFormError(dailyError.message);
      setIsSubmitting(false);
      return;
    }

    const mortalityCount = deaths;
    const mortalityCause = parseText(formData.get("death_cause"));
    const mortalityNotes = parseText(formData.get("mortality_notes"));
    const mortalityDiagnosis = parseText(formData.get("mortality_diagnosis"));
    const recordedTime = parseText(formData.get("recorded_time"));
    const shouldInsertMortality =
      mortalityCount !== null || mortalityCause || mortalityNotes || mortalityDiagnosis || recordedTime;

    if (shouldInsertMortality) {
      const { error: mortalityError } = await supabase.from("mortality_events").insert({
        org_id: orgId,
        flock_id: flockId,
        record_date: recordDate,
        recorded_time: recordedTime,
        count: mortalityCount ?? 0,
        cause: mortalityCause || "unspecified",
        notes: mortalityNotes,
        diagnosis: mortalityDiagnosis,
        observed_by: user.id,
      });
      if (mortalityError) {
        setFormError(mortalityError.message);
        setIsSubmitting(false);
        return;
      }
    }

    const eggFields = ["normal_eggs", "good_eggs", "broken_eggs", "dirty_eggs", "floor_eggs"];
    const hasEggData = eggFields.some((field) => {
      const value = formData.get(field);
      return value !== null && value !== "";
    });
    if (hasEggData) {
      const { error: eggError } = await supabase.from("daily_egg_records").insert({
        org_id: orgId,
        flock_id: flockId,
        record_date: recordDate,
        total_eggs: totalEggs,
        good_eggs: normalEggs,
        broken_eggs: brokenEggs,
        dirty_eggs: parseNumber(formData.get("dirty_eggs")),
        floor_eggs: parseNumber(formData.get("floor_eggs")),
      });
      if (eggError) {
        setFormError(eggError.message);
        setIsSubmitting(false);
        return;
      }
    }

    const weightSample = parseNumber(formData.get("weight_sample"));
    const avgWeight = parseNumber(formData.get("avg_weight"));
    if (weightSample || avgWeight) {
      const { error: weightError } = await supabase.from("weight_records").insert({
        org_id: orgId,
        flock_id: flockId,
        record_date: recordDate,
        sample_count: weightSample,
        average_weight_g: avgWeight,
        min_weight_g: parseNumber(formData.get("min_weight")),
        max_weight_g: parseNumber(formData.get("max_weight")),
        uniformity_pct: parseNumber(formData.get("uniformity_pct")),
      });
      if (weightError) {
        setFormError(weightError.message);
        setIsSubmitting(false);
        return;
      }
    }

    if (medication) {
      const { error: treatmentError } = await supabase.from("health_events").insert({
        org_id: orgId,
        flock_id: flockId,
        event_date: recordDate,
        event_type: "treatment",
        description: medication,
        diagnosis: diseaseDiagnosis,
        treatment: [medicationDosage, medicationRoute, medicationDuration].filter(Boolean).join(" | "),
      });
      if (treatmentError) {
        setFormError(treatmentError.message);
        setIsSubmitting(false);
        return;
      }
    }
    if (diseaseObservation || diseaseDiagnosis) {
      const { error: observationError } = await supabase.from("health_events").insert({
        org_id: orgId,
        flock_id: flockId,
        event_date: recordDate,
        event_type: "observation",
        description: diseaseObservation || "Daily flock health observation",
        diagnosis: diseaseDiagnosis,
      });
      if (observationError) {
        setFormError(observationError.message);
        setIsSubmitting(false);
        return;
      }
    }
    if (vaccinationStatus) {
      const { error: vaccinationError } = await supabase.from("vaccination_events").insert({
        org_id: orgId,
        flock_id: flockId,
        event_date: recordDate,
        vaccine_name: vaccinationStatus,
      });
      if (vaccinationError) {
        setFormError(vaccinationError.message);
        setIsSubmitting(false);
        return;
      }
    }

    setFormSuccess("Daily record saved successfully.");
    event.currentTarget.reset();
    setIsSubmitting(false);
    setIsModalOpen(false);
    await loadRows();
  };

  const inputClass = "h-11 w-full rounded-xl border border-sand-200 px-3 text-sm";

  return (
    <div className="mx-auto w-full max-w-[1400px] min-w-0 space-y-6 overflow-x-hidden px-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Daily records</p>
          <h2 className="text-2xl font-semibold text-forest-900">Daily Operations Inputs</h2>
        </div>
        {canCreateRecord ? (
          <button
            className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50"
            type="button"
            onClick={() => setIsModalOpen(true)}
          >
            New record
          </button>
        ) : null}
      </div>
      {!canCreateRecord ? (
        <p className="text-sm text-forest-600">View mode: only farm managers can create daily records.</p>
      ) : null}

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs text-forest-600">
            Filter Type
            <select
              className={inputClass}
              value={dateFilterMode}
              onChange={(e) => setDateFilterMode(e.target.value as "single" | "range")}
            >
              <option value="single">Single day</option>
              <option value="range">Date range</option>
            </select>
          </label>
          {dateFilterMode === "single" ? (
            <label className="grid gap-1 text-xs text-forest-600">
              Date
              <input className={inputClass} type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
            </label>
          ) : null}
          {dateFilterMode === "range" ? (
            <label className="grid gap-1 text-xs text-forest-600">
              From
              <input className={inputClass} type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </label>
          ) : null}
          {dateFilterMode === "range" ? (
            <label className="grid gap-1 text-xs text-forest-600">
              To
              <input className={inputClass} type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </label>
          ) : null}
          <label className="grid gap-1 text-xs text-forest-600">
            Quick Reset
            <button
              type="button"
              className="h-11 rounded-xl border border-sand-200 px-3 text-sm text-forest-700"
              onClick={() => {
                setDateFilterMode("single");
                setFilterDate("");
                setFilterDateFrom("");
                setFilterDateTo("");
              }}
            >
              Clear date filter
            </button>
          </label>
        </div>
      </section>

      <section className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-forest-900">Previous Records</h3>
        <p className="mt-2 text-xs text-forest-600">Scroll inside this card horizontally to view all columns.</p>
        <div className="relative mt-3 w-full max-w-full overflow-hidden rounded-xl border border-sand-100">
          <div className="max-h-[65vh] w-full overflow-y-auto">
            <div className="w-full overflow-x-auto overflow-y-hidden pb-3">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-[1800px] text-sm">
                <thead>
              <tr className="border-b border-sand-200 text-left text-[11px] uppercase tracking-[0.08em] text-forest-600 [&>th]:whitespace-nowrap [&>th]:px-3 [&>th]:py-2">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Live</th>
                <th className="px-2 py-2">Age (w+d)</th>
                <th className="px-2 py-2">Deaths</th>
                <th className="px-2 py-2">Culls</th>
                <th className="px-2 py-2">Feed Given Kg</th>
                <th className="px-2 py-2">Feed Left Kg</th>
                <th className="px-2 py-2">Feed Used Kg</th>
                <th className="px-2 py-2">Feed Type</th>
                <th className="px-2 py-2">Normal Eggs</th>
                <th className="px-2 py-2">Broken Eggs</th>
                <th className="px-2 py-2">Total Eggs</th>
                <th className="px-2 py-2">Prod %</th>
                <th className="px-2 py-2">Mortality %</th>
                <th className="px-2 py-2">Vaccination</th>
                <th className="px-2 py-2">Medication/Vitamins</th>
                <th className="px-2 py-2">Water L</th>
                <th className="px-2 py-2">Temp C</th>
                <th className="px-2 py-2">Humidity %</th>
                <th className="px-2 py-2">Egg</th>
                <th className="px-2 py-2">Weight</th>
                <th className="px-2 py-2">Health</th>
                <th className="px-2 py-2">Mortality</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={24}>
                    Loading records...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={24}>
                    No records found for selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-sand-100 [&>td]:whitespace-nowrap [&>td]:px-3 [&>td]:py-2">
                    <td className="px-2 py-2 text-forest-700">{row.record_date}</td>
                    <td className="px-2 py-2 text-forest-700">{flockLabelMap.get(row.flock_id) ?? row.flock_id}</td>
                    <td className="px-2 py-2 text-forest-700">{row.live_count ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">
                      {row.flock_age_weeks === null || row.flock_age_days === null
                        ? "-"
                        : `${row.flock_age_weeks}w ${row.flock_age_days % 7}d`}
                    </td>
                    <td className="px-2 py-2 text-forest-700">{row.deaths ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.culls ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.feed_given_kg ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.feed_leftover_kg ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.feed_consumed_kg ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.feed_type ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.normal_eggs ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.broken_eggs ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.total_eggs ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.production_percentage ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.mortality_percentage ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.vaccination_status ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.medication_vitamins ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.water_liters ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.temperature_c ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.humidity_pct ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.has_egg_record ? "Yes" : "No"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.has_weight_record ? "Yes" : "No"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.has_health_record ? "Yes" : "No"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.has_mortality_event ? "Yes" : "No"}</td>
                  </tr>
                ))
              )}
            </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isModalOpen && canCreateRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-forest-900">New Daily Record</h3>
              <button className="text-sm text-forest-600" type="button" onClick={() => setIsModalOpen(false)}>
                Close
              </button>
            </div>

            <form className="mt-6 grid gap-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Record Date
                  <input name="record_date" type="date" required className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Farm
                  <select
                    className={inputClass}
                    value={scope.farmId}
                    onChange={(e) =>
                      setScope((prev) => ({
                        ...prev,
                        farmId: e.target.value,
                        houseId: "",
                        flockId: "",
                        batchId: "",
                      }))
                    }
                  >
                    <option value="">Select Farm</option>
                    {filteredFarms.map((farm) => (
                      <option key={farm.id} value={farm.id}>
                        {farm.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  House
                  <select
                    className={inputClass}
                    value={scope.houseId}
                    onChange={(e) =>
                      setScope((prev) => ({
                        ...prev,
                        houseId: e.target.value,
                        flockId: "",
                        batchId: "",
                      }))
                    }
                  >
                    <option value="">Select House</option>
                    {filteredHouses.map((house) => (
                      <option key={house.id} value={house.id}>
                        {house.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Flock
                  <select
                    className={inputClass}
                    value={scope.flockId}
                    onChange={(e) =>
                      setScope((prev) => ({
                        ...prev,
                        flockId: e.target.value,
                        batchId: "",
                      }))
                    }
                  >
                    <option value="">Select Flock</option>
                    {filteredFlocks.map((flock) => (
                      <option key={flock.id} value={flock.id}>
                        {flock.flock_code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Batch
                  <select
                    className={inputClass}
                    value={scope.batchId}
                    onChange={(e) => setScope((prev) => ({ ...prev, batchId: e.target.value }))}
                  >
                    <option value="">Select Batch</option>
                    {filteredBatches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_code}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Live Count
                  <input name="live_count" type="number" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Deaths
                  <input name="deaths" type="number" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Culls
                  <input name="culls" type="number" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Given (kg)
                  <input name="feed_given_kg" type="number" step="0.01" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Leftover (kg)
                  <input name="feed_leftover_kg" type="number" step="0.01" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Consumed (kg, optional override)
                  <input name="feed_consumed_kg" type="number" step="0.01" className={inputClass} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Type
                  <input name="feed_type" type="text" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Water (L)
                  <input name="water_liters" type="number" step="0.1" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Temperature (C)
                  <input name="temperature_c" type="number" step="0.1" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Humidity (%)
                  <input name="humidity_pct" type="number" step="0.1" className={inputClass} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-5">
                <label className="grid gap-2 text-sm text-forest-700">
                  Normal Eggs
                  <input name="normal_eggs" type="number" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Good Eggs (legacy)
                  <input name="good_eggs" type="number" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Broken Eggs
                  <input name="broken_eggs" type="number" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Dirty Eggs
                  <input name="dirty_eggs" type="number" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Floor Eggs
                  <input name="floor_eggs" type="number" className={inputClass} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Weight Sample
                  <input name="weight_sample" type="number" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Avg Weight (g)
                  <input name="avg_weight" type="number" step="0.1" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Min Weight (g)
                  <input name="min_weight" type="number" step="0.1" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Max Weight (g)
                  <input name="max_weight" type="number" step="0.1" className={inputClass} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Uniformity (%)
                  <input name="uniformity_pct" type="number" min={0} max={100} step="0.1" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Mortality Cause
                  <input name="death_cause" type="text" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Mortality Time
                  <input name="recorded_time" type="time" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Mortality Diagnosis
                  <input name="mortality_diagnosis" type="text" className={inputClass} />
                </label>
              </div>

              <label className="grid gap-2 text-sm text-forest-700">
                Mortality Notes
                <textarea name="mortality_notes" className="min-h-[80px] rounded-xl border border-sand-200 px-3 py-2 text-sm" />
              </label>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Medication
                  <input name="medication" type="text" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Dosage
                  <input name="medication_dosage" type="text" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Route
                  <input name="medication_route" type="text" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Duration (days)
                  <input name="medication_duration_days" type="number" min={1} className={inputClass} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-forest-700">
                  Disease Observation
                  <input name="disease_observation" type="text" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Vet Diagnosis
                  <input name="disease_diagnosis" type="text" className={inputClass} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-forest-700">
                  Vaccination Status (today)
                  <input name="vaccination_status" type="text" placeholder="ND booster, IB, none..." className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Medication/Vitamins Summary
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

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
                >
                  Cancel
                </button>
                <button
                  className="rounded-full bg-forest-900 px-5 py-2 text-sm text-sand-50 disabled:opacity-60"
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
    </div>
  );
}
