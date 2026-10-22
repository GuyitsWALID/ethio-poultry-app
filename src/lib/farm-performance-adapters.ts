import type {ReportInput} from "./report-workspace";
import type {OperationsAnalyticsResponse} from "./operational-analytics";
import type {ReportEvidence, EvidenceRow} from "./report-evidence";
import {calculateReportFcr} from "./feed-calculations.ts";
import {reportStockWindow} from "./report-safety.ts";
import {buildHistoryHref} from "./history/contracts.ts";
import {evidenceHref, metric, performancePeriod, section, PerformanceError, type PerformanceCoverage, type PerformanceRow, type PerformanceSection} from "./farm-performance.ts";

export const knownNumber = (value: unknown): number | null => (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value)) ? Number(value) : null;
const sum = (rows: EvidenceRow[], key: string): number | null => rows.every(row => knownNumber(row[key]) !== null) ? rows.reduce((total, row) => total + Number(row[key]), 0) : null;
export type PerformanceWarehouse = {id: string; name: string; farm_id: string | null; branch_id: string; status: string};
export function selectPerformanceWarehouses(warehouses: PerformanceWarehouse[], input: ReportInput, farmIds: string[], branchIds: string[]) {
  const narrowed = Boolean(input.farmId || input.houseId || input.flockId || input.batchId);
  return warehouses.filter(row => row.status === "active" && (!input.warehouseId || row.id === input.warehouseId)
    && (!input.branchId || row.branch_id === input.branchId)
    && (!narrowed || (row.farm_id ? farmIds.includes(row.farm_id) : branchIds.includes(row.branch_id))));
}
export type StockLedgerRow = {item_id: string; warehouse_id: string; transaction_type: string; quantity: number; transaction_date: string};
export function projectStockPerformance(input: ReportInput, warehouses: PerformanceWarehouse[], items: EvidenceRow[], ledger: StockLedgerRow[], now = Date.now()): PerformanceSection {
  const itemIds = new Set(items.map(row => String(row.id)));
  if (ledger.some(row => !itemIds.has(row.item_id))) throw new PerformanceError("REPORT_EVIDENCE_CONFLICT", 409);
  const prior = performancePeriod(input);
  const rows: PerformanceRow[] = [];
  let value = 0, priorValue = 0, priced = true, low = 0;
  for (const warehouse of warehouses) {
    const relevant = ledger.filter(row => row.warehouse_id === warehouse.id);
    const byItem = new Map<string, StockLedgerRow[]>();
    for (const entry of relevant) {const list = byItem.get(entry.item_id) ?? []; list.push(entry); byItem.set(entry.item_id, list);}
    for (const item of items) {
      const entries = byItem.get(String(item.id));
      if (!entries) continue;
      const current = reportStockWindow(entries, input.dateFrom, input.dateTo, now);
      const previous = reportStockWindow(entries, prior.previousFrom, prior.previousTo, now);
      const during = current.during;
      const receipts = during.filter(row => ["receipt", "opening_balance"].includes(row.transaction_type)).reduce((total, row) => total + Math.abs(Number(row.quantity)), 0);
      const consumption = during.filter(row => ["issue", "return"].includes(row.transaction_type)).reduce((total, row) => total + Math.abs(Number(row.quantity)) * (row.transaction_type === "return" ? -1 : 1), 0);
      const cost = knownNumber(item.unit_cost);
      if (cost === null || cost < 0) priced = false;
      else {value += current.periodEnd * cost; priorValue += previous.periodEnd * cost;}
      const reorder = knownNumber(item.reorder_level);
      if (reorder !== null && current.current <= reorder) low++;
      rows.push({label: String(item.name), context: warehouse.name, unit: String(item.unit), values: {opening: current.opening, periodEnd: current.periodEnd, current: current.current, received: receipts, consumption, previousPeriodEnd: previous.periodEnd, estimatedPeriodEndValue: cost === null || cost < 0 ? null : current.periodEnd * cost}, evidenceHref: buildHistoryHref({category: "stock", from: input.dateFrom, to: input.dateTo, warehouse: warehouse.id})});
    }
  }
  const result = section([metric("estimatedPeriodEndValue", "ETB", rows.length && priced ? value : null, rows.length && priced ? priorValue : null, null, "CURRENT_PRICE_ESTIMATE"), metric("currentLowStockItems", "items", rows.length ? low : null, null, null, "RECORDED_TOTAL")], [], null, evidenceHref("stock", input), ["WAREHOUSE_LEVEL_BALANCES", "CURRENT_PRICE_ESTIMATE"]);
  result.rows = rows;
  if (!rows.length) result.state = "empty";
  return result;
}

