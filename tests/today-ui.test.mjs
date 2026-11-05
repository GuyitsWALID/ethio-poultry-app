import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/app/today/page.tsx", import.meta.url), "utf8");
const screen = await readFile(new URL("../src/components/today/today-workspace-screen.tsx", import.meta.url), "utf8");
const birdCheck = await readFile(new URL("../src/components/today/bird-check-card.tsx", import.meta.url), "utf8");
const healthForm = await readFile(new URL("../src/components/today/health-task-form.tsx", import.meta.url), "utf8");
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
  for (const command of ["save_daily_record", "save_feed_session", "close_feed_day", "record_stock_receipt", "record_sale", "record_expense", "update_assigned_action", "finish_operating_day"]) assert.match(embeddedTasks, new RegExp(command));
  for (const command of ["save_daily_record", "record_health_event", "complete_vaccination", "confirm_no_activity"]) assert.match(healthForm, new RegExp(command));
});

test("Today provides a simple farm, house, flock, and seven-day date flow", () => {
  assert.match(screen, /useFarmScope/);
  assert.match(screen, /\/api\/farm-manager\/today\/farms/);
  assert.match(screen, /setUTCDate\(value\.getUTCDate\(\) - 6\)/);
  assert.match(screen, /<OperationDateInput min=\{earliestEditableDate\(today\)\} max=\{today\}/);
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

test("Check birds starts the record and health owns routine losses", () => {
  assert.match(screen, /<BirdCheckCard/);
  assert.match(birdCheck, /assessBirdCheck/);
  assert.match(birdCheck, /usages: null/);
  assert.doesNotMatch(birdCheck, /<input type="number"/);
  assert.match(birdCheck, /initial\.deaths/);
  assert.match(birdCheck, /initial\.culls/);
  assert.match(healthForm, /type="checkbox"/);
  assert.match(healthForm, /_today_bird_loss/);
  assert.match(healthForm, /expected_resource_revision/);
});

test("successful saves advance and Review blocks unsafe closure", () => {
  assert.match(screen, /sequence\.slice\(Math\.max\(0, currentIndex \+ 1\)\)/);
  assert.match(screen, /reviewTasks=\{reviewTasks\}/);
  assert.match(screen, /contextLabel:\s*flock\.code/);
  assert.match(embeddedTasks, /reviewCompleted/);
  assert.match(embeddedTasks, /reviewMissing/);
  assert.match(embeddedTasks, /reviewUnsynced/);
  assert.match(embeddedTasks, /reviewProblems/);
  assert.match(embeddedTasks, /reviewConflicts/);
  assert.match(embeddedTasks, /reviewRejected/);
  assert.match(embeddedTasks, /finishCommandId\.current/);
  assert.match(embeddedTasks, /!online\|\|!canFinish/);
});

test("the application shell gives Today its own readable title", () => {
  assert.match(shell, /\["\/app\/today", "today", "groups\.farmOperations"\]/);
});
