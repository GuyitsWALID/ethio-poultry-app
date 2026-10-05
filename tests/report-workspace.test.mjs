import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {buildReportHref, loadReport, presentReport, reportRequest, reportSection} from "../src/lib/report-workspace.ts";
import {summarizePeriod} from "../src/lib/operational-analytics.ts";

const input = {dateFrom: "2026-09-01", dateTo: "2026-09-30", farmId: "assigned-farm", houseId: "house-a", flockId: "flock-a", batchId: "batch-a"};
const get = (view, key) => view.metrics.find(metric => metric.key === key)?.value;

test("report requests reuse authoritative readers and exact scope, without write operations", async () => {
  for (const [section, endpoint] of Object.entries({production: "operations-analytics", feed: "feed/control", health: "mortality/dashboard", finance: "sales/analytics"})) {
    const requests = [];
    await loadReport(section, input, async url => {requests.push(new URL(url, "https://test.invalid")); return url.startsWith("/api/reports/evidence") ? {items: []} : {};});
    const requested = requests[0];
    assert.equal(requested.pathname, `/api/${endpoint}`);
    for (const [key, value] of Object.entries({date_from: input.dateFrom, date_to: input.dateTo, farm_id: input.farmId, house_id: input.houseId, flock_id: input.flockId, batch_id: input.batchId})) assert.equal(requested.searchParams.get(key), value);
    if (section === "health" || section === "finance") {
      assert.equal(requests[1].pathname, "/api/reports/evidence");
      assert.equal(requests[1].searchParams.get("farm_id"), input.farmId);
    }
  }
  let calls = 0;
  assert.equal(await loadReport("feed", {...input, batchId: ""}, async () => {calls++;}), null);
  assert.equal(calls, 0);
  assert.equal(reportSection("unknown"), "production");
});

test("report handoffs preserve exact scope, dates, batch and warehouse month", () => {
  const url = new URL(buildReportHref("stock", {...input, warehouseId: "store-a", month: "2026-08"}), "https://test.invalid");
  assert.equal(url.pathname, "/app/reports");
  assert.equal(url.searchParams.get("filter_page_report"), "stock");
  assert.equal(url.searchParams.get("filter_farmId"), input.farmId);
  assert.equal(url.searchParams.get("filter_batchId"), input.batchId);
  assert.equal(url.searchParams.get("filter_page_dateFrom"), input.dateFrom);
  assert.equal(url.searchParams.get("filter_page_reportWarehouse"), "store-a");
  assert.equal(url.searchParams.get("filter_page_reportMonth"), "2026-08");
});

test("health and finance evidence failure does not silently become zero", async () => {
  await assert.rejects(loadReport("finance", input, async url => {
    if (url.startsWith("/api/reports/evidence")) throw new Error("FORBIDDEN");
    return {kpis: {revenue: 100}};
  }), /FORBIDDEN/);
  const view = await loadReport("health", input, async url => url.startsWith("/api/reports/evidence") ? {items: [{kind: "disease"}, {kind: "vaccination"}]} : {summary: {officialDeaths: 3}});
  assert.equal(get(view, "deaths"), 3);
  assert.equal(get(view, "healthEvents"), 1);
  assert.equal(get(view, "vaccinations"), 1);
});

test("CEO organization and manager farm reports preserve the existing production summary exactly", () => {
  const rows = [
    {flock_id: "a", opening_birds: 100, closing_birds: 100, total_eggs: 85, normal_eggs: 80, broken_eggs: 3, dirty_eggs: 2, deaths: 0, feed_intake_grams: 11000},
    {flock_id: "b", opening_birds: 200, closing_birds: 198, total_eggs: 150, normal_eggs: 140, broken_eggs: 5, dirty_eggs: 5, deaths: 2, feed_intake_grams: 22000},
  ];
  const flocks = [{id: "a", type: "layer", currentCount: 100, initialCount: 100}, {id: "b", type: "layer", currentCount: 198, initialCount: 200}];
  for (const [sourceRows, sourceFlocks] of [[rows, flocks], [[rows[0]], [flocks[0]]]]) {
    const current = summarizePeriod(sourceRows, new Set(sourceFlocks.map(flock => flock.id)), sourceRows.length);
    const view = presentReport("production", {summary: {current}});
    for (const [key, field] of Object.entries({eggs: "eggs", productionRate: "hdep", marketable: "marketableRate", coverage: "recordCoveragePct"})) assert.equal(get(view, key), current[field]);
  }
});

