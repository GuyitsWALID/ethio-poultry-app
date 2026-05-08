"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

export default function MortalityPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Mortality</p>
        <h2 className="text-2xl font-semibold text-forest-900">Mortality events and summary</h2>
        <p className="mt-2 text-sm text-forest-600">
          Dedicated view for mortality tracking and trend review.
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
              mortalityEvents.slice(0, 12).map((event) => (
                <div key={event.id} className="rounded-xl border border-sand-100 bg-sand-50/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-forest-900">{event.cause}</p>
                    <span className="text-xs text-forest-500">
                      {event.record_date}
                      {event.recorded_time ? ` • ${event.recorded_time}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-forest-600">
                    Flock: {event.flock_id} • Count: {event.count}
                  </p>
                  {event.diagnosis ? <p className="mt-1 text-xs text-forest-500">Diagnosis: {event.diagnosis}</p> : null}
                  {event.notes ? <p className="mt-1 text-xs text-forest-500">Notes: {event.notes}</p> : null}
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
              mortalitySummary.slice(0, 12).map((summary) => (
                <div
                  key={`${summary.flock_id}-${summary.record_date}`}
                  className="flex items-center justify-between rounded-xl border border-sand-100 bg-sand-50/40 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-forest-900">{summary.record_date}</p>
                    <p className="text-xs text-forest-500">Flock: {summary.flock_id}</p>
                  </div>
                  <span className="text-sm font-semibold text-forest-900">{summary.total_count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
