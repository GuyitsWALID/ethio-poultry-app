import type { TodayCommand, TodayCommandResult, TodayWorkspace } from "./contracts.ts";

export const OFFLINE_STORE_VERSION = 1;
const ACTIVE_IDENTITY_KEY = "ethiopoultry.offline_identity";

export type OfflineIdentity = { tenantId: string; userId: string; authorizedWorkDate: string };
export type OfflineDraft = { key: string; taskId: string; workDate: string; value: unknown; updatedAt: string };
export type QueuedCommand = { command: TodayCommand; state: "queued" | "sending" | "conflict" | "rejected"; result?: TodayCommandResult; queuedAt: string };

export class OfflineStorageError extends Error {
  readonly code: "UNAVAILABLE" | "QUOTA" | "UPGRADE_FAILED";
  constructor(code: "UNAVAILABLE" | "QUOTA" | "UPGRADE_FAILED", message: string) {
    super(message);
    this.code = code;
  }
}

export interface OfflineStore {
  getSnapshot(key: string): Promise<TodayWorkspace | undefined>;
  putSnapshot(key: string, value: TodayWorkspace): Promise<void>;
  getDraft(key: string): Promise<OfflineDraft | undefined>;
  putDraft(value: OfflineDraft): Promise<void>;
  removeDraft(key: string): Promise<void>;
  listCommands(): Promise<QueuedCommand[]>;
  putCommand(value: QueuedCommand): Promise<void>;
  removeCommand(commandId: string): Promise<void>;
  clear(): Promise<void>;
}

export function identityNamespace(identity: OfflineIdentity) {
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `ethiopoultry-offline-${safe(identity.tenantId)}-${safe(identity.userId)}`;
}

export class MemoryOfflineStore implements OfflineStore {
  private snapshots = new Map<string, TodayWorkspace>();
  private drafts = new Map<string, OfflineDraft>();
  private commands = new Map<string, QueuedCommand>();
  async getSnapshot(key: string) { return this.snapshots.get(key); }
  async putSnapshot(key: string, value: TodayWorkspace) { this.snapshots.set(key, structuredClone(value)); }
  async getDraft(key: string) { return this.drafts.get(key); }
  async putDraft(value: OfflineDraft) { this.drafts.set(value.key, structuredClone(value)); }
  async removeDraft(key: string) { this.drafts.delete(key); }
  async listCommands() { return [...this.commands.values()].sort((a, b) => a.queuedAt.localeCompare(b.queuedAt)); }
  async putCommand(value: QueuedCommand) { this.commands.set(value.command.command_id, structuredClone(value)); }
  async removeCommand(commandId: string) { this.commands.delete(commandId); }
  async clear() { this.snapshots.clear(); this.drafts.clear(); this.commands.clear(); }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function storageFailure(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  return new OfflineStorageError(name === "QuotaExceededError" ? "QUOTA" : "UNAVAILABLE", error instanceof Error ? error.message : "Offline storage failed.");
}

class IndexedDbOfflineStore implements OfflineStore {
  private readonly database: IDBDatabase;
  constructor(database: IDBDatabase) { this.database = database; }
  private async read<T>(store: string, key: IDBValidKey) {
    return requestResult(this.database.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>;
  }
  private async write(store: string, value: unknown) {
    try {
      const transaction = this.database.transaction(store, "readwrite");
      transaction.objectStore(store).put(value);
      await transactionDone(transaction);
    } catch (error) { throw storageFailure(error); }
  }
  async getSnapshot(key: string) { return this.read<TodayWorkspace>("snapshots", key); }
  async putSnapshot(key: string, value: TodayWorkspace) { await this.write("snapshots", { ...value, key }); }
  async getDraft(key: string) { return this.read<OfflineDraft>("drafts", key); }
  async putDraft(value: OfflineDraft) { await this.write("drafts", value); }
  async removeDraft(key: string) { await this.remove("drafts", key); }
  async listCommands() {
    const rows = await requestResult(this.database.transaction("outbox").objectStore("outbox").getAll()) as QueuedCommand[];
    return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  }
  async putCommand(value: QueuedCommand) { await this.write("outbox", value); }
  async removeCommand(commandId: string) { await this.remove("outbox", commandId); }
  private async remove(store: string, key: IDBValidKey) {
    const transaction = this.database.transaction(store, "readwrite");
    transaction.objectStore(store).delete(key);
    await transactionDone(transaction);
  }
  async clear() {
    const transaction = this.database.transaction(["snapshots", "drafts", "outbox"], "readwrite");
    for (const store of ["snapshots", "drafts", "outbox"]) transaction.objectStore(store).clear();
    await transactionDone(transaction);
  }
}

export async function openOfflineStore(identity: OfflineIdentity): Promise<OfflineStore> {
  if (typeof indexedDB === "undefined" || typeof localStorage === "undefined") throw new OfflineStorageError("UNAVAILABLE", "Offline storage is not available in this browser.");
  const namespace = identityNamespace(identity);
  const previous = localStorage.getItem(ACTIVE_IDENTITY_KEY);
  if (previous && previous !== namespace) indexedDB.deleteDatabase(previous);

  const request = indexedDB.open(namespace, OFFLINE_STORE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains("snapshots")) database.createObjectStore("snapshots", { keyPath: "key" });
    if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts", { keyPath: "key" });
    if (!database.objectStoreNames.contains("outbox")) database.createObjectStore("outbox", { keyPath: "command.command_id" });
  };
  try {
    const database = await requestResult(request);
    localStorage.setItem(ACTIVE_IDENTITY_KEY, namespace);
    return new IndexedDbOfflineStore(database);
  } catch (error) {
    throw new OfflineStorageError("UPGRADE_FAILED", error instanceof Error ? error.message : "Offline storage upgrade failed.");
  }
}

export async function clearOfflineIdentity() {
  if (typeof indexedDB === "undefined" || typeof localStorage === "undefined") return;
  const namespace = localStorage.getItem(ACTIVE_IDENTITY_KEY);
  if (namespace) indexedDB.deleteDatabase(namespace);
  localStorage.removeItem(ACTIVE_IDENTITY_KEY);
}
