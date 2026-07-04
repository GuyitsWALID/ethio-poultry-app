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
  reference_doc: string | null;
};

type FeedScheduleRow = {
  flock_id: string;
  record_date: string;
  feed_type: string | null;
  feed_intake_grams: number | null;
  normal_eggs: number | null;
  broken_eggs: number | null;
  total_eggs: number | null;
};

type WarehouseRow = {
  id: string;
  name: string;
  type: string;
};

type CostEntry = {
  id: string;
  entry_date: string;
  category: string;
  description: string;
  amount: number;
  allocation_method: string;
  supplier_name: string | null;
  invoice_number: string | null;
  flock_id: string | null;
  batch_id: string | null;
};

type MonthlyPeriod = {
  id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "locked";
  total_normal_eggs: number;
  total_broken_eggs: number;
  total_revenue: number;
  total_absorbed_cost: number;
  base_cost_per_egg: number | null;
  target_margin_per_egg: number;
};

type InventoryCategory = Database["public"]["Enums"]["inventory_category"];
type StockTxnType = Database["public"]["Enums"]["stock_txn_type"];

const tabs = [
  { id: "stock", label: "Stock" },
  { id: "purchases", label: "Purchases" },
  { id: "issues", label: "Issues" },
  { id: "monthly", label: "Monthly Costs" },
  { id: "reconciliation", label: "Reconciliation" },
] as const;

type TabId = (typeof tabs)[number]["id"];

const costCategories = [
  "feed",
  "medicine",
  "vaccine",
  "vitamin",
  "supplement",
  "payroll",
  "utility",
  "biosecurity",
  "transport",
  "maintenance",
  "labor",
  "rent",
  "packaging",
  "miscellaneous",
];

const allocationMethods = ["direct", "bird_count", "egg_count", "feed_consumption", "manual_percent"];
const inputClass = "h-11 rounded-lg border border-sand-200 px-3 text-sm text-forest-900";

