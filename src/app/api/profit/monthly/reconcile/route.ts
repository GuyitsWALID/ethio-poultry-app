import { NextRequest } from "next/server";

import { getSalesContext, json, supabaseAdmin } from "@/lib/sales";
import { round } from "@/lib/profitability";

const INVENTORY_COST_CATEGORIES = ["feed", "medicine", "vaccine", "vitamin", "supplement", "packaging"] as const;
const INVENTORY_COST_CATEGORY_SET = new Set<string>(INVENTORY_COST_CATEGORIES);

type ProfitScope = {
  branch_id: string | null;
  farm_id: string | null;
  house_id: string | null;
  flock_id: string | null;
  batch_id: string | null;
};

type ScopedRow = Partial<ProfitScope>;
type FarmScopeRow = { id: string; branch_id: string };
type HouseScopeRow = { id: string; farm_id: string; branch_id: string };
type FlockScopeRow = { id: string; farm_id: string; house_id: string; batch_id: string | null };
type BatchScopeRow = {
  id: string;
  branch_id: string;
  farm_id: string | null;
  house_id: string | null;
  total_count: number | null;
  purchase_cost_per_bird: number | null;
  transport_cost: number | null;
  other_cost: number | null;
  total_batch_cost: number | null;
};

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberFrom(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function monthEnd(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

type NullableScopeQuery = {
  eq: (column: string, value: string) => NullableScopeQuery;
  is: (column: string, value: null) => NullableScopeQuery;
};

function applyNullableScope<T>(query: T, scope: ProfitScope) {
  let next = query as NullableScopeQuery;
  Object.entries(scope).forEach(([key, value]) => {
    next = value ? next.eq(key, value) : next.is(key, null);
  });
  return next as T;
}

function isScoped(scope: ProfitScope) {
  return Object.values(scope).some(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (ctx.role !== "ceo") {
      return json({ error: "Only the organization CEO can reconcile monthly profit periods." }, 403);
    }

    const body = await request.json();
    const periodStart = cleanText(body.period_start);
    const periodEnd = cleanText(body.period_end) ?? (periodStart ? monthEnd(periodStart) : null);
    if (!periodStart || !periodEnd) return json({ error: "Period start and end are required." }, 400);
    if (periodEnd < periodStart) return json({ error: "Period end cannot be before period start." }, 400);

    const requestedScope: ProfitScope = {
      branch_id: cleanText(body.branch_id),
      farm_id: cleanText(body.farm_id),
      house_id: cleanText(body.house_id),
      flock_id: cleanText(body.flock_id),
      batch_id: cleanText(body.batch_id),
    };
    const targetMarginPerEgg = numberFrom(body.target_margin_per_egg, 0);
    if (targetMarginPerEgg < 0) return json({ error: "Target margin cannot be negative." }, 400);
    const lockPeriod = Boolean(body.lock);

    const [branchRes, farmRes, houseRes, flockRes, batchRes] = await Promise.all([
      supabaseAdmin.from("branches").select("id").eq("org_id", ctx.orgId).limit(10000),
      supabaseAdmin.from("farms").select("id, branch_id").eq("org_id", ctx.orgId).limit(10000),
      supabaseAdmin.from("houses").select("id, farm_id, branch_id").eq("org_id", ctx.orgId).limit(10000),
      supabaseAdmin.from("flocks").select("id, farm_id, house_id, batch_id").eq("org_id", ctx.orgId).limit(10000),
      supabaseAdmin
        .from("batches")
        .select("id, branch_id, farm_id, house_id, total_count, purchase_cost_per_bird, transport_cost, other_cost, total_batch_cost")
        .eq("org_id", ctx.orgId)
        .limit(10000),
    ]);
    const scopeError = branchRes.error ?? farmRes.error ?? houseRes.error ?? flockRes.error ?? batchRes.error;
    if (scopeError) return json({ error: scopeError.message }, 500);

    const farms = (farmRes.data ?? []) as FarmScopeRow[];
    const houses = (houseRes.data ?? []) as HouseScopeRow[];
    const flocks = (flockRes.data ?? []) as FlockScopeRow[];
    const batches = (batchRes.data ?? []) as BatchScopeRow[];
    const farmMap = new Map(farms.map((row) => [row.id, row]));
    const houseMap = new Map(houses.map((row) => [row.id, row]));
    const flockMap = new Map(flocks.map((row) => [row.id, row]));
    const batchMap = new Map(batches.map((row) => [row.id, row]));

    const scope: ProfitScope = { ...requestedScope };
    if (scope.branch_id && !(branchRes.data ?? []).some((branch) => branch.id === scope.branch_id)) {
      return json({ error: "Branch is not available in this organization." }, 400);
    }
    if (scope.flock_id) {
      const flock = flockMap.get(scope.flock_id);
      if (!flock) return json({ error: "Flock is not available in this organization." }, 400);
      if (scope.farm_id && scope.farm_id !== flock.farm_id || scope.house_id && scope.house_id !== flock.house_id || scope.batch_id && scope.batch_id !== flock.batch_id) {
        return json({ error: "Selected flock, farm, house, and batch do not agree." }, 400);
      }
      scope.farm_id = flock.farm_id;
      scope.house_id = flock.house_id;
      scope.batch_id = flock.batch_id;
    }
    if (scope.batch_id) {
      const batch = batchMap.get(scope.batch_id);
      if (!batch) return json({ error: "Batch is not available in this organization." }, 400);
      if (scope.farm_id && batch.farm_id && scope.farm_id !== batch.farm_id || scope.house_id && batch.house_id && scope.house_id !== batch.house_id) {
        return json({ error: "Selected batch, farm, and house do not agree." }, 400);
      }
      scope.farm_id = scope.farm_id ?? batch.farm_id;
      scope.house_id = scope.house_id ?? batch.house_id;
      scope.branch_id = scope.branch_id ?? batch.branch_id;
    }
    if (scope.house_id) {
      const house = houseMap.get(scope.house_id);
      if (!house) return json({ error: "House is not available in this organization." }, 400);
      if (scope.farm_id && scope.farm_id !== house.farm_id || scope.branch_id && scope.branch_id !== house.branch_id) {
        return json({ error: "Selected house, farm, and branch do not agree." }, 400);
      }
      scope.farm_id = house.farm_id;
      scope.branch_id = house.branch_id;
    }
    if (scope.farm_id) {
      const farm = farmMap.get(scope.farm_id);
      if (!farm) return json({ error: "Farm is not available in this organization." }, 400);
      if (scope.branch_id && scope.branch_id !== farm.branch_id) {
        return json({ error: "Selected farm does not belong to the selected branch." }, 400);
      }
      scope.branch_id = farm.branch_id;
    }

    const normalizeScope = (row: ScopedRow): ProfitScope => {
      const normalized: ProfitScope = {
        branch_id: row.branch_id ?? null,
        farm_id: row.farm_id ?? null,
        house_id: row.house_id ?? null,
        flock_id: row.flock_id ?? null,
        batch_id: row.batch_id ?? null,
      };
      if (normalized.flock_id) {
        const flock = flockMap.get(normalized.flock_id);
        if (flock) {
          normalized.farm_id = normalized.farm_id ?? flock.farm_id;
          normalized.house_id = normalized.house_id ?? flock.house_id;
          normalized.batch_id = normalized.batch_id ?? flock.batch_id;
        }
      }
      if (normalized.batch_id) {
        const batch = batchMap.get(normalized.batch_id);
        if (batch) {
          normalized.branch_id = normalized.branch_id ?? batch.branch_id;
          normalized.farm_id = normalized.farm_id ?? batch.farm_id;
          normalized.house_id = normalized.house_id ?? batch.house_id;
        }
      }
      if (normalized.house_id) {
        const house = houseMap.get(normalized.house_id);
        if (house) {
          normalized.branch_id = normalized.branch_id ?? house.branch_id;
          normalized.farm_id = normalized.farm_id ?? house.farm_id;
        }
      }
      if (normalized.farm_id) normalized.branch_id = normalized.branch_id ?? farmMap.get(normalized.farm_id)?.branch_id ?? null;
      return normalized;
    };

    const matchesScope = (row: ScopedRow) => {
      if (!isScoped(scope)) return true;
      const normalized = normalizeScope(row);
      return (Object.entries(scope) as Array<[keyof ProfitScope, string | null]>).every(
        ([key, value]) => !value || normalized[key] === value
      );
    };

    const isCompatibleSharedCost = (row: ScopedRow) => {
      if (!isScoped(scope) || matchesScope(row)) return false;
      const normalized = normalizeScope(row);
      return (Object.entries(normalized) as Array<[keyof ProfitScope, string | null]>).every(
        ([key, value]) => !value || !scope[key] || scope[key] === value
      );
    };

    const [dailyRes, salesRes, inventoryRes, stockRes, costEntryRes] = await Promise.all([
      supabaseAdmin
        .from("daily_farm_records")
        .select("normal_eggs, broken_eggs, total_eggs, flock_id")
        .eq("org_id", ctx.orgId)
        .is("voided_at",null)
        .gte("record_date", periodStart)
        .lte("record_date", periodEnd)
        .limit(10000),
      supabaseAdmin
        .from("daily_sales_records")
        .select("gross_amount, paid_amount, balance_due, quantity, product_category, branch_id, farm_id, house_id, flock_id, batch_id")
        .eq("org_id", ctx.orgId)
        .is("voided_at",null)
        .gte("sale_date", periodStart)
        .lte("sale_date", periodEnd)
        .limit(10000),
      supabaseAdmin.from("inventory_items").select("id, category").eq("org_id", ctx.orgId).limit(10000),
      supabaseAdmin
        .from("stock_ledger")
        .select("item_id, quantity, transaction_type, unit_cost, branch_id, farm_id, house_id, flock_id, batch_id")
        .eq("org_id", ctx.orgId)
        .in("transaction_type", ["issue", "return"])
        .gte("transaction_date", periodStart)
        .lte("transaction_date", periodEnd)
        .limit(10000),
      supabaseAdmin
        .from("cost_entries")
        .select("amount, category, branch_id, farm_id, house_id, flock_id, batch_id")
        .eq("org_id", ctx.orgId)
        .gte("entry_date", periodStart)
        .lte("entry_date", periodEnd)
        .limit(10000),
    ]);
    const firstError = dailyRes.error ?? salesRes.error ?? inventoryRes.error ?? stockRes.error ?? costEntryRes.error;
    if (firstError) return json({ error: firstError.message }, 500);

    const scopedDaily = (dailyRes.data ?? []).filter((row) => matchesScope({ flock_id: row.flock_id }));
    const scopedSales = (salesRes.data ?? []).filter(matchesScope);
    const scopedStock = (stockRes.data ?? []).filter(matchesScope);
    const scopedCosts = (costEntryRes.data ?? []).filter(matchesScope);
    const unallocatedCost = (costEntryRes.data ?? [])
      .filter(isCompatibleSharedCost)
      .reduce((sum, row) => sum + numberFrom(row.amount), 0);

    const normalEggs = scopedDaily.reduce((sum, row) => sum + (row.normal_eggs ?? row.total_eggs ?? 0), 0);
    const brokenEggs = scopedDaily.reduce((sum, row) => sum + (row.broken_eggs ?? 0), 0);
    const revenue = scopedSales.reduce((sum, row) => sum + numberFrom(row.gross_amount), 0);
    const paidRevenue = scopedSales.reduce((sum, row) => sum + numberFrom(row.paid_amount), 0);
    const balanceDue = scopedSales.reduce((sum, row) => sum + numberFrom(row.balance_due), 0);

    const itemCategoryMap = new Map((inventoryRes.data ?? []).map((item) => [item.id, String(item.category)]));
    const issuedCostByCategory = new Map<string, number>();
    scopedStock.forEach((row) => {
      const category = itemCategoryMap.get(row.item_id);
      if (!category || !INVENTORY_COST_CATEGORY_SET.has(category)) return;
      const consumptionDelta = numberFrom(row.quantity) * numberFrom(row.unit_cost) * (row.transaction_type === "return" ? -1 : 1);
      issuedCostByCategory.set(category, (issuedCostByCategory.get(category) ?? 0) + consumptionDelta);
    });

    const manualInventoryCostByCategory = new Map<string, number>();
    let overheadCost = 0;
    scopedCosts.forEach((row) => {
      const category = String(row.category);
      const amount = numberFrom(row.amount);
      if (INVENTORY_COST_CATEGORY_SET.has(category)) {
        manualInventoryCostByCategory.set(category, (manualInventoryCostByCategory.get(category) ?? 0) + amount);
      } else {
        overheadCost += amount;
      }
    });

    let directInventoryCost = 0;
    let excludedDuplicateCost = 0;
    INVENTORY_COST_CATEGORIES.forEach((category) => {
      const issued = issuedCostByCategory.get(category) ?? 0;
      const manual = manualInventoryCostByCategory.get(category) ?? 0;
      directInventoryCost += issued > 0 ? issued : manual;
      if (issued > 0) excludedDuplicateCost += manual;
    });

    let birdCogs = 0;
    let missingBirdCostCount = 0;
    scopedSales.filter((row) => row.product_category === "bird").forEach((row) => {
      const batch = row.batch_id ? batchMap.get(row.batch_id) : null;
      const birdCount = batch?.total_count ?? 0;
      const fallback = batch
        ? (batch.purchase_cost_per_bird ?? 0) * birdCount + (batch.transport_cost ?? 0) + (batch.other_cost ?? 0)
        : 0;
      const totalBatchCost = batch?.total_batch_cost ?? fallback;
      if (!batch || birdCount <= 0 || totalBatchCost <= 0) {
        missingBirdCostCount += 1;
        return;
      }
      birdCogs += numberFrom(row.quantity) * (totalBatchCost / birdCount);
    });

    const eggProductionCost = directInventoryCost + overheadCost;
    const absorbedCost = eggProductionCost + birdCogs;
    const operatingProfit = revenue - absorbedCost;
    const cashOperatingSurplus = paidRevenue - absorbedCost;
    const baseCostPerEgg = normalEggs > 0 ? eggProductionCost / normalEggs : null;
    const warnings = [
      unallocatedCost > 0 ? `${round(unallocatedCost)} in compatible shared costs is not allocated to this scope and is excluded from profit.` : null,
      excludedDuplicateCost > 0 ? `${round(excludedDuplicateCost)} in manual inventory-category costs was excluded to avoid double counting issued stock.` : null,
      missingBirdCostCount > 0 ? `${missingBirdCostCount} bird sale(s) have no usable batch cost and therefore understate COGS.` : null,
      scopedSales.some((row) => row.product_category === "egg") && normalEggs === 0 ? "Egg sales exist, but no normal-egg production was recorded for the period." : null,
      scopedSales.some((row) => row.product_category === "egg") && scopedSales.some((row) => row.product_category === "bird")
        ? "Mixed egg and bird activity: operating profit is complete, but shared overhead remains assigned to the egg cost basis."
        : null,
      directInventoryCost === 0 ? "No consumed inventory cost was found for this period and scope." : null,
    ].filter((value): value is string => Boolean(value));

    const payload = {
      org_id: ctx.orgId,
      ...scope,
      period_start: periodStart,
      period_end: periodEnd,
      status: lockPeriod ? "locked" : "draft",
      total_normal_eggs: normalEggs,
      total_broken_eggs: brokenEggs,
      total_revenue: round(revenue),
      total_paid_revenue: round(paidRevenue),
      total_balance_due: round(balanceDue),
      direct_inventory_cost: round(directInventoryCost),
      bird_cogs: round(birdCogs),
      overhead_cost: round(overheadCost),
      unallocated_cost: round(unallocatedCost),
      excluded_duplicate_cost: round(excludedDuplicateCost),
      total_absorbed_cost: round(absorbedCost),
      operating_profit: round(operatingProfit),
      cash_operating_surplus: round(cashOperatingSurplus),
      reconciliation_warnings: warnings,
      base_cost_per_egg: baseCostPerEgg === null ? null : round(baseCostPerEgg, 4),
      target_margin_per_egg: targetMarginPerEgg,
      locked_by: lockPeriod ? ctx.userId : null,
      notes: cleanText(body.notes),
    };

    const existingQuery = applyNullableScope(
      supabaseAdmin
        .from("monthly_cost_periods")
        .select("id, status")
        .eq("org_id", ctx.orgId)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd),
      scope
    );
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) return json({ error: existingError.message }, 500);
    if (existing?.status === "locked") {
      return json({ error: "This monthly profit period is locked and cannot be recalculated." }, 409);
    }

    const writeQuery = existing?.id
      ? supabaseAdmin.from("monthly_cost_periods").update(payload).eq("id", existing.id)
      : supabaseAdmin.from("monthly_cost_periods").insert(payload);
    const { data, error } = await writeQuery.select("*").single();
    if (error) return json({ error: error.message }, 500);

    return json({ period: data, summary: payload });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
