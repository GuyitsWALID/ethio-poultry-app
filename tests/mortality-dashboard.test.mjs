import test from "node:test";
import assert from "node:assert/strict";
import { birdDays, dateRange, mortalityPerThousand, periodDirection, reconcileCauses, timeBand } from "../src/lib/mortality-dashboard.ts";

test("mortality rate uses recorded bird-days", () => {
  const rows = [
    { flockId: "a", recordDate: "2026-07-01", deaths: 2, openingBirds: 1000, closingBirds: 998, cause: null },
    { flockId: "a", recordDate: "2026-07-02", deaths: 1, openingBirds: 998, closingBirds: 997, cause: null },
  ];
  assert.equal(birdDays(rows[0]), 999);
  assert.equal(mortalityPerThousand(rows), 1.503);
});

test("missing bird counts stay unavailable", () => {
  assert.equal(mortalityPerThousand([{ flockId: "a", recordDate: "2026-07-01", deaths: 4, openingBirds: null, closingBirds: null, cause: null }]), null);
});

test("cause events never exceed the official daily death count", () => {
  const row = { flockId: "a", recordDate: "2026-07-01", deaths: 3, openingBirds: 100, closingBirds: 97, cause: "Other" };
  const events = [
    { id: "1", flockId: "a", recordDate: "2026-07-01", count: 4, cause: "Heat stress", diagnosis: null, recordedTime: "14:00", notes: null },
    { id: "2", flockId: "a", recordDate: "2026-07-01", count: 2, cause: "Injury", diagnosis: null, recordedTime: "16:00", notes: null },
  ];
  const result = reconcileCauses(row, events);
  assert.equal(result.reduce((sum, item) => sum + item.deaths, 0), 3);
  assert.deepEqual(result.map((item) => item.deaths), [2, 1]);
});

test("unexplained remainder is preserved", () => {
  const row = { flockId: "a", recordDate: "2026-07-01", deaths: 5, openingBirds: 100, closingBirds: 95, cause: null };
  const result = reconcileCauses(row, [{ id: "1", flockId: "a", recordDate: "2026-07-01", count: 2, cause: "Injury", diagnosis: null, recordedTime: null, notes: null }]);
  assert.equal(result.find((item) => item.cause === "Unexplained")?.deaths, 3);
});

test("period comparison and time bands are decision safe", () => {
  assert.deepEqual(periodDirection(12, 8), { direction: "up", changePct: 50 });
  assert.deepEqual(periodDirection(4, 0), { direction: "up", changePct: null });
  assert.equal(timeBand("05:30"), "Overnight");
  assert.equal(timeBand("13:15"), "Afternoon");
  assert.deepEqual(dateRange("2026-07-01", "2026-07-03"), ["2026-07-01", "2026-07-02", "2026-07-03"]);
});
