import type { TodayCommandResult } from "./contracts.ts";
import type { OfflineStore, QueuedCommand } from "./offline-store.ts";

export type CommandSender = (command: QueuedCommand["command"]) => Promise<TodayCommandResult>;
export type SyncSummary = { applied: string[]; conflicts: string[]; rejected: string[]; blocked: string[]; offline: boolean };

export function readyCommands(queue: QueuedCommand[]) {
  const pending = new Set(queue.map((item) => item.command.command_id));
  return queue.filter((item) => item.state === "queued" && (item.command.depends_on ?? []).every((id) => !pending.has(id)));
}

export async function syncOutbox(store: OfflineStore, send: CommandSender): Promise<SyncSummary> {
  const summary: SyncSummary = { applied: [], conflicts: [], rejected: [], blocked: [], offline: false };
  let queue = await store.listCommands();

  while (queue.some((item) => item.state === "queued")) {
    const ready = readyCommands(queue);
    if (ready.length === 0) {
      summary.blocked.push(...queue.filter((item) => item.state === "queued").map((item) => item.command.command_id));
      break;
    }

    for (const item of ready) {
      await store.putCommand({ ...item, state: "sending" });
      try {
        const result = await send(item.command);
        if (result.status === "applied") {
          summary.applied.push(item.command.command_id);
          await store.removeCommand(item.command.command_id);
        } else {
          summary[result.status === "conflict" ? "conflicts" : "rejected"].push(item.command.command_id);
          await store.putCommand({ ...item, state: result.status, result });
        }
      } catch {
        summary.offline = true;
        await store.putCommand({ ...item, state: "queued" });
      }
    }
    if (summary.offline) break;
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
  const result = await response.json() as TodayCommandResult;
  if (!response.ok && !result.status) throw new Error("SYNC_UNAVAILABLE");
  return result;
}

export async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const withSync = registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } };
  if (!withSync.sync) return false;
  await withSync.sync.register("ethiopoultry-today-outbox");
  return true;
}
