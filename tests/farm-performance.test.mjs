import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {parsePerformanceInput, performancePeriod, performanceParams, projectPerformance, readPerformance, PerformanceError} from "../src/lib/farm-performance.ts";

const input = {dateFrom: "2026-10-01", dateTo: "2026-10-07"};
const period = {records: 7, expectedRecords: 7, recordCoveragePct: 100, eggs: 700, hdep: 70, marketableRate: 98, deaths: 2, culls: 1, feedKg: 80, feedPerBirdGrams: 110, layerFcr: 2, mortalityPer1000BirdDays: 2.5};
const operations = (current = period, previous = {...period, eggs: 600, deaths: 0}) => ({meta: {refreshedAt: "2026-10-08T00:00:00Z", scopeLabel: "Assigned farms"}, dataTrust: {feedDataCoveragePct: current.recordCoveragePct}, summary: {current, previous}, trends: [{date: "2026-10-01", eggs: 100, deaths: 2, culls: 1, hdep: 70, marketableRate: 98, feedPerBirdGrams: null}], flocks: [], breakdowns: {eggQuality: [], mortalityCauses: []}});
const evidence = {dateFrom: input.dateFrom, dateTo: input.dateTo, items: []};

test("defaults are 30 inclusive Addis days and comparisons have equal length", () => {
  const defaults = parsePerformanceInput(new URLSearchParams(), new Date("2026-10-19T21:30:00Z"));
  assert.deepEqual(defaults, {dateFrom: "2026-09-21", dateTo: "2026-10-20"});
  assert.deepEqual(performancePeriod(input), {previousFrom: "2026-09-24", previousTo: "2026-09-30", days: 7});
  assert.equal(parsePerformanceInput(new URLSearchParams("date_to=2026-08-31")).dateFrom, "2026-08-02");
});

test("invalid dates, ranges and UUIDs fail explicitly; warehouse is retained for authorization", () => {
  for (const query of ["date_to=broken", "date_from=2026-02-30", "date_from=2025-01-01&date_to=2026-10-20", "date_from=2026-10-10&date_to=2026-10-01", "farm_id=another-tenant"]) {
    assert.throws(() => parsePerformanceInput(new URLSearchParams(query)), PerformanceError);
  }
  const scoped = parsePerformanceInput(new URLSearchParams("flock_id=00000000-0000-0000-0000-000000000001"));
  assert.equal(performanceParams(scoped).get("flock_id"), scoped.flockId);
  assert.equal(parsePerformanceInput(new URLSearchParams("warehouse_id=00000000-0000-0000-0000-000000000001")).warehouseId, "00000000-0000-0000-0000-000000000001");
});

test("canonical values and loss types survive projection without averaging or duplicate events", () => {
  const result = projectPerformance(input, operations());
  const eggs = result.sections.production.metrics.find(row => row.key === "eggs");
  assert.equal(eggs.delta, 100);
  assert.equal(eggs.previous, 600);
  assert.equal(result.sections.production.metrics.find(row => row.key === "hdep").value, 70);
  assert.equal(result.sections.health.metrics.find(row => row.key === "deaths").value, 2);
  assert.equal(result.sections.health.metrics.find(row => row.key === "culls").value, 1);
  assert.equal(result.sections.health.metrics.find(row => row.key === "deaths").deltaPct, null);
  assert.equal(result.sections.feeding.series[0].points[0].value, null);
  assert.equal(result.sections.feeding.metrics.find(row => row.key === "layerFcr").explanation, "LAYER_FCR_ONLY");
});

test("missing, partial, empty and recorded zero remain distinct", () => {
  const partial = projectPerformance(input, operations({...period, records: 1, recordCoveragePct: 14, eggs: null, deaths: 0}));
  assert.equal(partial.sections.production.metrics[0].state, "missing");
  assert.equal(partial.sections.health.metrics[0].value, 0);
  assert.equal(partial.sections.health.metrics[0].state, "partial");
  const empty = projectPerformance(input, operations({...period, expectedRecords: 0, records: 0, recordCoveragePct: null, eggs: null, hdep: null, marketableRate: null}));
  assert.equal(empty.sections.production.state, "empty");
  assert.equal(projectPerformance(input, operations({...period, eggs: 0})).sections.production.metrics[0].state, "available");
});

test("history links preserve selected dates and exact authorized flock context", () => {
  const result = projectPerformance({...input, farmId: "f", flockId: "bird"}, operations());
  const query = new URL(result.sections.health.evidenceHref, "https://test.invalid").searchParams;
  assert.equal(query.get("filter_page_history_category"), "losses");
  assert.equal(query.get("filter_page_history_flock"), "bird");
  assert.equal(query.get("filter_page_history_from"), input.dateFrom);
});

test("full daily record coverage does not imply full feeding evidence", () => {
  const source = operations();
  source.dataTrust.feedDataCoveragePct = 50;
  const result = projectPerformance(input, source);
  assert.equal(result.sections.production.state, "available");
  assert.equal(result.sections.feeding.state, "partial");
  assert.equal(result.sections.feeding.coverage.percent, 50);
});

test("health reads use both periods, do not add events to daily losses, and do not assume zero on failure", async () => {
  const reads = [];
  const result = await readPerformance(input, {operations: async () => operations(), health: async scope => {
    reads.push(scope);
    return {...evidence, items: [{kind: "treatment"}, {kind: "vaccination"}]};
  }});
  assert.equal(reads[1].dateFrom, "2026-09-24");
  assert.equal(result.sections.health.metrics.find(row => row.key === "deaths").value, 2);
  assert.equal(result.sections.health.metrics.find(row => row.key === "vaccination").value, 1);
  const failed = await readPerformance(input, {operations: async () => operations(), health: async () => {throw Error("private database details");}});
  assert.equal(failed.sections.health.state, "failed");
  assert.equal(failed.sections.health.metrics.some(row => row.key === "vaccination"), false);
  assert.equal(JSON.stringify(failed).includes("private database"), false);
  assert.equal(failed.sections.production.state, "available");
});

test("denial is fatal and unauthorized scope cannot trigger supporting readers", async () => {
  let read = false;
  await assert.rejects(readPerformance(input, {operations: async () => {throw new PerformanceError("REPORT_SCOPE_DENIED", 403);}, health: async () => {read = true; return evidence;}}), /REPORT_SCOPE_DENIED/);
  assert.equal(read, false);
  await assert.rejects(readPerformance(input, {operations: async () => operations(), health: async () => {throw new PerformanceError("REPORT_SCOPE_DENIED", 403);}}), /REPORT_SCOPE_DENIED/);
});

test("new route is private/no-store and service worker does not cache it", async () => {
  const route = await readFile(new URL("../src/app/api/reports/performance/route.ts", import.meta.url), "utf8");
  assert.match(route, /private, no-store/);
  assert.match(route, /REPORT_SESSION_EXPIRED/);
  const sw = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(sw, /if \(!safeStatic\) return/);
  assert.doesNotMatch(sw, /api\/reports/);
});
