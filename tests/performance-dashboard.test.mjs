import test from "node:test";
import assert from "node:assert/strict";
import {composition, dashboardCharts, visualStyle} from "../src/lib/performance-dashboard.ts";
import {projectFeedingPerformance} from "../src/lib/farm-performance-adapters.ts";

const section = {state: "available", metrics: [], series: [], rows: [], breakdowns: []};
const metric = (key, value) => ({key, value});
const ring = values => ({points: values.map((value, i) => ({label: String(i), values: {value}})), lines: ["value"]});
test("composition never hides unknown, negative, infinite or zero evidence", () => {
  for (const values of [[1, null], [1, -1], [1, Infinity], [0, 0], []]) assert.equal(composition(ring(values)).drawable, false);
  assert.equal(composition(ring([8, 2])).total, 10);
  assert.equal(composition(ring([8, 0])).drawable, true);
});
test("chart styles answer different questions without changing authoritative values", () => {
  const charts = dashboardCharts("production", {...section, series: [{key: "eggs", unit: "eggs", points: [{date: "2026-10-01", value: null}, {date: "2026-10-02", value: 10}]}], breakdowns: [{key: "eggQuality", unit: "eggs", rows: [{label: "normal", value: 10}]}]});
  assert.deepEqual(charts.map(visualStyle), ["area", "donut"]);
  assert.equal(charts[0].points[0].values.eggs, null);
  assert.equal(visualStyle({key: "session_actual"}), "plan");
  assert.equal(visualStyle({key: "growth", kind: "bar"}), "ranking");
  assert.deepEqual(dashboardCharts("feeding", {...section, state: "failed"}), []);
});
test("loss composition uses deaths and culls, never health event counts", () => {
  const charts = dashboardCharts("health", {...section, metrics: [metric("deaths", 4), metric("culls", 2), metric("treatment", 9)]});
  const losses = charts.find(row => row.key === "lossComposition");
  assert.equal(composition(losses).total, 6);
  assert.equal(charts.find(row => row.key === "healthActivity").points[0].values.value, 9);
});
test("collection composition requires reconciled selected-sale totals", () => {
  const charts = values => dashboardCharts("salesCosts", {...section, metrics: [metric("revenue", values[0]), metric("paid", values[1]), metric("balanceDue", values[2])]});
  assert.equal(charts([100, 70, 30]).find(row => row.key === "collections").points.length, 2);
  for (const values of [[100, 80, 30], [100, null, 100]]) assert.equal(charts(values).some(row => row.key === "collections"), false);
});
test("feeding completion supports arbitrary sessions and distinguishes missed from unfinished", () => {
  const summary = {expectedRecords: 1, recordCoveragePct: 100};
  const result = projectFeedingPerformance({dateFrom: "2026-10-01", dateTo: "2026-10-01"}, {sessions: ["completed", "completed", "completed", "missed", "pending"].map((status, i) => ({id: String(i), flock_id: "f", record_date: "2026-10-01", status, actual_feed_kg: status === "completed" ? 5 : null, planned_feed_kg: 5})), daily: [], weights: [], closures: [], flocks: [], ambiguousMovementDays: false}, {summary: {current: summary, previous: summary}, trends: []});
  assert.deepEqual(result.breakdowns.find(row => row.key === "sessionStatus").rows.map(row => row.value), [3, 1, 1]);
  assert.equal(result.series.find(row => row.key === "session_actual").points[0].value, null);
});
test("feed-production comparisons require paired compatible laying-flock evidence", () => {
  const charts = dashboardCharts("production", {...section, rows: [{label: "Layer", unit: "%", values: {feedPerBirdGrams: 110, hdep: 85}}, {label: "Unknown feed", unit: "%", values: {feedPerBirdGrams: null, hdep: 80}}, {label: "Broiler", unit: "g", values: {feedPerBirdGrams: 100, hdep: 75}}]});
  const scatter = charts.find(row => row.key === "feedProduction");
  assert.equal(scatter.points.length, 1);
  assert.equal(scatter.points[0].label, "Layer");
  assert.equal(visualStyle(scatter), "scatter");
});
