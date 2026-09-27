import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/api/farm-manager/today/tasks/[task]/route.ts", import.meta.url), "utf8");
const loader = await readFile(new URL("../src/lib/today-workspace/task-details.ts", import.meta.url), "utf8");
const contracts = await readFile(new URL("../src/lib/today-workspace/contracts.ts", import.meta.url), "utf8");
const card = await readFile(new URL("../src/components/today/embedded-task-card.tsx", import.meta.url), "utf8");

test("task details use a thin private, assignment-safe server boundary", () => {
  assert.match(route, /loadTodayTaskDetail/);
  assert.match(route, /Cache-Control.*private, no-store/);
  assert.match(loader, /canAccessFarm/);
  assert.match(loader, /eq\("org_id", context\.orgId\)/);
  assert.match(loader, /eq\("farm_id", input\.farmId\)/);
  assert.doesNotMatch(route, /governanceAdmin|\.from\(/);
});

test("every embedded task receives trusted choices, revisions, and a correction destination", () => {
  for (const task of ["birds", "feeding", "eggs_water", "health_deaths", "routine_supplies", "stock", "sales", "expenses", "assigned_fixes", "review_finish"]) {
    assert.match(loader, new RegExp(`\\b${task}\\b`));
  }
  assert.match(contracts, /resourceRevision\?: string/);
  assert.match(contracts, /dependencies: string\[\]/);
  assert.match(loader, /today_resource_revision/);
  assert.match(loader, /correctionDestination/);
  assert.match(loader, /assignedWarehouses/);
  assert.match(loader, /inventoryOptions/);
});

test("Today embeds operational mutations instead of linking to entry pages", () => {
  assert.match(card, /complete_vaccination/);
  assert.match(card, /record_stock_receipt/);
  assert.match(card, /record_stock_count/);
  assert.match(loader, /inventory_count_sessions/);
  assert.match(loader, /countDueWarehouseIds/);
  assert.match(card, /record_sale/);
  assert.match(card, /record_expense/);
  assert.match(card, /update_assigned_action/);
  assert.match(card, /supplyRows\.map/);
  assert.doesNotMatch(card, /href="\/app\/(feeding-log|daily-records|health|inventory|sales)"/);
});
