import { NextRequest } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getSalesContext, hasScopedAccess, json, supabaseAdmin } from "@/lib/sales";
import {recordAuditEvent} from "@/lib/audit-ledger";
import { governanceAdmin } from "@/lib/access-context";

const VALID_CATEGORIES = new Set([
  "feed",
  "medicine",
  "vaccine",
  "vitamin",
  "supplement",
  "payroll",
  "utility",
  "biosecurity",
  "transport",
  "maintenance",
  "labor",
  "rent",
  "packaging",
  "miscellaneous",
]);
const VALID_ALLOCATIONS = new Set(["direct", "bird_count", "egg_count", "feed_consumption", "manual_percent"]);
const VALID_ENTRY_KINDS = new Set(["monthly", "one_off"]);

function cleanText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function numberFrom(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

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
    const category = cleanText(body.category);
    const allocationMethod = cleanText(body.allocation_method) ?? "direct";
    const entryKind = cleanText(body.entry_kind) ?? "one_off";
    const entryDate = cleanText(body.entry_date);
    const description = cleanText(body.description);
    const amount = numberFrom(body.amount);
    const warehouseId = cleanText(body.warehouse_id);
    if (!entryDate) return json({ error: "Entry date is required." }, 400);
    if (!category || !VALID_CATEGORIES.has(category)) return json({ error: "Select a valid cost category." }, 400);
    if (!VALID_ALLOCATIONS.has(allocationMethod)) return json({ error: "Select a valid allocation method." }, 400);
    if (!VALID_ENTRY_KINDS.has(entryKind)) return json({ error: "Select monthly or one-off expense." }, 400);
    if (!description) return json({ error: "Description is required." }, 400);
    if (amount <= 0) return json({ error: "Amount must be greater than zero." }, 400);
    if (warehouseId && !ctx.supportSessionId) {
      const now=new Date().toISOString();const {data:assignment}=await governanceAdmin.from("user_warehouse_access").select("id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).eq("warehouse_id",warehouseId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();
      if(!assignment)return json({ error: "An active assignment to the selected warehouse is required." }, 403);
    }

    let branchId = cleanText(body.branch_id);
    let farmId = cleanText(body.farm_id);
    if (warehouseId) {
      const { data: warehouse } = await governanceAdmin.from("warehouses").select("branch_id,farm_id").eq("id", warehouseId).eq("org_id", ctx.orgId).eq("status", "active").maybeSingle();
      if (!warehouse) return json({ error: "Select an active warehouse in this organization." }, 400);
      branchId = String(warehouse.branch_id);
      farmId = warehouse.farm_id ? String(warehouse.farm_id) : null;
    }

    let recurringTemplateId = cleanText(body.recurring_template_id);
    if (entryKind === "monthly" && body.remember_template === true && warehouseId && !recurringTemplateId) {
      const db = governanceAdmin as any;
      const templateResult = await db.from("recurring_cost_templates").upsert({
        org_id: ctx.orgId, warehouse_id: warehouseId, category, description, default_amount: amount,
        supplier_name: cleanText(body.supplier_name), is_active: true, created_by: ctx.userId, updated_at: new Date().toISOString(),
      }, { onConflict: "org_id,warehouse_id,category,description" }).select("id").single();
      if (templateResult.error) return json({ error: templateResult.error.message }, 400);
      recurringTemplateId = String(templateResult.data.id);
    }
    const confirmationMonth = entryKind === "monthly" && recurringTemplateId ? `${entryDate.slice(0,7)}-01` : null;

    const { data, error } = await (supabaseAdmin as any)
      .from("cost_entries")
      .insert({
        org_id: ctx.orgId,
        branch_id: branchId,
        farm_id: farmId,
        house_id: cleanText(body.house_id),
        flock_id: cleanText(body.flock_id),
        batch_id: cleanText(body.batch_id),
        entry_date: entryDate,
        entry_kind: entryKind,
        category,
        description,
        amount,
        allocation_method: allocationMethod,
        supplier_name: cleanText(body.supplier_name),
        invoice_number: cleanText(body.invoice_number),
        reference_doc: cleanText(body.reference_doc),
        warehouse_id: warehouseId,
        recurring_template_id: recurringTemplateId,
        confirmation_month: confirmationMonth,
        recorded_by: ctx.userId,
      })
      .select("*")
      .single();

    if (error) return json({ error: error.code === "23505" ? "This monthly expense template has already been confirmed for this month." : error.message }, error.code === "23505" ? 409 : 500);
    await recordAuditEvent(ctx,{eventType:"cost_entry.recorded",operation:"insert",entityTable:"cost_entries",entityId:String(data.id),reason:description,after:data,farmId:data.farm_id,houseId:data.house_id,flockId:data.flock_id,batchId:data.batch_id,warehouseId});
    return json({ costEntry: data }, 201);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
