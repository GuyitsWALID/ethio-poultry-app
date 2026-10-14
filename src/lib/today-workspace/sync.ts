import type { TodayCommandResult } from "./contracts.ts";
import type { OfflineStore, QueuedCommand } from "./offline-store.ts";
import {finishIssueFromResult} from "./finish-review.ts";

export type CommandSender = (command: QueuedCommand["command"]) => Promise<TodayCommandResult>;
export type SyncSummary = { applied: string[]; conflicts: string[]; rejected: string[]; blocked: string[]; deferred: string[]; offline: boolean; authorizationRequired: boolean; nextRetryAt?: string };
export class SyncAuthenticationError extends Error {
  constructor() { super("AUTH_REQUIRED"); }
}
const activeSyncs = new WeakMap<OfflineStore, Promise<SyncSummary>>();

export function retryDelay(attempts: number) {
  return Math.min(300_000, 1000 * 2 ** Math.min(9, Math.max(0, attempts - 1)));
}

export function readyCommands(queue: QueuedCommand[], now = Date.now()) {
  const pending = new Set(queue.map((item) => item.command.command_id));
  return queue.filter((item) => item.state === "queued" && (!item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= now) && (item.command.depends_on ?? []).every((id) => !pending.has(id)));
}

export function syncOutbox(store: OfflineStore, send: CommandSender, now: () => number = Date.now, onApplied?: (entry: QueuedCommand) => Promise<void>): Promise<SyncSummary> {
  const active = activeSyncs.get(store);
  if (active) return active;
  const run = performSync(store, send, now, onApplied).finally(() => activeSyncs.delete(store));
  activeSyncs.set(store, run);
  return run;
}

async function performSync(store: OfflineStore, send: CommandSender, now: () => number, onApplied?: (entry: QueuedCommand) => Promise<void>): Promise<SyncSummary> {
  const summary: SyncSummary = { applied: [], conflicts: [], rejected: [], blocked: [], deferred: [], offline: false, authorizationRequired: false };
  let queue = await store.listCommands();
  // The receipt on the server resolves an ambiguous interrupted send. Never
  // generate a new command ID when recovering after a browser/process restart.
  for (const item of queue.filter((item) => item.state === "sending")) {
    await store.putCommand({...item, state: "queued"});
  }
  queue = await store.listCommands();

  while (queue.some((item) => item.state === "queued")) {
    const ready = readyCommands(queue, now());
    if (ready.length === 0) {
      for (const item of queue.filter((item) => item.state === "queued")) {
        if (item.nextAttemptAt && Date.parse(item.nextAttemptAt) > now()) {
          summary.deferred.push(item.command.command_id);
          if (!summary.nextRetryAt || item.nextAttemptAt < summary.nextRetryAt) summary.nextRetryAt = item.nextAttemptAt;
        } else summary.blocked.push(item.command.command_id);
      }
      break;
    }

    for (const item of ready) {
      await store.putCommand({ ...item, state: "sending" });
      let result: TodayCommandResult;
      try {
        result = await send(item.command);
        if (result.command_id !== item.command.command_id || !["applied", "conflict", "rejected"].includes(result.status)) throw new Error("INVALID_SYNC_RESULT");
      } catch (error) {
        if (error instanceof SyncAuthenticationError) {
          await store.putCommand({...item, state: "queued"});
          summary.authorizationRequired = true;
          return summary;
        }
        const attempts = (item.attempts ?? 0) + 1;
        const nextAttemptAt = new Date(now() + retryDelay(attempts)).toISOString();
        await store.putCommand({ ...item, state: "queued", attempts, nextAttemptAt });
        summary.offline = true;
        if (!summary.nextRetryAt || nextAttemptAt < summary.nextRetryAt) summary.nextRetryAt = nextAttemptAt;
        continue;
      }
      // Persistence failure is a blocking recovery problem, not a network
      // retry. Leave the command recoverable and never report a false success.
      if (result.status === "applied") {
        // Keep the same command recoverable until local draft cleanup succeeds.
        await onApplied?.(item);
        await store.removeCommand(item.command.command_id);
        summary.applied.push(item.command.command_id);
      } else {
        await store.putCommand({ ...item, state: result.status, result });
        summary[result.status === "conflict" ? "conflicts" : "rejected"].push(item.command.command_id);
      }
    }
    // A failed independent command must not prevent successful dependencies
    // from advancing. Backoff excludes the failed command on the next pass.
    queue = await store.listCommands();
  }
  return summary;
}

export async function sendTodayCommand(command: QueuedCommand["command"]): Promise<TodayCommandResult> {
  const response = await fetch("/api/farm-manager/today/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (response.status === 401) throw new SyncAuthenticationError();
  const result = await response.json() as TodayCommandResult;
  if (!response.ok && !result.status) throw new Error("SYNC_UNAVAILABLE");
  const issue = finishIssueFromResult(result);
  if (issue && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ethiopoultry:today-command-issue", {detail: issue}));
  }
  return result;
}

export async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration?.active) return false;
  const withSync = registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } };
  if (!withSync.sync) return false;
  await withSync.sync.register("ethiopoultry-today-outbox");
  return true;
}
