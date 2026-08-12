import assert from "node:assert/strict";
import test from "node:test";

import { hasManualFeedInput } from "../src/lib/daily-record-input.ts";

test("daily records allow non-feed observations", () => {
  assert.equal(hasManualFeedInput({ total_eggs: 120, feed_leftover_grams: 250 }), false);
});

test("daily records reject manually entered feed quantities", () => {
  assert.equal(hasManualFeedInput({ feed_intake_grams: 0 }), true);
  assert.equal(hasManualFeedInput({ feed_intake_quantity: 12.5 }), true);
});

test("daily records reject manually selected feed types", () => {
  assert.equal(hasManualFeedInput({ feed_type: "layer_feed" }), true);
});

test("empty feed-controlled fields remain compatible with older clients", () => {
  assert.equal(
    hasManualFeedInput({ feed_intake_grams: null, feed_intake_quantity: "", feed_type: undefined }),
    false
  );
});

