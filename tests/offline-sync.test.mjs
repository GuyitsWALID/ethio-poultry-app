import assert from "node:assert/strict";
import test from "node:test";
import { MemoryOfflineStore } from "../src/lib/today-workspace/offline-store.ts";
import { readyCommands, retryDelay, syncOutbox, SyncAuthenticationError } from "../src/lib/today-workspace/sync.ts";

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

test("interrupted sends replay the same command identity", async () => {
  const store = new MemoryOfflineStore();
  await store.putCommand({...queued("interrupted"), state: "sending"});
  const seen = [];
  const result = await syncOutbox(store, async value => {
    seen.push(value.command_id);
    return {command_id: value.command_id, status: "applied"};
  });
  assert.deepEqual(seen, ["interrupted"]);
  assert.deepEqual(result.applied, ["interrupted"]);
  assert.deepEqual(await store.listCommands(), []);
});

test("retry backoff survives another synchronization attempt", async () => {
  const store = new MemoryOfflineStore();
  await store.putCommand(queued("retry"));
  let clock = Date.parse("2026-10-10T09:00:00Z");
  let calls = 0;
  const send = async () => { calls++; throw new Error("disconnected"); };
  const first = await syncOutbox(store, send, () => clock);
  assert.equal(first.offline, true);
  assert.equal((await store.listCommands())[0].attempts, 1);
  assert.equal(first.nextRetryAt, "2026-10-10T09:00:01.000Z");
  await syncOutbox(store, send, () => clock);
  assert.equal(calls, 1);
  clock += 1000;
  await syncOutbox(store, send, () => clock);
  assert.equal(calls, 2);
  assert.equal((await store.listCommands())[0].nextAttemptAt, "2026-10-10T09:00:03.000Z");
  assert.equal(retryDelay(50), 300_000);
});

test("an independent retry does not starve successful dependent work", async () => {
  const store = new MemoryOfflineStore();
  for (const row of [queued("failed", [], "1"), queued("session", [], "2"), queued("close", ["session"], "3")]) await store.putCommand(row);
  const result = await syncOutbox(store, async value => {
    if (value.command_id === "failed") throw new Error("temporary failure");
    return {command_id: value.command_id, status: "applied"};
  });
  assert.deepEqual(result.applied, ["session", "close"]);
  assert.deepEqual(result.deferred, ["failed"]);
  assert.equal((await store.listCommands()).length, 1);
});

test("expired sessions pause the queue without discarding work", async () => {
  const store = new MemoryOfflineStore();
  await store.putCommand(queued("first", [], "1"));
  await store.putCommand(queued("second", [], "2"));
  let calls = 0;
  const result = await syncOutbox(store, async () => { calls++; throw new SyncAuthenticationError(); });
  assert.equal(result.authorizationRequired, true);
  assert.equal(calls, 1);
  assert.deepEqual((await store.listCommands()).map(row => row.state), ["queued", "queued"]);
});

test("simultaneous foreground triggers share one drain", async () => {
  const store = new MemoryOfflineStore();
  await store.putCommand(queued("once"));
  let calls = 0;
  const send = async value => { calls++; return {command_id: value.command_id, status: "applied"}; };
  await Promise.all([syncOutbox(store, send), syncOutbox(store, send)]);
  assert.equal(calls, 1);
});

test("invalid server result cannot remove the local command", async () => {
  const store = new MemoryOfflineStore();
  await store.putCommand(queued("keep"));
  await syncOutbox(store, async () => ({command_id: "different", status: "applied"}));
  const rows = await store.listCommands();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].command.command_id, "keep");
  assert.equal(rows[0].state, "queued");
});

test("a storage failure after server application blocks recovery without losing the command", async () => {
  const store = new MemoryOfflineStore();
  await store.putCommand(queued("preserve"));
  store.removeCommand = async () => { throw Error("storage unavailable"); };
  await assert.rejects(syncOutbox(store, async value => ({command_id:value.command_id,status:"applied"})), /storage unavailable/);
  const rows = await store.listCommands();
  assert.equal(rows[0].command.command_id, "preserve");
  assert.equal(rows[0].state, "sending");
});
