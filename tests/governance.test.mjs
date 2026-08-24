import assert from "node:assert/strict";
import test from "node:test";
import {assignmentIsActive,operatingDayLockBoundary,sourceVersionMatches} from "../src/lib/governance.ts";

test("assignments require an effective, unexpired, unrevoked window",()=>{const at=new Date("2026-08-04T09:00:00Z");assert.equal(assignmentIsActive({starts_at:"2026-08-01T00:00:00Z",expires_at:null,revoked_at:null},at),true);assert.equal(assignmentIsActive({starts_at:"2026-08-05T00:00:00Z",expires_at:null,revoked_at:null},at),false);assert.equal(assignmentIsActive({starts_at:"2026-08-01T00:00:00Z",expires_at:"2026-08-04T09:00:00Z",revoked_at:null},at),false);assert.equal(assignmentIsActive({starts_at:"2026-08-01T00:00:00Z",expires_at:null,revoked_at:"2026-08-03T00:00:00Z"},at),false)});
test("Addis cutoff preserves a seven-day entry window",()=>{assert.equal(operatingDayLockBoundary(new Date("2026-08-10T06:59:00Z"),"10:00:00",7),"2026-08-02");assert.equal(operatingDayLockBoundary(new Date("2026-08-10T07:00:00Z"),"10:00:00",7),"2026-08-03")});
test("stale source versions are rejected",()=>{assert.equal(sourceVersionMatches("2026-08-04T07:00:00Z","2026-08-04T07:00:00.000Z"),true);assert.equal(sourceVersionMatches("2026-08-04T07:00:00Z","2026-08-04T07:01:00Z"),false);assert.equal(sourceVersionMatches(null,"2026-08-04T07:01:00Z"),true)});
