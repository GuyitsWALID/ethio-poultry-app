import assert from "node:assert/strict";
import test from "node:test";
import {validReportDate, reportTimestampBounds, reportOperatingDate, reportWarehouseAllowed, reportCsvCell, reportConsumptionCost,reportStockWindow} from "../src/lib/report-safety.ts";

test("report dates reject normalized impossible dates and excessive periods", () => {
  assert.equal(validReportDate("2026-02-30"), false);
  assert.equal(validReportDate("2028-02-29"), true);
  assert.throws(() => reportTimestampBounds("2026-01-02", "2026-01-01"), /INVALID_REPORT_PERIOD/);
  assert.throws(() => reportTimestampBounds("2025-01-01", "2026-01-02"), /REPORT_PERIOD_TOO_LONG/);
});

test("report timestamp boundaries include the whole final Addis day, not UTC day", () => {
  const {start, end} = reportTimestampBounds("2026-10-18", "2026-10-18");
  assert.equal(start, "2026-10-17T21:00:00.000Z");
  assert.equal(end, "2026-10-18T21:00:00.000Z");
  assert.equal(reportOperatingDate("2026-10-18T20:59:59.999Z"), "2026-10-18");
  assert.equal(reportOperatingDate(end), "2026-10-19");
  assert.equal(reportOperatingDate("bad"), null);
});

test("warehouse permission is independent of branch/farm labels and fails closed", () => {
  const allowed = new Set(["inherited-farm-store", "explicit-shared-store"]);
  for (const id of allowed) assert.equal(reportWarehouseAllowed(id, allowed), true);
  for (const id of ["same-branch-store", "revoked-store", "another-tenant", null, undefined]) assert.equal(reportWarehouseAllowed(id, allowed), false);
  assert.equal(reportWarehouseAllowed("tenant-store", null), true);
});

test("CSV protects formula-like user text, preserves numeric negatives and escapes quotes", () => {
  for (const text of ["=1+1", "+cmd", "@SUM(A1)", "-1+2", " \t=1+1", "\n=1"]) assert.ok(reportCsvCell(text).startsWith('"\''));
  assert.equal(reportCsvCell(-12.5), '"-12.5"');
  assert.equal(reportCsvCell('Farm "A"'), '"Farm ""A"""');
  assert.equal(reportCsvCell(null), '"Unavailable"');
});

test("consumption costs exclude transfers, reverse returns and never claim partial costs are actual", () => {
  const issue = {transaction_type: "issue", quantity: 10, unit_cost: 20};
  assert.equal(reportConsumptionCost([issue, {transaction_type: "return", quantity: 2, unit_cost: 20}, {transaction_type: "transfer_out", quantity: 10, unit_cost: 20}]), 160);
  for (const unit_cost of [null, undefined, "", "bad", -1]) assert.equal(reportConsumptionCost([issue, {...issue, unit_cost}]), null);
  assert.equal(reportConsumptionCost([{...issue, unit_cost: 0}]), 0);
  assert.equal(reportConsumptionCost([]), null);
});

test("stock windows distinguish opening, period end, current and future without mixing item units",()=>{
  const row=(date,type,quantity)=>({transaction_date:date,transaction_type:type,quantity});
  const rows=[row('2026-08-01T09:00:00Z','receipt',100),row('2026-09-30T21:00:00Z','issue',10),
    row('2026-10-01T20:59:59Z','issue',5),row('2026-10-01T21:00:00Z','receipt',20),row('2026-12-01T00:00:00Z','receipt',999)];
  const result=reportStockWindow(rows,'2026-10-01','2026-10-01',Date.parse('2026-10-19T00:00:00Z'));
  assert.equal(result.opening,100);assert.equal(result.periodEnd,85);assert.equal(result.current,105);
  assert.equal(result.during.length,2);
  assert.throws(()=>reportStockWindow([{...rows[0],quantity:null}],'2026-10-01','2026-10-01'),/INVALID/);
});
