import assert from "node:assert/strict";
import test from "node:test";
import {managerDestination} from "../src/lib/manager-destinations.ts";
import {readFile} from "node:fs/promises";
import {buildFlockProfile} from "../src/lib/flock-lifecycle/profile.ts";
import {alertDestinationKey} from "../src/lib/alerts-inbox.ts";
import {feedSecondaryMode} from "../src/lib/feed-navigation.ts";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};

const context = {role: "farm_manager", todayWorkspaceEnabled: true, today: "2026-10-24"};
const farm = "11111111-1111-4111-8111-111111111111", flock = "22222222-2222-4222-8222-222222222222", warehouse = "33333333-3333-4333-8333-333333333333";
const resolve = route => new URL(managerDestination(route, context), "https://test.invalid");
test("missing daily work opens Today with the exact farm, flock and operating date", () => {
  const url = resolve(`/app/daily-records?filter_farmId=${farm}&filter_flockId=${flock}&filter_page_filterDate=2026-10-23`);
  assert.equal(url.pathname, "/app/today");
  assert.equal(url.searchParams.get("farm_id"), farm);
  assert.equal(url.searchParams.get("flock_id"), flock);
  assert.equal(url.searchParams.get("date"), "2026-10-23");
  assert.equal(url.searchParams.get("task"), "birds");
});
test("generic past-record browsing opens filtered History, not an old module list", () => {
  const url = resolve(`/app/feeding-log?filter_flockId=${flock}&feed_target=feed_history&filter_dateFrom=2026-09-01&filter_dateTo=2026-09-30`);
  assert.equal(url.pathname, "/app/history");
  assert.equal(url.searchParams.get("filter_page_history_category"), "feeding");
  assert.equal(url.searchParams.get("filter_page_history_flock"), flock);
  assert.equal(url.searchParams.get("filter_page_history_from"), "2026-09-01");
  assert.equal(url.searchParams.get("filter_page_history_to"), "2026-09-30");
});
test("mortality and warehouse warnings open scoped analysis, not legacy dashboards", () => {
  const health = resolve(`/app/mortality?filter_flockId=${flock}`);
  assert.equal(health.pathname, "/app/reports");
  assert.equal(health.searchParams.get("filter_page_performance"), "health");
  assert.equal(health.searchParams.get("filter_flockId"), flock);
  const stock = resolve(`/app/inventory?filter_page_warehouseId=${warehouse}`);
  assert.equal(stock.searchParams.get("filter_page_performance"), "stock");
  assert.equal(stock.searchParams.get("filter_page_reportWarehouse"), warehouse);
});
test("exact exceptional links, unknown destinations, other roles and disabled rollout are unchanged", () => {
  const routes = ["/app/daily-records?record=exact&return_to=%2Fapp%2Fhistory", "/app/feeding-log?finding=exact&feed_target=feed_history", "/app/sales?governance_request=exact", "/app/health?source_id=exact", "/app/reports?financial_period=exact", "/app/governance?request=exact", "/app/reconciliation?finding=exact", "/app/feeding-log?feed_target=template_management", "/app/feeding-log?feed_target=weight_checks", "/app/flocks?flock=exact", "https://example.com", "//example.com/app/sales", "/app/unknown"];
  for (const route of routes) assert.equal(managerDestination(route, context), route);
  for (const role of ["ceo", "system_admin", null]) assert.equal(managerDestination("/app/mortality", {...context, role}), "/app/mortality");
  assert.equal(managerDestination("/app/mortality", {...context, todayWorkspaceEnabled: false}), "/app/mortality");
});
test("out-of-window work cannot become a new Today entry and contradictory scope is not guessed", () => {
  assert.equal(resolve(`/app/daily-records?filter_page_filterDate=2026-10-17&filter_flockId=${flock}`).pathname, "/app/history");
  assert.equal(resolve(`/app/daily-records?filter_page_filterDate=2026-10-25&filter_flockId=${flock}`).pathname, "/app/history");
  const bad = `/app/daily-records?farm_id=${farm}&filter_farmId=${warehouse}&date=2026-10-24`;
  assert.equal(managerDestination(bad, context), bad);
});
test("unknown exact parameters, anchors, invalid dates and branch scopes are never dropped", () => {
  for (const route of ["/app/sales?payment_id=exact", "/app/health?filter_page_healthSchedule=exact", "/app/inventory#transfer", "/app/daily-records?date=2026-02-30", `/app/daily-records?branch_id=${farm}&date=2026-10-24`, "/app/feeding-log?view=advanced", `/app/health?farm_id=bad`]) assert.equal(managerDestination(route, context), route);
  const route = `/app/daily-records?farm_id=${farm}&farm_id=${warehouse}&date=2026-10-24`;
  assert.equal(managerDestination(route, context), route);
});
test("health, sales, expenses and day-closing browsing use History categories", () => {
  for (const [path, category] of [["health", "health"], ["sales", "sales"], ["expenses", "expenses"], ["operating-days", "closing"]]) {
    const url = resolve(`/app/${path}?filter_farmId=${farm}`);
    assert.equal(url.pathname, "/app/history");
    assert.equal(url.searchParams.get("filter_page_history_category"), category);
  }
  const url = resolve(`/app/health?filter_page_healthFarmId=${farm}&filter_page_healthFlockId=${flock}`);
  assert.equal(url.searchParams.get("filter_page_history_flock"), flock);
});
test("feeding task dates and source routes remain immutable and routing is idempotent", () => {
  const route = `/app/feeding-log?farm_id=${farm}&flock_id=${flock}&date=2026-10-19&feed_target=today_sessions`;
  const mapped = managerDestination(route, context);
  assert.equal(new URL(mapped, "https://test.invalid").searchParams.get("date"), "2026-10-19");
  assert.equal(managerDestination(mapped, context), mapped);
  assert.ok(route.startsWith("/app/feeding-log"));
});
test("focused Feed modes are rollout-aware and do not hide exact correction workflows", () => {
  for (const mode of ["template_management", "weight_checks"]) {
    assert.equal(feedSecondaryMode(new URLSearchParams({feed_target: mode}), true), mode);
    assert.equal(feedSecondaryMode(new URLSearchParams({feed_target: mode}), false), null);
    assert.equal(feedSecondaryMode(new URLSearchParams({feed_target: mode, governance_request: "approval"}), true), null);
  }
});
test("enabled flock missing work uses Today only inside the operating window and never for archives", () => {
  const input = {flock: {id: flock, farmId: farm, houseId: warehouse, batchId: farm, type: "layer", status: "active", placementDate: "2026-10-18", ageAtPlacementDays: 120, startingBirds: 10, currentBirds: 10, completionDate: null}, days: 7, today: context.today, daily: [], closedFeedDates: [], targets: [], weights: [], warningVariancePct: 5, criticalVariancePct: 10, allowTodayActions: true};
  const result = buildFlockProfile(input);
  assert.equal(new URL(result.steps.find(row => row.code === "missing_records").href, "https://test.invalid").pathname, "/app/today");
  assert.equal(new URL(result.steps.find(row => row.code === "unfinished_feed").href, "https://test.invalid").pathname, "/app/today");
  assert.ok(result.steps.find(row => row.code === "missing_targets").href.includes("feed_target=template_management"));
  const old = buildFlockProfile({...input, days: 30, flock: {...input.flock, placementDate: "2026-09-01"}});
  assert.ok(old.steps.find(row => row.code === "missing_records").href.startsWith("/app/reconciliation?"));
  const archived = buildFlockProfile({...input, flock: {...input.flock, status: "archived", completionDate: context.today}});
  assert.ok(archived.steps.every(row => !row.href.startsWith("/app/today?")));
});
test("all primary callers use the shared module without mutating server action records", async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const alerts = await read("src/app/app/alerts/page.tsx"), bell = await read("src/components/header-alert-bell.tsx"), today = await read("src/components/today/embedded-task-card.tsx"), birds = await read("src/components/today/bird-check-card.tsx"), feed = await read("src/app/app/feeding-log/page.tsx");
  assert.match(alerts, /route: destination\(action.route\)/);
  assert.match(bell, /route: destination\(action.route\)/);
  assert.match(bell, /route: destination\(item.route\)/);
  assert.match(today, /managerDestination\(route/);
  assert.doesNotMatch(today, /useManagerDestination/);
  assert.match(birds, /kind: "daily_record", id: initial.dailyRecordId/);
  const focused = feed.slice(feed.indexOf("if (secondaryMode) return"), feed.indexOf('return <main className="mx-auto w-full max-w-[1560px] space-y-6'));
  assert.match(focused, /TemplateManager/); assert.match(focused, /WeightTasks/);
  assert.doesNotMatch(focused, /TodayFeeding|FeedTrend|InventoryPanel|MilestoneTimeline/);
  assert.match(feed, /secondaryTargetUnavailable/);
  assert.match(feed, /if \(secondaryTargetUnavailable\) return/);
  assert.match(feed, /const requestedBatch = batchQuery.get\("filter_batchId"\)/);
  assert.match(feed, /batchQuery.has\("batch_id"\) && batchQuery.get\("batch_id"\) !== requestedBatch/);
  for (const [route, key] of [["/app/history", "history"], ["/app/reports", "performance"]]) {
    assert.equal(alertDestinationKey(route), key);
    assert.ok(en.AlertsPage.destinations[key]); assert.ok(am.AlertsPage.destinations[key]);
    assert.notEqual(en.AlertsPage.destinations[key], am.AlertsPage.destinations[key]);
  }
});
