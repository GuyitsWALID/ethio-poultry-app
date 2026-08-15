/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Target,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";

import { useFarmScope } from "@/components/farm-scope-context";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type SalesRecord = {
  id: string;
  branch_id: string | null;
  farm_id: string | null;
  house_id: string | null;
  flock_id: string | null;
  batch_id: string | null;
  sale_date: string;
  product_category: ProductCategory;
  product_label: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gross_amount: number;
  paid_amount: number;
  balance_due: number;
  payment_method: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
};

type Analytics = {
  kpis: {
    todayRevenue: number;
    revenue: number;
    paid: number;
    balanceDue: number;
    quantity: number;
    averageSellingPrice: number;
    estimatedProfit: number;
    actualPaidMargin: number | null;
    marginStatus: "estimated" | "tracked";
    costBasisStatus?: "locked" | "rolling_estimate" | "missing";
    breakEvenPricePerEgg?: number | null;
    targetPricePerEgg?: number | null;
    targetMarginPerEgg?: number;
    normalEggs?: number;
    brokenEggs?: number;
    absorbedCost?: number;
    costBasisSource?: string;
    belowTargetCount?: number;
    belowBreakEvenCount?: number;
    missingCostReasons: string[];
  };
  pricingGuidance?: {
    costBasis: {
      status: "locked" | "rolling_estimate" | "missing";
      baseCostPerEgg: number | null;
      targetMarginPerEgg: number;
      targetPricePerEgg: number | null;
      normalEggs: number;
      brokenEggs: number;
      absorbedCost: number;
      sourceLabel: string;
      missingCostReasons: string[];
    };
    tierSummary: Array<{
      tier: string;
      label: string;
      revenue: number;
      eggsSold: number;
      marginPerEgg: number | null;
      totalTierProfit: number | null;
    }>;
    warnings: string[];
  };
  charts: {
    daily: Array<{ label: string; revenue: number; quantity: number; estimatedProfit: number; paidProfitMargin: number | null }>;
    weekly: Array<{ label: string; revenue: number }>;
    monthly: Array<{ label: string; revenue: number }>;
    quarterly: Array<{ label: string; revenue: number }>;
    productMix: Array<{ label: string; revenue: number; quantity: number }>;
    contribution: Array<{ id: string; label: string; revenue: number; quantity: number }>;
    salesTiers?: Array<{ tier: string; label: string; revenue: number; eggsSold: number; marginPerEgg: number | null; totalTierProfit: number | null }>;
  };
};

type ProductCategory = "egg" | "bird" | "training" | "equipment_medicine" | "consultancy" | "package";
type FormState = {
  id: string;
  sale_date: string;
  product_category: ProductCategory;
  product_label: string;
  quantity: string;
  unit: string;
  unit_price: string;
  paid_amount: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  branch_id: string;
  farm_id: string;
  house_id: string;
  flock_id: string;
  batch_id: string;
};

function addisToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Addis_Ababa" });
}

const today = addisToday();
const defaultFrom = new Date();
defaultFrom.setDate(defaultFrom.getDate() - 29);

const productLabels = {
  egg: ["table_egg", "broken_egg", "hatching_egg"],
  bird: ["pullet", "chick", "spent_layer", "broiler"],
  training: ["training_enrollment", "workshop", "farm_visit_training"],
  equipment_medicine: ["equipment", "medicine", "vaccine", "supplement"],
  consultancy: ["farm_consultancy", "technical_support", "assessment"],
  package: ["starter_package", "farm_package", "custom_package"],
};

const emptyAnalytics: Analytics = {
  kpis: {
    todayRevenue: 0,
    revenue: 0,
    paid: 0,
    balanceDue: 0,
    quantity: 0,
    averageSellingPrice: 0,
    estimatedProfit: 0,
    actualPaidMargin: null,
    marginStatus: "estimated",
    costBasisStatus: "missing",
    breakEvenPricePerEgg: null,
    targetPricePerEgg: null,
    targetMarginPerEgg: 0,
    normalEggs: 0,
    brokenEggs: 0,
    absorbedCost: 0,
    costBasisSource: "Missing cost basis",
    belowTargetCount: 0,
    belowBreakEvenCount: 0,
    missingCostReasons: [],
  },
  charts: { daily: [], weekly: [], monthly: [], quarterly: [], productMix: [], contribution: [] },
};

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
  }).format(value);
}

