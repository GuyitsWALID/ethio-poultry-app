import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/app/today/page.tsx", import.meta.url), "utf8");
const screen = await readFile(new URL("../src/components/today/today-workspace-screen.tsx", import.meta.url), "utf8");
const birdCheck = await readFile(new URL("../src/components/today/bird-check-card.tsx", import.meta.url), "utf8");
const embeddedTasks = await readFile(new URL("../src/components/today/embedded-task-card.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const assignedFarmsRoute = await readFile(new URL("../src/app/api/farm-manager/today/farms/route.ts", import.meta.url), "utf8");

test("Today is a dedicated route backed by the authorized workspace endpoint", () => {
  assert.match(page, /TodayWorkspaceScreen/);
  assert.match(screen, /\/api\/farm-manager\/today\?/);
  assert.match(screen, /cache:\s*"no-store"/);
  assert.doesNotMatch(screen, /createBrowserClient|\.from\(|supabase/);
});

test("Today preserves the feature-flag fallback while routine work stays embedded", () => {
  assert.match(screen, /FEATURE_DISABLED/);
  assert.match(screen, /href="\/app\/farm-manager"/);
  assert.match(screen, /<EmbeddedTaskCard/);
  assert.doesNotMatch(screen, /taskRoutes|Open task/);
  assert.match(embeddedTasks, /\/api\/farm-manager\/today\/tasks\/\$\{task\.code\}/);
  for (const command of ["save_daily_record", "save_feed_session", "close_feed_day", "record_health_event", "record_mortality_event", "record_stock_receipt", "record_sale", "record_expense", "update_assigned_action", "finish_operating_day"]) assert.match(embeddedTasks, new RegExp(command));
});

test("Today provides a simple farm, house, flock, and seven-day date flow", () => {
  assert.match(screen, /useFarmScope/);
  assert.match(screen, /\/api\/farm-manager\/today\/farms/);
  assert.match(screen, /setUTCDate\(value\.getUTCDate\(\) - 6\)/);
  assert.match(screen, /type="date" min=\{earliestEditableDate\(today\)\} max=\{today\}/);
  assert.match(screen, /t\("house"\)/);
  assert.match(screen, /t\("chooseHouse"\)/);
  assert.match(screen, /flock\.house_id === houseId/);
  assert.match(screen, /workspace:\$\{name\}/);
  assert.match(screen, /availableFlocks\.map/);
});

test("Today has a narrow non-cacheable assignment fallback and does not mislabel load failures", () => {
  assert.match(assignedFarmsRoute, /user_farm_access/);
  assert.match(assignedFarmsRoute, /revoked_at/);
  assert.match(assignedFarmsRoute, /Cache-Control.*private, no-store/);
  assert.match(screen, /assignmentLoadFailed/);
  assert.match(screen, /t\("loadFailed"\)/);
  assert.match(screen, /assignedFarms/);
});

test("Today meets the first tablet interaction and accessibility contract", () => {
  assert.match(screen, /sm:grid-cols/);
  assert.match(screen, /lg:grid-cols/);
  assert.match(screen, /min-h-11/);
  assert.match(screen, /min-h-12/);
  assert.match(embeddedTasks, /focus-visible:outline/);
  assert.doesNotMatch(`${screen}\n${embeddedTasks}`, /<table|overflow-x-auto/);
});

test("Check birds is a focused safe save rather than another large Daily Record form", () => {
  assert.match(screen, /<BirdCheckCard/);
  assert.match(birdCheck, /assessBirdCheck/);
  assert.match(birdCheck, /usages: null/);
  assert.match(birdCheck, /expected_resource_revision/);
  assert.match(birdCheck, /inputMode=\{field\.decimal \? "decimal" : "numeric"\}/);
  assert.match(birdCheck, /correction_destination/);
  assert.match(birdCheck, /setDirty\(true\)/);
  assert.match(birdCheck, /states\.draft/);
});

test("successful saves advance and Review blocks unsafe closure", () => {
  assert.match(screen, /sequence\.slice\(Math\.max\(0, currentIndex \+ 1\)\)/);
  assert.match(screen, /reviewTasks=\{required\.filter/);
  assert.match(embeddedTasks, /reviewCompleted/);
  assert.match(embeddedTasks, /reviewMissing/);
  assert.match(embeddedTasks, /reviewUnsynced/);
  assert.match(embeddedTasks, /reviewProblems/);
  assert.match(embeddedTasks, /!online\|\|!canFinish/);
});

test("the application shell gives Today its own readable title", () => {
  assert.match(shell, /\["\/app\/today", "today", "groups\.farmOperations"\]/);
});
