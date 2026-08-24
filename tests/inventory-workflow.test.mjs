import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260814001000_simple_inventory_workflows.sql", import.meta.url), "utf8");
const costRoute = await readFile(new URL("../src/app/api/profit/cost-entries/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/app/inventory/page.tsx", import.meta.url), "utf8");
const catalog = await readFile(new URL("../src/lib/inventory-catalog.ts", import.meta.url), "utf8");
const catalogRoute = await readFile(new URL("../src/app/api/inventory/catalog/route.ts", import.meta.url), "utf8");
const dailyRecords = await readFile(new URL("../src/app/app/daily-records/page.tsx", import.meta.url), "utf8");
const healthEventsRoute = await readFile(new URL("../src/app/api/health/events/route.ts", import.meta.url), "utf8");
const warehouseFirstMigration = await readFile(new URL("../supabase/migrations/20260824000000_warehouse_first_inventory.sql", import.meta.url), "utf8");
const operations = await readFile(new URL("../src/lib/inventory-operations.ts", import.meta.url), "utf8");

test("inventory begins with four plain operational jobs", () => {
  assert.match(page, /Current stock/);
  assert.match(page, /Start-of-month count/);
  assert.match(page, /Receive stock/);
  assert.match(page, /Record expense/);
  assert.match(page, /More stock actions/);
});

test("receiving and issuing use plain language while optional evidence stays secondary", () => {
  assert.match(page, /Controlled manual use/);
  assert.match(page, /Return to stock/);
  assert.match(page, /Transfer to another warehouse/);
  assert.match(page, /Approved correction/);
  assert.match(page, /Supplier/);
  assert.match(page, /Save stock received/);
});

test("physical counts compare the shelf with the ledger without silent adjustment", () => {
  assert.match(page, /\/api\/inventory\/count-sessions/);
  assert.match(page, /Count every stocked item together/);
  assert.match(page, /never silently changes stock/i);
  assert.match(warehouseFirstMigration,/inventory_count_sessions/);
});

test("monthly and one-off expenses are validated and persisted distinctly", () => {
  assert.match(migration, /entry_kind text not null default 'one_off'/);
  assert.match(migration, /check \(entry_kind in \('monthly', 'one_off'\)\)/);
  assert.match(costRoute, /VALID_ENTRY_KINDS/);
  assert.match(costRoute, /entry_kind: entryKind/);
  assert.match(page, /Confirmed monthly expense/);
  assert.match(page, /One-off miscellaneous expense/);
  assert.match(page, /does not change warehouse stock/i);
});

test("inventory catalogue and ledger loading use the governed server boundary", () => {
  assert.match(page, /\/api\/inventory\/workspace/);
  assert.doesNotMatch(page, /\.from\("inventory_items"\)/);
  assert.doesNotMatch(page, /\.from\("stock_ledger"\)/);
  assert.match(catalogRoute, /getAccessContext\(\{ tenant: true \}\)/);
  assert.match(catalog, /user_warehouse_access/);
  assert.match(catalog, /inventory\.catalogue_item\.created/);
  assert.match(catalog, /Only a Farm Manager with an assigned warehouse/);
});

test("opening setup and automatic usage have atomic governed ownership",()=>{
  assert.match(warehouseFirstMigration,/initialize_warehouse_inventory/);
  assert.match(warehouseFirstMigration,/unique \(warehouse_id\)/);
  assert.match(warehouseFirstMigration,/'health_treatment'/);
  assert.match(warehouseFirstMigration,/'vaccination_completion'/);
  assert.match(warehouseFirstMigration,/Daily Records may issue only vitamins, supplements, packaging, and general supplies/);
  assert.match(operations,/Feed day close/);
  assert.match(operations,/Daily supplies/);
  assert.match(operations,/Treatment/);
  assert.match(operations,/Vaccination/);
});

test("inventory option consumers no longer rely on browser RLS reads", () => {
  assert.match(dailyRecords, /fetch\("\/api\/inventory\/catalog"\)/);
  assert.doesNotMatch(dailyRecords, /\.from\("inventory_items"\)/);
  assert.match(healthEventsRoute, /export async function GET/);
  assert.match(healthEventsRoute, /user_farm_access/);
});