export type FeedingEvidence = {sessions: EvidenceRow[]; closures: EvidenceRow[]; daily: EvidenceRow[]; weights: EvidenceRow[]; flocks: EvidenceRow[]; ambiguousMovementDays: boolean};
export function projectFeedingPerformance(input: ReportInput, evidence: FeedingEvidence, operations: OperationsAnalyticsResponse): PerformanceSection {
  const prior = performancePeriod(input);
  const summarize = (from: string, to: string) => {
    const within = (row: EvidenceRow) => String(row.record_date) >= from && String(row.record_date) <= to;
    const sessions = evidence.sessions.filter(within), daily = evidence.daily.filter(within);
    const closures = evidence.closures.filter(row => within(row) && row.status === "closed");
    const resolved = sessions.filter(row => ["completed", "missed"].includes(String(row.status)));
    const actual = resolved.length ? sum(sessions.filter(row => row.status === "completed"), "actual_feed_kg") : null;
    const plan = sessions.length ? sum(sessions, "planned_feed_kg") : null;
    const closedKeys = new Set(closures.map(row => `${row.flock_id}:${row.record_date}`));
    const fcr = calculateReportFcr(evidence.flocks.filter(flock => daily.some(row => row.flock_id === flock.id)), daily, evidence.weights.filter(within));
    return {sessions, daily, actual, plan, closed: closedKeys.size, resolved: resolved.length, fcr};
  };
  const current = summarize(input.dateFrom, input.dateTo), previous = summarize(prior.previousFrom, prior.previousTo);
  const expected = operations.summary.current.expectedRecords;
  const coverage: PerformanceCoverage = {recorded: current.closed, expected, percent: operations.summary.current.recordCoveragePct === null ? null : expected ? current.closed / expected * 100 : null};
  const make = (key: string, unit: "kg" | "sessions" | "flock-days" | "kg/kg", value: number | null, previous: number | null) => metric(key, unit, value, previous, coverage, "RECORDED_SESSION_PLAN_ONLY");
  const result = section([
    make("sessionActualKg", "kg", current.actual, previous.actual), make("sessionPlannedKg", "kg", current.plan, previous.plan),
    make("resolvedSessions", "sessions", current.sessions.length ? current.resolved : null, previous.sessions.length ? previous.resolved : null),
    make("closedFeedDays", "flock-days", expected ? current.closed : null, operations.summary.previous.expectedRecords ? previous.closed : null),
    metric("layerFcr", "kg/kg", current.fcr.layer, previous.fcr.layer, coverage, "LAYER_FCR_ONLY"), metric("growthFcr", "kg/kg", current.fcr.growth, previous.fcr.growth, coverage, "GROWTH_FCR_ONLY"),
    metric("feedKg", "kg", operations.summary.current.feedKg, operations.summary.previous.feedKg, coverage, "RECORDED_TOTAL"),
    metric("feedPerBirdGrams", "g/bird/day", operations.summary.current.feedPerBirdGrams, operations.summary.previous.feedPerBirdGrams, coverage, "WEIGHTED_RATE"),
  ], [], coverage, evidenceHref("feeding", input), ["RECORDED_SESSION_PLAN_ONLY", "INCOMPLETE_FEED_DAYS", "FEED_NOT_A_HEALTH_DIAGNOSIS"]);
  result.rows = current.sessions.map(row => ({label: String(row.session_name), date: String(row.record_date), context: String(evidence.flocks.find(flock => flock.id === row.flock_id)?.flock_code ?? ""), unit: "kg", values: {planned: knownNumber(row.planned_feed_kg), actual: row.status === "completed" ? knownNumber(row.actual_feed_kg) : row.status === "missed" ? 0 : null}, evidenceHref: buildHistoryHref({category: "feeding", from: input.dateFrom, to: input.dateTo}, {kind: "feed_session", id: String(row.id)})}));
  result.breakdowns = [{key: "feedTypes", unit: "kg", rows: [...new Set(current.sessions.map(row => String(row.feed_type ?? "unavailable")))].map(label => ({label, value: sum(current.sessions.filter(row => String(row.feed_type ?? "unavailable") === label && row.status === "completed"), "actual_feed_kg")}))}];
  result.breakdowns.push({key: "sessionStatus", unit: "sessions", rows: [
    {label: "completed", value: current.sessions.filter(row => row.status === "completed").length},
    {label: "missed", value: current.sessions.filter(row => row.status === "missed").length},
    {label: "unfinished", value: current.sessions.filter(row => !["completed", "missed"].includes(String(row.status))).length},
  ]});
  result.series = ["actual", "planned"].map(key => ({key: `session_${key}`, unit: "kg" as const, points: [...new Set(current.sessions.map(row => String(row.record_date)))].sort().map(date => {
    const sessions = current.sessions.filter(row => row.record_date === date);
    return {date, value: key === "planned" ? sum(sessions, "planned_feed_kg") : sessions.some(row => !["completed", "missed"].includes(String(row.status))) ? null : sum(sessions.filter(row => row.status === "completed"), "actual_feed_kg")};
  })}));
  if (evidence.ambiguousMovementDays) result.explanations.push("AMBIGUOUS_MOVEMENT_DAY_EXCLUDED");
  result.series.push({key: "feedPerBirdGrams", unit: "g/bird/day", points: operations.trends.map(row => ({date: row.date, value: row.feedPerBirdGrams}))});
  if (!expected && !current.sessions.length) result.state = "empty";
  return result;
}

