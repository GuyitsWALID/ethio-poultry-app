import assert from "node:assert/strict";
import test from "node:test";
import {feedBatchChoices} from "../src/lib/feed-navigation.ts";

const historical = {id: "old", status: "closed"};
const current = {id: "new", status: "active"};
const query = value => new URLSearchParams(value);

test("normal feed landing still selects active batches only", () => {
  assert.deepEqual(feedBatchChoices([historical, current], "old", query("")), [current]);
  assert.deepEqual(feedBatchChoices([historical, current], "new", query("")), [current]);
});

test("exact history/configuration/correction links retain their historical batch", () => {
  for (const link of ["feed_target=template_management", "feed_target=feed_history", "feed_target=today_sessions", "view=advanced", "finding=check", "governance_request=approval", "record_id=record", "action_id=action"]) {
    assert.deepEqual(feedBatchChoices([historical, current], "old", query(link)), [historical, current], link);
    assert.deepEqual(feedBatchChoices([historical], "old", query(link)), [historical], link);
  }
});

test("URL targets never add batches absent from authorized scoped metadata", () => {
  assert.deepEqual(feedBatchChoices([current], "outside-scope", query("finding=check")), [current]);
  assert.deepEqual(feedBatchChoices([], "outside-scope", query("feed_target=template_management")), []);
  assert.deepEqual(feedBatchChoices([historical, current], "new", query("finding=check")), [current]);
});

test("unknown feed targets do not enable a historical context", () => {
  assert.deepEqual(feedBatchChoices([historical, current], "old", query("feed_target=unknown")), [current]);
});
