"use client";

import { useEffect, useMemo, useState } from "react";

import { useFarmScope } from "@/components/farm-scope-context";
import type { Database } from "@/types/supabase";
import { createClient } from "@/utils/supabase/client";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  reorder_level: number | null;
  unit_cost: number | null;
};

type StockLedgerRow = {
  item_id: string;
  quantity: number;
  transaction_type: "receipt" | "issue" | "transfer_out" | "transfer_in" | "adjustment" | "return";
};

type FeedScheduleRow = {
  flock_id: string;
  record_date: string;
  feed_type: string | null;
  feed_consumed_kg: number | null;
};

type InventoryCategory = Database["public"]["Enums"]["inventory_category"];

export default function InventoryPage() {
  const { scope, filteredFlocks, filteredBatches } = useFarmScope();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [ledger, setLedger] = useState<StockLedgerRow[]>([]);
  const [feedRows, setFeedRows] = useState<FeedScheduleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCeoLimitedEdit, setIsCeoLimitedEdit] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("feed");
  const [unit, setUnit] = useState("kg");
  const [reorderLevel, setReorderLevel] = useState(0);
  const [unitCost, setUnitCost] = useState(0);

  const loadData = async () => {
    setLoading(true);
    const contextResponse = await fetch("/api/me/context", { method: "GET" });
    if (!contextResponse.ok) {
      setLoading(false);
      return;
    }
    const context = await contextResponse.json();
    const nextOrgId = context?.orgId as string | null;
    setOrgId(nextOrgId);
    setIsCeoLimitedEdit(context?.role === "ceo");
    if (!nextOrgId) {
      setItems([]);
      setLedger([]);
      setFeedRows([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const scopedFlockIds = filteredFlocks
      .filter((flock) => {
        if (!scope.batchId) return true;
        return filteredBatches.some((batch) => batch.id === scope.batchId && batch.flock_id === flock.id);
      })
      .map((flock) => flock.id);

    let ledgerQuery = supabase
      .from("stock_ledger")
      .select("item_id, quantity, transaction_type")
      .eq("org_id", nextOrgId)
      .order("transaction_date", { ascending: false })
      .limit(1000);
    let feedQuery = supabase
      .from("daily_farm_records")
      .select("flock_id, record_date, feed_type, feed_consumed_kg")
      .eq("org_id", nextOrgId)
      .not("feed_consumed_kg", "is", null)
      .order("record_date", { ascending: false })
      .limit(200);
    if (scope.flockId) {
      ledgerQuery = ledgerQuery.eq("flock_id", scope.flockId);
      feedQuery = feedQuery.eq("flock_id", scope.flockId);
    } else if (scopedFlockIds.length > 0) {
      ledgerQuery = ledgerQuery.in("flock_id", scopedFlockIds);
      feedQuery = feedQuery.in("flock_id", scopedFlockIds);
    } else if (scope.branchId || scope.farmId || scope.houseId || scope.batchId) {
      setItems([]);
      setLedger([]);
      setFeedRows([]);
      setLoading(false);
      return;
    }

    const [itemsRes, ledgerRes, feedRes] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, category, unit, reorder_level, unit_cost")
        .eq("org_id", nextOrgId)
        .order("name"),
      ledgerQuery,
      feedQuery,
    ]);

    setItems((itemsRes.data ?? []) as InventoryItem[]);
    setLedger((ledgerRes.data ?? []) as StockLedgerRow[]);
    setFeedRows((feedRes.data ?? []) as FeedScheduleRow[]);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId, filteredFlocks, filteredBatches]);

  const stockByItem = useMemo(() => {
    const sign = (txn: StockLedgerRow["transaction_type"]) => {
      if (txn === "issue" || txn === "transfer_out") return -1;
      return 1;
    };
    const map = new Map<string, number>();
    ledger.forEach((entry) => {
      map.set(entry.item_id, (map.get(entry.item_id) ?? 0) + sign(entry.transaction_type) * entry.quantity);
    });
    return map;
  }, [ledger]);

  const feedPlan = useMemo(() => {
    const byFlock = new Map<string, { totalKg: number; days: Set<string>; latestFeedType: string | null }>();
    feedRows.forEach((row) => {
      const current = byFlock.get(row.flock_id) ?? {
        totalKg: 0,
        days: new Set<string>(),
        latestFeedType: row.feed_type,
      };
      current.totalKg += row.feed_consumed_kg ?? 0;
      current.days.add(row.record_date);
      if (!current.latestFeedType && row.feed_type) current.latestFeedType = row.feed_type;
      byFlock.set(row.flock_id, current);
    });
    return Array.from(byFlock.entries())
      .map(([flockId, data]) => ({
        flockId,
        feedType: data.latestFeedType ?? "-",
        avgDailyKg: data.days.size > 0 ? Number((data.totalKg / data.days.size).toFixed(2)) : 0,
      }))
      .slice(0, 40);
  }, [feedRows]);

  const onAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!orgId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("inventory_items").insert({
      org_id: orgId,
      name: name.trim(),
      category,
      unit: unit.trim(),
      reorder_level: reorderLevel || 0,
      unit_cost: unitCost || 0,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess("Inventory item added.");
    setName("");
    setCategory("feed");
    setUnit("kg");
    setReorderLevel(0);
    setUnitCost(0);
    setSaving(false);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Inventory</p>
        <h2 className="text-2xl font-semibold text-forest-900">Stock + Feed Plan Visibility</h2>
        <p className="mt-2 text-sm text-forest-600">
          Inventory tracking and feed schedule/plan monitoring.
          {isCeoLimitedEdit ? " CEO has limited edit access here." : ""}
        </p>
      </div>

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Add Inventory Item</h3>
        <form className="mt-4 grid gap-3 md:grid-cols-3" onSubmit={onAddItem}>
          <input
            required
            className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
            placeholder="Item name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as InventoryCategory)}
          >
            <option value="feed">Feed</option>
            <option value="medicine">Medicine</option>
            <option value="vaccine">Vaccine</option>
            <option value="equipment">Equipment</option>
            <option value="cleaning_supply">Cleaning Supply</option>
            <option value="packaging">Packaging</option>
            <option value="other">Other</option>
          </select>
          <input
            className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
            placeholder="Unit (kg, liter, piece)"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <input
            type="number"
            className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
            placeholder="Reorder level"
            value={reorderLevel}
            onChange={(e) => setReorderLevel(Number(e.target.value) || 0)}
          />
          <input
            type="number"
            step="0.01"
            className="h-11 rounded-xl border border-sand-200 px-3 text-sm"
            placeholder="Unit cost"
            value={unitCost}
            onChange={(e) => setUnitCost(Number(e.target.value) || 0)}
          />
          <button
            className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : "Add Item"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-ember-600">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-leaf-600">{success}</p> : null}
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Available Stock</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Unit</th>
                <th className="px-2 py-2">Available</th>
                <th className="px-2 py-2">Reorder Level</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={5}>
                    Loading inventory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={5}>
                    No inventory items yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const available = stockByItem.get(item.id) ?? 0;
                  return (
                    <tr key={item.id} className="border-b border-sand-100">
                      <td className="px-2 py-2 font-medium text-forest-900">{item.name}</td>
                      <td className="px-2 py-2 text-forest-700">{item.category}</td>
                      <td className="px-2 py-2 text-forest-700">{item.unit}</td>
                      <td className="px-2 py-2 text-forest-700">{available}</td>
                      <td className="px-2 py-2 text-forest-700">{item.reorder_level ?? 0}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Feed Schedule + Feed Plan (Observed)</h3>
        <p className="mt-1 text-sm text-forest-600">
          Derived from recorded daily feed consumption by flock.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Flock</th>
                <th className="px-2 py-2">Feed Type</th>
                <th className="px-2 py-2">Avg Daily Kg</th>
              </tr>
            </thead>
            <tbody>
              {feedPlan.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={3}>
                    No feed records available yet.
                  </td>
                </tr>
              ) : (
                feedPlan.map((row) => (
                  <tr key={row.flockId} className="border-b border-sand-100">
                    <td className="px-2 py-2 text-forest-900">{row.flockId}</td>
                    <td className="px-2 py-2 text-forest-700">{row.feedType}</td>
                    <td className="px-2 py-2 text-forest-700">{row.avgDailyKg}</td>
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
