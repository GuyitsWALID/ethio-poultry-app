import assert from "node:assert/strict";
import test from "node:test";
import {resolveBirdOpening} from "../src/lib/today-workspace/opening-source.ts";

const input = {workDate: "2026-10-30", placementDate: "2026-10-30", initialCount: 1500, dailyRecord: null, previousClosingBirds: null, previousRecordDate: null};
test("actual placement supplies initial birds without using current population", () => {
  assert.deepEqual(resolveBirdOpening({...input, currentCount: 1490}), {openingBirds: 1500, source: "placement"});
  assert.equal(resolveBirdOpening({...input, workDate: "2026-10-31"}).source, "missing");
  assert.equal(resolveBirdOpening({...input, initialCount: undefined}).source, "missing");
});
test("a dated preceding close wins; gaps and undated cached counts do not", () => {
  const prior = {...input, previousClosingBirds: 1400, previousRecordDate: "2026-10-29"};
  assert.deepEqual(resolveBirdOpening(prior), {openingBirds: 1400, source: "previous_close"});
  assert.equal(resolveBirdOpening({...prior, previousRecordDate: "2026-10-28"}).source, "missing");
  assert.equal(resolveBirdOpening({...prior, placementDate: "2026-10-01", previousRecordDate: undefined}).source, "missing");
});
test("saved evidence wins, including an explicit zero; incomplete saved evidence needs correction", () => {
  assert.deepEqual(resolveBirdOpening({...input, dailyRecord: {openingBirds: 0}}), {openingBirds: 0, source: "daily_record"});
  assert.deepEqual(resolveBirdOpening({...input, dailyRecord: {openingBirds: null}}), {openingBirds: null, source: "missing"});
  for (const invalid of [-1, 1.2, NaN]) assert.equal(resolveBirdOpening({...input, initialCount: invalid}).source, "missing");
});
test("approved start applies only on its exact day, not as a floating population fallback", () => {
  const legacy = {...input, placementDate: "2026-09-01", recordingStart: {effectiveDate: "2026-10-30", liveBirds: 980}};
  assert.deepEqual(resolveBirdOpening(legacy), {openingBirds: 980, source: "baseline"});
  assert.equal(resolveBirdOpening({...legacy, workDate: "2026-10-31"}).source, "missing");
  assert.equal(resolveBirdOpening({...legacy, dailyRecord: {openingBirds: null}}).source, "missing");
});
