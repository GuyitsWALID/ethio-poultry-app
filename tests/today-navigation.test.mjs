import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const sidebar = await readFile(new URL("../src/components/app-sidebar.tsx", import.meta.url), "utf8");
const context = await readFile(new URL("../src/app/api/me/context/route.ts", import.meta.url), "utf8");
const authRouting = await readFile(new URL("../src/lib/auth-routing.ts", import.meta.url), "utf8");
const dailyRecords = await readFile(new URL("../src/app/app/daily-records/page.tsx", import.meta.url), "utf8");
const feed = await readFile(new URL("../src/app/app/feeding-log/page.tsx", import.meta.url), "utf8");
const health = await readFile(new URL("../src/app/app/health/page.tsx", import.meta.url), "utf8");
const inventory = await readFile(new URL("../src/app/app/inventory/page.tsx", import.meta.url), "utf8");
const sales = await readFile(new URL("../src/app/app/sales/page.tsx", import.meta.url), "utf8");
const entryLink = await readFile(new URL("../src/components/today/today-entry-link.tsx", import.meta.url), "utf8");

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
  assert.match(entryLink, /query\.set\("farm_id"/);
  assert.match(entryLink, /query\.set\("flock_id"/);
  assert.match(dailyRecords, /TodayEntryLink task="birds"/);
  assert.match(feed, /TodayEntryLink task="feeding"/);
  assert.match(health, /TodayEntryLink task="health_deaths"/);
  assert.match(inventory, /TodayEntryLink task="stock"/);
  assert.match(inventory, /TodayEntryLink task="expenses"/);
  assert.match(sales, /TodayEntryLink task="sales"/);
});
