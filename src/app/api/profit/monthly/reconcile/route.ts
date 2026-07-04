import { NextRequest } from "next/server";

import { getSalesContext, json, supabaseAdmin } from "@/lib/sales";
import { round } from "@/lib/profitability";

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

function applyNullableScope<T>(query: T, scope: Record<string, string | null>) {
  let next = query as NullableScopeQuery;
  Object.entries(scope).forEach(([key, value]) => {
    next = value ? next.eq(key, value) : next.is(key, null);
  });
  return next as T;
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!["ceo", "system_admin", "super_admin"].includes(ctx.role)) {
      return json({ error: "Only CEO or system roles can reconcile monthly cost periods." }, 403);
    }

    const body = await request.json();
    const periodStart = cleanText(body.period_start);
    const periodEnd = cleanText(body.period_end) ?? (periodStart ? monthEnd(periodStart) : null);
    if (!periodStart || !periodEnd) return json({ error: "Period start and end are required." }, 400);

    const scope = {
      branch_id: cleanText(body.branch_id),
      farm_id: cleanText(body.farm_id),
      house_id: cleanText(body.house_id),
      flock_id: cleanText(body.flock_id),
      batch_id: cleanText(body.batch_id),
    };
    const targetMarginPerEgg = numberFrom(body.target_margin_per_egg, 0);
    const lockPeriod = Boolean(body.lock);

    let dailyQuery = supabaseAdmin
      .from("daily_farm_records")
      .select("normal_eggs, broken_eggs, total_eggs, feed_intake_grams, flock_id")
      .eq("org_id", ctx.orgId)
      .gte("record_date", periodStart)
      .lte("record_date", periodEnd);
    if (scope.flock_id) dailyQuery = dailyQuery.eq("flock_id", scope.flock_id);

    let salesQuery = supabaseAdmin
      .from("daily_sales_records")
      .select("gross_amount, branch_id, farm_id, house_id, flock_id, batch_id")
      .eq("org_id", ctx.orgId)
      .gte("sale_date", periodStart)
      .lte("sale_date", periodEnd);
    Object.entries(scope).forEach(([key, value]) => {
      if (value) salesQuery = salesQuery.eq(key, value);
    });

    let costEntryQuery = supabaseAdmin
      .from("cost_entries")
      .select("amount, branch_id, farm_id, house_id, flock_id, batch_id")
      .eq("org_id", ctx.orgId)
      .gte("entry_date", periodStart)
      .lte("entry_date", periodEnd);
    Object.entries(scope).forEach(([key, value]) => {
      if (value) costEntryQuery = costEntryQuery.eq(key, value);
    });

    const [dailyRes, salesRes, inventoryRes, stockRes, costEntryRes] = await Promise.all([
      dailyQuery,
      salesQuery,
      supabaseAdmin.from("inventory_items").select("id, category, unit_cost").eq("org_id", ctx.orgId),
      supabaseAdmin
        .from("stock_ledger")
        .select("item_id, quantity, transaction_type, unit_cost, transaction_date, flock_id")
        .eq("org_id", ctx.orgId)
        .gte("transaction_date", periodStart)
        .lte("transaction_date", periodEnd),
      costEntryQuery,
    ]);

    const firstError = dailyRes.error ?? salesRes.error ?? inventoryRes.error ?? stockRes.error ?? costEntryRes.error;
    if (firstError) return json({ error: firstError.message }, 500);

    const normalEggs = (dailyRes.data ?? []).reduce((sum, row) => sum + (row.normal_eggs ?? row.total_eggs ?? 0), 0);
    const brokenEggs = (dailyRes.data ?? []).reduce((sum, row) => sum + (row.broken_eggs ?? 0), 0);
    const revenue = (salesRes.data ?? []).reduce((sum, row) => sum + (row.gross_amount ?? 0), 0);
    const costedItemIds = new Set(
      (inventoryRes.data ?? [])
        .filter((item) => ["feed", "medicine", "vaccine", "vitamin"].includes(item.category))
        .map((item) => item.id)
    );
    const stockCost = (stockRes.data ?? []).reduce((sum, row) => {
      if (!costedItemIds.has(row.item_id)) return sum;
      if (row.transaction_type !== "issue" && row.transaction_type !== "transfer_out") return sum;
      if (scope.flock_id && row.flock_id !== scope.flock_id) return sum;
      return sum + row.quantity * row.unit_cost;
    }, 0);
    const overheadCost = (costEntryRes.data ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0);
    const absorbedCost = stockCost + overheadCost;
    const baseCostPerEgg = normalEggs > 0 ? absorbedCost / normalEggs : null;

    const payload = {
      org_id: ctx.orgId,
      ...scope,
      period_start: periodStart,
      period_end: periodEnd,
      status: lockPeriod ? "locked" : "draft",
      total_normal_eggs: normalEggs,
      total_broken_eggs: brokenEggs,
      total_revenue: round(revenue),
      total_absorbed_cost: round(absorbedCost),
      base_cost_per_egg: baseCostPerEgg === null ? null : round(baseCostPerEgg, 4),
      target_margin_per_egg: targetMarginPerEgg,
      locked_by: lockPeriod ? ctx.userId : null,
      notes: cleanText(body.notes),
    };

    const existingQuery = applyNullableScope(
      supabaseAdmin
        .from("monthly_cost_periods")
        .select("id")
        .eq("org_id", ctx.orgId)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd),
      scope
    );
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError) return json({ error: existingError.message }, 500);

    const writeQuery = existing?.id
      ? supabaseAdmin.from("monthly_cost_periods").update(payload).eq("id", existing.id)
      : supabaseAdmin.from("monthly_cost_periods").insert(payload);
    const { data, error } = await writeQuery
      .select("*")
      .single();

    if (error) return json({ error: error.message }, 500);

    return json({
      period: data,
      summary: {
        normalEggs,
        brokenEggs,
        revenue: round(revenue),
        stockCost: round(stockCost),
        overheadCost: round(overheadCost),
        absorbedCost: round(absorbedCost),
        baseCostPerEgg: baseCostPerEgg === null ? null : round(baseCostPerEgg, 4),
      },
    });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
