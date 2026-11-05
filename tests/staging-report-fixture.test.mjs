import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import fixture from "./fixtures/staging-reports.json" with {type: "json"};
import {reportTimestampBounds} from "../src/lib/report-safety.ts";

test("populated staging acceptance pins a verified historical operating period", () => {
  assert.equal(fixture.organizationName, "Laba Poultry Farms");
  assert.equal(fixture.managerFarmName, "Duo");
  assert.doesNotThrow(() => reportTimestampBounds(fixture.dateFrom, fixture.dateTo));
  assert.equal((Date.parse(fixture.dateTo) - Date.parse(fixture.dateFrom)) / 86400000 + 1, 90);
});

test("the browser gate rejects wrong tenants, avoids arbitrary first farms and keeps positive egg evidence mandatory", async () => {
  const source = await readFile(new URL("./browser/report-staging.spec.ts", import.meta.url), "utf8");
  assert.match(source, /context.orgName[\s\S]*?toBe\(fixture.organizationName\)/);
  assert.match(source, /farm.name === fixture.managerFarmName/);
  assert.match(source, /dateFrom: fixture.dateFrom, dateTo: to/);
  assert.doesNotMatch(source, /new Date\(\)|options.farms\[0\]/);
  assert.match(source, /Populated staging egg evidence is required.*toBeGreaterThan\(0\)/);
});
