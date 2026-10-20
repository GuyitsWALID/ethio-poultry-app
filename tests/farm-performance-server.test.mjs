import assert from "node:assert/strict";
import test from "node:test";
import {build} from "esbuild";
import {fileURLToPath} from "node:url";

const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const org = id(1), farm = id(2), house = id(3), flock = id(4), store = id(5), branch = id(6), batch = id(7);
const state = {calls: [], logs: []};
globalThis.__performanceTest = state;
class Query {
  constructor(table) {this.table = table; this.filters = []; this.orders = [];}
  select() {return this;}
  eq(key, value) {this.filters.push(row => row[key] === value); return this;}
  is(key, value) {this.filters.push(row => (row[key] ?? null) === value); return this;}
  in(key, values) {this.filters.push(row => values.includes(row[key])); return this;}
  lte(key, value) {this.filters.push(row => row[key] <= value); return this;}
  gte(key, value) {this.filters.push(row => row[key] >= value); return this;}
  or() {return this;}
  order(key) {this.orders.push(key); return this;}
  async range(from, to) {
    state.calls.push({table: this.table, from, to});
    if (state.failTable === this.table) return {data: null, error: {message: "private SQL details"}};
    const rows = (state.tables[this.table] ?? []).filter(row => this.filters.every(filter => filter(row))).sort((a, b) => {
      for (const key of this.orders) {if (a[key] !== b[key]) return String(a[key]) < String(b[key]) ? -1 : 1;}
      return 0;
    });
    return {data: rows.slice(from, to + 1), error: null};
  }
}
state.db = {from: table => new Query(table), rpc: name => new Query(name)};
const stub = {
  "@/lib/access-context": 'export const governanceAdmin=globalThis.__performanceTest.db; export async function getAccessContext(){const s=globalThis.__performanceTest;return s.authStatus?new Response(null,{status:s.authStatus}):s.ctx;} export const isAccessResponse=v=>v instanceof Response;',
  "@/lib/warehouse-access": 'export async function effectiveWarehouseIds(){return globalThis.__performanceTest.stores;}',
  "@/lib/operations-analytics-service": 'export async function loadOperationsAnalytics(ctx,params){const s=globalThis.__performanceTest;s.operationScope=params.toString();return Response.json(s.operations);}',
  "@/lib/report-evidence.server": 'export async function loadReportEvidence(ctx,section,input){const s=globalThis.__performanceTest;if(s.failHealth&&section==="health")throw Error("private health SQL");return {dateFrom:input.dateFrom,dateTo:input.dateTo,items:[],expenseTotal:0};}',
  "@/lib/sales-analytics-service": 'export async function loadSalesAnalytics(ctx,params){const s=globalThis.__performanceTest;s.salesScopes.push(params.toString());return Response.json({kpis:{records:0,revenue:0,paid:0,balanceDue:0,estimatedProfit:null,marginStatus:"unavailable"},charts:{daily:[]}});}',
};
const built = await build({entryPoints: [fileURLToPath(new URL("../src/app/api/reports/performance/route.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent", plugins: [{name: "read-only-test-transport", setup(builder) {
  builder.onResolve({filter: /^server-only$/}, () => ({path: "server-only", namespace: "stub"}));
  builder.onResolve({filter: /^@\/lib\//}, args => args.path in stub ? {path: args.path, namespace: "stub"} : undefined);
  builder.onLoad({filter: /.*/, namespace: "stub"}, args => ({contents: stub[args.path] ?? "", loader: "js"}));
}}]});
const {GET} = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
const reset = () => {
  state.ctx = {orgId: org, userId: id(8), role: "farm_manager", supportSessionId: null};
  state.authStatus = null; state.failTable = null; state.failHealth = false; state.calls = []; state.salesScopes = []; state.stores = [store];
  state.tables = {
    user_farm_access: [{id: id(9), org_id: org, profile_id: id(8), farm_id: farm, starts_at: "2020-01-01T00:00:00Z", revoked_at: null}],
    farms: [{id: farm, org_id: org, branch_id: branch, name: "Farm A"}],
    houses: [{id: house, org_id: org, farm_id: farm}],
    batches: [{id: batch, org_id: org, farm_id: farm, house_id: house}],
    flocks: [{id: flock, org_id: org, farm_id: farm, house_id: house, batch_id: batch, flock_code: "Layer A", flock_type: "layer"}],
    report_flock_locations: [{flock_id: flock, farm_id: farm, house_id: house, from_date: "2026-01-01", to_date: null, verified: true}],
    warehouses: [{id: store, org_id: org, name: "Farm store", farm_id: farm, branch_id: branch, status: "active"}],
    inventory_items: [{id: id(10), org_id: org, name: "Feed", unit: "kg", unit_cost: 2, reorder_level: 0}],
    stock_ledger: [{id: id(11), org_id: org, item_id: id(10), warehouse_id: store, transaction_date: "2026-10-01T09:00:00Z", transaction_type: "receipt", quantity: 10}],
  };
  const period = {records: 1, expectedRecords: 1, recordCoveragePct: 100, feedKg: 1, eggs: 10, deaths: 0, culls: 0};
  state.operations = {meta: {refreshedAt: "2026-10-02T00:00:00Z", scopeLabel: "Farm A"}, summary: {current: period, previous: period}, dataTrust: {feedDataCoveragePct: 100}, trends: [], flocks: [], breakdowns: {eggQuality: [], mortalityCauses: []}};
};
const request = extra => new Request(`https://farm.test/api/reports/performance?date_from=2026-10-01&date_to=2026-10-01${extra ?? ""}`);
const run = async extra => {
  const original = console.info;
  console.info = (...values) => state.logs.push(values);
  try {return await GET(request(extra));} finally {console.info = original;}
};

test("actual route reads assigned scope without a batch; sales comparisons and stock stay in scope", async () => {
  reset();
  const response = await run(`&farm_id=${farm}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("Vary"), "Cookie");
  const body = await response.json();
  assert.deepEqual(Object.keys(body.sections), ["production", "feeding", "health", "stock", "salesCosts"]);
  assert.equal(body.sections.stock.rows[0].values.periodEnd, 10);
  assert.equal(new URLSearchParams(state.operationScope).get("batch_id"), null);
  assert.equal(new URLSearchParams(state.salesScopes[1]).get("date_from"), "2026-09-30");
  assert.ok(state.calls.every(call => call.to - call.from === 499));
});

test("new route rejects revoked assignments, foreign targets and ungranted shared stores before evidence", async () => {
  for (const mode of ["revoked", "foreign", "shared", "inactive"]) {
    reset();
    let query = `&farm_id=${farm}`;
    if (mode === "revoked") state.tables.user_farm_access[0].revoked_at = "2026-10-01T00:00:00Z";
    if (mode === "foreign") query = `&farm_id=${id(99)}`;
    if (mode === "shared") {state.stores = []; state.tables.warehouses[0].farm_id = null; query += `&warehouse_id=${store}`;}
    if (mode === "inactive") {state.tables.warehouses[0].status = "inactive"; query += `&warehouse_id=${store}`;}
    const response = await run(query);
    assert.equal(response.status, 403, mode);
    assert.ok(!state.calls.some(call => call.table === "stock_ledger"));
  }
});

test("source failure remains failed not zero; session expiry and role denial remain distinct", async () => {
  reset(); state.failTable = "stock_ledger"; state.failHealth = true;
  const response = await run();
  const body = await response.json();
  assert.equal(body.sections.stock.state, "failed");
  assert.deepEqual(body.sections.stock.metrics, []);
  assert.equal(body.sections.health.state, "failed");
  assert.equal(JSON.stringify(body).includes("private"), false);
  for (const status of [401, 403]) {
    reset(); state.authStatus = status;
    const denied = await run();
    assert.equal(denied.status, status);
    assert.equal((await denied.json()).code, status === 401 ? "REPORT_SESSION_EXPIRED" : "REPORT_SCOPE_DENIED");
    assert.equal(denied.headers.get("Cache-Control"), "private, no-store");
    assert.equal(state.calls.length, 0);
  }
});

test("explicit shared-store access and CEO scope work without active flock work", async () => {
  reset();
  state.tables.warehouses[0].farm_id = null;
  state.tables.flocks = []; state.tables.report_flock_locations = [];
  state.operations.summary.current = {...state.operations.summary.current, records: 0, expectedRecords: 0, recordCoveragePct: null, eggs: null};
  const permitted = await run(`&warehouse_id=${store}`);
  assert.equal(permitted.status, 200);
  assert.equal((await permitted.json()).sections.stock.rows[0].values.periodEnd, 10);
  reset(); state.ctx.role = "ceo"; state.tables.user_farm_access = []; state.stores = [];
  assert.equal((await run(`&farm_id=${farm}`)).status, 200);
  reset(); state.ctx.role = "warehouse_manager";
  assert.equal((await run()).status, 403);
});

test("populated feeding beyond old caps remains complete while supporting previews stay bounded", async () => {
  reset();
  state.tables.feeding_session_records = Array.from({length: 1105}, (_, index) => ({id: id(100 + index), org_id: org, flock_id: flock, record_date: "2026-10-01", session_name: `Feed ${index}`, session_time: "09:00:00", status: "completed", planned_feed_kg: 1, actual_feed_kg: 1, warehouse_id: store}));
  state.tables.feed_day_closures = [{id: id(15), org_id: org, flock_id: flock, record_date: "2026-10-01", status: "closed"}];
  const body = await (await run()).json();
  const feeding = body.sections.feeding;
  assert.equal(feeding.metrics.find(row => row.key === "sessionActualKg").value, 1105);
  assert.equal(feeding.rows.length, 200);
  assert.equal(feeding.rowCount, 1105);
  assert.equal(feeding.rowsLimited, true);
  assert.equal(state.calls.filter(call => call.table === "feeding_session_records").length, 3);
  state.stores = [];
  assert.equal((await run()).status, 403);
});
