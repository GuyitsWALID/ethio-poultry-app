import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {projectReportEvidence, readAllEvidence, selectEvidenceScope} from "../src/lib/report-evidence.ts";

const input = {dateFrom: "2026-09-01", dateTo: "2026-09-30"};
const farms = [{id: "f1", org_id: "o", branch_id: "b", name: "Farm one"}, {id: "f2", org_id: "o", branch_id: "b", name: "Farm two"}, {id: "alien", org_id: "other"}];
const flocks = [{id: "bird1", org_id: "o", farm_id: "f1", house_id: "h1", batch_id: "batch1", flock_code: "Layer A"}, {id: "bird2", org_id: "o", farm_id: "f2", house_id: "h2", flock_code: "Broiler B"}];
const scope = (manager = false, filters = input) => selectEvidenceScope("o", manager, manager ? [farms[0]] : farms, flocks, filters);

test("evidence scope rejects other tenants, unassigned farms and contradictory targets", () => {
  for (const farmId of ["alien", "f2", "missing"]) assert.throws(() => scope(true, {...input, farmId}), /REPORT_SCOPE_DENIED/);
  assert.throws(() => scope(false, {...input, farmId: "f1", flockId: "bird2"}), /REPORT_SCOPE_DENIED/);
  assert.deepEqual(scope(true).flockIds, ["bird1"]);
});

test("assigned empty houses and new batches return empty health evidence, not false denial", () => {
  const filters = {...input, farmId: "f1", houseId: "empty", batchId: "new"};
  const metadata = {houses: [{id: "empty", org_id: "o", farm_id: "f1"}], batches: [{id: "new", org_id: "o", farm_id: "f1", house_id: "empty"}]};
  const selected = selectEvidenceScope("o", true, [farms[0]], [], filters, metadata);
  assert.deepEqual(projectReportEvidence("health", filters, selected, {}).items, []);
  assert.throws(() => selectEvidenceScope("o", true, [farms[0]], [], {...filters, farmId: "f2"}, metadata), /REPORT_SCOPE_DENIED/);
});

test("health evidence excludes schedule metadata and uses actual vaccine completion dates", () => {
  const event = {org_id: "o", flock_id: "bird1", event_date: "2026-09-20", event_type: "observation"};
  const events = [
    {...event, event_type: "disease", diagnosis: "Respiratory signs", treatment: "Vet called"},
    {...event, description: "SCHEDULE_TARGET|v1|bird1"},
    {...event, description: "SCHEDULE_STATUS|v1|completed|vaccination"},
    {...event, description: "SCHEDULE_STATUS|v1|completed|vaccination"},
    {...event, event_type: "treatment", voided_at: "2026-09-21"},
    {...event, org_id: "other", event_type: "disease"},
    {...event, flock_id: "bird2", event_type: "disease"},
  ];
  const vaccinations = [{id: "v1", org_id: "o", flock_id: "bird1", vaccine_name: "Newcastle", event_date: "2026-08-01"}];
  const result = projectReportEvidence("health", input, scope(true), {events, vaccinations});
  assert.deepEqual(result.items.map(row => row.kind), ["disease", "vaccination"]);
  assert.equal(result.items[1].date, "2026-09-20");
  assert.equal(result.items[0].context, "Layer A");
  assert.equal(result.items[0].note, "Vet called");
  assert.doesNotMatch(JSON.stringify(result), /SCHEDULE_|bird1|v1/);
});

test("populated CEO and manager expense evidence uses existing sums without net-profit invention", () => {
  const expenses = [
    {id: "secret1", org_id: "o", branch_id: "b", farm_id: "f1", entry_date: "2026-09-05", amount: "120.50", description: "Electricity"},
    {org_id: "o", branch_id: "b", farm_id: "f2", entry_date: "2026-09-06", amount: 200, description: "Transport"},
    {org_id: "o", branch_id: "b", farm_id: null, entry_date: "2026-09-07", amount: 50, description: "Branch store"},
    {org_id: "other", farm_id: "f1", entry_date: "2026-09-07", amount: 999},
    {org_id: "o", farm_id: "f1", entry_date: "2026-08-01", amount: 999},
  ];
  const periods = [{org_id: "o", farm_id: "f1", period_start: "2026-09-01", period_end: "2026-09-30", total_absorbed_cost: 120.5, status: "locked", unallocated_cost: 5, reconciliation_warnings: ["Review"]}];
  const ceo = projectReportEvidence("finance", input, scope(), {expenses, periods});
  const manager = projectReportEvidence("finance", input, scope(true), {expenses, periods});
  assert.equal(ceo.expenseTotal, 370.5);
  assert.equal(manager.expenseTotal, 120.5);
  assert.equal(manager.items.find(row => row.kind === "period").warnings, 1);
  assert.equal(manager.items.find(row => row.kind === "period").status, "locked");
  assert.doesNotMatch(JSON.stringify(ceo), /secret1|netProfit/);
  const branchInput = {...input, branchId: "b"};
  assert.equal(projectReportEvidence("finance", branchInput, scope(false, branchInput), {expenses}).expenseTotal, 370.5);
});

test("invalid money remains unavailable; overlapping close periods never inflate expenses", () => {
  for (const amount of [null, "bad", true, " "]) {
    const result = projectReportEvidence("finance", input, scope(), {expenses: [{org_id: "o", farm_id: "f1", entry_date: "2026-09-05", amount}]});
    assert.equal(result.expenseTotal, undefined);
    assert.equal(result.items[0].amount, undefined);
  }
  const period = {org_id: "o", period_start: "2026-09-01", period_end: "2026-09-30", total_absorbed_cost: 100};
  const result = projectReportEvidence("finance", input, scope(), {periods: [period, {...period, farm_id: "f1"}]});
  assert.equal(result.expenseTotal, 0);
  assert.equal(result.items.length, 2);
});

test("evidence pagination completes totals or rejects, never silently truncates", async () => {
  const rows = Array.from({length: 1101}, (_, id) => ({id}));
  const calls = [];
  assert.equal((await readAllEvidence(async (start, end) => {calls.push(start); return rows.slice(start, end + 1);})).length, 1101);
  assert.deepEqual(calls, [0, 500, 1000]);
  await assert.rejects(readAllEvidence(async (start, end) => rows.slice(start, end + 1), 500, 1000), /REPORT_TOO_LARGE/);
  await assert.rejects(readAllEvidence(async start => {if (start) throw new Error("Database unavailable"); return rows.slice(0, 500);}), /Database unavailable/);
});

test("evidence adapter is read-only and handoffs preserve correction/rollback behavior", async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const server = await read("src/lib/report-evidence.server.ts");
  assert.match(server, /import "server-only"/);
  assert.match(server, /user_farm_access/);
  assert.match(server, /revoked_at/);
  assert.match(server, /expires_at/);
  assert.doesNotMatch(server, /\.(insert|update|delete|upsert)\(/);
  const route = await read("src/app/api/reports/evidence/route.ts");
  assert.match(route, /private, no-store/);
  const handoff = await read("src/components/reports/report-analytics-handoff.tsx");
  assert.match(handoff, /if \(!enabled \|\| query.get\("feed_target"\)/);
  assert.match(handoff, /useTodayEntryMode/);
  for (const path of ["src/app/app/feeding-log/page.tsx", "src/app/app/inventory/page.tsx", "src/app/app/sales/page.tsx", "src/components/mortality/mortality-control-room.tsx", "src/app/app/analytics/page.tsx"]) assert.match(await read(path), /ReportAnalyticsHandoff/);
});
