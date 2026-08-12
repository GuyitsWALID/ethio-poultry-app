import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDailySeries,
  buildFlockAnalytics,
  mortalityCausePareto,
  previousPeriod,
  summarizePeriod,
} from "../src/lib/operational-analytics.ts";

function daily(overrides = {}) {
  return {
    id: "record-1",
    record_date: "2026-07-21",
    flock_id: "layer-a",
    opening_birds: 1000,
    closing_birds: 998,
    deaths: 2,
    deaths_cause: "Heat stress",
    total_eggs: 800,
    normal_eggs: 780,
    broken_eggs: 10,
    dirty_eggs: 10,
    feed_intake_grams: 110000,
    feed_type: "layer_feed",
    feed_leftover_grams: 1000,
    average_egg_weight_g: 60,
    water_consumed_liters: 220,
    updated_at: "2026-07-21T12:00:00Z",
    ...overrides,
  };
}

const layer = {
  id: "layer-a",
  code: "LAY-A",
  type: "layer",
  farmId: "farm-a",
  farmName: "North Farm",
  houseId: "house-a",
  houseName: "Layer 1",
  placementDate: "2026-01-01",
  ageAtPlacementDays: 0,
  currentBirds: 998,
  breedId: "breed-a",
};

test("period HDEP, feed, and mortality use the eligible recorded bird-days", () => {
  const result = summarizePeriod([
    daily(),
    daily({ id: "record-2", record_date: "2026-07-22", opening_birds: 998, closing_birds: 997, deaths: 1, total_eggs: 798, normal_eggs: 790, broken_eggs: 4, dirty_eggs: 4, feed_intake_grams: null }),
  ], new Set(["layer-a"]), 2);

  assert.equal(result.hdep, 79.98);
  assert.equal(result.feedPerBirdGrams, 110);
  assert.equal(result.mortalityPer1000BirdDays, 1.502);
  assert.equal(result.recordCoveragePct, 100);
});

test("missing metrics remain unavailable instead of becoming zero", () => {
  const result = summarizePeriod([
    daily({ total_eggs: null, normal_eggs: null, broken_eggs: null, dirty_eggs: null, deaths: null, feed_intake_grams: null, water_consumed_liters: null }),
  ], new Set(["layer-a"]), 1);

  assert.equal(result.hdep, null);
  assert.equal(result.deaths, null);
  assert.equal(result.feedPerBirdGrams, null);
  assert.equal(result.marketableRate, null);
});

test("previous period has equal length and excludes the selected period", () => {
  assert.deepEqual(previousPeriod("2026-07-01", "2026-07-30"), {
    previousFrom: "2026-06-01",
    previousTo: "2026-06-30",
    days: 30,
  });
});

test("daily series exposes an empty day as a gap", () => {
  const series = buildDailySeries([daily({ record_date: "2026-07-21" })], [layer], "2026-07-21", "2026-07-22");
  assert.equal(series[0].hdep, 80);
  assert.equal(series[1].hdep, null);
  assert.equal(series[1].feedPerBirdGrams, null);
  assert.equal(series[1].recordCoveragePct, 0);
});

test("flock analysis uses age target and prioritizes serious target gaps", () => {
  const result = buildFlockAnalytics({
    flock: layer,
    rows: [daily()],
    previousRows: [daily({ record_date: "2026-07-20", total_eggs: 850 })],
    weights: [],
    targets: [{ week_number: 28, target_hdep_pct: 90, target_mortality_pct: 1, target_feed_g: 110, target_weight_g: null }],
    dateFrom: "2026-07-21",
    dateTo: "2026-07-21",
    warningVariancePct: 5,
    criticalVariancePct: 10,
  });

  assert.equal(result.primaryLabel, "Period HDEP");
  assert.equal(result.target, 90);
  assert.equal(result.targetGap, -10);
  assert.equal(result.status, "critical");
});

test("mortality Pareto preserves deaths without a cause", () => {
  const result = mortalityCausePareto([
    daily({ deaths: 3, deaths_cause: "Heat stress" }),
    daily({ id: "record-2", deaths: 2, deaths_cause: null }),
  ]);
  assert.deepEqual(result.map((item) => [item.label, item.value, item.cumulativePct]), [
    ["Heat stress", 3, 60],
    ["Unspecified", 2, 100],
  ]);
});
