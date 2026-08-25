import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/api/flocks/workspace/route.ts", import.meta.url), "utf8");
const flocksPage = await readFile(new URL("../src/app/app/flocks/page.tsx", import.meta.url), "utf8");
const batchesPage = await readFile(new URL("../src/app/app/batches/page.tsx", import.meta.url), "utf8");

test("flock workspace reads through tenant and active farm assignment scope", () => {
  assert.match(route, /getAccessContext\(\{ tenant: true \}\)/);
  assert.match(route, /user_farm_access/);
  assert.match(route, /is\("revoked_at", null\)/);
  assert.match(route, /\.in\("farm_id", queryFarmIds\)/);
});

test("flock and batch screens use the authorized workspace instead of direct browser reads", () => {
  assert.match(flocksPage, /fetch\("\/api\/flocks\/workspace"/);
  assert.doesNotMatch(flocksPage, /\.from\("flocks"\)/);
  assert.match(batchesPage, /fetch\("\/api\/flocks\/workspace"/);
  assert.doesNotMatch(batchesPage.slice(batchesPage.indexOf("const loadRows"), batchesPage.indexOf("const onEditBatch")), /\.from\("(flocks|batches)"\)/);
});

test("workspace reports load failures rather than silently rendering an empty register", () => {
  assert.match(flocksPage, /setError\(loadError instanceof Error/);
  assert.match(batchesPage, /Unable to load batch cycles/);
});
