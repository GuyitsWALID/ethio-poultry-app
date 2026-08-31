import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260831000000_platform_monitoring_recovery.sql", import.meta.url), "utf8");
const instrumentation = await readFile(new URL("../src/instrumentation.ts", import.meta.url), "utf8");
const service = await readFile(new URL("../src/lib/platform-observability.ts", import.meta.url), "utf8");
const recovery = await readFile(new URL("../scripts/run-recovery-drill.mjs", import.meta.url), "utf8");
const monitoringWorkflow = await readFile(new URL("../.github/workflows/platform-monitoring.yml", import.meta.url), "utf8");
const recoveryWorkflow = await readFile(new URL("../.github/workflows/recovery-drill.yml", import.meta.url), "utf8");

test("platform evidence is append-only and readable only by an active System Administrator", () => {
  assert.match(migration, /platform_operational_evidence_immutable/i);
  assert.match(migration, /before update or delete/i);
  assert.match(migration, /role::text in \('system_admin', 'super_admin'\)/i);
  assert.match(migration, /revoke all .* from anon, authenticated/i);
  assert.match(migration, /grant select .* to authenticated/i);
});

test("monitor intake is idempotent and rejects secret-shaped evidence fields", () => {
  assert.match(service, /idempotency_key/i);
  assert.match(service, /error\.code === "23505"/i);
  assert.match(service, /secret\|token\|password\|cookie\|authorization/i);
  assert.match(service, /crypto\.subtle\.digest\("SHA-256"/i);
});

test("request error capture omits messages, headers, and query strings", () => {
  assert.match(instrumentation, /application\.request_error/i);
  assert.match(instrumentation, /request\.path\.split\("\?"/i);
  assert.doesNotMatch(instrumentation, /error\.message/i);
  assert.doesNotMatch(instrumentation, /request\.headers/i);
});

test("recovery drill refuses remote destinations and removes temporary data", () => {
  assert.match(recovery, /\["127\.0\.0\.1", "localhost"\]/i);
  assert.match(recovery, /Recovery drills may restore only into an isolated local database/i);
  assert.match(recovery, /rm\(work, \{ recursive: true, force: true \}\)/i);
});

test("monitoring and restore drills have recurring schedules", () => {
  assert.match(monitoringWorkflow, /cron: "\*\/15 \* \* \* \*"/i);
  assert.match(monitoringWorkflow, /cron: "23 4 \* \* \*"/i);
  assert.match(recoveryWorkflow, /cron: "17 3 1 \* \*"/i);
  assert.match(recoveryWorkflow, /if: always\(\)/i);
});
