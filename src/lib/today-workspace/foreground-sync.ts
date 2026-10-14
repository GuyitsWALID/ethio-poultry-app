import type {OfflineStore} from "./offline-store.ts";
import {syncOutbox, type CommandSender, type SyncSummary} from "./sync.ts";

export type ForegroundSyncHost = {
  online(): boolean;
  visible(): boolean;
  listen(wake: () => void): () => void;
  schedule(wake: () => void, delay: number): unknown;
  cancel(timer: unknown): void;
  withLock<T>(name: string, run: () => Promise<T>): Promise<T | undefined>;
};

function browserHost(): ForegroundSyncHost {
  if (typeof window === "undefined") throw new Error("BROWSER_REQUIRED");
  return {
    online: () => navigator.onLine,
    visible: () => document.visibilityState === "visible",
    listen(wake) {
      const message = (event: MessageEvent) => {
        if (event.data?.type === "ethiopoultry:sync-outbox") wake();
      };
      window.addEventListener("online", wake);
      window.addEventListener("focus", wake);
      document.addEventListener("visibilitychange", wake);
      navigator.serviceWorker?.addEventListener("message", message);
      return () => {
        window.removeEventListener("online", wake);
        window.removeEventListener("focus", wake);
        document.removeEventListener("visibilitychange", wake);
        navigator.serviceWorker?.removeEventListener("message", message);
      };
    },
    schedule: (wake, delay) => window.setTimeout(wake, delay),
    cancel: timer => window.clearTimeout(timer as number),
    async withLock(name, run) {
      // Cross-tab serialization is an enhancement. Server receipts still enforce
      // idempotency in browsers without Web Locks or after ambiguous sends.
      if (!navigator.locks) return run();
      return navigator.locks.request(name, {ifAvailable: true}, lock => lock ? run() : undefined);
    },
  };
}

// beforeSync MUST refresh the online session and assignment, not merely trust a
// cached identity. Offline editing authorization is a separate policy boundary.
export function startForegroundSync({store, send, beforeSync, lockName, onSummary, onError, host = browserHost(), now = Date.now, drain: drainCommands}: {
  store: OfflineStore;
  send: CommandSender;
  beforeSync: () => Promise<boolean>;
  lockName: string;
  onSummary: (summary: SyncSummary) => void;
  onError: (error: unknown) => void;
  host?: ForegroundSyncHost;
  now?: () => number;
  drain?: () => Promise<SyncSummary | undefined>;
}) {
  let stopped = false;
  let running = false;
  let timer: unknown;
  let requested = false;
  const schedule = (delay: number) => {
    if (stopped) return;
    if (timer !== undefined) host.cancel(timer);
    timer = host.schedule(() => { timer = undefined; wake(); }, delay);
  };
  async function drain() {
    running = true;
    try {
      const result = await host.withLock(lockName, async () => {
        if (stopped || !host.online() || !host.visible() || !await beforeSync()) return null;
        if (stopped) return null;
        return drainCommands ? await drainCommands() ?? null : syncOutbox(store, send, now);
      });
      if (stopped) return;
      if (result === undefined) schedule(1000); // Another tab currently owns it.
      else if (result) {
        onSummary(result);
        if (result.nextRetryAt && !result.authorizationRequired) schedule(Math.max(0, Date.parse(result.nextRetryAt) - now()));
      }
    } catch (error) {
      if (!stopped) onError(error); // Preserve outbox; storage failures require recovery.
    } finally {
      running = false;
      if (requested && !stopped) { requested = false; wake(); }
    }
  }
  function wake() {
    if (stopped || !host.online() || !host.visible()) return;
    if (running) { requested = true; return; }
    if (timer !== undefined) { host.cancel(timer); timer = undefined; }
    void drain();
  }
  const unlisten = host.listen(wake);
  wake();
  return {
    wake,
    stop() {
      stopped = true;
      requested = false;
      unlisten();
      if (timer !== undefined) host.cancel(timer);
    },
  };
}
