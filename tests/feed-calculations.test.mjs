import assert from "node:assert/strict";
import test from "node:test";

import { calculateFeedPerBirdDay, calculateGrowthFcr, calculateInventoryCover, calculateLayerFcr } from "../src/lib/feed-calculations.ts";

test("feed per bird/day uses summed opening bird-days", () => {
  assert.equal(calculateFeedPerBirdDay(321, 3000), 107);
  assert.equal(calculateFeedPerBirdDay(321, 0), null);
});

test("inventory cover uses only covered consumption days", () => {
  assert.equal(calculateInventoryCover(1400, 700, 7), 14);
  assert.equal(calculateInventoryCover(1400, 0, 7), null);
});

test("layer FCR uses feed divided by recorded egg mass", () => {
  assert.equal(calculateLayerFcr(1200, 600), 2);
  assert.equal(calculateLayerFcr(1200, 0), null);
});

test("growth FCR is unavailable without positive biomass gain", () => {
  assert.equal(calculateGrowthFcr(900, 600), 1.5);
  assert.equal(calculateGrowthFcr(900, 0), null);
});
