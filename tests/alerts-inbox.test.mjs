import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {managerInboxMatches, orderInbox, alertDestinationKey} from "../src/lib/alerts-inbox.ts";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};

const action = (changes = {}) => ({actionId: "a", ownerId: "manager", canClaim: false,
  status: "assigned", severity: "low", dueAt: "2026-10-20T00:00:00Z", ...changes});
test("filters live inside the green card before refresh; manager assignment is CEO-only", async () => {
  const page = await readFile(new URL("../src/app/app/alerts/page.tsx", import.meta.url), "utf8");
  const hero = page.indexOf('<section className="relative overflow-hidden');
  const filters = page.indexOf('<fieldset aria-label={t("inbox.filters")}');
  const refresh = page.indexOf('{t("inbox.refresh")}');
  const end = page.indexOf('</section>', hero);
  assert.ok(hero >= 0 && hero < filters && filters < refresh && refresh < end);
  assert.match(page, /desk\?\.role === "ceo" \? <AlertFilter label=\{t\("filters\.owners"\)\}/);
  assert.equal(en.AlertsPage.filters.owners, "Assigned manager");
  for (const locale of [en, am]) for (const key of ["allFarms", "allManagers", "allPriorities", "allStatuses", "ownerHelp"])
    assert.ok(locale.AlertsPage.filters[key]);
  assert.match(page, /xl:flex-row xl:items-end/);
  assert.match(page, /text-sand-100/);
});
test("manager default shows unfinished own work, not sent or another manager's work", () => {
  assert.equal(managerInboxMatches(action(), "manager", "mine"), true);
  assert.equal(managerInboxMatches(action({status: "awaiting_verification"}), "manager", "mine"), false);
  assert.equal(managerInboxMatches(action({ownerId: "other"}), "manager", "mine"), false);
  assert.equal(managerInboxMatches(action({status: "resolved"}), "manager", "mine"), false);
  assert.equal(managerInboxMatches(action({status: "escalated"}), "manager", "mine"), true);
});
test("available and review tabs respect claim permission and ownership", () => {
  assert.equal(managerInboxMatches(action({ownerId: null, canClaim: true}), "manager", "unassigned"), true);
  assert.equal(managerInboxMatches(action({ownerId: null}), "manager", "unassigned"), false);
  assert.equal(managerInboxMatches(action({status: "awaiting_verification"}), "manager", "verification"), true);
  assert.equal(managerInboxMatches(action({ownerId: "other", status: "awaiting_verification"}), "manager", "verification"), false);
});
test("overdue/escalated work comes first, then urgency and due date; input is unchanged", () => {
  const rows = [action({actionId: "low"}), action({actionId: "urgent", severity: "high"}),
    action({actionId: "overdue", dueAt: "2026-10-16T00:00:00Z"}), action({actionId: "escalated", status: "escalated"})];
  assert.deepEqual(orderInbox(rows, Date.parse("2026-10-17T00:00:00Z")).map(row => row.actionId), ["overdue", "escalated", "urgent", "low"]);
  assert.equal(rows[0].actionId, "low");
});
test("named destinations retain exact existing routes and have bilingual labels", () => {
  for (const [route, key] of [["/app/today?flock_id=x&task=feeding", "today"], ["/app/flocks?flock=x&details=1", "flock"],
    ["/app/feeding-log?feed_target=feed_history", "feed"], ["/app/inventory?filter_page_warehouseId=x", "stock"],
    ["/app/governance?request=x", "approval"], ["/app/reconciliation?finding=x", "check"], ["/app/alerts", "record"]]) {
    assert.equal(alertDestinationKey(route), key);
    assert.ok(en.AlertsPage.destinations[key]); assert.ok(am.AlertsPage.destinations[key]);
  }
});
test("settings load only when opened; linked alerts bypass filters without bypassing server scope", async () => {
  const page = await readFile(new URL("../src/app/app/alerts/page.tsx", import.meta.url), "utf8");
  assert.match(page, /settingsOpen \? <NotificationSettingsPanel \/> : null/);
  assert.match(page, /if \(linkedActionId\) return item.actionId === linkedActionId/);
  assert.match(page, /href=\{item.route\}/);
  assert.doesNotMatch(page, /min-h-10|h-9 w-9|min-w-\[280px\]/);
  assert.match(page, /aria-pressed=\{managerView === tab\}/);
});
