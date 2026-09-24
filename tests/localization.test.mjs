import assert from "node:assert/strict";
import test from "node:test";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};
import {
  ADDIS_ABABA_TIME_ZONE,
  formatEtb,
  formatHeaderDate,
  formatNumber,
  formatOperationDate,
  formatOperationDateTime,
} from "../src/i18n/formats.ts";
import {
  managerTodayMessageKeys,
  terminologyReview,
} from "../src/i18n/terminology-review.ts";
import {
  todayErrorMessageKeys,
  todayStateMessageKeys,
  todayTaskMessageKeys,
} from "../src/i18n/today-copy.ts";
import {todayErrorCodes} from "../src/lib/today-workspace/contracts.ts";

function messageKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" ? messageKeys(child, path) : [path];
  });
}

test("English and Amharic message catalogs have identical keys", () => {
  assert.deepEqual(messageKeys(am).sort(), messageKeys(en).sort());
});

test("core Today messages are translated rather than copied", () => {
  for (const key of ["title", "question", "farm", "flock", "workDate"]) {
    assert.notEqual(am.Today[key], en.Today[key]);
  }
});

test("manager navigation and notification chrome have real Amharic translations", () => {
  for (const [namespace, keys] of [
    ["ManagerNavigation", ["brand", "assignedBranchScope"]],
    ["PageTitles", ["managerDashboard", "dailyRecords", "alerts"]],
    ["Notifications", ["title", "needsAttention", "updates", "openActionDesk"]],
  ]) {
    for (const key of keys) assert.notEqual(am[namespace][key], en[namespace][key]);
  }
});

test("every Today task, state, and server error resolves through a catalog key", () => {
  assert.deepEqual(Object.keys(todayErrorMessageKeys).sort(), [...todayErrorCodes].sort());
  assert.deepEqual(Object.keys(todayTaskMessageKeys).sort(), [
    "assigned_fixes", "birds", "eggs_water", "expenses", "feeding", "health_deaths",
    "review_finish", "routine_supplies", "sales", "stock",
  ]);
  assert.deepEqual(Object.keys(todayStateMessageKeys).sort(), [
    "complete", "draft_on_tablet", "needs_attention", "not_started", "waiting_to_sync",
  ]);
  for (const key of Object.values(todayErrorMessageKeys)) assert.equal(typeof en.Errors[key], "string");
  for (const key of Object.values(todayTaskMessageKeys)) {
    const leaf = key.split(".").reduce((value, part) => value[part], en.Today);
    assert.equal(typeof leaf, "string");
  }
});

test("the terminology review manifest covers every manager-facing Today message", () => {
  const expected = messageKeys({
    Common: en.Common,
    Navigation: en.Navigation,
    Today: en.Today,
    Errors: en.Errors,
  }).sort();

  assert.deepEqual([...managerTodayMessageKeys].sort(), expected);
  assert.equal(new Set(managerTodayMessageKeys).size, managerTodayMessageKeys.length);
  assert.equal(terminologyReview.sourceDocument, "docs/poultry-terminology-glossary.md");
});

test("partner approval is recorded explicitly with its reviewed version", () => {
  assert.equal(terminologyReview.status, "approved");
  assert.equal(terminologyReview.version, "2026-09-23-approved-1");
  assert.equal(terminologyReview.reviewer, "product_owner_poultry_partner");
  assert.equal(terminologyReview.reviewedAt, "2026-09-23");
});

test("operation date formatting is fixed to Addis Ababa", () => {
  assert.equal(ADDIS_ABABA_TIME_ZONE, "Africa/Addis_Ababa");
  const instant = "2026-09-20T21:30:00.000Z";
  assert.match(formatOperationDate(instant, "en"), /Sep 21, 2026/);
  assert.match(formatOperationDateTime(instant, "en"), /Sep 21, 2026/);
  assert.match(formatHeaderDate(instant, "en"), /Sep 21/);
  assert.notEqual(formatHeaderDate(instant, "am"), formatHeaderDate(instant, "en"));
});

test("number and ETB helpers use Ethiopian display locales", () => {
  assert.match(formatNumber(1234.5, "en"), /1,234\.5/);
  assert.match(formatEtb(1234.5, "en"), /ETB/);
  assert.ok(formatNumber(1234.5, "am").length > 0);
  assert.match(formatEtb(1234.5, "am"), /ETB/);
});
