import {getTranslations} from "next-intl/server";
import { NextRequest } from "next/server";

import {
  applySalesFilters,
  getSalesContext,
  hasScopedAccess,
  json,
  supabaseAdmin,
  type DailySalesRecord,
} from "@/lib/sales";
import {FarmOperationError, farmOperationErrorBody, recordSale} from "@/lib/farm-operations";

export async function GET(request: NextRequest) {
  const validation = await getTranslations("OperationValidation");
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: validation("youDoNotHaveAccessToSalesRecords") }, 403);

    const { data, error } = await supabaseAdmin
      .from("daily_sales_records")
      .select("*")
      .eq("org_id", ctx.orgId)
      .is("voided_at",null)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return json({error: error.message}, 500);

    const scoped = ((data ?? []) as DailySalesRecord[]).filter((record) => hasScopedAccess(ctx, record));
    const records = applySalesFilters(scoped, request.nextUrl.searchParams);

    return json({ records });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

export async function POST(request: NextRequest) {
  const validation = await getTranslations("OperationValidation");
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: validation("youDoNotHaveAccessToSalesRecords") }, 403);
    if (!ctx.canMutate) return json({ error: validation("youDoNotHavePermissionToCreateSales") }, 403);
    const body = await request.json();
    const data = await recordSale(ctx, body);
    return json({ record: data }, 201);
  } catch (error: unknown) {
    if (error instanceof FarmOperationError) return json(await farmOperationErrorBody(error), error.status);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
