"use client";

import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode} from "react";
import {useTranslations} from "next-intl";
import {todayErrorMessageKeys} from "@/i18n/today-copy";
import type {TodayCommand, TodayCommandResult, TodayTask, TodayWorkspace} from "@/lib/today-workspace/contracts";
import {openOfflineStore, identityNamespace, OfflineStorageError, type OfflineDraft, type QueuedCommand} from "@/lib/today-workspace/offline-store";
import {TodayOfflineRuntime, taskDraftKey, workspaceKey, type LocalCommandResult, type OfflineSelection} from "@/lib/today-workspace/offline-runtime";
import {startForegroundSync} from "@/lib/today-workspace/foreground-sync";
import {requestBackgroundSync, sendTodayCommand} from "@/lib/today-workspace/sync";
import {offlineWorkerFailed} from "@/lib/today-workspace/offline-worker";

type OfflineContextValue = {
  runtime: TodayOfflineRuntime | null;
  version: number;
  problem: string | null;
  queue: QueuedCommand[];
  drafts: OfflineDraft[];
  acceptWorkspace(workspace: TodayWorkspace): Promise<void>;
  refresh(): Promise<void>;
  fail(error: unknown): void;
  authorize(selection?: OfflineSelection): Promise<boolean>;
  submit(command: TodayCommand, key: string): Promise<LocalCommandResult>;
  stateFor(selection: OfflineSelection, task: TodayTask): TodayTask["state"];
};
const OfflineContext = createContext<OfflineContextValue | null>(null);
export function useTodayOffline() {
  const value = useContext(OfflineContext);
  if (!value) throw Error("TODAY_OFFLINE_PROVIDER_REQUIRED");
  return value;
}
export function TodayOfflineProvider({children,bootstrapRuntime}: {children: ReactNode;bootstrapRuntime?:TodayOfflineRuntime}) {
  const [runtime,setRuntime] = useState<TodayOfflineRuntime|null>(bootstrapRuntime??null);
  const runtimeRef = useRef<TodayOfflineRuntime|null>(bootstrapRuntime??null);
  const opening = useRef<Promise<TodayOfflineRuntime>|null>(null);
  const [queue,setQueue] = useState<QueuedCommand[]>([]);
  const [drafts,setDrafts] = useState<OfflineDraft[]>([]);
  const [problem,setProblem] = useState<string|null>(null);
  const [version,setVersion] = useState(0);
  useEffect(()=>{
    const storageError=()=>setProblem("STORAGE_FAILED");
    if(offlineWorkerFailed())storageError();
    window.addEventListener("ethiopoultry:offline-storage-error",storageError);
    return()=>window.removeEventListener("ethiopoultry:offline-storage-error",storageError);
  },[]);
  const fail = useCallback((error:unknown)=>setProblem(error instanceof Error ? error.message : "STORAGE_FAILED"),[]);
  const refresh = useCallback(async()=>{
    const active=runtimeRef.current;if(!active)return;
    setQueue(await active.pending());setDrafts(await active.drafts());
    setVersion(value=>value+1);
  },[]);
  const acceptWorkspace = useCallback(async(workspace:TodayWorkspace)=>{
    if(offlineWorkerFailed())throw Error("WORKER_FAILED");
    if(!workspace.offlineAccess)return;
    const grant=workspace.offlineAccess;
    const identity={tenantId:grant.tenantId,userId:grant.userId,authorizedWorkDate:grant.workDate};
    if(runtimeRef.current && identityNamespace(runtimeRef.current.identity)!==identityNamespace(identity)) {
      setProblem("IDENTITY_CHANGED");throw Error("IDENTITY_CHANGED");
    }
    if(!runtimeRef.current) {
      opening.current ??= openOfflineStore(identity).then(store=>new TodayOfflineRuntime(store,identity,()=>navigator.onLine));
      let active:TodayOfflineRuntime;
      try{active=await opening.current;}catch(error){opening.current=null;throw error;}
      runtimeRef.current=active;setRuntime(active);
    }
    await runtimeRef.current.rememberWorkspace(workspace);
    await runtimeRef.current.prepareDetails(workspace,async(task,flockId)=>{
      const params=new URLSearchParams({farm_id:workspace.farm.id,date:workspace.workDate});if(flockId)params.set("flock_id",flockId);
      const response=await fetch(`/api/farm-manager/today/tasks/${task}?${params}`,{cache:"no-store"});
      if(!response.ok)throw Error("OFFLINE_PREPARATION_FAILED");
      return response.json();
    });
    setProblem(null);
    await refresh();
  },[refresh]);
  const authorize = useCallback(async(selection?:OfflineSelection)=>{
    if(offlineWorkerFailed())throw Error("WORKER_FAILED");
    const active=runtimeRef.current;
    if(!active||!navigator.onLine)return false;
    const response=await fetch("/api/me/context",{cache:"no-store"}).catch(()=>null);
    if(!response)return false;
    if(!response.ok){setProblem("AUTH_REQUIRED");return false;}
    const identity=await response.json();
    if(identity.role!=="farm_manager"||identity.userId!==active.identity.userId||identity.orgId!==active.identity.tenantId){setProblem("IDENTITY_CHANGED");return false;}
    const pending=await active.pending();
    await active.store.putDraft({key:"metadata:recovery",taskId:"metadata",workDate:active.identity.authorizedWorkDate,value:{checkedAt:new Date().toISOString()},updatedAt:new Date().toISOString()});
    const selections=new Map(pending.map(row=>[workspaceKey(row.command.farm_id,row.command.work_date),{farmId:row.command.farm_id,workDate:row.command.work_date}]));
    if(selection)selections.set(workspaceKey(selection.farmId,selection.workDate),selection);
    for(const target of selections.values()) {
      const response=await fetch(`/api/farm-manager/today?${new URLSearchParams({farm_id:target.farmId,date:target.workDate})}`,{cache:"no-store"}).catch(()=>null);
      if(!response)return false;
      if(!response.ok){setProblem(response.status===401?"AUTH_REQUIRED":"ACCESS_CHANGED");return false;}
      const workspace=await response.json() as TodayWorkspace;
      if(workspace.offlineAccess)await active.rememberWorkspace(workspace);
      else await active.store.removeDraft(`grant:${workspaceKey(target.farmId,target.workDate)}`);
    }
    setProblem(null);return true;
  },[]);
  useEffect(()=>{
    if(!runtime)return;
    const controller=startForegroundSync({store:runtime.store,send:sendTodayCommand,beforeSync:authorize,
      lockName:identityNamespace(runtime.identity),drain:()=>runtime.drain(sendTodayCommand,async()=>true),
      onSummary:summary=>{void refresh().catch(fail);if(summary.applied.length)window.dispatchEvent(new CustomEvent("ethiopoultry:today-synced"));if(summary.authorizationRequired)setProblem("AUTH_REQUIRED");},onError:fail});
    window.addEventListener("ethiopoultry:retry-sync",controller.wake);
    return()=>{controller.stop();window.removeEventListener("ethiopoultry:retry-sync",controller.wake);};
  },[runtime,authorize,refresh,fail]);
  useEffect(()=>{if(bootstrapRuntime)void refresh().catch(fail);},[bootstrapRuntime,refresh,fail]);
  const submit = useCallback(async(command:TodayCommand,key:string):Promise<LocalCommandResult>=>{
    const active=runtimeRef.current;
    if(problem)throw Error(problem);
    if(!active){if(!navigator.onLine)throw Error("OFFLINE_NOT_AUTHORIZED");return sendTodayCommand(command);}
    if(command.type==="finish_operating_day")return active.finish(command,sendTodayCommand,authorize);
    try {await active.enqueue(command,key);await refresh();}
    catch(error){if(error instanceof OfflineStorageError)fail(error);throw error;}
    // Persistence happens before any network attempt; ambiguous failures retain ID.
    const results=new Map<string,TodayCommandResult>();
    try {
      await active.drain(async queued=>{const result=await sendTodayCommand(queued);results.set(queued.command_id,result);return result;},authorize);
    } finally {
      await refresh();
      window.dispatchEvent(new CustomEvent("ethiopoultry:retry-sync"));
      void requestBackgroundSync().catch(()=>{});
    }
    return results.get(command.command_id) ?? {command_id:command.command_id,status:"queued"};
  },[authorize,problem,refresh,fail]);
  function stateFor(selection:OfflineSelection,task:TodayTask):TodayTask["state"] {
    const key=taskDraftKey(selection,task.code);
    const pending=queue.filter(row=>row.taskKey===key);
    if(pending.some(row=>row.state==="conflict"||row.state==="rejected"))return "needs_attention";
    if(pending.length)return "waiting_to_sync";
    if(drafts.some(row=>row.key===key&&(row.value as {needsReview?:boolean}).needsReview))return "needs_attention";
    if(drafts.some(row=>row.key===key))return "draft_on_tablet";
    return task.state;
  }
  return <OfflineContext.Provider value={{runtime,version,problem,queue,drafts,acceptWorkspace,refresh,fail,authorize,submit,stateFor}}>{children}</OfflineContext.Provider>;
}

