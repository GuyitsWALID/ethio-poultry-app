import assert from "node:assert/strict";
import test from "node:test";
import {build} from "esbuild";
import {captureConsistentPerformance} from "../src/lib/performance-snapshot.ts";
import {legacyPerformanceView} from "../src/lib/farm-performance-view.ts";
const section = {state: "missing", metrics: [{key: "eggs", value: null, previous: 2, unit: "eggs"}], series: [], explanations: ["MISSING_EVIDENCE"], coverage: null};
const snapshot = {schemaVersion: 1, display_locale: "en", organization_name: "<script>org</script>", meta: {dateFrom: "2026-10-01", dateTo: "2026-10-20", scopeLabel: "Farm", generatedAt: "2026-10-20T07:00:00Z"}, sections: Object.fromEntries(["production", "feeding", "health", "stock", "salesCosts"].map(key => [key, {...section}]))};
test("capture retries changed evidence and freezes only a stable complete read", async () => {
  const revisions = ["1", "2", "2", "2"]; let reads = 0;
  const result = await captureConsistentPerformance(async () => revisions.shift(), async () => {reads++; return structuredClone(snapshot);});
  assert.equal(reads, 2); assert.equal(result.evidence_revision, "2");
});
test("failed sections and repeatedly changing evidence cannot become completed snapshots", async () => {
  await assert.rejects(captureConsistentPerformance(async () => "1", async () => ({...snapshot, sections: {stock: {state: "failed"}}})), /REPORT_EVIDENCE_INCOMPLETE/);
  let revision = 0;
  await assert.rejects(captureConsistentPerformance(async () => String(++revision), async () => snapshot), /REPORT_EVIDENCE_CHANGED/);
});
const bundle = await build({entryPoints: ["src/lib/performance-report-renderer.ts"], bundle: true, write: false, platform: "node", format: "esm"});
const {renderPerformanceHtml, renderPerformanceCsv} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
test("v2 frozen output covers all topics, escapes user HTML and neutralizes CSV formulas", () => {
  const data = structuredClone(snapshot);
  data.sections.stock.rows = [{label: "=HYPERLINK(1)", values: {current: 5}, unit: "kg"}];
  const html = renderPerformanceHtml(data, "<img onerror=alert(1)>");
  assert.ok(!html.includes("<script>org</script>")); assert.ok(!html.includes("<img onerror"));
  assert.equal((html.match(/<section>/g) ?? []).length, 5);
  assert.ok(html.includes("Unavailable")); assert.ok(html.includes("@media print"));
  const csv = renderPerformanceCsv(data, "=SUM(A1)");
  assert.ok(csv.includes("'=SUM(A1)")); assert.ok(csv.includes("'=HYPERLINK(1)"));
  data.display_locale = "am";
  const translated = renderPerformanceHtml(data, "ሪፖርት");
  assert.ok(translated.includes('lang="am"')); assert.ok(translated.includes("አይገኝም")); assert.ok(!translated.includes("Oct 1, 2026"));
});
test("legacy saved and analytics views resolve without interstitial navigation", () => {
  assert.equal(legacyPerformanceView(new URLSearchParams("report_id=old")), "saved");
  assert.equal(legacyPerformanceView(new URLSearchParams("view=advanced")), "saved");
});
