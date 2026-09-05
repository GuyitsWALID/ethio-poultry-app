import assert from "node:assert/strict";
import test from "node:test";
import { pageFilterStorageKey, readPageFilters, writePageFilters } from "../src/lib/page-filter-state.ts";

test("remembered filters are isolated by page, user, and organization", () => {
  const keys = [pageFilterStorageKey("org-a", "ceo", "/app/reports"), pageFilterStorageKey("org-a", "ceo", "/app/health"), pageFilterStorageKey("org-a", "manager", "/app/reports"), pageFilterStorageKey("org-b", "ceo", "/app/reports")];
  assert.equal(new Set(keys).size, 4);
});

test("explicit URL filters take precedence over saved device selections", () => {
  assert.deepEqual(readPageFilters("filter_farmId=farm-b&filter_page_status=open", JSON.stringify({farmId:"farm-a"})), {farmId:"farm-b",page_status:"open"});
});

test("an unfiltered shared URL does not resurrect a saved filter", () => {
  const search = writePageFilters("", {});
  assert.deepEqual(readPageFilters(search, JSON.stringify({farmId:"farm-a"})), {view:"1"});
});

test("alert and correction destinations ignore remembered restrictions", () => {
  for (const search of ["finding=check-a", "flock=flock-b&check=lineage", "source_id=record-a", "record=record-b", "authorization=approval-a"]) {
    assert.deepEqual(readPageFilters(search, JSON.stringify({farmId:"farm-a",page_tab:"closed",page_query:"unrelated"})), {});
  }
});

test("filter writes retain record context and unrelated query parameters", () => {
  const search = writePageFilters("finding=check-a&check=lineage&filter_page_query=old", {farmId:"farm-b",page_query:"Layer A"});
  const params = new URLSearchParams(search);
  assert.equal(params.get("finding"), "check-a");
  assert.equal(params.get("check"), "lineage");
  assert.equal(params.get("filter_page_query"), "Layer A");
  assert.equal(params.getAll("filter_page_query").length, 1);
});

test("invalid browser storage does not prevent workspace loading", () => {
  for (const saved of ["invalid json", "null", "[]", "42"]) assert.deepEqual(readPageFilters("", saved), {});
  assert.deepEqual(readPageFilters("", '{"farmId":"farm-a","unexpected":{"token":"hidden"}}'), {farmId:"farm-a"});
});

test("local dates and reporting dates round-trip independently", () => {
  const values = {preset:"mtd",dateFrom:"2026-09-01",dateTo:"2026-09-05",page_dateFrom:"2026-08-01",page_dateTo:"2026-08-31"};
  assert.deepEqual(readPageFilters(writePageFilters("", values), null), {view:"1",...values});
});
