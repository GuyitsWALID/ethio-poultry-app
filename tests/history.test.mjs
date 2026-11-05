import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {buildHistoryHref, historyCategories, historyCorrectionHref, historyCursor, historyPeriod, mergeHistoryPages, parseHistoryCursor, parseHistoryInput, safeHistoryReturn} from "../src/lib/history/contracts.ts";
import {historyFields, historySources, sourceColumns} from "../src/lib/history/sources.ts";

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = parseHistoryInput(new URLSearchParams({from: "2026-09-01", to: "2026-10-17"}));
test("history validates dates, source scopes and cursor/filter binding", () => {
  for (const query of ["category=unknown", "from=2026-02-30", "from=2026-11-01&to=2026-10-01", "farm_id=x),org_id.neq.null"]) assert.throws(() => parseHistoryInput(new URLSearchParams(query)));
  const cursor = historyCursor(input, {date: "2026-10-01", kind: "daily_record", id: uuid(1), context: "እርሻ", summary: [{value: "private notes"}]});
  assert.equal(parseHistoryCursor(cursor, input, ["daily_record"]).id, uuid(1));
  assert.ok(!atob(cursor.replaceAll("-", "+").replaceAll("_", "/")).includes("private notes"));
  assert.throws(() => parseHistoryCursor(cursor, {...input, farm: uuid(2)}, ["daily_record"]));
  assert.throws(() => parseHistoryCursor(cursor, input, ["sale"]));
  assert.throws(() => parseHistoryCursor("!bad!", input, ["daily_record"]));
});
test("history defaults use 30 inclusive Addis days across UTC midnight and leap days", () => {
  assert.deepEqual(historyPeriod(30, new Date("2026-10-16T21:30:00Z")), {from: "2026-09-18", to: "2026-10-17"});
  assert.deepEqual(historyPeriod(7, new Date("2024-03-01T10:00:00Z")), {from: "2024-02-24", to: "2024-03-01"});
});
test("multi-source pages sort deterministically and do not claim a partial total", () => {
  const pages = ["daily_record", "loss_record"].map(kind => Array.from({length: 51}, (_, i) => ({kind, id: uuid(100-i), date: "2026-10-01", context: "farm", status: "recorded", summary: []})));
  const page = mergeHistoryPages(input, pages);
  assert.equal(page.items.length, 50); assert.equal(page.items[0].kind, "loss_record");
  assert.equal(page.items[0].id, uuid(100)); assert.ok(page.nextCursor);
  assert.equal(mergeHistoryPages(input, [[]]).nextCursor, null);
});
test("correction handoffs keep exact identities and safe return URLs in both steps", () => {
  const back = buildHistoryHref({...input, flock: uuid(2)}, {kind: "daily_record", id: uuid(3)});
  assert.equal(safeHistoryReturn(back), back);
  for (const bad of ["//evil.test/app/history", "https://evil.test/app/history", "/app/history-other", "/app/history?next=https://evil.test", "/app/history#script"]) assert.equal(safeHistoryReturn(bad), null);
  const destination = new URL(historyCorrectionHref(`/app/governance?source_id=${uuid(3)}&correction_route=${encodeURIComponent(`/app/daily-records?record=${uuid(3)}`)}`, back), "https://test.invalid");
  assert.equal(destination.searchParams.get("source_id"), uuid(3));
  assert.equal(destination.searchParams.get("history_return"), back);
  const correction = new URL(destination.searchParams.get("correction_route"), destination.origin);
  assert.equal(correction.searchParams.get("record"), uuid(3)); assert.equal(correction.searchParams.get("history_return"), back);
  assert.equal(historyCorrectionHref("https://evil.test/app/governance", back), null);
});
test("catalogue covers every category, explicit fields and genuine zero/missing values", () => {
  assert.deepEqual(new Set(historySources.map(source => source.category)), new Set(historyCategories));
  assert.equal(new Set(historySources.map(source => source.kind)).size, historySources.length);
  for (const source of historySources) {assert.ok(!sourceColumns(source).includes("*")); assert.ok(!source.fields.some(field => /(^id$|_id$|_by$|org_id)/.test(field.key)));}
  const source = historySources.find(s => s.kind === "loss_record");
  const fields = historyFields(source, {deaths: 0, culls: null, opening_birds: "100", closing_birds: "invalid"});
  assert.equal(fields.find(f => f.key === "deaths").value, 0); assert.equal(fields.find(f => f.key === "culls").value, null);
  assert.equal(fields.find(f => f.key === "opening_birds").value, 100); assert.equal(fields.find(f => f.key === "closing_birds").value, null);
});
test("English and Amharic cover every History field, kind, category and control", async () => {
  const en = JSON.parse(await readFile(new URL("../messages/en.json", import.meta.url), "utf8"));
  const am = JSON.parse(await readFile(new URL("../messages/am.json", import.meta.url), "utf8"));
  const keys = (value, prefix="") => Object.entries(value).flatMap(([key, child]) => typeof child === "object" ? keys(child, `${prefix}${key}.`) : [`${prefix}${key}`]).sort();
  assert.deepEqual(keys(en.History), keys(am.History));
  for (const language of [en, am]) for (const source of historySources) {
    assert.ok(language.History.kinds[source.kind]); assert.ok(language.History.categories[source.category]);
    for (const field of source.fields) assert.ok(language.History.fields[field.key], field.key);
  }
});
