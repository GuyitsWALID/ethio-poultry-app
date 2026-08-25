import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260825000000_contextual_governance_authorizations.sql", import.meta.url), "utf8");
const workflow = await readFile(new URL("../src/lib/governance-workflow.ts", import.meta.url), "utf8");
const desk = await readFile(new URL("../src/components/governance-desk.tsx", import.meta.url), "utf8");
const banner = await readFile(new URL("../src/components/governance-authorization-banner.tsx", import.meta.url), "utf8");

test("requester identity and scope are immutable review evidence", () => {
  assert.match(migration, /requester_name_snapshot.*set not null/s);
  assert.match(migration, /requester_role_snapshot.*set not null/s);
  assert.match(workflow, /requester_scope_snapshot:requester\.scope/);
  assert.match(desk, /Proposed by/);
  assert.match(desk, /Assigned at submission/);
  assert.match(desk, /Latest revision/);
});

test("approval authorizes a seven-day one-time application instead of changing data", () => {
  const decision = migration.slice(migration.indexOf("create or replace function public.decide_governance_request"), migration.indexOf("create or replace function public.resubmit_governance_request"));
  assert.match(decision, /now\(\)\+interval '7 days'/);
  assert.doesNotMatch(decision, /update public\.(flocks|batches|daily_farm_records|health_events)/);
  assert.match(migration, /if v_row\.status<>'approved'/);
  assert.match(migration, /status='applied'/);
  assert.match(banner, /Apply approved correction/);
});

test("stale, expired, and reused authorizations cannot bypass protected records", () => {
  assert.match(migration, /status='conflict'.*source record changed after CEO approval/is);
  assert.match(migration, /approval_expires_at<=now\(\)/);
  assert.match(migration, /This authorization is no longer available/);
  assert.match(migration, /has_active_farm_access/);
  assert.match(migration, /has_active_warehouse_access/);
});

test("guided desk replaces raw identifiers and JSON editing with readable actions", () => {
  assert.doesNotMatch(desk, /Proposed values \(JSON\)/);
  assert.doesNotMatch(desk, /Farm ID \(when scoped\)/);
  assert.match(desk, /What will change/);
  assert.match(desk, /Revise and resubmit/);
  assert.match(desk, /Supporting files/);
  assert.match(desk, /Inspect affected record/);
});

test("governance history and private evidence are append-only", () => {
  assert.match(migration, /governance_request_activity_append_only/);
  assert.match(migration, /governance_request_evidence_append_only/);
  assert.match(migration, /governance-evidence','governance-evidence',false/);
  assert.match(migration, /revoke insert,update,delete on public\.governance_request_evidence/);
});
