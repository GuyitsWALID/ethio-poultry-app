import assert from "node:assert/strict";
import test from "node:test";

import { capabilitiesFor, hasCapability, parseActiveRole } from "../src/lib/permissions.ts";

test("unknown and retired tenant roles deny access", () => {
  assert.equal(parseActiveRole(undefined), null);
  assert.equal(parseActiveRole("unknown"), null);
  assert.equal(parseActiveRole("veterinarian"), null);
  assert.equal(parseActiveRole("store_keeper"), null);
  assert.deepEqual(capabilitiesFor(null), []);
});

test("legacy super administrator maps to the single platform role", () => {
  assert.equal(parseActiveRole("super_admin"), "system_admin");
  assert.equal(parseActiveRole("manager"), "ceo");
});

test("CEO governs but cannot perform routine farm operations", () => {
  assert.equal(hasCapability("ceo", "tenant:view"), true);
  assert.equal(hasCapability("ceo", "governance:approve"), true);
  assert.equal(hasCapability("ceo", "farm:operate"), false);
  assert.equal(hasCapability("ceo", "warehouse:operate"), false);
});

test("farm manager operates assigned resources but cannot approve", () => {
  assert.equal(hasCapability("farm_manager", "farm:operate"), true);
  assert.equal(hasCapability("farm_manager", "warehouse:operate"), true);
  assert.equal(hasCapability("farm_manager", "governance:request"), true);
  assert.equal(hasCapability("farm_manager", "governance:approve"), false);
});

test("system administrator is platform-only outside break glass", () => {
  assert.deepEqual(capabilitiesFor("system_admin"), ["platform:admin"]);
  assert.equal(hasCapability("system_admin", "tenant:view"), false);
});
