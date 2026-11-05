import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {assessBirdCheck} from "../src/lib/today-workspace/bird-check.ts";

const handoff = await readFile(new URL("../supabase/migrations/20260928000000_today_bird_loss_handoff.sql", import.meta.url), "utf8");

const balanced = {
  openingBirds: 1000,
  transfersIn: 5,
  deaths: 2,
  culls: 1,
  transfersOut: 3,
  otherRemovals: 4,
  closingBirds: 995,
};

test("bird movement calculates the authoritative expected closing count", () => {
  const result = assessBirdCheck(balanced);
  assert.equal(result.expectedClosingBirds, 995);
  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});

test("zero movement is valid and keeps opening equal to closing", () => {
  const result = assessBirdCheck({...balanced, transfersIn: 0, deaths: 0, culls: 0, transfersOut: 0, otherRemovals: 0, closingBirds: 1000});
  assert.equal(result.expectedClosingBirds, 1000);
  assert.equal(result.valid, true);
});

test("an incorrect physical close is identified before saving", () => {
  const result = assessBirdCheck({...balanced, closingBirds: 994});
  assert.equal(result.valid, false);
  assert(result.issues.includes("CLOSING_MISMATCH"));
});

test("missing opening evidence and closing count are explicit", () => {
  const result = assessBirdCheck({...balanced, openingBirds: null, closingBirds: null});
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues, ["OPENING_SOURCE_MISSING", "CLOSING_REQUIRED"]);
});

test("movement values reject negative and fractional bird counts", () => {
  const result = assessBirdCheck({...balanced, deaths: -1, transfersIn: 1.5});
  assert.equal(result.valid, false);
  assert(result.issues.includes("MOVEMENT_INVALID"));
});

test("Today saves deaths, culls, and live count in one database transaction", () => {
  assert.match(handoff, /for update/);
  assert.match(handoff, /expected_revision.*today_resource_revision/s);
  assert.match(handoff, /save_daily_record_with_usage_partial_v1\(/);
  assert.match(handoff, /insert into public\.mortality_events/);
  assert.match(handoff, /insert into public\.flock_cull_events/);
  assert.match(handoff, /today_cull_baseline integer not null default -1/);
  assert.match(handoff, /greatest\(coalesce\(new\.culls, 0\) - new\.today_cull_baseline, 0\)/);
  assert.match(handoff, /pg_trigger_depth\(\) > 1/);
  assert.match(handoff, /coalesce\(d\.deaths, 0\) \+ coalesce\(d\.culls, 0\)/);
  assert.match(handoff, /create trigger reject_false_health_attestation/);
});
