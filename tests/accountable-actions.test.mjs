import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readFile } from "node:fs/promises";

const policySource = await readFile(new URL("../src/lib/action-desk-policy.ts", import.meta.url), "utf8");
const policyCompiled = ts.transpileModule(policySource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const policy = await import(`data:text/javascript;base64,${Buffer.from(policyCompiled).toString("base64")}`);
const migration = await readFile(new URL("../supabase/migrations/20260901000000_accountable_operational_actions.sql", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/app/alerts/page.tsx", import.meta.url), "utf8");
const actionService = await readFile(new URL("../src/lib/accountable-actions.ts", import.meta.url), "utf8");
const notificationService = await readFile(new URL("../src/lib/notification-service.ts", import.meta.url), "utf8");
const bell = await readFile(new URL("../src/components/header-alert-bell.tsx", import.meta.url), "utf8");

test("severity deadlines are explicit and predictable", () => {
  const start = new Date("2026-09-01T00:00:00.000Z");
  assert.equal(policy.actionDeadlineAt("high", start), "2026-09-02T00:00:00.000Z");
  assert.equal(policy.actionDeadlineAt("medium", start), "2026-09-04T00:00:00.000Z");
  assert.equal(policy.actionDeadlineAt("low", start), "2026-09-08T00:00:00.000Z");
});

test("submitted evidence cannot clear an action without source verification", () => {
  assert.equal(policy.actionStatusAfter("submit_resolution", "in_progress"), "awaiting_verification");
  assert.equal(policy.actionStatusAfter("verify", "awaiting_verification", true), "in_progress");
  assert.equal(policy.actionStatusAfter("verify", "awaiting_verification", false), "resolved");
});

test("database custody is scoped, server-mutated, and append-only", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /has_active_farm_access/);
  assert.match(migration, /has_active_warehouse_access/);
  assert.match(migration, /has_active_break_glass/);
  assert.match(migration, /revoke insert,update,delete on public\.operational_actions,public\.operational_action_events from anon,authenticated/i);
  assert.match(migration, /operational_action_events_append_only/i);
});

test("action desk exposes assignment, evidence, source inspection, and verification", () => {
  assert.match(page, /Choose Farm Manager/);
  assert.match(page, /Complete and send for review/);
  assert.match(page, /Inspect source/);
  assert.match(page, /Verify and close/);
  assert.match(page, /CEO must verify that the originating check is clear/i);
});

test("a corrected assigned task remains visible for manager completion and CEO verification", () => {
  assert.match(actionService, /Source status: The source check is clear/);
  assert.match(actionService, /async function inventoryAlertActive/);
  assert.match(actionService, /isReconciliationFindingActive/);
  assert.match(actionService, /if \(ctx\.role !== "ceo"\) throw new Error\("Only the CEO can verify and close completed actions\."\)/);
  assert.match(page, /Complete and send for review/);
  assert.match(page, /Verify and close/);
  assert.match(notificationService, /Task completed by \$\{actorName\}/);
  assert.match(notificationService, /Source corrected:/);
  assert.match(notificationService, /\["assigned", "resolution_submitted"\]\.includes\(notification\.eventType\)/);
  assert.match(bell, /if \(!open\) load\(\)/);
  assert.match(bell, /await loadAttention\(\);\s*await loadNotifications\(\)/);
});
