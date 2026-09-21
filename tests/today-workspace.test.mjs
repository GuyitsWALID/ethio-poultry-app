import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {deriveTodayWorkspace} from "../src/lib/today-workspace/workspace.ts";

const route = await readFile(new URL("../src/app/api/farm-manager/today/route.ts", import.meta.url), "utf8");
const workspaceModule = await readFile(new URL("../src/lib/today-workspace/workspace.ts", import.meta.url), "utf8");

const selection = {farmId: "farm-1", workDate: "2026-09-20"};

function flock(overrides = {}) {
  return {
    id: "flock-1",
    code: "LAYER-A",
    type: "layer",
    batchLabel: "Batch A",
    houseLabel: "House 1",
    placementDate: "2026-09-01",
    ageAtPlacementDays: 100,
    currentCount: 1000,
    dailyRecord: {
      id: "daily-1",
      openingBirds: 1000,
      closingBirds: 998,
      deaths: 2,
      normalEggs: 800,
      brokenEggs: 5,
      dirtyEggs: 3,
      totalEggs: 808,
      waterLiters: 200,
      revision: "daily-revision",
    },
    previousClosingBirds: 1000,
    feedClosed: true,
    feedRevision: "feed-revision",
    hasHealthOrDeathActivity: true,
    hasRoutineSupplyUsage: false,
    healthFingerprint: "health-current",
    suppliesFingerprint: "supplies-current",
    healthAttestationFingerprint: null,
    suppliesAttestationFingerprint: "supplies-current",
    ...overrides,
  };
}

function data(flocks = [flock()]) {
  return {
    organization: {todayWorkspaceEnabled: true},
    profile: {preferredLocale: "en"},
    farm: {id: "farm-1", name: "Pilot Farm"},
    operatingDay: {status: "open", revision: "day-revision"},
    flocks,
    assignedActionCount: 0,
  };
}

test("complete layer evidence makes the operating day finishable", () => {
  const workspace = deriveTodayWorkspace(data(), selection, true);
  assert.equal(workspace.capabilities.canFinish, true);
  assert(workspace.flocks[0].tasks.every((item) => item.state === "complete"));
  assert.equal(workspace.flocks[0].openingBirds, 1000);
  assert.equal(workspace.flocks[0].ageDays, 119);
});

test("broilers do not require egg classification but still require water", () => {
  const broiler = flock({
    type: "broiler",
    dailyRecord: {...flock().dailyRecord, normalEggs: null, brokenEggs: null, dirtyEggs: null, totalEggs: null},
  });
  const workspace = deriveTodayWorkspace(data([broiler]), selection, true);
  assert.equal(workspace.flocks[0].tasks.find((item) => item.code === "eggs_water")?.state, "complete");
});

test("a partial flock day identifies each missing authoritative task", () => {
  const partial = flock({
    dailyRecord: null,
    feedClosed: false,
    hasHealthOrDeathActivity: false,
    healthAttestationFingerprint: "stale-health",
    suppliesAttestationFingerprint: null,
  });
  const workspace = deriveTodayWorkspace(data([partial]), selection, true);
  const states = Object.fromEntries(workspace.flocks[0].tasks.map((item) => [item.code, item.state]));
  assert.deepEqual(states, {
    birds: "not_started",
    feeding: "not_started",
    eggs_water: "not_started",
    health_deaths: "not_started",
    routine_supplies: "not_started",
  });
  assert.equal(workspace.capabilities.canFinish, false);
});

test("a no-active-flock farm can still finish its operating day", () => {
  const workspace = deriveTodayWorkspace(data([]), selection, true);
  assert.equal(workspace.flocks.length, 0);
  assert.equal(workspace.capabilities.canFinish, true);
  assert.equal(workspace.farmTasks.find((item) => item.code === "stock")?.applicable, true);
});

test("backdated work derives age and balances from the selected date", () => {
  const backdated = deriveTodayWorkspace(data([flock({placementDate: "2026-09-10", ageAtPlacementDays: 7})]), selection, true);
  assert.equal(backdated.flocks[0].ageDays, 17);
  assert.equal(backdated.workDate, "2026-09-20");
});

test("assigned fixes stay visible without silently blocking Finish day", () => {
  const withAction = data();
  withAction.assignedActionCount = 2;
  const workspace = deriveTodayWorkspace(withAction, selection, true);
  assert.equal(workspace.farmTasks.find((item) => item.code === "assigned_fixes")?.state, "needs_attention");
  assert.equal(workspace.capabilities.canFinish, true);
});

test("Today GET is a thin private adapter and checks assignment before loading sources", () => {
  assert.match(route, /loadTodayWorkspace\(context, \{farmId, workDate\}\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /error_code/);
  assert(workspaceModule.indexOf("await canAccessFarm") < workspaceModule.indexOf('from("organizations")'));
  assert.doesNotMatch(route, /governanceAdmin|\.from\(/);
});
