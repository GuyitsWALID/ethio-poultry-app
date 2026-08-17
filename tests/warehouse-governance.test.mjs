import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260814000000_governed_warehouse_setup.sql", import.meta.url), "utf8");
const management = await readFile(new URL("../src/lib/warehouse-management.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/app/inventory/page.tsx", import.meta.url), "utf8");
const assignmentsRoute = await readFile(new URL("../src/app/api/governance/assignments/route.ts", import.meta.url), "utf8");
const usersPage = await readFile(new URL("../src/app/app/users/page.tsx", import.meta.url), "utf8");
const sidebar = await readFile(new URL("../src/components/app-sidebar.tsx", import.meta.url), "utf8");

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
  assert.doesNotMatch(management, /select\("id,full_name,email"\)/);
});

test("inventory presents warehouse-specific balances and setup", () => {
  assert.match(page, /All assigned warehouses/);
  assert.match(page, /Where inventory physically belongs/);
  assert.match(page, /create or assign the appropriate farm or central store/i);
});

test("CEO can discover the access page and load assignable farm managers through the governed API", () => {
  assert.match(sidebar, /Access & Users/);
  assert.match(sidebar, /\/app\/users/);
  assert.match(assignmentsRoute, /from\("profiles"\)/);
  assert.match(assignmentsRoute, /from\("warehouses"\)/);
  assert.match(usersPage, /fetch\("\/api\/governance\/assignments"/);
  assert.match(usersPage, /profile\.role==="farm_manager"&&profile\.is_active/);
  assert.match(usersPage, /now has active access to/);
  assert.match(usersPage, /if \(!response\.ok\)[\s\S]*setError[\s\S]*return/);
  assert.match(assignmentsRoute, /assignment_status:"Active"/);
  assert.match(assignmentsRoute, /Access can only be granted to an active warehouse/);
  assert.doesNotMatch(usersPage, /\.from\("profiles"\)/);
});
