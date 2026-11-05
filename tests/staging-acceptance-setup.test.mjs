import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {readPageFilters} from "../src/lib/page-filter-state.ts";

test("staging performance comparisons supply the UI's page-specific dates", async () => {
  const source = await readFile(new URL("./browser/report-staging.spec.ts", import.meta.url), "utf8");
  assert.match(source, /filter_page_dateFrom: input.dateFrom/);
  assert.match(source, /filter_page_dateTo: input.dateTo/);
  const values = readPageFilters("filter_view=1&filter_page_dateFrom=2026-07-27&filter_page_dateTo=2026-10-24", null);
  assert.equal(values.page_dateFrom, "2026-07-27");
  assert.equal(values.page_dateTo, "2026-10-24");
});

test("read-only localized staging checks align cookie, device and profile display preference", async () => {
  const source = await readFile(new URL("./browser/history-staging.spec.ts", import.meta.url), "utf8");
  assert.match(source, /localStorage.setItem\("ethiopoultry.preferred_locale", value\)/);
  assert.match(source, /preferredLocale: displayLocale/);
  assert.match(source, /name: "preferred_locale", value: locale/);
  assert.match(source, /toHaveAttribute\("lang", locale\)/);
  assert.doesNotMatch(source, /method: "PATCH"/);
});
