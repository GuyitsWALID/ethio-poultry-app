import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/api/flocks/workspace/route.ts", import.meta.url), "utf8");
const flocksPage = await readFile(new URL("../src/app/app/flocks/page.tsx", import.meta.url), "utf8");
const batchesPage = await readFile(new URL("../src/app/app/batches/page.tsx", import.meta.url), "utf8");
const cycleWorkspace = await readFile(new URL("../src/components/flocks/cycle-workspace.tsx", import.meta.url), "utf8");

test("flock workspace reads through tenant and active farm assignment scope", () => {
  assert.match(route, /getAccessContext\(\{ tenant: true \}\)/);
  assert.match(route, /user_farm_access/);
  assert.match(route, /is\("revoked_at", null\)/);
  assert.match(route, /\.in\("farm_id", queryFarmIds\)/);
});

test("flock and batch screens use the authorized workspace instead of direct browser reads", () => {
  assert.match(flocksPage, /fetch\("\/api\/flocks\/workspace"/);
  assert.doesNotMatch(flocksPage, /\.from\("flocks"\)/);
  assert.match(batchesPage, /<CycleWorkspace/);
  assert.match(cycleWorkspace, /\/api\/flocks\/cycles\/context/);
  assert.doesNotMatch(cycleWorkspace, /\.from\("(flocks|batches)"\)/);
  assert.doesNotMatch(batchesPage, /create_branch_batch_cycle|New chicks/);
});

test("workspace reports load failures rather than silently rendering an empty register", () => {
  assert.match(flocksPage, /setError\(loadError instanceof Error/);
  assert.match(cycleWorkspace, /setFailure\(response.status === 404 \? "unavailable" : "loadFailed"\)/);
  assert.match(cycleWorkspace, /role="alert"/);
});

test("shared-cycle grouping preserves canonical batch identity and authorized clearance evidence", () => {
  assert.match(route, /batch_cycle_clearances/);
  assert.match(route, /flock.batch_cycle_id = cycle\?\.id/);
  assert.match(route, /SOURCE_LIMIT/);
  assert.match(flocksPage, /row.batch_cycle_id\?\?row.batch_id/);
});

test("approved moves retain only the authorized flock's linked placement metadata", () => {
  assert.match(route, /const linkedBatchIds = .*flocks\.map/);
  assert.match(route, /\.in\("id", linkedBatchIds\)/);
  assert.match(route, /flock\.canonical_batch = placement/);
  assert.match(route, /rpc\("verified_flock_movements"/);
  assert.match(flocksPage, /row\.canonical_batch/);
  assert.match(flocksPage, /selectedFlock\.verified_movement_chain/);
  assert.doesNotMatch(flocksPage, /move this flock to the batch’s recorded location|Align flock/);
});
