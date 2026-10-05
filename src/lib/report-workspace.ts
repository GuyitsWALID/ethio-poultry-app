// Read-only presentation seam. Calculations and authorization stay in the
// existing domain endpoints; never average FCRs or combine different stock units.
export const reportSections = ["production", "feed", "health", "stock", "finance"] as const;
export type ReportSection = typeof reportSections[number];
import type {ReportEvidence} from "./report-evidence";
export type ReportMetricKey = "eggs" | "productionRate" | "marketable" | "coverage" | "feedKg" | "planCompletion" | "feedPerBird" | "fcr" | "feedCost" | "deaths" | "deathRate" | "unexplained" | "revenue" | "paid" | "balanceDue" | "estimatedProfit" | "currentStock" | "received" | "feedUsage" | "dailyUsage" | "healthUsage" | "vaccineUsage" | "stockValue" | "healthEvents" | "vaccinations" | "expenses";
export type ReportValue = {key: ReportMetricKey; value: number | null; unit?: string};
export type ReportRow = {label: string; date?: string; values: ReportValue[]};
export type ReportView = {metrics: ReportValue[]; rows: ReportRow[]; notices: Array<"fcrHelp" | "estimated" | "stockPeriod" | "batchScope" | "financeScope">; warehouses: Array<{id: string; name: string}>; warehouseName?: string; dateFrom?: string; dateTo?: string; evidence?: ReportEvidence};
export type ReportInput = {dateFrom: string; dateTo: string; branchId?: string; farmId?: string; houseId?: string; flockId?: string; batchId?: string; warehouseId?: string; month?: string};

export function buildReportHref(section: ReportSection, input: ReportInput) {
  const params = new URLSearchParams({filter_view: "1", filter_preset: "custom", filter_page_report: section});
  for (const key of ["branchId", "farmId", "houseId", "flockId", "batchId", "dateFrom", "dateTo"] as const) if (input[key]) params.set(`filter_${key}`, input[key]);
  params.set("filter_page_dateFrom", input.dateFrom);
  params.set("filter_page_dateTo", input.dateTo);
  if (section === "stock") {
    params.set("filter_page_reportWarehouse", input.warehouseId || "");
    params.set("filter_page_reportMonth", input.month || input.dateTo.slice(0, 7));
  }
  return `/app/reports?${params}`;
}

export function reportSection(value: string | null | undefined): ReportSection {
  return reportSections.includes(value as ReportSection) ? value as ReportSection : "production";
}

export function reportRequest(section: ReportSection, input: ReportInput) {
  const dateValid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  if (!dateValid(input.dateFrom) || !dateValid(input.dateTo) || input.dateFrom > input.dateTo) throw new Error("INVALID_REPORT_RANGE");
  if (section === "feed" && !input.batchId) return null;
  if (section === "stock") {
    const month = input.month || input.dateTo.slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("INVALID_REPORT_MONTH");
    return `/api/inventory/workspace?${new URLSearchParams({month, warehouse_id: input.warehouseId || ""})}`;
  }
  const params = new URLSearchParams({date_from: input.dateFrom, date_to: input.dateTo});
  for (const [key, value] of Object.entries({branch_id: input.branchId, farm_id: input.farmId, house_id: input.houseId, flock_id: input.flockId, batch_id: input.batchId})) if (value) params.set(key, value);
  const endpoint = {production: "operations-analytics", feed: "feed/control", health: "mortality/dashboard", finance: "sales/analytics"}[section];
  return `/api/${endpoint}?${params}`;
}

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown) => Array.isArray(value) ? value.map(object) : [];
const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const text = (value: unknown) => typeof value === "string" ? value : "";
const metric = (key: ReportMetricKey, value: unknown, unit?: string): ReportValue => ({key, value: numeric(value), ...(unit ? {unit} : {})});

