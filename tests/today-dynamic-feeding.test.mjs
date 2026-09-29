import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";

const detail = await readFile(new URL("../src/lib/today-workspace/task-details.ts", import.meta.url), "utf8");
const card = await readFile(new URL("../src/components/today/embedded-task-card.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260929000000_today_dynamic_feeding.sql", import.meta.url), "utf8");

test("Today returns actual feed sessions without inventing two fixed sessions", () => {
  const feeding = detail.slice(detail.indexOf('if (task === "feeding")'), detail.indexOf('if (["birds"'));
  assert.match(feeding, /sessions,\s*scheduledFeedType/);
  assert.doesNotMatch(feeding, /session_name: "Morning"|session_name: "Afternoon"/);
});

test("Today adds any number of feedings and uses native status checkboxes", () => {
  const feeding = card.slice(card.indexOf("function FeedingForm"), card.indexOf("function SuppliesForm"));
  assert.match(feeding, /setEditingId\("new"\)/);
  assert.match(feeding, /t\("addFeeding"\)/);
  assert.match(feeding, /type="checkbox" checked=\{status === choice\}/);
  assert.match(feeding, /title=\{t\(choice === "completed" \? "fedHelp" : "missedHelp"\)\}/);
  assert.doesNotMatch(feeding, /role="tablist"|role="tab"/);
  assert.match(feeding, /result\?\.status === "applied"/);
});

test("a documented missed feeding does not block close or deduct stock", () => {
  assert.match(migration, /status = 'missed' and nullif\(btrim\(notes\), ''\) is null/);
  assert.match(migration, /sum\(actual_feed_kg\)/);
  assert.match(migration, /actual_feed_kg > 0/);
});
