import type { TodayCommand, TodayCommandResult, TodayWorkspace } from "./contracts.ts";

export const OFFLINE_STORE_VERSION = 1;
const ACTIVE_IDENTITY_KEY = "ethiopoultry.offline_identity";
const openDatabases = new Map<string, Set<IDBDatabase>>();

export type OfflineIdentity = { tenantId: string; userId: string; authorizedWorkDate: string };
export type OfflineDraft = { key: string; taskId: string; workDate: string; value: unknown; updatedAt: string };
export type QueuedCommand = { command: TodayCommand; originalCommand?: TodayCommand; draftUpdatedAt?: string; state: "queued" | "sending" | "conflict" | "rejected"; result?: TodayCommandResult; queuedAt: string; attempts?: number; nextAttemptAt?: string; taskKey?: string; resourceKey?: string };

export class OfflineStorageError extends Error {
  readonly code: "UNAVAILABLE" | "QUOTA" | "UPGRADE_FAILED";
  constructor(code: "UNAVAILABLE" | "QUOTA" | "UPGRADE_FAILED", message: string) {
    super(message);
    this.code = code;
  }
}

export interface OfflineStore {
  getSnapshot(key: string): Promise<TodayWorkspace | undefined>;
  listSnapshots(): Promise<TodayWorkspace[]>;
  putSnapshot(key: string, value: TodayWorkspace): Promise<void>;
  getDraft(key: string): Promise<OfflineDraft | undefined>;
  listDrafts(): Promise<OfflineDraft[]>;
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
  async listSnapshots() { return [...this.snapshots.values()].map(value=>structuredClone(value)); }
  async putSnapshot(key: string, value: TodayWorkspace) { this.snapshots.set(key, structuredClone(value)); }
  async getDraft(key: string) { return this.drafts.get(key); }
  async listDrafts() { return [...this.drafts.values()].map(value => structuredClone(value)); }
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
  async listSnapshots() { return requestResult(this.database.transaction("snapshots").objectStore("snapshots").getAll()) as Promise<TodayWorkspace[]>; }
  async putSnapshot(key: string, value: TodayWorkspace) { await this.write("snapshots", { ...value, key }); }
  async getDraft(key: string) { return this.read<OfflineDraft>("drafts", key); }
  async listDrafts() { return requestResult(this.database.transaction("drafts").objectStore("drafts").getAll()) as Promise<OfflineDraft[]>; }
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
  if (previous && previous !== namespace) await deleteIdentityDatabase(previous);

  const request = indexedDB.open(namespace, OFFLINE_STORE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains("snapshots")) database.createObjectStore("snapshots", { keyPath: "key" });
    if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts", { keyPath: "key" });
    if (!database.objectStoreNames.contains("outbox")) database.createObjectStore("outbox", { keyPath: "command.command_id" });
  };
  try {
    const database = await new Promise<IDBDatabase>((resolve,reject)=>{
      let blocked=false;
      request.onsuccess=()=>{if(blocked){request.result.close();return;}resolve(request.result);};
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>{blocked=true;reject(new OfflineStorageError("UPGRADE_FAILED","Close other application tabs to recover offline storage."));};
    });
    const connections = openDatabases.get(namespace) ?? new Set<IDBDatabase>();
    connections.add(database);
    openDatabases.set(namespace, connections);
    database.onversionchange = () => { database.close(); connections.delete(database); };
    localStorage.setItem(ACTIVE_IDENTITY_KEY, namespace);
    return new IndexedDbOfflineStore(database);
  } catch (error) {
    throw new OfflineStorageError("UPGRADE_FAILED", error instanceof Error ? error.message : "Offline storage upgrade failed.");
  }
}

async function deleteIdentityDatabase(namespace: string) {
  for (const database of openDatabases.get(namespace) ?? []) database.close();
  openDatabases.delete(namespace);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(namespace);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new OfflineStorageError("UNAVAILABLE", "Offline data cleanup failed."));
    request.onblocked = () => reject(new OfflineStorageError("UNAVAILABLE", "Close other application tabs to finish clearing offline data."));
  });
}

export async function clearOfflineIdentity() {
  if (typeof indexedDB === "undefined" || typeof localStorage === "undefined") return;
  const namespace = localStorage.getItem(ACTIVE_IDENTITY_KEY);
  if (namespace) await deleteIdentityDatabase(namespace);
  localStorage.removeItem(ACTIVE_IDENTITY_KEY);
}

export async function retainOfflineIdentity(identity:{tenantId?:string;userId:string}|null){
  const active=localStorage.getItem(ACTIVE_IDENTITY_KEY);
  const matches=identity&&(identity.tenantId?active===identityNamespace({tenantId:identity.tenantId,userId:identity.userId,authorizedWorkDate:""}):active?.endsWith(`-${identity.userId.replace(/[^a-zA-Z0-9_-]/g,"_")}`));
  if(active&&!matches)await clearOfflineIdentity();
}

export async function recoverOfflineStore() {
  const namespace=localStorage.getItem(ACTIVE_IDENTITY_KEY);
  if(!namespace?.startsWith('ethiopoultry-offline-'))throw Error('OFFLINE_NOT_AUTHORIZED');
  const request=indexedDB.open(namespace,OFFLINE_STORE_VERSION);
  request.onupgradeneeded=()=>request.transaction?.abort();
  const database=await requestResult(request);
  const store=new IndexedDbOfflineStore(database);
  try {
    const snapshots=(await store.listSnapshots()).filter(row=>row.schemaVersion===1&&row.offlineAccess).sort((a,b)=>b.offlineAccess!.issuedAt.localeCompare(a.offlineAccess!.issuedAt));
    const grant=snapshots[0]?.offlineAccess;
    if(!grant)throw Error('OFFLINE_NOT_AUTHORIZED');
    const identity={tenantId:grant.tenantId,userId:grant.userId,authorizedWorkDate:grant.workDate};
    if(identityNamespace(identity)!==namespace || snapshots.some(row=>row.offlineAccess!.tenantId!==identity.tenantId||row.offlineAccess!.userId!==identity.userId))throw Error('IDENTITY_CHANGED');
    database.close();
    return {store:await openOfflineStore(identity),identity,snapshots};
  }catch(error){database.close();throw error;}
}
