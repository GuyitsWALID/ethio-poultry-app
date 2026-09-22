import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const operations = await read("../src/lib/farm-operations.ts");
const inventory = await read("../src/lib/inventory-operations.ts");
const actions = await read("../src/lib/accountable-actions.ts");
const mortality = await read("../src/lib/mortality-dashboard.ts");
const routes = {
  daily: await read("../src/app/api/inventory/daily-usage/route.ts"),
  feedSessions: await read("../src/app/api/feed/sessions/route.ts"),
  feedClose: await read("../src/app/api/feed/day-close/route.ts"),
  health: await read("../src/app/api/health/events/route.ts"),
  sales: await read("../src/app/api/sales/records/route.ts"),
  expenses: await read("../src/app/api/profit/cost-entries/route.ts"),
  receipts: await read("../src/app/api/inventory/receipts/route.ts"),
  action: await read("../src/app/api/alerts/actions/[id]/route.ts"),
};

test("legacy mutation routes delegate through stable farm-operation interfaces", () => {
  assert.match(routes.daily, /saveDailyRecordWithUsage\(ctx, body\)/);
  assert.match(routes.feedSessions, /saveFeedSession\(ctx, body\)/);
  assert.match(routes.feedSessions, /voidFeedSession\(ctx, body\)/);
  assert.match(routes.feedClose, /closeFeedDay\(ctx, body\)/);
  assert.match(routes.feedClose, /reopenFeedDay\(ctx, body\)/);
  assert.match(routes.health, /recordHealthEvidence\(ctx,body\)/);
  assert.match(routes.sales, /recordSale\(ctx, body\)/);
  assert.match(routes.expenses, /recordExpense\(ctx, body\)/);
  assert.match(routes.receipts, /receiveInventoryStock/);
  assert.match(routes.action, /transitionAction/);
});

test("shared operations retain authoritative atomic boundaries and audit evidence", () => {
  assert.match(operations, /save_daily_record_with_usage/);
  assert.match(operations, /close_feed_day/);
  assert.match(operations, /record_health_event_with_inventory/);
  assert.match(operations, /complete_vaccination_with_inventory/);
  assert.match(operations, /daily_sales_records/);
  assert.match(operations, /cost_entries/);
  assert.match(operations, /recordAuditEvent/);
  assert.match(inventory, /receive_inventory_stock/);
  assert.match(actions, /action_events/);
});

test("mortality remains reconciled against the authoritative Daily Record domain", () => {
  assert.match(mortality, /reconcileCauses/);
  assert.match(mortality, /officialDeaths/);
  assert.match(operations, /saveDailyRecordWithUsage/);
});

test("thin routes preserve their legacy response envelopes", () => {
  assert.match(routes.daily, /\{ result: operation\.result \}/);
  assert.match(routes.feedSessions, /\{session:/);
  assert.match(routes.feedSessions, /\{voided:true\}/);
  assert.match(routes.feedClose, /\{result:/);
  assert.match(routes.health, /\{completion:result\.data\}/);
  assert.match(routes.health, /\{event:result\.data\}/);
  assert.match(routes.sales, /\{ record: data \}/);
  assert.match(routes.expenses, /\{ costEntry: data \}/);
});

test("legacy input normalization remains at the shared boundary", () => {
  assert.match(operations, /category: typeof raw\.category === "string" \? raw\.category\.trim\(\) : raw\.category/);
  assert.match(operations, /remember_template: raw\.remember_template === true/);
  assert.match(operations, /usages: z\.array\(z\.unknown\(\)\)/);
  assert.match(operations, /code === "23505" \|\| code === "23514"/);
});

test("legacy routes reject unauthorized mutations before parsing JSON", () => {
  const guardedRoutes = [
    [routes.daily, "canMutate"],
    [routes.sales, "canMutate"],
    [routes.expenses, "canMutate"],
    [routes.feedSessions, "canManage"],
    [routes.feedClose, "canManage"],
    [routes.health, 'ctx.role!=="farm_manager"'],
  ];
  for (const [source, guard] of guardedRoutes) {
    const authGuard = source.indexOf(guard);
    const parseBody = source.indexOf("request.json()", authGuard);
    assert.ok(authGuard >= 0, "mutation route must retain an authorization guard");
    assert.ok(parseBody > authGuard, "authorization must run before request body parsing");
  }
});
