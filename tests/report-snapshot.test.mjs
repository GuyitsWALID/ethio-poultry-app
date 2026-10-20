import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {reportResources, readableReportVersion, scopedReportVersion} from "../src/lib/report-snapshot.ts";

const farm = "20000000-0000-4000-8000-000000000001";
const owned = "20000000-0000-4000-8000-000000000002";
const shared = "20000000-0000-4000-8000-000000000003";
test("snapshot provenance names the used sources, not every available warehouse", () => {
  assert.deepEqual(reportResources([farm, farm], [{warehouse_id: shared}, {warehouse_id: owned}, {warehouse_id: shared}]),
    {schema_version: 1, complete: true, farm_ids: [farm], warehouse_ids: [owned, shared]});
});
test("missing legacy warehouse identity remains unverifiable rather than guessed", () => {
  for (const warehouse_id of [null, undefined, "same branch", ""]) {
    const result = reportResources([farm], [{warehouse_id: owned}, {warehouse_id}]);
    assert.equal(result.complete, false);
    assert.deepEqual(result.warehouse_ids, [owned]);
  }
  assert.throws(() => reportResources(["not a farm ID"], []), /PROVENANCE_INVALID/);
});
test("an empty evidence set retains authorized farm context without inventing warehouse evidence", () => {
  assert.deepEqual(reportResources([farm], []), {schema_version: 1, complete: true, farm_ids: [farm], warehouse_ids: []});
});
test("legacy rendering stays version-specific and unknown versions fail closed", () => {
  assert.equal(readableReportVersion("management-report-v1"), "management-report-v1");
  assert.equal(readableReportVersion(scopedReportVersion), "management-report-v1-scoped");
  assert.equal(readableReportVersion("management-report-v2"), "management-report-v2");
  for (const version of [null, undefined, "management-report-v3", ""]) assert.throws(() => readableReportVersion(version), /not supported/);
});

test("all application snapshot reads use the database permission boundary", async () => {
  const service = await readFile(new URL("../src/lib/management-reports.ts", import.meta.url), "utf8");
  assert.doesNotMatch(service, /\.from\("management_report_runs"\)/);
  assert.match(service, /page_accessible_management_reports/);
  assert.match(service, /read_accessible_management_report/);
  assert.match(service, /report_resources: resources/);
  assert.match(service, /REPORT_RESOURCE_PROVENANCE_MISSING/);
});
