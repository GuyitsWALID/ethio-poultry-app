let failed = false;

export function offlineWorkerFailed() { return failed; }

export function reportOfflineWorkerFailure() {
  failed = true;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ethiopoultry:offline-storage-error"));
}

export function reportOfflineWorkerReady() {
  failed = false;
}
