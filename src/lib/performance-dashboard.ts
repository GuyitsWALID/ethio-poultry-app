import type {PerformanceResponse, PerformanceSection} from "./farm-performance";
import {performanceCharts, type PerformanceChart, type PerformanceView} from "./farm-performance-view.ts";

export type VisualStyle = "area" | "target" | "plan" | "losses" | "donut" | "ranking" | "columns" | "scatter";
// A common date domain makes synchronized cursors meaningful across missing days.
// Each track retains its own unit and never fills missing evidence with zero.
export function operationalSignals(data: PerformanceResponse): PerformanceChart[] {
  const tracks = ([['production', 'hdep'], ['feeding', 'feedPerBirdGrams'], ['health', 'deaths']] as const).flatMap(([view, key]) => performanceCharts(view, data.sections[view]).filter(chart => chart.key === key));
  const dates = [...new Set(tracks.flatMap(chart => chart.points.map(point => point.date!)))].sort();
  return tracks.map(chart => {
    const points = new Map(chart.points.map(point => [point.date, point]));
    return {...chart, points: dates.map(date => points.get(date) ?? {date, label: date, values: Object.fromEntries(chart.lines.map(key => [key, null]))})};
  });
}

export function targetRail(actual: number | null | undefined, target: number | null | undefined) {
  const known = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const scale = Math.max(known(actual) ? actual : 0, known(target) ? target : 0, 1) * 1.1;
  return {actual: known(actual) ? actual / scale * 100 : null, target: known(target) ? target / scale * 100 : null};
}
export function visualStyle(chart: PerformanceChart): VisualStyle {
  if (chart.key === "feedProduction") return "scatter";
  if (["eggQuality", "expenseCategories", "lossComposition", "collections", "sessionStatus"].includes(chart.key)) return "donut";
  if (chart.key === "session_actual") return "plan";
  if (chart.key === "deaths") return "losses";
  if (chart.key === "hdep") return "target";
  if (chart.kind === "line") return "area";
  if (["feedTypes", "recordedDeathCauses", "growth", "flockProduction", "healthActivity"].includes(chart.key) || chart.key.startsWith("stock:")) return "ranking";
  return "columns";
}
// Composition is meaningful only when every slice is known and nonnegative.
// An unknown category must never quietly disappear from a pie's denominator.
export function composition(chart: PerformanceChart) {
  const rows = chart.points.map(row => ({label: row.label, value: row.values[chart.lines[0]]}));
  const complete = rows.length > 0 && rows.every(row => typeof row.value === "number" && Number.isFinite(row.value) && row.value >= 0);
  const total = complete ? rows.reduce((sum, row) => sum + row.value!, 0) : null;
  return {rows, total, drawable: total !== null && total > 0};
}
export function dashboardCharts(view: Exclude<PerformanceView, "overview" | "saved">, section: PerformanceSection): PerformanceChart[] {
  const charts = performanceCharts(view, section);
  if (section.state === "failed") return charts;
  const metricChart = (key: string, keys: string[], unit: string) => {
    const metrics = keys.map(id => section.metrics.find(row => row.key === id));
    if (!metrics.some(Boolean)) return;
    charts.push({key, unit, kind: "bar", lines: ["value"], points: keys.map((label, index) => ({label, values: {value: metrics[index]?.value ?? null}}))});
  };
  if (view === "health") {
    metricChart("lossComposition", ["deaths", "culls"], "birds");
    metricChart("healthActivity", ["treatment", "vaccination", "disease"], "events");
  }
  if (view === "salesCosts") {
    const get = (key: string) => section.metrics.find(row => row.key === key)?.value;
    const revenue = get("revenue"), paid = get("paid"), balance = get("balanceDue");
    // Collections are against selected sales, not cash received during the period.
    if (revenue != null && paid != null && balance != null && Math.abs(revenue - paid - balance) <= 0.02) metricChart("collections", ["paid", "balanceDue"], "ETB");
  }
  if (view === "production") {
    const rows = (section.rows ?? []).filter(row => row.unit === "%");
    if (rows.length) charts.push({key: "flockProduction", unit: "%", kind: "bar", lines: ["primary", "target"], points: rows.slice(0, 20).map(row => ({label: row.label, values: row.values})), limited: rows.length > 20 || section.rowsLimited});
    const paired = rows.filter(row => Number.isFinite(row.values.feedPerBirdGrams) && Number.isFinite(row.values.hdep));
    if (paired.length) charts.push({key: "feedProduction", unit: "%", kind: "bar", lines: ["hdep"], points: paired.slice(0, 20).map(row => ({label: row.label, values: row.values})), limited: paired.length > 20 || section.rowsLimited});
  }
  return charts;
}
