"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type FeedingScheduleRow = {
  id: string;
  schedule_date: string;
  batch_id: string;
  feed_type: string;
  planned_feed_kg: number;
  target_grams_per_bird: number | null;
};

type DailyFeedRow = {
  record_date: string;
  flock_id: string;
  feed_type: string | null;
  feed_intake_grams: number | null;
};

type SessionRow = {
  id: string;
  record_date: string;
  session_name: string;
  session_time: string | null;
  batch_id: string;
  flock_id: string;
  feeders_count: number;
  planned_feed_kg: number;
  actual_feed_kg: number | null;
};

export default function FeedingSchedulerPage() {
  const { scope, filteredFlocks, filteredBatches } = useFarmScope();
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSessionSubmitting, setIsSessionSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionSuccess, setSessionSuccess] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  const canManage = currentRole === "farm_manager" || currentRole === "ceo";

  const flockLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredFlocks.forEach((flock) => map.set(flock.id, flock.flock_code));
    return map;
  }, [filteredFlocks]);

  const batchLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredBatches.forEach((batch) => map.set(batch.id, batch.batch_code));
    return map;
  }, [filteredBatches]);

  const batchFlockMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredBatches.forEach((batch) => map.set(batch.id, batch.flock_id));
    return map;
  }, [filteredBatches]);

  const scopedBatchIds = useMemo(() => {
    if (scope.batchId) return [scope.batchId];
    return filteredBatches.map((batch) => batch.id);
  }, [filteredBatches, scope.batchId]);

  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSessionRows([]);
      setLoadingRows(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
    if (!profile?.org_id) {
      setSessionRows([]);
      setLoadingRows(false);
      return;
    }

    let scheduleQuery = supabase
      .from("feeding_schedules")
      .select("id, schedule_date, batch_id, feed_type, planned_feed_kg, target_grams_per_bird")
      .eq("org_id", profile.org_id)
      .order("schedule_date", { ascending: false })
      .limit(200);

    if (scope.batchId) scheduleQuery = scheduleQuery.eq("batch_id", scope.batchId);
    else if (scopedBatchIds.length > 0) scheduleQuery = scheduleQuery.in("batch_id", scopedBatchIds);

    const { data: scheduleData } = await scheduleQuery;
    const schedules = (scheduleData ?? []) as FeedingScheduleRow[];

    const flockIds = Array.from(new Set(schedules.map((s) => batchFlockMap.get(s.batch_id)).filter(Boolean))) as string[];
    const dates = Array.from(new Set(schedules.map((s) => s.schedule_date)));

    let actualRows: DailyFeedRow[] = [];
    if (flockIds.length > 0 && dates.length > 0) {
      const { data } = await supabase
        .from("daily_farm_records")
        .select("record_date, flock_id, feed_type, feed_intake_grams")
        .eq("org_id", profile.org_id)
        .in("flock_id", flockIds)
        .in("record_date", dates);
      actualRows = (data ?? []) as DailyFeedRow[];
    }

    const actualMap = new Map<string, DailyFeedRow>();
    actualRows.forEach((row) => actualMap.set(`${row.flock_id}::${row.record_date}`, row));

    schedules.map((s) => {
      const flockId = batchFlockMap.get(s.batch_id) ?? "";
      const actual = actualMap.get(`${flockId}::${s.schedule_date}`);
      const actualKg = actual?.feed_intake_grams === null || actual?.feed_intake_grams === undefined ? null : actual.feed_intake_grams / 1000;
      const varianceKg = actualKg === null ? null : Number((actualKg - s.planned_feed_kg).toFixed(2));
      const tol = Number((s.planned_feed_kg * 0.05).toFixed(2));
      const status = actualKg === null ? "Missing actual" : varianceKg! < -tol ? "Under target" : varianceKg! > tol ? "Over target" : "On track";
      return {
        ...s,
        flock_id: flockId,
        actual_feed_type: actual?.feed_type ?? null,
        actual_kg: actualKg,
        variance_kg: varianceKg,
        actual_g_per_bird: actual?.feed_intake_grams ?? null,
        status,
      };
    });

    let sessionQuery = supabase
      .from("feeding_session_records")
      .select("id, record_date, session_name, session_time, batch_id, flock_id, feeders_count, planned_feed_kg, actual_feed_kg")
      .eq("org_id", profile.org_id)
      .order("record_date", { ascending: false })
      .limit(300);
    if (scope.batchId) sessionQuery = sessionQuery.eq("batch_id", scope.batchId);
    else if (scopedBatchIds.length > 0) sessionQuery = sessionQuery.in("batch_id", scopedBatchIds);
    if (scope.flockId) sessionQuery = sessionQuery.eq("flock_id", scope.flockId);

    const { data: sessionData } = await sessionQuery;
    setSessionRows((sessionData ?? []) as SessionRow[]);

    setLoadingRows(false);
  }, [batchFlockMap, scopedBatchIds, scope.batchId, scope.flockId]);

  useEffect(() => { void (async () => { const r = await fetch("/api/me/context"); if (r.ok) setCurrentRole(String((await r.json())?.role ?? "")); })(); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadRows(); }, [loadRows]);

  const saveSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null); setFormSuccess(null); setIsSubmitting(true);
    if (!canManage || !scope.batchId) { setFormError("Select batch and ensure your role can manage schedules."); setIsSubmitting(false); return; }

    const f = new FormData(event.currentTarget);
    const schedule_date = String(f.get("schedule_date") ?? "").trim();
    const feed_type = String(f.get("feed_type") ?? "").trim();
    const planned_feed_kg = Number(f.get("planned_feed_kg"));
    const target_grams_per_bird_raw = String(f.get("target_grams_per_bird") ?? "").trim();
    const target_grams_per_bird = target_grams_per_bird_raw ? Number(target_grams_per_bird_raw) : null;
    if (!schedule_date || !feed_type || !Number.isFinite(planned_feed_kg) || planned_feed_kg <= 0) {
      setFormError("Provide valid date, type, and planned kg."); setIsSubmitting(false); return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user?.id ?? "").single();
    const { error } = await supabase.from("feeding_schedules").upsert({
      org_id: profile?.org_id,
      batch_id: scope.batchId,
      schedule_date,
      feed_type,
      planned_feed_kg,
      target_grams_per_bird,
      created_by: user?.id,
    }, { onConflict: "org_id,batch_id,schedule_date" });

    if (error) setFormError(error.message); else { setFormSuccess("Schedule saved."); event.currentTarget.reset(); await loadRows(); }
    setIsSubmitting(false);
  };

  const saveSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSessionError(null); setSessionSuccess(null); setIsSessionSubmitting(true);
    if (!canManage || !scope.batchId || !scope.flockId) { setSessionError("Select batch and flock to save session tracking."); setIsSessionSubmitting(false); return; }

    const f = new FormData(event.currentTarget);
    const record_date = String(f.get("record_date") ?? "").trim();
    const session_name = String(f.get("session_name") ?? "").trim();
    const session_time_raw = String(f.get("session_time") ?? "").trim();
    const session_time = session_time_raw || null;
    const feeders_count = Number(f.get("feeders_count"));
    const planned_feed_kg = Number(f.get("planned_feed_kg"));
    const actual_feed_raw = String(f.get("actual_feed_kg") ?? "").trim();
    const actual_feed_kg = actual_feed_raw ? Number(actual_feed_raw) : null;
    const notes = String(f.get("notes") ?? "").trim() || null;

    if (!record_date || !session_name || !Number.isFinite(feeders_count) || feeders_count <= 0 || !Number.isFinite(planned_feed_kg) || planned_feed_kg <= 0) {
      setSessionError("Provide valid date, session, feeders count, and planned kg."); setIsSessionSubmitting(false); return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user?.id ?? "").single();
    const { error } = await supabase.from("feeding_session_records").upsert({
      org_id: profile?.org_id,
      batch_id: scope.batchId,
      flock_id: scope.flockId,
      record_date,
      session_name,
      session_time,
      feeders_count,
      planned_feed_kg,
      actual_feed_kg,
      notes,
      recorded_by: user?.id,
    }, { onConflict: "org_id,flock_id,record_date,session_name" });

    if (error) setSessionError(error.message); else { setSessionSuccess("Session record saved."); event.currentTarget.reset(); await loadRows(); }
    setIsSessionSubmitting(false);
  };

  const inputClass = "h-11 w-full rounded-xl border border-sand-200 px-3 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Nutrition</p>
        <h2 className="text-2xl font-semibold text-forest-900">Feeding Scheduler</h2>
        <p className="mt-1 text-sm text-forest-600">Batch plan + per-flock session tracking with feeders count and plan-vs-actual checks.</p>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-forest-900">Batch Daily Schedule</h3>
        <form className="mt-4 grid gap-4 md:grid-cols-5" onSubmit={saveSchedule}>
          <input name="schedule_date" type="date" required className={inputClass} />
          <input name="feed_type" type="text" placeholder="Feed type" required className={inputClass} />
          <input name="planned_feed_kg" type="number" min={0.01} step="0.01" placeholder="Planned kg" required className={inputClass} />
          <input name="target_grams_per_bird" type="number" min={0} step="0.01" placeholder="Target g/bird" className={inputClass} />
          <button type="submit" disabled={isSubmitting || !canManage} className="h-11 rounded-xl bg-forest-900 text-sand-50">{isSubmitting ? "Saving..." : "Save Schedule"}</button>
        </form>
        {formError ? <p className="mt-2 text-sm text-ember-500">{formError}</p> : null}
        {formSuccess ? <p className="mt-2 text-sm text-leaf-500">{formSuccess}</p> : null}
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-forest-900">Per-Flock Session Tracking</h3>
        <form className="mt-4 grid gap-4 md:grid-cols-6" onSubmit={saveSession}>
          <input name="record_date" type="date" required className={inputClass} />
          <input name="session_name" type="text" placeholder="Morning / Noon / Evening" required className={inputClass} />
          <input name="session_time" type="time" className={inputClass} />
          <input name="feeders_count" type="number" min={1} step={1} placeholder="# Feeders" required className={inputClass} />
          <input name="planned_feed_kg" type="number" min={0.01} step="0.01" placeholder="Planned kg" required className={inputClass} />
          <input name="actual_feed_kg" type="number" min={0} step="0.01" placeholder="Actual kg" className={inputClass} />
          <textarea name="notes" rows={2} placeholder="Notes" className="md:col-span-6 rounded-xl border border-sand-200 px-3 py-2 text-sm" />
          <button type="submit" disabled={isSessionSubmitting || !canManage} className="h-11 rounded-xl bg-forest-900 text-sand-50 md:col-span-2">{isSessionSubmitting ? "Saving..." : "Save Session Record"}</button>
        </form>
        {sessionError ? <p className="mt-2 text-sm text-ember-500">{sessionError}</p> : null}
        {sessionSuccess ? <p className="mt-2 text-sm text-leaf-500">{sessionSuccess}</p> : null}
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-forest-900">Session Records</h3>
        <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-sand-100">
          <table className="min-w-[1000px] text-sm">
            <thead><tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.12em] text-forest-600 [&>th]:whitespace-nowrap [&>th]:px-4 [&>th]:py-3"><th className="px-2 py-2">Date</th><th className="px-2 py-2">Session</th><th className="px-2 py-2">Batch</th><th className="px-2 py-2">Flock</th><th className="px-2 py-2">Feeders</th><th className="px-2 py-2">Planned Kg</th><th className="px-2 py-2">Actual Kg</th><th className="px-2 py-2">Variance</th></tr></thead>
            <tbody>
              {loadingRows ? <tr><td colSpan={8} className="px-2 py-4">Loading...</td></tr> : sessionRows.length === 0 ? <tr><td colSpan={8} className="px-2 py-4">No session records.</td></tr> : sessionRows.map((r) => {
                const variance = r.actual_feed_kg === null ? null : Number((r.actual_feed_kg - r.planned_feed_kg).toFixed(2));
                return <tr key={r.id} className="border-b border-sand-100 [&>td]:whitespace-nowrap [&>td]:px-4 [&>td]:py-3"><td className="px-2 py-2">{r.record_date}</td><td className="px-2 py-2">{r.session_name}</td><td className="px-2 py-2">{batchLabelMap.get(r.batch_id) ?? r.batch_id}</td><td className="px-2 py-2">{flockLabelMap.get(r.flock_id) ?? r.flock_id}</td><td className="px-2 py-2">{r.feeders_count}</td><td className="px-2 py-2">{r.planned_feed_kg.toFixed(2)}</td><td className="px-2 py-2">{r.actual_feed_kg === null ? "-" : r.actual_feed_kg.toFixed(2)}</td><td className="px-2 py-2">{variance === null ? "-" : variance.toFixed(2)}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
