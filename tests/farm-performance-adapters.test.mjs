import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
import {projectStockPerformance, projectFeedingPerformance, projectSalesPerformance, selectPerformanceWarehouses} from "../src/lib/farm-performance-adapters.ts";
import {readPerformance, PerformanceError} from "../src/lib/farm-performance.ts";

const input = {dateFrom: "2026-10-01", dateTo: "2026-10-01"};
const warehouse = {id: "store", name: "Farm store", farm_id: "farm", branch_id: "branch", status: "active"};
const value = (section, key) => section.metrics.find(row => row.key === key)?.value;
const period = {records: 1, expectedRecords: 1, recordCoveragePct: 100, eggs: 80, hdep: 80, marketableRate: 100, deaths: 0, culls: 0, feedKg: 10, feedPerBirdGrams: 100, layerFcr: 2.5};
const operations = {meta: {refreshedAt: "2026-10-02T00:00:00Z", scopeLabel: "Farm"}, summary: {current: period, previous: period}, dataTrust: {feedDataCoveragePct: 100}, trends: [], flocks: [], breakdowns: {eggQuality: [], mortalityCauses: []}};
const health = {items: []};

test("stock scopes preserve shared permissions but reject contradictory farm, branch and inactive stores", () => {
  const stores = [warehouse, {...warehouse, id: "other", farm_id: "other"}, {...warehouse, id: "shared", farm_id: null}, {...warehouse, id: "inactive", status: "inactive"}];
  assert.deepEqual(selectPerformanceWarehouses(stores, {...input, farmId: "farm"}, ["farm"], ["branch"]).map(row => row.id), ["store", "shared"]);
  assert.deepEqual(selectPerformanceWarehouses(stores, {...input, farmId: "farm", warehouseId: "other"}, ["farm"], ["branch"]), []);
  assert.deepEqual(selectPerformanceWarehouses(stores, {...input, branchId: "elsewhere"}, ["farm"], ["branch"]), []);
});

test("stock periods include last Addis instant, exclude future current receipts, keep units and stores separate", () => {
  const entry = (date, type, quantity, item = "feed", store = "store") => ({transaction_date: date, transaction_type: type, quantity, item_id: item, warehouse_id: store});
  const items = [{id: "feed", name: "Feed", unit: "kg", unit_cost: 2, reorder_level: 50}, {id: "medicine", name: "Medicine", unit: "bottle", unit_cost: null, reorder_level: 2}];
  const ledger = [entry("2026-09-01T09:00:00Z", "receipt", 100), entry("2026-10-01T20:59:59Z", "issue", 10), entry("2026-10-01T21:00:00Z", "receipt", 5), entry("2026-12-01T00:00:00Z", "receipt", 900), entry("2026-10-01T09:00:00Z", "receipt", 3, "medicine")];
  const result = projectStockPerformance(input, [warehouse], items, ledger, Date.parse("2026-10-20T00:00:00Z"));
  assert.deepEqual(result.rows.map(row => row.unit), ["kg", "bottle"]);
  assert.deepEqual(result.rows[0].values, {opening: 100, periodEnd: 90, current: 95, received: 0, consumption: 10, previousPeriodEnd: 100, estimatedPeriodEndValue: 180});
  assert.equal(value(result, "estimatedPeriodEndValue"), null);
  assert.ok(result.explanations.includes("WAREHOUSE_LEVEL_BALANCES"));
  assert.equal(projectStockPerformance(input, [], [], []).state, "empty");
  assert.throws(() => projectStockPerformance(input, [warehouse], items, [{...ledger[0], quantity: null}]), /INVALID/);
  assert.throws(() => projectStockPerformance(input, [warehouse], [], ledger), /REPORT_EVIDENCE_CONFLICT/);
});

const feeding = (overrides = {}) => ({sessions: [{id: "s1", flock_id: "layer", record_date: input.dateFrom, session_name: "Feed 1", status: "completed", planned_feed_kg: 5, actual_feed_kg: 6}, {id: "s2", flock_id: "layer", record_date: input.dateFrom, session_name: "Feed 2", status: "missed", planned_feed_kg: 5, actual_feed_kg: null}], closures: [{flock_id: "layer", record_date: input.dateFrom, status: "closed"}], daily: [{flock_id: "layer", record_date: input.dateFrom, opening_birds: 100, closing_birds: 100, feed_intake_grams: 6000, total_eggs: 80, average_egg_weight_g: 50}], weights: [], flocks: [{id: "layer", flock_code: "Layer A", flock_type: "layer"}], ambiguousMovementDays: false, ...overrides});

