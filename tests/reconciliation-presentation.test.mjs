import assert from "node:assert/strict";
import test from "node:test";

import {
  formatReconciliationNumber,
  normalizeReconciliationFinding,
  reconciliationEvidenceEntries,
} from "../src/lib/reconciliation-presentation.ts";

test("maps Item 3 database variance columns to the dashboard contract", () => {
  const finding = normalizeReconciliationFinding({ variance: "12.5", unit: "kg" });
  assert.equal(finding.variance_value, 12.5);
  assert.equal(finding.variance_unit, "kg");
});

test("missing or malformed finding values never crash reconciliation rendering", () => {
  assert.equal(formatReconciliationNumber(undefined, "kg"), "Evidence gap");
  assert.equal(formatReconciliationNumber(null), "Evidence gap");
  assert.equal(formatReconciliationNumber("not-a-number"), "Evidence gap");
});

test("valid reconciliation values retain their unit", () => {
  assert.equal(formatReconciliationNumber(1250, "ETB"), "1,250 ETB");
});

test("source evidence is converted into manager-readable fields", () => {
  const entries = reconciliationEvidenceEntries({
    description: "Feed transport",
    amountEtb: 54000,
    costEntryId: "247f2cc0-27f0-04d6-6607-2aa2faa1e1b8",
  });
  assert.deepEqual(entries.map(item => [item.label,item.value,item.technical]), [
    ["Description","Feed transport",false],
    ["Cost amount","54,000 ETB",false],
    ["Cost entry reference","247f2cc0-27f0-04d6-6607-2aa2faa1e1b8",true],
  ]);
});
