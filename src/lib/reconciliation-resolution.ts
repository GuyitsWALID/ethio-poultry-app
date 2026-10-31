/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import {getLocale, getTranslations} from "next-intl/server";
import {formatNumber, formatOperationDate} from "@/i18n/formats";

import { canAccessFarm, canAccessWarehouse, governanceAdmin, type AccessContext } from "@/lib/access-context";
import {managerWarehouseAccess} from "@/lib/warehouse-access";
import { formatReconciliationNumber } from "@/lib/reconciliation-presentation";
import { reconciliationWorkflow } from "@/lib/reconciliation-workflow";
import {recordingStartBlocker, type RecordingStartContext} from "@/lib/recording-start-contract";
import {addisOperatingDate} from "@/lib/flock-lifecycle/server";
import { resolutionHref, resolutionRules, type ReconciliationResolution, type ResolutionAction, type ResolutionOwner, type ResolutionSourceRecord } from "@/lib/reconciliation-resolution-contract";

type Row = Record<string, any>;
const resolutionPageKeys: Record<string, string> = {
  "BIRD_DAY_COUNTS_MISSING": "daily",
  "BIRD_DAY_IMBALANCE": "daily",
  "EGG_CLASSIFICATION_MISMATCH": "daily",
  "LOCKED_RECORD_CHANGED_WITHOUT_APPROVAL": "daily",
  "BIRD_DAY_CONTINUITY_BREAK": "daily",
  "EGG_OPENING_BALANCE_UNAVAILABLE": "daily",
  "MORTALITY_ALLOCATION_MISMATCH": "mortality",
  "FLOCK_CURRENT_COUNT_MISMATCH": "flocksDaily",
  "FEED_SESSION_CLOSE_MISMATCH": "feed",
  "FEED_DAILY_SYNC_MISMATCH": "feed",
  "FEED_STOCK_ISSUE_MISMATCH": "feedStock",
  "EGG_SALE_UNLINKED": "sales",
  "EGG_SALE_UNIT_UNCONVERTED": "sales",
  "EGG_SALES_EXCEED_PRODUCTION": "sales",
  "POSSIBLE_DUPLICATE_SALE": "sales",
  "PHYSICAL_STOCK_VARIANCE": "stock",
  "REPEATED_STOCK_ADJUSTMENTS": "stock",
  "COST_ALLOCATION_MISMATCH": "financial",
  "LOCKED_FINANCIAL_PERIOD_HAS_GAPS": "financial",
  "PAST_FINANCIAL_PERIOD_UNLOCKED": "financial",
  "ACTIVE_FLOCK_LINEAGE_BROKEN": "flocks",
  "BATCH_FLOCK_PLACEMENT_MISMATCH": "flocks"
};
type SourceEvidence = Omit<ResolutionSourceRecord, "fields"> & {sourceType?: string; sourceDate?: string | null; sourceEndDate?: string | null; sourceContext?: string | null; fields: Array<{label: string; value: string; key?: string; rawValue?: unknown}>};
const db = governanceAdmin as any;
const text = (value: unknown) => typeof value === "string" ? value : value == null ? "" : String(value);

async function assertFindingAccess(ctx: AccessContext, finding: Row) {
  if (ctx.role === "ceo" || ctx.supportSessionId) return;
  if (finding.farm_id && await canAccessFarm(ctx, text(finding.farm_id))) return;
  if (finding.warehouse_id && await canAccessWarehouse(ctx, text(finding.warehouse_id))) return;
  throw Object.assign(new Error("This Record Check is outside your active assignment."), { status: 403 });
}

async function label(table: string, id: unknown, column: string) {
  if (!id) return null;
  const { data } = await db.from(table).select(column).eq("id", id).maybeSingle();
  return data?.[column] ? text(data[column]) : null;
}

async function eligibleOwners(ctx: AccessContext, finding: Row, labels: {manager: string; organization: string}): Promise<ResolutionOwner[]> {
  if (ctx.role !== "ceo") return [];
  const now = new Date().toISOString();
  const { data: people } = await db.from("profiles").select("id,full_name").eq("org_id", ctx.orgId).eq("role", "farm_manager").eq("is_active", true).order("full_name");
  const owners: ResolutionOwner[] = [];
  for (const person of people ?? []) {
    let allowed = true;
    const scopes: string[] = [];
    if (finding.farm_id) {
      const { data } = await db.from("user_farm_access").select("farms(name)").eq("org_id", ctx.orgId).eq("profile_id", person.id).eq("farm_id", finding.farm_id).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();
      allowed = Boolean(data); if (data?.farms?.name) scopes.push(text(data.farms.name));
    }
    if (allowed && finding.warehouse_id) {
      const store = (await managerWarehouseAccess(text(person.id), ctx.orgId)).find(row => row.id === finding.warehouse_id);
      allowed = Boolean(store); if (store) scopes.push(store.name);
    }
    if (allowed) owners.push({ id: text(person.id), name: text(person.full_name) || labels.manager, scope: scopes.join(" · ") || labels.organization });
  }
  return owners;
}

