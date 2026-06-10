"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import type { Database } from "@/types/supabase";
import { createClient } from "@/utils/supabase/client";

type FeedType = Database["public"]["Enums"]["feed_type"];

type FeedingScheduleRow = {
  id: string;
  schedule_date: string;
  batch_id: string;
  feed_type: FeedType | string;
  planned_feed_kg: number;
  target_grams_per_bird: number | null;
};

type ScheduleVarianceRow = FeedingScheduleRow & {
  flock_id: string;
  actual_kg: number | null;
  planned_session_kg: number;
  session_count: number;
  missing_session_actuals: number;
  variance_kg: number | null;
  actual_g_per_bird: number | null;
  status: "Missing actual" | "Under target" | "Over target" | "On track";
};

type SessionSummaryRow = {
  record_date: string;
  batch_id: string;
  flock_id: string;
  planned_feed_kg: number;
  actual_feed_kg: number | null;
};

const feedTypeOptions: Array<{ value: FeedType; label: string }> = [
  { value: "starter_feed", label: "Starter Feed" },
  { value: "grower_pullet_feed", label: "Grower Pullet Feed" },
  { value: "layer_feed", label: "Layer Feed" },
  { value: "broiler_feed", label: "Broiler Feed" },
  { value: "medicated_feed", label: "Medicated Feed" },
];

