import assert from "node:assert/strict";
import test from "node:test";

import { authorizedFarmIds, buildFlockComparison, summarizeDaily } from "../src/lib/farm-manager-dashboard.ts";

const daily = (overrides = {}) => ({
  record_date: "2026-07-21", flock_id: "flock-1", opening_birds: 1000, closing_birds: 999,
  deaths: 1, total_eggs: 900, normal_eggs: 880, broken_eggs: 10, dirty_eggs: 10,
  feed_intake_grams: 110000, updated_at: "2026-07-21T12:00:00Z", ...overrides,
});

test("HDEP uses summed bird-days", () => {
  const result = summarizeDaily([
    daily({ record_date: "2026-07-19", opening_birds: 1000, total_eggs: 900 }),
    daily({ record_date: "2026-07-20", opening_birds: 800, total_eggs: 640 }),
  ]);
  assert.equal(result.hdep, 85.56);
});

test("today is excluded from the seven-day baseline", () => {
  const result = buildFlockComparison({
    flock: { id: "flock-1", code: "L-01", type: "layer", farmId: "farm-1", farmName: "Farm One", houseId: "house-1", houseName: "House One", placementDate: "2026-01-01", ageAtPlacementDays: 0, liveBirds: 999 },
    asOf: "2026-07-21",
    dailyRows: [daily(), daily({ record_date: "2026-07-20", total_eggs: 700, deaths: 0 })],
    targets: [{ week_number: 28, target_hdep_pct: 92, target_mortality_pct: 0.2, target_feed_g: 110, target_weight_g: 1800 }],
    weights: [], feedClosed: true, warningVariancePct: 5, criticalVariancePct: 10,
  });
  assert.equal(result.actual, 90);
  assert.equal(result.baseline, 70);
  assert.equal(result.trend, "up");
});

test("growing flocks use weight attainment and sample trend", () => {
  const result = buildFlockComparison({
    flock: { id: "flock-1", code: "B-01", type: "broiler", farmId: "farm-1", farmName: "Farm One", houseId: "house-1", houseName: "House One", placementDate: "2026-06-23", ageAtPlacementDays: 0, liveBirds: 1000 },
    asOf: "2026-07-21", dailyRows: [daily({ total_eggs: null, normal_eggs: null, broken_eggs: null, dirty_eggs: null })],
    targets: [{ week_number: 4, target_hdep_pct: null, target_mortality_pct: 0.2, target_feed_g: 100, target_weight_g: 1400 }],
    weights: [
      { record_date: "2026-07-21", average_weight_g: 1330, uniformity_pct: 86 },
      { record_date: "2026-07-14", average_weight_g: 1050, uniformity_pct: 82 },
    ], feedClosed: true, warningVariancePct: 5, criticalVariancePct: 10,
  });
  assert.equal(result.metricKind, "weight");
  assert.equal(result.targetAttainment, 95);
  assert.equal(result.weightChangePerDay, 40);
});

test("missing daily records remain unavailable and actionable", () => {
  const result = buildFlockComparison({
    flock: { id: "flock-1", code: "R-01", type: "rearing", farmId: "farm-1", farmName: "Farm One", houseId: "house-1", houseName: "House One", placementDate: "2026-07-01", ageAtPlacementDays: 0, liveBirds: 500 },
    asOf: "2026-07-21", dailyRows: [], targets: [], weights: [], feedClosed: false,
    warningVariancePct: 5, criticalVariancePct: 10,
  });
  assert.equal(result.feedPerBirdGrams, null);
  assert.equal(result.status, "pending");
  assert.equal(result.dataStatus, "missing");
});

test("farm access combines direct farm and branch assignments", () => {
  const ids = authorizedFarmIds(
    [{ id: "farm-a", branch_id: "branch-a" }, { id: "farm-b", branch_id: "branch-b" }, { id: "farm-c", branch_id: "branch-c" }],
    ["branch-a"], ["farm-b"]
  );
  assert.deepEqual([...ids].sort(), ["farm-a", "farm-b"]);
});