function actionView(row: Row | null): ResolutionAction | null {
  if (!row) return null;
  return {
    actionId: text(row.id), status: row.status, ownerId: row.owner_id ? text(row.owner_id) : null,
    ownerName: row.owner?.full_name ? text(row.owner.full_name) : null, dueAt: text(row.due_at),
    sourceCorrected: Boolean(row.source_resolved_at), resolutionSummary: row.resolution_summary ? text(row.resolution_summary) : null,
  };
}

const fieldLabels: Record<string, string> = { record_date: "Date", opening_birds: "Opening birds", closing_birds: "Closing birds", deaths: "Deaths", culls: "Culls", transfers_in: "Transfers in", transfers_out: "Transfers out", other_removals: "Other removals", total_eggs: "Eggs collected", normal_eggs: "Normal eggs", broken_eggs: "Broken eggs", dirty_eggs: "Dirty eggs", sale_date: "Sale date", product_label: "Product", quantity: "Quantity", unit: "Unit", gross_amount: "Gross amount", customer_name: "Customer", transaction_date: "Movement date", transaction_type: "Movement type", reference_doc: "Reference", count_date: "Count date", ledger_quantity: "System quantity", counted_quantity: "Counted quantity", period_start: "Period start", period_end: "Period end", status: "Status", unallocated_cost: "Unallocated cost", reconciliation_warnings: "Warnings", entry_date: "Entry date", category: "Category", description: "Description", amount: "Amount", allocation_method: "Allocation method", actual_feed_kg: "Closed feed", initial_count: "Placed birds", flock_code: "Flock" };
function display(value: unknown) { if (value === null || value === undefined || value === "") return "Unavailable"; if (Array.isArray(value)) return `${value.length} recorded warning${value.length === 1 ? "" : "s"}`; if (typeof value === "object") return "Supporting details recorded"; return text(value).replaceAll("_", " "); }
function readableEvidenceField(field: string) {
  if (/id$|ids$|recordedby|countedby|sourcekey/i.test(field)) return null;
  const words = field.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
async function sourceRecords(ctx: AccessContext, finding: Row): Promise<SourceEvidence[]> {
  const evidence = finding.evidence && typeof finding.evidence === "object" ? finding.evidence as Row : {};
  const specifications: Array<{ keys: string[]; table: string; columns: string; title: (row: Row) => string }> = [
    { keys: ["dailyRecordId", "priorDailyRecordId", "currentDailyRecordId"], table: "daily_farm_records", columns: "id,flock_id,record_date,opening_birds,closing_birds,deaths,culls,transfers_in,transfers_out,other_removals,total_eggs,normal_eggs,broken_eggs,dirty_eggs", title: row => `Daily Record · ${display(row.record_date)}` },
    { keys: ["saleId", "saleIds"], table: "daily_sales_records", columns: "id,sale_date,product_label,quantity,unit,gross_amount,customer_name", title: row => `Sale · ${display(row.sale_date)} · ${display(row.product_label)}` },
    { keys: ["movementIds"], table: "stock_ledger", columns: "id,transaction_date,transaction_type,quantity,reference_doc", title: row => `Stock movement · ${display(row.transaction_date)}` },
    { keys: ["closureId"], table: "feed_day_closures", columns: "id,record_date,actual_feed_kg,status", title: row => `Feed close · ${display(row.record_date)}` },
    { keys: ["physicalCountId"], table: "inventory_physical_counts", columns: "id,count_date,ledger_quantity,counted_quantity", title: row => `Physical count · ${display(row.count_date)}` },
    { keys: ["periodId"], table: "monthly_cost_periods", columns: "id,period_start,period_end,status,unallocated_cost,reconciliation_warnings", title: row => `Financial period · ${display(row.period_start)} to ${display(row.period_end)}` },
    { keys: ["costEntryId"], table: "cost_entries", columns: "id,entry_date,category,description,amount,allocation_method", title: row => `Cost record · ${display(row.description)}` },
    { keys: ["flockIds"], table: "flocks", columns: "id,flock_code,initial_count,status", title: row => `Flock placement · ${display(row.flock_code)}` },
  ];
  const records: SourceEvidence[] = [];
  for (const specification of specifications) for (const key of specification.keys) {
    const ids = (Array.isArray(evidence[key]) ? evidence[key] : evidence[key] ? [evidence[key]] : []).map(String);
    if (!ids.length) continue;
    const { data } = await db.from(specification.table).select(specification.columns).eq("org_id", ctx.orgId).in("id", ids);
    for (const row of data ?? []) records.push({ label: specification.title(row), sourceType: specification.table, sourceDate: row.record_date ?? row.sale_date ?? row.transaction_date ?? row.count_date ?? row.period_start ?? null, sourceEndDate: row.period_end ?? null, sourceContext: row.description ?? row.product_label ?? row.flock_code ?? null, fields: Object.entries(row).filter(([field]) => field !== "id" && field !== "flock_id").map(([field, value]) => ({ label: fieldLabels[field] ?? field.replaceAll("_", " "), value: display(value), key: field, rawValue: value })) });
  }
  if (finding.flock_id && finding.record_date && text(finding.rule_code) === "MORTALITY_ALLOCATION_MISMATCH") {
    const { data } = await db.from("mortality_events").select("record_date,count,cause").eq("org_id", ctx.orgId).eq("flock_id", finding.flock_id).eq("record_date", finding.record_date);
    for (const [index, row] of (data ?? []).entries()) records.push({ label: `Mortality event ${index + 1} · ${display(row.record_date)}`, sourceType: "mortality_events", sourceDate: row.record_date, sourceContext: String(index + 1), fields: [{ label: "Birds", value: display(row.count), key: "count", rawValue: row.count }, { label: "Cause", value: display(row.cause), key: "cause", rawValue: row.cause }] });
  }
  const contextualFields = Object.entries(evidence).flatMap(([field, value]) => {
    const readable = readableEvidenceField(field);
    return readable ? [{ label: readable, value: display(value), key: field, rawValue: value }] : [];
  });
  if (contextualFields.length) records.push({ label: "Values captured when the difference was found", sourceType: "captured", fields: contextualFields });
  return records;
}

export async function loadFindingResolution(ctx: AccessContext, findingId: string): Promise<ReconciliationResolution> {
  const locale = await getLocale();
  const guidance = await getTranslations("RecordCheckGuidance");
  const feedback = await getTranslations("OperationFeedback");
  const resolutionText = await getTranslations("ResolutionGuidance");
  const fieldText = await getTranslations("History.fields");
  const codeText = await getTranslations("History.codes");
  const { data: finding, error } = await db.from("reconciliation_findings").select("*").eq("id", findingId).eq("org_id", ctx.orgId).maybeSingle();
  if (error) throw error;
  if (!finding) throw Object.assign(new Error("Record Check not found."), { status: 404 });
  await assertFindingAccess(ctx, finding);
  // A physical count establishes today's baseline, never repairs a historical
  // Daily Record. The same validator and authorized context protect submission.
  let recordingStart: ReconciliationResolution["recordingStart"];
  if (ctx.role === "farm_manager" && !ctx.supportSessionId && finding.flock_id && finding.farm_id
    && !["cleared", "resolved", "accepted_exception"].includes(text(finding.status))
    && ["EGG_OPENING_BALANCE_UNAVAILABLE", "BIRD_DAY_COUNTS_MISSING", "FLOCK_CURRENT_COUNT_MISMATCH"].includes(text(finding.rule_code))) {
    const result = await db.rpc("recording_start_context", {p_actor: ctx.userId, p_flock: finding.flock_id});
    // Archived and revoked targets keep only their existing correction paths.
    if (result.error && !["23514", "42501"].includes(result.error.code)) throw result.error;
    const context = result.data as (RecordingStartContext & {farm_id: string}) | null;
    const today = addisOperatingDate();
    if (!result.error && context && context.farm_id === finding.farm_id && !recordingStartBlocker(context, today, today)) {
      recordingStart = {farmId: context.farm_id, flockId: text(finding.flock_id), workDate: today,
        eggProducing: ["layer", "parent_stock"].includes(context.flock_type)};
    }
  }
  const [farmName, houseName, flockCode, batchCode, warehouseName, actionResult] = await Promise.all([
    label("farms", finding.farm_id, "name"), label("houses", finding.house_id, "name"), label("flocks", finding.flock_id, "flock_code"),
    label("batches", finding.batch_id, "batch_code"), label("warehouses", finding.warehouse_id, "name"),
    db.from("operational_actions").select("*,owner:profiles!operational_actions_owner_id_fkey(full_name)").eq("org_id", ctx.orgId).eq("source_key", `reconciliation-${findingId}`).maybeSingle(),
  ]);
  const rule = resolutionRules[text(finding.rule_code)];
  if (!rule) throw Object.assign(new Error("This Record Check does not yet have a safe correction route."), { status: 422 });
  const workflow = reconciliationWorkflow({
    id: findingId, rule_code: finding.rule_code, domain: finding.domain, severity: finding.severity, status: finding.status,
    title: finding.title, explanation: finding.explanation, recommended_action: finding.recommended_action,
    finding_date: finding.record_date, farm_id: finding.farm_id, house_id: finding.house_id, flock_id: finding.flock_id,
    batch_id: finding.batch_id, farm_name: farmName, flock_code: flockCode, warehouse_name: warehouseName,
  }, ctx.role, locale === "am" ? key => guidance(key as Parameters<typeof guidance>[0]) : undefined);
  const unit = text(finding.unit);
  const scopeLabel = [farmName, houseName, flockCode, batchCode, warehouseName, finding.record_date ? formatOperationDate(`${text(finding.record_date)}T12:00:00Z`, locale) : null].filter(Boolean).join(" · ") || feedback("organizationCheck");
  const action = actionView(actionResult.data ?? null);
  if (action && ["cleared", "resolved"].includes(text(finding.status))) action.sourceCorrected = true;
  const resolvedSourceRecords = await sourceRecords(ctx, finding);
  if (workflow.recordedExplanation) resolvedSourceRecords.push({label: guidance("recordedExplanation"), fields: [{label: guidance("recordedExplanation"), value: workflow.recordedExplanation}]});
  const choices = (rule.choices ?? []).map(choice => ({ ...choice, href: resolutionHref(choice.path, findingId, choice.id) }));
  if (text(finding.rule_code) === "EGG_OPENING_BALANCE_UNAVAILABLE") {
    const legacy = choices.find(choice => choice.id === "legacy_balance");
    if (legacy) {
      const evidence = finding.evidence && typeof finding.evidence === "object" ? finding.evidence as Row : {};
      const params = new URLSearchParams({ request_type: "egg_opening_balance", finding: findingId, source: "legacy_balance", farm_id: text(finding.farm_id), reason: `Establish evidenced opening egg custody for ${flockCode ?? "this legacy flock"}.`, destination: `${flockCode ?? "Flock"} opening egg balance`, correction_route: `/app/reconciliation?finding=${findingId}`, proposed_values: JSON.stringify({ flock_id: text(finding.flock_id), effective_date: text(evidence.placementDate), quantity: "", source_reference: "" }) });
      legacy.href = `/app/governance?${params.toString()}`;
    }
  }
  if (text(finding.rule_code) === "EGG_SALE_UNIT_UNCONVERTED") {
    const conversion = choices.find(choice => choice.id === "new_conversion");
    if (conversion) {
      const sale = resolvedSourceRecords.find(record => record.label.startsWith("Sale ·"));
      const unitValue = sale?.fields.find(field => field.label === "Unit")?.value ?? text(finding.unit);
      const params = new URLSearchParams({ request_type: "sales_unit_conversion", finding: findingId, source: "new_conversion", farm_id: text(finding.farm_id), reason: `Approve an evidence-based egg conversion for the sales unit “${unitValue}”.`, destination: `Sales unit conversion · ${unitValue}`, correction_route: `/app/reconciliation?finding=${findingId}`, proposed_values: JSON.stringify({ category: "egg", unit: unitValue, multiplier: "", source_reference: "" }) });
      conversion.href = `/app/governance?${params.toString()}`;
    }
  }
  const presentValue = (field: SourceEvidence["fields"][number]) => {
    const value = field.rawValue;
    if (!field.key || locale !== "am") return field.value;
    if (value === null || value === undefined || value === "") return resolutionText("missing");
    if (typeof value === "number") return formatNumber(value, locale);
    if (Array.isArray(value)) return resolutionText((field.key === "reconciliation_warnings" ? "warnings" : "entries") as Parameters<typeof resolutionText>[0], {count: value.length});
    if (typeof value === "object") return resolutionText("details");
    if (typeof value === "string" && /^(record_date|sale_date|transaction_date|count_date|period_start|period_end|entry_date)$/.test(field.key) && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatOperationDate(`${value}T12:00:00Z`, locale);
    if (["status", "transaction_type", "product_label", "allocation_method", "category", "unit"].includes(field.key) && codeText.has((String(value)) as Parameters<typeof codeText>[0])) return codeText((String(value)) as Parameters<typeof codeText>[0]);
    return field.value;
  };
  const presentedSources = resolvedSourceRecords.map(record => ({
    label: locale === "am" && record.sourceType ? [
      resolutionText((`sourceTypes.${record.sourceType}`) as Parameters<typeof resolutionText>[0]),
      record.sourceDate ? formatOperationDate(`${record.sourceDate}T12:00:00Z`, locale) : null,
      record.sourceEndDate ? formatOperationDate(`${record.sourceEndDate}T12:00:00Z`, locale) : null,
      record.sourceContext && codeText.has((record.sourceContext) as Parameters<typeof codeText>[0]) ? codeText((record.sourceContext) as Parameters<typeof codeText>[0]) : record.sourceContext,
    ].filter(Boolean).join(" · ") : record.label,
    fields: record.fields.map(field => ({
      label: locale === "am" && field.key ? fieldText.has((field.key) as Parameters<typeof fieldText>[0]) ? fieldText((field.key) as Parameters<typeof fieldText>[0]) : resolutionText.has((`fields.${field.key}`) as Parameters<typeof resolutionText>[0]) ? resolutionText((`fields.${field.key}`) as Parameters<typeof resolutionText>[0]) : field.label : field.label,
      value: presentValue(field),
    })),
  }));
  return {
    findingId, ruleCode: text(finding.rule_code), status: text(finding.status), title: workflow.plainTitle,
    problem: workflow.plainExplanation, scopeLabel, recordDate: finding.record_date ? text(finding.record_date) : null,
    mode: rule.mode,
    correction: { label: locale === "am" ? resolutionText((`rules.${finding.rule_code}.label`) as Parameters<typeof resolutionText>[0]) : rule.label, href: resolutionHref(rule.path, findingId), page: resolutionText((`pages.${resolutionPageKeys[finding.rule_code]}`) as Parameters<typeof resolutionText>[0]), instruction: locale === "am" ? resolutionText((`rules.${finding.rule_code}.instruction`) as Parameters<typeof resolutionText>[0]) : rule.instruction, focusFields: rule.focusFields },
    comparison: {
      expected: formatReconciliationNumber(finding.expected_value, locale === "am" && codeText.has((unit) as Parameters<typeof codeText>[0]) ? codeText((unit) as Parameters<typeof codeText>[0]) : unit, locale === "am" ? resolutionText("missing") : "Evidence unavailable", locale),
      recorded: formatReconciliationNumber(finding.recorded_value, locale === "am" && codeText.has((unit) as Parameters<typeof codeText>[0]) ? codeText((unit) as Parameters<typeof codeText>[0]) : unit, locale === "am" ? resolutionText("missing") : "Evidence unavailable", locale),
      difference: formatReconciliationNumber(finding.variance, locale === "am" && codeText.has((unit) as Parameters<typeof codeText>[0]) ? codeText((unit) as Parameters<typeof codeText>[0]) : unit, locale === "am" ? resolutionText("missing") : "Evidence gap", locale),
    },
    choices: locale === "am" ? choices.map(choice => ({...choice, label: resolutionText((`rules.${finding.rule_code}.choices.${choice.id}.label`) as Parameters<typeof resolutionText>[0]), explanation: resolutionText((`rules.${finding.rule_code}.choices.${choice.id}.explanation`) as Parameters<typeof resolutionText>[0])})) : choices,
    sourceRecords: presentedSources,
    ...(recordingStart ? {recordingStart} : {}),
    target: {
      farmName, houseName, flockCode, batchCode, warehouseName,
      date: text(finding.rule_code) === "EGG_OPENING_BALANCE_UNAVAILABLE" ? text((finding.evidence as Row | null)?.placementDate) || (finding.record_date ? text(finding.record_date) : null) : finding.record_date ? text(finding.record_date) : null,
      product: resolvedSourceRecords.find(record => record.label.startsWith("Sale ·"))?.fields.find(field => field.label === "Product")?.value ?? null,
      quantity: resolvedSourceRecords.find(record => record.label.startsWith("Sale ·"))?.fields.find(field => field.label === "Quantity")?.value ?? null,
      customer: resolvedSourceRecords.find(record => record.label.startsWith("Sale ·"))?.fields.find(field => field.label === "Customer")?.value ?? null,
    },
    verification: workflow.verification,
    canAssign: ctx.role === "ceo" && !["cleared", "resolved", "accepted_exception"].includes(text(finding.status)),
    canWork: ctx.role === "farm_manager" && action?.ownerId === ctx.userId,
    action,
    eligibleOwners: await eligibleOwners(ctx, finding, {manager: feedback("manager"), organization: feedback("organizationAssignment")}),
  };
}
