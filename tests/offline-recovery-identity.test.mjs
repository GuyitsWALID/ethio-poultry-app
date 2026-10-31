import assert from "node:assert/strict";
import test from "node:test";
import {verifyRecoveryIdentity,offlineEditDecision} from "../src/lib/today-workspace/offline-policy.ts";

const identity={tenantId:"tenant",userId:"manager",authorizedWorkDate:"2026-10-31"};
test("network failure during cached reload is not evidence of sign-out",async()=>{
  assert.equal(await verifyRecoveryIdentity(identity,async()=>{throw new TypeError("Failed to fetch");}),"offline");
  // This result does not grant permission by itself or extend an expired grant.
  assert.equal(offlineEditDecision(undefined,identity,{farmId:"farm",workDate:"2026-10-31"}),"not_authorized");
});
test("successful recovery requires the same active manager and tenant",async()=>{
  const current={role:"farm_manager",userId:"manager",orgId:"tenant"};
  assert.equal(await verifyRecoveryIdentity(identity,async()=>Response.json(current)),"verified");
  for(const patch of [{role:"ceo"},{userId:"other"},{orgId:"other"}])await assert.rejects(verifyRecoveryIdentity(identity,async()=>Response.json({...current,...patch})),/AUTH_REQUIRED/);
  for(const status of [401,403,500])await assert.rejects(verifyRecoveryIdentity(identity,async()=>new Response(null,{status})),/AUTH_REQUIRED/);
});
