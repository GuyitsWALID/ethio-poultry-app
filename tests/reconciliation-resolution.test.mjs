import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const contract = await readFile(new URL("../src/lib/reconciliation-resolution-contract.ts", import.meta.url), "utf8");
const resolver = await readFile(new URL("../src/lib/reconciliation-resolution.ts", import.meta.url), "utf8");
const assignment = await readFile(new URL("../src/components/reconciliation-assignment-panel.tsx", import.meta.url), "utf8");
const correction = await readFile(new URL("../src/components/record-check-correction-banner.tsx", import.meta.url), "utf8");
const notifications = await readFile(new URL("../src/lib/notification-service.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260910000000_exact_record_check_resolution.sql", import.meta.url), "utf8");

const rules = [
  "BIRD_DAY_COUNTS_MISSING", "BIRD_DAY_IMBALANCE", "EGG_CLASSIFICATION_MISMATCH", "MORTALITY_ALLOCATION_MISMATCH",
  "LOCKED_RECORD_CHANGED_WITHOUT_APPROVAL", "BIRD_DAY_CONTINUITY_BREAK", "FLOCK_CURRENT_COUNT_MISMATCH",
  "FEED_SESSION_CLOSE_MISMATCH", "FEED_DAILY_SYNC_MISMATCH", "FEED_STOCK_ISSUE_MISMATCH", "EGG_SALE_UNLINKED",
  "EGG_SALE_UNIT_UNCONVERTED", "EGG_OPENING_BALANCE_UNAVAILABLE", "EGG_SALES_EXCEED_PRODUCTION",
  "POSSIBLE_DUPLICATE_SALE", "PHYSICAL_STOCK_VARIANCE", "REPEATED_STOCK_ADJUSTMENTS", "COST_ALLOCATION_MISMATCH",
  "LOCKED_FINANCIAL_PERIOD_HAS_GAPS", "PAST_FINANCIAL_PERIOD_UNLOCKED", "ACTIVE_FLOCK_LINEAGE_BROKEN",
  "BATCH_FLOCK_PLACEMENT_MISMATCH",
];

test("all 22 deterministic rules have an explicit resolution contract", () => {
  assert.equal(rules.length, 22);
  for (const rule of rules) {
    assert.match(contract, new RegExp(`${rule}:\\s*\\{`), `${rule} has no resolution definition`);
  }
  assert.doesNotMatch(contract, /inventory\?tab=monthly/);
  assert.match(contract, /Which record is incorrect|choose_source/);
});

test("the resolver is tenant scoped and returns readable evidence rather than identifiers", () => {
  assert.match(resolver, /eq\("org_id", ctx\.orgId\)/);
  assert.match(resolver, /assertFindingAccess/);
  assert.match(resolver, /field !== "id" && field !== "flock_id"/);
  assert.match(correction, /Exact records used by this check/);
  assert.doesNotMatch(correction, /UUID|database identifier/i);
});

test("assignment, completion, and CEO verification use the existing Action Desk engine", () => {
  assert.match(assignment, /Assign and notify/);
  assert.match(assignment, /Complete and send to CEO/);
  assert.match(assignment, /Verify and close/);
  assert.match(notifications, /exactRecordCheckRoute/);
  assert.match(notifications, /source_route/);
});

test("legacy opening custody, governed conversions, and exceptions are one-time audited operations", () => {
  assert.match(migration, /create table if not exists public\.egg_custody_opening_balances/);
  assert.match(migration, /apply_egg_opening_balance_request/);
  assert.match(migration, /apply_sales_unit_conversion_request/);
  assert.match(migration, /accept_reconciliation_exception/);
  assert.match(migration, /for update/);
  assert.match(migration, /exception_accepted/);
});
