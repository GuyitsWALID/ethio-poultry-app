import { NextRequest } from "next/server";

import {
  applySalesFilters,
  getSalesContext,
  hasScopedAccess,
  json,
  periodKey,
  supabaseAdmin,
  type DailySalesRecord,
} from "@/lib/sales";
import {
  buildTierSummary,
  eggUnitsSold,
  missingCostBasis,
  round,
  unitPricePerEgg,
  type EggCostBasis,
} from "@/lib/profitability";

type AggregateRow = {
  label: string;
  revenue: number;
  paid: number;
  balanceDue: number;
  quantity: number;
  estimatedCost: number;
  estimatedProfit: number;
  paidProfitMargin: number | null;
};

function emptyAggregate(label: string): AggregateRow {
  return {
    label,
    revenue: 0,
    paid: 0,
    balanceDue: 0,
    quantity: 0,
    estimatedCost: 0,
    estimatedProfit: 0,
    paidProfitMargin: null,
  };
}

function aggregateByPeriod(
  records: DailySalesRecord[],
  period: "day" | "week" | "month" | "quarter",
  costForRecord: (record: DailySalesRecord) => number
) {
  const map = new Map<string, AggregateRow>();
  records.forEach((record) => {
    const key = periodKey(record.sale_date, period);
    const current = map.get(key) ?? emptyAggregate(key);
    const cost = costForRecord(record);
    current.revenue += record.gross_amount;
    current.paid += record.paid_amount;
    current.balanceDue += record.balance_due;
    current.quantity += record.quantity;
    current.estimatedCost += cost;
    current.estimatedProfit += record.gross_amount - cost;
    current.paidProfitMargin = current.paid > 0 ? round(((current.paid - current.estimatedCost) / current.paid) * 100) : null;
    map.set(key, current);
  });

  return Array.from(map.values())
    .sort((a, b) => (a.label < b.label ? -1 : 1))
    .map((row) => ({
      ...row,
      revenue: round(row.revenue),
      paid: round(row.paid),
      balanceDue: round(row.balanceDue),
      quantity: round(row.quantity),
      estimatedCost: round(row.estimatedCost),
      estimatedProfit: round(row.estimatedProfit),
    }));
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: "You do not have access to sales analytics." }, 403);

    const params = request.nextUrl.searchParams;
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 89);
    const dateFrom = params.get("date_from") ?? defaultFrom.toISOString().slice(0, 10);
    const dateTo = params.get("date_to") ?? today.toISOString().slice(0, 10);

    const [salesRes, dailyRes, batchRes, inventoryRes, stockRes, flockRes, farmRes, lockedPeriodsRes, costEntriesRes] = await Promise.all([
      supabaseAdmin
        .from("daily_sales_records")
        .select("*")
        .eq("org_id", ctx.orgId)
        .gte("sale_date", dateFrom)
        .lte("sale_date", dateTo)
        .order("sale_date", { ascending: true }),
      supabaseAdmin
        .from("daily_farm_records")
        .select("record_date, flock_id, normal_eggs, broken_eggs, total_eggs, feed_intake_grams")
        .eq("org_id", ctx.orgId)
        .gte("record_date", dateFrom)
        .lte("record_date", dateTo),
      supabaseAdmin
        .from("batches")
        .select("id, batch_code, total_count, purchase_cost_per_bird, transport_cost, other_cost, total_batch_cost")
        .eq("org_id", ctx.orgId),
      supabaseAdmin.from("inventory_items").select("id, category, unit_cost").eq("org_id", ctx.orgId).limit(500),
      supabaseAdmin.from("stock_ledger").select("item_id, quantity, transaction_type, unit_cost, flock_id").eq("org_id", ctx.orgId).limit(5000),
      supabaseAdmin.from("flocks").select("id, flock_code").eq("org_id", ctx.orgId),
      supabaseAdmin.from("farms").select("id, name").eq("org_id", ctx.orgId),
      supabaseAdmin
        .from("monthly_cost_periods")
        .select("*")
        .eq("org_id", ctx.orgId)
        .eq("status", "locked")
        .lte("period_start", dateTo)
        .gte("period_end", dateFrom)
        .order("period_start", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("cost_entries")
        .select("amount, category, entry_date, branch_id, farm_id, house_id, flock_id, batch_id")
        .eq("org_id", ctx.orgId)
        .gte("entry_date", dateFrom)
        .lte("entry_date", dateTo)
        .limit(5000),
    ]);

    const firstError =
      salesRes.error ??
      dailyRes.error ??
      batchRes.error ??
      inventoryRes.error ??
      stockRes.error ??
      flockRes.error ??
      farmRes.error ??
      lockedPeriodsRes.error ??
      costEntriesRes.error;
    if (firstError) return json({ error: firstError.message }, 500);

    const scopedSales = ((salesRes.data ?? []) as DailySalesRecord[]).filter((record) => hasScopedAccess(ctx, record));
    const records = applySalesFilters(scopedSales, params);
    const scopedFlockIds = new Set(records.map((record) => record.flock_id).filter(Boolean) as string[]);
    const scopedBatchIds = new Set(records.map((record) => record.batch_id).filter(Boolean) as string[]);
    const scopedBranchIds = new Set(records.map((record) => record.branch_id).filter(Boolean) as string[]);
    const scopedFarmIds = new Set(records.map((record) => record.farm_id).filter(Boolean) as string[]);
    const scopedHouseIds = new Set(records.map((record) => record.house_id).filter(Boolean) as string[]);
    const scopeMatches = (row: {
      branch_id?: string | null;
      farm_id?: string | null;
      house_id?: string | null;
      flock_id?: string | null;
      batch_id?: string | null;
    }) => {
      if (scopedFlockIds.size && row.flock_id && !scopedFlockIds.has(row.flock_id)) return false;
      if (scopedBatchIds.size && row.batch_id && !scopedBatchIds.has(row.batch_id)) return false;
      if (scopedHouseIds.size && row.house_id && !scopedHouseIds.has(row.house_id)) return false;
      if (scopedFarmIds.size && row.farm_id && !scopedFarmIds.has(row.farm_id)) return false;
      if (scopedBranchIds.size && row.branch_id && !scopedBranchIds.has(row.branch_id)) return false;
      return true;
    };

    const feedItemIds = new Set((inventoryRes.data ?? []).filter((item) => item.category === "feed").map((item) => item.id));
    const costedInventoryItemIds = new Set(
      (inventoryRes.data ?? [])
        .filter((item) => ["feed", "medicine", "vaccine", "vitamin"].includes(item.category))
        .map((item) => item.id)
    );
    const feedUnitCosts = (inventoryRes.data ?? [])
      .filter((item) => item.category === "feed" && (item.unit_cost ?? 0) > 0)
      .map((item) => item.unit_cost ?? 0);
    const averageFeedUnitCost = feedUnitCosts.length ? feedUnitCosts.reduce((sum, cost) => sum + cost, 0) / feedUnitCosts.length : 0;
    const issuedFeedCost = (stockRes.data ?? []).reduce((sum, row) => {
      if (!feedItemIds.has(row.item_id)) return sum;
      if (row.transaction_type !== "issue" && row.transaction_type !== "transfer_out") return sum;
      if (scopedFlockIds.size && row.flock_id && !scopedFlockIds.has(row.flock_id)) return sum;
      return sum + row.quantity * row.unit_cost;
    }, 0);
    const issuedInventoryCost = (stockRes.data ?? []).reduce((sum, row) => {
      if (!costedInventoryItemIds.has(row.item_id)) return sum;
      if (row.transaction_type !== "issue" && row.transaction_type !== "transfer_out") return sum;
      if (scopedFlockIds.size && row.flock_id && !scopedFlockIds.has(row.flock_id)) return sum;
      return sum + row.quantity * row.unit_cost;
    }, 0);
    const feedKg = (dailyRes.data ?? []).reduce((sum, row) => {
      if (scopedFlockIds.size && row.flock_id && !scopedFlockIds.has(row.flock_id)) return sum;
      return sum + (row.feed_intake_grams ?? 0) / 1000;
    }, 0);
    const estimatedFeedCost = feedKg * averageFeedUnitCost;
    const feedCost = issuedFeedCost > 0 ? issuedFeedCost : estimatedFeedCost;
    const normalEggs = (dailyRes.data ?? []).reduce((sum, row) => {
      if (scopedFlockIds.size && row.flock_id && !scopedFlockIds.has(row.flock_id)) return sum;
      return sum + (row.normal_eggs ?? row.total_eggs ?? 0);
    }, 0);
    const brokenEggs = (dailyRes.data ?? []).reduce((sum, row) => {
      if (scopedFlockIds.size && row.flock_id && !scopedFlockIds.has(row.flock_id)) return sum;
      return sum + (row.broken_eggs ?? 0);
    }, 0);
    const overheadCost = (costEntriesRes.data ?? [])
      .filter(scopeMatches)
      .reduce((sum, row) => sum + (row.amount ?? 0), 0);

    const lockedPeriod = (lockedPeriodsRes.data ?? [])
      .filter(scopeMatches)
      .sort((a, b) => {
        const specificity =
          Number(Boolean(b.flock_id)) +
          Number(Boolean(b.batch_id)) +
          Number(Boolean(b.house_id)) +
          Number(Boolean(b.farm_id)) +
          Number(Boolean(b.branch_id)) -
          (Number(Boolean(a.flock_id)) +
            Number(Boolean(a.batch_id)) +
            Number(Boolean(a.house_id)) +
            Number(Boolean(a.farm_id)) +
            Number(Boolean(a.branch_id)));
        if (specificity !== 0) return specificity;
        return a.period_start < b.period_start ? 1 : -1;
      })[0];
    const rollingAbsorbedCost = (issuedInventoryCost > 0 ? issuedInventoryCost : feedCost) + overheadCost;
    const costBasis: EggCostBasis = lockedPeriod?.base_cost_per_egg
      ? {
          status: "locked",
          baseCostPerEgg: Number(lockedPeriod.base_cost_per_egg),
          targetMarginPerEgg: Number(lockedPeriod.target_margin_per_egg ?? 0),
          targetPricePerEgg: Number(lockedPeriod.base_cost_per_egg) + Number(lockedPeriod.target_margin_per_egg ?? 0),
          normalEggs: Number(lockedPeriod.total_normal_eggs ?? 0),
          brokenEggs: Number(lockedPeriod.total_broken_eggs ?? 0),
          absorbedCost: Number(lockedPeriod.total_absorbed_cost ?? 0),
          sourceLabel: `Locked ${lockedPeriod.period_start} to ${lockedPeriod.period_end}`,
          missingCostReasons: [],
        }
      : normalEggs > 0 && rollingAbsorbedCost > 0
        ? {
            status: "rolling_estimate",
            baseCostPerEgg: rollingAbsorbedCost / normalEggs,
            targetMarginPerEgg: Math.max((rollingAbsorbedCost / normalEggs) * 0.1, 0.5),
            targetPricePerEgg: rollingAbsorbedCost / normalEggs + Math.max((rollingAbsorbedCost / normalEggs) * 0.1, 0.5),
            normalEggs,
            brokenEggs,
            absorbedCost: rollingAbsorbedCost,
            sourceLabel: "Rolling estimate",
            missingCostReasons: [],
          }
        : missingCostBasis();
    const costPerEgg = costBasis.baseCostPerEgg;

    const costPerBirdByBatch = new Map<string, number>();
    (batchRes.data ?? []).forEach((batch) => {
      if (scopedBatchIds.size && !scopedBatchIds.has(batch.id)) return;
      const birdCount = batch.total_count ?? 0;
      const fallback =
        (batch.purchase_cost_per_bird ?? 0) * birdCount + (batch.transport_cost ?? 0) + (batch.other_cost ?? 0);
      const totalCost = batch.total_batch_cost ?? fallback;
      if (birdCount > 0 && totalCost > 0) costPerBirdByBatch.set(batch.id, totalCost / birdCount);
    });

    const costForRecord = (record: DailySalesRecord) => {
      if (record.product_category === "egg" && costPerEgg) return eggUnitsSold(record) * costPerEgg;
      if (record.product_category === "bird" && record.batch_id) {
        return record.quantity * (costPerBirdByBatch.get(record.batch_id) ?? 0);
      }
      return 0;
    };

    const totalRevenue = records.reduce((sum, record) => sum + record.gross_amount, 0);
    const totalPaid = records.reduce((sum, record) => sum + record.paid_amount, 0);
    const totalBalance = records.reduce((sum, record) => sum + record.balance_due, 0);
    const totalQuantity = records.reduce((sum, record) => sum + record.quantity, 0);
    const estimatedCost = records.reduce((sum, record) => sum + costForRecord(record), 0);
    const estimatedProfit = totalRevenue - estimatedCost;
    const eggRecords = records.filter((record) => record.product_category === "egg");
    const belowTargetCount = eggRecords.filter((record) => {
      if (!costBasis.targetPricePerEgg) return false;
      return unitPricePerEgg(record) < costBasis.targetPricePerEgg;
    }).length;
    const belowBreakEvenCount = eggRecords.filter((record) => {
      if (!costBasis.baseCostPerEgg) return false;
      return unitPricePerEgg(record) < costBasis.baseCostPerEgg;
    }).length;
    const missingCostReasons = [
      ...costBasis.missingCostReasons,
      costBasis.status === "rolling_estimate" && records.some((record) => record.product_category === "egg")
        ? "Egg margin is using rolling cost because no locked monthly cost period exists for this range."
        : null,
      costBasis.status === "missing" && records.some((record) => record.product_category === "egg")
        ? "Egg margin is unavailable because normal egg totals or absorbed costs are incomplete."
        : null,
      records.some((record) => record.product_category === "bird" && (!record.batch_id || !costPerBirdByBatch.has(record.batch_id)))
        ? "Bird margin is estimated because one or more sales are missing batch cost signals."
        : null,
    ].filter(Boolean);

    const productMix = Array.from(
      records.reduce((map, record) => {
        const current = map.get(record.product_category) ?? { label: record.product_category, revenue: 0, quantity: 0 };
        current.revenue += record.gross_amount;
        current.quantity += record.quantity;
        map.set(record.product_category, current);
        return map;
      }, new Map<string, { label: string; revenue: number; quantity: number }>())
    ).map(([, value]) => ({ ...value, revenue: round(value.revenue), quantity: round(value.quantity) }));

    const flockNames = new Map((flockRes.data ?? []).map((flock) => [flock.id, flock.flock_code]));
    const farmNames = new Map((farmRes.data ?? []).map((farm) => [farm.id, farm.name]));
    const contribution = Array.from(
      records.reduce((map, record) => {
        const id = record.batch_id ?? record.flock_id ?? record.farm_id ?? "unassigned";
        const label =
          (record.flock_id && flockNames.get(record.flock_id)) ||
          (record.farm_id && farmNames.get(record.farm_id)) ||
          "Unassigned";
        const current = map.get(id) ?? { id, label, revenue: 0, quantity: 0 };
        current.revenue += record.gross_amount;
        current.quantity += record.quantity;
        map.set(id, current);
        return map;
      }, new Map<string, { id: string; label: string; revenue: number; quantity: number }>())
    )
      .map(([, value]) => ({ ...value, revenue: round(value.revenue), quantity: round(value.quantity) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return json({
      filters: { dateFrom, dateTo },
      kpis: {
        todayRevenue: round(records.filter((record) => record.sale_date === today.toISOString().slice(0, 10)).reduce((sum, record) => sum + record.gross_amount, 0)),
        revenue: round(totalRevenue),
        paid: round(totalPaid),
        balanceDue: round(totalBalance),
        quantity: round(totalQuantity),
        averageSellingPrice: totalQuantity > 0 ? round(totalRevenue / totalQuantity) : 0,
        estimatedCost: round(estimatedCost),
        estimatedProfit: round(estimatedProfit),
        actualPaidMargin: totalPaid > 0 ? round(((totalPaid - estimatedCost) / totalPaid) * 100) : null,
        marginStatus: costBasis.status === "locked" && !missingCostReasons.length ? "tracked" : "estimated",
        costBasisStatus: costBasis.status,
        breakEvenPricePerEgg: costBasis.baseCostPerEgg === null ? null : round(costBasis.baseCostPerEgg, 4),
        targetPricePerEgg: costBasis.targetPricePerEgg === null ? null : round(costBasis.targetPricePerEgg, 4),
        targetMarginPerEgg: round(costBasis.targetMarginPerEgg, 4),
        normalEggs: costBasis.normalEggs,
        brokenEggs: costBasis.brokenEggs,
        absorbedCost: round(costBasis.absorbedCost),
        costBasisSource: costBasis.sourceLabel,
        belowTargetCount,
        belowBreakEvenCount,
        missingCostReasons,
      },
      pricingGuidance: {
        costBasis: {
          ...costBasis,
          baseCostPerEgg: costBasis.baseCostPerEgg === null ? null : round(costBasis.baseCostPerEgg, 4),
          targetPricePerEgg: costBasis.targetPricePerEgg === null ? null : round(costBasis.targetPricePerEgg, 4),
          targetMarginPerEgg: round(costBasis.targetMarginPerEgg, 4),
          absorbedCost: round(costBasis.absorbedCost),
        },
        tierSummary: buildTierSummary(records, costBasis),
        warnings: [
          belowBreakEvenCount > 0 ? `${belowBreakEvenCount} egg sale(s) are below break-even.` : null,
          belowTargetCount > 0 ? `${belowTargetCount} egg sale(s) are below target margin.` : null,
          costBasis.status === "rolling_estimate" ? "Pricing guidance is advisory until the monthly cost period is locked." : null,
        ].filter(Boolean),
      },
      charts: {
        daily: aggregateByPeriod(records, "day", costForRecord).map((row) => ({ ...row })),
        weekly: aggregateByPeriod(records, "week", costForRecord),
        monthly: aggregateByPeriod(records, "month", costForRecord),
        quarterly: aggregateByPeriod(records, "quarter", costForRecord),
        productMix,
        contribution,
        salesTiers: buildTierSummary(records, costBasis),
      },
    });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
