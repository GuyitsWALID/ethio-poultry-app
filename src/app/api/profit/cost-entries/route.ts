import { NextRequest } from "next/server";

import { getSalesContext, hasScopedAccess, json, supabaseAdmin } from "@/lib/sales";
import {recordAuditEvent} from "@/lib/audit-ledger";

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
    if (!entryDate) return json({ error: "Entry date is required." }, 400);
    if (!category || !VALID_CATEGORIES.has(category)) return json({ error: "Select a valid cost category." }, 400);
    if (!VALID_ALLOCATIONS.has(allocationMethod)) return json({ error: "Select a valid allocation method." }, 400);
    if (!VALID_ENTRY_KINDS.has(entryKind)) return json({ error: "Select monthly or one-off expense." }, 400);
    if (!description) return json({ error: "Description is required." }, 400);
    if (amount <= 0) return json({ error: "Amount must be greater than zero." }, 400);

    const { data, error } = await supabaseAdmin
      .from("cost_entries")
      .insert({
        org_id: ctx.orgId,
        branch_id: cleanText(body.branch_id),
        farm_id: cleanText(body.farm_id),
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
        recorded_by: ctx.userId,
      })
      .select("*")
      .single();

    if (error) return json({ error: error.message }, 500);
    await recordAuditEvent(ctx,{eventType:"cost_entry.recorded",operation:"insert",entityTable:"cost_entries",entityId:String(data.id),reason:description,after:data,farmId:data.farm_id,houseId:data.house_id,flockId:data.flock_id,batchId:data.batch_id});
    return json({ costEntry: data }, 201);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
