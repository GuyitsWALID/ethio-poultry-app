import { NextRequest } from "next/server";

import {
  getSalesContext,
  hasScopedAccess,
  json,
  resolveSaleScope,
  supabaseAdmin,
  type DailySalesRecord,
} from "@/lib/sales";

const VALID_CATEGORIES = new Set(["egg", "bird"]);

function numberFrom(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function getExistingRecord(ctx: Awaited<ReturnType<typeof getSalesContext>>, id: string) {
  if (ctx instanceof Response) return { response: ctx };

  const { data, error } = await supabaseAdmin
    .from("daily_sales_records")
    .select("*")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  if (error) return { response: json({ error: error.message }, 500) };
  if (!data) return { response: json({ error: "Sales record was not found." }, 404) };

  const record = data as DailySalesRecord;
  if (!hasScopedAccess(ctx, record)) return { response: json({ error: "You do not have access to this sales record." }, 403) };
  return { record };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: "You do not have access to sales records." }, 403);
    if (!ctx.canMutate) return json({ error: "Only farm managers can edit daily sales records." }, 403);

    const { id } = await params;
    const existing = await getExistingRecord(ctx, id);
    if (existing.response) return existing.response;

    const body = await request.json();
    const productCategory = String(body.product_category ?? existing.record.product_category);
    const productLabel = cleanText(body.product_label) ?? existing.record.product_label;
    const saleDate = cleanText(body.sale_date) ?? existing.record.sale_date;
    const quantity = numberFrom(body.quantity, existing.record.quantity);
    const unitPrice = numberFrom(body.unit_price, existing.record.unit_price);
    const paidAmount = numberFrom(body.paid_amount, existing.record.paid_amount);
    const grossAmount = Math.round(quantity * unitPrice * 100) / 100;

    if (!VALID_CATEGORIES.has(productCategory)) return json({ error: "Product category must be egg or bird." }, 400);
    if (quantity <= 0) return json({ error: "Quantity must be greater than zero." }, 400);
    if (unitPrice < 0) return json({ error: "Unit price cannot be negative." }, 400);
    if (paidAmount < 0 || paidAmount > grossAmount) {
      return json({ error: "Paid amount must be between zero and gross amount." }, 400);
    }

    const scope = await resolveSaleScope(ctx, {
      branch_id: cleanText(body.branch_id) ?? existing.record.branch_id,
      farm_id: cleanText(body.farm_id) ?? existing.record.farm_id,
      house_id: cleanText(body.house_id) ?? existing.record.house_id,
      flock_id: cleanText(body.flock_id) ?? existing.record.flock_id,
      batch_id: cleanText(body.batch_id) ?? existing.record.batch_id,
    });
    if ("error" in scope) return json({ error: scope.error }, 400);

    const { data, error } = await supabaseAdmin
      .from("daily_sales_records")
      .update({
        ...scope,
        sale_date: saleDate,
        product_category: productCategory,
        product_label: productLabel,
        quantity,
        unit: cleanText(body.unit) ?? existing.record.unit,
        unit_price: unitPrice,
        gross_amount: grossAmount,
        paid_amount: paidAmount,
        balance_due: Math.round((grossAmount - paidAmount) * 100) / 100,
        payment_method: cleanText(body.payment_method),
        customer_name: cleanText(body.customer_name),
        customer_phone: cleanText(body.customer_phone),
        notes: cleanText(body.notes),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select("*")
      .single();

    if (error) return json({ error: error.message }, 500);
    return json({ record: data });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: "You do not have access to sales records." }, 403);
    if (!ctx.canMutate) return json({ error: "Only farm managers can delete daily sales records." }, 403);

    const { id } = await params;
    const existing = await getExistingRecord(ctx, id);
    if (existing.response) return existing.response;

    const { error } = await supabaseAdmin
      .from("daily_sales_records")
      .delete()
      .eq("id", id)
      .eq("org_id", ctx.orgId);

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
