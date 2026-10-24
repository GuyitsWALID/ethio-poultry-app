import {buildHistoryHref, historyPeriod, historyUuid, validHistoryDate, type HistoryCategory} from "./history/contracts.ts";
import {buildReportHref} from "./report-workspace.ts";
import {isLegacyCorrectionTarget} from "./today-workspace/entry-routing.ts";

export type ManagerDestinationContext = {role: string | null; todayWorkspaceEnabled: boolean; today: string};

// Presentation only: exact exceptional targets are never rewritten or authorized here.
export function managerDestination(route: string, context: ManagerDestinationContext): string {
  if (context.role !== "farm_manager" || !context.todayWorkspaceEnabled || !validHistoryDate(context.today) || !route.startsWith("/app/")) return route;
  let url: URL;
  try {url = new URL(route, "https://destination.invalid");} catch {return route;}
  if (url.origin !== "https://destination.invalid" || url.hash) return route;
  const categories: Record<string, HistoryCategory> = {"/app/daily-records": "daily", "/app/feeding-log": "feeding", "/app/health": "health", "/app/mortality": "losses", "/app/inventory": "stock", "/app/sales": "sales", "/app/expenses": "expenses", "/app/operating-days": "closing"};
  const category = categories[url.pathname];
  if (!category) return route;
  const query = url.searchParams;
  if (isLegacyCorrectionTarget(query) || ["request", "financial_period", "cost_entry", "event", "event_id", "schedule_id", "weight_task", "task_id", "count_session", "count_session_id", "template_id"].some(key => query.has(key))) return route;
  const feedTarget = query.get("feed_target");
  if (feedTarget && !["feed_history", "today_sessions"].includes(feedTarget)) return route;
  const aliases = {
    branch: ["branch_id", "filter_branchId"],
    farm: ["farm_id", "filter_farmId", "filter_page_healthFarmId"],
    house: ["house_id", "filter_houseId", "filter_page_healthHouseId"],
    flock: ["flock_id", "filter_flockId", "filter_page_healthFlockId"],
    batch: ["batch_id", "filter_batchId"],
    warehouse: ["warehouse_id", "filter_page_warehouseId", "filter_page_reportWarehouse"],
    date: ["date", "record_date", "filter_page_filterDate"],
    from: ["date_from", "filter_dateFrom", "filter_page_dateFrom"],
    to: ["date_to", "filter_dateTo", "filter_page_dateTo"],
  } as const;
  const navigationKeys = new Set<string>([...Object.values(aliases).flat(), "filter_view", "filter_preset", "filter_page_dateFilterMode", "feed_target"]);
  if ([...query.keys()].some(key => !navigationKeys.has(key))) return route;
  const values: Partial<Record<keyof typeof aliases, string>> = {};
  for (const [key, names] of Object.entries(aliases)) {
    const entries = [...new Set(names.flatMap(name => query.getAll(name)).filter(Boolean))];
    if (entries.length > 1) return route;
    if (entries[0]) values[key as keyof typeof aliases] = entries[0];
  }
  for (const key of ["branch", "farm", "house", "flock", "batch", "warehouse"] as const) if (values[key] && !historyUuid.test(values[key]!)) return route;
  for (const key of ["date", "from", "to"] as const) if (values[key] && !validHistoryDate(values[key]!)) return route;
  if (values.from && values.to && values.from > values.to) return route;
  // Neither History nor Today accepts a branch-only scope.
  if (values.branch && category !== "losses" && category !== "stock") return route;
  const defaults = historyPeriod(30, new Date(`${context.today}T12:00:00Z`));
  const from = values.from ?? values.date ?? defaults.from, to = values.to ?? values.date ?? defaults.to;
  const earliest = historyPeriod(7, new Date(`${context.today}T12:00:00Z`)).from;
  const workDate = values.date ?? (feedTarget === "today_sessions" ? context.today : undefined);
  if (values.farm && workDate && workDate >= earliest && workDate <= context.today && (category === "daily" || feedTarget === "today_sessions")) {
    const target = new URLSearchParams({task: category === "daily" ? "birds" : "feeding", date: workDate});
    for (const key of ["farm", "house", "flock"] as const) if (values[key]) target.set(`${key}_id`, values[key]!);
    return `/app/today?${target}`;
  }
  if (category === "losses" || category === "stock") {
    const href = buildReportHref(category === "stock" ? "stock" : "health", {dateFrom: from, dateTo: to, branchId: values.branch, farmId: values.farm, houseId: values.house, flockId: values.flock, batchId: values.batch, warehouseId: values.warehouse});
    const result = new URL(href, url.origin);
    result.searchParams.set("filter_page_performance", category === "stock" ? "stock" : "health");
    return `${result.pathname}${result.search}`;
  }
  return buildHistoryHref({category, from, to, farm: values.farm, house: values.house, flock: values.flock, batch: values.batch, warehouse: values.warehouse});
}
