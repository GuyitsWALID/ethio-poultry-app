import assert from "node:assert/strict";
import test from "node:test";

import {buildFinishReview, finishIssueFromResult} from "../src/lib/today-workspace/finish-review.ts";

const task = (code, state, contextLabel) => ({code, state, contextLabel, required: true, applicable: true});

test("Finish review separates every blocking state and preserves flock context", () => {
  const review = buildFinishReview([
    task("birds", "complete", "LAYER-A"),
    task("feeding", "not_started", "LAYER-A"),
    task("eggs_water", "draft_on_tablet", "LAYER-A"),
    task("health_deaths", "waiting_to_sync", "BROILER-B"),
    task("routine_supplies", "needs_attention", "BROILER-B"),
  ], [
    {commandId: "conflict", kind: "conflict", errorCode: "RESOURCE_CONFLICT"},
    {commandId: "rejected", kind: "rejected", errorCode: "INVALID_PAYLOAD"},
  ]);

  assert.equal(review.completed[0].contextLabel, "LAYER-A");
  assert.deepEqual(review.missing.map((item) => item.code), ["feeding"]);
  assert.deepEqual(review.queued.map((item) => item.code), ["eggs_water", "health_deaths"]);
  assert.deepEqual(review.attention.map((item) => item.code), ["routine_supplies"]);
  assert.equal(review.conflicts.length, 1);
  assert.equal(review.rejected.length, 1);
});

test("command results become distinct conflict and rejected review evidence", () => {
  assert.equal(finishIssueFromResult({command_id: "ok", status: "applied"}), null);
  assert.deepEqual(
    finishIssueFromResult({command_id: "stale", status: "conflict", error_code: "RESOURCE_CONFLICT"}),
    {commandId: "stale", kind: "conflict", errorCode: "RESOURCE_CONFLICT"},
  );
  assert.deepEqual(
    finishIssueFromResult({command_id: "bad", status: "rejected", error_code: "INVALID_PAYLOAD"}),
    {commandId: "bad", kind: "rejected", errorCode: "INVALID_PAYLOAD"},
  );
});
