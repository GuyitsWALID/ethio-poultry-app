import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOfflineStore } from "../src/lib/today-workspace/offline-store.ts";
import { readyCommands, syncOutbox } from "../src/lib/today-workspace/sync.ts";

const command = (id, depends_on = []) => ({ schema_version: 1, command_id: id, type: "save_feed_session", farm_id: "farm", flock_id: "flock", work_date: "2026-09-21", depends_on, payload: { session_id: id, quantity_kg: 1 } });
const queued = (id, depends = [], time = id) => ({ command: command(id, depends), state: "queued", queuedAt: time });

test("commands wait until their dependencies leave the outbox", () => {
  assert.deepEqual(readyCommands([queued("session"), queued("close", ["session"]) ]).map((item) => item.command.command_id), ["session"]);
});

test("successful dependencies apply before their dependent command", async () => {
  const store = new MemoryOfflineStore();
  await store.putCommand(queued("session", [], "1"));
  await store.putCommand(queued("close", ["session"], "2"));
  const sent = [];
  const summary = await syncOutbox(store, async (value) => { sent.push(value.command_id); return { command_id: value.command_id, status: "applied" }; });
  assert.deepEqual(sent, ["session", "close"]);
  assert.deepEqual(summary.applied, ["session", "close"]);
});

test("conflicts remain stored and block dependent work", async () => {
  const store = new MemoryOfflineStore();
  await store.putCommand(queued("session", [], "1"));
  await store.putCommand(queued("close", ["session"], "2"));
  const summary = await syncOutbox(store, async (value) => ({ command_id: value.command_id, status: "conflict", error_code: "RESOURCE_CONFLICT" }));
  assert.deepEqual(summary.conflicts, ["session"]);
  assert.deepEqual(summary.blocked, ["close"]);
});
