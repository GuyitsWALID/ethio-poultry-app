import { NextRequest } from "next/server";

import {
  getSalesContext,
  hasScopedAccess,
  json,
  resolveSaleScope,
  supabaseAdmin,
  type DailySalesRecord,
} from "@/lib/sales";
import { governanceAdmin } from "@/lib/access-context";

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

async function getExistingRecord(ctx: Awaited<ReturnType<typeof getSalesContext>>, id: string) {
  if (ctx instanceof Response) return { response: ctx };

  const { data, error } = await supabaseAdmin
    .from("daily_sales_records")
    .select("*")
    .is("voided_at",null)
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

    if (!VALID_CATEGORIES.has(productCategory)) return json({ error: "Select a supported revenue category." }, 400);
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
      require_farm: true,
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSalesContext();
    if (ctx instanceof Response) return ctx;
    if (!ctx.canView) return json({ error: "You do not have access to sales records." }, 403);
    if (!ctx.canMutate) return json({ error: "Only farm managers can void daily sales records." }, 403);

    const { id } = await params;
    const existing = await getExistingRecord(ctx, id);
    if (existing.response) return existing.response;

    const body=await request.json().catch(()=>null) as {reason?:string}|null;const reason=String(body?.reason??"").trim();if(reason.length<8)return json({error:"A void reason of at least eight characters is required."},400);
    const now=new Date().toISOString();const {data,error}=await governanceAdmin.from("daily_sales_records").update({voided_at:now,voided_by:ctx.userId,void_reason:reason}).eq("id",id).eq("org_id",ctx.orgId).select("*").single();if(error)return json({error:error.message},400);await governanceAdmin.from("governance_audit_events").insert({org_id:ctx.orgId,actor_id:ctx.userId,actor_role:ctx.role,event_type:"business_record.voided",entity_table:"daily_sales_records",entity_id:id,reason,before_values:existing.record,after_values:data});return json({voided:true});
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
