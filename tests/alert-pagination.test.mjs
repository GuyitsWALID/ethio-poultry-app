import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {allAlertRows, actionReadFilter} from "../src/lib/alert-pagination.ts";

test("source paging collects all pages, including an exactly full final page", async () => {
  const calls = [];
  const rows = await allAlertRows(async (from, to) => {calls.push([from, to]); return {data: [1,2,3,4].slice(from,to+1),error:null};},2,4);
  assert.deepEqual(rows,[1,2,3,4]); assert.deepEqual(calls,[[0,1],[2,3],[4,4]]);
});
test("failed or oversized scans reject rather than presenting partial evidence", async () => {
  await assert.rejects(allAlertRows(async from => ({data: from ? null : [1,2],error: from ? {message:"failed"}:null}),2,4), /could not check/);
  await assert.rejects(allAlertRows(async (from,to) => ({data:[1,2,3,4,5].slice(from,to+1),error:null}),2,4), /source limit/);
});
test("cursor and assignment predicates remain intersected, including empty scope", () => {
  const scope={farms:new Set(["farm"]),warehouses:new Set(["store"])};
  assert.equal(actionReadFilter(scope,{priority:1,dueAt:"2026-10-17T12:00:00Z",id:"id"}),"and(or(farm_id.in.(farm),warehouse_id.in.(store)),or(inbox_priority.gt.1,and(inbox_priority.eq.1,or(due_at.gt.2026-10-17T12:00:00Z,and(due_at.eq.2026-10-17T12:00:00Z,id.gt.id)))))");
  assert.equal(actionReadFilter({farms:new Set(),warehouses:new Set()}),"and(id.eq.00000000-0000-0000-0000-000000000000)");
  assert.equal(actionReadFilter({farms:null,warehouses:null}),null);
});
test("bell is read-only and omits history/owner option loading; refresh is explicit", async () => {
  const header=await readFile(new URL("../src/app/api/alerts/header/route.ts",import.meta.url),"utf8");
  const service=await readFile(new URL("../src/lib/accountable-actions.ts",import.meta.url),"utf8");
  const api=await readFile(new URL("../src/app/api/alerts/actions/route.ts",import.meta.url),"utf8");
  assert.match(header,/loadActionDesk\(context, \{header: true\}\)/);
  assert.match(header,/private, no-store/);
  const read=service.slice(service.indexOf("export async function loadActionDesk"),service.indexOf("export async function ensureReconciliationAction"));
  assert.doesNotMatch(read,/collectOperationalAlerts|synchronize\(/);
  assert.match(read,/options.header \? \[\] : await ownerOptions/);
  assert.match(read,/limit\(8, \{referencedTable/);
  assert.match(api,/export async function POST/);
  assert.doesNotMatch(api.slice(api.indexOf("export async function GET"),api.indexOf("export async function POST")),/refreshActionDesk\(/);
});
