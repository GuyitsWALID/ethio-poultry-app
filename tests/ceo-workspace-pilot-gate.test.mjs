import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const sidebar = await read("src/components/app-sidebar.tsx");
const migration = await read("supabase/migrations/20261005001000_ceo_workspace_pilot_gate.sql");
const followUp = await read("docs/deployment/ceo-simplification-gate.md");

test("CEO destinations stay unchanged and independent of manager rollout", () => {
  const sections = sidebar.split("const ceoNavSections: NavSection[] = [")[1].split("const farmManagerNavSections")[0];
  assert.deepEqual([...sections.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]), [
    "/app/ceo", "/app/ceo/setup", "/app/analytics", "/app/reports", "/app/governance",
    "/app/users", "/app/operating-days", "/app/reconciliation", "/app/farms", "/app/flocks",
    "/app/governance", "/app/daily-records", "/app/feeding-log", "/app/mortality",
    "/app/health", "/app/inventory", "/app/sales",
  ]);
  assert.match(sidebar, /if \(viewerRole === "ceo" \|\| viewerRole === "system_admin"\) return ceoNavSections/);
  assert.doesNotMatch(sidebar, /simplified_ceo_workspace_enabled|today_pilot_accepted_at/);
});

test("CEO gate rejects inserts and updates even with a fabricated acceptance timestamp", () => {
  assert.match(migration, /before insert or update of simplified_ceo_workspace_enabled, today_pilot_accepted_at/i);
  assert.match(migration, /if new\.simplified_ceo_workspace_enabled or new\.today_pilot_accepted_at is not null/i);
  assert.match(migration, /errcode = '42501'/);
  assert.doesNotMatch(migration, /current_user|security definer|set_config/);
  assert.match(migration, /review evidence before migration/);
});

test("CEO follow-up requires real pilot evidence and a separately reviewed release", () => {
  for (const requirement of ["seven consecutive", "silent usability", "8.7", "Today’s status", "Needs attention", "Performance", "Approvals", "timestamp alone"]) {
    assert.ok(followUp.includes(requirement), requirement);
  }
});