test("feed and FCR preserve source values and missing data, never averaging batches", () => {
  const view = presentReport("feed", {kpis: {fcr: {value: 1.876}, feedVariance: {actualKg: 1234.567}}, financials: {feedCostEtb: null}, meta: {confidence: "Estimate"}});
  assert.equal(get(view, "fcr"), 1.876);
  assert.equal(get(view, "feedKg"), 1234.567);
  assert.equal(get(view, "feedCost"), null);
  assert.equal(get(presentReport("feed", {}), "fcr"), null);
  assert.ok(view.notices.includes("estimated"));
});

test("health uses official deaths, not a second sum of mortality events", () => {
  const view = presentReport("health", {meta: {dateFrom: "2026-09-15", dateTo: "2026-09-30"}, summary: {officialDeaths: 11, eventDeaths: 17, mortalityPerThousand: .217, unexplainedDeaths: 2}, dataTrust: {coveragePct: 90}});
  assert.equal(get(view, "deaths"), 11);
  assert.equal(get(view, "deathRate"), .217);
  assert.equal(view.dateFrom, "2026-09-15");
});

test("stock reader uses independently authorized warehouses and labels item units separately", () => {
  const url = new URL(reportRequest("stock", {...input, warehouseId: "store-a", month: "2026-08"}), "https://test.invalid");
  assert.equal(url.searchParams.get("month"), "2026-08");
  assert.equal(url.searchParams.get("warehouse_id"), "store-a");
  assert.equal(url.searchParams.has("farm_id"), false);
  const view = presentReport("stock", {selectedWarehouse: {id: "secret-id", name: "Main store"}, items: [{id: "secret-item", name: "Feed", unit: "kg", currentBalance: 100.5, feedUsage: 22}, {name: "Syringes", unit: "piece", currentBalance: 4}]});
  assert.equal(view.metrics.length, 0);
  assert.deepEqual(view.rows.map(row => row.values[0].unit), ["kg", "piece"]);
  assert.equal(view.rows[0].values[0].value, 100.5);
  assert.equal(JSON.stringify(view).includes("secret-id"), false);
});

test("sales report preserves existing cost and revenue results without recomputing profit", () => {
  const view = presentReport("finance", {kpis: {revenue: 12345.67, paid: 100, balanceDue: 12245.67, estimatedProfit: -987, marginStatus: "estimated"}});
  assert.equal(get(view, "revenue"), 12345.67);
  assert.equal(get(view, "estimatedProfit"), -987);
  assert.ok(view.notices.includes("estimated"));
});

test("warehouse-only expenses stay in their independently authorized stock report", () => {
  const view = presentReport("stock", {selectedWarehouse: {name: "Assigned branch store"}, expenses: [{id: "private", amount: "450.50", description: "Store rent", entry_date: "2026-09-02"}], items: []});
  assert.equal(get(view, "expenses"), 450.5);
  assert.equal(view.evidence.items[0].context, "Assigned branch store");
  assert.doesNotMatch(JSON.stringify(view), /private/);
  assert.equal(get(presentReport("stock", {selectedWarehouse: {name: "Store"}, expenses: [{amount: null}]}), "expenses"), null);
});

test("invalid ranges and failed authorization do not return a previous report", async () => {
  for (const dateFrom of ["bad", "2026-02-30", "2026-13-01", "2027-01-01"]) assert.throws(() => reportRequest("production", {...input, dateFrom}), /INVALID_REPORT_RANGE/);
  assert.throws(() => reportRequest("stock", {...input, month: "2026-13"}), /INVALID_REPORT_MONTH/);
  await assert.rejects(loadReport("production", input, async () => {throw new Error("FORBIDDEN");}), /FORBIDDEN/);
});

test("English/Amharic catalogs match and reports retain history/correction workspace", async () => {
  const read = async path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const en = JSON.parse(await read("messages/en.json")).ReportWorkspace;
  const am = JSON.parse(await read("messages/am.json")).ReportWorkspace;
  const keys = value => Object.entries(value).flatMap(([key, item]) => typeof item === "object" ? keys(item).map(child => `${key}.${child}`) : [key]).sort();
  assert.deepEqual(keys(en), keys(am));
  const workspace = await read("src/components/reports/consolidated-report-workspace.tsx");
  assert.match(workspace, /cache: "no-store"/);
  assert.match(workspace, /controller\.abort/);
  assert.match(workspace, /result\?\.key === key/);
  assert.match(workspace, /useSearchParams/);
  assert.match(workspace, /BranchReportWorkspace/);
  assert.doesNotMatch(workspace, /method: "(POST|PATCH|DELETE)"/);
});
