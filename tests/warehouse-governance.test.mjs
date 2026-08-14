import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260814000000_governed_warehouse_setup.sql", import.meta.url), "utf8");
const management = await readFile(new URL("../src/lib/warehouse-management.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/app/inventory/page.tsx", import.meta.url), "utf8");

test("warehouse scope is tied to a valid organization, branch, and optional farm", () => {
  assert.match(migration, /warehouse farm must belong to the selected organization and branch/i);
  assert.match(migration, /farm_id uuid references public\.farms\(id\) on delete restrict/i);
  assert.match(migration, /warehouses_status_valid/);
});

test("warehouse and ledger reads follow assignments while direct mutations are revoked", () => {
  assert.match(migration, /has_active_warehouse_access\(id\)/);
  assert.match(migration, /has_active_warehouse_access\(warehouse_id\)/);
  assert.match(migration, /revoke insert, update, delete[\s\S]*public\.warehouses from authenticated/i);
  assert.match(migration, /Inventory movements require an active warehouse/i);
});

test("CEO setup can assign an active farm manager and emits an audit event", () => {
  assert.match(management, /ctx\.role !== "ceo"/);
  assert.match(management, /user_warehouse_access/);
  assert.match(management, /warehouse\.created/);
  assert.match(management, /role", "farm_manager"/);
});

test("inventory presents warehouse-specific balances and setup", () => {
  assert.match(page, /All assigned warehouses/);
  assert.match(page, /Where inventory physically belongs/);
  assert.match(page, /create or assign the appropriate farm or central store/i);
});
