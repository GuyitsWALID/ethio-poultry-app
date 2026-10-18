import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {stripTypeScriptTypes} from "node:module";
import test from "node:test";
import {historyDb} from "./helpers/history-db.mjs";
import {parseHistoryInput} from "../src/lib/history/contracts.ts";
import {historySources} from "../src/lib/history/sources.ts";

let source = await readFile(new URL("../src/lib/history/server.ts", import.meta.url), "utf8");
source = source.replace('import "server-only";', '').replace(/^import .* from "@\/lib\/access-context";$/m, 'const governanceAdmin = {};').replace(/^import .* from "@\/lib\/warehouse-access";$/m, 'const effectiveWarehouseIds = async () => [];');
for (const file of ["contracts", "sources"]) source = source.replace(`from "./${file}"`, `from "${new URL(`../src/lib/history/${file}.ts`, import.meta.url).href}"`);
const {listHistory, historyDetail} = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = uuid(1), otherOrg = uuid(2), farm = uuid(10), otherFarm = uuid(11), flock = uuid(20), otherFlock = uuid(21), house = uuid(30), batch = uuid(40), store = uuid(50), shared = uuid(51);
const ctx = {userId: uuid(100), orgId: org, role: "farm_manager", supportSessionId: null};
const row = (id, extra = {}) => ({id: uuid(id), org_id: org, created_at: "2026-10-17T10:00:00Z", updated_at: "2026-10-17T10:00:00Z", ...extra});
function fixtures() {
  const tables = Object.fromEntries(historySources.map(source => [source.table, []]));
  Object.assign(tables, {
    organizations: [{id: org, today_workspace_enabled: true}],
    user_farm_access: [row(101, {profile_id: ctx.userId, farm_id: farm, starts_at: "2020-01-01", expires_at: null, revoked_at: null})],
    farms: [row(10, {name: "Assigned farm"}), row(11, {name: "Other farm"}), row(12, {name: "Other tenant", org_id: otherOrg})],
    houses: [row(30, {name: "House", farm_id: farm}), row(31, {name: "Other house", farm_id: otherFarm})],
    flocks: [row(20, {flock_code: "Archived flock", farm_id: farm, house_id: house, batch_id: batch, status: "archived"}), row(21, {flock_code: "Other flock", farm_id: otherFarm, house_id: uuid(31)})],
    batches: [row(40, {batch_code: "Previous batch", farm_id: farm, house_id: house, status: "archived"})],
    warehouses: [row(50, {name: "Farm store", farm_id: farm, status: "active"}), row(51, {name: "Shared store", farm_id: null, status: "active"}), row(52, {name: "Other farm store", farm_id: otherFarm, status: "active"})],
    inventory_items: [row(60, {name: "Feed", unit: "kg"})],
  });
  return tables;
}
const input = (changes = {}) => parseHistoryInput(new URLSearchParams({from: "2020-01-01", to: "2026-10-17", ...changes}));
const warehouses = async () => [store];
const denied = error => ["ACCESS_DENIED", "UNAVAILABLE"].includes(error.code);

