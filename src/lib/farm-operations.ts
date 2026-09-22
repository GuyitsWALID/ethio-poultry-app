import "server-only";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {z} from "zod";

import {canAccessFarm, governanceAdmin, type AccessContext} from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";
import {hasManualFeedInput} from "@/lib/daily-record-input";
import {feedAdmin, resolveFeedBatch, type FeedContext} from "@/lib/feed-control";
import {resolveSaleScope, supabaseAdmin, type SalesContext} from "@/lib/sales";
import type {Json} from "@/types/supabase";

export class FarmOperationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly guidance?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const optionalText = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : null,
  z.string().trim().nullable().optional(),
);
const optionalUuid = z.preprocess(
  (value) => typeof value === "string" ? value.trim() || null : null,
  z.string().trim().nullable().optional(),
);

const dailyRecordInput = z.object({
  flock_id: z.string().trim().min(1),
  daily_record_id: optionalUuid,
  record: z.record(z.string(), z.unknown()),
  usages: z.array(z.unknown()).nullable().optional(),
});

const saleInput = z.object({
  product_category: z.enum(["egg", "bird", "training", "equipment_medicine", "consultancy", "package"]),
  product_label: z.string().trim().min(1),
  sale_date: z.string().trim().min(1),
  quantity: z.coerce.number().finite().positive(),
  unit_price: z.coerce.number().finite().nonnegative(),
  paid_amount: z.coerce.number().finite().default(0),
  unit: optionalText,
  payment_method: optionalText,
  customer_name: optionalText,
  customer_phone: optionalText,
  notes: optionalText,
  branch_id: optionalUuid,
  farm_id: optionalUuid,
  house_id: optionalUuid,
  flock_id: optionalUuid,
  batch_id: optionalUuid,
});

const costInput = z.object({
  category: z.enum(["feed", "medicine", "vaccine", "vitamin", "supplement", "payroll", "utility", "biosecurity", "transport", "maintenance", "labor", "rent", "packaging", "miscellaneous"]),
  allocation_method: z.enum(["direct", "bird_count", "egg_count", "feed_consumption", "manual_percent"]).default("direct"),
  entry_kind: z.enum(["monthly", "one_off"]).default("one_off"),
  entry_date: z.string().trim().min(1),
  description: z.string().trim().min(1),
  amount: z.coerce.number().finite().positive(),
  warehouse_id: optionalUuid,
  branch_id: optionalUuid,
  farm_id: optionalUuid,
  house_id: optionalUuid,
  flock_id: optionalUuid,
  batch_id: optionalUuid,
  recurring_template_id: optionalUuid,
  remember_template: z.boolean().optional().default(false),
  supplier_name: optionalText,
  invoice_number: optionalText,
  reference_doc: optionalText,
});

function issueMessage(error: z.ZodError) {
  const issue = error.issues[0];
  if (!issue) return "The operation is invalid.";
  const field = issue.path[0];
  if (field === "sale_date") return "Sale date is required.";
  if (field === "product_category") return "Select a supported revenue category.";
  if (field === "product_label") return "Product label is required.";
  if (field === "quantity") return "Quantity must be greater than zero.";
  if (field === "unit_price") return "Unit price cannot be negative.";
  if (field === "entry_date") return "Entry date is required.";
  if (field === "category") return "Select a valid cost category.";
  if (field === "allocation_method") return "Select a valid allocation method.";
  if (field === "entry_kind") return "Select monthly or one-off expense.";
  if (field === "description") return "Description is required.";
  if (field === "amount") return "Amount must be greater than zero.";
  return issue.message;
}

function databaseStatus(code?: string) {
  if (code === "42501") return 403;
  if (code === "55000") return 409;
  if (code === "22023" || code === "22P02" || code === "23505" || code === "23514") return 400;
  return 500;
}

function legacyNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export async function saveDailyRecordWithUsage(context: SalesContext, input: unknown) {
  if (!context.canMutate) {
    throw new FarmOperationError("Only farm managers can save daily records and inventory usage.", 403);
  }
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  if (typeof raw.flock_id !== "string" || !raw.flock_id.trim()) throw new FarmOperationError("Flock is required.");
  if (!raw.record || typeof raw.record !== "object" || Array.isArray(raw.record)) throw new FarmOperationError("Daily record payload is required.");
  if (raw.usages !== undefined && raw.usages !== null && !Array.isArray(raw.usages)) throw new FarmOperationError("Inventory usages must be an array or null.");
  const parsed = dailyRecordInput.safeParse(raw);
  if (!parsed.success) throw new FarmOperationError(parsed.error.issues[0]?.message ?? "Daily record input is invalid.");
  const value = parsed.data;
  if (hasManualFeedInput(value.record)) {
    throw new FarmOperationError("Record feed intake and feed type in Today’s Feeding, then close the feeding day.");
  }
  const {data, error} = await supabaseAdmin.rpc("save_daily_record_with_usage", {
    p_actor_id: context.userId,
    p_daily_record_id: value.daily_record_id ?? null,
    p_flock_id: value.flock_id,
    p_record: value.record as Json,
    p_usages: (value.usages ?? null) as Json,
  });
  if (!error) return {result: data, created: !value.daily_record_id};
  if (/operating day is locked/i.test(error.message)) {
    const {data: flock} = await supabaseAdmin.from("flocks").select("farm_id,flock_code").eq("id", value.flock_id).eq("org_id", context.orgId).maybeSingle();
    const fields = new Set(["normal_eggs", "broken_eggs", "dirty_eggs", "average_egg_weight_g", "deaths", "deaths_cause", "opening_birds", "closing_birds", "culls", "transfers_in", "transfers_out", "other_removals", "water_consumed_liters", "feed_leftover_grams", "vaccination_status", "medication_vitamins"]);
    const proposed = Object.fromEntries(Object.entries(value.record).filter(([key]) => fields.has(key)));
    if (!value.daily_record_id) Object.assign(proposed, {flock_id: value.flock_id, record_date: value.record.record_date});
    throw new FarmOperationError("This Daily Record is locked. Request approval for this exact correction.", 423, {
      governance: {
        request_type: "locked_correction", farm_id: flock?.farm_id ?? null,
        source_table: "daily_farm_records", source_id: value.daily_record_id ?? null,
        reason: `Correct the locked Daily Record for ${String(value.record.record_date ?? "the selected date")}.`,
        proposed_values: proposed, changed_fields: Object.keys(proposed),
        destination: `${flock?.flock_code ?? "Flock"} Daily Record · ${String(value.record.record_date ?? "selected date")}`,
        correction_route: `/app/daily-records${value.daily_record_id ? `?record=${value.daily_record_id}` : ""}`,
      },
    });
  }
  throw new FarmOperationError(error.message, databaseStatus(error.code));
}

export async function recordSale(context: SalesContext, input: unknown) {
  if (!context.canView) throw new FarmOperationError("You do not have access to sales records.", 403);
  if (!context.canMutate) throw new FarmOperationError("You do not have permission to create sales records.", 403);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const parsed = saleInput.safeParse({...raw, quantity: legacyNumber(raw.quantity), unit_price: legacyNumber(raw.unit_price), paid_amount: legacyNumber(raw.paid_amount)});
  if (!parsed.success) throw new FarmOperationError(issueMessage(parsed.error));
  const value = parsed.data;
  const grossAmount = Math.round(value.quantity * value.unit_price * 100) / 100;
  if (value.paid_amount < 0 || value.paid_amount > grossAmount) throw new FarmOperationError("Paid amount must be between zero and gross amount.");
  const scope = await resolveSaleScope(context, {...value, require_farm: true});
  if ("error" in scope) throw new FarmOperationError(scope.error ?? "The selected sales scope is unavailable.");
  const {data, error} = await supabaseAdmin.from("daily_sales_records").insert({
    org_id: context.orgId, ...scope, sale_date: value.sale_date,
    product_category: value.product_category, product_label: value.product_label,
    quantity: value.quantity,
    unit: value.unit ?? (value.product_category === "egg" ? "tray" : value.product_category === "bird" ? "bird" : "unit"),
    unit_price: value.unit_price, gross_amount: grossAmount, paid_amount: value.paid_amount,
    balance_due: Math.round((grossAmount - value.paid_amount) * 100) / 100,
    payment_method: value.payment_method ?? null, customer_name: value.customer_name ?? null,
    customer_phone: value.customer_phone ?? null, notes: value.notes ?? null, recorded_by: context.userId,
  }).select("*").single();
  if (error) throw new FarmOperationError(error.message, 500);
  await recordAuditEvent(context, {eventType: "sales_record.recorded", operation: "insert", entityTable: "daily_sales_records", entityId: String(data.id), reason: `Recorded sale of ${value.product_label}.`, after: data, farmId: data.farm_id, houseId: data.house_id, flockId: data.flock_id, batchId: data.batch_id});
  return data;
}

