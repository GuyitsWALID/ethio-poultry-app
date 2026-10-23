import assert from "node:assert/strict";
import test from "node:test";
import {build} from "esbuild";
import {fileURLToPath} from "node:url";

const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const org = id(1), farm = id(2), house = id(3), flock = id(4), batch = id(5), store = id(6), user = id(7), branch = id(8);
const state = {calls: [], tables: {}, limit: 45}; globalThis.__reportReadSessionTest = state;
class Query {
  constructor(table) {this.table = table; this.filters = []; this.orders = [];}
  select(columns = "*") {if (this.table === "daily_farm_records") assert.ok(columns.split(",").every(key => !["farm_id", "house_id"].includes(key.trim()))); return this;}
  eq(key, value) {this.filters.push(row => row[key] === value); return this;}
  is(key, value) {this.filters.push(row => (row[key] ?? null) === value); return this;}
  in(key, values) {this.filters.push(row => values.includes(row[key])); return this;}
  gte(key, value) {this.filters.push(row => row[key] >= value); return this;}
  lte(key, value) {this.filters.push(row => row[key] <= value); return this;}
  lt(key, value) {this.filters.push(row => row[key] < value); return this;}
  or() {return this;}
  order(key, {ascending = true} = {}) {this.orders.push([key, ascending]); return this;}
  async range(from, to) {
    state.calls.push(this.table);
    if (state.calls.length > state.limit) throw Error("Too many subrequests");
    if (state.fail === this.table) return {data: null, error: {message: "source failed"}};
    const rows = (state.tables[this.table] ?? []).filter(row => this.filters.every(fn => fn(row))).sort((a, b) => {
      for (const [key, asc] of this.orders) if (a[key] !== b[key]) return (String(a[key]) < String(b[key]) ? -1 : 1) * (asc ? 1 : -1);
      return 0;
    });
    return {data: rows.slice(from, to + 1), error: null};
  }
  async maybeSingle() {const result = await this.range(0, 0); return {...result, data: result.data?.[0] ?? null};}
}
state.db = {from: name => new Query(name), rpc: name => new Query(name)};
const bundle = await build({stdin: {contents: 'export {loadFarmPerformance} from "./src/lib/farm-performance.server";export {ReportReadSession} from "./src/lib/report-read-session.server";', resolveDir: fileURLToPath(new URL("..", import.meta.url))}, bundle: true, write: false, format: "esm", platform: "node", plugins: [{name: "real-reporting-readers", setup(b) {
  b.onResolve({filter: /(?:^server-only$|access-context$|warehouse-access$|^@supabase\/supabase-js$)/}, args => ({path: args.path, namespace: "test"}));
  b.onLoad({filter: /.*/, namespace: "test"}, args => ({contents: args.path === "server-only" ? "" : args.path.endsWith("access-context") ? 'export const governanceAdmin=globalThis.__reportReadSessionTest.db;export function getAccessContext(){throw Error("not an auth test")}export const isAccessResponse=v=>v instanceof Response;' : args.path.endsWith("warehouse-access") ? 'export async function effectiveWarehouseIds(){return globalThis.__reportReadSessionTest.stores}export async function managerWarehouseAccess(){return globalThis.__reportReadSessionTest.stores.map(id=>({id}))}' : 'export const createClient=()=>globalThis.__reportReadSessionTest.db;'}));
}}]});
const {loadFarmPerformance, ReportReadSession} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const input = {dateFrom: "2026-10-02", dateTo: "2026-10-02", farmId: farm};
const actor = {orgId: org, userId: user, role: "farm_manager", supportSessionId: null};
function reset() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.invalid"; process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  state.calls = []; state.stores = [store]; state.fail = null; state.limit = 45;
  state.tables = {
    farms: [{id: farm, org_id: org, branch_id: branch, name: "Farm"}], houses: [{id: house, org_id: org, farm_id: farm, name: "House"}],
    flocks: [{id: flock, org_id: org, farm_id: farm, house_id: house, batch_id: batch, flock_code: "Layer", flock_type: "layer", status: "active", current_count: 100, placement_date: "2026-01-01", age_at_placement_days: 0, breed_id: null}],
    batches: [{id: batch, org_id: org, farm_id: farm, house_id: house, batch_code: "Batch", total_count: 100}],
    user_farm_access: [{id: id(9), org_id: org, profile_id: user, farm_id: farm, starts_at: "2020-01-01", revoked_at: null}],
    report_flock_locations: [{flock_id: flock, farm_id: farm, house_id: house, from_date: "2026-01-01", to_date: null, verified: true}],
    warehouses: [{id: store, org_id: org, farm_id: farm, branch_id: branch, name: "Farm store", status: "active"}],
    inventory_items: [{id: id(10), org_id: org, name: "Feed", category: "feed", unit: "kg", unit_cost: 2, reorder_level: 10}],
    stock_ledger: [{id: id(11), org_id: org, item_id: id(10), warehouse_id: store, transaction_type: "receipt", quantity: 100, transaction_date: "2026-09-30T09:00:00Z", unit_cost: 2, farm_id: farm}],
    daily_farm_records: ["2026-10-01", "2026-10-02"].map((record_date, i) => ({id: id(20+i), org_id: org, flock_id: flock, record_date, opening_birds: 100, closing_birds: 100, deaths: 0, culls: 0, total_eggs: 80+i, normal_eggs: 78+i, broken_eggs: 1, dirty_eggs: 1, feed_intake_grams: 11000, average_egg_weight_g: 50})),
    feeding_session_records: [{id: id(30), org_id: org, flock_id: flock, record_date: input.dateTo, session_name: "Third feeding", status: "completed", planned_feed_kg: 10, actual_feed_kg: 11, warehouse_id: store}],
    feed_day_closures: [{id: id(31), org_id: org, flock_id: flock, record_date: input.dateTo, status: "closed"}],
    cost_entries: [{id: id(32), org_id: org, farm_id: farm, warehouse_id: store, entry_date: input.dateTo, amount: 5, category: "transport", description: "Transport"}],
    feed_control_settings: [{org_id: org, warning_variance_pct: 5, critical_variance_pct: 10}],
  };
}
test("real all-topic readers stay below the Worker budget without dropping feeding, money or prior evidence", async () => {
  for (const role of ["ceo", "farm_manager"]) {
    reset(); const result = await loadFarmPerformance({...actor, role}, input);
    assert.ok(state.calls.length <= 30, `${role}: ${state.calls.length} calls`);
    assert.ok(Object.values(result.sections).every(section => section.state !== "failed"));
    assert.equal(result.sections.production.metrics.find(m => m.key === "eggs").value, 81);
    assert.equal(result.sections.production.metrics.find(m => m.key === "eggs").previous, 80);
    assert.equal(result.sections.feeding.metrics.find(m => m.key === "sessionActualKg").value, 11);
    assert.equal(result.sections.salesCosts.metrics.find(m => m.key === "expenses").value, 5);
    for (const table of ["farms", "flocks", "batches", "inventory_items", "daily_farm_records", "stock_ledger", "cost_entries", "report_flock_locations"]) assert.equal(state.calls.filter(name => name === table).length, 1, table);
  }
});
test("sessions are actor/scope/period bound, never shared across requests, and authorize every new report", async () => {
  reset(); const session = new ReportReadSession(actor, input);
  for (const changed of [{...actor, orgId: id(99)}, {...actor, userId: id(99)}, {...actor, role: "ceo"}, {...actor, supportSessionId: "support"}]) assert.throws(() => session.assert(changed, input), /REPORT_SCOPE_DENIED/);
  assert.throws(() => session.assert(actor, {...input, farmId: id(99)}), /REPORT_SCOPE_DENIED/);
  assert.throws(() => session.assert(actor, {...input, dateFrom: "2026-09-01"}), /REPORT_SCOPE_DENIED/);
  await Promise.all([session.rows("farms"), session.rows("farms")]); assert.equal(state.calls.length, 1);
  await new ReportReadSession(actor, input).rows("farms"); assert.equal(state.calls.length, 2);
  state.tables.user_farm_access[0].revoked_at = "2026-10-03";
  await assert.rejects(() => loadFarmPerformance(actor, input), /REPORT_SCOPE_DENIED/);
});
test("complete source pagination survives shared reads; failures are not retried into false zeroes", async () => {
  reset(); state.tables.inventory_items = Array.from({length: 1201}, (_, i) => ({id: id(100+i), org_id: org}));
  const session = new ReportReadSession(actor, input);
  const [a, b] = await Promise.all([session.rows("inventory_items"), session.rows("inventory_items")]);
  assert.equal(a.length, 1201); assert.deepEqual(a, b); assert.equal(state.calls.length, 3);
  state.fail = "cost_entries";
  await assert.rejects(() => session.rows("cost_entries"), /source failed/);
  await assert.rejects(() => session.rows("cost_entries"), /source failed/);
  assert.equal(state.calls.filter(name => name === "cost_entries").length, 1);
});
test("sharing source reads never grants an unassigned store or retains revoked store access", async () => {
  reset();
  state.tables.cost_entries.push({...state.tables.cost_entries[0], id: id(90), warehouse_id: id(99), amount: 500});
  state.tables.stock_ledger.push({...state.tables.stock_ledger[0], id: id(91), warehouse_id: id(99), quantity: 9000});
  const result = await loadFarmPerformance(actor, input);
  assert.equal(result.sections.salesCosts.metrics.find(m => m.key === "expenses").value, 5);
  assert.equal(result.sections.stock.rows[0].values.current, 100);
  state.stores = []; state.calls = [];
  await assert.rejects(() => loadFarmPerformance(actor, input), /REPORT_SHARED_STORE_DENIED/);
});
