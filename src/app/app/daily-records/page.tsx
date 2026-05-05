"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

export default function DailyRecordsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [mortalityEvents, setMortalityEvents] = useState<
    Array<{
      id: string;
      flock_id: string;
      record_date: string;
      recorded_time: string | null;
      count: number;
      cause: string;
      notes: string | null;
      diagnosis: string | null;
    }>
  >([]);
  const [mortalitySummary, setMortalitySummary] = useState<
    Array<{
      flock_id: string;
      record_date: string;
      total_count: number;
    }>
  >([]);
  const [isLoadingMortality, setIsLoadingMortality] = useState(false);

  const loadMortalityData = async () => {
    setIsLoadingMortality(true);
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsLoadingMortality(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      setIsLoadingMortality(false);
      return;
    }

    const { data: events, error: eventsError } = await supabase
      .from("mortality_events")
      .select("id, flock_id, record_date, recorded_time, count, cause, notes, diagnosis")
      .eq("org_id", profile.org_id)
      .order("record_date", { ascending: false })
      .order("recorded_time", { ascending: false, nullsFirst: false })
      .limit(200);

    if (eventsError || !events) {
      setIsLoadingMortality(false);
      return;
    }

    setMortalityEvents(events);
    const summaryMap = new Map<string, { flock_id: string; record_date: string; total_count: number }>();
    events.forEach((event) => {
      const key = `${event.flock_id}-${event.record_date}`;
      const current = summaryMap.get(key) ?? {
        flock_id: event.flock_id,
        record_date: event.record_date,
        total_count: 0,
      };
      current.total_count += event.count ?? 0;
      summaryMap.set(key, current);
    });

    setMortalitySummary(
      Array.from(summaryMap.values()).sort((a, b) =>
        a.record_date < b.record_date ? 1 : -1
      )
    );
    setIsLoadingMortality(false);
  };

  useEffect(() => {
    void loadMortalityData();
  }, []);

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
    const flockId = formData.get("flock_id")?.toString().trim();
    const recordDate = formData.get("record_date")?.toString();

    if (!flockId || !recordDate) {
      setFormError("Record date and flock ID are required.");
      setIsSubmitting(false);
      return;
    }

    const dailyRecordPayload = {
      org_id: orgId,
      flock_id: flockId,
      record_date: recordDate,
      live_count: parseNumber(formData.get("live_count")),
      deaths: parseNumber(formData.get("deaths")) ?? 0,
      culls: parseNumber(formData.get("culls")) ?? 0,
      feed_consumed_kg: parseNumber(formData.get("feed_consumed_kg")),
      feed_type: formData.get("feed_type")?.toString() || null,
      water_liters: parseNumber(formData.get("water_liters")),
      temperature_c: parseNumber(formData.get("temperature_c")),
      humidity_pct: parseNumber(formData.get("humidity_pct")),
      recorded_by: user.id,
    };

    const { error: dailyError } = await supabase
      .from("daily_farm_records")
      .insert(dailyRecordPayload);

    if (dailyError) {
      setFormError(dailyError.message);
      setIsSubmitting(false);
      return;
    }

    const mortalityCount = parseNumber(formData.get("deaths"));
    const mortalityCause = formData.get("death_cause")?.toString().trim();
    const mortalityNotes = formData.get("mortality_notes")?.toString().trim();
    const mortalityDiagnosis = formData
      .get("mortality_diagnosis")
      ?.toString()
      .trim();
    const recordedTime = formData.get("recorded_time")?.toString() || null;
    const shouldInsertMortality =
      mortalityCount !== null ||
      mortalityCause ||
      mortalityNotes ||
      mortalityDiagnosis ||
      recordedTime;

    if (shouldInsertMortality) {
      const { error: mortalityError } = await supabase
        .from("mortality_events")
        .insert({
          org_id: orgId,
          flock_id: flockId,
          record_date: recordDate,
          recorded_time: recordedTime,
          count: mortalityCount ?? 0,
          cause: mortalityCause || "unspecified",
          notes: mortalityNotes || null,
          diagnosis: mortalityDiagnosis || null,
          observed_by: user.id,
        });

      if (mortalityError) {
        setFormError(mortalityError.message);
        setIsSubmitting(false);
        return;
      }
    }

    const eggFields = [
      "total_eggs",
      "good_eggs",
      "broken_eggs",
      "dirty_eggs",
      "floor_eggs",
    ];
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
      });

      if (weightError) {
        setFormError(weightError.message);
        setIsSubmitting(false);
        return;
      }
    }

    const medication = formData.get("medication")?.toString().trim();
    if (medication) {
      const { error: healthError } = await supabase.from("health_events").insert({
        org_id: orgId,
        flock_id: flockId,
        event_date: recordDate,
        event_type: "treatment",
        description: medication,
      });

      if (healthError) {
        setFormError(healthError.message);
        setIsSubmitting(false);
        return;
      }
    }

    setFormSuccess("Daily record saved successfully.");
    await loadMortalityData();
    event.currentTarget.reset();
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">
            Daily records
          </p>
          <h2 className="text-2xl font-semibold text-forest-900">
            Daily operations tracking
          </h2>
          <p className="mt-2 text-sm text-forest-600">
            Feed intake, mortality, egg collection, and water usage.
          </p>
        </div>
        <button
          className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50"
          type="button"
          onClick={() => setIsModalOpen(true)}
        >
          New record
        </button>
      </div>

      <div className="rounded-2xl border border-dashed border-sand-200 bg-white/70 p-10 text-center">
        <p className="text-sm font-semibold text-forest-900">No daily records yet</p>
        <p className="mt-2 text-sm text-forest-600">
          Add the first daily operation record for a flock.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-sand-200 bg-white/80 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-forest-900">Mortality events</h3>
            <span className="text-xs text-forest-500">
              {isLoadingMortality ? "Loading..." : `${mortalityEvents.length} events`}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {mortalityEvents.length === 0 ? (
              <p className="text-sm text-forest-600">No mortality events logged yet.</p>
            ) : (
              mortalityEvents.slice(0, 8).map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl border border-sand-100 bg-sand-50/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-forest-900">
                      {event.cause}
                    </p>
                    <span className="text-xs text-forest-500">
                      {event.record_date}
                      {event.recorded_time ? ` • ${event.recorded_time}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-forest-600">
                    Flock: {event.flock_id} • Count: {event.count}
                  </p>
                  {event.diagnosis ? (
                    <p className="mt-1 text-xs text-forest-500">
                      Diagnosis: {event.diagnosis}
                    </p>
                  ) : null}
                  {event.notes ? (
                    <p className="mt-1 text-xs text-forest-500">Notes: {event.notes}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-sand-200 bg-white/80 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-forest-900">Daily mortality summary</h3>
            <span className="text-xs text-forest-500">
              {isLoadingMortality ? "Loading..." : `${mortalitySummary.length} days`}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {mortalitySummary.length === 0 ? (
              <p className="text-sm text-forest-600">No daily summaries available.</p>
            ) : (
              mortalitySummary.slice(0, 8).map((summary) => (
                <div
                  key={`${summary.flock_id}-${summary.record_date}`}
                  className="flex items-center justify-between rounded-xl border border-sand-100 bg-sand-50/40 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-forest-900">
                      {summary.record_date}
                    </p>
                    <p className="text-xs text-forest-500">Flock: {summary.flock_id}</p>
                  </div>
                  <span className="text-sm font-semibold text-forest-900">
                    {summary.total_count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/40 px-4">
          <div className="h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-forest-900">
                New daily operation record
              </h3>
              <button
                className="text-sm text-forest-600"
                type="button"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
            </div>
            <form className="mt-6 grid gap-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="record-date">
                    Record date
                  </label>
                  <input
                    id="record-date"
                    name="record_date"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    type="date"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="flock-id">
                    Flock ID
                  </label>
                  <input
                    id="flock-id"
                    name="flock_id"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="LAY-2026-003"
                    type="text"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="farm">
                    Farm
                  </label>
                  <input
                    id="farm"
                    name="farm_name"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="Addis Farm"
                    type="text"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="house">
                    House
                  </label>
                  <input
                    id="house"
                    name="house_name"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="House 2"
                    type="text"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="live-count">
                    Live count
                  </label>
                  <input
                    id="live-count"
                    name="live_count"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="1240"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="deaths">
                    Deaths
                  </label>
                  <input
                    id="deaths"
                    name="deaths"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="12"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="culls">
                    Culls
                  </label>
                  <input
                    id="culls"
                    name="culls"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="0"
                    type="number"
                  />
                </div>
                <div className="md:col-span-3 grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="death-cause">
                    Mortality cause
                  </label>
                  <input
                    id="death-cause"
                    name="death_cause"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="Respiratory disease"
                    type="text"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="recorded-time">
                    Recorded time
                  </label>
                  <input
                    id="recorded-time"
                    name="recorded_time"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    type="time"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="mortality-diagnosis">
                    Diagnosis
                  </label>
                  <input
                    id="mortality-diagnosis"
                    name="mortality_diagnosis"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="Suspected infection"
                    type="text"
                  />
                </div>
                <div className="md:col-span-3 grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="mortality-notes">
                    Mortality notes
                  </label>
                  <textarea
                    id="mortality-notes"
                    name="mortality_notes"
                    className="min-h-[96px] rounded-xl border border-sand-200 px-3 py-2 text-sm"
                    placeholder="Additional details or observations"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="feed-consumed">
                    Feed consumed (kg)
                  </label>
                  <input
                    id="feed-consumed"
                    name="feed_consumed_kg"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="320"
                    type="number"
                    step="0.01"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="feed-type">
                    Feed type
                  </label>
                  <input
                    id="feed-type"
                    name="feed_type"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="Layer mash"
                    type="text"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="water">
                    Water consumed (liters)
                  </label>
                  <input
                    id="water"
                    name="water_liters"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="900"
                    type="number"
                    step="0.1"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="medication">
                    Medication administered
                  </label>
                  <input
                    id="medication"
                    name="medication"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="Vitamin supplement"
                    type="text"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="temperature">
                    Temperature (°C)
                  </label>
                  <input
                    id="temperature"
                    name="temperature_c"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="26.5"
                    type="number"
                    step="0.1"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="humidity">
                    Humidity (%)
                  </label>
                  <input
                    id="humidity"
                    name="humidity_pct"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="62"
                    type="number"
                    step="0.1"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="weight-sample">
                    Weight sample count
                  </label>
                  <input
                    id="weight-sample"
                    name="weight_sample"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="40"
                    type="number"
                  />
                </div>
                <div className="md:col-span-3 grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="avg-weight">
                    Average weight (g)
                  </label>
                  <input
                    id="avg-weight"
                    name="avg_weight"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="980"
                    type="number"
                    step="0.1"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-5">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-total">
                    Total eggs
                  </label>
                  <input
                    id="eggs-total"
                    name="total_eggs"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="1200"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-good">
                    Good eggs
                  </label>
                  <input
                    id="eggs-good"
                    name="good_eggs"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="1150"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-broken">
                    Broken eggs
                  </label>
                  <input
                    id="eggs-broken"
                    name="broken_eggs"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="18"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-dirty">
                    Dirty eggs
                  </label>
                  <input
                    id="eggs-dirty"
                    name="dirty_eggs"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="22"
                    type="number"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-forest-900" htmlFor="eggs-floor">
                    Floor eggs
                  </label>
                  <input
                    id="eggs-floor"
                    name="floor_eggs"
                    className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
                    placeholder="10"
                    type="number"
                  />
                </div>
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

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}