import assert from "node:assert/strict";
import test from "node:test";
import en from "../messages/en.json" with {type: "json"};
import am from "../messages/am.json" with {type: "json"};
import {
  ADDIS_ABABA_TIME_ZONE,
  formatEtb,
  formatNumber,
  formatOperationDate,
  formatOperationDateTime,
} from "../src/i18n/formats.ts";
import {
  managerTodayMessageKeys,
  terminologyReview,
} from "../src/i18n/terminology-review.ts";

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
});

test("number and ETB helpers use Ethiopian display locales", () => {
  assert.match(formatNumber(1234.5, "en"), /1,234\.5/);
  assert.match(formatEtb(1234.5, "en"), /ETB/);
  assert.ok(formatNumber(1234.5, "am").length > 0);
  assert.match(formatEtb(1234.5, "am"), /ETB/);
});
