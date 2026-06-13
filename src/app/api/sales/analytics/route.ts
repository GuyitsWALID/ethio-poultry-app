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

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

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

function eggUnitsSold(record: DailySalesRecord) {
  const unit = record.unit.toLowerCase();
  if (unit.includes("tray")) return record.quantity * 30;
  if (unit.includes("crate")) return record.quantity * 360;
  return record.quantity;
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

    const [salesRes, dailyRes, batchRes, inventoryRes, stockRes, flockRes, farmRes] = await Promise.all([
      supabaseAdmin
        .from("daily_sales_records")
        .select("*")
        .eq("org_id", ctx.orgId)
        .gte("sale_date", dateFrom)
        .lte("sale_date", dateTo)
        .order("sale_date", { ascending: true }),
      supabaseAdmin
        .from("daily_farm_records")
        .select("record_date, flock_id, total_eggs, feed_intake_grams")
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
    ]);

    const firstError =
      salesRes.error ?? dailyRes.error ?? batchRes.error ?? inventoryRes.error ?? stockRes.error ?? flockRes.error ?? farmRes.error;
    if (firstError) return json({ error: firstError.message }, 500);

    const scopedSales = ((salesRes.data ?? []) as DailySalesRecord[]).filter((record) => hasScopedAccess(ctx, record));
    const records = applySalesFilters(scopedSales, params);
    const scopedFlockIds = new Set(records.map((record) => record.flock_id).filter(Boolean) as string[]);
    const scopedBatchIds = new Set(records.map((record) => record.batch_id).filter(Boolean) as string[]);

    const feedItemIds = new Set((inventoryRes.data ?? []).filter((item) => item.category === "feed").map((item) => item.id));
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
    const feedKg = (dailyRes.data ?? []).reduce((sum, row) => {
      if (scopedFlockIds.size && row.flock_id && !scopedFlockIds.has(row.flock_id)) return sum;
      return sum + (row.feed_intake_grams ?? 0) / 1000;
    }, 0);
    const estimatedFeedCost = feedKg * averageFeedUnitCost;
    const feedCost = issuedFeedCost > 0 ? issuedFeedCost : estimatedFeedCost;
    const totalEggs = (dailyRes.data ?? []).reduce((sum, row) => {
      if (scopedFlockIds.size && row.flock_id && !scopedFlockIds.has(row.flock_id)) return sum;
      return sum + (row.total_eggs ?? 0);
    }, 0);
    const costPerEgg = totalEggs > 0 && feedCost > 0 ? feedCost / totalEggs : null;

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
    const missingCostReasons = [
      costPerEgg === null && records.some((record) => record.product_category === "egg")
        ? "Egg margin is estimated because feed cost or production totals are incomplete."
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
        marginStatus: missingCostReasons.length ? "estimated" : "tracked",
        missingCostReasons,
      },
      charts: {
        daily: aggregateByPeriod(records, "day", costForRecord),
        weekly: aggregateByPeriod(records, "week", costForRecord),
        monthly: aggregateByPeriod(records, "month", costForRecord),
        quarterly: aggregateByPeriod(records, "quarter", costForRecord),
        productMix,
        contribution,
      },
    });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
