import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260814001000_simple_inventory_workflows.sql", import.meta.url), "utf8");
const costRoute = await readFile(new URL("../src/app/api/profit/cost-entries/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/app/inventory/page.tsx", import.meta.url), "utf8");

test("inventory begins with four plain operational jobs", () => {
  assert.match(page, /What do you need to record\?/);
  assert.match(page, /Stock arrived/);
  assert.match(page, /Stock left or moved/);
  assert.match(page, /I counted the shelf/);
  assert.match(page, /We paid an expense/);
});

test("receiving and issuing use plain language while optional evidence stays secondary", () => {
  assert.match(page, /Used or consumed/);
  assert.match(page, /Returned to store/);
  assert.match(page, /Moved to another store/);
  assert.match(page, /Correct a known balance/);
  assert.match(page, /Optional allocation and supporting details/);
  assert.match(page, /Save stock received/);
});

test("physical counts compare the shelf with the ledger without silent adjustment", () => {
  assert.match(page, /\/api\/reconciliation\/physical-counts/);
  assert.match(page, /Monthly count/);
  assert.match(page, /Spot count/);
  assert.match(page, /it never adjusts stock automatically/i);
});

test("monthly and one-off expenses are validated and persisted distinctly", () => {
  assert.match(migration, /entry_kind text not null default 'one_off'/);
  assert.match(migration, /check \(entry_kind in \('monthly', 'one_off'\)\)/);
  assert.match(costRoute, /VALID_ENTRY_KINDS/);
  assert.match(costRoute, /entry_kind: entryKind/);
  assert.match(page, /Monthly cost/);
  assert.match(page, /One-off cost/);
});
