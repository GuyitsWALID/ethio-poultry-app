import assert from "node:assert/strict";
import test from "node:test";
import {validateRecordingStart} from "../src/lib/recording-start-contract.ts";

const ctx = {placement_date: "2026-09-01", flock_type: "layer", last_record_date: null, existing_start: false, existing_egg_balance: false};
const input = {flock_id: "18000000-0000-4000-8000-000000000007", effective_date: "2026-10-30", live_birds: 980, opening_eggs: 0, supporting_reference: "Physical count sheet"};
test("legacy physical start keeps an explicit zero egg balance and original placement date", () => {
  assert.deepEqual(validateRecordingStart(input, ctx, "2026-10-30"), input);
  assert.equal(ctx.placement_date, "2026-09-01");
});
test("invalid or future dates, existing evidence and missing egg counts fail", () => {
  for (const patch of [{effective_date: "2026-02-30"}, {effective_date: "2026-10-31"}, {effective_date: "2026-08-31"}, {live_birds: -1}, {live_birds: 1.5}, {live_birds: null}, {live_birds: ""}, {opening_eggs: ""}, {opening_eggs: null}]) {
    assert.throws(() => validateRecordingStart({...input, ...patch}, ctx, "2026-10-30"));
  }
  for (const patch of [{existing_start: true}, {existing_egg_balance: true}, {last_record_date: "2026-10-30"}, {last_record_date: "2026-10-29", last_record_closing_birds: 987}]) {
    assert.throws(() => validateRecordingStart(input, {...ctx, ...patch}, "2026-10-30"));
  }
  assert.equal(validateRecordingStart({...input, opening_eggs: null}, {...ctx, flock_type: "broiler"}, "2026-10-30").opening_eggs, null);
});
