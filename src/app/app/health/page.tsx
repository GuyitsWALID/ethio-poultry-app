"use client";

import { useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type FlashState = {
  error: string | null;
  success: string | null;
  loading: boolean;
};

const initialFlash: FlashState = { error: null, success: null, loading: false };

export default function HealthPage() {
  const { scope, batches } = useFarmScope();
  const [vaccinationScheduleFlash, setVaccinationScheduleFlash] = useState<FlashState>(initialFlash);
  const [vaccinationRecordFlash, setVaccinationRecordFlash] = useState<FlashState>(initialFlash);
  const [cleanupScheduleFlash, setCleanupScheduleFlash] = useState<FlashState>(initialFlash);
  const [cleanupRecordFlash, setCleanupRecordFlash] = useState<FlashState>(initialFlash);

  const parseNumber = (value: FormDataEntryValue | null) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const parseText = (value: FormDataEntryValue | null) => {
    const parsed = value?.toString().trim();
    return parsed && parsed.length > 0 ? parsed : null;
  };

  const resolveContext = async () => {
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unable to verify your session.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.org_id) {
      throw new Error("Organization context not found.");
    }

    return { supabase, userId: user.id, orgId: profile.org_id };
  };

  const submitVaccinationSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVaccinationScheduleFlash({ error: null, success: null, loading: true });

    try {
      const { supabase, userId, orgId } = await resolveContext();
      const formData = new FormData(event.currentTarget);

      const flockId = scope.flockId || parseText(formData.get("flock_id"));
      const plannedDate = parseText(formData.get("planned_date"));
      const vaccineName = parseText(formData.get("vaccine_name"));
      const dosage = parseText(formData.get("dosage"));
      const route = parseText(formData.get("route"));

      if (!flockId || !plannedDate || !vaccineName || !dosage || !route) {
        throw new Error("Flock ID, planned date, vaccine name, dosage, and route are required.");
      }
      if (scope.batchId && !batches.some((b) => b.id === scope.batchId && b.flock_id === flockId)) {
        throw new Error("Selected batch is not valid for the selected flock.");
      }

      const batchNumber = scope.batchId
        ? batches.find((b) => b.id === scope.batchId && b.flock_id === flockId)?.batch_code ?? null
        : parseText(formData.get("batch_number"));
      const expiryDate = parseText(formData.get("expiry_date"));
      const birdsTarget = parseNumber(formData.get("birds_target"));
      const notes = parseText(formData.get("schedule_notes"));

      const { error: vaccineError } = await supabase.from("vaccination_events").insert({
        org_id: orgId,
        flock_id: flockId,
        event_date: plannedDate,
        vaccine_name: vaccineName,
        dosage,
        route,
        birds_vaccinated: birdsTarget,
        vet_id: userId,
        batch_number: batchNumber,
        expiry_date: expiryDate,
      });

      if (vaccineError) throw new Error(vaccineError.message);

      if (notes) {
        const { error: noteError } = await supabase.from("health_events").insert({
          org_id: orgId,
          flock_id: flockId,
          event_date: plannedDate,
          event_type: "observation",
          description: `Vaccination schedule note: ${notes}`,
          vet_id: userId,
        });

        if (noteError) throw new Error(noteError.message);
      }

      event.currentTarget.reset();
      setVaccinationScheduleFlash({
        error: null,
        success: "Vaccination schedule saved.",
        loading: false,
      });
    } catch (error) {
      setVaccinationScheduleFlash({
        error: error instanceof Error ? error.message : "Failed to save vaccination schedule.",
        success: null,
        loading: false,
      });
    }
  };

  const submitVaccinationRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVaccinationRecordFlash({ error: null, success: null, loading: true });

    try {
      const { supabase, userId, orgId } = await resolveContext();
      const formData = new FormData(event.currentTarget);

      const flockId = scope.flockId || parseText(formData.get("flock_id"));
      const actualDate = parseText(formData.get("actual_date"));
      const vaccineName = parseText(formData.get("vaccine_name"));
      const dosage = parseText(formData.get("dosage"));
      const route = parseText(formData.get("route"));
      const birdsVaccinated = parseNumber(formData.get("birds_vaccinated"));

      if (!flockId || !actualDate || !vaccineName || !dosage || !route) {
        throw new Error("Flock ID, actual date, vaccine name, dosage, and route are required.");
      }
      if (scope.batchId && !batches.some((b) => b.id === scope.batchId && b.flock_id === flockId)) {
        throw new Error("Selected batch is not valid for the selected flock.");
      }

      const { error: vaccineError } = await supabase.from("vaccination_events").insert({
        org_id: orgId,
        flock_id: flockId,
        event_date: actualDate,
        vaccine_name: vaccineName,
        dosage,
        route,
        birds_vaccinated: birdsVaccinated,
        vet_id: userId,
        batch_number: scope.batchId
          ? batches.find((b) => b.id === scope.batchId && b.flock_id === flockId)?.batch_code ?? null
          : parseText(formData.get("batch_number")),
        expiry_date: parseText(formData.get("expiry_date")),
      });

      if (vaccineError) throw new Error(vaccineError.message);

      const diagnosis = parseText(formData.get("post_vaccination_observation"));
      if (diagnosis) {
        const { error: observationError } = await supabase.from("health_events").insert({
          org_id: orgId,
          flock_id: flockId,
          event_date: actualDate,
          event_type: "observation",
          description: "Post-vaccination observation",
          diagnosis,
          vet_id: userId,
        });

        if (observationError) throw new Error(observationError.message);
      }

      event.currentTarget.reset();
      setVaccinationRecordFlash({
        error: null,
        success: "Vaccination record saved.",
        loading: false,
      });
    } catch (error) {
      setVaccinationRecordFlash({
        error: error instanceof Error ? error.message : "Failed to save vaccination record.",
        success: null,
        loading: false,
      });
    }
  };

  const submitCleanupSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCleanupScheduleFlash({ error: null, success: null, loading: true });

    try {
      const { supabase, orgId } = await resolveContext();
      const formData = new FormData(event.currentTarget);

      const farmId = scope.farmId || parseText(formData.get("farm_id"));
      const checklistDate = parseText(formData.get("checklist_date"));
      const cleanupType = parseText(formData.get("cleanup_type"));

      if (!farmId || !checklistDate || !cleanupType) {
        throw new Error("Farm ID, cleanup date, and cleanup type are required.");
      }

      const scheduleNotes = parseText(formData.get("schedule_notes"));

      const { error } = await supabase.from("biosecurity_checks").insert({
        org_id: orgId,
        farm_id: farmId,
        checklist_date: checklistDate,
        completed_by: null,
        notes: `Scheduled: ${cleanupType}${scheduleNotes ? ` | ${scheduleNotes}` : ""}`,
      });

      if (error) throw new Error(error.message);

      event.currentTarget.reset();
      setCleanupScheduleFlash({
        error: null,
        success: "Farm cleanup schedule saved.",
        loading: false,
      });
    } catch (error) {
      setCleanupScheduleFlash({
        error: error instanceof Error ? error.message : "Failed to schedule cleanup.",
        success: null,
        loading: false,
      });
    }
  };

  const submitCleanupRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCleanupRecordFlash({ error: null, success: null, loading: true });

    try {
      const { supabase, userId, orgId } = await resolveContext();
      const formData = new FormData(event.currentTarget);

      const farmId = scope.farmId || parseText(formData.get("farm_id"));
      const checklistDate = parseText(formData.get("checklist_date"));
      const completedTasks = parseText(formData.get("completed_tasks"));

      if (!farmId || !checklistDate || !completedTasks) {
        throw new Error("Farm ID, completion date, and completed tasks are required.");
      }

      const { error } = await supabase.from("biosecurity_checks").insert({
        org_id: orgId,
        farm_id: farmId,
        checklist_date: checklistDate,
        completed_by: userId,
        notes: `Completed: ${completedTasks}`,
      });

      if (error) throw new Error(error.message);

      event.currentTarget.reset();
      setCleanupRecordFlash({
        error: null,
        success: "Farm cleanup completion recorded.",
        loading: false,
      });
    } catch (error) {
      setCleanupRecordFlash({
        error: error instanceof Error ? error.message : "Failed to record cleanup completion.",
        success: null,
        loading: false,
      });
    }
  };

  const flashBlock = (flash: FlashState) => (
    <>
      {flash.error ? (
        <p className="rounded-xl border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-sm text-ember-500">
          {flash.error}
        </p>
      ) : null}
      {flash.success ? (
        <p className="rounded-xl border border-leaf-500/40 bg-leaf-500/10 px-3 py-2 text-sm text-leaf-500">
          {flash.success}
        </p>
      ) : null}
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Health Module</p>
        <h2 className="text-2xl font-semibold text-forest-900">
          Vaccination and farm cleanup operations
        </h2>
        <p className="mt-2 text-sm text-forest-600">
          Schedule and record vaccination, plus schedule and complete cleanup programs.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Schedule Vaccination</h3>
          <form className="mt-4 grid gap-3" onSubmit={submitVaccinationSchedule}>
            <input name="flock_id" placeholder="Flock ID (or select from manager scope)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <input name="planned_date" type="date" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <input name="vaccine_name" placeholder="Vaccine name" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <input name="dosage" placeholder="Dosage" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <input name="route" placeholder="Route (water/injection/spray/eye_drop)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <input name="birds_target" type="number" placeholder="Target birds count" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <input name="batch_number" placeholder="Vaccine batch number (auto from selected batch)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <input name="expiry_date" type="date" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <textarea name="schedule_notes" placeholder="Scheduling notes" className="min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm" />
            {flashBlock(vaccinationScheduleFlash)}
            <button type="submit" className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60" disabled={vaccinationScheduleFlash.loading}>
              {vaccinationScheduleFlash.loading ? "Saving..." : "Save Schedule"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Register Vaccination</h3>
          <form className="mt-4 grid gap-3" onSubmit={submitVaccinationRecord}>
            <input name="flock_id" placeholder="Flock ID (or select from manager scope)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <input name="actual_date" type="date" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <input name="vaccine_name" placeholder="Vaccine name" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <input name="dosage" placeholder="Dosage administered" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <input name="route" placeholder="Route (water/injection/spray/eye_drop)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <input name="birds_vaccinated" type="number" placeholder="Birds vaccinated" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <input name="batch_number" placeholder="Vaccine batch number (auto from selected batch)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <input name="expiry_date" type="date" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <textarea name="post_vaccination_observation" placeholder="Post-vaccination observation / reaction" className="min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm" />
            {flashBlock(vaccinationRecordFlash)}
            <button type="submit" className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60" disabled={vaccinationRecordFlash.loading}>
              {vaccinationRecordFlash.loading ? "Saving..." : "Save Vaccination Record"}
            </button>
          </form>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Schedule Farm Cleanup</h3>
          <form className="mt-4 grid gap-3" onSubmit={submitCleanupSchedule}>
            <input name="farm_id" placeholder="Farm ID (or select from manager scope)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <input name="checklist_date" type="date" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <input name="cleanup_type" placeholder="Cleanup type (deep clean/disinfection/litter)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <textarea name="schedule_notes" placeholder="Scope, assigned team, equipment, or notes" className="min-h-[90px] rounded-xl border border-sand-200 px-3 py-2 text-sm" />
            {flashBlock(cleanupScheduleFlash)}
            <button type="submit" className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60" disabled={cleanupScheduleFlash.loading}>
              {cleanupScheduleFlash.loading ? "Saving..." : "Save Cleanup Schedule"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-forest-900">Record Cleanup Completion</h3>
          <form className="mt-4 grid gap-3" onSubmit={submitCleanupRecord}>
            <input name="farm_id" placeholder="Farm ID (or select from manager scope)" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" />
            <input name="checklist_date" type="date" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" required />
            <textarea name="completed_tasks" placeholder="Completed tasks, chemicals used, follow-up action" className="min-h-[110px] rounded-xl border border-sand-200 px-3 py-2 text-sm" required />
            {flashBlock(cleanupRecordFlash)}
            <button type="submit" className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60" disabled={cleanupRecordFlash.loading}>
              {cleanupRecordFlash.loading ? "Saving..." : "Record Cleanup Completion"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
