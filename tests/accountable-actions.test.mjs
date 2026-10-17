import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import en from "../messages/en.json" with {type: "json"};

const policySource = await readFile(new URL("../src/lib/action-desk-policy.ts", import.meta.url), "utf8");
const policyCompiled = ts.transpileModule(policySource, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const policy = await import(`data:text/javascript;base64,${Buffer.from(policyCompiled).toString("base64")}`);
const migration = await readFile(new URL("../supabase/migrations/20260901000000_accountable_operational_actions.sql", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/app/alerts/page.tsx", import.meta.url), "utf8");
const actionService = await readFile(new URL("../src/lib/accountable-actions.ts", import.meta.url), "utf8");
const notificationService = await readFile(new URL("../src/lib/notification-service.ts", import.meta.url), "utf8");
const bell = await readFile(new URL("../src/components/header-alert-bell.tsx", import.meta.url), "utf8");
const acknowledgement = await readFile(new URL("../supabase/migrations/20261016000000_atomic_action_acknowledgement.sql", import.meta.url), "utf8");
const transitions = await readFile(new URL("../supabase/migrations/20261016001000_atomic_action_transitions.sql", import.meta.url), "utf8");
const sourceChecks = await readFile(new URL("../supabase/migrations/20261016002000_exact_action_source_verification.sql", import.meta.url), "utf8");

test("verification cannot use absence from an alert list as proof of resolution", () => {
  assert.doesNotMatch(actionService, /collectOperationalAlerts\(ctx\)\)\.some/);
  assert.match(actionService, /operational_action_source_state/);
  assert.match(sourceChecks, /Could not verify this problem/);
  assert.match(sourceChecks, /v_source:=public\.operational_action_source_state/);
  assert.doesNotMatch(sourceChecks, /\blimit\s+\d+/i);
  assert.match(sourceChecks, /'approved'.*'conflict'.*'expired'/);
  assert.match(sourceChecks, /'legacy_retired'/);
  assert.equal(policy.isLegacyUnscopedWarning("daily-missing", null), true);
  assert.equal(policy.isLegacyUnscopedWarning("daily-missing-flock-2026-10-17", null), false);
  assert.match(page, /desk\?\.role === "ceo" && actions.some\(action => action.canRetireLegacy\)/);
});

test("all action saves and background refreshes use the revision-guarded atomic boundary", () => {
  assert.doesNotMatch(actionService, /from\("operational_actions"\)\.update\(/);
  assert.match(actionService, /p_expected_revision: row\.revision/);
  assert.match(transitions, /v_before\.revision<>p_expected_revision/);
  assert.match(transitions, /for update/i);
  assert.match(transitions, /public\.apply_operational_action_transition\(p_actor_id,v_org_id,v_action\.id/);
  assert.match(page, /expectedRevision/);
  assert.match(transitions, /source_last_seen_at/);
});

test("Alerts acknowledges through one atomic status/history/audit boundary", () => {
  assert.match(actionService, /db\.rpc\("apply_operational_action_transition"/);
  assert.doesNotMatch(actionService, /if \(command.command === "acknowledge"\) changes/);
  assert.match(acknowledgement, /for update/i);
  assert.match(acknowledgement, /is distinct from p_expected_updated_at/);
  assert.match(acknowledgement, /'acknowledged',p_actor_id/);
  assert.match(acknowledgement, /insert into public\.governance_audit_events/);
  assert.match(acknowledgement, /from public,anon,authenticated/);
  assert.match(page, /acknowledged: "events\.acknowledge"/);
});

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
  assert.equal(en.AlertsPage.card.chooseManager, "Choose Farm Manager");
  assert.equal(en.AlertsPage.card.complete, "Complete and send for review");
  assert.equal(en.AlertsPage.card.inspectSource, "Inspect source");
  assert.equal(en.AlertsPage.card.verify, "Verify and close");
  assert.match(en.AlertsPage.dialog.evidenceHelp, /CEO must verify that the originating check is clear/i);
  for (const key of ["chooseManager", "verify"]) assert.match(page, new RegExp(`t\\(\"card\\.${key}\"\\)`));
  assert.ok(page.includes('t("card.inspectSource")'));
  assert.ok(page.includes('t("card.complete")'));
  assert.match(page, /t\("dialog\.evidenceHelp"\)/);
});

test("a corrected assigned task remains visible for manager completion and CEO verification", () => {
  assert.match(actionService, /Source status: The source check is clear/);
  assert.match(actionService, /async function exactSourceState/);
  assert.match(actionService, /isReconciliationFindingActive/);
  assert.match(actionService, /if \(ctx\.role !== "ceo"\) throw new Error\("Only the CEO can verify and close completed actions\."\)/);
  assert.ok(page.includes('t("card.complete")'));
  assert.match(page, /t\("card\.verify"\)/);
  assert.match(notificationService, /Task completed by \$\{actorName\}/);
  assert.match(notificationService, /Source corrected:/);
  assert.match(notificationService, /\["assigned", "resolution_submitted"\]\.includes\(notification\.eventType\)/);
  assert.match(bell, /if \(!open\) load\(\)/);
  assert.match(bell, /await loadAttention\(\);\s*await loadNotifications\(\)/);
});
