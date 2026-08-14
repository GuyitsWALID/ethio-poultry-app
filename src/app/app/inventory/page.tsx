"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  PackagePlus,
  RefreshCw,
  Search,
  ShieldAlert,
  Warehouse,
} from "lucide-react";

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
  warehouse_id: string;
  quantity: number;
  transaction_type: "receipt" | "issue" | "transfer_out" | "transfer_in" | "adjustment" | "return";
  unit_cost: number;
  transaction_date: string;
  flock_id: string | null;
  reference_doc: string | null;
  supplier_name?: string | null;
  invoice_number?: string | null;
  procurement_type?: "monthly" | "emergency" | "miscellaneous" | null;
  notes?: string | null;
};

type WarehouseRow = {
  id: string;
  branch_id: string;
  farm_id: string | null;
  name: string;
  type: string;
  status: "active" | "inactive";
  branch_name: string;
  farm_name: string | null;
  manager_names: string[];
};

type WarehouseOption = { id: string; name: string };
type WarehouseFarmOption = { id: string; branch_id: string; name: string };
type WarehouseManagerOption = { id: string; full_name: string | null };

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
  total_paid_revenue: number;
  total_balance_due: number;
  direct_inventory_cost: number;
  bird_cogs: number;
  overhead_cost: number;
  unallocated_cost: number;
  excluded_duplicate_cost: number;
  total_absorbed_cost: number;
  operating_profit: number;
  cash_operating_surplus: number;
  reconciliation_warnings: string[];
  base_cost_per_egg: number | null;
  target_margin_per_egg: number;
};

type InventoryCategory = Database["public"]["Enums"]["inventory_category"];
type StockMovementInputType = "receipt" | "issue" | "return" | "adjustment" | "transfer";

