import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {canSubmitTodayRollout, validTodayRolloutReason} from "../src/lib/today-rollout.ts";

test("rollout needs a loaded state, valid reason, and no pending request", () => {
  for (const reason of ["", "   ", "abc", " abc ", "x".repeat(2001)]) {
    assert.equal(canSubmitTodayRollout(false, false, reason), false);
  }
  assert.equal(validTodayRolloutReason(null), false);
  assert.equal(validTodayRolloutReason(1234), false);
  assert.equal(canSubmitTodayRollout(null, false, "Pilot ready"), false);
  assert.equal(canSubmitTodayRollout(true, true, "Pilot ready"), false);
  assert.equal(canSubmitTodayRollout(false, false, " ready "), true);
  assert.equal(canSubmitTodayRollout(true, false, "Rollback to legacy"), true);
});

test("rollout uses authenticated database identity and one validated UI action", async () => {
  const route = await readFile(new URL("../src/app/api/ceo/feature-flags/today-workspace/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../src/app/app/ceo/setup/page.tsx", import.meta.url), "utf8");
  const sql = await readFile(new URL("../supabase/migrations/20260930000000_ceo_today_workspace_toggle.sql", import.meta.url), "utf8");
  assert.match(route, /@\/utils\/supabase\/server/);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY|supabaseAdmin/);
  assert.match(route, /validTodayRolloutReason\(reason\)/);
  assert.match(route, /req\.json\(\)\.catch/);
  assert.match(route, /private, no-store/);
  assert.match(sql, /auth\.uid\(\) is distinct from p_actor_id/);
  assert.match(page, /disabled=\{!canSubmitTodayRollout\(/);
  assert.equal((page.match(/onClick=\{\(\)=>void toggleTodayWorkspace/g) ?? []).length, 1);
  assert.doesNotMatch(page, /Save with reason/);
});
