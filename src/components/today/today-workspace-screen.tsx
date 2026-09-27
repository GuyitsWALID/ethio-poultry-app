"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {useSearchParams} from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  Cloud,
  CloudOff,
  HeartPulse,
  RefreshCw,
  Warehouse,
  X,
} from "lucide-react";

import { useFarmScope } from "@/components/farm-scope-context";
import {BirdCheckCard} from "@/components/today/bird-check-card";
import {EmbeddedTaskCard} from "@/components/today/embedded-task-card";
import { formatNumber, formatOperationDate } from "@/i18n/formats";
import type { AppLocale } from "@/i18n/locale";
import type { TodayTask, TodayWorkspace } from "@/lib/today-workspace/contracts";
import type {FinishIssue, ReviewTask} from "@/lib/today-workspace/finish-review";

type WorkspaceError = "FEATURE_DISABLED" | "ROLE_NOT_ALLOWED" | "ASSIGNMENT_REQUIRED" | "LOAD_FAILED";
type AssignedFarm = {id: string; name: string; branch_id: string};

function addisToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function earliestEditableDate(today: string) {
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 6);
  return value.toISOString().slice(0, 10);
}

export function TodayWorkspaceScreen() {
  const searchParams = useSearchParams();
  const locale = useLocale() as AppLocale;
  const t = useTranslations("Today");
  const { role, loading: scopeLoading, farms, houses, flocks, scope, setScope } = useFarmScope();
  const today = useMemo(() => addisToday(), []);
  const requestedFarmId = searchParams.get("farm_id") ?? "";
  const requestedHouseId = searchParams.get("house_id") ?? "";
  const requestedFlockId = searchParams.get("flock_id") ?? "";
  const requestedDate = searchParams.get("date") ?? "";
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [selectedHouseId, setSelectedHouseId] = useState("");
  const [workDate, setWorkDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today);
  const [flockId, setFlockId] = useState("");
  const [workspace, setWorkspace] = useState<TodayWorkspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [error, setError] = useState<WorkspaceError | null>(null);
  const [online, setOnline] = useState(true);
  const [directFarms, setDirectFarms] = useState<AssignedFarm[] | null>(null);
  const [assignmentLoadFailed, setAssignmentLoadFailed] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [advanceFrom, setAdvanceFrom] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [finishIssues, setFinishIssues] = useState<FinishIssue[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setGuideOpen(window.localStorage.getItem("ethiopoultry.today.guide.dismissed.v1") !== "true"), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const record = (event: Event) => {
      const issue = (event as CustomEvent<FinishIssue>).detail;
      setFinishIssues((current) => [...current.filter((item) => item.commandId !== issue.commandId), issue]);
    };
    window.addEventListener("ethiopoultry:today-command-issue", record);
    return () => window.removeEventListener("ethiopoultry:today-command-issue", record);
  }, []);

  const assignedFarms = farms.length ? farms : directFarms ?? [];
  const assignmentLoading = role === "farm_manager" && !farms.length && directFarms === null && !assignmentLoadFailed;

  const farmId = assignedFarms.some((farm) => farm.id === selectedFarmId)
    ? selectedFarmId
    : assignedFarms.some((farm) => farm.id === requestedFarmId)
      ? requestedFarmId
    : assignedFarms.some((farm) => farm.id === scope.farmId)
      ? scope.farmId
      : assignedFarms.length === 1
        ? assignedFarms[0].id
        : "";

  const availableHouses = useMemo(() => {
    const workspaceFlockIds = new Set(workspace?.flocks.map((flock) => flock.id) ?? []);
    const activeHouseIds = new Set(
      flocks
        .filter((flock) => flock.farm_id === farmId && workspaceFlockIds.has(flock.id))
        .map((flock) => flock.house_id),
    );
    const scopedHouses = houses.filter((house) => house.farm_id === farmId && activeHouseIds.has(house.id));
    if (scopedHouses.length || !workspace) return scopedHouses;

    return [...new Set(workspace.flocks.map((flock) => flock.houseLabel))]
      .map((name) => ({id: `workspace:${name}`, name, farm_id: farmId}));
  }, [farmId, flocks, houses, workspace]);

  const houseId = availableHouses.some((house) => house.id === selectedHouseId)
    ? selectedHouseId
    : availableHouses.some((house) => house.id === requestedHouseId)
      ? requestedHouseId
    : availableHouses.some((house) => house.id === scope.houseId)
      ? scope.houseId
      : availableHouses.length === 1
        ? availableHouses[0].id
        : "";

  const availableFlocks = useMemo(() => {
    if (!workspace || !houseId) return [];
    if (houseId.startsWith("workspace:")) {
      const houseLabel = houseId.slice("workspace:".length);
      return workspace.flocks.filter((flock) => flock.houseLabel === houseLabel);
    }
    const houseFlockIds = new Set(
      flocks
        .filter((flock) => flock.farm_id === farmId && flock.house_id === houseId)
        .map((flock) => flock.id),
    );
    return workspace.flocks.filter((flock) => houseFlockIds.has(flock.id));
  }, [farmId, flocks, houseId, workspace]);

  const activeFlockId = availableFlocks.some((flock) => flock.id === flockId)
    ? flockId
    : availableFlocks.some((flock) => flock.id === requestedFlockId)
      ? requestedFlockId
    : availableFlocks.some((flock) => flock.id === scope.flockId)
      ? scope.flockId
      : availableFlocks.length === 1
        ? availableFlocks[0].id
        : "";

  useEffect(() => {
    if (scopeLoading || role !== "farm_manager" || farms.length) return;
    const controller = new AbortController();
    void fetch("/api/farm-manager/today/farms", {method: "GET", cache: "no-store", signal: controller.signal})
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(body.error ?? "Farm assignments could not be loaded."));
        setDirectFarms((body.farms ?? []) as AssignedFarm[]);
        setAssignmentLoadFailed(false);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setAssignmentLoadFailed(true);
      });
    return () => controller.abort();
  }, [farms.length, role, scopeLoading]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (!farmId || role !== "farm_manager") return;
    const controller = new AbortController();
    const params = new URLSearchParams({ farm_id: farmId, date: workDate });
    void fetch(`/api/farm-manager/today?${params}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = body.error_code;
        if (code === "FEATURE_DISABLED" || code === "ROLE_NOT_ALLOWED" || code === "ASSIGNMENT_REQUIRED") setError(code);
        else setError("LOAD_FAILED");
        setWorkspace(null);
        return;
      }
      const next = body as TodayWorkspace;
      setError(null);
      setWorkspace(next);
      setFlockId((current) => next.flocks.some((flock) => flock.id === current) ? current : "");
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError("LOAD_FAILED"); setWorkspace(null);
    }).finally(() => {
      if (controller.signal.aborted) return;
      setLoading(false);
    });
    return () => controller.abort();
  }, [farmId, reloadVersion, role, workDate]);

  function reload() {
    setFinishIssues([]);
    setLoading(true);
    setReloadVersion((current) => current + 1);
  }

  const visibleFlocks = useMemo(
    () => activeFlockId ? availableFlocks.filter((flock) => flock.id === activeFlockId) : [],
    [activeFlockId, availableFlocks],
  );
  const required = useMemo(() => {
    if (!workspace) return [];
    return [...workspace.flocks.flatMap((flock) => flock.tasks), ...workspace.farmTasks].filter((task) => task.required && task.applicable);
  }, [workspace]);
  const reviewTasks = useMemo<ReviewTask[]>(() => {
    if (!workspace) return [];
    return [
      ...workspace.flocks.flatMap((flock) => flock.tasks
        .filter((task) => task.required && task.applicable)
        .map((task) => ({...task, contextLabel: flock.code}))),
      ...workspace.farmTasks
        .filter((task) => task.required && task.applicable && task.code !== "review_finish")
        .map((task) => ({...task, contextLabel: workspace.farm.name})),
    ];
  }, [workspace]);
  const completed = required.filter((task) => task.state === "complete").length;
  const progress = required.length ? Math.round(completed / required.length * 100) : 0;

  useEffect(() => {
    if (!workspace) return;
    const flock = workspace.flocks.find((item) => item.id === activeFlockId);
    const sequence = [...(flock?.tasks.filter((item) => item.applicable) ?? []), ...workspace.farmTasks.filter((item) => item.applicable)];
    if (advanceFrom) {
      const currentIndex = sequence.findIndex((item) => `${item.code}` === advanceFrom);
      const next = sequence.slice(Math.max(0, currentIndex + 1)).find((item) => item.state !== "complete")
        ?? sequence.find((item) => item.required && item.state !== "complete")
        ?? sequence.find((item) => item.code === "review_finish");
      queueMicrotask(() => {
        setOpenTask(next ? `${next.code}` : "review_finish");
        setAdvanceFrom(null);
        if (next) requestAnimationFrame(() => document.getElementById(`today-task-${next.code}`)?.focus());
      });
      return;
    }
    if (openTask) return;
    const requested = searchParams.get("task");
    const initial = sequence.find((item) => item.code === requested) ?? sequence.find((item) => item.required && item.state !== "complete") ?? sequence[0];
    if (initial) queueMicrotask(() => setOpenTask(initial.code));
  }, [activeFlockId, advanceFrom, openTask, searchParams, workspace]);

  function saved(task: TodayTask) {
    setAdvanceFrom(task.code);
    reload();
  }

  function dismissGuide() {
    window.localStorage.setItem("ethiopoultry.today.guide.dismissed.v1", "true");
    setGuideOpen(false);
  }

  if (scopeLoading || assignmentLoading) return <main className="mx-auto max-w-[1320px] p-4 sm:p-6"><p role="status" className="rounded-2xl border border-sand-200 bg-white p-6 text-forest-700">{t("loading")}</p></main>;
  if (role !== "farm_manager") return <main className="mx-auto max-w-[1320px] p-4 sm:p-6"><div className="rounded-3xl border border-sand-200 bg-white p-8 text-center"><AlertCircle className="mx-auto h-8 w-8 text-amber-600"/><p className="mt-3 font-semibold text-forest-900">{t("wrongRole")}</p></div></main>;
  if (assignmentLoadFailed && !farms.length) return <main className="mx-auto max-w-[1320px] p-4 sm:p-6"><div role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center"><AlertCircle className="mx-auto h-8 w-8 text-red-700"/><h1 className="mt-3 font-display text-2xl font-semibold text-forest-900">{t("loadFailed")}</h1><button type="button" onClick={()=>window.location.reload()} className="mt-5 min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white">{t("refresh")}</button></div></main>;
  if (!assignedFarms.length) return <main className="mx-auto max-w-[1320px] p-4 sm:p-6"><div className="rounded-3xl border border-dashed border-amber-400 bg-amber-50 p-8 text-center"><Warehouse className="mx-auto h-8 w-8 text-amber-700"/><h1 className="mt-3 font-display text-2xl font-semibold text-forest-900">{t("noFarms")}</h1><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-forest-700">{t("noFarmsHelp")}</p></div></main>;

  return <main className="mx-auto w-full max-w-[1320px] space-y-5 p-4 pb-12 sm:p-6 lg:p-8">
    <section className="relative overflow-hidden rounded-[28px] bg-forest-900 text-white shadow-sm">
      <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border-[34px] border-leaf-500/15" aria-hidden="true" />
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_340px] lg:items-end">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.22em] text-amber-300">{t("eyebrow")}</p><h1 className="mt-2 max-w-2xl font-display text-3xl font-semibold sm:text-4xl">{t("question")}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-sand-100/80">{t("intro")}</p><button type="button" onClick={()=>setGuideOpen(true)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-4 text-sm font-semibold"><CircleHelp className="h-4 w-4"/>{t("guide.open")}</button></div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-sand-100">{t("overallProgress")}</span><strong className="text-2xl tabular-nums">{progress}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-leaf-400 transition-[width] motion-reduce:transition-none" style={{width:`${progress}%`}} /></div><p className="mt-3 text-xs text-sand-100/75">{t("completeCount",{complete:completed,total:required.length})}</p></div>
      </div>
    </section>

    {guideOpen ? <section aria-label={t("guide.title")} className="relative rounded-2xl border border-leaf-200 bg-leaf-500/5 p-5"><button type="button" onClick={dismissGuide} aria-label={t("guide.dismiss")} className="absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-forest-700"><X className="h-5 w-5"/></button><h2 className="pr-12 font-display text-xl font-semibold text-forest-900">{t("guide.title")}</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{([1,2,3] as const).map((step)=><div key={step} className="rounded-xl bg-white p-4"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-forest-900 text-sm font-semibold text-white">{step}</span><p className="mt-3 text-sm font-semibold text-forest-900">{t(`guide.step${step}Title`)}</p><p className="mt-1 text-sm leading-6 text-forest-600">{t(`guide.step${step}Help`)}</p></div>)}</div><button type="button" onClick={dismissGuide} className="mt-4 min-h-12 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white">{t("guide.start")}</button></section> : null}

    <section className="grid gap-3 rounded-2xl border border-sand-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-[1fr_210px_1fr_1fr_auto] xl:items-end">
      <label className="grid gap-1.5 text-xs font-semibold text-forest-700">{t("farm")}<select value={farmId} onChange={(event) => { const id=event.target.value;setSelectedFarmId(id);setSelectedHouseId("");setFlockId("");setWorkspace(null);setError(null);setFinishIssues([]);setScope((current)=>({...current,farmId:id,houseId:"",flockId:"",batchId:""})); }} className="min-h-12 rounded-xl border border-sand-300 bg-white px-3 text-sm text-forest-900"><option value="">{t("chooseFarm")}</option>{assignedFarms.map((farm)=><option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
      <label className="grid gap-1.5 text-xs font-semibold text-forest-700">{t("workDate")}<input type="date" min={earliestEditableDate(today)} max={today} value={workDate} onChange={(event)=>{setWorkDate(event.target.value);setWorkspace(null);setError(null);setFinishIssues([]);}} className="min-h-12 rounded-xl border border-sand-300 px-3 text-sm" /></label>
      <label className="grid gap-1.5 text-xs font-semibold text-forest-700">{t("house")}<select value={houseId} disabled={!availableHouses.length} onChange={(event)=>{const id=event.target.value;setSelectedHouseId(id);setFlockId("");setScope((current)=>({...current,houseId:id,flockId:"",batchId:""}));}} className="min-h-12 rounded-xl border border-sand-300 bg-white px-3 text-sm text-forest-900 disabled:bg-sand-50"><option value="">{t("chooseHouse")}</option>{availableHouses.map((house)=><option key={house.id} value={house.id}>{house.name}</option>)}</select></label>
      <label className="grid gap-1.5 text-xs font-semibold text-forest-700">{t("flock")}<select value={activeFlockId} disabled={!houseId || !availableFlocks.length} onChange={(event)=>{const id=event.target.value;setFlockId(id);setScope((current)=>({...current,flockId:id,batchId:""}));}} className="min-h-12 rounded-xl border border-sand-300 bg-white px-3 text-sm text-forest-900 disabled:bg-sand-50"><option value="">{t("chooseFlock")}</option>{availableFlocks.map((flock)=><option key={flock.id} value={flock.id}>{flock.code}</option>)}</select></label>
      <button type="button" onClick={reload} disabled={loading||!farmId} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading?"animate-spin motion-reduce:animate-none":""}`} />{t("refresh")}</button>
      <div className="sm:col-span-2 xl:col-span-5 flex flex-wrap items-center justify-between gap-2 border-t border-sand-100 pt-3 text-xs text-forest-600"><span>{workspace?t("currentContext",{farm:workspace.farm.name,date:formatOperationDate(workspace.workDate,locale)}):t("loading")}</span><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold ${online?"bg-leaf-500/10 text-leaf-700":"bg-amber-500/10 text-amber-800"}`}>{online?<Cloud className="h-4 w-4"/>:<CloudOff className="h-4 w-4"/>}{online?t("connection.synced"):t("connection.offline")}</span></div>
    </section>

    {error === "FEATURE_DISABLED" ? <section className="rounded-3xl border border-amber-300 bg-amber-50 p-7 text-center"><h2 className="font-display text-2xl font-semibold text-forest-900">{t("featureDisabled")}</h2><p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-forest-700">{t("featureDisabledHelp")}</p><Link href="/app/farm-manager" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white">{t("openDashboard")}</Link></section>:null}
    {error && error !== "FEATURE_DISABLED" ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error === "ROLE_NOT_ALLOWED"?t("wrongRole"):error === "ASSIGNMENT_REQUIRED"?t("noFarms"):t("loadFailed")}</span><button type="button" onClick={reload} className="min-h-11 rounded-xl border border-red-300 px-4 font-semibold">{t("refresh")}</button></div>:null}
    {(loading || (farmId && !workspace && !error)) ? <div className="grid gap-3 sm:grid-cols-2"><div className="h-40 animate-pulse rounded-2xl bg-sand-100 motion-reduce:animate-none"/><div className="h-40 animate-pulse rounded-2xl bg-sand-100 motion-reduce:animate-none"/></div>:null}

    {workspace && !error ? <>
      {!workspace.flocks.length ? <section className="rounded-3xl border border-dashed border-sand-300 bg-white p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-leaf-600"/><h2 className="mt-3 font-display text-2xl font-semibold text-forest-900">{t("noActiveFlock")}</h2><p className="mt-2 text-sm text-forest-600">{t("noActiveFlockHelp")}</p></section> : null}
      {visibleFlocks.map((flock)=><section key={flock.id} className="overflow-hidden rounded-3xl border border-sand-200 bg-sand-50 shadow-sm"><header className="grid gap-4 border-b border-sand-200 bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-2xl font-semibold text-forest-900">{flock.code}</h2><span className="rounded-full bg-forest-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">{flock.type.replaceAll("_"," ")}</span></div><p className="mt-1 text-sm text-forest-600">{flock.houseLabel}{flock.batchLabel?` · ${flock.batchLabel}`:""} · {t("age",{days:flock.ageDays})}</p></div><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-sand-50 px-3 py-2"><span className="block text-forest-500">{t("openingBirds")}</span><strong className="mt-1 block text-base text-forest-900">{flock.openingBirds===null?"—":formatNumber(flock.openingBirds,locale)}</strong></div><div className="rounded-xl bg-sand-50 px-3 py-2"><span className="block text-forest-500">{t("previousClose")}</span><strong className="mt-1 block text-base text-forest-900">{flock.previousClosingBirds===null?"—":formatNumber(flock.previousClosingBirds,locale)}</strong></div></div></header><div className="grid gap-3 p-4">{flock.tasks.filter((task)=>task.applicable).map((task)=>task.code === "birds" ? <BirdCheckCard key={`${flock.id}:${flock.birdCheck.resourceRevision ?? "new"}`} flock={flock} task={task} farmId={workspace.farm.id} workDate={workspace.workDate} online={online} expanded={openTask===task.code} onToggle={()=>setOpenTask((current)=>current===task.code?null:task.code)} onSaved={()=>saved(task)}/> : <EmbeddedTaskCard key={task.code} task={task} flock={flock} farmId={workspace.farm.id} workDate={workspace.workDate} expanded={openTask===task.code} onToggle={()=>setOpenTask((current)=>current===task.code?null:task.code)} onChanged={reload} onSaved={()=>saved(task)}/>)}</div></section>)}
      <section><div className="mb-3 flex items-center gap-2"><HeartPulse className="h-5 w-5 text-forest-600"/><h2 className="font-display text-xl font-semibold text-forest-900">{t("additional")}</h2></div><div className="grid gap-3">{workspace.farmTasks.filter((task)=>task.applicable).map((task)=><EmbeddedTaskCard key={task.code} task={task} flock={visibleFlocks[0]} farmId={workspace.farm.id} workDate={workspace.workDate} expanded={openTask===task.code} onToggle={()=>setOpenTask((current)=>current===task.code?null:task.code)} onChanged={reload} onSaved={()=>saved(task)} dayRevision={workspace.operatingDay.revision} reviewTasks={reviewTasks} finishIssues={finishIssues} online={online} canFinish={workspace.capabilities.canFinish}/>)}</div></section>
    </>:null}
  </main>;
}