export async function recordExpense(context: SalesContext, input: unknown) {
  if (!context.canMutate) throw new FarmOperationError("Only farm managers can create operational cost entries.", 403);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const parsed = costInput.safeParse({
    ...raw,
    amount: legacyNumber(raw.amount),
    category: typeof raw.category === "string" ? raw.category.trim() : raw.category,
    allocation_method: typeof raw.allocation_method === "string" && raw.allocation_method.trim() ? raw.allocation_method.trim() : "direct",
    entry_kind: typeof raw.entry_kind === "string" && raw.entry_kind.trim() ? raw.entry_kind.trim() : "one_off",
    remember_template: raw.remember_template === true,
  });
  if (!parsed.success) throw new FarmOperationError(issueMessage(parsed.error));
  const value = parsed.data;
  let branchId = value.branch_id ?? null;
  let farmId = value.farm_id ?? null;
  if (value.warehouse_id) {
    if (!context.supportSessionId) {
      const now = new Date().toISOString();
      const {data: assignment} = await governanceAdmin.from("user_warehouse_access").select("id").eq("org_id", context.orgId).eq("profile_id", context.userId).eq("warehouse_id", value.warehouse_id).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();
      if (!assignment) throw new FarmOperationError("An active assignment to the selected warehouse is required.", 403);
    }
    const {data: warehouse} = await governanceAdmin.from("warehouses").select("branch_id,farm_id").eq("id", value.warehouse_id).eq("org_id", context.orgId).eq("status", "active").maybeSingle();
    if (!warehouse) throw new FarmOperationError("Select an active warehouse in this organization.");
    branchId = String(warehouse.branch_id);
    farmId = warehouse.farm_id ? String(warehouse.farm_id) : null;
  }
  let recurringTemplateId = value.recurring_template_id ?? null;
  if (value.entry_kind === "monthly" && value.remember_template && value.warehouse_id && !recurringTemplateId) {
    const template = await (governanceAdmin as any).from("recurring_cost_templates").upsert({
      org_id: context.orgId, warehouse_id: value.warehouse_id, category: value.category,
      description: value.description, default_amount: value.amount, supplier_name: value.supplier_name ?? null,
      is_active: true, created_by: context.userId, updated_at: new Date().toISOString(),
    }, {onConflict: "org_id,warehouse_id,category,description"}).select("id").single();
    if (template.error) throw new FarmOperationError(template.error.message);
    recurringTemplateId = String(template.data.id);
  }
  const confirmationMonth = value.entry_kind === "monthly" && recurringTemplateId ? `${value.entry_date.slice(0, 7)}-01` : null;
  const {data, error} = await (supabaseAdmin as any).from("cost_entries").insert({
    org_id: context.orgId, branch_id: branchId, farm_id: farmId, house_id: value.house_id ?? null,
    flock_id: value.flock_id ?? null, batch_id: value.batch_id ?? null, entry_date: value.entry_date,
    entry_kind: value.entry_kind, category: value.category, description: value.description,
    amount: value.amount, allocation_method: value.allocation_method, supplier_name: value.supplier_name ?? null,
    invoice_number: value.invoice_number ?? null, reference_doc: value.reference_doc ?? null,
    warehouse_id: value.warehouse_id ?? null, recurring_template_id: recurringTemplateId,
    confirmation_month: confirmationMonth, recorded_by: context.userId,
  }).select("*").single();
  if (error) throw new FarmOperationError(error.code === "23505" ? "This monthly expense template has already been confirmed for this month." : error.message, error.code === "23505" ? 409 : 500);
  await recordAuditEvent(context, {eventType: "cost_entry.recorded", operation: "insert", entityTable: "cost_entries", entityId: String(data.id), reason: value.description, after: data, farmId: data.farm_id, houseId: data.house_id, flockId: data.flock_id, batchId: data.batch_id, warehouseId: value.warehouse_id ?? null});
  return data;
}

