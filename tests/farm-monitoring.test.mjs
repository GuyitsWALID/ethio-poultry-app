import test from "node:test";
import assert from "node:assert/strict";
import { capacityUtilization, monitoringAggregate, monitoringStatus } from "../src/lib/farm-monitoring.ts";

test("capacity utilization stays unavailable without configured capacity", () => {
  assert.equal(capacityUtilization(500, null), null);
  assert.equal(capacityUtilization(500, 0), null);
  assert.equal(capacityUtilization(500, 1000), 50);
});

test("farm monitoring HDEP uses recorded bird-days", () => {
  const result = monitoringAggregate([
    { flock_id: "a", record_date: "2026-07-22", opening_birds: 1000, closing_birds: 998, deaths: 2, total_eggs: 800, normal_eggs: 780, broken_eggs: 10, dirty_eggs: 10, feed_intake_grams: 110000, updated_at: "2026-07-22T08:00:00Z" },
    { flock_id: "b", record_date: "2026-07-22", opening_birds: 500, closing_birds: 500, deaths: 0, total_eggs: 400, normal_eggs: 390, broken_eggs: 5, dirty_eggs: 5, feed_intake_grams: 55000, updated_at: "2026-07-22T08:00:00Z" },
  ]);
  assert.equal(result.hdep, 80);
  assert.equal(result.mortalityPct, 0.13);
  assert.equal(result.feedPerBirdGrams, 110);
});

test("monitoring status prioritizes operational risk over data gaps", () => {
  assert.equal(monitoringStatus({ critical: 1, watch: 2, pending: 3 }), "critical");
  assert.equal(monitoringStatus({ critical: 0, watch: 1, pending: 3 }), "watch");
  assert.equal(monitoringStatus({ critical: 0, watch: 0, pending: 1 }), "data_gap");
  assert.equal(monitoringStatus({ empty: true, critical: 0, watch: 0, pending: 0 }), "empty");
});
