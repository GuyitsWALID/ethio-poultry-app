import { NextRequest } from "next/server";

import { getSalesContext, hasScopedAccess, json, supabaseAdmin } from "@/lib/sales";
import {FarmOperationError, recordExpense} from "@/lib/farm-operations";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: "You do not have access to cost entries." }, 403);

    const params = request.nextUrl.searchParams;
    const dateFrom = params.get("date_from");
    const dateTo = params.get("date_to");
    let query = supabaseAdmin
      .from("cost_entries")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("entry_date", { ascending: false })
      .limit(300);
    if (dateFrom) query = query.gte("entry_date", dateFrom);
    if (dateTo) query = query.lte("entry_date", dateTo);
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
    return json({ costEntries: scoped });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canMutate) {
      return json({ error: "Only farm managers can create operational cost entries." }, 403);
    }
    const body = await request.json();
    const data = await recordExpense(ctx, body);
    return json({ costEntry: data }, 201);
  } catch (error: unknown) {
    if (error instanceof FarmOperationError) return json({error: error.message}, error.status);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
