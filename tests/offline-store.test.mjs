import assert from "node:assert/strict";
import test from "node:test";
import { identityNamespace, MemoryOfflineStore, OFFLINE_STORE_VERSION } from "../src/lib/today-workspace/offline-store.ts";

const identity = { tenantId: "tenant/a", userId: "user:b", authorizedWorkDate: "2026-09-21" };

test("offline namespaces isolate tenant and user identities", () => {
  assert.equal(identityNamespace(identity), "ethiopoultry-offline-tenant_a-user_b");
  assert.notEqual(identityNamespace(identity), identityNamespace({ ...identity, userId: "other" }));
  assert.equal(OFFLINE_STORE_VERSION, 1);
});

test("memory adapter preserves ordered outbox commands and supports cleanup", async () => {
  const store = new MemoryOfflineStore();
  const command = { schema_version: 1, command_id: "one", type: "confirm_no_activity", farm_id: "farm", flock_id: "flock", work_date: "2026-09-21", payload: { task: "health", source_fingerprint: "abc" } };
  await store.putCommand({ command, state: "queued", queuedAt: "2026-09-21T08:00:00Z" });
  assert.equal((await store.listCommands())[0].command.command_id, "one");
  await store.clear();
  assert.deepEqual(await store.listCommands(), []);
});

test("drafts survive reads until explicitly removed", async () => {
  const store = new MemoryOfflineStore();
  const draft = { key: "farm:flock:birds", taskId: "birds", workDate: "2026-09-21", value: { closing: 100 }, updatedAt: "2026-09-21T08:00:00Z" };
  await store.putDraft(draft);
  assert.deepEqual(await store.getDraft(draft.key), draft);
  await store.removeDraft(draft.key);
  assert.equal(await store.getDraft(draft.key), undefined);
});
