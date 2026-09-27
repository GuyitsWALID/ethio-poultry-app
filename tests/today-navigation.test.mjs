import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {buildTodayEntryHref, isLegacyCorrectionTarget} from "../src/lib/today-workspace/entry-routing.ts";

const sidebar = await readFile(new URL("../src/components/app-sidebar.tsx", import.meta.url), "utf8");
const context = await readFile(new URL("../src/app/api/me/context/route.ts", import.meta.url), "utf8");
const authRouting = await readFile(new URL("../src/lib/auth-routing.ts", import.meta.url), "utf8");
const dailyRecords = await readFile(new URL("../src/app/app/daily-records/page.tsx", import.meta.url), "utf8");
const feed = await readFile(new URL("../src/app/app/feeding-log/page.tsx", import.meta.url), "utf8");
const health = await readFile(new URL("../src/app/app/health/page.tsx", import.meta.url), "utf8");
const inventory = await readFile(new URL("../src/app/app/inventory/page.tsx", import.meta.url), "utf8");
const sales = await readFile(new URL("../src/app/app/sales/page.tsx", import.meta.url), "utf8");
const entryLink = await readFile(new URL("../src/components/today/today-entry-link.tsx", import.meta.url), "utf8");
const mortality = await readFile(new URL("../src/components/mortality/mortality-control-room.tsx", import.meta.url), "utf8");
const cards = await readFile(new URL("../src/components/today/embedded-task-card.tsx", import.meta.url), "utf8");

test("enabled Farm Managers get Today-first navigation while disabled tenants keep legacy navigation", () => {
  assert.match(sidebar, /simplifiedFarmManagerNavSections/);
  for (const destination of ["/app/today", "/app/flocks", "/app/alerts"]) assert.match(sidebar, new RegExp(destination.replaceAll("/", "\\/")));
  assert.match(sidebar, /navigationKey: "historyMore"/);
  assert.match(sidebar, /todayWorkspaceEnabled \? simplifiedFarmManagerNavSections : farmManagerNavSections/);
  assert.match(context, /todayWorkspaceEnabled: Boolean\(organization\?\.today_workspace_enabled\)/);
});

test("enabled Farm Managers land on Today after authentication", () => {
  assert.match(authRouting, /organization\?\.today_workspace_enabled/);
  assert.match(authRouting, /return "\/app\/today"/);
  assert.match(authRouting, /return routeForRole\(resolvedRole\)/);
});

test("routine legacy entry controls hand enabled managers to the exact Today card", () => {
  assert.match(entryLink, /scope\.isFarmManager && scope\.todayWorkspaceEnabled/);
  assert.match(entryLink, /buildTodayEntryHref/);
  assert.match(entryLink, /!isLegacyCorrectionTarget\(query\)/);
  assert.match(dailyRecords, /TodayEntryLink task="birds"/);
  assert.match(feed, /TodayEntryLink task="feeding"/);
  assert.match(health, /TodayEntryLink task="health_deaths"/);
  assert.match(inventory, /TodayEntryLink task="stock"/);
  assert.match(inventory, /TodayEntryLink task="expenses"/);
  assert.match(sales, /TodayEntryLink task="sales"/);
  assert.match(mortality, /TodayEntryLink task="health_deaths"/);
});

const scope = {farmId: "old-farm", houseId: "old-house", flockId: "old-flock"};
const flocks = [{id: "flock-2", farm_id: "farm-2", house_id: "house-2"}];
const houses = [{id: "house-2", farm_id: "farm-2"}];
const date = "2026-09-27";
const queryOf = (href) => new URL(href, "https://example.test").searchParams;

test("flock handoffs derive exact parent context instead of stale page filters", () => {
  const query = queryOf(buildTodayEntryHref("feeding", {flockId: "flock-2", date: "2026-09-26"}, scope, flocks, houses, date));
  assert.equal(query.get("farm_id"), "farm-2");
  assert.equal(query.get("house_id"), "house-2");
  assert.equal(query.get("flock_id"), "flock-2");
  assert.equal(query.get("date"), "2026-09-26");
  assert.equal(query.get("task"), "feeding");
});

test("warehouse and farm handoffs discard unrelated flock filters and select count mode", () => {
  const query = queryOf(buildTodayEntryHref("stock", {farmId: "farm-2", warehouseId: "store-2", stockMode: "count"}, scope, flocks, houses, date));
  assert.equal(query.get("farm_id"), "farm-2");
  assert.equal(query.get("flock_id"), null);
  assert.equal(query.get("house_id"), null);
  assert.equal(query.get("warehouse_id"), "store-2");
  assert.equal(query.get("stock_mode"), "count");
  assert.equal(query.get("date"), date);
  assert.match(inventory, /chooseView\(id as View\)/);
  assert.match(inventory, /!todayEntryEnabled&&view==="count"/);
  assert.match(cards, /detail\.warehouses\.some\(\(row\) => row\.id === requestedWarehouse\)/);
});

test("unknown flock targets never reuse unrelated parent context", () => {
  const query = queryOf(buildTodayEntryHref("birds", {flockId: "unknown"}, scope, flocks, houses, date));
  assert.equal(query.get("farm_id"), null);
  assert.equal(query.get("house_id"), null);
});

test("normal entry preserves selected context but always defaults to today's date", () => {
  for (const task of ["birds", "feeding", "health_deaths", "sales", "expenses"]) {
    const query = queryOf(buildTodayEntryHref(task, {}, scope, [], [], date));
    assert.equal(query.get("task"), task);
    assert.equal(query.get("farm_id"), scope.farmId);
    assert.equal(query.get("date"), date);
  }
});

test("finding, governed correction, record and action deep links stay on legacy editors", () => {
  for (const key of ["finding", "governance_request", "approval", "authorization", "record", "record_id", "source_id", "action", "action_id"]) {
    assert.equal(isLegacyCorrectionTarget(new URLSearchParams({[key]: "exact-target"})), true, key);
  }
  assert.equal(isLegacyCorrectionTarget(new URLSearchParams({filter_dateFrom: "2026-09-01"})), false);
  assert.match(dailyRecords, /if \(existing\).*setEditingRow/);
  assert.match(sales, /openEdit\(matches\[0\]\)/);
  assert.match(feed, /useTodayEntryMode/);
  assert.match(health, /todayEntryEnabled && item\.type === "vaccination"/);
});
