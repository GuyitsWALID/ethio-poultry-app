import assert from "node:assert/strict";
import test from "node:test";

import {assessBirdCheck} from "../src/lib/today-workspace/bird-check.ts";

const balanced = {
  openingBirds: 1000,
  transfersIn: 5,
  deaths: 2,
  culls: 1,
  transfersOut: 3,
  otherRemovals: 4,
  closingBirds: 995,
};

test("bird movement calculates the authoritative expected closing count", () => {
  const result = assessBirdCheck(balanced);
  assert.equal(result.expectedClosingBirds, 995);
  assert.equal(result.valid, true);
  assert.deepEqual(result.issues, []);
});

test("zero movement is valid and keeps opening equal to closing", () => {
  const result = assessBirdCheck({...balanced, transfersIn: 0, deaths: 0, culls: 0, transfersOut: 0, otherRemovals: 0, closingBirds: 1000});
  assert.equal(result.expectedClosingBirds, 1000);
  assert.equal(result.valid, true);
});

test("an incorrect physical close is identified before saving", () => {
  const result = assessBirdCheck({...balanced, closingBirds: 994});
  assert.equal(result.valid, false);
  assert(result.issues.includes("CLOSING_MISMATCH"));
});

test("missing opening evidence and closing count are explicit", () => {
  const result = assessBirdCheck({...balanced, openingBirds: null, closingBirds: null});
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues, ["OPENING_SOURCE_MISSING", "CLOSING_REQUIRED"]);
});

test("movement values reject negative and fractional bird counts", () => {
  const result = assessBirdCheck({...balanced, deaths: -1, transfersIn: 1.5});
  assert.equal(result.valid, false);
  assert(result.issues.includes("MOVEMENT_INVALID"));
});
