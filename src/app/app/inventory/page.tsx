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
  unit_cost: number;
  transaction_date: string;
  flock_id: string | null;
};

type FeedScheduleRow = {
  flock_id: string;
  record_date: string;
  feed_type: string | null;
  feed_intake_grams: number | null;
  total_eggs: number | null;
};

type InventoryCategory = Database["public"]["Enums"]["inventory_category"];
type StockTxnType = Database["public"]["Enums"]["stock_txn_type"];

type WarehouseRow = {
  id: string;
  name: string;
  type: string;
};

export default function InventoryPage() {
  const { scope, filteredFlocks, filteredBatches } = useFarmScope();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [ledger, setLedger] = useState<StockLedgerRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [feedRows, setFeedRows] = useState<FeedScheduleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCeoLimitedEdit, setIsCeoLimitedEdit] = useState(false);
  const [currentRole, setCurrentRole] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("feed");
  const [unit, setUnit] = useState("kg");
  const [reorderLevel, setReorderLevel] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [txnItemId, setTxnItemId] = useState("");
  const [txnWarehouseId, setTxnWarehouseId] = useState("");
  const [txnType, setTxnType] = useState<StockTxnType>("receipt");
  const [txnQuantity, setTxnQuantity] = useState(0);
  const [txnUnitCost, setTxnUnitCost] = useState(0);
  const [txnFlockId, setTxnFlockId] = useState("");
  const [txnReference, setTxnReference] = useState("");
  const canManageStock = currentRole === "store_keeper" || currentRole === "farm_manager" || currentRole === "ceo";

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
    const role = String(context?.role ?? "");
    setCurrentRole(role);
    setIsCeoLimitedEdit(role === "ceo");
    if (!nextOrgId) {
      setItems([]);
      setLedger([]);
      setWarehouses([]);
      setFeedRows([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const scopedFlockIds = filteredFlocks
      .filter((flock) => !scope.batchId || flock.batch_id === scope.batchId)
      .map((flock) => flock.id);

    let ledgerQuery = supabase
      .from("stock_ledger")
      .select("item_id, quantity, transaction_type, unit_cost, transaction_date, flock_id")
      .eq("org_id", nextOrgId)
      .order("transaction_date", { ascending: false })
      .limit(1000);
    let feedQuery = supabase
      .from("daily_farm_records")
      .select("flock_id, record_date, feed_type, feed_intake_grams, total_eggs")
      .eq("org_id", nextOrgId)
      .not("feed_intake_grams", "is", null)
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
      setWarehouses([]);
      setFeedRows([]);
      setLoading(false);
      return;
    }

    const [itemsRes, ledgerRes, feedRes, warehousesRes] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, category, unit, reorder_level, unit_cost")
        .eq("org_id", nextOrgId)
        .order("name"),
      ledgerQuery,
      feedQuery,
      supabase
        .from("warehouses")
        .select("id, name, type")
        .eq("org_id", nextOrgId)
        .order("name"),
    ]);

    setItems((itemsRes.data ?? []) as InventoryItem[]);
    setLedger((ledgerRes.data ?? []) as StockLedgerRow[]);
    setFeedRows((feedRes.data ?? []) as FeedScheduleRow[]);
    const warehouseRows = (warehousesRes.data ?? []) as WarehouseRow[];
    setWarehouses(warehouseRows);
    if (!txnWarehouseId && warehouseRows[0]) setTxnWarehouseId(warehouseRows[0].id);
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
      current.totalKg += (row.feed_intake_grams ?? 0) / 1000;
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

  const itemNameMap = useMemo(() => new Map(items.map((item) => [item.id, item.name])), [items]);
  const flockLabelMap = useMemo(() => new Map(filteredFlocks.map((flock) => [flock.id, flock.flock_code])), [filteredFlocks]);
  const feedItems = useMemo(() => items.filter((item) => item.category === "feed"), [items]);
  const avgFeedUnitCost = useMemo(() => {
    const costs = feedItems.map((item) => item.unit_cost ?? 0).filter((cost) => cost > 0);
    if (costs.length === 0) return 0;
    return costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
  }, [feedItems]);
  const totalFeedKg = feedRows.reduce((sum, row) => sum + (row.feed_intake_grams ?? 0) / 1000, 0);
  const totalEggs = feedRows.reduce((sum, row) => sum + (row.total_eggs ?? 0), 0);
  const feedCostPerEgg = totalEggs > 0 && avgFeedUnitCost > 0 ? (totalFeedKg * avgFeedUnitCost) / totalEggs : null;

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

  const onAddLedgerEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !orgId || !canManageStock) return;
    if (!txnItemId || !txnWarehouseId || txnQuantity <= 0) {
      setError("Select item, warehouse, transaction type, and positive quantity.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("stock_ledger").insert({
      org_id: orgId,
      item_id: txnItemId,
      warehouse_id: txnWarehouseId,
      transaction_type: txnType,
      quantity: txnQuantity,
      unit_cost: txnUnitCost || items.find((item) => item.id === txnItemId)?.unit_cost || 0,
      flock_id: txnFlockId || null,
      reference_doc: txnReference.trim() || null,
      recorded_by: user?.id ?? null,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setSuccess("Stock ledger entry saved.");
    setTxnQuantity(0);
    setTxnUnitCost(0);
    setTxnReference("");
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
            <option value="vitamin">Vitamin</option>
            <option value="equipment">Equipment</option>
            <option value="spare_parts">Spare Parts</option>
            <option value="packaging">Packaging</option>
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-forest-900">Record Stock Movement</h3>
            <p className="mt-1 text-sm text-forest-600">Receipts, issues, returns, transfers, and adjustments feed stock and cost visibility.</p>
          </div>
          {!canManageStock ? <p className="text-sm text-forest-600">View mode: stock movements require store, manager, or CEO role.</p> : null}
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4" onSubmit={onAddLedgerEntry}>
          <select className="h-11 rounded-xl border border-sand-200 px-3 text-sm" value={txnItemId} onChange={(e) => {
            const item = items.find((candidate) => candidate.id === e.target.value);
            setTxnItemId(e.target.value);
            setTxnUnitCost(item?.unit_cost ?? 0);
          }} required>
            <option value="">Select item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select className="h-11 rounded-xl border border-sand-200 px-3 text-sm" value={txnWarehouseId} onChange={(e) => setTxnWarehouseId(e.target.value)} required>
            <option value="">Select warehouse</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.type})</option>
            ))}
          </select>
          <select className="h-11 rounded-xl border border-sand-200 px-3 text-sm" value={txnType} onChange={(e) => setTxnType(e.target.value as StockTxnType)}>
            <option value="receipt">Receipt</option>
            <option value="issue">Issue</option>
            <option value="return">Return</option>
            <option value="transfer_in">Transfer In</option>
            <option value="transfer_out">Transfer Out</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <input type="number" min={0.01} step="0.01" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" placeholder="Quantity" value={txnQuantity || ""} onChange={(e) => setTxnQuantity(Number(e.target.value) || 0)} required />
          <input type="number" min={0} step="0.01" className="h-11 rounded-xl border border-sand-200 px-3 text-sm" placeholder="Unit cost" value={txnUnitCost || ""} onChange={(e) => setTxnUnitCost(Number(e.target.value) || 0)} />
          <select className="h-11 rounded-xl border border-sand-200 px-3 text-sm" value={txnFlockId} onChange={(e) => setTxnFlockId(e.target.value)}>
            <option value="">No flock allocation</option>
            {filteredFlocks.map((flock) => (
              <option key={flock.id} value={flock.id}>{flock.flock_code}</option>
            ))}
          </select>
          <input className="h-11 rounded-xl border border-sand-200 px-3 text-sm" placeholder="Reference document" value={txnReference} onChange={(e) => setTxnReference(e.target.value)} />
          <button className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60" type="submit" disabled={saving || !canManageStock}>
            {saving ? "Saving..." : "Save Movement"}
          </button>
        </form>
        {warehouses.length === 0 ? <p className="mt-3 text-sm text-ember-600">Create at least one warehouse before recording stock movement.</p> : null}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Observed Feed</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{totalFeedKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg</p>
          <p className="mt-1 text-xs text-forest-600">From daily feed intake in selected scope.</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Feed Cost / Egg</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{feedCostPerEgg === null ? "Pending" : feedCostPerEgg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          <p className="mt-1 text-xs text-forest-600">Uses average feed item cost until exact feed-issue matching is available.</p>
        </article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-forest-500">Eggs in Scope</p>
          <p className="mt-2 text-3xl font-semibold text-forest-900">{totalEggs.toLocaleString()}</p>
          <p className="mt-1 text-xs text-forest-600">Used as feed-cost denominator.</p>
        </article>
      </div>

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
                <th className="px-2 py-2">Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={6}>
                    Loading inventory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-forest-600" colSpan={6}>
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
                      <td className="px-2 py-2 text-forest-700">{item.unit_cost ?? 0}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-forest-900">Recent Stock Ledger</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2">Type</th>
                <th className="px-2 py-2">Quantity</th>
                <th className="px-2 py-2">Unit Cost</th>
                <th className="px-2 py-2">Flock</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr><td className="px-2 py-4 text-forest-600" colSpan={6}>No stock movements yet.</td></tr>
              ) : ledger.slice(0, 20).map((entry, index) => (
                <tr key={`${entry.item_id}-${entry.transaction_date}-${index}`} className="border-b border-sand-100">
                  <td className="px-2 py-2 text-forest-700">{entry.transaction_date}</td>
                  <td className="px-2 py-2 font-medium text-forest-900">{itemNameMap.get(entry.item_id) ?? entry.item_id}</td>
                  <td className="px-2 py-2 text-forest-700">{entry.transaction_type}</td>
                  <td className="px-2 py-2 text-forest-700">{entry.quantity}</td>
                  <td className="px-2 py-2 text-forest-700">{entry.unit_cost}</td>
                  <td className="px-2 py-2 text-forest-700">{entry.flock_id ? flockLabelMap.get(entry.flock_id) ?? entry.flock_id : "-"}</td>
                </tr>
              ))}
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
