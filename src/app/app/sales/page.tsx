"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";

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
  product_category: "egg" | "bird";
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

type FormState = {
  id: string;
  sale_date: string;
  product_category: "egg" | "bird";
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

const today = new Date().toISOString().slice(0, 10);
const defaultFrom = new Date();
defaultFrom.setDate(defaultFrom.getDate() - 29);

const productLabels = {
  egg: ["table_egg", "broken_egg", "hatching_egg"],
  bird: ["pullet", "chick", "spent_layer", "broiler"],
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
    filteredFarms,
    filteredHouses,
  } = useFarmScope();
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>(emptyAnalytics);
  const [dateFrom, setDateFrom] = useState(defaultFrom.toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(today);
  const [productCategory, setProductCategory] = useState("");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const openCreate = () => {
    setForm(
      emptyForm({
        branch_id: scope.branchId,
        farm_id: scope.farmId,
        house_id: scope.houseId,
        flock_id: scope.flockId,
        batch_id: scope.batchId,
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

  const filteredFormFarms = form.branch_id ? farms.filter((farm) => farm.branch_id === form.branch_id) : filteredFarms;
  const filteredFormHouses = form.farm_id ? houses.filter((house) => house.farm_id === form.farm_id) : filteredHouses;
  const filteredFormFlocks = flocks.filter(
    (flock) => (!form.farm_id || flock.farm_id === form.farm_id) && (!form.house_id || flock.house_id === form.house_id)
  );
  const filteredFormBatches = batches.filter(
    (batch) =>
      (!form.branch_id || batch.branch_id === form.branch_id) &&
      (!form.farm_id || flocks.some((flock) => flock.batch_id === batch.id && flock.farm_id === form.farm_id)) &&
      (!form.house_id || flocks.some((flock) => flock.batch_id === batch.id && flock.house_id === form.house_id)) &&
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Sales</p>
          <h2 className="text-2xl font-semibold text-forest-900">Daily farm sales</h2>
          <p className="mt-2 max-w-3xl text-sm text-forest-600">
            Register egg and bird sales, track paid revenue, and review period trends by scope.
            {!canMutate ? " This role is view-only for sales entry." : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadSales()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-sand-200 bg-white px-3 text-sm font-medium text-forest-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          {canMutate ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-forest-800 px-3 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              New Sale
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded-lg border border-sand-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs text-forest-600">
            From
            <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm text-forest-900" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            To
            <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm text-forest-900" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-forest-600">
            Product
            <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm text-forest-900" value={productCategory} onChange={(event) => setProductCategory(event.target.value)}>
              <option value="">All Products</option>
              <option value="egg">Eggs</option>
              <option value="bird">Birds</option>
            </select>
          </label>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-lg border border-sand-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <article>
            <p className="text-xs uppercase tracking-[0.16em] text-forest-500">Break-even Egg</p>
            <p className="mt-2 text-2xl font-semibold text-forest-900">
              {analytics.kpis.breakEvenPricePerEgg === null || analytics.kpis.breakEvenPricePerEgg === undefined ? "Pending" : currency(analytics.kpis.breakEvenPricePerEgg)}
            </p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-[0.16em] text-forest-500">Target Price</p>
            <p className="mt-2 text-2xl font-semibold text-forest-900">
              {analytics.kpis.targetPricePerEgg === null || analytics.kpis.targetPricePerEgg === undefined ? "Pending" : currency(analytics.kpis.targetPricePerEgg)}
            </p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-[0.16em] text-forest-500">Cost Basis</p>
            <p className="mt-2 text-lg font-semibold text-forest-900">{labelize(analytics.kpis.costBasisStatus)}</p>
            <p className="mt-1 text-xs text-forest-600">{analytics.kpis.costBasisSource}</p>
          </article>
          <article>
            <p className="text-xs uppercase tracking-[0.16em] text-forest-500">Egg Quality</p>
            <p className="mt-2 text-lg font-semibold text-forest-900">{(analytics.kpis.normalEggs ?? 0).toLocaleString()} normal</p>
            <p className="mt-1 text-xs text-forest-600">{(analytics.kpis.brokenEggs ?? 0).toLocaleString()} broken absorbed into cost</p>
          </article>
        </div>
        {analytics.pricingGuidance?.warnings?.length ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {analytics.pricingGuidance.warnings.join(" ")}
          </div>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          ["Today Revenue", analytics.kpis.todayRevenue],
          ["Paid", analytics.kpis.paid],
          ["Balance Due", analytics.kpis.balanceDue],
          ["Quantity Sold", analytics.kpis.quantity],
          ["Avg Price", analytics.kpis.averageSellingPrice],
          ["Est. Profit", analytics.kpis.estimatedProfit],
        ].map(([label, value]) => (
          <article key={label} className="rounded-lg border border-sand-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-forest-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-forest-900">{currency(Number(value))}</p>
          </article>
        ))}
      </div>

      {analytics.kpis.missingCostReasons.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {analytics.kpis.missingCostReasons.join(" ")}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-sand-200 bg-white p-5">
          <h3 className="text-base font-semibold text-forest-900">Daily revenue and quantity</h3>
          <ChartContainer config={{ revenue: { label: "Revenue", color: "#2f6f4e" }, quantity: { label: "Quantity", color: "#c9923e" } }} className="mt-4 h-72">
            <LineChart data={analytics.charts.daily}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="quantity" stroke="var(--color-quantity)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </section>

        <section className="rounded-lg border border-sand-200 bg-white p-5">
          <h3 className="text-base font-semibold text-forest-900">Weekly, monthly, quarterly revenue</h3>
          <ChartContainer config={{ weekly: { label: "Weekly", color: "#2f6f4e" }, monthly: { label: "Monthly", color: "#c9923e" }, quarterly: { label: "Quarterly", color: "#5f7ea7" } }} className="mt-4 h-72">
            <LineChart data={analytics.charts.weekly.map((row, index) => ({ ...row, monthly: analytics.charts.monthly[index]?.revenue ?? 0, quarterly: analytics.charts.quarterly[index]?.revenue ?? 0 }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="revenue" name="weekly" stroke="var(--color-weekly)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="monthly" stroke="var(--color-monthly)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="quarterly" stroke="var(--color-quarterly)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </section>

        <section className="rounded-lg border border-sand-200 bg-white p-5">
          <h3 className="text-base font-semibold text-forest-900">Profit and paid margin</h3>
          <ChartContainer config={{ estimatedProfit: { label: "Estimated Profit", color: "#2f6f4e" }, paidProfitMargin: { label: "Paid Margin %", color: "#a84f39" } }} className="mt-4 h-72">
            <LineChart data={analytics.charts.daily}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="estimatedProfit" stroke="var(--color-estimatedProfit)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="paidProfitMargin" stroke="var(--color-paidProfitMargin)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </section>

        <section className="rounded-lg border border-sand-200 bg-white p-5">
          <h3 className="text-base font-semibold text-forest-900">Product mix</h3>
          <ChartContainer config={{ revenue: { label: "Revenue", color: "#2f6f4e" } }} className="mt-4 h-72">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie data={analytics.charts.productMix} dataKey="revenue" nameKey="label" outerRadius={95}>
                {analytics.charts.productMix.map((entry, index) => (
                  <Cell key={entry.label} fill={index === 0 ? "#2f6f4e" : "#c9923e"} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </section>
      </div>

      <section className="rounded-lg border border-sand-200 bg-white p-5">
        <h3 className="text-base font-semibold text-forest-900">Flock and batch contribution</h3>
        <ChartContainer config={{ revenue: { label: "Revenue", color: "#2f6f4e" } }} className="mt-4 h-72">
          <BarChart data={analytics.charts.contribution}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </section>

      <section className="rounded-lg border border-sand-200 bg-white p-5">
        <h3 className="text-base font-semibold text-forest-900">Price tier margin</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Tier</th>
                <th className="px-2 py-2">Eggs Sold</th>
                <th className="px-2 py-2">Revenue</th>
                <th className="px-2 py-2">Margin / Egg</th>
                <th className="px-2 py-2">Tier Profit</th>
              </tr>
            </thead>
            <tbody>
              {(analytics.pricingGuidance?.tierSummary ?? []).length === 0 ? (
                <tr><td className="px-2 py-4 text-forest-600" colSpan={5}>No egg sales tiers in this range.</td></tr>
              ) : (
                (analytics.pricingGuidance?.tierSummary ?? []).map((tier) => (
                  <tr key={tier.tier} className="border-b border-sand-100">
                    <td className="px-2 py-2 font-medium text-forest-900">{tier.label}</td>
                    <td className="px-2 py-2 text-forest-700">{currency(tier.eggsSold)}</td>
                    <td className="px-2 py-2 text-forest-700">{currency(tier.revenue)}</td>
                    <td className="px-2 py-2 text-forest-700">{tier.marginPerEgg === null ? "Pending" : currency(tier.marginPerEgg)}</td>
                    <td className="px-2 py-2 text-forest-700">{tier.totalTierProfit === null ? "Pending" : currency(tier.totalTierProfit)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-sand-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-forest-900">Sales records</h3>
          <p className="text-xs text-forest-500">{loading ? "Loading..." : `${records.length} records`}</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-sand-200 text-left text-xs uppercase tracking-[0.1em] text-forest-600">
                <th className="px-2 py-2">Date</th>
                <th className="px-2 py-2">Product</th>
                <th className="px-2 py-2">Scope</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Gross</th>
                <th className="px-2 py-2">Paid</th>
                <th className="px-2 py-2">Balance</th>
                <th className="px-2 py-2">Customer</th>
                {canMutate ? <th className="px-2 py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td className="px-2 py-5 text-forest-600" colSpan={canMutate ? 9 : 8}>
                    {loading ? "Loading sales records..." : "No sales records found for this scope."}
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="border-b border-sand-100">
                    <td className="px-2 py-3 text-forest-700">{record.sale_date}</td>
                    <td className="px-2 py-3 font-medium text-forest-900">
                      {labelize(record.product_label)}
                      <span className="block text-xs font-normal text-forest-500">{labelize(record.product_category)}</span>
                    </td>
                    <td className="px-2 py-3 text-forest-700">
                      {batchName.get(record.batch_id ?? "") ?? flockName.get(record.flock_id ?? "") ?? farmName.get(record.farm_id ?? "") ?? branchName.get(record.branch_id ?? "") ?? "-"}
                    </td>
                    <td className="px-2 py-3 text-forest-700">{currency(record.quantity)} {record.unit}</td>
                    <td className="px-2 py-3 text-forest-700">{currency(record.gross_amount)}</td>
                    <td className="px-2 py-3 text-forest-700">{currency(record.paid_amount)}</td>
                    <td className="px-2 py-3 text-forest-700">{currency(record.balance_due)}</td>
                    <td className="px-2 py-3 text-forest-700">{record.customer_name ?? "-"}</td>
                    {canMutate ? (
                      <td className="px-2 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => openEdit(record)} className="rounded-lg border border-sand-200 p-2 text-forest-700" title="Edit sale">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => void remove(record)} className="rounded-lg border border-red-200 p-2 text-red-700" title="Delete sale">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-forest-900">{form.id ? "Edit sale" : "New daily sale"}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-sand-200 p-2 text-forest-700" title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="grid gap-1 text-xs text-forest-600">
                Date
                <input className="h-10 rounded-lg border border-sand-200 px-3 text-sm" type="date" value={form.sale_date} onChange={(event) => setForm((prev) => ({ ...prev, sale_date: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Category
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.product_category} onChange={(event) => setForm((prev) => ({ ...prev, product_category: event.target.value as "egg" | "bird", product_label: productLabels[event.target.value as "egg" | "bird"][0], unit: event.target.value === "egg" ? "tray" : "bird" }))}>
                  <option value="egg">Egg</option>
                  <option value="bird">Bird</option>
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
                      : "border-leaf-200 bg-leaf-50 text-leaf-700"
                }`}>
                  Price per egg: {currency(draftPricePerEgg)}. Break-even: {analytics.kpis.breakEvenPricePerEgg === null || analytics.kpis.breakEvenPricePerEgg === undefined ? "Pending" : currency(analytics.kpis.breakEvenPricePerEgg)}. Target: {analytics.kpis.targetPricePerEgg === null || analytics.kpis.targetPricePerEgg === undefined ? "Pending" : currency(analytics.kpis.targetPricePerEgg)}.
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
                Branch
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.branch_id} onChange={(event) => setForm((prev) => ({ ...prev, branch_id: event.target.value, farm_id: "", house_id: "", flock_id: "", batch_id: "" }))}>
                  <option value="">Select Branch</option>
                  {branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Farm
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.farm_id} onChange={(event) => setForm((prev) => ({ ...prev, farm_id: event.target.value, house_id: "", flock_id: "", batch_id: "" }))}>
                  <option value="">Select Farm</option>
                  {filteredFormFarms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                House
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.house_id} onChange={(event) => setForm((prev) => ({ ...prev, house_id: event.target.value, flock_id: "", batch_id: "" }))}>
                  <option value="">Optional House</option>
                  {filteredFormHouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Flock
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.flock_id} onChange={(event) => setForm((prev) => ({ ...prev, flock_id: event.target.value, batch_id: "" }))}>
                  <option value="">Optional Flock</option>
                  {filteredFormFlocks.map((item) => <option key={item.id} value={item.id}>{item.flock_code}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600">
                Batch
                <select className="h-10 rounded-lg border border-sand-200 px-3 text-sm" value={form.batch_id} onChange={(event) => setForm((prev) => ({ ...prev, batch_id: event.target.value }))}>
                  <option value="">Optional Batch</option>
                  {filteredFormBatches.map((item) => <option key={item.id} value={item.id}>{item.batch_code}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-forest-600 md:col-span-3">
                Notes
                <textarea className="min-h-20 rounded-lg border border-sand-200 px-3 py-2 text-sm" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="h-10 rounded-lg border border-sand-200 px-4 text-sm font-medium text-forest-700">Cancel</button>
              <button type="button" onClick={() => void submit()} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-forest-800 px-4 text-sm font-medium text-white disabled:opacity-60">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Sale"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