function money(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return "Pending";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function firstDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

function lastDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export default function InventoryPage() {
  const { scope, filteredFlocks, filteredBatches } = useFarmScope();
  const [activeTab, setActiveTab] = useState<TabId>("stock");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [ledger, setLedger] = useState<StockLedgerRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [feedRows, setFeedRows] = useState<FeedScheduleRow[]>([]);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [periods, setPeriods] = useState<MonthlyPeriod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
  const [txnBatchId, setTxnBatchId] = useState("");
  const [txnReference, setTxnReference] = useState("");
  const [txnSupplier, setTxnSupplier] = useState("");
  const [txnInvoice, setTxnInvoice] = useState("");

  const [costDate, setCostDate] = useState(new Date().toISOString().slice(0, 10));
  const [costCategory, setCostCategory] = useState("payroll");
  const [costDescription, setCostDescription] = useState("");
  const [costAmount, setCostAmount] = useState(0);
  const [costAllocation, setCostAllocation] = useState("direct");
  const [costFlockId, setCostFlockId] = useState("");
  const [costBatchId, setCostBatchId] = useState("");
  const [costSupplier, setCostSupplier] = useState("");
  const [costInvoice, setCostInvoice] = useState("");

  const [periodStart, setPeriodStart] = useState(firstDayOfMonth());
  const [periodEnd, setPeriodEnd] = useState(lastDayOfMonth());
  const [targetMargin, setTargetMargin] = useState(0.5);

  const canManageStock = ["store_keeper", "farm_manager", "ceo", "system_admin", "super_admin"].includes(currentRole);
  const canRecordCosts = ["store_keeper", "ceo", "system_admin", "super_admin"].includes(currentRole);
  const canReconcile = ["ceo", "system_admin", "super_admin"].includes(currentRole);

  const scopedFlockIds = useMemo(
    () =>
      filteredFlocks
        .filter((flock) => !scope.batchId || flock.batch_id === scope.batchId)
        .map((flock) => flock.id),
    [filteredFlocks, scope.batchId]
  );

  const scopeParams = useMemo(() => {
    const params = new URLSearchParams({
      branch_id: scope.branchId,
      farm_id: scope.farmId,
      house_id: scope.houseId,
      flock_id: scope.flockId,
      batch_id: scope.batchId,
      date_from: periodStart,
      date_to: periodEnd,
    });
    return params;
  }, [periodEnd, periodStart, scope]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const contextResponse = await fetch("/api/me/context", { method: "GET" });
    if (!contextResponse.ok) {
      setLoading(false);
      return;
    }
    const context = await contextResponse.json();
    const nextOrgId = context?.orgId as string | null;
    const role = String(context?.role ?? "");
    setOrgId(nextOrgId);
    setCurrentRole(role);
    if (!nextOrgId) {
      setItems([]);
      setLedger([]);
      setWarehouses([]);
      setFeedRows([]);
      setCostEntries([]);
      setPeriods([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let ledgerQuery = supabase
      .from("stock_ledger")
      .select("item_id, quantity, transaction_type, unit_cost, transaction_date, flock_id, reference_doc")
      .eq("org_id", nextOrgId)
      .order("transaction_date", { ascending: false })
      .limit(1000);
    let feedQuery = supabase
      .from("daily_farm_records")
      .select("flock_id, record_date, feed_type, feed_intake_grams, normal_eggs, broken_eggs, total_eggs")
      .eq("org_id", nextOrgId)
      .not("feed_intake_grams", "is", null)
      .order("record_date", { ascending: false })
      .limit(500);
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
      setCostEntries([]);
      setPeriods([]);
      setLoading(false);
      return;
    }

    const [itemsRes, ledgerRes, feedRes, warehousesRes, costsResponse, periodsResponse] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, category, unit, reorder_level, unit_cost")
        .eq("org_id", nextOrgId)
        .order("name"),
      ledgerQuery,
      feedQuery,
      supabase.from("warehouses").select("id, name, type").eq("org_id", nextOrgId).order("name"),
      fetch(`/api/profit/cost-entries?${scopeParams.toString()}`),
      fetch(`/api/profit/monthly?${scopeParams.toString()}`),
    ]);

    const costsJson = costsResponse.ok ? await costsResponse.json() : { costEntries: [] };
    const periodsJson = periodsResponse.ok ? await periodsResponse.json() : { periods: [] };
    setItems((itemsRes.data ?? []) as InventoryItem[]);
    setLedger((ledgerRes.data ?? []) as StockLedgerRow[]);
    setFeedRows((feedRes.data ?? []) as FeedScheduleRow[]);
    const warehouseRows = (warehousesRes.data ?? []) as WarehouseRow[];
    setWarehouses(warehouseRows);
    setCostEntries((costsJson.costEntries ?? []) as CostEntry[]);
    setPeriods((periodsJson.periods ?? []) as MonthlyPeriod[]);
    if (!txnWarehouseId && warehouseRows[0]) setTxnWarehouseId(warehouseRows[0].id);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.branchId, scope.farmId, scope.houseId, scope.flockId, scope.batchId, scopedFlockIds, scopeParams]);

  const stockByItem = useMemo(() => {
    const sign = (txn: StockLedgerRow["transaction_type"]) => (txn === "issue" || txn === "transfer_out" ? -1 : 1);
    const map = new Map<string, number>();
    ledger.forEach((entry) => map.set(entry.item_id, (map.get(entry.item_id) ?? 0) + sign(entry.transaction_type) * entry.quantity));
    return map;
  }, [ledger]);

  const itemNameMap = useMemo(() => new Map(items.map((item) => [item.id, item.name])), [items]);
  const flockLabelMap = useMemo(() => new Map(filteredFlocks.map((flock) => [flock.id, flock.flock_code])), [filteredFlocks]);
  const batchLabelMap = useMemo(() => new Map(filteredBatches.map((batch) => [batch.id, batch.batch_code])), [filteredBatches]);
  const totalFeedKg = feedRows.reduce((sum, row) => sum + (row.feed_intake_grams ?? 0) / 1000, 0);
  const normalEggs = feedRows.reduce((sum, row) => sum + (row.normal_eggs ?? row.total_eggs ?? 0), 0);
  const brokenEggs = feedRows.reduce((sum, row) => sum + (row.broken_eggs ?? 0), 0);
  const costTotal = costEntries.reduce((sum, row) => sum + row.amount, 0);
  const latestPeriod = periods[0];

  const onAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !orgId) return;
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
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSuccess("Inventory item added.");
    setName("");
    setCategory("feed");
    setUnit("kg");
    setReorderLevel(0);
    setUnitCost(0);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const stockLedger = supabase.from("stock_ledger") as unknown as {
      insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
    const { error: insertError } = await stockLedger.insert({
      org_id: orgId,
      item_id: txnItemId,
      warehouse_id: txnWarehouseId,
      transaction_type: txnType,
      quantity: txnQuantity,
      unit_cost: txnUnitCost || items.find((item) => item.id === txnItemId)?.unit_cost || 0,
      flock_id: txnFlockId || null,
      batch_id: txnBatchId || null,
      branch_id: scope.branchId || null,
      farm_id: scope.farmId || null,
      house_id: scope.houseId || null,
      supplier_name: txnSupplier.trim() || null,
      invoice_number: txnInvoice.trim() || null,
      reference_doc: txnReference.trim() || txnInvoice.trim() || null,
      recorded_by: user?.id ?? null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSuccess(txnType === "receipt" ? "Purchase receipt saved." : "Stock movement saved.");
    setTxnQuantity(0);
    setTxnUnitCost(0);
    setTxnReference("");
    setTxnSupplier("");
    setTxnInvoice("");
    await loadData();
  };

  const onAddCostEntry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !canRecordCosts) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/profit/cost-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_date: costDate,
        category: costCategory,
        description: costDescription,
        amount: costAmount,
        allocation_method: costAllocation,
        branch_id: scope.branchId,
        farm_id: scope.farmId,
        house_id: scope.houseId,
        flock_id: costFlockId || scope.flockId,
        batch_id: costBatchId || scope.batchId,
        supplier_name: costSupplier,
        invoice_number: costInvoice,
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not save cost entry.");
      return;
    }
    setSuccess("Monthly cost entry saved.");
    setCostDescription("");
    setCostAmount(0);
    setCostSupplier("");
    setCostInvoice("");
    await loadData();
  };

  const reconcile = async (lock: boolean) => {
    if (saving || !canReconcile) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/profit/monthly/reconcile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_start: periodStart,
        period_end: periodEnd,
        branch_id: scope.branchId,
        farm_id: scope.farmId,
        house_id: scope.houseId,
        flock_id: scope.flockId,
        batch_id: scope.batchId,
        target_margin_per_egg: targetMargin,
        lock,
      }),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not reconcile monthly cost period.");
      return;
    }
    setSuccess(lock ? "Monthly cost period locked." : "Monthly cost period recalculated.");
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Inventory</p>
        <h2 className="text-2xl font-semibold text-forest-900">Inventory, Costing, and Pricing Floor</h2>
        <p className="mt-2 max-w-3xl text-sm text-forest-600">
          Stock movements feed production costs. Monthly reconciliation converts feed, health, and overhead costs into a break-even egg price.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-sand-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "border-forest-800 text-forest-900"
                : "border-transparent text-forest-600 hover:text-forest-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm text-leaf-700">{success}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <article className="rounded-lg border border-sand-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-forest-500">Observed Feed</p>
          <p className="mt-2 text-2xl font-semibold text-forest-900">{money(totalFeedKg)} kg</p>
        </article>
        <article className="rounded-lg border border-sand-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-forest-500">Normal Eggs</p>
          <p className="mt-2 text-2xl font-semibold text-forest-900">{normalEggs.toLocaleString()}</p>
        </article>
        <article className="rounded-lg border border-sand-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-forest-500">Broken Eggs</p>
          <p className="mt-2 text-2xl font-semibold text-forest-900">{brokenEggs.toLocaleString()}</p>
        </article>
        <article className="rounded-lg border border-sand-200 bg-white p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-forest-500">Break-even Egg</p>
          <p className="mt-2 text-2xl font-semibold text-forest-900">{money(latestPeriod?.base_cost_per_egg, 4)}</p>
        </article>
      </div>

      {activeTab === "stock" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
          <section className="rounded-lg border border-sand-200 bg-white p-5">
            <h3 className="text-base font-semibold text-forest-900">Available Stock</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                    <th className="px-2 py-2">Item</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Available</th>
                    <th className="px-2 py-2">Reorder</th>
                    <th className="px-2 py-2">Unit Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-2 py-4 text-forest-600" colSpan={5}>Loading inventory...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td className="px-2 py-4 text-forest-600" colSpan={5}>No inventory items yet.</td></tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b border-sand-100">
                        <td className="px-2 py-2 font-medium text-forest-900">{item.name}<span className="block text-xs text-forest-500">{item.unit}</span></td>
                        <td className="px-2 py-2 text-forest-700">{item.category}</td>
                        <td className="px-2 py-2 text-forest-700">{money(stockByItem.get(item.id) ?? 0)}</td>
                        <td className="px-2 py-2 text-forest-700">{item.reorder_level ?? 0}</td>
                        <td className="px-2 py-2 text-forest-700">{money(item.unit_cost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-sand-200 bg-white p-5">
            <h3 className="text-base font-semibold text-forest-900">Add Inventory Item</h3>
            <form className="mt-4 grid gap-3" onSubmit={onAddItem}>
              <input required className={inputClass} placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as InventoryCategory)}>
                <option value="feed">Feed</option>
                <option value="medicine">Medicine</option>
                <option value="vaccine">Vaccine</option>
                <option value="vitamin">Vitamin</option>
                <option value="equipment">Equipment</option>
                <option value="spare_parts">Spare Parts</option>
                <option value="packaging">Packaging</option>
              </select>
              <input className={inputClass} placeholder="Unit (kg, bag, liter, piece)" value={unit} onChange={(e) => setUnit(e.target.value)} />
              <input type="number" className={inputClass} placeholder="Reorder level" value={reorderLevel} onChange={(e) => setReorderLevel(Number(e.target.value) || 0)} />
              <input type="number" step="0.01" className={inputClass} placeholder="Unit cost" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value) || 0)} />
              <button className="h-11 rounded-lg bg-forest-900 px-4 text-sm font-medium text-sand-50 disabled:opacity-60" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add Item"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {activeTab === "purchases" || activeTab === "issues" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
          <section className="rounded-lg border border-sand-200 bg-white p-5">
            <h3 className="text-base font-semibold text-forest-900">{activeTab === "purchases" ? "Record Purchase" : "Record Issue or Return"}</h3>
            {!canManageStock ? <p className="mt-2 text-sm text-forest-600">Your role is view-only for stock movements.</p> : null}
            <form className="mt-4 grid gap-3" onSubmit={onAddLedgerEntry}>
              <select className={inputClass} value={txnItemId} onChange={(e) => {
                const item = items.find((candidate) => candidate.id === e.target.value);
                setTxnItemId(e.target.value);
                setTxnUnitCost(item?.unit_cost ?? 0);
              }} required>
                <option value="">Select item</option>
                {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select className={inputClass} value={txnWarehouseId} onChange={(e) => setTxnWarehouseId(e.target.value)} required>
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.type})</option>)}
              </select>
              <select className={inputClass} value={txnType} onChange={(e) => setTxnType(e.target.value as StockTxnType)}>
                {activeTab === "purchases" ? <option value="receipt">Receipt</option> : null}
                <option value="issue">Issue</option>
                <option value="return">Return</option>
                <option value="transfer_out">Transfer Out</option>
                <option value="transfer_in">Transfer In</option>
                <option value="adjustment">Adjustment</option>
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="number" min={0.01} step="0.01" className={inputClass} placeholder="Quantity" value={txnQuantity || ""} onChange={(e) => setTxnQuantity(Number(e.target.value) || 0)} required />
                <input type="number" min={0} step="0.01" className={inputClass} placeholder="Unit cost" value={txnUnitCost || ""} onChange={(e) => setTxnUnitCost(Number(e.target.value) || 0)} />
              </div>
              <select className={inputClass} value={txnFlockId} onChange={(e) => setTxnFlockId(e.target.value)}>
                <option value="">No flock allocation</option>
                {filteredFlocks.map((flock) => <option key={flock.id} value={flock.id}>{flock.flock_code}</option>)}
              </select>
              <select className={inputClass} value={txnBatchId} onChange={(e) => setTxnBatchId(e.target.value)}>
                <option value="">No batch allocation</option>
                {filteredBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_code}</option>)}
              </select>
              <input className={inputClass} placeholder="Supplier" value={txnSupplier} onChange={(e) => setTxnSupplier(e.target.value)} />
              <input className={inputClass} placeholder="Invoice number" value={txnInvoice} onChange={(e) => setTxnInvoice(e.target.value)} />
              <input className={inputClass} placeholder="Reference document" value={txnReference} onChange={(e) => setTxnReference(e.target.value)} />
              <button className="h-11 rounded-lg bg-forest-900 px-4 text-sm font-medium text-sand-50 disabled:opacity-60" type="submit" disabled={saving || !canManageStock}>
                {saving ? "Saving..." : "Save Movement"}
              </button>
            </form>
            {warehouses.length === 0 ? <p className="mt-3 text-sm text-ember-600">Create at least one warehouse before recording stock movement.</p> : null}
          </section>

          <section className="rounded-lg border border-sand-200 bg-white p-5">
            <h3 className="text-base font-semibold text-forest-900">Recent Stock Ledger</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Item</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Qty</th>
                    <th className="px-2 py-2">Cost</th>
                    <th className="px-2 py-2">Flock</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr><td className="px-2 py-4 text-forest-600" colSpan={6}>No stock movements yet.</td></tr>
                  ) : ledger.slice(0, 40).map((entry, index) => (
                    <tr key={`${entry.item_id}-${entry.transaction_date}-${index}`} className="border-b border-sand-100">
                      <td className="px-2 py-2 text-forest-700">{entry.transaction_date}</td>
                      <td className="px-2 py-2 font-medium text-forest-900">{itemNameMap.get(entry.item_id) ?? entry.item_id}</td>
                      <td className="px-2 py-2 text-forest-700">{entry.transaction_type}</td>
                      <td className="px-2 py-2 text-forest-700">{money(entry.quantity)}</td>
                      <td className="px-2 py-2 text-forest-700">{money(entry.unit_cost)}</td>
                      <td className="px-2 py-2 text-forest-700">{entry.flock_id ? flockLabelMap.get(entry.flock_id) ?? entry.flock_id : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "monthly" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
          <section className="rounded-lg border border-sand-200 bg-white p-5">
            <h3 className="text-base font-semibold text-forest-900">Record Monthly Cost</h3>
            {!canRecordCosts ? <p className="mt-2 text-sm text-forest-600">Only store keeper, CEO, or system roles can record monetary cost entries.</p> : null}
            <form className="mt-4 grid gap-3" onSubmit={onAddCostEntry}>
              <input type="date" className={inputClass} value={costDate} onChange={(e) => setCostDate(e.target.value)} required />
              <select className={inputClass} value={costCategory} onChange={(e) => setCostCategory(e.target.value)}>
                {costCategories.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
              </select>
              <input className={inputClass} placeholder="Description" value={costDescription} onChange={(e) => setCostDescription(e.target.value)} required />
              <input type="number" min={0.01} step="0.01" className={inputClass} placeholder="Amount" value={costAmount || ""} onChange={(e) => setCostAmount(Number(e.target.value) || 0)} required />
              <select className={inputClass} value={costAllocation} onChange={(e) => setCostAllocation(e.target.value)}>
                {allocationMethods.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
              </select>
              <select className={inputClass} value={costFlockId} onChange={(e) => setCostFlockId(e.target.value)}>
                <option value="">Use current scope / no flock</option>
                {filteredFlocks.map((flock) => <option key={flock.id} value={flock.id}>{flock.flock_code}</option>)}
              </select>
              <select className={inputClass} value={costBatchId} onChange={(e) => setCostBatchId(e.target.value)}>
                <option value="">Use current scope / no batch</option>
                {filteredBatches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_code}</option>)}
              </select>
              <input className={inputClass} placeholder="Supplier" value={costSupplier} onChange={(e) => setCostSupplier(e.target.value)} />
              <input className={inputClass} placeholder="Invoice number" value={costInvoice} onChange={(e) => setCostInvoice(e.target.value)} />
              <button className="h-11 rounded-lg bg-forest-900 px-4 text-sm font-medium text-sand-50 disabled:opacity-60" type="submit" disabled={saving || !canRecordCosts}>
                {saving ? "Saving..." : "Save Cost"}
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-sand-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-forest-900">Cost Entries</h3>
              <p className="text-xs text-forest-500">Total {money(costTotal)}</p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Scope</th>
                  </tr>
                </thead>
                <tbody>
                  {costEntries.length === 0 ? (
                    <tr><td className="px-2 py-4 text-forest-600" colSpan={5}>No cost entries for this period.</td></tr>
                  ) : costEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-sand-100">
                      <td className="px-2 py-2 text-forest-700">{entry.entry_date}</td>
                      <td className="px-2 py-2 text-forest-700">{entry.category}</td>
                      <td className="px-2 py-2 font-medium text-forest-900">{entry.description}</td>
                      <td className="px-2 py-2 text-forest-700">{money(entry.amount)}</td>
                      <td className="px-2 py-2 text-forest-700">{entry.flock_id ? flockLabelMap.get(entry.flock_id) ?? entry.flock_id : entry.batch_id ? batchLabelMap.get(entry.batch_id) ?? entry.batch_id : entry.allocation_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "reconciliation" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
          <section className="rounded-lg border border-sand-200 bg-white p-5">
            <h3 className="text-base font-semibold text-forest-900">Monthly Reconciliation</h3>
            {!canReconcile ? <p className="mt-2 text-sm text-forest-600">Only CEO or system roles can recalculate and lock monthly cost periods.</p> : null}
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs text-forest-600">
                Period Start
                <input type="date" className={inputClass} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Period End
                <input type="date" className={inputClass} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Target Margin Per Egg
                <input type="number" min={0} step="0.01" className={inputClass} value={targetMargin} onChange={(e) => setTargetMargin(Number(e.target.value) || 0)} />
              </label>
              <button type="button" className="h-11 rounded-lg border border-sand-200 px-4 text-sm font-medium text-forest-800 disabled:opacity-60" disabled={saving || !canReconcile} onClick={() => void reconcile(false)}>
                Recalculate Draft
              </button>
              <button type="button" className="h-11 rounded-lg bg-forest-900 px-4 text-sm font-medium text-sand-50 disabled:opacity-60" disabled={saving || !canReconcile} onClick={() => void reconcile(true)}>
                Lock Monthly Cost
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-sand-200 bg-white p-5">
            <h3 className="text-base font-semibold text-forest-900">Monthly Cost Periods</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                    <th className="px-2 py-2">Period</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Normal</th>
                    <th className="px-2 py-2">Broken</th>
                    <th className="px-2 py-2">Cost</th>
                    <th className="px-2 py-2">Base/Egg</th>
                    <th className="px-2 py-2">Target Price</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.length === 0 ? (
                    <tr><td className="px-2 py-4 text-forest-600" colSpan={7}>No reconciled cost periods yet.</td></tr>
                  ) : periods.map((period) => (
                    <tr key={period.id} className="border-b border-sand-100">
                      <td className="px-2 py-2 font-medium text-forest-900">{period.period_start} to {period.period_end}</td>
                      <td className="px-2 py-2 text-forest-700">{period.status}</td>
                      <td className="px-2 py-2 text-forest-700">{period.total_normal_eggs.toLocaleString()}</td>
                      <td className="px-2 py-2 text-forest-700">{period.total_broken_eggs.toLocaleString()}</td>
                      <td className="px-2 py-2 text-forest-700">{money(period.total_absorbed_cost)}</td>
                      <td className="px-2 py-2 text-forest-700">{money(period.base_cost_per_egg, 4)}</td>
                      <td className="px-2 py-2 text-forest-700">{money(period.base_cost_per_egg === null ? null : period.base_cost_per_egg + period.target_margin_per_egg, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
