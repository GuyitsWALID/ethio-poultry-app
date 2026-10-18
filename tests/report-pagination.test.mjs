import assert from "node:assert/strict";
import test from "node:test";
import {readReportQuery} from "../src/lib/report-pagination.ts";

test("calculation readers reach records past legacy caps without dropping identical dates", async () => {
  const rows = Array.from({length: 20501}, (_, id) => ({id, date: "2026-10-18", amount: 1}));
  const calls = [];
  const {data} = await readReportQuery(() => ({range: async (from, to) => {
    calls.push(from);
    return {data: rows.slice(from, to + 1), error: null};
  }}));
  assert.equal(data.length, rows.length);
  assert.equal(new Set(data.map(row => row.id)).size, rows.length);
  assert.equal(data.reduce((sum, row) => sum + row.amount, 0), 20501);
  assert.equal(calls.at(-1), 20500);
});

test("calculation pagination fails rather than returning partial money or stock totals", async () => {
  const rows = Array.from({length: 1001}, (_, id) => ({id}));
  const query = () => ({range: async (from, to) => ({data: rows.slice(from, to + 1), error: null})});
  await assert.rejects(readReportQuery(query, 1000), /REPORT_TOO_LARGE/);
  await assert.rejects(readReportQuery(() => ({range: async from => from ? {data: null, error: {message: "read failed"}} : {data: rows.slice(0, 500), error: null}})), /read failed/);
});
