import assert from "node:assert/strict";
import test from "node:test";
import {executeReportGeneration, ReportBusyError} from "../src/lib/report-generation.ts";

function steps(overrides = {}) {
  const calls = [];
  return {calls, adapters: {
    claim: async () => ({status: "claimed", claim_token: "token"}),
    load: async () => {calls.push("load"); return {eggs: 10};},
    finish: async (token, data) => {assert.equal(token, "token"); assert.equal(data.eggs, 10); calls.push("finish"); return "run";},
    fail: async () => {calls.push("fail"); return {status: "failed"};},
    ...overrides,
  }};
}

test("completed retries do not reload evidence, save or append a failed run", async () => {
  const fixture = steps({claim: async () => ({status: "completed", run_id: "original"})});
  assert.equal(await executeReportGeneration(fixture.adapters), "original");
  assert.deepEqual(fixture.calls, []);
});
test("busy scheduled claims do no duplicate work", async () => {
  const fixture = steps({claim: async () => ({status: "busy"})});
  await assert.rejects(executeReportGeneration(fixture.adapters), ReportBusyError);
  assert.deepEqual(fixture.calls, []);
});
test("evidence is loaded only after a claim and finalized once", async () => {
  const fixture = steps();
  assert.equal(await executeReportGeneration(fixture.adapters), "run");
  assert.deepEqual(fixture.calls, ["load", "finish"]);
});
test("failed evidence or atomic finalization records failure without a second completion", async () => {
  for (const step of ["load", "finish"]) {
    const fixture = steps({[step]: async () => {throw new Error(`${step} failed`);}});
    await assert.rejects(executeReportGeneration(fixture.adapters), new RegExp(`${step} failed`));
    assert.equal(fixture.calls.filter(call => call === "fail").length, 1);
  }
});
test("a lost successful response returns its original completion instead of contradictory failure", async () => {
  const fixture = steps({finish: async () => {throw new Error("connection lost after commit");},
    fail: async () => ({status: "completed", run_id: "committed"})});
  assert.equal(await executeReportGeneration(fixture.adapters), "committed");
});
test("expired worker cannot report success when another claim superseded it", async () => {
  const fixture = steps({finish: async () => {throw new Error("claim expired");}, fail: async () => ({status: "superseded"})});
  await assert.rejects(executeReportGeneration(fixture.adapters), /claim expired/);
});