test("scope-wide feeding needs no batch, sums actual sessions once and keeps canonical daily consumption separate", () => {
  const result = projectFeedingPerformance(input, feeding(), operations);
  assert.equal(value(result, "sessionActualKg"), 6);
  assert.equal(value(result, "sessionPlannedKg"), 10);
  assert.equal(value(result, "feedKg"), 10);
  assert.equal(value(result, "closedFeedDays"), 1);
  assert.equal(result.rows[1].values.actual, 0);
  assert.equal(value(result, "layerFcr"), 1.5);
  assert.equal(value(result, "growthFcr"), null);
  assert.match(result.rows[0].evidenceHref, /history_record=s1/);
});

test("planned/pending, missing fields, reopened feed and absent sessions never masquerade as completed zero days", () => {
  const pending = projectFeedingPerformance(input, feeding({sessions: [{...feeding().sessions[0], status: "planned", actual_feed_kg: null}], closures: [{flock_id: "layer", record_date: input.dateFrom, status: "reopened"}]}), operations);
  assert.equal(value(pending, "sessionActualKg"), null);
  assert.equal(pending.coverage.percent, 0);
  assert.equal(pending.series[0].points[0].value, null);
  const missing = projectFeedingPerformance(input, feeding({sessions: [{...feeding().sessions[0], actual_feed_kg: null}]}), operations);
  assert.equal(value(missing, "sessionActualKg"), null);
  const none = projectFeedingPerformance(input, feeding({sessions: [], closures: []}), operations);
  assert.equal(value(none, "sessionPlannedKg"), null);
  assert.equal(none.coverage.percent, 0);
});

test("sales preserves estimates and collections meaning; absent cost evidence does not create profit", () => {
  const sales = {kpis: {records: 2, revenue: 100, paid: 80, balanceDue: 20, estimatedProfit: null, marginStatus: "unavailable"}, charts: {daily: [{label: input.dateFrom, revenue: 100, paid: 80, balanceDue: 20}]}};
  const expenses = {expenseTotal: 30, items: [{kind: "expense", label: "Fuel", date: input.dateFrom, amount: 30}]};
  const result = projectSalesPerformance(input, sales, sales, expenses, {...expenses, expenseTotal: 20});
  assert.equal(value(result, "estimatedProfit"), null);
  assert.equal(result.metrics.find(row => row.key === "expenses").delta, 10);
  assert.ok(result.explanations.includes("COLLECTIONS_AGAINST_SELECTED_SALES"));
  assert.equal(result.rows[0].values.amount, 30);
});

test("section failures stay explicit; denied access and conflicting evidence remain fatal", async () => {
  const readers = {operations: async () => operations, health: async () => health, feeding: async () => projectFeedingPerformance(input, feeding(), operations), stock: async () => projectStockPerformance(input, [], [], []), salesCosts: async () => {throw Error("private SQL");}};
  const result = await readPerformance(input, readers);
  assert.equal(result.sections.salesCosts.state, "failed");
  assert.deepEqual(result.sections.salesCosts.metrics, []);
  assert.equal(result.sections.stock.state, "empty");
  assert.equal(JSON.stringify(result).includes("private SQL"), false);
  for (const status of [401, 403, 409]) await assert.rejects(readPerformance(input, {...readers, stock: async () => {throw new PerformanceError("DENIED", status);}}), /DENIED/);
});

test("service worker never intercepts live reporting evidence online or offline", async () => {
  const listeners = new Map();
  let cacheReads = 0;
  vm.runInNewContext(await readFile(new URL("../public/sw.js", import.meta.url), "utf8"), {self: {location: {origin: "https://farm.test"}, addEventListener: (type, listener) => listeners.set(type, listener)}, URL, caches: {open: () => {cacheReads++; throw Error("not allowed");}}});
  for (const path of ["/api/reports/performance", "/api/reports/management", "/app/reports"]) {
    let intercepted = false;
    listeners.get("fetch")({request: {url: `https://farm.test${path}`, method: "GET", mode: "navigate"}, respondWith: () => {intercepted = true;}});
    assert.equal(intercepted, false);
  }
  assert.equal(cacheReads, 0);
});
