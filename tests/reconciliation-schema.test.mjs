import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(new URL("../supabase/migrations/20260809_item3_operational_reconciliation.sql", import.meta.url), "utf8");

test("Item 3 migration creates durable findings, runs, responses, and physical counts", () => {
  for (const table of ["reconciliation_runs","reconciliation_findings","reconciliation_finding_responses","inventory_physical_counts","sales_unit_conversions"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
});

test("direct tenant writes are revoked and common egg units are seeded", () => {
  assert.match(sql, /revoke insert,update,delete on public\.reconciliation_findings from anon,authenticated/i);
  assert.match(sql, /\('tray',30\)/i);
  assert.match(sql, /\('dozen',12\)/i);
});