const FEED_TYPES = new Set(["starter_feed", "grower_pullet_feed", "layer_feed", "broiler_feed", "medicated_feed"]);

function objectInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new FarmOperationError("Invalid request body.");
  }
  return input as Record<string, unknown>;
}

export async function saveFeedSession(context: FeedContext, input: unknown) {
  if (!context.canManage) throw new FarmOperationError("Only an operations manager can record feeding sessions.", 403);
  const body = objectInput(input);
  const batchId = String(body.batchId ?? "");
  const flockId = String(body.flockId ?? "");
  const resolved = await resolveFeedBatch(context, batchId);
  if (!resolved.batch) throw new FarmOperationError(resolved.error ?? "Batch is unavailable.", 403);
  const {data: flock} = await feedAdmin.from("flocks").select("id").eq("id", flockId).eq("batch_id", batchId).eq("org_id", context.orgId).maybeSingle();
  if (!flock) throw new FarmOperationError("Flock is not part of the selected batch.");
  const sessionName = String(body.sessionName ?? "").trim();
  const recordDate = String(body.recordDate ?? "");
  const {data: closure} = await feedAdmin.from("feed_day_closures").select("id").eq("org_id", context.orgId).eq("flock_id", flockId).eq("record_date", recordDate).eq("status", "closed").maybeSingle();
  if (closure) throw new FarmOperationError("Reopen the feeding day before changing its sessions.", 409);
  const planned = Number(body.plannedFeedKg);
  const actual = body.actualFeedKg === null || body.actualFeedKg === "" ? null : Number(body.actualFeedKg);
  const feeders = Number(body.feedersCount);
  const status = String(body.status ?? "planned");
  const feedType = String(body.feedType ?? "");
  if (!sessionName || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || !Number.isFinite(planned) || planned <= 0 || !Number.isInteger(feeders) || feeders <= 0) {
    throw new FarmOperationError("Session name, date, positive plan, and feeder count are required.");
  }
  if (actual !== null && (!Number.isFinite(actual) || actual < 0)) throw new FarmOperationError("Actual feed cannot be negative.");
  if (!["planned", "completed", "missed"].includes(status) || (status === "completed" && actual === null)) {
    throw new FarmOperationError("Completed sessions require actual feed.");
  }
  if (!FEED_TYPES.has(feedType)) throw new FarmOperationError("Select a valid feed type.");
  const feedItemId = String(body.feedItemId ?? "");
  const warehouseId = String(body.warehouseId ?? "");
  if (status === "completed" && (!feedItemId || !warehouseId)) throw new FarmOperationError("Completed sessions require a feed item and warehouse.");
  if (feedItemId || warehouseId) {
    const now = new Date().toISOString();
    const {data: warehouseAccess} = context.supportSessionId
      ? {data: {id: context.supportSessionId}}
      : await governanceAdmin.from("user_warehouse_access").select("id").eq("org_id", context.orgId).eq("profile_id", context.userId).eq("warehouse_id", warehouseId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();
    if (!warehouseAccess) throw new FarmOperationError("An active assignment to the selected warehouse is required.", 403);
    const [{data: item}, {data: warehouse}] = await Promise.all([
      feedAdmin.from("inventory_items").select("id,unit").eq("id", feedItemId).eq("org_id", context.orgId).eq("category", "feed").maybeSingle(),
      feedAdmin.from("warehouses").select("id,branch_id").eq("id", warehouseId).eq("org_id", context.orgId).eq("branch_id", resolved.batch.branch_id).maybeSingle(),
    ]);
    if (!item || !["kg", "kilogram", "kilograms"].includes(String(item.unit).toLowerCase())) throw new FarmOperationError("Select a feed inventory item measured in kilograms.");
    if (!warehouse) throw new FarmOperationError("Select a warehouse in the batch branch.");
  }
  const now = new Date().toISOString();
  const payload = {org_id: context.orgId, batch_id: batchId, flock_id: flockId, record_date: recordDate, session_name: sessionName, session_time: String(body.sessionTime ?? "") || null, feeders_count: feeders, planned_feed_kg: planned, actual_feed_kg: actual, notes: String(body.notes ?? "").trim() || null, feed_item_id: feedItemId || null, warehouse_id: warehouseId || null, feed_type: feedType as "starter_feed" | "grower_pullet_feed" | "layer_feed" | "broiler_feed" | "medicated_feed", status, completed_at: status === "completed" ? now : null, completed_by: status === "completed" ? context.userId : null, recorded_by: context.userId, updated_at: now};
  const {data, error} = await feedAdmin.from("feeding_session_records").upsert(payload, {onConflict: "org_id,flock_id,record_date,session_name"}).select().single();
  if (error) throw new FarmOperationError(error.message);
  return data;
}

export async function voidFeedSession(context: FeedContext, input: unknown) {
  if (!context.canManage) throw new FarmOperationError("Only an operations manager can remove feeding sessions.", 403);
  const body = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const id = String(body.id ?? "");
  const batchId = String(body.batchId ?? "");
  const reason = String(body.reason ?? "").trim();
  if (!id || !batchId || reason.length < 8) throw new FarmOperationError("Session, batch, and a void reason of at least eight characters are required.");
  const resolved = await resolveFeedBatch(context, batchId);
  if (!resolved.batch) throw new FarmOperationError(resolved.error ?? "Batch is unavailable.", 403);
  const {data: session} = await feedAdmin.from("feeding_session_records").select("id,flock_id,record_date").eq("id", id).eq("batch_id", batchId).eq("org_id", context.orgId).maybeSingle();
  if (!session) throw new FarmOperationError("Feeding session was not found.", 404);
  const {data: closure} = await feedAdmin.from("feed_day_closures").select("id").eq("org_id", context.orgId).eq("flock_id", session.flock_id).eq("record_date", session.record_date).eq("status", "closed").maybeSingle();
  if (closure) throw new FarmOperationError("Reopen the feeding day before removing a session.", 409);
  const {error} = await feedAdmin.from("feeding_session_records").update({voided_at: new Date().toISOString(), voided_by: context.userId, void_reason: reason} as never).eq("id", id).eq("org_id", context.orgId);
  if (error) throw new FarmOperationError(error.message);
  await recordAuditEvent(context, {eventType: "business_record.voided", operation: "update", entityTable: "feeding_session_records", entityId: id, reason, before: session, after: {voided: true}, farmId: String(resolved.batch.farm_id), flockId: String(session.flock_id), batchId});
}

export async function closeFeedDay(context: FeedContext, input: unknown) {
  if (!context.canManage) throw new FarmOperationError("Only an operations manager can close a feeding day.", 403);
  const body = objectInput(input);
  const resolved = await resolveFeedBatch(context, String(body.batchId ?? ""));
  if (!resolved.batch) throw new FarmOperationError(resolved.error ?? "Batch is unavailable.", 403);
  const {data, error} = await feedAdmin.rpc("close_feed_day", {p_actor_id: context.userId, p_flock_id: String(body.flockId ?? ""), p_record_date: String(body.recordDate ?? ""), p_override_reason: String(body.overrideReason ?? "").trim() || null});
  if (error) throw new FarmOperationError(error.message);
  return data;
}

export async function reopenFeedDay(context: FeedContext, input: unknown) {
  if (!context.canManage) throw new FarmOperationError("Only an operations manager can reopen a feeding day.", 403);
  const body = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const reason = String(body.reason ?? "").trim();
  if (!reason) throw new FarmOperationError("A reopen reason is required.");
  const resolved = await resolveFeedBatch(context, String(body.batchId ?? ""));
  if (!resolved.batch) throw new FarmOperationError(resolved.error ?? "Batch is unavailable.", 403);
  const {data, error} = await feedAdmin.rpc("reopen_feed_day", {p_actor_id: context.userId, p_flock_id: String(body.flockId ?? ""), p_record_date: String(body.recordDate ?? ""), p_reason: reason});
  if (error) throw new FarmOperationError(error.message);
  return data;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type HealthOperationResult =
  | {kind: "vaccination"; data: unknown}
  | {kind: "health"; data: unknown};

export async function recordHealthEvidence(context: AccessContext, input: unknown): Promise<HealthOperationResult> {
  if (context.role !== "farm_manager" && !context.supportSessionId) {
    throw new FarmOperationError("Only an assigned farm manager can record health evidence.", 403);
  }
  const body = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const vaccinationScheduleId = String(body.vaccination_schedule_id ?? "").trim();
  if (vaccinationScheduleId) {
    const itemId = String(body.inventory_item_id ?? "").trim();
    const warehouseId = String(body.warehouse_id ?? "").trim();
    const quantity = Number(body.quantity);
    const administeredOn = String(body.administered_on ?? "").trim();
    if (!itemId || !warehouseId || !Number.isFinite(quantity) || quantity <= 0 || !DATE.test(administeredOn)) {
      throw new FarmOperationError("Vaccine item, warehouse, administered quantity, and actual administration date are required.");
    }
    const today = new Intl.DateTimeFormat("en-CA", {timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
    if (administeredOn > today) throw new FarmOperationError("The administration date cannot be in the future.");
    const {data, error} = await (governanceAdmin as any).rpc("complete_vaccination_with_inventory", {p_actor_id: context.userId, p_schedule_id: vaccinationScheduleId, p_item_id: itemId, p_warehouse_id: warehouseId, p_quantity: quantity, p_administered_on: administeredOn});
    if (error) throw new FarmOperationError(error.message, error.code === "42501" ? 403 : error.code === "55000" ? 423 : 400);
    await recordAuditEvent(context, {eventType: "vaccination.completed_with_inventory", operation: "insert", entityTable: "vaccination_events", entityId: vaccinationScheduleId, reason: "Completed vaccination and issued vaccine stock atomically.", after: data, warehouseId});
    return {kind: "vaccination", data};
  }

  const flockId = String(body.flock_id ?? "");
  const eventDate = String(body.event_date ?? "");
  const eventType = String(body.event_type ?? "observation");
  if (!flockId || !DATE.test(eventDate) || !["disease", "treatment", "observation"].includes(eventType)) {
    throw new FarmOperationError("Flock, date, and a valid event type are required.");
  }
  const {data: flock} = await governanceAdmin.from("flocks").select("farm_id").eq("id", flockId).eq("org_id", context.orgId).maybeSingle();
  if (!flock || !(await canAccessFarm(context, String(flock.farm_id)))) throw new FarmOperationError("Active farm assignment is required.", 403);
  if (!context.supportSessionId) {
    const {data: operatingDay} = await governanceAdmin.from("farm_operating_days").select("status").eq("farm_id", flock.farm_id).eq("operating_date", eventDate).maybeSingle();
    if (operatingDay?.status === "locked") {
      const proposed = {flock_id: flockId, event_date: eventDate, event_type: eventType, description: String(body.description ?? "").trim() || null, diagnosis: String(body.diagnosis ?? "").trim() || null, treatment: String(body.treatment ?? "").trim() || null};
      throw new FarmOperationError("This operating day is locked. Request a governed health correction instead.", 423, {governance: {request_type: "health_schedule", farm_id: String(flock.farm_id), reason: `Record the ${eventType} health evidence for ${eventDate} after the operating window closed.`, proposed_values: proposed, changed_fields: Object.keys(proposed), destination: `Health event on ${eventDate}`, correction_route: "/app/health"}});
    }
  }
  const vetName = String(body.external_veterinarian_name ?? "").trim();
  const recommendation = String(body.veterinarian_recommendation ?? "").trim();
  const reference = String(body.veterinarian_reference ?? "").trim();
  const attachment = String(body.attachment_url ?? "").trim();
  const recommendationStatus = String(body.recommendation_status ?? "").trim();
  const hasVetEvidence = Boolean(vetName || recommendation || reference || attachment || recommendationStatus);
  if (hasVetEvidence && (!vetName || !recommendation)) throw new FarmOperationError("Veterinarian name and recommendation are required when external guidance is recorded.");
  if (recommendationStatus && !["received", "planned", "implemented", "declined"].includes(recommendationStatus)) throw new FarmOperationError("Invalid recommendation status.");
  if (recommendationStatus === "declined" && String(body.treatment ?? "").trim().length < 8) throw new FarmOperationError("Declined guidance requires an explanation in the action taken field.");
  const inventoryItemId = String(body.inventory_item_id ?? "").trim() || null;
  const warehouseId = String(body.warehouse_id ?? "").trim() || null;
  const quantity = body.quantity == null || body.quantity === "" ? null : Number(body.quantity);
  if ((inventoryItemId || warehouseId || quantity !== null) && (!inventoryItemId || !warehouseId || quantity === null || !Number.isFinite(quantity) || quantity <= 0)) {
    throw new FarmOperationError("Medicine item, warehouse, and administered quantity must be supplied together.");
  }
  const row = {org_id: context.orgId, flock_id: flockId, event_date: eventDate, event_type: eventType, description: String(body.description ?? "").trim() || null, diagnosis: String(body.diagnosis ?? "").trim() || null, treatment: String(body.treatment ?? "").trim() || null, attachment_url: attachment || null, vet_id: context.userId, external_veterinarian_name: vetName || null, veterinarian_recommendation: recommendation || null, veterinarian_reference: reference || null, veterinarian_attachment: attachment ? {url: attachment} : null, recommendation_status: recommendationStatus || null};
  if (inventoryItemId) {
    const {data, error} = await (governanceAdmin as any).rpc("record_health_event_with_inventory", {p_actor_id: context.userId, p_flock_id: flockId, p_event_date: eventDate, p_event_type: eventType, p_event: row, p_item_id: inventoryItemId, p_warehouse_id: warehouseId, p_quantity: quantity});
    if (error) throw new FarmOperationError(error.message, error.code === "42501" ? 403 : error.code === "55000" ? 423 : 400);
    await recordAuditEvent(context, {eventType: "health_treatment.recorded_with_inventory", operation: "insert", entityTable: "health_events", entityId: String(data.event_id), reason: "Recorded treatment and medicine usage atomically.", after: data, farmId: String(flock.farm_id), flockId, warehouseId});
    return {kind: "health", data};
  }
  const {data, error} = await governanceAdmin.from("health_events").insert(row).select("*").single();
  if (error) throw new FarmOperationError(error.message);
  await recordAuditEvent(context, {eventType: "health_evidence.recorded", operation: "insert", entityTable: "health_events", entityId: String(data.id), reason: `Recorded ${eventType} health evidence.`, after: data, farmId: String(flock.farm_id), flockId});
  return {kind: "health", data};
}
