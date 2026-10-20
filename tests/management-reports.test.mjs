import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260904000000_scheduled_management_reports.sql", import.meta.url), "utf8");
const service = await readFile(new URL("../src/lib/management-reports.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/api/operations-analytics/route.ts", import.meta.url), "utf8");
const analyticsService = await readFile(new URL("../src/lib/operations-analytics-service.ts", import.meta.url), "utf8");
const center = await readFile(new URL("../src/components/reports/management-report-center.tsx", import.meta.url), "utf8");
const history = await readFile(new URL("../src/components/reports/saved-report-history.tsx", import.meta.url), "utf8");
const copy = JSON.parse(await readFile(new URL("../messages/en.json", import.meta.url), "utf8")).SavedReports;
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
  assert.match(service, /loadFarmPerformance\(ctx/);
  assert.match(service, /captureConsistentPerformance/);
  assert.doesNotMatch(service, /fetch\(`\$\{origin\}\/api\/operations-analytics/);
  assert.match(service, /createHash\("sha256"\)/);
  assert.match(service, /snapshot_sha256/);
  assert.match(route, /getAccessContext\(\{ tenant: true \}\)/);
  assert.match(route, /loadOperationsAnalytics\(access, request\.nextUrl\.searchParams\)/);
  assert.match(analyticsService, /export async function loadOperationsAnalytics/);
  assert.doesNotMatch(route, /internal_org_id|MONITORING_INGEST_TOKEN/);
});

test("only a tenant CEO can schedule while managers can generate scoped snapshots", () => {
  assert.match(service, /Only the tenant CEO can schedule management reports/);
  assert.match(service, /ctx\.role !== "ceo" && ctx\.role !== "farm_manager"/);
  assert.match(service, /Every report recipient must be an active CEO or Farm Manager/);
  assert.match(service, /A Farm Manager can receive only a report for a farm currently assigned to them/);
  assert.match(service, /Choose one assigned farm before saving a management report/);
  assert.equal(copy.create, "Create downloadable report");
  assert.equal(copy.schedule, "Schedule report");
  assert.match(center, /copy\.create/);
  assert.match(center, /copy\.schedule/);
});

test("report history refreshes after failures and optional sharing excludes the creator", () => {
  assert.match(service, /currentUserId: ctx\.userId/);
  assert.match(center, /recipient\.id !== center\.currentUserId/);
  assert.match(center, /copy\.sharing/);
  assert.match(center, /copy\.creator/);
  assert.match(center, /catch \(caught\)[\s\S]*await load\(\);[\s\S]*setError\(message\)/);
  assert.match(history, /copy\.notCreated/);
});

test("scheduler generates due reports and retains branded HTML and CSV downloads", () => {
  assert.match(service, /dispatchScheduledManagementReports/);
  assert.match(service, /performanceReportVersion/);
  assert.match(service, /renderManagementReportHtml/);
  assert.match(service, /renderManagementReportCsv/);
  assert.match(workflow, /platform-monitoring\.mjs reports/);
});

test("schedule writes use atomic audited RPCs rather than a separate audit call", () => {
  assert.match(service, /reportRpc\("create_management_report_schedule"/);
  assert.match(service, /reportRpc\("set_management_report_schedule_active"/);
  assert.match(service, /p_expected_revision: before.updated_at/);
  assert.doesNotMatch(service, /recordAuditEvent|from\("management_report_schedules"\)\.(insert|update|delete)/);
});