type DraftValue={revision?:string;fields:Record<string,unknown>;needsReview?:boolean};
type DraftContextValue={values:Record<string,unknown>;set(name:string,value:unknown):void;submit(command:TodayCommand):Promise<LocalCommandResult>};
const DraftContext=createContext<DraftContextValue|null>(null);
const FieldGroup=createContext("");
export function DraftFieldGroup({name,children}:{name:string;children:ReactNode}) {
  return <FieldGroup.Provider value={name}>{children}</FieldGroup.Provider>;
}
export function useDraftField<T>(name:string,initial:T) {
  const group=useContext(FieldGroup);
  return useDraftState(`field:${group}:${name}`,initial);
}
export function useDraftState<T>(name:string,initial:T):[T,(next:T|((previous:T)=>T))=>void] {
  const context=useContext(DraftContext);
  const [fallback,setFallback]=useState(initial);
  const value=context && Object.hasOwn(context.values,name)?context.values[name] as T:fallback;
  return [value,next=>{const updated=typeof next==="function"?(next as (previous:T)=>T)(value):next;if(context)context.set(name,updated);else setFallback(updated);}];
}
export function useDraftSubmit() {
  const context=useContext(DraftContext);
  if(!context)throw Error("TODAY_DRAFT_SCOPE_REQUIRED");
  return context.submit;
}
export function TaskDraftScope({selection,task,revision,children}: {selection:OfflineSelection;task:string;revision?:string;children:ReactNode}) {
  const offline=useTodayOffline();const t=useTranslations("Today.offline");
  const errors=useTranslations("Errors");
  const {runtime,refresh,fail,authorize}=offline;
  const key=taskDraftKey(selection,task);
  const [loaded,setLoaded]=useState(false);const [stale,setStale]=useState(false);const [expired,setExpired]=useState(false);
  const [values,setValues]=useState<Record<string,unknown>>({});const current=useRef<Record<string,unknown>>({});
  const writes=useRef<Promise<unknown>>(Promise.resolve());const failed=useRef(false);
  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      const draft=await runtime?.store.getDraft(key);if(cancelled)return;
      const value=draft?.value as DraftValue|undefined;
      current.current=value?.fields??{};setValues(current.current);
      const changed=Boolean(draft&&value?.revision!==revision);
      setStale(changed);setLoaded(true);
      if(changed&&draft&&value&&!value.needsReview){await runtime?.store.putDraft({...draft,value:{...value,needsReview:true}});await refresh();}
    };
    void load().catch(fail);return()=>{cancelled=true;};
  },[key,runtime,fail,refresh,revision]);
  useEffect(()=>{
    let cancelled=false;
    const currentSelection={farmId:selection.farmId,flockId:selection.flockId,workDate:selection.workDate};
    const check=async()=>{
      try{if(!runtime)throw Error();await runtime.assertEditable(currentSelection);if(!cancelled)setExpired(false);}catch{if(!cancelled)setExpired(true);}
    };
    const reconnect=async()=>{
      if(!navigator.onLine){await check();return;}
      if(!runtime){setExpired(false);return;}
      setExpired(true);
      try{const allowed=await authorize(currentSelection);if(!cancelled)setExpired(!allowed);}catch(error){if(!cancelled){setExpired(true);fail(error);}}
    };
    void reconnect();
    const timer=window.setInterval(()=>{if(!navigator.onLine)void check();},15000);
    window.addEventListener("offline",check);window.addEventListener("online",reconnect);
    return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener("offline",check);window.removeEventListener("online",reconnect);};
  },[runtime,authorize,fail,selection.farmId,selection.flockId,selection.workDate]);
  const pending=offline.queue.filter(row=>row.taskKey===key);
  const hasDraft=offline.drafts.some(row=>row.key===key);
  const blocked=pending.some(row=>row.state==="conflict"||row.state==="rejected")||stale||expired||Boolean(offline.problem)||!loaded;
  function set(name:string,value:unknown){
    if(blocked)return;
    current.current={...current.current,[name]:value};setValues(current.current);
    const snapshot={...current.current};
    if(offline.runtime)writes.current=writes.current.then(()=>offline.runtime!.saveDraft(selection,{key,taskId:task,workDate:selection.workDate,updatedAt:new Date().toISOString(),value:{revision,fields:snapshot} satisfies DraftValue})).then(()=>{failed.current=false;return offline.refresh();}).catch(error=>{failed.current=true;offline.fail(error);});
  }
  async function submit(command:TodayCommand){
    await writes.current;if(blocked)throw Error("DRAFT_BLOCKED");
    if(failed.current&&offline.runtime){await offline.runtime.saveDraft(selection,{key,taskId:task,workDate:selection.workDate,updatedAt:new Date().toISOString(),value:{revision,fields:current.current} satisfies DraftValue});failed.current=false;}
    return offline.submit(command,key);
  }
  async function reviewServer(){
    if(!navigator.onLine||!await offline.authorize())return;
    // Only terminal failures can be discarded. An ambiguous queued send must
    // replay its receipt first, never disappear at the user's next click.
    if(pending.some(row=>row.state==="queued"||row.state==="sending"))return;
    for(const row of pending)await offline.runtime?.store.removeCommand(row.command.command_id);
    await offline.runtime?.store.removeDraft(key);current.current={};setValues({});setStale(false);failed.current=false;
    await offline.refresh();window.dispatchEvent(new CustomEvent("ethiopoultry:today-synced"));
  }
  return <DraftContext.Provider value={{values,set,submit}}>
    {!loaded?<p role="status">{t("loadingDraft")}</p>:null}
    {expired?<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{t("expired")}</p>:null}
    {stale||pending.some(row=>row.state==="conflict"||row.state==="rejected")?<div role="alert" className="grid gap-3 rounded-xl bg-amber-50 p-3 text-sm"><p>{t("conflict")}</p><button type="button" onClick={()=>{if(window.confirm(t("discardConfirm")))void reviewServer().catch(offline.fail);}} className="min-h-12 rounded-xl border px-4">{t("reviewServer")}</button></div>:null}
    {pending.length?<p role="status" className="text-sm">{t(pending.some(row=>row.state==="conflict"||row.state==="rejected")?"needsAttention":"waiting")}</p>:null}
    {pending.filter(row=>row.state==="conflict"||row.state==="rejected").map(row=><p key={row.command.command_id} role="alert" className="text-sm text-red-800">{errors(row.result?.error_code?todayErrorMessageKeys[row.result.error_code]:"unknown")}</p>)}
    {hasDraft&&!pending.length&&!stale?<button type="button" onClick={()=>{if(window.confirm(t("discardConfirm")))void reviewServer().catch(offline.fail);}} className="min-h-12 rounded-xl border px-4 text-sm">{t("reviewServer")}</button>:null}
    {loaded?<fieldset disabled={blocked} className="min-w-0">{children}</fieldset>:null}
  </DraftContext.Provider>;
}
