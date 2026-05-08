"use client";

import { useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

export default function DailyRecordsPage() {
  const {
    scope,
    setScope,
    branches,
    filteredFarms,
    filteredBatches,
    filteredHouses,
    filteredFlocks,
    farms,
    houses,
    flocks,
    batches,
  } = useFarmScope();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const parseNumber = (value: FormDataEntryValue | null) => {
      if (value === null || value === "") {
        return null;
      }
      const parsed = Number(value);
      return Number.isNaN(parsed) ? null : parsed;
    };
    const parseText = (value: FormDataEntryValue | null) => {
      const parsed = value?.toString().trim();
      return parsed && parsed.length > 0 ? parsed : null;
    };

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setFormError("Unable to verify your session. Please sign in again.");
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
    const flockId = scope.flockId || formData.get("flock_id")?.toString().trim();
    const recordDate = formData.get("record_date")?.toString();

    if (!flockId || !recordDate) {
      setFormError("Record date and flock ID are required.");
      setIsSubmitting(false);
      return;
    }

    if (scope.farmId) {
      const farmExists = farms.some((f) => f.id === scope.farmId && (!scope.branchId || f.branch_id === scope.branchId));
      if (!farmExists) {
        setFormError("Selected farm is not valid for the selected branch.");
        setIsSubmitting(false);
        return;
      }
    }
    if (scope.houseId) {
      const houseExists = houses.some((h) => h.id === scope.houseId && (!scope.farmId || h.farm_id === scope.farmId));
      if (!houseExists) {
        setFormError("Selected house is not valid for the selected farm.");
        setIsSubmitting(false);
        return;
      }
    }
    const flockExists = flocks.some(
      (f) => f.id === flockId && (!scope.farmId || f.farm_id === scope.farmId) && (!scope.houseId || f.house_id === scope.houseId)
    );
    if (!flockExists) {
      setFormError("Selected flock is not valid for the selected house/farm.");
      setIsSubmitting(false);
      return;
    }
    if (scope.batchId) {
      const batchExists = batches.some((b) => b.id === scope.batchId && b.flock_id === flockId);
      if (!batchExists) {
        setFormError("Selected batch is not valid for the selected flock.");
        setIsSubmitting(false);
        return;
      }
    }

    const { error: dailyError } = await supabase.from("daily_farm_records").insert({
      org_id: orgId,
      flock_id: flockId,
      record_date: recordDate,
      live_count: parseNumber(formData.get("live_count")),
      deaths: parseNumber(formData.get("deaths")) ?? 0,
      culls: parseNumber(formData.get("culls")) ?? 0,
      feed_consumed_kg: parseNumber(formData.get("feed_consumed_kg")),
      feed_type: parseText(formData.get("feed_type")),
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

    const mortalityCount = parseNumber(formData.get("deaths"));
    const mortalityCause = parseText(formData.get("death_cause"));
    const mortalityNotes = parseText(formData.get("mortality_notes"));
    const mortalityDiagnosis = parseText(formData.get("mortality_diagnosis"));
    const recordedTime = parseText(formData.get("recorded_time"));
    const shouldInsertMortality =
      mortalityCount !== null ||
      mortalityCause ||
      mortalityNotes ||
      mortalityDiagnosis ||
      recordedTime;

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

    const eggFields = ["total_eggs", "good_eggs", "broken_eggs", "dirty_eggs", "floor_eggs"];
    const hasEggData = eggFields.some((field) => {
      const value = formData.get(field);
      return value !== null && value !== "";
    });

    if (hasEggData) {
      const { error: eggError } = await supabase.from("daily_egg_records").insert({
        org_id: orgId,
        flock_id: flockId,
        record_date: recordDate,
        total_eggs: parseNumber(formData.get("total_eggs")),
        good_eggs: parseNumber(formData.get("good_eggs")),
        broken_eggs: parseNumber(formData.get("broken_eggs")),
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

    const medication = parseText(formData.get("medication"));
    const medicationDosage = parseText(formData.get("medication_dosage"));
    const medicationRoute = parseText(formData.get("medication_route"));
    const medicationDuration = parseText(formData.get("medication_duration_days"));
    const diseaseObservation = parseText(formData.get("disease_observation"));
    const diseaseDiagnosis = parseText(formData.get("disease_diagnosis"));

    if (medication) {
      const { error: treatmentError } = await supabase.from("health_events").insert({
        org_id: orgId,
        flock_id: flockId,
        event_date: recordDate,
        event_type: "treatment",
        description: medication,
        diagnosis: diseaseDiagnosis,
        treatment: [medicationDosage, medicationRoute, medicationDuration]
          .filter(Boolean)
          .join(" | "),
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

    setFormSuccess("Daily record saved successfully.");
    event.currentTarget.reset();
    setIsSubmitting(false);
  };

  const inputClass = "h-10 w-full min-w-[120px] rounded-lg border border-sand-200 px-2 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Daily records</p>
        <h2 className="text-2xl font-semibold text-forest-900">Spreadsheet Daily Input</h2>
        <p className="mt-2 text-sm text-forest-600">
          Enter daily farm inputs in grid format for KPI calculation.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
          <table className="min-w-[1400px] w-full border-separate border-spacing-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-forest-600">
                <th>Record Date</th>
                <th>Branch</th>
                <th>Farm</th>
                <th>Batch</th>
                <th>House</th>
                <th>Flock</th>
                <th>Live</th>
                <th>Deaths</th>
                <th>Culls</th>
                <th>Feed Kg</th>
                <th>Feed Type</th>
                <th>Water L</th>
                <th>Temp C</th>
                <th>Humidity %</th>
                <th>Total Eggs</th>
                <th>Good Eggs</th>
                <th>Broken</th>
                <th>Dirty</th>
                <th>Floor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input name="record_date" type="date" required className={inputClass} /></td>
                <td>
                  <select
                    className={inputClass}
                    value={scope.branchId}
                    onChange={(e) => setScope({ branchId: e.target.value, farmId: "", batchId: "", houseId: "", flockId: "" })}
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={inputClass}
                    value={scope.farmId}
                    onChange={(e) => setScope((prev) => ({ ...prev, farmId: e.target.value, batchId: "", houseId: "", flockId: "" }))}
                  >
                    <option value="">Select Farm</option>
                    {filteredFarms.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={inputClass}
                    value={scope.batchId}
                    onChange={(e) => setScope((prev) => ({ ...prev, batchId: e.target.value }))}
                  >
                    <option value="">Select Batch</option>
                    {filteredBatches.map((b) => (
                      <option key={b.id} value={b.id}>{b.batch_code}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className={inputClass}
                    value={scope.houseId}
                    onChange={(e) => setScope((prev) => ({ ...prev, houseId: e.target.value, flockId: "" }))}
                  >
                    <option value="">Select House</option>
                    {filteredHouses.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    name="flock_id"
                    required
                    className={inputClass}
                    value={scope.flockId}
                    onChange={(e) => setScope((prev) => ({ ...prev, flockId: e.target.value }))}
                  >
                    <option value="">Select Flock</option>
                    {filteredFlocks
                      .filter((f) => !scope.batchId || filteredBatches.some((b) => b.id === scope.batchId && b.flock_id === f.id))
                      .map((f) => (
                        <option key={f.id} value={f.id}>{f.flock_code}</option>
                      ))}
                  </select>
                </td>
                <td><input name="live_count" type="number" className={inputClass} /></td>
                <td><input name="deaths" type="number" className={inputClass} /></td>
                <td><input name="culls" type="number" className={inputClass} /></td>
                <td><input name="feed_consumed_kg" type="number" step="0.01" className={inputClass} /></td>
                <td><input name="feed_type" type="text" className={inputClass} /></td>
                <td><input name="water_liters" type="number" step="0.1" className={inputClass} /></td>
                <td><input name="temperature_c" type="number" step="0.1" className={inputClass} /></td>
                <td><input name="humidity_pct" type="number" step="0.1" className={inputClass} /></td>
                <td><input name="total_eggs" type="number" className={inputClass} /></td>
                <td><input name="good_eggs" type="number" className={inputClass} /></td>
                <td><input name="broken_eggs" type="number" className={inputClass} /></td>
                <td><input name="dirty_eggs" type="number" className={inputClass} /></td>
                <td><input name="floor_eggs" type="number" className={inputClass} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
          <table className="min-w-[1200px] w-full border-separate border-spacing-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-forest-600">
                <th>Weight Sample</th>
                <th>Avg Wt g</th>
                <th>Min Wt g</th>
                <th>Max Wt g</th>
                <th>Uniformity %</th>
                <th>Mortality Cause</th>
                <th>Mortality Time</th>
                <th>Mortality Diagnosis</th>
                <th>Mortality Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input name="weight_sample" type="number" className={inputClass} /></td>
                <td><input name="avg_weight" type="number" step="0.1" className={inputClass} /></td>
                <td><input name="min_weight" type="number" step="0.1" className={inputClass} /></td>
                <td><input name="max_weight" type="number" step="0.1" className={inputClass} /></td>
                <td><input name="uniformity_pct" type="number" min={0} max={100} step="0.1" className={inputClass} /></td>
                <td><input name="death_cause" type="text" className={inputClass} /></td>
                <td><input name="recorded_time" type="time" className={inputClass} /></td>
                <td><input name="mortality_diagnosis" type="text" className={inputClass} /></td>
                <td><input name="mortality_notes" type="text" className={inputClass} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
          <table className="min-w-[1000px] w-full border-separate border-spacing-2">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-forest-600">
                <th>Medication</th>
                <th>Dosage</th>
                <th>Route</th>
                <th>Duration Days</th>
                <th>Disease Observation</th>
                <th>Vet Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><input name="medication" type="text" className={inputClass} /></td>
                <td><input name="medication_dosage" type="text" className={inputClass} /></td>
                <td><input name="medication_route" type="text" className={inputClass} /></td>
                <td><input name="medication_duration_days" type="number" min={1} className={inputClass} /></td>
                <td><input name="disease_observation" type="text" className={inputClass} /></td>
                <td><input name="disease_diagnosis" type="text" className={inputClass} /></td>
              </tr>
            </tbody>
          </table>
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

        <div className="flex justify-end">
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
  );
}
