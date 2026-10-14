"use client";

import { useEffect } from "react";
import {reportOfflineWorkerFailure, reportOfflineWorkerReady} from "@/lib/today-workspace/offline-worker";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let cancelled=false;
    let registration:ServiceWorkerRegistration|undefined;
    let worker:ServiceWorker|null=null;
    const changed=()=>{
      if(worker?.state==="redundant")reportOfflineWorkerFailure();
      if(worker?.state==="activated")reportOfflineWorkerReady();
    };
    const watch=()=>{
      worker?.removeEventListener("statechange",changed);
      worker=registration?.installing??null;
      worker?.addEventListener("statechange",changed);
      changed();
    };
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(value=>{
      if(cancelled)return;
      registration=value;registration.addEventListener("updatefound",watch);watch();
    }).catch(async()=>{
      try{const existing=await navigator.serviceWorker.getRegistration();if(navigator.onLine||!existing?.active)reportOfflineWorkerFailure();}
      catch{reportOfflineWorkerFailure();}
    });
    return()=>{cancelled=true;registration?.removeEventListener("updatefound",watch);worker?.removeEventListener("statechange",changed);};
  }, []);
  return null;
}
