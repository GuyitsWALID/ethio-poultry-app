import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import ts from "typescript";

async function moduleFrom(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const {getCurrentAlerts, alertOperatingWindow} = await import("../src/lib/current-alerts.ts");
const {actionSourceInScope} = await moduleFrom("../src/lib/action-desk-policy.ts");
const today = alertOperatingWindow().today;
const at = `${today}T09:00:00Z`;
const flock = (id, farm) => ({id, org_id: "org", farm_id: farm, house_id: `house-${id}`, flock_code: id,
  placement_date: "2020-01-01", completed_at: null, current_count: 1000, status: "active"});
function fixture() {
  return {
    alerts: [{id: "rule", org_id: "org", status: "open", message: "Organization rule", priority: "high", category: "health", created_at: at, triggered_at: at, triggered_value: null}],
    inventory_items: [{id: "feed", org_id: "org", name: "Feed", unit: "kg", reorder_level: 10, updated_at: at}],
    warehouses: [{id: "store-a", org_id: "org", name: "A store", farm_id: "farm-a", status: "active"},
      {id: "store-b", org_id: "org", name: "B store", farm_id: "farm-b", status: "active"},
      {id: "shared", org_id: "org", name: "Shared store", farm_id: null, status: "active"}],
    stock_ledger: [{org_id: "org", item_id: "feed", warehouse_id: "store-a", transaction_type: "receipt", quantity: 5},
      {org_id: "org", item_id: "feed", warehouse_id: "store-b", transaction_type: "receipt", quantity: 100},
      {org_id: "org", item_id: "feed", warehouse_id: "shared", transaction_type: "receipt", quantity: 3}],
    mortality_events: [{org_id: "org", flock_id: "flock-a", record_date: today, count: 20}],
    daily_farm_records: [{org_id: "org", flock_id: "flock-b", record_date: today, deaths: 0, total_eggs: 0, created_at: at, voided_at: null}],
    flocks: [flock("flock-a", "farm-a"), flock("flock-b", "farm-b")],
    health_events: [{id: "missed-a", org_id: "org", flock_id: "flock-a", event_date: today,
      description: "SCHEDULE_STATUS|vaccine|missed|reason", voided_at: null}],
  };
}
function database(data, failTable) {
  return {rpc(name) {
    if (name === "operational_performance_warnings") return Promise.resolve({data: data.performance ?? [], error: failTable === "performance" ? {message: "read failed"} : null});
    const balances = new Map();
    for (const row of data.stock_ledger ?? []) {
      const key = `${row.org_id}:${row.warehouse_id}:${row.item_id}`;
      const balance = balances.get(key) ?? {...row, quantity: 0};
      balance.quantity += ["issue", "transfer_out"].includes(row.transaction_type) ? -row.quantity : row.quantity;
      balances.set(key, balance);
    }
    return database({...data, balances: [...balances.values()].filter(row => row.org_id === "org")}, failTable === "stock_ledger" ? "balances" : failTable).from("balances");
  }, from(table) {
    let rows = [...(data[table] ?? [])];
    const ordering = [];
    let maximum = Infinity;
    let first = 0;
    const query = {
      select() {return query;},
      eq(key, value) {rows = rows.filter(row => row[key] === value); return query;},
      neq(key, value) {rows = rows.filter(row => row[key] !== value); return query;},
      is(key, value) {rows = rows.filter(row => row[key] === value); return query;},
      gte(key, value) {rows = rows.filter(row => row[key] >= value); return query;},
      lte(key, value) {rows = rows.filter(row => row[key] <= value); return query;},
      like(key) {rows = rows.filter(row => row[key]?.startsWith("SCHEDULE_STATUS|")); return query;},
      order(key, options) {ordering.push([key, options?.ascending !== false]); return query;},
      limit(count) {maximum = count; return query;},
      range(from, to) {first = from; maximum = to - from + 1; return query;},
      then(resolve) {
        rows.sort((a, b) => {for (const [key, ascending] of ordering) {
          const comparison = String(a[key] ?? "").localeCompare(String(b[key] ?? ""));
          if (comparison) return ascending ? comparison : -comparison;
        } return 0;});
        return Promise.resolve({data: rows.slice(first, first + maximum), error: table === failTable ? {message: "read failed"} : null}).then(resolve);
      },
    };
    return query;
  }};
}
const managerScope = {farms: new Set(["farm-a"]), warehouses: new Set(["store-a"])};
const visible = (alert, scope = managerScope) => actionSourceInScope({farmId: alert.farmId ?? null, warehouseId: alert.warehouseId ?? null}, scope);

test("a record in another farm does not hide this flock's missing work", async () => {
  const alerts = await getCurrentAlerts(database(fixture()), "org");
  const missing = alerts.filter(row => row.source === "Daily Records");
  assert.equal(missing.length, 1);
  assert.equal(missing[0].farmId, "farm-a");
  const target = new URL(missing[0].route, "http://test");
  assert.equal(target.searchParams.get("filter_flockId"), "flock-a");
  assert.equal(target.searchParams.get("filter_page_filterDate"), today);
  assert.ok(visible(missing[0]));
  assert.equal(visible(missing[0], {farms: new Set(["farm-b"]), warehouses: new Set()}), false);
});
test("low stock is per warehouse; another store's stock cannot hide the shortage", async () => {
  const alerts = await getCurrentAlerts(database(fixture()), "org");
  const inventory = alerts.filter(row => row.source === "Inventory");
  assert.deepEqual(inventory.map(row => row.warehouseId).sort(), ["shared", "store-a"]);
  assert.equal(inventory.find(row => row.warehouseId === "store-a").farmId, "farm-a");
  assert.equal(new URL(inventory[0].route, "http://test").searchParams.get("filter_page_warehouseId"), inventory[0].warehouseId);
  const shared = inventory.find(row => row.warehouseId === "shared");
  assert.equal(shared.farmId, null);
  assert.equal(visible(shared), false);
  assert.equal(visible(shared, {farms: new Set(["farm-a"]), warehouses: new Set(["shared"])}), true);
});
test("mortality and missed schedules carry the correct flock's farm", async () => {
  const alerts = await getCurrentAlerts(database(fixture()), "org");
  for (const source of ["Mortality", "Health"]) {
    const alert = alerts.find(row => row.source === source && row.farmId);
    assert.equal(alert.farmId, "farm-a");
    assert.ok(alert.route.includes("flock-a"));
    assert.ok(visible(alert));
  }
  assert.equal(visible(alerts.find(row => row.id === "db-rule")), false);
  assert.equal(visible(alerts.find(row => row.id === "db-rule"), {farms: null, warehouses: null}), true);
});
test("unknown stock, inactive stores, future flocks and old archives do not generate today's work", async () => {
  const data = fixture();
  data.warehouses.find(row => row.id === "store-a").status = "inactive";
  data.warehouses.push({id: "unused", org_id: "org", name: "Empty catalogue", farm_id: "farm-a", status: "active"});
  data.flocks.push({...flock("future", "farm-a"), placement_date: "2999-01-01"},
    {...flock("old", "farm-a"), status: "archived", completed_at: "2020-02-01T00:00:00Z"});
  const alerts = await getCurrentAlerts(database(data), "org");
  assert.equal(alerts.some(row => row.warehouseId === "store-a" || row.warehouseId === "unused"), false);
  assert.equal(alerts.some(row => row.id.startsWith("daily-missing-future") || row.id.startsWith("daily-missing-old")), false);
});
test("other tenants and voided health records cannot contribute to warnings", async () => {
  const data = fixture();
  data.flocks.push({...flock("foreign", "farm-a"), org_id: "other-org"});
  data.health_events[0].voided_at = at;
  data.mortality_events[0].org_id = "other-org";
  const alerts = await getCurrentAlerts(database(data), "org");
  assert.equal(alerts.some(row => row.source === "Health" || row.id.startsWith("mortality-spike") || row.id.includes("foreign")), false);
});
test("failed source reads stop synchronization rather than pretending sources are clear", async () => {
  await assert.rejects(getCurrentAlerts(database(fixture(), "stock_ledger"), "org"), /could not check all source records/);
  await assert.rejects(getCurrentAlerts(database(fixture(), "performance"), "org"), /could not be checked/);
});

test("Addis midnight and seven inclusive dates do not follow UTC's previous day", () => {
  assert.deepEqual(alertOperatingWindow(new Date("2026-10-16T20:59:59Z")), {today: "2026-10-16", sevenDaysAgo: "2026-10-10"});
  assert.deepEqual(alertOperatingWindow(new Date("2026-10-16T21:00:00Z")), {today: "2026-10-17", sevenDaysAgo: "2026-10-11"});
  assert.deepEqual(alertOperatingWindow(new Date("2026-01-01T00:00:00Z")), {today: "2026-01-01", sevenDaysAgo: "2025-12-26"});
});

test("seven-day mortality excludes day eight; voided daily records do not complete work", async () => {
  const data = fixture();
  data.mortality_events[0].record_date = "2026-10-10";
  data.daily_farm_records[0].record_date = "2026-10-17";
  data.daily_farm_records[0].voided_at = at;
  const alerts = await getCurrentAlerts(database(data), "org", new Date("2026-10-16T21:00:00Z"));
  assert.equal(alerts.some(row => row.id.startsWith("mortality-spike")), false);
  assert.ok(alerts.some(row => row.id === "daily-missing-flock-b-2026-10-17"));
});

test("performance warnings use the authoritative result and exact flock/period with coverage", async () => {
  const data = fixture();
  data.performance = [{flock_id: "flock-a", farm_id: "farm-a", house_id: "house-flock-a", flock_code: "A",
    kind: "production", state: "active", severity: "medium", actual: 80, target: 85,
    date_from: "2026-09-18", date_to: "2026-10-17", evidence_days: 20, expected_days: 30},
    {kind: "mortality", state: "unavailable"}, {kind: "production", state: "clear"}];
  const alerts = await getCurrentAlerts(database(data), "org");
  const performance = alerts.filter(row => row.id.startsWith("performance-"));
  assert.equal(performance.length, 1);
  assert.ok(visible(performance[0]));
  assert.match(performance[0].context, /80% against 85%.*20\/30 days \(partial coverage\)/);
  assert.equal(new URL(performance[0].route, "http://test").searchParams.get("filter_flockId"), "flock-a");
  assert.equal(new URL(performance[0].route, "http://test").searchParams.get("flock"), "flock-a");
  assert.equal(new URL(performance[0].route, "http://test").pathname, "/app/flocks");
  assert.equal(alerts.some(row => row.id.startsWith("kpi-")), false);
});

test("a completed schedule replaces its old missed warning without hiding a different schedule", async () => {
  const data = fixture();
  data.health_events[0].created_at = `${today}T06:00:00Z`;
  data.health_events.push({...data.health_events[0], id: "completed", description: "SCHEDULE_STATUS|vaccine|completed|vaccination", created_at: `${today}T07:00:00Z`});
  assert.equal((await getCurrentAlerts(database(data), "org")).some(row => row.source === "Health"), false);
  data.health_events.push({...data.health_events[0], id: "other", description: "SCHEDULE_STATUS|other|missed|weight"});
  assert.match((await getCurrentAlerts(database(data), "org")).find(row => row.source === "Health").context, /^1 missed/);
});