const feedTypeLabels = new Map(feedTypeOptions.map((option) => [option.value, option.label]));

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
  const [scheduleRows, setScheduleRows] = useState<ScheduleVarianceRow[]>([]);
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

    const dates = Array.from(new Set(schedules.map((s) => s.schedule_date)));
    const batchIds = Array.from(new Set(schedules.map((s) => s.batch_id)));

    let actualRows: SessionSummaryRow[] = [];
    if (batchIds.length > 0 && dates.length > 0) {
      const { data } = await supabase
        .from("feeding_session_records")
        .select("record_date, batch_id, flock_id, planned_feed_kg, actual_feed_kg")
        .eq("org_id", profile.org_id)
        .in("batch_id", batchIds)
        .in("record_date", dates);
      actualRows = (data ?? []) as SessionSummaryRow[];
    }

    const actualMap = new Map<
      string,
      { actualKg: number; plannedSessionKg: number; sessionCount: number; missingActuals: number; flockId: string }
    >();
    actualRows.forEach((row) => {
      const key = `${row.batch_id}::${row.record_date}`;
      const current = actualMap.get(key) ?? {
        actualKg: 0,
        plannedSessionKg: 0,
        sessionCount: 0,
        missingActuals: 0,
        flockId: row.flock_id,
      };
      current.plannedSessionKg += row.planned_feed_kg ?? 0;
      current.sessionCount += 1;
      current.flockId = row.flock_id;
      if (row.actual_feed_kg === null || row.actual_feed_kg === undefined) {
        current.missingActuals += 1;
      } else {
        current.actualKg += row.actual_feed_kg;
      }
      actualMap.set(key, current);
    });

    const nextScheduleRows = schedules.map((s) => {
      const flockId = batchFlockMap.get(s.batch_id) ?? "";
      const actual = actualMap.get(`${s.batch_id}::${s.schedule_date}`);
      const actualKg = !actual || actual.sessionCount === 0 || actual.missingActuals > 0 ? null : actual.actualKg;
      const varianceKg = actualKg === null ? null : Number((actualKg - s.planned_feed_kg).toFixed(2));
      const tol = Number((s.planned_feed_kg * 0.05).toFixed(2));
      const status: ScheduleVarianceRow["status"] =
        actualKg === null ? "Missing actual" : varianceKg! < -tol ? "Under target" : varianceKg! > tol ? "Over target" : "On track";
      return {
        ...s,
        flock_id: actual?.flockId ?? flockId,
        actual_kg: actualKg,
        planned_session_kg: Number((actual?.plannedSessionKg ?? 0).toFixed(2)),
        session_count: actual?.sessionCount ?? 0,
        missing_session_actuals: actual?.missingActuals ?? 0,
        variance_kg: varianceKg,
        actual_g_per_bird:
          actualKg === null || !actual?.flockId
            ? null
            : (() => {
                const liveBirds = filteredFlocks.find((flock) => flock.id === actual.flockId)?.current_count ?? 0;
                return liveBirds > 0 ? Number(((actualKg * 1000) / liveBirds).toFixed(2)) : null;
              })(),
        status,
      };
    });
    setScheduleRows(nextScheduleRows);

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
  }, [batchFlockMap, filteredFlocks, scopedBatchIds, scope.batchId, scope.flockId]);

  useEffect(() => { void (async () => { const r = await fetch("/api/me/context"); if (r.ok) setCurrentRole(String((await r.json())?.role ?? "")); })(); }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadRows(); }, [loadRows]);

  const saveSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null); setFormSuccess(null); setIsSubmitting(true);
    if (!canManage || !scope.batchId) { setFormError("Select batch and ensure your role can manage schedules."); setIsSubmitting(false); return; }

    const f = new FormData(event.currentTarget);
    const schedule_date = String(f.get("schedule_date") ?? "").trim();
    const feed_type = String(f.get("feed_type") ?? "").trim() as FeedType;
    const planned_feed_kg = Number(f.get("planned_feed_kg"));
    const target_grams_per_bird_raw = String(f.get("target_grams_per_bird") ?? "").trim();
    const target_grams_per_bird = target_grams_per_bird_raw ? Number(target_grams_per_bird_raw) : null;
    if (!schedule_date || !feed_type || !Number.isFinite(planned_feed_kg) || planned_feed_kg <= 0) {
      setFormError("Provide valid date, type, and planned kg."); setIsSubmitting(false); return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user?.id ?? "").single();
    if (!profile?.org_id) {
      setFormError("Organization not found for this user.");
      setIsSubmitting(false);
      return;
    }
    const { error } = await supabase.from("feeding_schedules").upsert({
      org_id: profile.org_id,
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
    if (!profile?.org_id) {
      setSessionError("Organization not found for this user.");
      setIsSessionSubmitting(false);
      return;
    }
    const { error } = await supabase.from("feeding_session_records").upsert({
      org_id: profile.org_id,
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
          <select name="feed_type" required className={inputClass}>
            <option value="">Select feed type</option>
            {feedTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
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
        <h3 className="text-base font-semibold text-forest-900">Plan vs Actual Feed</h3>
        <p className="mt-1 text-sm text-forest-600">Compares batch feed plans to daily feed intake for the linked flock.</p>
        <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-sand-100">
          <table className="min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.12em] text-forest-600 [&>th]:whitespace-nowrap [&>th]:px-4 [&>th]:py-3">
                <th>Date</th>
                <th>Batch</th>
                <th>Flock</th>
                <th>Planned Type</th>
                <th>Planned Kg</th>
                <th>Session Plan Kg</th>
                <th>Actual Kg</th>
                <th>Actual g/bird</th>
                <th>Variance Kg</th>
                <th>Sessions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr><td colSpan={11} className="px-4 py-4 text-forest-600">Loading feed plans...</td></tr>
              ) : scheduleRows.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-4 text-forest-600">No feed schedules found for the selected scope.</td></tr>
              ) : (
                scheduleRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b border-sand-100 [&>td]:whitespace-nowrap [&>td]:px-4 [&>td]:py-3 ${
                      row.status === "Missing actual"
                        ? "bg-amber-500/10"
                        : row.status === "Under target"
                          ? "bg-ember-500/10"
                          : row.status === "Over target"
                            ? "bg-sky-500/10"
                            : ""
                    }`}
                  >
                    <td>{row.schedule_date}</td>
                    <td>{batchLabelMap.get(row.batch_id) ?? row.batch_id}</td>
                    <td>{flockLabelMap.get(row.flock_id) ?? row.flock_id}</td>
                    <td>{feedTypeLabels.get(row.feed_type as FeedType) ?? row.feed_type}</td>
                    <td>{row.planned_feed_kg.toFixed(2)}</td>
                    <td>{row.planned_session_kg > 0 ? row.planned_session_kg.toFixed(2) : "-"}</td>
                    <td>{row.actual_kg === null ? "-" : row.actual_kg.toFixed(2)}</td>
                    <td>{row.actual_g_per_bird === null ? "-" : row.actual_g_per_bird.toFixed(2)}</td>
                    <td>{row.variance_kg === null ? "-" : row.variance_kg.toFixed(2)}</td>
                    <td>
                      {row.session_count === 0
                        ? "No sessions"
                        : row.missing_session_actuals > 0
                          ? `${row.session_count} (${row.missing_session_actuals} missing)`
                          : row.session_count}
                    </td>
                    <td>
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        row.status === "On track"
                          ? "bg-leaf-500/10 text-leaf-700"
                        : row.status === "Missing actual"
                          ? "bg-amber-500/10 text-amber-700"
                          : row.status === "Over target"
                            ? "bg-sky-500/10 text-sky-700"
                            : "bg-ember-500/10 text-ember-700"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
