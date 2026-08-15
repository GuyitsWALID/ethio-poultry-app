import { NextRequest } from "next/server";

import {
  applySalesFilters,
  getSalesContext,
  hasScopedAccess,
  json,
  resolveSaleScope,
  supabaseAdmin,
  type DailySalesRecord,
} from "@/lib/sales";
import {recordAuditEvent} from "@/lib/audit-ledger";

const VALID_CATEGORIES = new Set(["egg", "bird", "training", "equipment_medicine", "consultancy", "package"]);

function numberFrom(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: "You do not have access to sales records." }, 403);

    const { data, error } = await supabaseAdmin
      .from("daily_sales_records")
      .select("*")
      .eq("org_id", ctx.orgId)
      .is("voided_at",null)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) return json({ error: error.message }, 500);

    const scoped = ((data ?? []) as DailySalesRecord[]).filter((record) => hasScopedAccess(ctx, record));
    const records = applySalesFilters(scoped, request.nextUrl.searchParams);

    return json({ records });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: "You do not have access to sales records." }, 403);
    if (!ctx.canMutate) return json({ error: "You do not have permission to create sales records." }, 403);

    const body = await request.json();
    const productCategory = String(body.product_category ?? "");
    const productLabel = cleanText(body.product_label);
    const saleDate = cleanText(body.sale_date);
    const quantity = numberFrom(body.quantity);
    const unitPrice = numberFrom(body.unit_price);
    const paidAmount = numberFrom(body.paid_amount);
    const grossAmount = Math.round(quantity * unitPrice * 100) / 100;

    if (!saleDate) return json({ error: "Sale date is required." }, 400);
    if (!VALID_CATEGORIES.has(productCategory)) return json({ error: "Select a supported revenue category." }, 400);
    if (!productLabel) return json({ error: "Product label is required." }, 400);
    if (quantity <= 0) return json({ error: "Quantity must be greater than zero." }, 400);
    if (unitPrice < 0) return json({ error: "Unit price cannot be negative." }, 400);
    if (paidAmount < 0 || paidAmount > grossAmount) {
      return json({ error: "Paid amount must be between zero and gross amount." }, 400);
    }

    const scope = await resolveSaleScope(ctx, {
      branch_id: cleanText(body.branch_id),
      farm_id: cleanText(body.farm_id),
      house_id: cleanText(body.house_id),
      flock_id: cleanText(body.flock_id),
      batch_id: cleanText(body.batch_id),
      require_farm: true,
    });
    if ("error" in scope) return json({ error: scope.error }, 400);

    const { data, error } = await supabaseAdmin
      .from("daily_sales_records")
      .insert({
        org_id: ctx.orgId,
        ...scope,
        sale_date: saleDate,
        product_category: productCategory,
        product_label: productLabel,
        quantity,
        unit: cleanText(body.unit) ?? (productCategory === "egg" ? "tray" : productCategory === "bird" ? "bird" : "unit"),
        unit_price: unitPrice,
        gross_amount: grossAmount,
        paid_amount: paidAmount,
        balance_due: Math.round((grossAmount - paidAmount) * 100) / 100,
        payment_method: cleanText(body.payment_method),
        customer_name: cleanText(body.customer_name),
        customer_phone: cleanText(body.customer_phone),
        notes: cleanText(body.notes),
        recorded_by: ctx.userId,
      })
      .select("*")
      .single();

    if (error) return json({ error: error.message }, 500);
    await recordAuditEvent(ctx,{eventType:"sales_record.recorded",operation:"insert",entityTable:"daily_sales_records",entityId:String(data.id),reason:`Recorded sale of ${productLabel}.`,after:data,farmId:data.farm_id,houseId:data.house_id,flockId:data.flock_id,batchId:data.batch_id});
    return json({ record: data }, 201);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
