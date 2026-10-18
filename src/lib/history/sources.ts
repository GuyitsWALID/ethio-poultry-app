import type {HistoryCategory, HistoryField, HistoryRow} from "./contracts.ts";

type Field = {key: string; format?: HistoryField["format"]; unit?: string};
export type HistorySource = {kind: string; category: HistoryCategory; table: string; date: string; scope: "flock" | "farm" | "warehouse" | "expense" | "sale"; fields: Field[]; columns?: string[]; voided?: boolean; predicate?: "sessions" | "losses" | "health" | "vaccination" | "biosecurity"};
const numbers = (...keys: string[]): Field[] => keys.map(key => ({key, format: "number"}));
const notes = (...keys: string[]): Field[] => keys.map(key => ({key}));
export const historySources: HistorySource[] = [
  {kind: "daily_record", category: "daily", table: "daily_farm_records", date: "record_date", scope: "flock", voided: true, fields: [...numbers("opening_birds", "closing_birds", "deaths", "culls", "transfers_in", "transfers_out", "other_removals", "normal_eggs", "broken_eggs", "dirty_eggs", "total_eggs"), {key: "water_consumed_liters", format: "number", unit: "L"}, {key: "feed_leftover_grams", format: "number", unit: "g"}, ...notes("deaths_cause", "medication_vitamins", "vaccination_status")]},
  {kind: "feed_session", category: "feeding", table: "feeding_session_records", date: "record_date", scope: "flock", voided: true, predicate: "sessions", columns: ["warehouse_id", "feed_item_id", "batch_id", "status"], fields: [...notes("session_name", "session_time"), {key: "planned_feed_kg", format: "number", unit: "kg"}, {key: "actual_feed_kg", format: "number", unit: "kg"}, ...numbers("feeders_count"), {key: "feed_type", format: "code"}, ...notes("notes")]},
  {kind: "feed_close", category: "feeding", table: "feed_day_closures", date: "record_date", scope: "flock", columns: ["batch_id", "status"], fields: [{key: "actual_feed_kg", format: "number", unit: "kg"}, {key: "planned_feed_kg", format: "number", unit: "kg"}, {key: "variance_kg", format: "number", unit: "kg"}, {key: "closed_at", format: "datetime"}, ...notes("override_reason", "reopen_reason")]},
  {kind: "loss_record", category: "losses", table: "daily_farm_records", date: "record_date", scope: "flock", voided: true, predicate: "losses", fields: [...numbers("deaths", "culls", "opening_birds", "closing_birds"), ...notes("deaths_cause")]},
  {kind: "mortality_event", category: "losses", table: "mortality_events", date: "record_date", scope: "flock", fields: [...numbers("count"), ...notes("cause", "diagnosis", "recorded_time", "notes")]},
  {kind: "health_event", category: "health", table: "health_events", date: "event_date", scope: "flock", voided: true, predicate: "health", fields: [{key: "event_type", format: "code"}, ...notes("diagnosis", "description", "treatment", "external_veterinarian_name", "veterinarian_recommendation", "veterinarian_reference")]},
  {kind: "vaccination_completion", category: "health", table: "health_events", date: "event_date", scope: "flock", voided: true, predicate: "vaccination", columns: ["description"], fields: []},
  {kind: "biosecurity_check", category: "health", table: "biosecurity_checks", date: "checklist_date", scope: "farm", voided: true, predicate: "biosecurity", columns: ["completed_by"], fields: notes("notes")},
  {kind: "weight_record", category: "health", table: "weight_records", date: "record_date", scope: "flock", fields: [{key: "average_weight_g", format: "number", unit: "g"}, {key: "min_weight_g", format: "number", unit: "g"}, {key: "max_weight_g", format: "number", unit: "g"}, ...numbers("sample_count"), {key: "uniformity_pct", format: "number", unit: "%"}]},
  {kind: "stock_movement", category: "stock", table: "history_stock_movements", date: "operating_date", scope: "warehouse", columns: ["item_id", "farm_id", "house_id", "flock_id", "batch_id", "daily_record_id"], fields: [{key: "transaction_type", format: "code"}, ...numbers("quantity"), {key: "unit_cost", format: "money"}, ...notes("supplier_name", "invoice_number", "reference_doc", "notes")]},
  {kind: "physical_count", category: "stock", table: "inventory_physical_counts", date: "count_date", scope: "warehouse", columns: ["item_id"], fields: [...numbers("ledger_quantity", "counted_quantity", "variance"), ...notes("notes")]},
  {kind: "sale", category: "sales", table: "daily_sales_records", date: "sale_date", scope: "sale", voided: true, columns: ["farm_id", "house_id", "flock_id", "batch_id"], fields: [...notes("product_label", "unit"), ...numbers("quantity"), ...["unit_price", "gross_amount", "paid_amount", "balance_due"].map(key => ({key, format: "money" as const})), ...notes("customer_name", "payment_method", "notes")]},
  {kind: "expense", category: "expenses", table: "cost_entries", date: "entry_date", scope: "expense", columns: ["farm_id", "house_id", "flock_id", "batch_id", "warehouse_id"], fields: [{key: "category", format: "code"}, ...notes("description"), {key: "amount", format: "money"}, ...notes("supplier_name", "invoice_number", "reference_doc")]},
  {kind: "operating_day", category: "closing", table: "farm_operating_days", date: "operating_date", scope: "farm", columns: ["status", "exceptions"], fields: [{key: "closed_at", format: "datetime"}, {key: "locked_at", format: "datetime"}]},
];
export function sourceColumns(source: HistorySource) {
  const scope = source.scope === "flock" ? "flock_id" : source.scope === "warehouse" ? "warehouse_id" : "farm_id";
  return [...new Set(["id", "org_id", source.date, scope, "created_at", "updated_at", ...source.fields.map(field => field.key), ...source.columns ?? []])].join(",");
}
export function historyFields(source: HistorySource, row: HistoryRow): HistoryField[] {
  return source.fields.map(field => {
    const value = row[field.key];
    if (field.format === "number" || field.format === "money") return {...field, value: value !== null && value !== undefined && value !== "" && (typeof value === "number" || typeof value === "string") && Number.isFinite(Number(value)) ? Number(value) : null};
    return {...field, value: typeof value === "number" || typeof value === "string" ? value : null};
  });
}
