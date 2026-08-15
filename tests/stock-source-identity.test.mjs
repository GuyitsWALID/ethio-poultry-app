import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260815003000_stock_source_identity.sql", import.meta.url),
  "utf8",
);

test("manual stock movements receive a complete source identity", () => {
  assert.match(migration, /new\.source_kind := 'manual_inventory_movement'/);
  assert.match(migration, /new\.source_key := new\.id::text/);
  assert.match(migration, /before insert on public\.stock_ledger/);
});

test("existing stock movements are repaired before the identity constraint is validated", () => {
  assert.match(migration, /update public\.stock_ledger[\s\S]*source_key = id::text/);
  assert.match(migration, /stock_ledger_source_identity_complete/);
  assert.match(migration, /validate constraint stock_ledger_source_identity_complete/);
});
