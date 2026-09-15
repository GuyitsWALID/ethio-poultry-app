/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { canAccessFarm, canAccessWarehouse, governanceAdmin, type AccessContext } from "@/lib/access-context";
import { formatReconciliationNumber } from "@/lib/reconciliation-presentation";
import { reconciliationWorkflow } from "@/lib/reconciliation-workflow";
import { resolutionHref, resolutionRules, type ReconciliationResolution, type ResolutionAction, type ResolutionOwner, type ResolutionSourceRecord } from "@/lib/reconciliation-resolution-contract";

type Row = Record<string, any>;
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

async function eligibleOwners(ctx: AccessContext, finding: Row): Promise<ResolutionOwner[]> {
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
      const { data } = await db.from("user_warehouse_access").select("warehouses(name)").eq("org_id", ctx.orgId).eq("profile_id", person.id).eq("warehouse_id", finding.warehouse_id).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();
      allowed = Boolean(data); if (data?.warehouses?.name) scopes.push(text(data.warehouses.name));
    }
    if (allowed) owners.push({ id: text(person.id), name: text(person.full_name) || "Farm Manager", scope: scopes.join(" · ") || "Organization assignment" });
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
async function sourceRecords(ctx: AccessContext, finding: Row): Promise<ResolutionSourceRecord[]> {
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
  const records: ResolutionSourceRecord[] = [];
  for (const specification of specifications) for (const key of specification.keys) {
    const ids = (Array.isArray(evidence[key]) ? evidence[key] : evidence[key] ? [evidence[key]] : []).map(String);
    if (!ids.length) continue;
    const { data } = await db.from(specification.table).select(specification.columns).eq("org_id", ctx.orgId).in("id", ids);
    for (const row of data ?? []) records.push({ label: specification.title(row), fields: Object.entries(row).filter(([field]) => field !== "id" && field !== "flock_id").map(([field, value]) => ({ label: fieldLabels[field] ?? field.replaceAll("_", " "), value: display(value) })) });
  }
  if (finding.flock_id && finding.record_date && text(finding.rule_code) === "MORTALITY_ALLOCATION_MISMATCH") {
    const { data } = await db.from("mortality_events").select("record_date,count,cause").eq("org_id", ctx.orgId).eq("flock_id", finding.flock_id).eq("record_date", finding.record_date);
    for (const [index, row] of (data ?? []).entries()) records.push({ label: `Mortality event ${index + 1} · ${display(row.record_date)}`, fields: [{ label: "Birds", value: display(row.count) }, { label: "Cause", value: display(row.cause) }] });
  }
  const contextualFields = Object.entries(evidence).flatMap(([field, value]) => {
    const readable = readableEvidenceField(field);
    return readable ? [{ label: readable, value: display(value) }] : [];
  });
  if (contextualFields.length) records.push({ label: "Values captured when the difference was found", fields: contextualFields });
  return records;
}

export async function loadFindingResolution(ctx: AccessContext, findingId: string): Promise<ReconciliationResolution> {
  const { data: finding, error } = await db.from("reconciliation_findings").select("*").eq("id", findingId).eq("org_id", ctx.orgId).maybeSingle();
  if (error) throw error;
  if (!finding) throw Object.assign(new Error("Record Check not found."), { status: 404 });
  await assertFindingAccess(ctx, finding);
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
  }, ctx.role);
  const unit = text(finding.unit);
  const scopeLabel = [farmName, houseName, flockCode, batchCode, warehouseName, finding.record_date].filter(Boolean).join(" · ") || "Organization-wide check";
  const action = actionView(actionResult.data ?? null);
  if (action && ["cleared", "resolved"].includes(text(finding.status))) action.sourceCorrected = true;
  const resolvedSourceRecords = await sourceRecords(ctx, finding);
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
  return {
    findingId, ruleCode: text(finding.rule_code), status: text(finding.status), title: workflow.plainTitle,
    problem: workflow.plainExplanation, scopeLabel, recordDate: finding.record_date ? text(finding.record_date) : null,
    mode: rule.mode,
    correction: { label: rule.label, href: resolutionHref(rule.path, findingId), page: rule.page, instruction: rule.instruction, focusFields: rule.focusFields },
    comparison: {
      expected: formatReconciliationNumber(finding.expected_value, unit, "Evidence unavailable"),
      recorded: formatReconciliationNumber(finding.recorded_value, unit, "Evidence unavailable"),
      difference: formatReconciliationNumber(finding.variance, unit, "Evidence gap"),
    },
    choices,
    sourceRecords: resolvedSourceRecords,
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
    eligibleOwners: await eligibleOwners(ctx, finding),
  };
}
