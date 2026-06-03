"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [formTotalEggs, setFormTotalEggs] = useState("");
  const [formDeaths, setFormDeaths] = useState("");
  const [editingRow, setEditingRow] = useState<DailyRow | null>(null);
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
  const parseFeedType = (value: FormDataEntryValue | null): FeedType | null => {
    const parsed = parseText(value);
    return feedTypeOptions.some((option) => option.value === parsed) ? (parsed as FeedType) : null;
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
        "id, record_date, flock_id, flock_age_weeks, flock_age_days, feed_intake_grams, feed_intake_quantity, feed_leftover_grams, feed_type, normal_eggs, broken_eggs, total_eggs, production_percentage, deaths, mortality_percentage, deaths_cause, vaccination_status, medication_vitamins"
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

    if (dateFilterMode === "single" && filterDate) query = query.eq("record_date", filterDate);
    if (dateFilterMode === "range") {
      if (filterDateFrom) query = query.gte("record_date", filterDateFrom);
      if (filterDateTo) query = query.lte("record_date", filterDateTo);
    }

    const { data } = await query;
    setRows((data ?? []) as DailyRow[]);
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

  const selectedFlock = useMemo(
    () => filteredFlocks.find((flock) => flock.id === scope.flockId) ?? null,
    [filteredFlocks, scope.flockId]
  );
  const currentLiveBirds = selectedFlock?.current_count ?? null;
  const previewProductionPercentage =
    currentLiveBirds && currentLiveBirds > 0 && formTotalEggs !== ""
      ? Number(((Number(formTotalEggs) / currentLiveBirds) * 100).toFixed(2))
      : "";
  const previewMortalityPercentage =
    currentLiveBirds && currentLiveBirds > 0 && formDeaths !== ""
      ? Number(((Number(formDeaths) / currentLiveBirds) * 100).toFixed(2))
      : "";

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

    if (scope.batchId && !batches.some((batch) => batch.id === scope.batchId && batch.flock_id === scope.flockId)) {
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
      .select("current_count")
      .eq("id", scope.flockId)
      .single();
    if (flockError || !flockMeta) {
      setFormError("Unable to load current flock count.");
      setIsSubmitting(false);
      return;
    }

    const currentBirds = flockMeta.current_count ?? 0;
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
      flock_age_weeks: parseNumber(formData.get("flock_age_weeks")),
      flock_age_days: parseNumber(formData.get("flock_age_days")),
      feed_intake_grams: parseNumber(formData.get("feed_intake_grams")),
      feed_intake_quantity: parseNumber(formData.get("feed_intake_quantity")),
      feed_leftover_grams: parseNumber(formData.get("feed_leftover_grams")),
      feed_type: parseFeedType(formData.get("feed_type")),
      normal_eggs: parseNumber(formData.get("normal_eggs")),
      broken_eggs: parseNumber(formData.get("broken_eggs")),
      total_eggs: totalEggs,
      production_percentage: productionPercentage,
      deaths,
      mortality_percentage: mortalityPercentage,
      deaths_cause: parseText(formData.get("deaths_cause")),
      vaccination_status: parseText(formData.get("vaccination_status")),
      medication_vitamins: parseText(formData.get("medication_vitamins")),
      recorded_by: user.id,
    };

    const { error: dailyError } = rowId
      ? await supabase.from("daily_farm_records").update(payload).eq("id", rowId)
      : await supabase.from("daily_farm_records").insert(payload);

    if (dailyError) {
      setFormError(
        dailyError.code === "23505"
          ? "This flock already has a daily record for that date. Edit the existing row instead."
          : dailyError.message
      );
      setIsSubmitting(false);
      return;
    }

    setFormSuccess(rowId ? "Daily record updated successfully." : "Daily record saved successfully.");
    form.reset();
    setFormTotalEggs("");
    setFormDeaths("");
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
    if (!canCreateRecord || !window.confirm(`Delete daily record for ${row.record_date}?`)) return;
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.from("daily_farm_records").delete().eq("id", row.id);
    if (error) {
      setFormError(error.message);
      return;
    }
    setFormSuccess("Daily record deleted successfully.");
    await loadRows();
  };

  const inputClass = "h-11 w-full rounded-xl border border-sand-200 px-3 text-sm";
  const spreadsheetHeaderClass = "border border-sand-900 bg-forest-900 px-3 py-2 text-center text-xs font-semibold text-sand-50";

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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1 text-xs text-forest-600">
            Farm
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
              <option value="">All Farms</option>
              {filteredFarms.map((farm) => (
                <option key={farm.id} value={farm.id}>{farm.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            House
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
              <option value="">All Houses</option>
              {filteredHouses.map((house) => (
                <option key={house.id} value={house.id}>{house.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            Flock
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
              <option value="">All Flocks</option>
              {filteredFlocks.map((flock) => (
                <option key={flock.id} value={flock.id}>{flock.flock_code}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            Batch
            <select
              className={inputClass}
              value={scope.batchId}
              onChange={(event) => setScope((prev) => ({ ...prev, batchId: event.target.value }))}
            >
              <option value="">All Batches</option>
              {filteredBatches.map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.batch_code}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            Filter Type
            <select
              className={inputClass}
              value={dateFilterMode}
              onChange={(event) => setDateFilterMode(event.target.value as "single" | "range")}
            >
              <option value="single">Single day</option>
              <option value="range">Date range</option>
            </select>
          </label>
          {dateFilterMode === "single" ? (
            <label className="grid gap-1 text-xs text-forest-600">
              Date
              <input className={inputClass} type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
            </label>
          ) : null}
          {dateFilterMode === "range" ? (
            <label className="grid gap-1 text-xs text-forest-600">
              From
              <input className={inputClass} type="date" value={filterDateFrom} onChange={(event) => setFilterDateFrom(event.target.value)} />
            </label>
          ) : null}
          {dateFilterMode === "range" ? (
            <label className="grid gap-1 text-xs text-forest-600">
              To
              <input className={inputClass} type="date" value={filterDateTo} onChange={(event) => setFilterDateTo(event.target.value)} />
            </label>
          ) : null}
          <label className="grid gap-1 text-xs text-forest-600">
            Quick Reset
            <button
              type="button"
              className="h-11 rounded-xl border border-sand-200 px-3 text-sm text-forest-700"
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

      <section className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-forest-900">Previous Records</h3>
        <p className="mt-2 text-xs text-forest-600">Scroll inside this card horizontally to view all columns.</p>
        <div className="relative mt-3 w-full max-w-full overflow-hidden rounded-xl border border-sand-100">
          <div className="max-h-[65vh] w-full overflow-y-auto">
            <div className="w-full overflow-x-auto overflow-y-hidden pb-3">
              <table className="min-w-[1600px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={spreadsheetHeaderClass} rowSpan={2}>Date</th>
                    <th className={spreadsheetHeaderClass} colSpan={2}>Age</th>
                    <th className={spreadsheetHeaderClass} colSpan={2}>Feed Intake Condition</th>
                    <th className={spreadsheetHeaderClass} rowSpan={2}>Feed Leftover</th>
                    <th className={spreadsheetHeaderClass} rowSpan={2}>Feed Type</th>
                    <th className={spreadsheetHeaderClass} colSpan={4}>Egg Production</th>
                    <th className={spreadsheetHeaderClass} colSpan={3}>Mortality Rate</th>
                    <th className={spreadsheetHeaderClass} rowSpan={2}>Vaccination Status</th>
                    <th className={spreadsheetHeaderClass} rowSpan={2}>Treatment / Vitamins</th>
                    {canCreateRecord ? <th className={spreadsheetHeaderClass} rowSpan={2}>Actions</th> : null}
                  </tr>
                  <tr>
                    <th className={spreadsheetHeaderClass}>Weeks</th>
                    <th className={spreadsheetHeaderClass}>Days</th>
                    <th className={spreadsheetHeaderClass}>Grams</th>
                    <th className={spreadsheetHeaderClass}>Quantity</th>
                    <th className={spreadsheetHeaderClass}>Normal</th>
                    <th className={spreadsheetHeaderClass}>Broken</th>
                    <th className={spreadsheetHeaderClass}>Total</th>
                    <th className={spreadsheetHeaderClass}>%</th>
                    <th className={spreadsheetHeaderClass}>Number of Deaths</th>
                    <th className={spreadsheetHeaderClass}>Death %</th>
                    <th className={spreadsheetHeaderClass}>Cause of Death</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingRows ? (
                    <tr>
                      <td className="px-3 py-4 text-forest-600" colSpan={canCreateRecord ? 17 : 16}>Loading records...</td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-forest-600" colSpan={canCreateRecord ? 17 : 16}>No records found for selected filters.</td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="[&>td]:whitespace-nowrap [&>td]:border [&>td]:border-sand-900 [&>td]:px-3 [&>td]:py-2">
                        <td className="text-forest-700">{row.record_date}</td>
                        <td className="text-forest-700">{row.flock_age_weeks ?? "-"}</td>
                        <td className="text-forest-700">{row.flock_age_days ?? "-"}</td>
                        <td className="text-forest-700">{row.feed_intake_grams ?? "-"}</td>
                        <td className="text-forest-700">{row.feed_intake_quantity ?? "-"}</td>
                        <td className="text-forest-700">{row.feed_leftover_grams ?? "-"}</td>
                        <td className="text-forest-700">{row.feed_type ? feedTypeLabels.get(row.feed_type) ?? row.feed_type : "-"}</td>
                        <td className="text-forest-700">{row.normal_eggs ?? "-"}</td>
                        <td className="text-forest-700">{row.broken_eggs ?? "-"}</td>
                        <td className="text-forest-700">{row.total_eggs ?? "-"}</td>
                        <td className="text-forest-700">{row.production_percentage ?? "-"}</td>
                        <td className="text-forest-700">{row.deaths ?? "-"}</td>
                        <td className="text-forest-700">{row.mortality_percentage ?? "-"}</td>
                        <td className="text-forest-700">{row.deaths_cause ?? "-"}</td>
                        <td className="text-forest-700">{row.vaccination_status ?? "-"}</td>
                        <td className="text-forest-700">{row.medication_vitamins ?? "-"}</td>
                        {canCreateRecord ? (
                          <td className="text-forest-700">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-forest-900/20 px-3 py-1 text-xs"
                                onClick={() => {
                                  const flock = filteredFlocks.find((item) => item.id === row.flock_id);
                                  if (flock) {
                                    setScope((prev) => ({
                                      ...prev,
                                      farmId: flock.farm_id,
                                      houseId: flock.house_id,
                                      flockId: flock.id,
                                      batchId: "",
                                    }));
                                  }
                                  setEditingRow(row);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rounded-full border border-ember-500/30 px-3 py-1 text-xs text-ember-600"
                                onClick={() => void deleteRecord(row)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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
                  Age Weeks
                  <input name="flock_age_weeks" type="number" min={0} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Age Days
                  <input name="flock_age_days" type="number" min={0} className={inputClass} />
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

              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Intake (grams)
                  <input name="feed_intake_grams" type="number" min={0} step="0.01" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Intake Quantity
                  <input name="feed_intake_quantity" type="number" min={0} step="0.01" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Leftover
                  <input name="feed_leftover_grams" type="number" min={0} step="0.01" className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Type
                  <select name="feed_type" className={inputClass}>
                    <option value="">Select feed type</option>
                    {feedTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
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

              <div className="grid gap-4 md:grid-cols-2">
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

      {editingRow && canCreateRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-forest-900">Edit Daily Record</h3>
                <p className="text-sm text-forest-600">Correct the canonical record for this flock and date.</p>
              </div>
              <button className="text-sm text-forest-600" type="button" onClick={() => setEditingRow(null)}>
                Close
              </button>
            </div>

            <form className="mt-6 grid gap-6" onSubmit={handleEditSubmit}>
              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Record Date
                  <input name="record_date" type="date" required defaultValue={editingRow.record_date} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Age Weeks
                  <input name="flock_age_weeks" type="number" min={0} defaultValue={editingRow.flock_age_weeks ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Age Days
                  <input name="flock_age_days" type="number" min={0} defaultValue={editingRow.flock_age_days ?? ""} className={inputClass} />
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

              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Intake (grams)
                  <input name="feed_intake_grams" type="number" min={0} step="0.01" defaultValue={editingRow.feed_intake_grams ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Intake Quantity
                  <input name="feed_intake_quantity" type="number" min={0} step="0.01" defaultValue={editingRow.feed_intake_quantity ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Leftover
                  <input name="feed_leftover_grams" type="number" min={0} step="0.01" defaultValue={editingRow.feed_leftover_grams ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Feed Type
                  <select name="feed_type" defaultValue={editingRow.feed_type ?? ""} className={inputClass}>
                    <option value="">Select feed type</option>
                    {feedTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <label className="grid gap-2 text-sm text-forest-700">
                  Normal Eggs
                  <input name="normal_eggs" type="number" min={0} defaultValue={editingRow.normal_eggs ?? ""} className={inputClass} />
                </label>
                <label className="grid gap-2 text-sm text-forest-700">
                  Broken Eggs
                  <input name="broken_eggs" type="number" min={0} defaultValue={editingRow.broken_eggs ?? ""} className={inputClass} />
                </label>
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

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
                >
                  Cancel
                </button>
                <button
                  className="rounded-full bg-forest-900 px-5 py-2 text-sm text-sand-50 disabled:opacity-60"
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
