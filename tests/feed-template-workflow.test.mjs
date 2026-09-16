import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const controlRoute = await readFile(new URL("../src/app/api/feed/control/route.ts", import.meta.url), "utf8");
const templateRoute = await readFile(new URL("../src/app/api/feed/templates/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../src/app/app/feeding-log/page.tsx", import.meta.url), "utf8");

test("feed template exceptions expose a stable actionable destination", () => {
  assert.match(controlRoute, /actionTarget: "template_management"/);
  assert.match(page, /target === "template_management"/);
  assert.match(page, /openFeedAction\(item\.actionTarget!\)/);
  assert.match(page, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(page, /id="feed-template-management"/);
});

test("session and history exceptions open their exact Feed Control sections", () => {
  assert.match(controlRoute, /actionTarget: "today_sessions"/);
  assert.match(controlRoute, /actionTarget: "feed_history"/);
  assert.match(page, /id="today-feed-sessions"/);
  assert.match(page, /id="feed-history"/);
  assert.match(page, /target === "feed_history"/);
  assert.match(page, /querySelector\("details"\)\?\.setAttribute\("open", ""\)/);
  assert.match(page, /onClick=\{\(\) => openFeedAction\(item\.actionTarget!\)\}/);
});

test("farm manager template changes are described as governed proposals", () => {
  assert.match(templateRoute, /submitGovernanceRequest/);
  assert.match(page, /Submit template for CEO approval/);
  assert.match(page, /The active feed plan has not changed yet/);
  assert.match(page, /The active feed plan changes only after approval/);
  assert.match(controlRoute, /!ctx\.canManage \? "read_only"/);
  assert.match(page, /Executive evidence view/);
});

test("template submission feedback is visible and accessible", () => {
  assert.match(page, /role=\{feedback\.tone === "error" \? "alert" : "status"\}/);
  assert.match(page, /setFeedback\(\{ tone: "error", text \}\)/);
  assert.match(page, /setFeedback\(\{ tone: "success", text \}\)/);
});