function labelize(value: string | null | undefined) {
  if (!value) return "-";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pricePerEgg(unit: string, unitPrice: string) {
  const price = Number(unitPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  const normalized = unit.toLowerCase();
  if (normalized.includes("tray")) return price / 30;
  if (normalized.includes("crate")) return price / 360;
  if (normalized.includes("dozen")) return price / 12;
  return price;
}

function emptyForm(scope?: Partial<FormState>): FormState {
  return {
    id: "",
    sale_date: today,
    product_category: "egg",
    product_label: "table_egg",
    quantity: "",
    unit: "tray",
    unit_price: "",
    paid_amount: "",
    payment_method: "cash",
    customer_name: "",
    customer_phone: "",
    notes: "",
    branch_id: scope?.branch_id ?? "",
    farm_id: scope?.farm_id ?? "",
    house_id: scope?.house_id ?? "",
    flock_id: scope?.flock_id ?? "",
    batch_id: scope?.batch_id ?? "",
  };
}

function normalizeAnalytics(value: unknown): Analytics {
  if (!value || typeof value !== "object" || !("kpis" in value) || !("charts" in value)) {
    return emptyAnalytics;
  }

  const candidate = value as Partial<Analytics>;
  return {
    kpis: { ...emptyAnalytics.kpis, ...(candidate.kpis ?? {}) },
    charts: { ...emptyAnalytics.charts, ...(candidate.charts ?? {}) },
    pricingGuidance: candidate.pricingGuidance,
  };
}

export default function SalesPage() {
  const {
    role,
    scope,
    branches,
    farms,
    houses,
    flocks,
    batches,
    period,
  } = useFarmScope();
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>(emptyAnalytics);
  const [dateFrom, setDateFrom] = useState(defaultFrom.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today);
  const [productCategory, setProductCategory] = useState("");
  const [trendWindow, setTrendWindow] = useState<"daily" | "weekly" | "monthly" | "quarterly">("daily");
  const [recordSearch, setRecordSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"all" | "paid" | "open">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm({
      branch_id: scope.branchId,
      farm_id: scope.farmId,
      house_id: scope.houseId,
      flock_id: scope.flockId,
      batch_id: scope.batchId,
    })
  );

  const canMutate = role === "farm_manager";
  useEffect(() => {
    if (role === "ceo") {
      setDateFrom(period.dateFrom);
      setDateTo(period.dateTo);
    }
  }, [period.dateFrom, period.dateTo, role]);
  const branchName = useMemo(() => new Map(branches.map((item) => [item.id, item.name])), [branches]);
  const farmName = useMemo(() => new Map(farms.map((item) => [item.id, item.name])), [farms]);
  const flockName = useMemo(() => new Map(flocks.map((item) => [item.id, item.flock_code])), [flocks]);
  const batchName = useMemo(() => new Map(batches.map((item) => [item.id, item.batch_code])), [batches]);

  const params = useMemo(() => {
    const search = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      branch_id: scope.branchId,
      farm_id: scope.farmId,
      house_id: scope.houseId,
      flock_id: scope.flockId,
      batch_id: scope.batchId,
    });
    if (productCategory) search.set("product_category", productCategory);
    return search;
  }, [dateFrom, dateTo, productCategory, scope]);

  const loadSales = async () => {
    setLoading(true);
    setError("");
    const [recordsResponse, analyticsResponse] = await Promise.all([
      fetch(`/api/sales/records?${params.toString()}`),
      fetch(`/api/sales/analytics?${params.toString()}`),
    ]);
    const recordsJson = await recordsResponse.json();
    const analyticsJson = await analyticsResponse.json();
    if (!recordsResponse.ok) setError(recordsJson?.error ?? "Could not load sales records.");
    if (!analyticsResponse.ok) setError(analyticsJson?.error ?? "Could not load sales analytics.");
    setRecords((recordsJson?.records ?? []) as SalesRecord[]);
    setAnalytics(analyticsResponse.ok ? normalizeAnalytics(analyticsJson) : emptyAnalytics);
    setLoading(false);
  };

  useEffect(() => {
    void loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const openCreate = () => {
    const selectedFarmId = scope.farmId && farms.some((farm) => farm.id === scope.farmId)
      ? scope.farmId
      : farms.length === 1
        ? farms[0].id
        : "";
    const selectedFarm = farms.find((farm) => farm.id === selectedFarmId);
    setForm(
      emptyForm({
        branch_id: selectedFarm?.branch_id ?? "",
        farm_id: selectedFarmId,
        house_id: selectedFarmId === scope.farmId ? scope.houseId : "",
        flock_id: selectedFarmId === scope.farmId ? scope.flockId : "",
        batch_id: selectedFarmId === scope.farmId ? scope.batchId : "",
      })
    );
    setModalOpen(true);
  };

  const openEdit = (record: SalesRecord) => {
    setForm({
      id: record.id,
      sale_date: record.sale_date,
      product_category: record.product_category,
      product_label: record.product_label,
      quantity: String(record.quantity),
      unit: record.unit,
      unit_price: String(record.unit_price),
      paid_amount: String(record.paid_amount),
      payment_method: record.payment_method ?? "",
      customer_name: record.customer_name ?? "",
      customer_phone: record.customer_phone ?? "",
      notes: record.notes ?? "",
      branch_id: record.branch_id ?? "",
      farm_id: record.farm_id ?? "",
      house_id: record.house_id ?? "",
      flock_id: record.flock_id ?? "",
      batch_id: record.batch_id ?? "",
    });
    setModalOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    const response = await fetch(form.id ? `/api/sales/records/${form.id}` : "/api/sales/records", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? "Could not save sales record.");
      return;
    }
    setModalOpen(false);
    await loadSales();
  };

  const remove = async (record: SalesRecord) => {
    if (!confirm("Delete this sales record?")) return;
    setError("");
    const response = await fetch(`/api/sales/records/${record.id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data?.error ?? "Could not delete sales record.");
      return;
    }
    await loadSales();
  };

  const filteredFormFarms = farms;
  const filteredFormHouses = form.farm_id ? houses.filter((house) => house.farm_id === form.farm_id) : [];
  const filteredFormFlocks = flocks.filter(
    (flock) => Boolean(form.farm_id) && flock.farm_id === form.farm_id && (!form.house_id || flock.house_id === form.house_id)
  );
  const filteredFormBatches = batches.filter(
    (batch) =>
      Boolean(form.farm_id) &&
      (batch.farm_id === form.farm_id || filteredFormFlocks.some((flock) => flock.batch_id === batch.id)) &&
      (!form.house_id || batch.house_id === form.house_id || filteredFormFlocks.some((flock) => flock.batch_id === batch.id)) &&
      (!form.flock_id || flocks.some((flock) => flock.batch_id === batch.id && flock.id === form.flock_id))
  );
  const draftPricePerEgg = form.product_category === "egg" ? pricePerEgg(form.unit, form.unit_price) : null;
  const draftBelowBreakEven =
    draftPricePerEgg !== null &&
    analytics.kpis.breakEvenPricePerEgg !== null &&
    analytics.kpis.breakEvenPricePerEgg !== undefined &&
    draftPricePerEgg < analytics.kpis.breakEvenPricePerEgg;
  const draftBelowTarget =
    draftPricePerEgg !== null &&
    analytics.kpis.targetPricePerEgg !== null &&
    analytics.kpis.targetPricePerEgg !== undefined &&
    draftPricePerEgg < analytics.kpis.targetPricePerEgg;
  const collectionRate = analytics.kpis.revenue > 0 ? (analytics.kpis.paid / analytics.kpis.revenue) * 100 : null;
  const openReceivables = records.filter((record) => record.balance_due > 0);
  const paidRecords = records.filter((record) => record.balance_due <= 0);
  const todayRecords = records.filter((record) => record.sale_date === today);
  const topProduct = [...analytics.charts.productMix].sort((a, b) => b.revenue - a.revenue)[0];
  const chartPalette = ["#2f6f4e", "#d59b2d", "#e85d3f", "#2b6cb0", "#65c480", "#7b6b52"];
  const trendData = analytics.charts[trendWindow];
  const filteredRecords = records.filter((record) => {
    const query = recordSearch.trim().toLowerCase();
    const matchesQuery =
      !query ||
      record.customer_name?.toLowerCase().includes(query) ||
      record.product_label.toLowerCase().includes(query) ||
      record.payment_method?.toLowerCase().includes(query) ||
      batchName.get(record.batch_id ?? "")?.toLowerCase().includes(query) ||
      flockName.get(record.flock_id ?? "")?.toLowerCase().includes(query);
    const matchesPayment = paymentStatus === "all" || (paymentStatus === "paid" ? record.balance_due <= 0 : record.balance_due > 0);
    return Boolean(matchesQuery && matchesPayment);
  });
  const draftGross = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);
  const draftPaid = Number(form.paid_amount) || 0;
  const draftBalance = Math.max(0, draftGross - draftPaid);

  const setQuickRange = (days: number) => {
    const end = new Date(`${today}T12:00:00`);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    setDateFrom(start.toISOString().slice(0, 10));
    setDateTo(today);
  };

  return (
    <div className="space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-[28px] bg-forest-900 px-6 py-7 text-sand-50 shadow-sm sm:px-8 lg:px-10 lg:py-9">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border-[44px] border-amber-500/10" aria-hidden="true" />
        <div className="absolute -bottom-24 right-36 h-52 w-52 rounded-full bg-leaf-500/10" aria-hidden="true" />
        <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-500"><CircleDollarSign className="h-4 w-4" aria-hidden="true" />Commercial control room</div>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-4xl">Turn every sale into collected cash and protected margin.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100/80">Record today&apos;s farm sales, watch receivables, and check every egg price against the cost of production before margin slips away.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadSales()} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-xl border border-sand-50/25 bg-white/5 px-4 text-sm font-semibold text-sand-50 transition hover:bg-white/10 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</button>
            {canMutate ? <button type="button" onClick={openCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-sand-50 px-4 text-sm font-semibold text-forest-900 transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"><Plus className="h-4 w-4" aria-hidden="true" />Record today&apos;s sale</button> : null}
          </div>
        </div>
      </section>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}</div> : null}

      <section className="rounded-2xl border border-sand-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Reporting scope</p><h2 className="mt-1 font-display text-xl font-semibold text-forest-900">Choose the commercial window</h2></div>
          <div className="flex flex-wrap gap-2">{[7, 30, 90].map((days) => <button key={days} type="button" onClick={() => setQuickRange(days)} disabled={role !== "farm_manager"} className="h-9 rounded-lg border border-sand-200 px-3 text-xs font-semibold text-forest-700 transition hover:bg-sand-50 disabled:cursor-not-allowed disabled:opacity-40">{days} days</button>)}</div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {role === "farm_manager" ? <><label className="grid gap-1 text-xs font-medium text-forest-600">From<input className="h-10 rounded-lg border border-sand-200 px-3 text-sm text-forest-900" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label><label className="grid gap-1 text-xs font-medium text-forest-600">To<input className="h-10 rounded-lg border border-sand-200 px-3 text-sm text-forest-900" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label></> : <div className="flex items-center gap-2 rounded-lg bg-sand-50 px-3 py-2 text-sm text-forest-600 md:col-span-2"><CalendarDays className="h-4 w-4" aria-hidden="true" />Executive scope period: {dateFrom} to {dateTo}</div>}
          <label className="grid gap-1 text-xs font-medium text-forest-600">Product<select className="h-10 rounded-lg border border-sand-200 px-3 text-sm text-forest-900" value={productCategory} onChange={(event) => setProductCategory(event.target.value)}><option value="">All products</option><option value="egg">Eggs</option><option value="bird">Birds</option><option value="training">Training</option><option value="equipment_medicine">Equipment &amp; medicine</option><option value="consultancy">Consultancy</option><option value="package">Packages</option></select></label>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="border-b border-sand-200 px-5 py-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Cash conversion</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">From invoice to cash</h2></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${collectionRate !== null && collectionRate >= 90 ? "bg-green-50 text-forest-700" : "bg-amber-100 text-amber-800"}`}>{collectionRate === null ? "No sales yet" : `${currency(collectionRate)}% collected`}</span></div></div>
        <div className="grid md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
          <div className="p-5 sm:p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-forest-500"><ReceiptText className="h-4 w-4" aria-hidden="true" />Sales booked</div><p className="mt-3 font-display text-3xl font-semibold text-forest-900">{currency(analytics.kpis.revenue)} <span className="font-sans text-sm font-medium">ETB</span></p><p className="mt-1 text-xs text-forest-600">{records.length} transactions in this window</p></div>
          <div className="hidden items-center text-sand-200 md:flex"><ArrowRight className="h-5 w-5" aria-hidden="true" /></div>
          <div className="border-y border-sand-200 bg-green-50/50 p-5 sm:p-6 md:border-x md:border-y-0"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-forest-500"><Banknote className="h-4 w-4" aria-hidden="true" />Cash collected</div><p className="mt-3 font-display text-3xl font-semibold text-forest-900">{currency(analytics.kpis.paid)} <span className="font-sans text-sm font-medium">ETB</span></p><p className="mt-1 text-xs text-forest-600">{paidRecords.length} fully settled transactions</p></div>
          <div className="hidden items-center text-sand-200 md:flex"><ArrowRight className="h-5 w-5" aria-hidden="true" /></div>
          <div className="p-5 sm:p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-forest-500"><Clock3 className="h-4 w-4" aria-hidden="true" />Still receivable</div><p className={`mt-3 font-display text-3xl font-semibold ${analytics.kpis.balanceDue > 0 ? "text-ember-500" : "text-forest-900"}`}>{currency(analytics.kpis.balanceDue)} <span className="font-sans text-sm font-medium">ETB</span></p><p className="mt-1 text-xs text-forest-600">Across {openReceivables.length} open transactions</p></div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">Today</p><WalletCards className="h-4 w-4 text-forest-500" aria-hidden="true" /></div><p className="mt-2 font-display text-2xl font-semibold text-forest-900">{currency(analytics.kpis.todayRevenue)} ETB</p><p className="mt-1 text-xs text-forest-600">{todayRecords.length} sales recorded on {today}</p></article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">Estimated profit</p><TrendingUp className="h-4 w-4 text-leaf-500" aria-hidden="true" /></div><p className={`mt-2 font-display text-2xl font-semibold ${analytics.kpis.estimatedProfit < 0 ? "text-ember-500" : "text-forest-900"}`}>{currency(analytics.kpis.estimatedProfit)} ETB</p><p className="mt-1 text-xs text-forest-600">{labelize(analytics.kpis.marginStatus)} using {labelize(analytics.kpis.costBasisStatus)}</p></article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">Average ticket</p><ReceiptText className="h-4 w-4 text-forest-500" aria-hidden="true" /></div><p className="mt-2 font-display text-2xl font-semibold text-forest-900">{records.length ? `${currency(analytics.kpis.revenue / records.length)} ETB` : "Unavailable"}</p><p className="mt-1 text-xs text-forest-600">Average value per transaction</p></article>
        <article className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest-500">Leading product</p><Target className="h-4 w-4 text-amber-500" aria-hidden="true" /></div><p className="mt-2 truncate font-display text-2xl font-semibold text-forest-900">{topProduct ? labelize(topProduct.label) : "Unavailable"}</p><p className="mt-1 text-xs text-forest-600">{topProduct ? `${currency(topProduct.revenue)} ETB revenue` : "No product mix in this period"}</p></article>
      </div>

      {(analytics.pricingGuidance?.warnings?.length || analytics.kpis.missingCostReasons.length) ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" /><div><h2 className="text-sm font-semibold text-amber-900">Commercial decisions need review</h2><ul className="mt-1 space-y-1 text-sm text-amber-800">{[...(analytics.pricingGuidance?.warnings ?? []), ...analytics.kpis.missingCostReasons].map((warning) => <li key={warning}>{warning}</li>)}</ul></div></div></section> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-sand-200 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Revenue rhythm</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Commercial trajectory</h2><p className="mt-1 text-sm text-forest-600">Each view uses its own real time buckets; unrelated periods are never overlaid.</p></div><div className="flex rounded-xl bg-sand-50 p-1">{(["daily", "weekly", "monthly", "quarterly"] as const).map((value) => <button key={value} type="button" onClick={() => setTrendWindow(value)} className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${trendWindow === value ? "bg-white text-forest-900 shadow-sm" : "text-forest-600 hover:text-forest-900"}`}>{value}</button>)}</div></div>
          <div className="overflow-x-auto p-4 sm:p-5"><div className="min-w-[620px]">{trendData.length ? <ChartContainer config={{ revenue: { label: "Revenue (ETB)", color: "#2f6f4e" }, quantity: { label: "Quantity sold", color: "#d59b2d" } }} className="h-72 w-full">
            {trendWindow === "daily" ? <LineChart data={analytics.charts.daily} margin={{ left: 4, right: 4 }}><CartesianGrid stroke="#e6dcc7" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis yAxisId="money" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis yAxisId="quantity" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Line yAxisId="money" type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={3} dot={false} /><Line yAxisId="quantity" type="monotone" dataKey="quantity" stroke="var(--color-quantity)" strokeWidth={2} strokeDasharray="5 4" dot={false} /></LineChart> : <BarChart data={trendData} margin={{ left: 4, right: 4 }}><CartesianGrid stroke="#e6dcc7" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} maxBarSize={52} /></BarChart>}
          </ChartContainer> : <div className="flex h-72 items-center justify-center text-sm text-forest-600">No revenue points are available for this period.</div>}</div></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm"><div className="border-b border-sand-200 p-5 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Revenue composition</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">What customers bought</h2><p className="mt-1 text-sm text-forest-600">Share of booked revenue by product category.</p></div>{analytics.charts.productMix.length ? <><ChartContainer config={{ revenue: { label: "Revenue (ETB)", color: "#2f6f4e" } }} className="mx-auto h-56 max-w-sm"><PieChart><ChartTooltip content={<ChartTooltipContent />} /><Pie data={analytics.charts.productMix} dataKey="revenue" nameKey="label" innerRadius={55} outerRadius={88} paddingAngle={2}>{analytics.charts.productMix.map((entry, index) => <Cell key={entry.label} fill={chartPalette[index % chartPalette.length]} />)}</Pie></PieChart></ChartContainer><div className="space-y-2 border-t border-sand-200 p-5">{analytics.charts.productMix.map((entry, index) => <div key={entry.label} className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2 text-forest-700"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartPalette[index % chartPalette.length] }} /><span className="truncate">{labelize(entry.label)}</span></span><span className="font-semibold text-forest-900">{currency(entry.revenue)} ETB</span></div>)}</div></> : <div className="flex h-64 items-center justify-center p-6 text-sm text-forest-600">Product mix appears after sales are recorded.</div>}</section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm"><div className="border-b border-sand-200 p-5 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Margin signal</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Profit and cash-paid margin</h2><p className="mt-1 text-sm text-forest-600">Profit is estimated from available production costs; paid margin uses cash collected, not invoices.</p></div><div className="overflow-x-auto p-4 sm:p-5"><div className="min-w-[620px]">{analytics.charts.daily.length ? <ChartContainer config={{ estimatedProfit: { label: "Estimated profit (ETB)", color: "#2f6f4e" }, paidProfitMargin: { label: "Paid margin (%)", color: "#e85d3f" } }} className="h-72 w-full"><LineChart data={analytics.charts.daily}><CartesianGrid stroke="#e6dcc7" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis yAxisId="profit" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis yAxisId="margin" orientation="right" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><ReferenceLine yAxisId="profit" y={0} stroke="#a99d89" /><ChartTooltip content={<ChartTooltipContent />} /><Line yAxisId="profit" type="monotone" dataKey="estimatedProfit" stroke="var(--color-estimatedProfit)" strokeWidth={3} dot={false} /><Line yAxisId="margin" type="monotone" dataKey="paidProfitMargin" stroke="var(--color-paidProfitMargin)" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls /></LineChart></ChartContainer> : <div className="flex h-72 items-center justify-center text-sm text-forest-600">Margin history is unavailable for this period.</div>}</div></div></section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm"><div className="border-b border-sand-200 p-5 sm:p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Source performance</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Flock and farm contribution</h2><p className="mt-1 text-sm text-forest-600">Ranks the operating sources that generated the most booked revenue.</p></div><div className="overflow-x-auto p-4 sm:p-5"><div className="min-w-[620px]">{analytics.charts.contribution.length ? <ChartContainer config={{ revenue: { label: "Revenue (ETB)", color: "#2f6f4e" } }} className="h-72 w-full"><BarChart data={analytics.charts.contribution} layout="vertical" margin={{ left: 12, right: 18 }}><CartesianGrid stroke="#e6dcc7" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 6, 6, 0]} maxBarSize={26} /></BarChart></ChartContainer> : <div className="flex h-72 items-center justify-center text-sm text-forest-600">Contribution appears when sales have farm or flock scope.</div>}</div></div></section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm"><div className="grid gap-0 lg:grid-cols-[1fr_1.25fr]"><div className="border-b border-sand-200 bg-forest-900 p-6 text-sand-50 lg:border-b-0 lg:border-r"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-500">Pricing guardrail</p><h2 className="mt-2 font-display text-2xl font-semibold">Know the floor before accepting the price.</h2><p className="mt-2 text-sm leading-6 text-sand-100/80">Break-even covers the recorded cost per egg. Target price adds the planned margin. Sales below either line are counted for review.</p><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] uppercase tracking-[0.15em] text-sand-100/70">Break-even / egg</p><p className="mt-2 font-display text-2xl font-semibold">{analytics.kpis.breakEvenPricePerEgg == null ? "Unavailable" : `${currency(analytics.kpis.breakEvenPricePerEgg)} ETB`}</p><p className="mt-1 text-xs text-sand-100/70">{analytics.kpis.belowBreakEvenCount ?? 0} sales below floor</p></div><div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] uppercase tracking-[0.15em] text-sand-100/70">Target / egg</p><p className="mt-2 font-display text-2xl font-semibold">{analytics.kpis.targetPricePerEgg == null ? "Unavailable" : `${currency(analytics.kpis.targetPricePerEgg)} ETB`}</p><p className="mt-1 text-xs text-sand-100/70">{analytics.kpis.belowTargetCount ?? 0} sales below target</p></div></div><p className="mt-4 text-xs text-sand-100/70">Cost source: {analytics.kpis.costBasisSource ?? "Unavailable"}</p></div>
        <div className="min-w-0"><div className="border-b border-sand-200 p-5"><h3 className="font-display text-xl font-semibold text-forest-900">Egg price-tier margin</h3><p className="mt-1 text-sm text-forest-600">Shows which customer price bands create or lose margin.</p></div><div className="overflow-x-auto"><table className="min-w-[650px] w-full text-sm"><thead><tr className="bg-sand-50 text-left text-[10px] uppercase tracking-[0.16em] text-forest-600"><th className="px-5 py-3">Price tier</th><th className="px-4 py-3">Eggs sold</th><th className="px-4 py-3">Revenue</th><th className="px-4 py-3">Margin / egg</th><th className="px-5 py-3">Tier profit</th></tr></thead><tbody>{(analytics.pricingGuidance?.tierSummary ?? []).length === 0 ? <tr><td className="px-5 py-8 text-forest-600" colSpan={5}>No egg sale tiers are available in this range.</td></tr> : (analytics.pricingGuidance?.tierSummary ?? []).map((tier) => <tr key={tier.tier} className="border-t border-sand-100"><td className="px-5 py-3 font-semibold text-forest-900">{tier.label}</td><td className="px-4 py-3 text-forest-700">{currency(tier.eggsSold)}</td><td className="px-4 py-3 text-forest-700">{currency(tier.revenue)} ETB</td><td className={`px-4 py-3 font-medium ${tier.marginPerEgg !== null && tier.marginPerEgg < 0 ? "text-ember-500" : "text-forest-700"}`}>{tier.marginPerEgg === null ? "Unavailable" : `${currency(tier.marginPerEgg)} ETB`}</td><td className={`px-5 py-3 font-semibold ${tier.totalTierProfit !== null && tier.totalTierProfit < 0 ? "text-ember-500" : "text-forest-900"}`}>{tier.totalTierProfit === null ? "Unavailable" : `${currency(tier.totalTierProfit)} ETB`}</td></tr>)}</tbody></table></div></div></div></section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-sand-200 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-500">Commercial evidence</p><h2 className="mt-1 font-display text-2xl font-semibold text-forest-900">Sales ledger</h2><p className="mt-1 text-sm text-forest-600">Search customers, products, payment methods, flocks, or batches. Wide detail scrolls only inside this card.</p></div><div className="grid gap-2 sm:grid-cols-[220px_150px]"><label className="relative"><span className="sr-only">Search sales records</span><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-forest-500" aria-hidden="true" /><input className="h-11 w-full rounded-lg border border-sand-200 pl-9 pr-3 text-sm text-forest-900" placeholder="Search records" value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} /></label><select aria-label="Filter by payment status" className="h-11 rounded-lg border border-sand-200 px-3 text-sm text-forest-900" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as typeof paymentStatus)}><option value="all">All payments</option><option value="paid">Paid in full</option><option value="open">Balance open</option></select></div></div>
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead>
              <tr className="bg-sand-50 text-left text-[10px] uppercase tracking-[0.16em] text-forest-600">
                <th className="px-5 py-3">Date / product</th><th className="px-4 py-3">Operational source</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Gross</th><th className="px-4 py-3">Collected</th><th className="px-4 py-3">Balance</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Payment</th>{canMutate ? <th className="px-5 py-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-forest-600" colSpan={canMutate ? 9 : 8}>
                    {loading ? "Loading sales records…" : records.length ? "No sales records match these filters." : "No sales have been recorded in this scope. Record the first sale to begin the ledger."}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="border-t border-sand-100 transition hover:bg-sand-50/70">
                    <td className="px-5 py-3 font-semibold text-forest-900">{labelize(record.product_label)}<span className="block text-xs font-normal text-forest-500">{record.sale_date} · {labelize(record.product_category)}</span></td>
                    <td className="px-4 py-3 text-forest-700">
                      {batchName.get(record.batch_id ?? "") ?? flockName.get(record.flock_id ?? "") ?? farmName.get(record.farm_id ?? "") ?? branchName.get(record.branch_id ?? "") ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-forest-700">{currency(record.quantity)} {record.unit}</td><td className="px-4 py-3 font-medium text-forest-900">{currency(record.gross_amount)} ETB</td><td className="px-4 py-3 text-forest-700">{currency(record.paid_amount)} ETB</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${record.balance_due > 0 ? "bg-amber-100 text-amber-800" : "bg-green-50 text-forest-700"}`}>{record.balance_due > 0 ? `${currency(record.balance_due)} ETB` : "Paid"}</span></td><td className="px-4 py-3 text-forest-700">{record.customer_name ?? "Not captured"}</td><td className="px-4 py-3 capitalize text-forest-700">{labelize(record.payment_method)}</td>
                    {canMutate ? (
                      <td className="px-5 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => openEdit(record)} className="rounded-lg border border-sand-200 p-2 text-forest-700 transition hover:bg-sand-50 focus:outline-none focus:ring-2 focus:ring-forest-500" title="Edit sale" aria-label={`Edit ${record.product_label} sale`}><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void remove(record)} className="rounded-lg border border-red-200 p-2 text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500" title="Delete sale" aria-label={`Delete ${record.product_label} sale`}><Trash2 className="h-4 w-4" /></button></div></td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/70 p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sale-dialog-title">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-[24px] bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-forest-900 px-5 py-4 text-sand-50 sm:px-6">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-500">Daily commercial entry</p><h2 id="sale-dialog-title" className="mt-1 font-display text-2xl font-semibold">{form.id ? "Correct sales evidence" : "Record a new sale"}</h2></div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-white/15 p-2 text-sand-50 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-500" title="Close" aria-label="Close sales form">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 divide-x divide-sand-200 border-b border-sand-200 bg-sand-50">
              <div className="p-4 sm:px-6"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-500">Gross sale</p><p className="mt-1 font-display text-xl font-semibold text-forest-900">{currency(draftGross)} ETB</p></div>
              <div className="p-4 sm:px-6"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-500">Collected</p><p className="mt-1 font-display text-xl font-semibold text-forest-900">{currency(draftPaid)} ETB</p></div>
              <div className="p-4 sm:px-6"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-forest-500">Balance</p><p className={`mt-1 font-display text-xl font-semibold ${draftBalance > 0 ? "text-ember-500" : "text-forest-900"}`}>{currency(draftBalance)} ETB</p></div>
            </div>

            <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-3">
              <label className="grid gap-1 text-xs text-forest-600">
                Date
                <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm" type="date" value={form.sale_date} onChange={(event) => setForm((prev) => ({ ...prev, sale_date: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Category
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.product_category} onChange={(event) => { const category=event.target.value as ProductCategory; setForm((prev) => ({ ...prev, product_category: category, product_label: productLabels[category][0], unit: category === "egg" ? "tray" : category === "bird" ? "bird" : "unit" })); }}>
                  <option value="egg">Egg</option>
                  <option value="bird">Bird</option>
                  <option value="training">Training</option>
                  <option value="equipment_medicine">Equipment &amp; Medicine</option>
                  <option value="consultancy">Consultancy</option>
                  <option value="package">Package</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Product
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.product_label} onChange={(event) => setForm((prev) => ({ ...prev, product_label: event.target.value }))}>
                  {productLabels[form.product_category].map((label) => (
                    <option key={label} value={label}>{labelize(label)}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Quantity
                <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm" type="number" min="0" step="0.01" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Unit
                <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.unit} onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Unit Price
                <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm" type="number" min="0" step="0.01" value={form.unit_price} onChange={(event) => setForm((prev) => ({ ...prev, unit_price: event.target.value }))} />
              </label>
              {form.product_category === "egg" && draftPricePerEgg !== null ? (
                <div className={`rounded-lg border px-3 py-2 text-xs md:col-span-3 ${
                  draftBelowBreakEven
                    ? "border-red-200 bg-red-50 text-red-700"
                    : draftBelowTarget
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-leaf-400/40 bg-green-50 text-forest-700"
                }`}>
                  Price per egg: {currency(draftPricePerEgg)} ETB. Break-even: {analytics.kpis.breakEvenPricePerEgg === null || analytics.kpis.breakEvenPricePerEgg === undefined ? "Unavailable" : `${currency(analytics.kpis.breakEvenPricePerEgg)} ETB`}. Target: {analytics.kpis.targetPricePerEgg === null || analytics.kpis.targetPricePerEgg === undefined ? "Unavailable" : `${currency(analytics.kpis.targetPricePerEgg)} ETB`}.
                </div>
              ) : null}
              <label className="grid gap-1 text-xs text-forest-600">
                Paid Amount
                <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm" type="number" min="0" step="0.01" value={form.paid_amount} onChange={(event) => setForm((prev) => ({ ...prev, paid_amount: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Payment
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.payment_method} onChange={(event) => setForm((prev) => ({ ...prev, payment_method: event.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="credit">Credit</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Customer
                <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.customer_name} onChange={(event) => setForm((prev) => ({ ...prev, customer_name: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Phone
                <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.customer_phone} onChange={(event) => setForm((prev) => ({ ...prev, customer_phone: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Farm
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.farm_id} onChange={(event) => { const farmId=event.target.value; const farm=farms.find((item)=>item.id===farmId); setForm((prev) => ({ ...prev, branch_id: farm?.branch_id ?? "", farm_id: farmId, house_id: "", flock_id: "", batch_id: "" })); }}>
                  <option value="">Select Farm</option>
                  {filteredFormFarms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                House
                <select disabled={!form.farm_id} className="h-10 rounded-lg border border-sand-200 px-3 text-sm disabled:bg-sand-50 disabled:text-forest-400" value={form.house_id} onChange={(event) => setForm((prev) => ({ ...prev, house_id: event.target.value, flock_id: "", batch_id: "" }))}>
                  <option value="">{form.farm_id ? "Select House" : "Select a farm first"}</option>
                  {filteredFormHouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Flock
                <select disabled={!form.farm_id} className="h-10 rounded-lg border border-sand-200 px-3 text-sm disabled:bg-sand-50 disabled:text-forest-400" value={form.flock_id} onChange={(event) => { const flockId=event.target.value; const flock=flocks.find((item)=>item.id===flockId); setForm((prev) => ({ ...prev, flock_id: flockId, house_id: flock?.house_id ?? prev.house_id, batch_id: flock?.batch_id ?? "" })); }}>
                  <option value="">{form.farm_id ? "Select Flock" : "Select a farm first"}</option>
                  {filteredFormFlocks.map((item) => <option key={item.id} value={item.id}>{item.flock_code}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Batch
                <select disabled={!form.farm_id} className="h-10 rounded-lg border border-sand-200 px-3 text-sm disabled:bg-sand-50 disabled:text-forest-400" value={form.batch_id} onChange={(event) => setForm((prev) => ({ ...prev, batch_id: event.target.value }))}>
                  <option value="">{form.farm_id ? "Select Batch" : "Select a farm first"}</option>
                  {filteredFormBatches.map((item) => <option key={item.id} value={item.id}>{item.batch_code}</option>)}
                </select>
              </label>
              <p className="text-xs leading-5 text-forest-500 md:col-span-3">Branch is derived automatically from the selected farm. Selecting a flock also fills its house and batch.</p>
              <label className="grid gap-1 text-xs text-forest-600 md:col-span-3">
                Notes
                <textarea className="min-h-20 rounded-lg border border-sand-200 px-3 py-2 text-sm" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
              </label>
              {draftPaid > draftGross ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-3">Collected amount cannot be greater than the gross sale.</div> : null}
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-sand-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <button type="button" onClick={() => setModalOpen(false)} className="h-11 rounded-xl border border-sand-200 px-4 text-sm font-semibold text-forest-700 transition hover:bg-sand-50">Cancel</button>
              <button type="button" onClick={() => void submit()} disabled={saving || draftGross <= 0 || draftPaid > draftGross || !form.sale_date || !form.product_label} className="inline-flex h-11 items-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white transition hover:bg-forest-800 disabled:opacity-60">
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : form.id ? "Save correction" : "Record sale"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
