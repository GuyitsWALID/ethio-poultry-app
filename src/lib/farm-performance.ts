import type {OperationsAnalyticsResponse, PeriodSummary} from "./operational-analytics";
import type {ReportEvidence} from "./report-evidence";
import type {ReportInput} from "./report-workspace";
import {reportOperatingDate, reportTimestampBounds} from "./report-safety.ts";
import {buildHistoryHref, type HistoryCategory} from "./history/contracts.ts";

export type PerformanceUnit = "eggs" | "birds" | "kg" | "g/bird/day" | "%" | "kg/kg" | "deaths/1000-bird-days" | "events" | "ETB" | "items" | "sessions" | "flock-days";
export type PerformanceState = "available" | "partial" | "missing" | "empty" | "failed";
export type PerformanceCode = "RECORDED_TOTAL" | "WEIGHTED_RATE" | "PARTIAL_DAILY_RECORDS" | "MISSING_EVIDENCE" | "NO_APPLICABLE_RECORDS" | "FEED_NOT_A_HEALTH_DIAGNOSIS" | "LAYER_FCR_ONLY" | "RECORDED_HEALTH_EVENTS_ONLY" | "DAILY_LOSSES_NOT_SUPPORTING_EVENTS" | "REPORT_LOAD_FAILED" | "WAREHOUSE_LEVEL_BALANCES" | "CURRENT_PRICE_ESTIMATE" | "COLLECTIONS_AGAINST_SELECTED_SALES" | "ESTIMATED_MARGIN" | "RECONCILED_MARGIN" | "RECORDED_SESSION_PLAN_ONLY" | "INCOMPLETE_FEED_DAYS" | "GROWTH_FCR_ONLY" | "AMBIGUOUS_MOVEMENT_DAY_EXCLUDED";
export type PerformanceMetric = {
  key: string; unit: PerformanceUnit; value: number | null; previous: number | null;
  delta: number | null; deltaPct: number | null; state: PerformanceState; explanation: PerformanceCode;
};
export type PerformanceSeries = {key: string; unit: PerformanceUnit; points: Array<{date: string; value: number | null}>};
export type PerformanceCoverage = {recorded: number; expected: number; percent: number | null};
export type PerformanceSection = {
  state: PerformanceState; metrics: PerformanceMetric[]; series: PerformanceSeries[];
  coverage: PerformanceCoverage | null; explanations: PerformanceCode[]; evidenceHref: string;
  rows?: PerformanceRow[];
  rowCount?: number; rowsLimited?: boolean;
  breakdowns?: Array<{key: string; unit: PerformanceUnit; rows: Array<{label: string; value: number | null}>}>;
};
export type PerformanceRow = {label: string; date?: string; unit?: string; context?: string; values: Record<string, number | null>; evidenceHref?: string};
export type PerformanceResponse = {
  schemaVersion: 1;
  options?: {warehouses: Array<{id: string; name: string}>};
  concerns?: Array<{key: "coverage" | "criticalFlock" | "productionDown" | "mortalityUp" | "quality" | "targets"; severity: "critical" | "watch" | "info"; flockLabel?: string; evidenceHref: string}>;
  meta: {dateFrom: string; dateTo: string; previousFrom: string; previousTo: string; days: number; timezone: "Africa/Addis_Ababa"; generatedAt: string; scopeLabel: string};
  sections: {production: PerformanceSection; feeding: PerformanceSection; health: PerformanceSection; stock: PerformanceSection; salesCosts: PerformanceSection};
};
export class PerformanceError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(code: string, status = 400) {super(code); this.code = code; this.status = status;}
}
const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export function performancePeriod(input: ReportInput) {
  const {start, end} = reportTimestampBounds(input.dateFrom, input.dateTo);
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  return {previousFrom: shift(input.dateFrom, -days), previousTo: shift(input.dateFrom, -1), days};
}
export function parsePerformanceInput(query: URLSearchParams, now = new Date()): ReportInput {
  const today = reportOperatingDate(now.toISOString())!;
  const dateTo = query.get("date_to") ?? today;
  let dateFrom = query.get("date_from");
  if (dateFrom === null) {
    try {reportTimestampBounds(dateTo, dateTo); dateFrom = shift(dateTo, -29);} catch {throw new PerformanceError("INVALID_REPORT_PERIOD");}
  }
  try {reportTimestampBounds(dateFrom, dateTo);} catch {throw new PerformanceError("INVALID_REPORT_PERIOD");}
  const input: ReportInput = {dateFrom, dateTo};
  for (const [key, param] of [["branchId", "branch_id"], ["farmId", "farm_id"], ["houseId", "house_id"], ["flockId", "flock_id"], ["batchId", "batch_id"], ["warehouseId", "warehouse_id"]] as const) {
    const value = query.get(param);
    if (!value) continue;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new PerformanceError("INVALID_REPORT_SCOPE");
    input[key] = value;
  }
  return input;
}
export function performanceParams(input: ReportInput) {
  const query = new URLSearchParams({date_from: input.dateFrom, date_to: input.dateTo});
  for (const [key, param] of [["branchId", "branch_id"], ["farmId", "farm_id"], ["houseId", "house_id"], ["flockId", "flock_id"], ["batchId", "batch_id"]] as const) if (input[key]) query.set(param, input[key]!);
  return query;
}
export function evidenceHref(category: HistoryCategory, input: ReportInput) {
  return buildHistoryHref({category, from: input.dateFrom, to: input.dateTo, farm: input.farmId, house: input.houseId, flock: input.flockId, batch: input.batchId, warehouse: category === "stock" ? input.warehouseId : undefined});
}
const finite = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value : null;
export function metric(key: string, unit: PerformanceUnit, value: number | null | undefined, previous: number | null | undefined, coverage: PerformanceCoverage | null, explanation: PerformanceCode): PerformanceMetric {
  const current = finite(value), prior = finite(previous);
  const delta = current === null || prior === null ? null : current - prior;
  const state = current === null ? coverage?.expected === 0 ? "empty" : "missing" : coverage && (coverage.percent === null || coverage.percent < 100) ? "partial" : "available";
  return {key, unit, value: current, previous: prior, delta, deltaPct: delta === null || prior === 0 ? null : delta / Math.abs(prior!) * 100, state, explanation: state === "empty" ? "NO_APPLICABLE_RECORDS" : state === "missing" ? "MISSING_EVIDENCE" : state === "partial" ? "PARTIAL_DAILY_RECORDS" : explanation};
}
const coverageFor = (period: PeriodSummary): PerformanceCoverage => ({recorded: period.records, expected: period.expectedRecords, percent: period.recordCoveragePct});
export function section(metrics: PerformanceMetric[], series: PerformanceSeries[], coverage: PerformanceCoverage | null, href: string, explanations: PerformanceCode[] = []): PerformanceSection {
  const state = metrics.every(row => row.state === "empty") ? "empty" : metrics.every(row => row.value === null) ? "missing" : metrics.some(row => row.state !== "available") ? "partial" : "available";
  return {state, metrics, series, coverage, explanations: [...new Set([...explanations, ...metrics.map(row => row.explanation)])], evidenceHref: href};
}
export function failedSection(href: string): PerformanceSection {return {state: "failed", metrics: [], series: [], coverage: null, explanations: ["REPORT_LOAD_FAILED"], evidenceHref: href};}
export function projectPerformance(input: ReportInput, operations: OperationsAnalyticsResponse): PerformanceResponse {
  const current = operations.summary.current, previous = operations.summary.previous;
  const coverage = coverageFor(current);
  const feedCoverage = {...coverage, percent: operations.dataTrust.feedDataCoveragePct};
  const make = (key: keyof PeriodSummary, unit: PerformanceUnit, code: PerformanceCode = "RECORDED_TOTAL") => metric(key, unit, current[key], previous[key], coverage, code);
  const series = (key: "eggs" | "hdep" | "hdepTarget" | "marketableRate" | "feedPerBirdGrams" | "deaths" | "culls", unit: PerformanceUnit): PerformanceSeries => ({key, unit, points: operations.trends.map(row => ({date: row.date, value: finite(row[key])}))});
  return {
    schemaVersion: 1,
    concerns: (operations.insights ?? []).flatMap(insight => {
      const keys = {coverage: "coverage", "coverage-unavailable": "coverage", "production-down": "productionDown", "mortality-up": "mortalityUp", quality: "quality", targets: "targets"} as const;
      const key = insight.id.startsWith("critical-") ? "criticalFlock" : keys[insight.id as keyof typeof keys];
      if (!key || insight.severity === "positive") return [];
      const flock = key === "criticalFlock" ? operations.flocks.find(row => row.id === insight.id.slice(9)) : undefined;
      return [{key, severity: insight.severity, flockLabel: flock?.code, evidenceHref: evidenceHref(key === "mortalityUp" ? "losses" : "daily", {...input, flockId: flock?.id ?? input.flockId})}];
    }),
    meta: {dateFrom: input.dateFrom, dateTo: input.dateTo, ...performancePeriod(input), timezone: "Africa/Addis_Ababa", generatedAt: operations.meta.refreshedAt, scopeLabel: operations.meta.scopeLabel},
    sections: {
      production: {...section([make("eggs", "eggs"), make("hdep", "%", "WEIGHTED_RATE"), make("marketableRate", "%", "WEIGHTED_RATE")], [series("eggs", "eggs"), series("hdep", "%"), series("hdepTarget", "%"), series("marketableRate", "%")], coverage, evidenceHref("daily", input)), rows: operations.flocks.map(row => ({label: row.code, date: row.latestWeightDate ?? undefined, context: `${row.farmName} · ${row.houseName}`, unit: row.primaryUnit, values: {primary: row.primaryValue, target: row.target, latestWeightG: row.latestWeightG, weightChangePerDay: row.weightChangePerDay, hdep: row.hdep, coverage: row.recordCoveragePct}, evidenceHref: evidenceHref("daily", {...input, flockId: row.id})})), breakdowns: [{key: "eggQuality", unit: "eggs", rows: operations.breakdowns.eggQuality.map(row => ({label: row.label, value: row.value}))}]},
      feeding: section([metric("feedKg", "kg", current.feedKg, previous.feedKg, feedCoverage, "RECORDED_TOTAL"), metric("feedPerBirdGrams", "g/bird/day", current.feedPerBirdGrams, previous.feedPerBirdGrams, feedCoverage, "WEIGHTED_RATE"), metric("layerFcr", "kg/kg", current.layerFcr, previous.layerFcr, feedCoverage, "LAYER_FCR_ONLY")], [series("feedPerBirdGrams", "g/bird/day")], feedCoverage, evidenceHref("feeding", input), ["FEED_NOT_A_HEALTH_DIAGNOSIS", "LAYER_FCR_ONLY"]),
      health: {...section([make("deaths", "birds"), make("culls", "birds"), make("mortalityPer1000BirdDays", "deaths/1000-bird-days", "WEIGHTED_RATE")], [series("deaths", "birds"), series("culls", "birds")], coverage, evidenceHref("losses", input), ["DAILY_LOSSES_NOT_SUPPORTING_EVENTS"]), breakdowns: [{key: "recordedDeathCauses", unit: "birds", rows: operations.breakdowns.mortalityCauses.map(row => ({label: row.label, value: row.value}))}]},
      stock: failedSection(evidenceHref("stock", input)),
      salesCosts: failedSection(evidenceHref("sales", input)),
    },
  };
}
export function appendHealthPerformance(result: PerformanceResponse, current: ReportEvidence, previous: ReportEvidence) {
  const count = (evidence: ReportEvidence, kind: "treatment" | "vaccination" | "disease") => evidence.items.filter(row => row.kind === kind).length;
  for (const key of ["treatment", "vaccination", "disease"] as const) result.sections.health.metrics.push(metric(key, "events", count(current, key), count(previous, key), null, "RECORDED_HEALTH_EVENTS_ONLY"));
  result.sections.health.explanations.push("RECORDED_HEALTH_EVENTS_ONLY");
  const health = result.sections.health;
  result.sections.health = {...section(health.metrics, health.series, health.coverage, health.evidenceHref, health.explanations), breakdowns: health.breakdowns};
  result.sections.health.rows = current.items.map(row => ({label: row.label, date: row.date, context: row.context, values: {events: 1}, evidenceHref: row.sourceId ? buildHistoryHref({category: "health", from: result.meta.dateFrom, to: result.meta.dateTo}, {kind: row.kind === "vaccination" ? "vaccination_completion" : "health_event", id: row.sourceId}) : undefined}));
}

