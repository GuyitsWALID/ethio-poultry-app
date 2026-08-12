import assert from "node:assert/strict";
import test from "node:test";

import { calculateProduction, previousPeriod, summarizeSales } from "../src/lib/executive-dashboard.ts";

const daily = (overrides = {}) => ({
  record_date: "2026-08-03",
  flock_id: "flock-a",
  opening_birds: 1000,
  closing_birds: 998,
  deaths: 2,
  total_eggs: 900,
  normal_eggs: 875,
  broken_eggs: 15,
  dirty_eggs: 10,
  feed_intake_grams: 110000,
  feed_leftover_grams: 2000,
  average_egg_weight_g: 60,
  water_consumed_liters: 220,
  updated_at: "2026-08-03T15:00:00Z",
  ...overrides,
});

test("executive production uses summed eligible bird-days for HDEP and feed", () => {
  const result = calculateProduction([
    daily(),
    daily({ record_date: "2026-08-04", opening_birds: 800, closing_birds: 799, deaths: 1, total_eggs: 640, feed_intake_grams: 80000 }),
  ]);

  assert.equal(result.hdep, 85.56);
  assert.equal(result.feedPerBirdGrams, 105.56);
  assert.equal(result.trends.length, 2);
});

test("executive metrics preserve unavailable values when denominators are missing", () => {
  const result = calculateProduction([
    daily({ opening_birds: null, closing_birds: null, total_eggs: null, deaths: null, feed_intake_grams: null, average_egg_weight_g: null }),
  ]);

  assert.equal(result.hdep, null);
  assert.equal(result.mortality, null);
  assert.equal(result.feedPerBirdGrams, null);
  assert.equal(result.layerFcr, null);
  assert.equal(result.completeness, 0);
});

test("executive previous period is equal length and non-overlapping", () => {
  assert.deepEqual(previousPeriod("2026-07-01", "2026-07-31"), { dateFrom: "2026-05-31", dateTo: "2026-06-30" });
});

test("sales summary reconciles revenue, cash, receivables, and product mix", () => {
  const result = summarizeSales([
    { gross_amount: 1000, paid_amount: 700, balance_due: 300, product_category: "eggs", farm_id: "farm-a" },
    { gross_amount: 500, paid_amount: 500, balance_due: 0, product_category: "birds", farm_id: "farm-b" },
    { gross_amount: 250, paid_amount: 0, balance_due: 250, product_category: "eggs", farm_id: "farm-a" },
  ]);

  assert.equal(result.revenue, 1750);
  assert.equal(result.paid, 1200);
  assert.equal(result.receivables, 550);
  assert.equal(result.collectionRate, 68.57);
  assert.deepEqual(result.mix, [{ label: "eggs", value: 1250 }, { label: "birds", value: 500 }]);
});
