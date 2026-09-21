"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      window.dispatchEvent(new CustomEvent("ethiopoultry:offline-storage-error"));
    });
  }, []);
  return null;
}