test("History scopes before pagination and reaches 1,205 archived-flock records", async () => {
  const tables = fixtures();
  tables.daily_farm_records = Array.from({length: 1205}, (_, i) => row(2000+i, {flock_id: flock, record_date: "2026-10-01", deaths: 0, culls: 0}));
  tables.daily_farm_records.push(row(99999, {flock_id: otherFlock, record_date: "2026-10-17"}), row(99998, {flock_id: flock, org_id: otherOrg, record_date: "2026-10-17"}));
  const db = historyDb(tables), seen = new Set(); let cursor = null, pages = 0;
  do {
    const page = await listHistory(ctx, input({flock_id: flock}), cursor, db, warehouses);
    assert.ok(page.items.length <= 50);
    for (const item of page.items) {assert.ok(!seen.has(item.id)); seen.add(item.id); assert.ok(item.context.includes("Archived flock"));}
    assert.equal(page.options.flocks.length, 1); assert.equal(page.options.warehouses.length, 1);
    cursor = page.nextCursor; pages++;
  } while (cursor);
  assert.equal(seen.size, 1205); assert.equal(pages, 25); assert.ok(!seen.has(uuid(99999)));
  assert.ok(db.calls.filter(call => call.table === "daily_farm_records").every(call => call.count === 51));
});
test("source IDs, incompatible filters, expired assignments and tenant IDs fail closed", async () => {
  const tables = fixtures(), db = historyDb(tables);
  tables.daily_farm_records = [row(1, {flock_id: otherFlock, record_date: "2026-10-01"}), row(2, {org_id: otherOrg, flock_id: flock, record_date: "2026-10-01"})];
  await assert.rejects(historyDetail(ctx, "daily_record", uuid(1), db, warehouses), denied);
  await assert.rejects(historyDetail(ctx, "daily_record", uuid(2), db, warehouses), denied);
  await assert.rejects(listHistory(ctx, input({farm_id: otherFarm}), null, db, warehouses), denied);
  await assert.rejects(listHistory({...ctx, role: "ceo"}, input({farm_id: farm, house_id: uuid(31)}), null, db, warehouses), denied);
  tables.user_farm_access[0].expires_at = "2021-01-01";
  assert.equal((await listHistory(ctx, input(), null, db, async()=>[])).items.length, 0);
  await assert.rejects(historyDetail(ctx, "daily_record", uuid(1), db, warehouses), denied);
});
test("shared feeding stores require explicit permission in both list and detail", async () => {
  const tables = fixtures();
  tables.feeding_session_records = [row(200, {flock_id: flock, warehouse_id: store, record_date: "2026-10-01", status: "completed", actual_feed_kg: 10}), row(201, {flock_id: flock, warehouse_id: shared, record_date: "2026-10-01", status: "completed", actual_feed_kg: 20}), row(202, {flock_id: flock, warehouse_id: store, record_date: "2026-10-01", status: "planned"})];
  const db = historyDb(tables);
  assert.equal((await listHistory(ctx, input({category: "feeding"}), null, db, warehouses)).items.length, 1);
  await assert.rejects(historyDetail(ctx, "feed_session", uuid(201), db, warehouses), denied);
  assert.equal((await listHistory(ctx, input({category: "feeding"}), null, db, async()=>[store, shared])).items.length, 2);
  assert.equal((await historyDetail(ctx, "feed_session", uuid(201), db, async()=>[store, shared])).fields.find(f=>f.key==="actual_feed_kg").value, 20);
});
test("expense rows require both relevant farm and warehouse permissions", async () => {
  const tables = fixtures();
  tables.cost_entries = [row(1, {farm_id: farm, warehouse_id: null, entry_date: "2026-10-01"}), row(2, {farm_id: farm, warehouse_id: shared, entry_date: "2026-10-01"}), row(3, {farm_id: otherFarm, warehouse_id: store, entry_date: "2026-10-01"}), row(4, {farm_id: null, warehouse_id: store, entry_date: "2026-10-01"})];
  const db = historyDb(tables);
  assert.deepEqual((await listHistory(ctx, input({category: "expenses"}), null, db, warehouses)).items.map(x=>x.id).sort(), [uuid(1), uuid(4)]);
  await assert.rejects(historyDetail(ctx, "expense", uuid(2), db, warehouses), denied);
  assert.equal((await listHistory(ctx, input({category: "expenses"}), null, db, async()=>[store,shared])).items.length, 3);
});
test("every source detail is readable without exposing UUID fields or mutation methods", async () => {
  const tables = fixtures(), activeCtx = {...ctx, role: "ceo"};
  tables.flocks[0].status = "active";
  for (let i=0; i<historySources.length; i++) {
    const source = historySources[i];
    const record = row(500+i, {flock_id: flock, farm_id: farm, warehouse_id: store, [source.date]: "2026-10-01", status: "completed", deaths: 2, culls: 1, event_type: "treatment", description: source.kind === "vaccination_completion" ? `SCHEDULE_STATUS|${uuid(900)}|completed|vaccination` : null, completed_by: ctx.userId, actual_feed_kg: 1});
    tables[source.table].push(record);
    if (source.kind === "vaccination_completion") tables.vaccination_events = [row(900, {flock_id: flock, vaccine_name: "Vaccine", voided_at: null})];
    const detail = await historyDetail(activeCtx, source.kind, record.id, historyDb(tables), warehouses);
    assert.equal(detail.kind, source.kind); assert.equal(detail.correctionHref, null);
    for (const field of detail.fields) assert.ok(!field.key.endsWith("_id"));
  }
});
test("completed vaccination evidence is shown, future schedules and internal markers are not", async () => {
  const tables = fixtures();
  tables.health_events = [row(1, {flock_id: flock, event_date: "2026-10-01", event_type: "treatment", description: null, diagnosis: "Example"}), row(2, {flock_id: flock, event_date: "2026-10-01", event_type: "observation", description: `SCHEDULE_STATUS|${uuid(900)}|completed|vaccination`}), row(3, {flock_id: flock, event_date: "2026-10-01", event_type: "observation", description: `SCHEDULE_TARGET|${uuid(901)}|pending`})];
  tables.vaccination_events = [row(900, {flock_id: flock, vaccine_name: "Completed", voided_at: null}), row(901, {flock_id: flock, vaccine_name: "Scheduled", event_date: "2027-01-01"})];
  const db = historyDb(tables), page = await listHistory(ctx, input({category: "health"}), null, db, warehouses);
  assert.deepEqual(new Set(page.items.map(x=>x.kind)), new Set(["health_event", "vaccination_completion"]));
  assert.ok(!JSON.stringify(page.items).includes("SCHEDULE_"));
  const detail = await historyDetail(ctx, "vaccination_completion", uuid(2), db, warehouses);
  assert.equal(detail.fields.find(f=>f.key==="vaccine_name").value, "Completed");
  await assert.rejects(historyDetail(ctx, "vaccination_events", uuid(901), db, warehouses), denied);
});
test("multi-source identical-date continuation does not duplicate or omit records", async () => {
  const tables = fixtures();
  for (const table of ["feeding_session_records", "feed_day_closures"]) tables[table] = Array.from({length: 90}, (_, i)=>row(300+i, {flock_id: flock, warehouse_id: store, record_date: "2026-10-01", status: table === "feed_day_closures" ? "closed" : "completed"}));
  const db = historyDb(tables), records = []; let cursor = null;
  do {const page = await listHistory(ctx, input({category: "feeding"}), cursor, db, warehouses); records.push(...page.items.map(x=>`${x.kind}:${x.id}`)); cursor=page.nextCursor;} while(cursor);
  assert.equal(records.length, 180); assert.equal(new Set(records).size, 180);
});
test("disabled rollout, admin access and source failures never become empty success", async () => {
  const tables = fixtures();
  await assert.rejects(listHistory({...ctx, role: "system_admin"}, input(), null, historyDb(tables), warehouses), denied);
  tables.organizations[0].today_workspace_enabled = false;
  await assert.rejects(listHistory(ctx, input(), null, historyDb(tables), warehouses), e=>e.code==="FEATURE_DISABLED");
  tables.organizations[0].today_workspace_enabled = true; tables.daily_farm_records = Error("database down");
  await assert.rejects(listHistory(ctx, input(), null, historyDb(tables), warehouses), e=>e.code==="LOAD_FAILED");
});
test("only supported manager corrections are linked and official losses are not added to supporting events", async () => {
  const tables = fixtures(); tables.flocks[0].status="active";
  tables.daily_farm_records = [row(200, {flock_id: flock, record_date: "2026-10-01", deaths: 2, culls: 1})];
  tables.mortality_events = [row(201, {flock_id: flock, record_date: "2026-10-01", count: 2, cause: "Natural"})];
  const detail = await historyDetail(ctx, "daily_record", uuid(200), historyDb(tables), warehouses);
  assert.equal(detail.fields.find(f=>f.key==="deaths").value, 2); assert.equal(detail.supporting[0].fields.find(f=>f.key==="count").value, 2);
  const correction = new URL(detail.correctionHref, "https://test.invalid");
  assert.equal(correction.searchParams.get("source_id"), uuid(200)); assert.equal(correction.searchParams.get("request_type"), "locked_correction");
  assert.ok(correction.searchParams.get("correction_route").startsWith("/app/daily-records?"));
  tables.flocks[0].status="archived";
  assert.equal((await historyDetail(ctx, "daily_record", uuid(200), historyDb(tables), warehouses)).correctionHref, null);
});