export function presentReport(section: ReportSection, source: unknown): ReportView {
  const data = object(source);
  const view: ReportView = {metrics: [], rows: [], notices: [], warehouses: []};
  const sourcePeriod = object(section === "finance" ? data.filters : data.meta);
  view.dateFrom = text(sourcePeriod.dateFrom) || undefined;
  view.dateTo = text(sourcePeriod.dateTo) || undefined;
  if (section === "production") {
    const current = object(object(data.summary).current);
    view.metrics = [metric("eggs", current.eggs), metric("productionRate", current.hdep, "%"), metric("marketable", current.marketableRate, "%"), metric("coverage", current.recordCoveragePct, "%")];
    view.rows = list(data.farms).map(row => ({label: text(row.name), values: [metric("productionRate", row.hdep, "%"), metric("feedPerBird", row.feedPerBirdGrams, "g"), metric("coverage", row.recordCoveragePct, "%")]}));
  } else if (section === "feed") {
    const kpis = object(data.kpis);
    const read = (key: string) => object(kpis[key]).value;
    view.metrics = [metric("feedKg", object(kpis.feedVariance).actualKg, "kg"), metric("planCompletion", read("planCompletion"), "%"), metric("feedPerBird", read("feedPerBirdDay"), "g"), metric("fcr", read("fcr"), "kg/kg"), metric("feedCost", object(data.financials).feedCostEtb, "ETB")];
    view.rows = list(object(data.trends).daily).map(row => ({label: text(row.date), date: text(row.date), values: [metric("feedKg", row.actualKg, "kg")]}));
    view.notices = ["batchScope", "fcrHelp"];
    if (object(data.meta).confidence !== "Actual") view.notices.push("estimated");
  } else if (section === "health") {
    const summary = object(data.summary);
    view.metrics = [metric("deaths", summary.officialDeaths), metric("deathRate", summary.mortalityPerThousand), metric("unexplained", summary.unexplainedDeaths), metric("coverage", object(data.dataTrust).coveragePct, "%")];
    view.rows = list(data.causes).map(row => ({label: text(row.cause), values: [metric("deaths", row.deaths)]}));
  } else if (section === "stock") {
    view.warehouses = list(data.warehouses).map(row => ({id: text(row.id), name: text(row.name)}));
    view.warehouseName = text(object(data.selectedWarehouse).name);
    view.rows = list(data.items).map(row => ({label: text(row.name), values: [metric("currentStock", row.currentBalance, text(row.unit)), metric("received", row.received, text(row.unit)), metric("feedUsage", row.feedUsage, text(row.unit)), metric("dailyUsage", row.dailyUsage, text(row.unit)), metric("healthUsage", row.healthUsage, text(row.unit)), metric("vaccineUsage", row.vaccineUsage, text(row.unit)), metric("stockValue", row.stockValue, "ETB")]}));
    // Warehouse-only costs must not disappear for a manager whose branch store
    // has no farm_id. Keep the existing warehouse authorization and month scope.
    if (view.warehouseName && Array.isArray(data.expenses)) {
      const expenses = list(data.expenses);
      const cost = (row: Row) => (typeof row.amount === "number" || typeof row.amount === "string" && row.amount.trim() !== "") ? numeric(Number(row.amount)) : null;
      const total = expenses.every(row => cost(row) !== null) ? expenses.reduce((sum, row) => sum + cost(row)!, 0) : null;
      view.metrics.push(metric("expenses", total, "ETB"));
      view.evidence = {dateFrom: "", dateTo: "", items: expenses.map(row => ({kind: "expense", label: text(row.description), date: text(row.entry_date), context: view.warehouseName!, amount: cost(row) ?? undefined})), expenseTotal: total ?? undefined};
    }
    view.notices = ["stockPeriod"];
  } else {
    const kpis = object(data.kpis);
    view.metrics = [metric("revenue", kpis.revenue, "ETB"), metric("paid", kpis.paid, "ETB"), metric("balanceDue", kpis.balanceDue, "ETB"), metric("estimatedProfit", kpis.estimatedProfit, "ETB")];
    view.rows = list(object(data.charts).daily).map(row => ({label: text(row.label), date: text(row.label), values: [metric("revenue", row.revenue, "ETB"), metric("paid", row.paid, "ETB"), metric("balanceDue", row.balanceDue, "ETB")]}));
    if (kpis.marginStatus !== "tracked") view.notices.push("estimated");
  }
  return view;
}

export async function loadReport(section: ReportSection, input: ReportInput, read: (url: string) => Promise<unknown>) {
  const url = reportRequest(section, input);
  if (!url) return null;
  const view = presentReport(section, await read(url));
  if (section === "health" || section === "finance") {
    const params = new URL(url, "https://report.invalid").searchParams;
    params.set("section", section);
    params.set("date_from", view.dateFrom || input.dateFrom);
    params.set("date_to", view.dateTo || input.dateTo);
    const evidence = await read(`/api/reports/evidence?${params}`) as ReportEvidence;
    if (!Array.isArray(evidence.items)) throw new Error("REPORT_EVIDENCE_INVALID");
    view.evidence = evidence;
    if (section === "health") view.metrics.push(metric("healthEvents", evidence.items.filter(row => row.kind !== "vaccination").length), metric("vaccinations", evidence.items.filter(row => row.kind === "vaccination").length));
    else {view.metrics.push(metric("expenses", evidence.expenseTotal, "ETB")); view.notices.push("financeScope");}
  }
  return view;
}
