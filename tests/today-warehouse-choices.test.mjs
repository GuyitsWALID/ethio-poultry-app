import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {isTodayWarehouseEligible} from "../src/lib/today-workspace/warehouse-choices.ts";

const farmStore = {id: "farm-store", farmId: "farm", branchId: "branch"};
const branchStore = {id: "branch-store", farmId: null, branchId: "branch"};
const otherBranch = {id: "other-branch", farmId: null, branchId: "other"};
const otherFarm = {id: "other-farm", farmId: "other", branchId: "branch"};
const allowed = (task, warehouse, assignments = []) => isTodayWarehouseEligible(task, "farm", "branch", warehouse, new Set(assignments));

test("feeding requires effective access and retains farm/branch compatibility", () => {
  assert.equal(allowed("feeding", farmStore), false);
  assert.equal(allowed("feeding", branchStore), false);
  assert.equal(allowed("feeding", farmStore, [farmStore.id]), true);
  assert.equal(allowed("feeding", branchStore, [branchStore.id]), true);
  assert.equal(allowed("feeding", otherBranch, [otherBranch.id]), false);
  assert.equal(allowed("feeding", otherFarm, [otherFarm.id]), false);
  assert.equal(isTodayWarehouseEligible("feeding", "farm", null, branchStore, new Set()), false);
});

test("all tasks use the effective warehouse scope without expanding task-specific eligibility", () => {
  for (const task of ["stock", "health_deaths", "routine_supplies", "expenses"]) {
    assert.equal(allowed(task, farmStore), false);
    assert.equal(allowed(task, branchStore), false);
    assert.equal(allowed(task, farmStore, [farmStore.id]), true);
    assert.equal(allowed(task, branchStore, [branchStore.id]), true);
    assert.equal(allowed(task, otherFarm, [otherFarm.id]), false);
    assert.equal(allowed(task, otherBranch, [otherBranch.id]), true);
  }
});

test("warehouse choices load only tenant-scoped, active, current assignments", async () => {
  const loader = await readFile(new URL("../src/lib/today-workspace/task-details.ts", import.meta.url), "utf8");
  const scope = loader.slice(loader.indexOf("async function assignedWarehouses"), loader.indexOf("async function inventoryOptions"));
  assert.match(scope, /effectiveWarehouseIds\(context\)/);
  assert.doesNotMatch(scope, /user_warehouse_access|task !== "feeding"/);
  assert.match(scope, /eq\("org_id", context\.orgId\)/);
  assert.match(scope, /eq\("status", "active"\)/);
  assert.match(scope, /isTodayWarehouseEligible/);
  assert.match(loader, /assignedWarehouses\(context, input\.farmId, task\)/);
});