export type SalesPerformanceData = {kpis: {records: number; revenue: number; paid: number; balanceDue: number; estimatedProfit: number | null; marginStatus: string}; charts: {daily: Array<{label: string; revenue: number; paid: number; balanceDue: number}>}};
export function projectSalesPerformance(input: ReportInput, current: SalesPerformanceData, previous: SalesPerformanceData, expenses: ReportEvidence, previousExpenses: ReportEvidence): PerformanceSection {
  const make = (key: "revenue" | "paid" | "balanceDue" | "estimatedProfit") => metric(key, "ETB", current.kpis[key], previous.kpis[key], null, key === "paid" ? "COLLECTIONS_AGAINST_SELECTED_SALES" : key === "estimatedProfit" ? current.kpis.marginStatus === "tracked" ? "RECONCILED_MARGIN" : "ESTIMATED_MARGIN" : "RECORDED_TOTAL");
  const result = section([make("revenue"), make("paid"), make("balanceDue"), make("estimatedProfit"), metric("expenses", "ETB", expenses.expenseTotal ?? null, previousExpenses.expenseTotal ?? null, null, "RECORDED_TOTAL")], ["revenue", "paid", "balanceDue"].map(key => ({key, unit: "ETB", points: current.charts.daily.map(row => ({date: row.label, value: row[key as "revenue" | "paid" | "balanceDue"]}))})), null, evidenceHref("sales", input), ["COLLECTIONS_AGAINST_SELECTED_SALES", current.kpis.marginStatus === "tracked" ? "RECONCILED_MARGIN" : "ESTIMATED_MARGIN"]);
  result.rows = expenses.items.filter(row => row.kind === "expense").map(row => ({label: row.label, date: row.date, context: row.context, unit: "ETB", values: {amount: row.amount ?? null}, evidenceHref: row.sourceId ? buildHistoryHref({category: "expenses", from: input.dateFrom, to: input.dateTo}, {kind: "expense", id: row.sourceId}) : evidenceHref("expenses", input)}));
  const expenseRows = expenses.items.filter(row => row.kind === "expense");
  result.breakdowns = [{key: "expenseCategories", unit: "ETB", rows: [...new Set(expenseRows.map(row => row.category || "unavailable"))].map(label => {
    const entries = expenseRows.filter(row => (row.category || "unavailable") === label);
    return {label, value: entries.every(row => row.amount !== undefined) ? entries.reduce((total, row) => total + row.amount!, 0) : null};
  })}];
  if (!current.kpis.records && !result.rows.length) result.state = "empty";
  return result;
}
