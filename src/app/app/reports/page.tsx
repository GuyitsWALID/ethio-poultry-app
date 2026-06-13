"use client";

import { useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import { createClient } from "@/utils/supabase/client";

type DailyRecord = {
  id: string;
  record_date: string;
  flock_id: string;
  total_eggs: number | null;
  deaths: number | null;
  feed_intake_grams: number | null;
};

type MortalityEvent = {
  id: string;
  flock_id: string;
  record_date: string;
  count: number;
  cause: string;
};

type HealthEvent = {
  id: string;
  event_date: string;
  description: string | null;
  diagnosis: string | null;
  flock_id: string | null;
};

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  reorder_level: number | null;
};

type StockLedger = {
  item_id: string;
  quantity: number;
  transaction_type: "receipt" | "issue" | "transfer_out" | "transfer_in" | "adjustment" | "return";
};

function signedQuantity(entry: StockLedger) {
  return entry.transaction_type === "issue" || entry.transaction_type === "transfer_out" ? -entry.quantity : entry.quantity;
}

export default function ReportsPage() {
  const { scope, filteredFlocks } = useFarmScope();
  const [loading, setLoading] = useState(true);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [mortalityEvents, setMortalityEvents] = useState<MortalityEvent[]>([]);
  const [healthEvents, setHealthEvents] = useState<HealthEvent[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [ledger, setLedger] = useState<StockLedger[]>([]);
  const [error, setError] = useState<string | null>(null);

  const flockLabelMap = useMemo(() => new Map(filteredFlocks.map((flock) => [flock.id, flock.flock_code])), [filteredFlocks]);
  const scopedFlockIds = useMemo(
    () =>
      filteredFlocks
      .filter((flock) => !scope.batchId || flock.batch_id === scope.batchId)
        .map((flock) => flock.id),
    [filteredFlocks, scope.batchId]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const contextResponse = await fetch("/api/me/context", { method: "GET" });
      const context = contextResponse.ok ? await contextResponse.json() : null;
      const orgId = context?.orgId as string | null;
      if (!orgId) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      let dailyQuery = supabase
        .from("daily_farm_records")
        .select("id, record_date, flock_id, total_eggs, deaths, feed_intake_grams")
        .eq("org_id", orgId)
        .order("record_date", { ascending: false })
        .limit(500);
      let mortalityQuery = supabase
        .from("mortality_events")
        .select("id, flock_id, record_date, count, cause")
        .eq("org_id", orgId)
        .order("record_date", { ascending: false })
        .limit(500);
      let healthQuery = supabase
        .from("health_events")
        .select("id, event_date, description, diagnosis, flock_id")
        .eq("org_id", orgId)
        .order("event_date", { ascending: false })
        .limit(500);

      if (scope.flockId) {
        dailyQuery = dailyQuery.eq("flock_id", scope.flockId);
        mortalityQuery = mortalityQuery.eq("flock_id", scope.flockId);
        healthQuery = healthQuery.eq("flock_id", scope.flockId);
      } else if (scopedFlockIds.length > 0) {
        dailyQuery = dailyQuery.in("flock_id", scopedFlockIds);
        mortalityQuery = mortalityQuery.in("flock_id", scopedFlockIds);
        healthQuery = healthQuery.in("flock_id", scopedFlockIds);
      } else if (scope.branchId || scope.farmId || scope.houseId || scope.batchId) {
        setDailyRecords([]);
        setMortalityEvents([]);
        setHealthEvents([]);
        setItems([]);
        setLedger([]);
        setLoading(false);
        return;
      }

      const [dailyRes, mortalityRes, healthRes, itemRes, ledgerRes] = await Promise.all([
        dailyQuery,
        mortalityQuery,
        healthQuery,
        supabase.from("inventory_items").select("id, name, category, unit, reorder_level").eq("org_id", orgId).order("name"),
        supabase.from("stock_ledger").select("item_id, quantity, transaction_type").eq("org_id", orgId).limit(2000),
      ]);

      const firstError = dailyRes.error ?? mortalityRes.error ?? healthRes.error ?? itemRes.error ?? ledgerRes.error;
      if (firstError) setError(firstError.message);
      setDailyRecords((dailyRes.data ?? []) as DailyRecord[]);
      setMortalityEvents((mortalityRes.data ?? []) as MortalityEvent[]);
      setHealthEvents((healthRes.data ?? []) as HealthEvent[]);
      setItems((itemRes.data ?? []) as InventoryItem[]);
      setLedger((ledgerRes.data ?? []) as StockLedger[]);
      setLoading(false);
    };

    void load();
  }, [scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId, scopedFlockIds]);

  const totals = useMemo(() => {
    const eggs = dailyRecords.reduce((sum, record) => sum + (record.total_eggs ?? 0), 0);
    const deaths = dailyRecords.reduce((sum, record) => sum + (record.deaths ?? 0), 0);
    const feedKg = dailyRecords.reduce((sum, record) => sum + (record.feed_intake_grams ?? 0) / 1000, 0);
    return { eggs, deaths, feedKg };
  }, [dailyRecords]);

  const stockByItem = useMemo(() => {
    const map = new Map<string, number>();
    ledger.forEach((entry) => map.set(entry.item_id, (map.get(entry.item_id) ?? 0) + signedQuantity(entry)));
    return map;
  }, [ledger]);

  const lowStock = items.filter((item) => item.reorder_level !== null && (stockByItem.get(item.id) ?? 0) <= item.reorder_level);
  const missedSchedules = healthEvents.filter((event) => event.description?.startsWith("SCHEDULE_STATUS|") && event.description.includes("|missed|"));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Reports</p>
        <h2 className="text-2xl font-semibold text-forest-900">Operational System A Reports</h2>
        <p className="mt-2 text-sm text-forest-600">
          Readable summaries for daily records, flock performance, feed use, mortality, health schedules, and inventory.
        </p>
      </div>

      {error ? <p className="rounded-xl border border-ember-500/30 bg-ember-500/10 p-3 text-sm text-ember-600">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Daily Records</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{loading ? "..." : dailyRecords.length}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Eggs</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{totals.eggs.toLocaleString()}</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Feed Used</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{totals.feedKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Low Stock</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{lowStock.length}</p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-forest-900">Flock Performance Snapshot</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600"><th className="px-2 py-2">Date</th><th className="px-2 py-2">Flock</th><th className="px-2 py-2">Eggs</th><th className="px-2 py-2">Deaths</th><th className="px-2 py-2">Feed Kg</th></tr></thead>
              <tbody>
                {dailyRecords.slice(0, 12).map((record) => (
                  <tr key={record.id} className="border-b border-sand-100">
                    <td className="px-2 py-2">{record.record_date}</td>
                    <td className="px-2 py-2">{flockLabelMap.get(record.flock_id) ?? record.flock_id}</td>
                    <td className="px-2 py-2">{record.total_eggs ?? 0}</td>
                    <td className="px-2 py-2">{record.deaths ?? 0}</td>
                    <td className="px-2 py-2">{((record.feed_intake_grams ?? 0) / 1000).toFixed(2)}</td>
                  </tr>
                ))}
                {dailyRecords.length === 0 ? <tr><td className="px-2 py-4 text-forest-600" colSpan={5}>No records in scope.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-forest-900">Risk + Compliance</h3>
          <div className="mt-4 grid gap-3">
            <p className="rounded-xl bg-sand-50 p-4 text-sm text-forest-700">Mortality events: <span className="font-semibold text-forest-900">{mortalityEvents.length}</span></p>
            <p className="rounded-xl bg-sand-50 p-4 text-sm text-forest-700">Daily-record deaths: <span className="font-semibold text-forest-900">{totals.deaths.toLocaleString()}</span></p>
            <p className="rounded-xl bg-sand-50 p-4 text-sm text-forest-700">Missed health schedules: <span className="font-semibold text-forest-900">{missedSchedules.length}</span></p>
            <p className="rounded-xl bg-sand-50 p-4 text-sm text-forest-700">Low-stock items: <span className="font-semibold text-forest-900">{lowStock.map((item) => item.name).join(", ") || "None"}</span></p>
          </div>
        </section>
      </div>
    </div>
  );
}
