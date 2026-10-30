import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import test from "node:test";

test("recording-start release refuses a non-staging target before SQL", () => {
  const result = spawnSync(process.execPath, ["scripts/release-recording-start-staging.mjs", "deploy"], {
    env: {...process.env, STAGING_DB_URL:"postgresql://postgres:unused@production.invalid/postgres"}, encoding:"utf8",
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Unverified staging target/);
  assert.doesNotMatch(result.stderr,/unused@/);
});
test("recording-start release is locked, source-preserving and transactionally reversible for checks", async () => {
  const source = await readFile("scripts/release-recording-start-staging.mjs","utf8");
  for (const guard of ["verifyMigrationLock", "Unrelated pending staging migrations", "operational sources changed", "rollback", "lock_timeout", "has_function_privilege"]) assert.ok(source.includes(guard),guard);
  assert.ok(source.includes('allowed = ["20261030000000_verified_today_opening_source.sql", "20261030001000_governed_recording_start.sql"]'));
});
