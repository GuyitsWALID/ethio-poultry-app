"use client";

import {useEffect,useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import {recoverOfflineStore} from "@/lib/today-workspace/offline-store";
import {TodayOfflineRuntime} from "@/lib/today-workspace/offline-runtime";
import type {TodayWorkspace} from "@/lib/today-workspace/contracts";
import {TodayOfflineProvider,useTodayOffline} from "./offline-context";
import {BirdCheckCard} from "./bird-check-card";
import {EmbeddedTaskCard} from "./embedded-task-card";
import {LocaleSwitch} from "@/components/locale-switch";
import {formatOperationDate} from "@/i18n/formats";
import type {AppLocale} from "@/i18n/locale";

export function OfflineToday(){
  const t=useTranslations("Today.offline");
  const [boot,setBoot]=useState<{runtime:TodayOfflineRuntime;workspaces:TodayWorkspace[]}|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{let cancelled=false;void(async()=>{
    const recovered=await recoverOfflineStore();
    if(navigator.onLine){
      const response=await fetch("/api/me/context",{cache:"no-store"});
      const identity=response.ok?await response.json():null;
      if(identity?.role!=="farm_manager"||identity.userId!==recovered.identity.userId||identity.orgId!==recovered.identity.tenantId)throw Error("AUTH_REQUIRED");
    }
    if(!cancelled)setBoot({runtime:new TodayOfflineRuntime(recovered.store,recovered.identity,()=>navigator.onLine),workspaces:recovered.snapshots});
  })().catch(()=>{if(!cancelled)setFailed(true);});return()=>{cancelled=true;};},[]);
  if(!boot)return <main className="mx-auto max-w-3xl p-6"><p role={failed?"alert":"status"}>{t(failed?"expired":"loadingDraft")}</p>{failed?<a className="mt-4 inline-flex min-h-12 items-center underline" href="/auth/sign-in">{t("retry")}</a>:null}</main>;
  return <TodayOfflineProvider bootstrapRuntime={boot.runtime}><RecoveredWorkspace workspaces={boot.workspaces}/></TodayOfflineProvider>;
}