export type PerformanceReaders = {
  operations(input: ReportInput): Promise<OperationsAnalyticsResponse>; health(input: ReportInput): Promise<ReportEvidence>;
  feeding(input: ReportInput, operations: OperationsAnalyticsResponse): Promise<PerformanceSection>;
  stock(input: ReportInput): Promise<PerformanceSection>;
  salesCosts(input: ReportInput): Promise<PerformanceSection>;
};
export async function readPerformance(input: ReportInput, readers: PerformanceReaders): Promise<PerformanceResponse> {
  // Operations validates the complete requested scope before any section is returned.
  const operations = await readers.operations(input);
  const result = projectPerformance(input, operations);
  const prior = performancePeriod(input);
  try {
    const [current, previous] = await Promise.all([readers.health(input), readers.health({...input, dateFrom: prior.previousFrom, dateTo: prior.previousTo})]);
    appendHealthPerformance(result, current, previous);
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 500;
    if (status === 400 || status === 401 || status === 403 || status === 409) throw error;
    // Keep valid daily loss evidence, but never turn a failed health read into zero events.
    result.sections.health.state = "failed";
    result.sections.health.explanations.push("REPORT_LOAD_FAILED");
  }
  await Promise.all((["feeding", "stock", "salesCosts"] as const).map(async key => {
    try {result.sections[key] = await readers[key](input, operations);}
    catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 500;
      if ([400, 401, 403, 409].includes(status)) throw error;
      result.sections[key] = failedSection(evidenceHref(key === "feeding" ? "feeding" : key === "stock" ? "stock" : "sales", input));
    }
  }));
  for (const section of Object.values(result.sections)) {
    if (!section.rows) continue;
    section.rowCount = section.rows.length;
    section.rowsLimited = section.rows.length > 200;
    section.rows = section.rows.slice(0, 200);
  }
  return result;
}
