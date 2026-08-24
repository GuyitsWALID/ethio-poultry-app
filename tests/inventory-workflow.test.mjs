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
const receiptMigration = await readFile(new URL("../supabase/migrations/20260824001000_atomic_inventory_receipts.sql", import.meta.url), "utf8");
const vaccinationDateMigration = await readFile(new URL("../supabase/migrations/20260824002000_weekly_operating_grace_and_vaccination_date.sql", import.meta.url), "utf8");
const healthPage = await readFile(new URL("../src/app/app/health/page.tsx", import.meta.url), "utf8");
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

test("new catalogue items and their first receipt are one warehouse-authorized transaction",()=>{
  assert.match(receiptMigration,/receive_inventory_stock/);
  assert.match(receiptMigration,/user_warehouse_access/);
  assert.match(receiptMigration,/inventory_receipt/);
  assert.match(receiptMigration,/record_assigned_inventory_movement/);
  assert.match(page,/\/api\/inventory\/receipts/);
  assert.doesNotMatch(page,/created\.item\.id/);
});

test("inventory option consumers no longer rely on browser RLS reads", () => {
  assert.match(dailyRecords, /fetch\("\/api\/inventory\/catalog"\)/);
  assert.doesNotMatch(dailyRecords, /\.from\("inventory_items"\)/);
  assert.match(healthEventsRoute, /export async function GET/);
  assert.match(healthEventsRoute, /user_farm_access/);
});

test("vaccination completion records the actual date without rewriting its planned date",()=>{
  assert.match(vaccinationDateMigration,/p_administered_on date/);
  assert.match(vaccinationDateMigration,/operating_date=p_administered_on and status='locked'/);
  assert.match(vaccinationDateMigration,/values\(v_org_id,v_flock_id,p_administered_on/);
  assert.match(healthEventsRoute,/p_administered_on:administeredOn/);
  assert.match(healthPage,/name="administered_on"/);
  assert.match(healthPage,/Scheduled for/);
});

test("automatic operating-day locking keeps a governed seven-day entry window",()=>{
  assert.match(vaccinationDateMigration,/operational_day_lock_grace_days integer not null default 7/);
  assert.match(vaccinationDateMigration,/o\.operational_day_lock_grace_days \+ 1/);
  assert.match(vaccinationDateMigration,/d\.closed_by is null/);
});