function RecoveredWorkspace({workspaces:initialWorkspaces}:{workspaces:TodayWorkspace[]}){
  const [workspaces,setWorkspaces]=useState(initialWorkspaces);
  const offline=useTodayOffline();const t=useTranslations("Today");const text=useTranslations("Today.offline");const locale=useLocale() as AppLocale;
  const [selected,setSelected]=useState(0);const workspace=workspaces[selected];
  const [house,setHouse]=useState(workspace.flocks[0]?.houseLabel??"");
  const [flockId,setFlockId]=useState(workspace.flocks[0]?.id??"");
  const [open,setOpen]=useState<string|null>(null);
  const [online,setOnline]=useState(false);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);update();window.addEventListener("online",update);window.addEventListener("offline",update);return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update);};},[]);
  const flock=workspace.flocks.find(row=>row.id===flockId&&row.houseLabel===house);
  const refresh=()=>{void offline.refresh().catch(offline.fail);};
  const {acceptWorkspace,fail}=offline;
  useEffect(()=>{const update=()=>{if(!navigator.onLine)return;void(async()=>{
    const response=await fetch(`/api/farm-manager/today?${new URLSearchParams({farm_id:workspace.farm.id,date:workspace.workDate})}`,{cache:"no-store"});
    if(!response.ok)throw Error("ACCESS_CHANGED");
    const next=await response.json() as TodayWorkspace;await acceptWorkspace(next);
    setWorkspaces(current=>current.map(row=>row.farm.id===next.farm.id&&row.workDate===next.workDate?next:row));
  })().catch(fail);};window.addEventListener("ethiopoultry:today-synced",update);return()=>window.removeEventListener("ethiopoultry:today-synced",update);},[workspace.farm.id,workspace.workDate,acceptWorkspace,fail]);
  const changeWorkspace=(index:number)=>{const next=workspaces[index];setSelected(index);setHouse(next.flocks[0]?.houseLabel??"");setFlockId(next.flocks[0]?.id??"");setOpen(null);};
  const taskProps=(code:string)=>({expanded:open===code,onToggle:()=>setOpen(current=>current===code?null:code),onSaved:()=>{const index=flock?.tasks.findIndex(task=>task.code===code)??-1;setOpen(flock?.tasks.slice(index+1).find(task=>task.required&&task.applicable&&task.state!=="complete")?.code??null);refresh();}});
  const reviewTasks=[...workspace.flocks.flatMap(row=>row.tasks.filter(task=>task.required&&task.applicable).map(task=>({...task,state:offline.stateFor({farmId:workspace.farm.id,flockId:row.id,workDate:workspace.workDate},task),contextLabel:row.code}))),...workspace.farmTasks.filter(task=>task.required&&task.applicable&&task.code!=="review_finish")];
  return <main className="mx-auto grid w-full max-w-5xl gap-5 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><h1 className="font-display text-3xl">{t("question")}</h1><LocaleSwitch viewerRole="farm_manager"/></header>
    <p role="status" aria-live="polite">{offline.queue.length?t("connection.waiting"):offline.drafts.length?t("connection.saved"):t("connection.offline")}</p>
    <p className="rounded-xl bg-amber-50 p-4">{text("recovered")}</p>
    {offline.problem?<p role="alert" className="rounded-xl bg-red-50 p-4">{text("blocked")}</p>:null}
    <section className="grid gap-4 rounded-2xl border bg-white p-4 sm:grid-cols-2">
      <label>{t("farm")}<select className="block min-h-12 w-full rounded-xl border px-3" value={selected} onChange={event=>changeWorkspace(Number(event.target.value))}>{workspaces.map((row,index)=><option key={`${row.farm.id}:${row.workDate}`} value={index}>{row.farm.name} · {formatOperationDate(row.workDate,locale)}</option>)}</select></label>
      <label>{t("house")}<select className="block min-h-12 w-full rounded-xl border px-3" value={house} onChange={event=>{setHouse(event.target.value);setFlockId(workspace.flocks.find(row=>row.houseLabel===event.target.value)?.id??"");setOpen(null);}}>{[...new Set(workspace.flocks.map(row=>row.houseLabel))].map(name=><option key={name}>{name}</option>)}</select></label>
      <label>{t("flock")}<select className="block min-h-12 w-full rounded-xl border px-3" value={flockId} onChange={event=>{setFlockId(event.target.value);setOpen(null);}}>{workspace.flocks.filter(row=>row.houseLabel===house).map(row=><option key={row.id} value={row.id}>{row.code}</option>)}</select></label>
      {online?<a className="inline-flex min-h-12 items-center underline" href={`/app/today?farm_id=${workspace.farm.id}&flock_id=${flockId}&date=${workspace.workDate}`}>{t("refresh")}</a>:null}
    </section>
    {flock?.tasks.filter(task=>task.applicable).map(task=>{const state={...task,state:offline.stateFor({farmId:workspace.farm.id,flockId:flock.id,workDate:workspace.workDate},task)};return task.code==="birds"?<BirdCheckCard key={task.code} flock={flock} task={state} farmId={workspace.farm.id} workDate={workspace.workDate} online={online} {...taskProps(task.code)}/>:<EmbeddedTaskCard key={`${flock.id}:${task.code}`} task={state} flock={flock} farmId={workspace.farm.id} workDate={workspace.workDate} onChanged={refresh} {...taskProps(task.code)}/>;})}
    {workspace.farmTasks.filter(task=>task.applicable).map(task=><EmbeddedTaskCard key={task.code} task={{...task,state:offline.stateFor({farmId:workspace.farm.id,workDate:workspace.workDate},task)}} flock={flock} farmId={workspace.farm.id} workDate={workspace.workDate} onChanged={refresh} online={online} dayRevision={workspace.operatingDay.revision} reviewTasks={reviewTasks} canFinish={online&&workspace.capabilities.canFinish&&!offline.queue.length&&!offline.drafts.length&&!offline.problem} {...taskProps(task.code)}/>)}
    <p>{t("embedded.connectToFinish")}</p>
  </main>;
}
