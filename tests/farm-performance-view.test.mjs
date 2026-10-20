import assert from "node:assert/strict";
import test from "node:test";
import {performanceCharts, chartRange, performanceViews, performanceView, performancePreset, rowFieldUnit} from "../src/lib/farm-performance-view.ts";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};
const section = {state: "available", series: [], metrics: [], explanations: []};

test("seven views and inclusive Addis presets remain stable", () => {
  assert.equal(performanceViews.length, 7);
  assert.equal(performanceView("not-a-view"), "overview");
  assert.deepEqual(performancePreset(7, new Date("2026-10-19T21:30:00Z")), {dateFrom: "2026-10-14", dateTo: "2026-10-20"});
});
test("charts align missing dates without zero filling, averaging or blending units", () => {
  const charts = performanceCharts("production", {...section, series: [{key: "hdep", unit: "%", points: [{date: "2026-10-01", value: 80}, {date: "2026-10-02", value: null}]}, {key: "hdepTarget", unit: "%", points: [{date: "2026-10-02", value: 90}]}]});
  assert.deepEqual(charts[0].points.map(row => row.values), [{hdep: 80, hdepTarget: null}, {hdep: null, hdepTarget: 90}]);
  assert.deepEqual(chartRange(charts[0]), {min: 80, max: 90, missing: 2});
});
test("stock visuals never blend warehouses or kg and bottles; chart limits are explicit", () => {
  const rows = Array.from({length: 25}, (_, index) => ({label: `Feed ${index}`, context: "Farm store", unit: "kg", values: {opening: 10, periodEnd: 8, current: 9, received: 0, consumption: 2}}));
  rows.push({label: "Medicine", context: "Farm store", unit: "bottles", values: {opening: 3, periodEnd: 2, current: 2}});
  rows.push({label: "Feed", context: "Shared store", unit: "kg", values: {opening: 40, periodEnd: 20, current: 20}});
  const charts = performanceCharts("stock", {...section, rows});
  assert.equal(charts.length, 6);
  assert.equal(charts[0].points.length, 20);
  assert.equal(charts[0].limited, true);
  assert.equal(charts[2].unit, "bottles");
  assert.equal(charts[4].points[0].values.periodEnd, 20);
  assert.equal(rowFieldUnit("estimatedPeriodEndValue", "kg"), "ETB");
  assert.equal(rowFieldUnit("coverage", "g"), "%");
});
test("failed sections have no plots; unavailable remains distinct from recorded zero", () => {
  assert.deepEqual(performanceCharts("health", {...section, state: "failed"}), []);
  assert.deepEqual(chartRange({points: [{values: {value: null}}], lines: ["value"]}), {min: null, max: null, missing: 1});
  assert.deepEqual(chartRange({points: [{values: {value: 0}}], lines: ["value"]}), {min: 0, max: 0, missing: 0});
});
test("new presentation catalogs have exact English/Amharic key parity", () => {
  const keys = (value, prefix = "") => Object.entries(value).flatMap(([key, child]) => typeof child === "object" ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]);
  assert.deepEqual(keys(en.FarmPerformance).sort(), keys(am.FarmPerformance).sort());
});
