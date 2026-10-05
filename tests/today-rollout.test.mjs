import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {canSubmitTodayRollout, describeTodayRolloutEvent, validTodayRolloutReason} from "../src/lib/today-rollout.ts";

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
  const control = await readFile(new URL("../src/components/ceo/today-rollout-control.tsx", import.meta.url), "utf8");
  assert.match(page, /<TodayRolloutControl/);
  assert.match(control, /canSubmitTodayRollout\(enabled, saving, reason\)/);
  assert.equal((control.match(/onClick=\{\(\) => void save\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(page, /Save with reason/);
});

test("rollout history exposes readable evidence, not tenant or actor IDs", () => {
  const row = {sequence_number: 12, actor_id: "private-actor-id", reason: "Pilot ready", occurred_at: "2026-10-05T09:00:00Z", after_values: {today_workspace_enabled: true}, metadata: {rollout_source: "ceo"}};
  const event = describeTodayRolloutEvent(row, " Partner CEO ");
  assert.equal(event.actorName, "Partner CEO");
  assert.equal(event.enabled, true);
  assert.equal(event.source, "ceo");
  assert.doesNotMatch(JSON.stringify(event), /private-actor-id/);
  assert.equal(describeTodayRolloutEvent(row, null).actorName, "CEO");
  const release = describeTodayRolloutEvent({...row, actor_id: null, after_values: {today_workspace_enabled: false}, metadata: {release_reference: "cb948a6"}}, null);
  assert.equal(release.source, "system_release");
  assert.equal(release.releaseReference, "cb948a6");
  assert.equal(release.enabled, false);
});

test("rollout history is CEO-only, tenant-scoped and bounded; UI refreshes evidence after save", async () => {
  const route = await readFile(new URL("../src/app/api/ceo/feature-flags/today-workspace/route.ts", import.meta.url), "utf8");
  const control = await readFile(new URL("../src/components/ceo/today-rollout-control.tsx", import.meta.url), "utf8");
  assert.match(route, /export async function GET\(/);
  assert.match(route, /ctx.role !== "ceo"/);
  assert.match(route, /\.eq\("org_id", ctx.orgId\)/);
  assert.match(route, /\.limit\(20\)/);
  assert.match(control, /router.refresh\(\)/);
  assert.match(control, /await load\(\)/);
  assert.match(control, /submitting.current/);
  assert.match(control, /formatOperationDateTime/);
});
