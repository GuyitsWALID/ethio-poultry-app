"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type FeedingLogRow = {
  id: string;
  record_date: string;
  flock_id: string;
  feed_type: string | null;
  feed_consumed_kg: number | null;
  created_at: string;
};

export default function FeedingLogPage() {
  const { scope, filteredFlocks } = useFarmScope();
  const [rows, setRows] = useState<FeedingLogRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const canManage = currentRole === "farm_manager" || currentRole === "ceo";

  const flockLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    filteredFlocks.forEach((flock) => map.set(flock.id, flock.flock_code));
    return map;
  }, [filteredFlocks]);

  const scopedFlockIds = useMemo(() => {
    if (scope.flockId) return [scope.flockId];
    return filteredFlocks.map((flock) => flock.id);
  }, [filteredFlocks, scope.flockId]);

  const loadRows = useCallback(async () => {
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

    if (scopedFlockIds.length === 0 && (scope.branchId || scope.farmId || scope.houseId || scope.flockId)) {
      setRows([]);
      setLoadingRows(false);
      return;
    }

    let query = supabase
      .from("daily_farm_records")
      .select("id, record_date, flock_id, feed_type, feed_consumed_kg, created_at")
      .eq("org_id", profile.org_id)
      .not("feed_consumed_kg", "is", null)
      .order("record_date", { ascending: false })
      .limit(200);

    if (scope.flockId) {
      query = query.eq("flock_id", scope.flockId);
    } else if (scopedFlockIds.length > 0) {
      query = query.in("flock_id", scopedFlockIds);
    }

    if (fromDate) query = query.gte("record_date", fromDate);
    if (toDate) query = query.lte("record_date", toDate);

    const { data } = await query;
    setRows((data ?? []) as FeedingLogRow[]);
    setLoadingRows(false);
  }, [fromDate, scopedFlockIds, scope.branchId, scope.farmId, scope.flockId, scope.houseId, toDate]);

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
  }, [loadRows]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setIsSubmitting(true);

    if (!canManage) {
      setFormError("You are not authorized to create feeding log records.");
      setIsSubmitting(false);
      return;
    }

    if (!scope.flockId) {
      setFormError("Please select a flock from the top scope filters first.");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const recordDate = formData.get("record_date")?.toString().trim();
    const feedType = formData.get("feed_type")?.toString().trim();
    const feedKgRaw = formData.get("feed_consumed_kg")?.toString().trim();
    const feedKg = feedKgRaw ? Number(feedKgRaw) : NaN;

    if (!recordDate) {
      setFormError("Record date is required.");
      setIsSubmitting(false);
      return;
    }

    if (!feedType) {
      setFormError("Feed type is required.");
      setIsSubmitting(false);
      return;
    }

    if (!Number.isFinite(feedKg) || feedKg <= 0) {
      setFormError("Feed consumed must be a valid number greater than zero.");
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

    const { error: upsertError } = await supabase.from("daily_farm_records").upsert(
      {
        org_id: profile.org_id,
        flock_id: scope.flockId,
        record_date: recordDate,
        feed_type: feedType,
        feed_consumed_kg: feedKg,
        recorded_by: user.id,
      },
      { onConflict: "org_id,flock_id,record_date" }
    );

    if (upsertError) {
      setFormError(upsertError.message);
      setIsSubmitting(false);
      return;
    }

    setFormSuccess("Feeding log saved.");
    event.currentTarget.reset();
    setIsSubmitting(false);
    await loadRows();
  };

  const inputClass = "h-11 w-full rounded-xl border border-sand-200 px-3 text-sm";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Nutrition</p>
        <h2 className="text-2xl font-semibold text-forest-900">Feeding Log</h2>
        <p className="mt-1 text-sm text-forest-600">
          Record daily feed usage per flock and track historical consumption.
        </p>
      </div>

      {!canManage ? (
        <p className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm text-forest-700">
          View mode only for your role.
        </p>
      ) : null}

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-forest-900">New Feeding Entry</h3>
        <form className="mt-4 grid gap-4 md:grid-cols-4" onSubmit={handleSubmit}>
          <label className="grid gap-1 text-xs text-forest-600">
            Date
            <input name="record_date" type="date" required className={inputClass} />
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            Feed Type
            <input name="feed_type" type="text" placeholder="Starter / Grower / Layer..." required className={inputClass} />
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            Feed Consumed (kg)
            <input name="feed_consumed_kg" type="number" min={0.01} step="0.01" required className={inputClass} />
          </label>
          <div className="grid gap-1 text-xs text-forest-600">
            <span>Submit</span>
            <button
              type="submit"
              disabled={isSubmitting || !canManage}
              className="h-11 rounded-xl bg-forest-900 px-3 text-sm font-medium text-sand-50 disabled:opacity-60"
            >
              {isSubmitting ? "Saving..." : "Save Entry"}
            </button>
          </div>
        </form>
        {!scope.flockId ? (
          <p className="mt-3 text-xs text-forest-600">Tip: choose a specific flock in the top scope filters before saving.</p>
        ) : null}
        {formError ? (
          <p className="mt-3 rounded-xl border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-sm text-ember-500">
            {formError}
          </p>
        ) : null}
        {formSuccess ? (
          <p className="mt-3 rounded-xl border border-leaf-500/40 bg-leaf-500/10 px-3 py-2 text-sm text-leaf-500">
            {formSuccess}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-forest-900">History</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="grid gap-1 text-xs text-forest-600">
            From date
            <input className={inputClass} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            To date
            <input className={inputClass} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </label>
          <div className="grid gap-1 text-xs text-forest-600">
            <span>Actions</span>
            <button
              type="button"
              className="h-11 rounded-xl border border-sand-200 px-3 text-sm text-forest-700"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.12em] text-forest-600">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Feed Type</th>
                <th className="px-2 py-2">Consumed (kg)</th>
              </tr>
            </thead>
            <tbody>
              {loadingRows ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={4}>
                    Loading feeding logs...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={4}>
                    No feeding log records found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-sand-100">
                    <td className="px-2 py-2 text-forest-700">{row.record_date}</td>
                    <td className="px-2 py-2 text-forest-700">{flockLabelMap.get(row.flock_id) ?? row.flock_id}</td>
                    <td className="px-2 py-2 text-forest-700">{row.feed_type ?? "-"}</td>
                    <td className="px-2 py-2 text-forest-700">{row.feed_consumed_kg ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
