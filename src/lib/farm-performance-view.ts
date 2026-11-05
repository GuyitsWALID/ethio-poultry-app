import type {PerformanceResponse, PerformanceSection} from "./farm-performance";
import {historyPeriod} from "./history/contracts.ts";
export const performanceViews = ["overview", "production", "feeding", "health", "stock", "salesCosts", "saved"] as const;
export type PerformanceView = typeof performanceViews[number];
export function performanceView(value: string) {return performanceViews.includes(value as PerformanceView) ? value as PerformanceView : "overview";}
export function legacyPerformanceView(query: URLSearchParams): PerformanceView {
  if (query.has("saved_report") || query.has("report_id") || query.get("view") === "advanced") return "saved";
  const sections: Record<string, PerformanceView> = {production: "production", feed: "feeding", health: "health", stock: "stock", finance: "salesCosts"};
  return sections[query.get("filter_page_report") ?? ""] ?? "overview";
}
export function performancePreset(days: 7 | 30 | 90, now = new Date()) {const {from, to} = historyPeriod(days, now); return {dateFrom: from, dateTo: to};}
export type PerformanceChart = {key: string; unit: string; kind: "line" | "bar"; lines: string[]; points: Array<{label: string; date?: string; values: Record<string, number | null>}>; limited?: boolean};
export function performanceCharts(view: Exclude<PerformanceView, "overview" | "saved">, section: PerformanceSection): PerformanceChart[] {
  if (section.state === "failed") return [];
  const groups: string[][] = view === "production" ? [["eggs"], ["hdep", "hdepTarget"], ["marketableRate"]] : view === "feeding" ? [["session_actual", "session_planned"], ["feedPerBirdGrams"]] : view === "health" ? [["deaths", "culls"]] : view === "salesCosts" ? [["revenue", "paid", "balanceDue"]] : [];
  const charts: PerformanceChart[] = groups.flatMap(keys => {
    const series = keys.map(key => section.series.find(row => row.key === key)).filter(row => row !== undefined);
    if (!series.length) return [];
    const dates = [...new Set(series.flatMap(row => row.points.map(point => point.date)))].sort();
    return [{key: keys[0], unit: series[0].unit, kind: "line", lines: series.map(row => row.key), points: dates.map(date => ({label: date, date, values: Object.fromEntries(series.map(row => [row.key, row.points.find(point => point.date === date)?.value ?? null]))}))}];
  });
  for (const group of section.breakdowns ?? []) charts.push({key: group.key, unit: group.unit, kind: "bar", lines: ["value"], points: group.rows.slice(0, 20).map(row => ({label: row.label, values: {value: row.value}})), limited: group.rows.length > 20});
  if (view === "production") {
    const growth = (section.rows ?? []).filter(row => row.unit === "g");
    if (growth.length) charts.push({key: "growth", unit: "g", kind: "bar", lines: ["primary", "target"], points: growth.slice(0, 20).map(row => ({label: row.label, values: {primary: row.values.primary, target: row.values.target}})), limited: growth.length > 20});
  }
  if (view === "stock") {
    const groups = new Map<string, NonNullable<PerformanceSection["rows"]>>();
    for (const row of section.rows ?? []) {const key = `${row.context} · ${row.unit}`; groups.set(key, [...(groups.get(key) ?? []), row]);}
    for (const [label, rows] of groups) {
      charts.push({key: `stock:${label}`, unit: rows[0].unit ?? "", kind: "bar", lines: ["opening", "periodEnd", "current"], points: rows.slice(0, 20).map(row => ({label: row.label, values: row.values})), limited: rows.length > 20});
      charts.push({key: `movement:${label}`, unit: rows[0].unit ?? "", kind: "bar", lines: ["received", "consumption"], points: rows.slice(0, 20).map(row => ({label: row.label, values: row.values})), limited: rows.length > 20});
    }
  }
  return charts;
}
export function chartRange(chart: PerformanceChart) {
  const values = chart.points.flatMap(row => chart.lines.map(key => row.values[key])).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null, missing: chart.points.length * chart.lines.length - values.length};
}
export function performanceConcerns(result: PerformanceResponse) {
  return Object.entries(result.sections).filter(([, section]) => section.state !== "available").map(([key, section]) => ({key, state: section.state, evidenceHref: section.evidenceHref}));
}
export function rowFieldUnit(key: string, fallback = "") {
  const units: Record<string, string> = {estimatedPeriodEndValue: "ETB", amount: "ETB", latestWeightG: "g", weightChangePerDay: "g/day", hdep: "%", coverage: "%", events: "events"};
  return units[key] ?? fallback;
}
