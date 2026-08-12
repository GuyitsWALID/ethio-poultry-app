import { NextRequest } from "next/server";

import { getSalesContext, hasScopedAccess, json, supabaseAdmin } from "@/lib/sales";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: "You do not have access to monthly profit periods." }, 403);

    const params = request.nextUrl.searchParams;
    let query = supabaseAdmin
      .from("monthly_cost_periods")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("period_start", { ascending: false })
      .limit(100);

    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");
    if (dateFrom) query = query.gte("period_end", dateFrom);
    if (dateTo) query = query.lte("period_start", dateTo);
    ["branch_id", "farm_id", "house_id", "flock_id", "batch_id"].forEach((key) => {
      const value = params.get(key);
      if (value) query = query.eq(key, value);
    });

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    const scoped =
      ctx.role === "farm_manager"
        ? (data ?? []).filter((row) => hasScopedAccess(ctx, row))
        : data ?? [];
    return json({ periods: scoped });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