const tabs = [
  { id: "stock", label: "Stock" },
  { id: "purchases", label: "Purchases" },
  { id: "issues", label: "Issues" },
  { id: "warehouses", label: "Warehouses" },
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

const tabIcons = {
  stock: Boxes,
  purchases: ArrowDownToLine,
  issues: ArrowUpFromLine,
  warehouses: Warehouse,
  monthly: Calculator,
  reconciliation: ClipboardCheck,
};

function addisToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" });
}

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
  const [balanceLedger, setBalanceLedger] = useState<StockLedgerRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [warehouseBranches, setWarehouseBranches] = useState<WarehouseOption[]>([]);
  const [warehouseFarms, setWarehouseFarms] = useState<WarehouseFarmOption[]>([]);
  const [warehouseManagers, setWarehouseManagers] = useState<WarehouseManagerOption[]>([]);
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
  const [txnType, setTxnType] = useState<StockMovementInputType>("receipt");
  const [txnDestinationWarehouseId, setTxnDestinationWarehouseId] = useState("");
  const [txnDate, setTxnDate] = useState(addisToday());
  const [txnProcurementType, setTxnProcurementType] = useState<"monthly" | "emergency" | "miscellaneous">("monthly");
  const [txnQuantity, setTxnQuantity] = useState(0);
  const [txnUnitCost, setTxnUnitCost] = useState(0);
  const [txnFlockId, setTxnFlockId] = useState("");
  const [txnBatchId, setTxnBatchId] = useState("");
  const [txnReference, setTxnReference] = useState("");
  const [txnSupplier, setTxnSupplier] = useState("");
  const [txnInvoice, setTxnInvoice] = useState("");
  const [txnNotes, setTxnNotes] = useState("");

  const [costDate, setCostDate] = useState(addisToday());
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
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("all");
  const [stockRisk, setStockRisk] = useState<"all" | "attention" | "healthy" | "unrated">("all");
  const [stockWarehouseId, setStockWarehouseId] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseBranchId, setWarehouseBranchId] = useState("");
  const [warehouseFarmId, setWarehouseFarmId] = useState("");
  const [warehouseType, setWarehouseType] = useState("farm_store");
  const [warehouseManagerId, setWarehouseManagerId] = useState("");

  const canManageStock = currentRole === "farm_manager";
  const canRecordCosts = currentRole === "farm_manager";
  const canReconcile = currentRole === "ceo";
  const canCreateWarehouse = currentRole === "ceo";

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (!requestedTab || !tabs.some((tab) => tab.id === requestedTab)) return;
    const timer = window.setTimeout(() => setActiveTab(requestedTab as TabId), 0);
    return () => window.clearTimeout(timer);
  }, []);

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
      setBalanceLedger([]);
      setWarehouses([]);
      setCostEntries([]);
      setPeriods([]);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let ledgerQuery = supabase
      .from("stock_ledger")
      .select("item_id, warehouse_id, quantity, transaction_type, unit_cost, transaction_date, flock_id, reference_doc, supplier_name, invoice_number, procurement_type, notes")
      .eq("org_id", nextOrgId)
      .order("transaction_date", { ascending: false })
      .limit(1000);
    if (scope.flockId) {
      ledgerQuery = ledgerQuery.eq("flock_id", scope.flockId);
    } else if (scopedFlockIds.length > 0) {
      ledgerQuery = ledgerQuery.in("flock_id", scopedFlockIds);
    } else if (scope.branchId || scope.farmId || scope.houseId || scope.batchId) {
      setItems([]);
      setLedger([]);
      setBalanceLedger([]);
      setWarehouses([]);
      setCostEntries([]);
      setPeriods([]);
      setLoading(false);
      return;
    }

    const [itemsRes, ledgerRes, balanceLedgerRes, warehousesResponse, costsResponse, periodsResponse] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("id, name, category, unit, reorder_level, unit_cost")
        .eq("org_id", nextOrgId)
        .order("name"),
      ledgerQuery,
      supabase
        .from("stock_ledger")
        .select("item_id, warehouse_id, quantity, transaction_type, unit_cost, transaction_date, flock_id, reference_doc, supplier_name, invoice_number, procurement_type, notes")
        .eq("org_id", nextOrgId)
        .limit(10000),
      fetch("/api/inventory/warehouses"),
      fetch(`/api/profit/cost-entries?${scopeParams.toString()}`),
      fetch(`/api/profit/monthly?${scopeParams.toString()}`),
    ]);

    const costsJson = costsResponse.ok ? await costsResponse.json() : { costEntries: [] };
    const periodsJson = periodsResponse.ok ? await periodsResponse.json() : { periods: [] };
    const warehousesJson = warehousesResponse.ok ? await warehousesResponse.json() : { warehouses: [], branches: [], farms: [], managers: [] };
    if (!warehousesResponse.ok) setError(warehousesJson.error ?? "Could not load assigned warehouses.");
    setItems((itemsRes.data ?? []) as InventoryItem[]);
    const warehouseRows = ((warehousesJson.warehouses ?? []) as WarehouseRow[]).filter((warehouse) =>
      (!scope.branchId || warehouse.branch_id === scope.branchId) && (!scope.farmId || warehouse.farm_id === scope.farmId)
    );
    const balanceRows = (balanceLedgerRes.data ?? []) as StockLedgerRow[];
    const scopedWarehouseIds = new Set(warehouseRows.map((warehouse) => warehouse.id));
    setLedger(((ledgerRes.data ?? []) as StockLedgerRow[]).filter((row) => scopedWarehouseIds.has(row.warehouse_id)));
    setBalanceLedger(balanceRows.filter((row) => scopedWarehouseIds.has(row.warehouse_id)));
    setWarehouses(warehouseRows);
    setWarehouseBranches((warehousesJson.branches ?? []) as WarehouseOption[]);
    setWarehouseFarms((warehousesJson.farms ?? []) as WarehouseFarmOption[]);
    setWarehouseManagers((warehousesJson.managers ?? []) as WarehouseManagerOption[]);
    if (!warehouseBranchId && warehousesJson.branches?.[0]) setWarehouseBranchId(String(warehousesJson.branches[0].id));
    setCostEntries((costsJson.costEntries ?? []) as CostEntry[]);
    setPeriods((periodsJson.periods ?? []) as MonthlyPeriod[]);
    if (!txnWarehouseId && warehouseRows[0]) setTxnWarehouseId(warehouseRows[0].id);
    if (stockWarehouseId && !warehouseRows.some((warehouse) => warehouse.id === stockWarehouseId)) setStockWarehouseId("");
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
    balanceLedger
      .filter((entry) => !stockWarehouseId || entry.warehouse_id === stockWarehouseId)
      .forEach((entry) => map.set(entry.item_id, (map.get(entry.item_id) ?? 0) + sign(entry.transaction_type) * entry.quantity));
    return map;
  }, [balanceLedger, stockWarehouseId]);

  const itemNameMap = useMemo(() => new Map(items.map((item) => [item.id, item.name])), [items]);
  const flockLabelMap = useMemo(() => new Map(filteredFlocks.map((flock) => [flock.id, flock.flock_code])), [filteredFlocks]);
  const batchLabelMap = useMemo(() => new Map(filteredBatches.map((batch) => [batch.id, batch.batch_code])), [filteredBatches]);
  const costTotal = costEntries.reduce((sum, row) => sum + row.amount, 0);
  const latestPeriod = periods[0];

  const stockRows = useMemo(
    () =>
      items.map((item) => {
        const balance = stockByItem.get(item.id) ?? 0;
        const reorder = item.reorder_level;
        const status: "out" | "low" | "unrated" | "healthy" = balance <= 0 ? "out" : reorder === null ? "unrated" : reorder > 0 && balance <= reorder ? "low" : "healthy";
        const coverage = reorder && reorder > 0 ? Math.min(100, Math.max(0, (balance / reorder) * 100)) : null;
        return { ...item, balance, status, coverage };
      }),
    [items, stockByItem]
  );

  const filteredStockRows = useMemo(() => {
    const query = stockSearch.trim().toLowerCase();
    return stockRows
      .filter((item) => !query || item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query))
      .filter((item) => stockCategory === "all" || item.category === stockCategory)
      .filter((item) => {
        if (stockRisk === "all") return true;
        if (stockRisk === "attention") return item.status === "out" || item.status === "low";
        return item.status === stockRisk;
      })
      .sort((a, b) => {
        const order = { out: 0, low: 1, unrated: 2, healthy: 3 };
        return order[a.status] - order[b.status] || a.name.localeCompare(b.name);
      });
  }, [stockRows, stockSearch, stockCategory, stockRisk]);

  const attentionItems = stockRows.filter((item) => item.status === "out" || item.status === "low");
  const outOfStockItems = stockRows.filter((item) => item.status === "out");
  const unratedItems = stockRows.filter((item) => item.status === "unrated");
  const costedItems = stockRows.filter((item) => item.unit_cost !== null);
  const stockValue = costedItems.reduce((sum, item) => sum + Math.max(0, item.balance) * (item.unit_cost ?? 0), 0);
  const today = addisToday();
  const todayMovements = ledger.filter((entry) => entry.transaction_date === today);
  const todayReceipts = todayMovements
    .filter((entry) => entry.transaction_type === "receipt" || entry.transaction_type === "return" || entry.transaction_type === "transfer_in")
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const todayIssues = todayMovements
    .filter((entry) => entry.transaction_type === "issue" || entry.transaction_type === "transfer_out")
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const inventoryCategories = Array.from(new Set(items.map((item) => item.category))).sort();
  const categorySummary = inventoryCategories
    .map((categoryName) => {
      const categoryItems = stockRows.filter((item) => item.category === categoryName);
      return {
        name: categoryName,
        items: categoryItems.length,
        attention: categoryItems.filter((item) => item.status === "out" || item.status === "low").length,
        value: categoryItems.reduce((sum, item) => sum + Math.max(0, item.balance) * (item.unit_cost ?? 0), 0),
      };
    })
    .sort((a, b) => b.value - a.value || b.attention - a.attention);

  const onAddItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !orgId || !canManageStock) return;
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
    if (!txnItemId || !txnWarehouseId || txnQuantity === 0 || (txnType !== "adjustment" && txnQuantity < 0)) {
      setError("Select an item and warehouse. Quantity must be positive unless this is a signed adjustment.");
      return;
    }
    if (txnType === "transfer" && (!txnDestinationWarehouseId || txnDestinationWarehouseId === txnWarehouseId)) {
      setError("Select a different destination warehouse for the transfer.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/inventory/stock-movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: txnItemId,
        warehouse_id: txnWarehouseId,
        destination_warehouse_id: txnType === "transfer" ? txnDestinationWarehouseId : null,
        transaction_type: txnType,
        transaction_date: txnDate,
        procurement_type: txnType === "receipt" ? txnProcurementType : null,
        quantity: txnQuantity,
        unit_cost: txnUnitCost || items.find((item) => item.id === txnItemId)?.unit_cost || 0,
        flock_id: txnFlockId || null,
        batch_id: txnBatchId || null,
        branch_id: scope.branchId || null,
        farm_id: scope.farmId || null,
        house_id: scope.houseId || null,
        supplier_name: txnSupplier,
        invoice_number: txnInvoice,
        reference_doc: txnReference || txnInvoice,
        notes: txnNotes,
      }),
    });
    const data = await response.json();

    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not save stock movement.");
      return;
    }
    setSuccess(txnType === "receipt" ? "Purchase receipt saved." : txnType === "transfer" ? "Warehouse transfer saved as a paired movement." : "Stock movement saved.");
    setTxnDate(addisToday());
    setTxnQuantity(0);
    setTxnUnitCost(0);
    setTxnDestinationWarehouseId("");
    setTxnReference("");
    setTxnSupplier("");
    setTxnInvoice("");
    setTxnNotes("");
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

  const onCreateWarehouse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !canCreateWarehouse) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const response = await fetch("/api/inventory/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: warehouseName,
        branchId: warehouseBranchId,
        farmId: warehouseFarmId || null,
        type: warehouseType,
        managerId: warehouseManagerId || null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(data.error ?? "Could not create warehouse.");
      return;
    }
    setSuccess(data.warning ?? (warehouseManagerId ? "Warehouse created and assigned to the Farm Manager." : "Warehouse created. Assign a Farm Manager before operational use."));
    setWarehouseName("");
    setWarehouseFarmId("");
    setWarehouseManagerId("");
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
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[28px] bg-forest-900 px-6 py-7 text-sand-50 shadow-sm sm:px-8 lg:px-10 lg:py-9">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border-[42px] border-amber-500/10" aria-hidden="true" />
        <div className="absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-leaf-500/10" aria-hidden="true" />
        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500">
              <Warehouse className="h-4 w-4" aria-hidden="true" /> Supply control desk
            </div>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-4xl">Keep every flock supplied before stock becomes a production risk.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100/80">
              See shortages first, control receipts and issues, and carry trusted inventory costs into monthly reconciliation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { setActiveTab("purchases"); setTxnType("receipt"); }} className="inline-flex h-11 items-center gap-2 rounded-xl bg-sand-50 px-4 text-sm font-semibold text-forest-900 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500">
              <PackagePlus className="h-4 w-4" aria-hidden="true" /> Receive stock
            </button>
            <button type="button" onClick={() => { setActiveTab("issues"); setTxnType("issue"); }} className="inline-flex h-11 items-center gap-2 rounded-xl border border-sand-50/25 bg-white/5 px-4 text-sm font-semibold text-sand-50 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-500">
              <ArrowUpFromLine className="h-4 w-4" aria-hidden="true" /> Issue stock
            </button>
          </div>
        </div>
      </section>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</div> : null}
      {success ? <div role="status" className="flex items-start gap-3 rounded-xl border border-leaf-400/40 bg-green-50 px-4 py-3 text-sm text-forest-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-leaf-500" aria-hidden="true" />{success}</div> : null}

      <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="grid divide-y divide-sand-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <div className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Items needing action</p>
            <div className="mt-2 flex items-end justify-between"><p className="font-display text-3xl font-semibold text-forest-900">{loading ? "—" : attentionItems.length}</p><ShieldAlert className={`h-5 w-5 ${attentionItems.length ? "text-ember-500" : "text-leaf-500"}`} aria-hidden="true" /></div>
            <p className="mt-1 text-xs text-forest-600">{outOfStockItems.length} out of stock · {Math.max(0, attentionItems.length - outOfStockItems.length)} at reorder</p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Recorded stock value</p>
            <p className="mt-2 font-display text-3xl font-semibold text-forest-900">{costedItems.length ? `${money(stockValue)} ETB` : "Unavailable"}</p>
            <p className="mt-1 text-xs text-forest-600">Unit costs available for {costedItems.length} of {items.length} items</p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Today&apos;s movement</p>
            <p className="mt-2 font-display text-3xl font-semibold text-forest-900">{money(todayIssues)} out</p>
            <p className="mt-1 text-xs text-forest-600">{money(todayReceipts)} received · {todayMovements.length} postings</p>
          </div>
          <div className="p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Store coverage</p>
            <p className="mt-2 font-display text-3xl font-semibold text-forest-900">{warehouses.length}</p>
            <p className="mt-1 text-xs text-forest-600">Warehouses · {unratedItems.length} items without reorder level</p>
          </div>
        </div>
      </section>

      <nav aria-label="Inventory workflows" className="overflow-x-auto rounded-2xl border border-sand-200 bg-white p-1.5 shadow-sm">
        <div className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const Icon = tabIcons[tab.id];
            return <button key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); if (tab.id === "purchases") setTxnType("receipt"); if (tab.id === "issues" && txnType === "receipt") setTxnType("issue"); }} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-forest-500 ${activeTab === tab.id ? "bg-forest-900 text-sand-50" : "text-forest-600 hover:bg-sand-50 hover:text-forest-900"}`} aria-current={activeTab === tab.id ? "page" : undefined}>
              <Icon className="h-4 w-4" aria-hidden="true" />{tab.label}
            </button>;
          })}
        </div>
      </nav>

      {activeTab === "stock" ? (
        <div className="space-y-5">
          <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Priority queue</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Stock pressure board</h2><p className="mt-1 text-sm text-forest-600">Items at or below their reorder point appear first. A full rail means the item has reached its minimum target.</p></div>
              <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sand-200 px-4 text-sm font-medium text-forest-700 transition hover:bg-sand-50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</button>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {loading ? <div className="rounded-xl bg-sand-50 p-4 text-sm text-forest-600">Checking current balances…</div> : attentionItems.length === 0 ? <div className="flex items-center gap-3 rounded-xl border border-leaf-400/40 bg-green-50 p-4 text-sm text-forest-700"><CheckCircle2 className="h-5 w-5 text-leaf-500" aria-hidden="true" />All rated items are above their reorder levels.</div> : attentionItems.slice(0, 6).map((item) => (
                <button key={item.id} type="button" onClick={() => { setTxnItemId(item.id); setTxnUnitCost(item.unit_cost ?? 0); setTxnType("receipt"); setActiveTab("purchases"); }} className="group rounded-xl border border-sand-200 p-4 text-left transition hover:border-amber-500 hover:bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <div className="flex items-start justify-between gap-4"><div><p className="font-semibold text-forest-900">{item.name}</p><p className="mt-0.5 text-xs capitalize text-forest-600">{item.category.replaceAll("_", " ")}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${item.status === "out" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{item.status === "out" ? "Out of stock" : "Reorder now"}</span></div>
                  <div className="mt-4 flex items-end justify-between gap-4"><div><p className="font-display text-2xl font-semibold text-forest-900">{money(item.balance)} <span className="font-sans text-xs font-normal text-forest-500">{item.unit}</span></p><p className="text-xs text-forest-500">Minimum {money(item.reorder_level)} {item.unit}</p></div><ChevronRight className="h-4 w-4 text-forest-500 transition group-hover:translate-x-0.5" aria-hidden="true" /></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sand-100"><div className={`h-full rounded-full ${item.status === "out" ? "bg-ember-500" : "bg-amber-500"}`} style={{ width: `${item.status === "out" ? 4 : item.coverage ?? 0}%` }} /></div>
                </button>
              ))}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Current catalogue</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Inventory position</h2><p className="mt-1 text-sm text-forest-600">{filteredStockRows.length} of {items.length} items shown</p></div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="relative"><span className="sr-only">Search inventory</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-forest-500" aria-hidden="true" /><input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)} className={`${inputClass} w-full pl-9`} placeholder="Search items" /></label>
                  <select aria-label="Filter by warehouse" className={inputClass} value={stockWarehouseId} onChange={(e) => setStockWarehouseId(e.target.value)}><option value="">All assigned warehouses</option>{warehouses.filter((warehouse) => warehouse.status === "active").map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select>
                  <select aria-label="Filter by category" className={inputClass} value={stockCategory} onChange={(e) => setStockCategory(e.target.value)}><option value="all">All categories</option>{inventoryCategories.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
                  <select aria-label="Filter by stock status" className={inputClass} value={stockRisk} onChange={(e) => setStockRisk(e.target.value as typeof stockRisk)}><option value="all">All statuses</option><option value="attention">Needs action</option><option value="healthy">Above reorder</option><option value="unrated">No reorder level</option></select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 bg-sand-50 text-left text-[10px] uppercase tracking-[0.16em] text-forest-600">
                    <th className="px-5 py-3">Item</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Available</th><th className="px-4 py-3">Reorder point</th><th className="px-4 py-3">Unit cost</th><th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? <tr><td className="px-5 py-8 text-forest-600" colSpan={6}>Loading inventory…</td></tr> : filteredStockRows.length === 0 ? <tr><td className="px-5 py-8 text-forest-600" colSpan={6}>{items.length ? "No items match these filters." : "No inventory items have been created yet."}</td></tr> : filteredStockRows.map((item) => (
                    <tr key={item.id} className="border-b border-sand-100 transition hover:bg-sand-50/70">
                      <td className="px-5 py-3 font-semibold text-forest-900">{item.name}<span className="block text-xs font-normal text-forest-500">Measured in {item.unit}</span></td>
                      <td className="px-4 py-3 capitalize text-forest-700">{item.category.replaceAll("_", " ")}</td>
                      <td className="px-4 py-3 font-semibold text-forest-900">{money(item.balance)} {item.unit}</td>
                      <td className="px-4 py-3 text-forest-700">{item.reorder_level === null ? "Not set" : `${money(item.reorder_level)} ${item.unit}`}</td>
                      <td className="px-4 py-3 text-forest-700">{item.unit_cost === null ? "Unavailable" : `${money(item.unit_cost)} ETB`}</td>
                      <td className="px-5 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${item.status === "out" ? "bg-red-100 text-red-700" : item.status === "low" ? "bg-amber-100 text-amber-800" : item.status === "unrated" ? "bg-sand-100 text-forest-600" : "bg-green-50 text-forest-700"}`}>{item.status === "out" ? "Out" : item.status === "low" ? "Reorder" : item.status === "unrated" ? "Unrated" : "Covered"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-5">
          <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Catalogue setup</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Add an inventory item</h2><p className="mt-1 text-sm text-forest-600">Set a reorder point so the item can enter the risk queue before it runs out.</p>
            {!canManageStock ? <p className="mt-3 rounded-lg bg-sand-50 p-3 text-xs text-forest-600">Your role has view-only access.</p> : null}
            <form className="mt-4 grid gap-3" onSubmit={onAddItem}>
              <input required aria-label="Item name" className={inputClass} placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
              <select aria-label="Item category" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as InventoryCategory)}>
                <option value="feed">Feed</option>
                <option value="medicine">Medicine</option>
                <option value="vaccine">Vaccine</option>
                <option value="vitamin">Vitamin</option>
                <option value="supplement">Supplement</option>
                <option value="equipment">Equipment</option>
                <option value="spare_parts">Spare Parts</option>
                <option value="packaging">Packaging</option>
                <option value="miscellaneous">Miscellaneous</option>
              </select>
              <input aria-label="Unit of measure" className={inputClass} placeholder="Unit (kg, bag, litre, piece)" value={unit} onChange={(e) => setUnit(e.target.value)} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><input aria-label="Reorder level" type="number" min={0} className={inputClass} placeholder="Reorder level" value={reorderLevel || ""} onChange={(e) => setReorderLevel(Number(e.target.value) || 0)} /><input aria-label="Unit cost" type="number" min={0} step="0.01" className={inputClass} placeholder="Unit cost (ETB)" value={unitCost || ""} onChange={(e) => setUnitCost(Number(e.target.value) || 0)} /></div>
              <button className="h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 transition hover:bg-forest-800 disabled:opacity-60" type="submit" disabled={saving || !canManageStock}>
                {saving ? "Saving…" : "Add to catalogue"}
              </button>
            </form>
          </section>
          <section className="rounded-2xl border border-sand-200 bg-sand-50 p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Category exposure</p><div className="mt-3 space-y-3">{categorySummary.slice(0, 5).map((row) => <div key={row.name} className="flex items-center justify-between gap-3 text-sm"><span className="capitalize text-forest-700">{row.name.replaceAll("_", " ")} <span className="text-xs text-forest-500">({row.items})</span></span><span className={`font-semibold ${row.attention ? "text-ember-500" : "text-forest-900"}`}>{row.attention ? `${row.attention} action` : "Covered"}</span></div>)}{categorySummary.length === 0 ? <p className="text-sm text-forest-600">Category signals will appear after items are added.</p> : null}</div></section>
          </aside>
          </div>
        </div>
      ) : null}

      {activeTab === "warehouses" ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 p-5 sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Storage network</p>
              <h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Where inventory physically belongs</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-forest-600">The item catalogue is shared by the organization. Every quantity belongs to a warehouse through its stock-ledger postings, and physical counts compare one warehouse at a time.</p>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              {warehouses.length ? warehouses.map((warehouse) => (
                <article key={warehouse.id} className="rounded-xl border border-sand-200 bg-sand-50/50 p-4">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-forest-900">{warehouse.name}</h3><p className="mt-1 text-xs text-forest-600">{warehouse.branch_name}{warehouse.farm_name ? ` · ${warehouse.farm_name}` : " · Branch-level store"}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${warehouse.status === "active" ? "bg-green-50 text-forest-700" : "bg-sand-100 text-forest-500"}`}>{warehouse.status}</span></div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-forest-500">{warehouse.type.replaceAll("_", " ")}</p>
                  <p className="mt-2 text-sm text-forest-700">{warehouse.manager_names.length ? `Assigned to ${warehouse.manager_names.join(", ")}` : "No Farm Manager assigned — stock mutations are blocked."}</p>
                  <button type="button" onClick={() => { setStockWarehouseId(warehouse.id); setActiveTab("stock"); }} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-forest-900 underline underline-offset-4">View this warehouse stock <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                </article>
              )) : <div className="rounded-xl border border-dashed border-sand-300 p-6 text-sm leading-6 text-forest-600 sm:col-span-2">{currentRole === "farm_manager" ? "No warehouse is assigned to you. Ask the CEO to create or assign the appropriate farm or central store before receiving, issuing, transferring, or counting stock." : "No warehouse has been created yet. Use Warehouse setup to establish the first physical stock location."}</div>}
            </div>
          </section>

          <aside className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Governed setup</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Create a warehouse</h2>
            <p className="mt-1 text-sm leading-6 text-forest-600">CEO setup defines the location. Assigning a Farm Manager grants the operational authority to post and count stock there.</p>
            {!canCreateWarehouse ? <div className="mt-4 rounded-xl bg-sand-50 p-4 text-sm text-forest-600">Warehouse creation is managed by the CEO. Your assigned locations appear on the left.</div> : (
              <form className="mt-4 grid gap-3" onSubmit={onCreateWarehouse}>
                <input required className={inputClass} value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} placeholder="Warehouse name" aria-label="Warehouse name" />
                <select required className={inputClass} value={warehouseBranchId} onChange={(event) => { setWarehouseBranchId(event.target.value); setWarehouseFarmId(""); }} aria-label="Warehouse branch"><option value="">Select branch</option>{warehouseBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
                <select className={inputClass} value={warehouseFarmId} onChange={(event) => setWarehouseFarmId(event.target.value)} aria-label="Associated farm"><option value="">Branch-level or central warehouse</option>{warehouseFarms.filter((farm) => farm.branch_id === warehouseBranchId).map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select>
                <select className={inputClass} value={warehouseType} onChange={(event) => setWarehouseType(event.target.value)} aria-label="Warehouse type"><option value="farm_store">Farm store</option><option value="pharmacy">Pharmacy</option><option value="equipment_store">Equipment store</option><option value="central_warehouse">Central warehouse</option></select>
                <select className={inputClass} value={warehouseManagerId} onChange={(event) => setWarehouseManagerId(event.target.value)} aria-label="Assigned Farm Manager"><option value="">Create unassigned</option>{warehouseManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name || "Farm Manager"}</option>)}</select>
                <button type="submit" disabled={saving || !warehouseBranchId} className="h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 transition hover:bg-forest-800 disabled:opacity-60">{saving ? "Creating…" : "Create warehouse"}</button>
              </form>
            )}
          </aside>
        </div>
      ) : null}

      {activeTab === "purchases" || activeTab === "issues" ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">{activeTab === "purchases" ? "Inbound control" : "Outbound control"}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">{activeTab === "purchases" ? "Receive and cost stock" : "Issue, return, or transfer stock"}</h2>
            <p className="mt-1 text-sm leading-6 text-forest-600">{activeTab === "purchases" ? "Capture the supplier evidence and landed unit cost that should enter the ledger." : "Allocate consumption to the right flock or move stock between warehouses with a traceable reason."}</p>
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
              <select className={inputClass} value={txnType} onChange={(e) => setTxnType(e.target.value as StockMovementInputType)}>
                {activeTab === "purchases" ? <option value="receipt">Receipt</option> : null}
                <option value="issue">Issue</option>
                <option value="return">Return</option>
                <option value="transfer">Warehouse Transfer</option>
                <option value="adjustment">Adjustment</option>
              </select>
              {txnType === "transfer" ? (
                <select className={inputClass} value={txnDestinationWarehouseId} onChange={(e) => setTxnDestinationWarehouseId(e.target.value)} required>
                  <option value="">Select destination warehouse</option>
                  {warehouses
                    .filter((warehouse) => warehouse.id !== txnWarehouseId)
                    .map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.type})</option>)}
                </select>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="date" className={inputClass} value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
                {txnType === "receipt" ? (
                  <select className={inputClass} value={txnProcurementType} onChange={(e) => setTxnProcurementType(e.target.value as "monthly" | "emergency" | "miscellaneous")}>
                    <option value="monthly">Monthly procurement</option>
                    <option value="emergency">Emergency purchase</option>
                    <option value="miscellaneous">Miscellaneous purchase</option>
                  </select>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="number" min={txnType === "adjustment" ? undefined : 0.01} step="0.01" className={inputClass} placeholder={txnType === "adjustment" ? "Signed quantity (+/-)" : "Quantity"} value={txnQuantity || ""} onChange={(e) => setTxnQuantity(Number(e.target.value) || 0)} required />
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
              <input className={inputClass} placeholder="Notes or reason" value={txnNotes} onChange={(e) => setTxnNotes(e.target.value)} />
              <button className="h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 transition hover:bg-forest-800 disabled:opacity-60" type="submit" disabled={saving || !canManageStock}>
                {saving ? "Saving…" : txnType === "receipt" ? "Post receipt" : txnType === "transfer" ? "Post paired transfer" : "Post movement"}
              </button>
            </form>
            {warehouses.length === 0 ? <p className="mt-3 text-sm text-ember-500">Create at least one warehouse before recording stock movement.</p> : null}
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
            <div className="border-b border-sand-200 p-5 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Audit trail</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Recent stock ledger</h2><p className="mt-1 text-sm text-forest-600">The latest 40 movements in the selected operational scope. Wide detail scrolls only inside this card.</p></div>
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 bg-sand-50 text-left text-[10px] uppercase tracking-[0.16em] text-forest-600">
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Item</th>
                    <th className="px-2 py-2">Type</th>
                    <th className="px-2 py-2">Qty</th>
                    <th className="px-2 py-2">Cost</th>
                    <th className="px-2 py-2">Source</th>
                    <th className="px-2 py-2">Flock</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr><td className="px-2 py-4 text-forest-600" colSpan={7}>No stock movements yet.</td></tr>
                  ) : ledger.slice(0, 40).map((entry, index) => (
                    <tr key={`${entry.item_id}-${entry.transaction_date}-${index}`} className="border-b border-sand-100">
                      <td className="px-2 py-2 text-forest-700">{entry.transaction_date}</td>
                      <td className="px-2 py-2 font-medium text-forest-900">{itemNameMap.get(entry.item_id) ?? entry.item_id}</td>
                      <td className="px-2 py-2 text-forest-700">{entry.transaction_type}</td>
                      <td className="px-2 py-2 text-forest-700">{money(entry.quantity)}</td>
                      <td className="px-2 py-2 text-forest-700">{money(entry.unit_cost)}</td>
                      <td className="px-2 py-2 text-forest-700">{entry.procurement_type ?? entry.reference_doc ?? "-"}</td>
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
          <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Operating expenditure</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Record a monthly cost</h2><p className="mt-1 text-sm text-forest-600">Add costs that do not originate from stock movements and choose how they should be allocated.</p>
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
              <button className="h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-sand-50 transition hover:bg-forest-800 disabled:opacity-60" type="submit" disabled={saving || !canRecordCosts}>
                {saving ? "Saving…" : "Record cost"}
              </button>
            </form>
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
            <div className="flex items-end justify-between gap-3 border-b border-sand-200 p-5 sm:p-6">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Cost evidence</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Cost entries</h2></div>
              <div className="text-right"><p className="font-display text-xl font-semibold text-forest-900">{money(costTotal)} ETB</p><p className="text-xs text-forest-500">Selected period</p></div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 bg-sand-50 text-left text-[10px] uppercase tracking-[0.16em] text-forest-600">
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
          <section className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Controlled close</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Monthly reconciliation</h2><p className="mt-1 text-sm text-forest-600">Recalculate first, review warnings, then lock the cost period when its evidence is complete.</p>
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

          <section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Cost integrity</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Monthly cost periods</h2>
            {latestPeriod ? (
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg bg-sand-50 p-3"><p className="text-xs text-forest-600">Gross Sales</p><p className="mt-1 font-semibold text-forest-900">{money(latestPeriod.total_revenue)}</p></div>
                  <div className="rounded-lg bg-sand-50 p-3"><p className="text-xs text-forest-600">Operating Profit</p><p className="mt-1 font-semibold text-forest-900">{money(latestPeriod.operating_profit)}</p></div>
                  <div className="rounded-lg bg-sand-50 p-3"><p className="text-xs text-forest-600">Cash Surplus</p><p className="mt-1 font-semibold text-forest-900">{money(latestPeriod.cash_operating_surplus)}</p></div>
                  <div className="rounded-lg bg-sand-50 p-3"><p className="text-xs text-forest-600">Receivables</p><p className="mt-1 font-semibold text-forest-900">{money(latestPeriod.total_balance_due)}</p></div>
                </div>
                <p className="text-xs text-forest-600">
                  Cost breakdown: inventory {money(latestPeriod.direct_inventory_cost)} · bird COGS {money(latestPeriod.bird_cogs)} · overhead {money(latestPeriod.overhead_cost)}
                </p>
                {(latestPeriod.reconciliation_warnings ?? []).length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p className="font-semibold">Reconciliation needs review</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {latestPeriod.reconciliation_warnings.map((warning) => <li key={warning}>{warning}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-[1080px] w-full text-sm">
                <thead>
                  <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                    <th className="px-2 py-2">Period</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Revenue</th>
                    <th className="px-2 py-2">Paid</th>
                    <th className="px-2 py-2">Due</th>
                    <th className="px-2 py-2">Cost</th>
                    <th className="px-2 py-2">Profit</th>
                    <th className="px-2 py-2">Base/Egg</th>
                    <th className="px-2 py-2">Target Price</th>
                    <th className="px-2 py-2">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.length === 0 ? (
                    <tr><td className="px-2 py-4 text-forest-600" colSpan={10}>No reconciled profit periods yet.</td></tr>
                  ) : periods.map((period) => (
                    <tr key={period.id} className="border-b border-sand-100">
                      <td className="px-2 py-2 font-medium text-forest-900">{period.period_start} to {period.period_end}</td>
                      <td className="px-2 py-2 text-forest-700">{period.status}</td>
                      <td className="px-2 py-2 text-forest-700">{money(period.total_revenue)}</td>
                      <td className="px-2 py-2 text-forest-700">{money(period.total_paid_revenue)}</td>
                      <td className="px-2 py-2 text-forest-700">{money(period.total_balance_due)}</td>
                      <td className="px-2 py-2 text-forest-700">{money(period.total_absorbed_cost)}</td>
                      <td className={`px-2 py-2 font-medium ${period.operating_profit >= 0 ? "text-leaf-500" : "text-red-700"}`}>{money(period.operating_profit)}</td>
                      <td className="px-2 py-2 text-forest-700">{money(period.base_cost_per_egg, 4)}</td>
                      <td className="px-2 py-2 text-forest-700">{money(period.base_cost_per_egg === null ? null : period.base_cost_per_egg + period.target_margin_per_egg, 4)}</td>
                      <td className="px-2 py-2 text-forest-700" title={(period.reconciliation_warnings ?? []).join(" ")}>{(period.reconciliation_warnings ?? []).length > 0 ? `Review (${period.reconciliation_warnings.length})` : "Complete"}</td>
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
