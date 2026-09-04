import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260904000000_scheduled_management_reports.sql", import.meta.url), "utf8");
const service = await readFile(new URL("../src/lib/management-reports.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/api/operations-analytics/route.ts", import.meta.url), "utf8");
const center = await readFile(new URL("../src/components/reports/management-report-center.tsx", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/platform-monitoring.yml", import.meta.url), "utf8");

test("report runs are immutable, tenant scoped, and shared only with named recipients", () => {
  assert.match(migration, /management_report_runs_append_only/i);
  assert.match(migration, /before update or delete/i);
  assert.match(migration, /org_id=public\.current_org_id\(\)/i);
  assert.match(migration, /auth\.uid\(\)=any\(recipient_ids\)/i);
  assert.match(migration, /user_farm_access/i);
  assert.match(migration, /revoke insert,update,delete .* from anon,authenticated/i);
});

test("report generation reuses protected authoritative analytics and hashes every snapshot", () => {
  assert.match(service, /\/api\/operations-analytics/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /snapshot_sha256/);
  assert.match(route, /tokenMatches\(provided, expected\)/);
  assert.match(route, /internal_org_id/);
  assert.match(route, /profile\?\.role === "ceo" \|\| profile\?\.role === "farm_manager"/);
});

test("only a tenant CEO can schedule while managers can generate scoped snapshots", () => {
  assert.match(service, /Only the tenant CEO can schedule management reports/);
  assert.match(service, /ctx\.role !== "ceo" && ctx\.role !== "farm_manager"/);
  assert.match(service, /Every report recipient must be an active CEO or Farm Manager/);
  assert.match(service, /A Farm Manager can receive only a report for a farm currently assigned to them/);
  assert.match(service, /Choose one assigned farm before saving a management report/);
  assert.match(center, /Generate snapshot/);
  assert.match(center, /Schedule report/);
});

test("scheduler generates due reports and retains branded HTML and CSV downloads", () => {
  assert.match(service, /dispatchScheduledManagementReports/);
  assert.match(service, /management-report-v1/);
  assert.match(service, /renderManagementReportHtml/);
  assert.match(service, /renderManagementReportCsv/);
  assert.match(workflow, /platform-monitoring\.mjs reports/);
});
