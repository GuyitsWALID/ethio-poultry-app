"use client";

import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useEffect, useMemo, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {AlertCircle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Info, Plus, Save} from "lucide-react";

import type {TodayFlockContext, TodayTask, TodayTaskDetail} from "@/lib/today-workspace/contracts";
import {todayErrorMessageKeys} from "@/i18n/today-copy";
import {buildFinishReview, type FinishIssue, type ReviewTask} from "@/lib/today-workspace/finish-review";
import {sendTodayCommand} from "@/lib/today-workspace/sync";
import {HealthTaskForm} from "@/components/today/health-task-form";

type Row = Record<string, unknown>;
type SubmitState = {tone: "success" | "error"; text: string} | null;

const inputClass = "min-h-12 rounded-xl border border-sand-300 bg-white px-3 text-base text-forest-900 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-200";
const primaryClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sand-300 bg-white px-4 text-sm font-semibold text-forest-900";

function number(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value as Row[] : [];
}

function stateLabel(task: TodayTask, t: ReturnType<typeof useTranslations>) {
  if (task.state === "complete") return t("states.complete");
  if (task.state === "draft_on_tablet") return t("states.draft");
  if (task.state === "waiting_to_sync") return t("states.waiting");
  if (task.state === "needs_attention") return t("states.needsAttention");
  return t("states.notStarted");
}

function TaskMessage({message}: {message: SubmitState}) {
  if (!message) return null;
  return <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${message.tone === "error" ? "bg-red-50 text-red-800" : "bg-leaf-500/10 text-leaf-700"}`}>{message.text}</p>;
}

function Field({label, name, type = "text", defaultValue, required = false, step, min, readOnly = false}: {label: string; name: string; type?: string; defaultValue?: string | number | null; required?: boolean; step?: string; min?: string; readOnly?: boolean}) {
  return <label className="grid gap-1.5 text-xs font-semibold text-forest-700">{label}<input name={name} type={type} required={required} step={step} min={min} readOnly={readOnly} defaultValue={defaultValue ?? ""} inputMode={type === "number" ? "decimal" : undefined} className={inputClass}/></label>;
}

function SelectField({label, name, children, required = false, defaultValue}: {label: string; name: string; children: React.ReactNode; required?: boolean; defaultValue?: string}) {
  return <label className="grid gap-1.5 text-xs font-semibold text-forest-700">{label}<select name={name} required={required} defaultValue={defaultValue} className={inputClass}>{children}</select></label>;
}

function useTaskSubmit() {
  const errors = useTranslations("Errors");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SubmitState>(null);
  async function submit(command: Parameters<typeof sendTodayCommand>[0], success: string, onApplied: () => void) {
    setSaving(true); setMessage(null);
    try {
      const result = await sendTodayCommand(command);
      if (result.status !== "applied") {
        setMessage({tone: "error", text: result.error_code === "RESOURCE_CONFLICT" ? errors("staleRevision") : result.error_code === "INSUFFICIENT_STOCK" ? errors("insufficientStock") : errors("validation")});
        return result;
      }
      setMessage({tone: "success", text: success});
      onApplied();
      return result;
    } catch {
      setMessage({tone: "error", text: errors("unknown")});
      return null;
    } finally { setSaving(false); }
  }
  return {saving, message, submit};
}

function EggsWaterForm({detail, flock, onSaved}: {detail: TodayTaskDetail; flock: TodayFlockContext; onSaved: () => void}) {
  const t = useTranslations("Today.embedded");
  const {saving, message, submit} = useTaskSubmit();
  const daily = (detail.data.dailyRecord ?? {}) as Row;
  const hasEggs = ["layer", "parent_stock"].includes(String(detail.data.flockType));
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const normal = number(form.get("normal_eggs")); const broken = number(form.get("broken_eggs")); const dirty = number(form.get("dirty_eggs"));
    await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "save_daily_record", farm_id: detail.farmId, flock_id: flock.id, work_date: detail.workDate, expected_resource_revision: detail.resourceRevision, payload: {daily_record_id: daily.id ? String(daily.id) : null, record: {record_date: detail.workDate, water_consumed_liters: number(form.get("water")), ...(hasEggs ? {normal_eggs: normal, broken_eggs: broken, dirty_eggs: dirty, total_eggs: normal + broken + dirty, average_egg_weight_g: number(form.get("egg_weight")) || null} : {})}, usages: null}}, t("saved"), onSaved);
  }
  return <form onSubmit={save} className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><Field label={t("waterLiters")} name="water" type="number" min="0" step="0.1" required defaultValue={daily.water_consumed_liters as number}/>{hasEggs ? <><Field label={t("normalEggs")} name="normal_eggs" type="number" min="0" step="1" required defaultValue={daily.normal_eggs as number}/><Field label={t("brokenEggs")} name="broken_eggs" type="number" min="0" step="1" required defaultValue={daily.broken_eggs as number}/><Field label={t("dirtyEggs")} name="dirty_eggs" type="number" min="0" step="1" required defaultValue={daily.dirty_eggs as number}/><Field label={t("eggWeight")} name="egg_weight" type="number" min="0" step="0.1" defaultValue={daily.average_egg_weight_g as number}/></> : null}</div><TaskMessage message={message}/><div className="flex justify-end"><button disabled={saving} className={primaryClass}><Save className="h-4 w-4"/>{saving ? t("saving") : t("saveContinue")}</button></div></form>;
}

function FeedingForm({detail, flock, onChanged, onSaved}: {detail: TodayTaskDetail; flock: TodayFlockContext; onChanged: () => void; onSaved: () => void}) {
  const t = useTranslations("Today.embedded");
  const {saving, message, submit} = useTaskSubmit();
  const sessions = rows(detail.data.sessions);
  const closed = detail.data.closed === true;
  const [editingId, setEditingId] = useState<string | null>(null);
  const session = sessions.find((row) => String(row.id) === editingId) ?? {};
  const feedItems = detail.inventory.filter((item) => item.category === "feed");
  const [status, setStatus] = useState<"completed" | "missed">("completed");
  const [revision, setRevision] = useState(detail.resourceRevision);
  const [sessionDependencies, setSessionDependencies] = useState<string[]>([]);
  const mayClose = sessions.length > 0 && sessions.every((row) => row.status === "completed" || row.status === "missed") && editingId === null;
  function editSession(row: Row) {
    setEditingId(String(row.id));
    setStatus(row.status === "missed" ? "missed" : "completed");
  }
  function addSession() {
    setEditingId("new");
    setStatus("completed");
  }
  async function saveSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const commandId = crypto.randomUUID();
    const result = await submit({
      schema_version: 1, command_id: commandId, type: "save_feed_session",
      farm_id: detail.farmId, flock_id: flock.id, work_date: detail.workDate,
      expected_resource_revision: revision,
      payload: {session_id: session.id ? String(session.id) : null, session: {
        session_name: text(form.get("session_name")),
        session_time: text(form.get("session_time")) || null,
        feeders_count: number(form.get("feeders")),
        planned_feed_kg: number(form.get("planned")),
        actual_feed_kg: status === "completed" ? number(form.get("actual")) : null,
        feed_item_id: status === "completed" ? text(form.get("feed_item")) || null : null,
        warehouse_id: status === "completed" ? text(form.get("warehouse")) || null : null,
        feed_type: text(form.get("feed_type")) as "starter_feed" | "grower_pullet_feed" | "layer_feed" | "broiler_feed" | "medicated_feed",
        status, notes: text(form.get("notes")) || null,
      }},
    }, t("sessionSaved"), () => {});
    if (result?.status === "applied") {
      setRevision(result.resource_revision ?? revision);
      setSessionDependencies((current) => [...new Set([...current, commandId])]);
      setEditingId(null);
      onChanged();
    }
  }
  async function closeDay() {
    if (!revision || !mayClose) return;
    await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "close_feed_day", farm_id: detail.farmId, flock_id: flock.id, work_date: detail.workDate, expected_resource_revision: revision, depends_on: sessionDependencies.length ? sessionDependencies : undefined, payload: {}}, t("feedClosed"), onSaved);
  }
  if (closed) return <div className="rounded-xl bg-leaf-500/10 p-4 text-sm font-semibold text-leaf-700"><CheckCircle2 className="mr-2 inline h-4 w-4"/>{t("feedAlreadyClosed")}</div>;
  return <div className="grid gap-4">
    <div className="grid gap-2" aria-label={t("feedingSessions")}>
      {sessions.map((row, index) => <div key={String(row.id)} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-sand-200 px-3 py-2 text-sm">
        <span><span className="font-semibold">{String(row.session_name || t("feedingNumber", {number: index + 1}))}</span><span className="ml-2 text-forest-600">{String(row.session_time ?? "").slice(0, 5)} · {row.status === "completed" ? t("done") : row.status === "missed" ? t("missed") : t("pending")}</span></span>
        <button type="button" onClick={() => editSession(row)} className="min-h-11 rounded-lg px-3 font-semibold text-forest-800 underline">{t("editFeeding")}</button>
      </div>)}
    </div>
    <button type="button" onClick={addSession} className={`${secondaryClass} w-fit`}><Plus className="h-5 w-5"/>{t("addFeeding")}</button>
    {editingId ? <form key={editingId} onSubmit={saveSession} className="grid gap-4 rounded-xl border border-sand-200 p-4">
      <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-semibold text-forest-900">{t("feedingResult")}</legend>
        {(["completed", "missed"] as const).map((choice) => <label key={choice} className="flex min-h-12 items-center gap-3 text-sm text-forest-900">
          <input type="checkbox" checked={status === choice} onChange={() => setStatus(choice)} className="h-5 w-5 accent-forest-900"/>
          <span>{t(choice)}</span>
          <span tabIndex={0} title={t(choice === "completed" ? "fedHelp" : "missedHelp")} aria-label={t(choice === "completed" ? "fedHelp" : "missedHelp")} className="cursor-help text-forest-600"><Info className="h-4 w-4"/></span>
        </label>)}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("sessionName")} name="session_name" required readOnly={Boolean(session.id)} defaultValue={String(session.session_name ?? t("feedingNumber", {number: sessions.length + 1}))}/>
        <Field label={t("sessionTime")} name="session_time" type="time" required defaultValue={String(session.session_time ?? "").slice(0, 5)}/>
        <Field label={t("feeders")} name="feeders" type="number" min="1" step="1" required defaultValue={Number(session.feeders_count ?? 1)}/>
        <Field label={t("plannedKg")} name="planned" type="number" min="0.01" step="0.01" required defaultValue={session.planned_feed_kg as number | null}/>
        {status === "completed" ? <>
          <Field label={t("actualKg")} name="actual" type="number" min="0" step="0.01" required defaultValue={(session.actual_feed_kg ?? session.planned_feed_kg) as number | null}/>
          <SelectField label={t("feedItem")} name="feed_item" required defaultValue={String(session.feed_item_id ?? "")}><option value="">{t("choose")}</option>{feedItems.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</SelectField>
          <SelectField label={t("warehouse")} name="warehouse" required defaultValue={String(session.warehouse_id ?? "")}><option value="">{t("choose")}</option>{detail.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</SelectField>
        </> : null}
        <SelectField label={t("feedType")} name="feed_type" required defaultValue={String(session.feed_type ?? detail.data.scheduledFeedType ?? "layer_feed")}><option value="starter_feed">{t("feedTypes.starter")}</option><option value="grower_pullet_feed">{t("feedTypes.grower")}</option><option value="layer_feed">{t("feedTypes.layer")}</option><option value="broiler_feed">{t("feedTypes.broiler")}</option><option value="medicated_feed">{t("feedTypes.medicated")}</option></SelectField>
      </div>
      <Field label={status === "missed" ? t("missedReason") : t("notes")} name="notes" required={status === "missed"} defaultValue={String(session.notes ?? "")}/>
      <TaskMessage message={message}/>
      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className={secondaryClass}>{t("cancelFeeding")}</button><button disabled={saving} className={primaryClass}><Save className="h-4 w-4"/>{t("saveSession")}</button></div>
    </form> : null}
    {!editingId ? <div className="flex justify-end"><button type="button" disabled={saving || !mayClose} onClick={() => void closeDay()} className={primaryClass}>{t("closeFeedDay")}</button></div> : null}
    <TaskMessage message={message}/>
  </div>;
}



function SuppliesForm({detail, flock, task, onSaved}: {detail: TodayTaskDetail; flock: TodayFlockContext; task: TodayTask; onSaved: () => void}) {
  const t = useTranslations("Today.embedded");
  const {saving, message, submit} = useTaskSubmit();
  const [none, setNone] = useState(true);
  const [supplyRows, setSupplyRows] = useState([0]);
  const eligible = detail.inventory.filter((item) => ["vitamin", "supplement", "equipment", "spare_parts", "packaging", "miscellaneous"].includes(item.category));
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (none) {
      await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "confirm_no_activity", farm_id: detail.farmId, flock_id: flock.id, work_date: detail.workDate, payload: {task_code: "routine_supplies", source_fingerprint: String(task.sourceFingerprint ?? "")}}, t("confirmedNone"), onSaved);
      return;
    }
    const form = new FormData(event.currentTarget);
    const usages = supplyRows.map((row) => ({item_id: text(form.get(`item_${row}`)), warehouse_id: text(form.get(`warehouse_${row}`)), quantity: number(form.get(`quantity_${row}`))}));
    await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "save_daily_record", farm_id: detail.farmId, flock_id: flock.id, work_date: detail.workDate, expected_resource_revision: detail.resourceRevision, payload: {daily_record_id: String(((detail.data.dailyRecord as Row | null)?.id) ?? "") || null, record: {record_date: detail.workDate}, usages}}, t("suppliesSaved"), onSaved);
  }
  return <form onSubmit={save} className="grid gap-4"><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setNone(true)} className={none ? primaryClass : secondaryClass}>{t("nothingUsed")}</button><button type="button" onClick={() => setNone(false)} className={!none ? primaryClass : secondaryClass}>{t("recordSupply")}</button></div>{!none ? <div className="grid gap-3">{supplyRows.map((row, index) => <div key={row} className="grid gap-3 rounded-xl border border-sand-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><SelectField label={t("item")} name={`item_${row}`} required><option value="">{t("choose")}</option>{eligible.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</SelectField><SelectField label={t("warehouse")} name={`warehouse_${row}`} required><option value="">{t("choose")}</option>{detail.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</SelectField><Field label={t("quantity")} name={`quantity_${row}`} type="number" min="0.01" step="0.01" required/>{index > 0 ? <button type="button" onClick={() => setSupplyRows((current) => current.filter((value) => value !== row))} className={secondaryClass}>{t("remove")}</button> : <span/>}</div>)}<button type="button" onClick={() => setSupplyRows((current) => [...current, Math.max(...current) + 1])} className={secondaryClass}>{t("addSupply")}</button></div> : null}<TaskMessage message={message}/><div className="flex justify-end"><button disabled={saving} className={primaryClass}><Save className="h-4 w-4"/>{none ? t("confirmNothing") : t("saveContinue")}</button></div></form>;
}

function SimpleFarmForm({detail, task, onChanged, onSaved, dayRevision, reviewTasks = [], finishIssues = [], online = true, canFinish = false}: {detail: TodayTaskDetail; task: TodayTask; onChanged: () => void; onSaved: () => void; dayRevision?: string; reviewTasks?: ReviewTask[]; finishIssues?: FinishIssue[]; online?: boolean; canFinish?: boolean}) {
  const t = useTranslations("Today.embedded");
  const taskNames = useTranslations("Today.tasks");
  const errorMessages = useTranslations("Errors");
  const {saving, message, submit} = useTaskSubmit();
  const query = useSearchParams();
  const requestedWarehouse = query.get("warehouse_id") ?? "";
  const initialWarehouse = detail.warehouses.some((row) => row.id === requestedWarehouse) ? requestedWarehouse : "";
  const [stockMode, setStockMode] = useState<"receipt" | "count">(query.get("stock_mode") === "count" ? "count" : "receipt");
  const [countWarehouse, setCountWarehouse] = useState(initialWarehouse);
  const finishCommandId = useRef(crypto.randomUUID());
  const dueWarehouses = new Set(Array.isArray(detail.data.countDueWarehouseIds) ? detail.data.countDueWarehouseIds.map(String) : []);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (task.code === "stock" && stockMode === "receipt") {
      await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "record_stock_receipt", farm_id: detail.farmId, work_date: detail.workDate, payload: {warehouse_id: text(form.get("warehouse")), item_id: text(form.get("item")), quantity: number(form.get("quantity")), unit_cost: number(form.get("unit_cost")), details: {procurement_type: "miscellaneous", supplier_name: text(form.get("supplier")) || null, invoice_number: text(form.get("invoice")) || null}}}, t("stockSaved"), onSaved);
      return;
    }
    if (task.code === "stock") {
      const items = detail.inventory.filter((item) => item.balances.some((balance) => balance.warehouseId === countWarehouse));
      await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "record_stock_count", farm_id: detail.farmId, work_date: detail.workDate, payload: {warehouse_id: countWarehouse, rows: items.map((item) => ({item_id: item.id, counted_quantity: number(form.get(`count_${item.id}`))})), notes: text(form.get("notes")) || null}}, t("stockCountSaved"), onSaved);
      return;
    }
    if (task.code === "sales") {
      await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "record_sale", farm_id: detail.farmId, flock_id: detail.flockId ?? undefined, work_date: detail.workDate, payload: {product_category: text(form.get("category")) as "egg" | "bird" | "training" | "equipment_medicine" | "consultancy" | "package", product_label: text(form.get("label")), quantity: number(form.get("quantity")), unit_price: number(form.get("unit_price")), paid_amount: number(form.get("paid")), unit: text(form.get("unit"))}}, t("saleSaved"), onSaved);
      return;
    }
    if (task.code === "expenses") {
      await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "record_expense", farm_id: detail.farmId, flock_id: detail.flockId ?? undefined, work_date: detail.workDate, payload: {category: text(form.get("category")) as "feed" | "medicine" | "vaccine" | "vitamin" | "supplement" | "payroll" | "utility" | "biosecurity" | "transport" | "maintenance" | "labor" | "rent" | "packaging" | "miscellaneous", description: text(form.get("description")), amount: number(form.get("amount")), allocation_method: "direct", entry_kind: "one_off", warehouse_id: text(form.get("warehouse")) || null}}, t("expenseSaved"), onSaved);
      return;
    }
    if (task.code === "review_finish") {
      const result = await submit({schema_version: 1, command_id: finishCommandId.current, type: "finish_operating_day", farm_id: detail.farmId, work_date: detail.workDate, expected_resource_revision: dayRevision ?? "", payload: {}}, t("dayFinished"), onSaved);
      if (result?.status === "applied") finishCommandId.current = crypto.randomUUID();
    }
  }
  if(task.code==="review_finish"){
    const review=buildFinishReview(reviewTasks,finishIssues);
    const label=(code:TodayTask["code"])=>taskNames(({birds:"birds",feeding:"feeding",eggs_water:"eggsWater",health_deaths:"healthDeaths",routine_supplies:"supplies",review_finish:"review",stock:"stock",sales:"sales",expenses:"expenses",assigned_fixes:"assignedFixes"} as const)[code]);
    const group=(title:string,items:ReviewTask[],tone:string)=><div className={`rounded-xl border p-4 ${tone}`}><p className="text-xs font-semibold uppercase tracking-wider">{title} · {items.length}</p>{items.length?<ul className="mt-2 grid gap-1 text-sm">{items.map((item,index)=><li key={`${item.contextLabel??"farm"}:${item.code}:${index}`}>• {item.contextLabel?<span className="font-semibold">{item.contextLabel}: </span>:null}{label(item.code)}</li>)}</ul>:<p className="mt-2 text-sm">{t("reviewNone")}</p>}</div>;
    const issueGroup=(title:string,items:FinishIssue[],tone:string)=><div className={`rounded-xl border p-4 ${tone}`}><p className="text-xs font-semibold uppercase tracking-wider">{title} · {items.length}</p>{items.length?<ul className="mt-2 grid gap-1 text-sm">{items.map((item)=><li key={item.commandId}>• {item.errorCode?errorMessages(todayErrorMessageKeys[item.errorCode]):t("issueUnknown")}</li>)}</ul>:<p className="mt-2 text-sm">{t("reviewNone")}</p>}</div>;
    const closed=detail.data.status==="closed"||task.state==="complete";
    if(closed)return <div role="status" className="rounded-xl border border-leaf-200 bg-leaf-500/10 p-5 text-sm font-semibold text-leaf-800"><CheckCircle2 className="mr-2 inline h-5 w-5"/>{t("alreadyFinished")}</div>;
    const blocked=review.missing.length+review.queued.length+review.attention.length+review.conflicts.length+review.rejected.length>0;
    return <form onSubmit={save} className="grid gap-4"><p className="rounded-xl bg-sand-50 p-4 text-sm text-forest-700">{t("finishHelp")}</p><div className="grid gap-3 sm:grid-cols-2">{group(t("reviewCompleted"),review.completed,"border-leaf-200 bg-leaf-500/5 text-leaf-800")}{group(t("reviewMissing"),review.missing,"border-amber-200 bg-amber-50 text-amber-900")}{group(t("reviewUnsynced"),review.queued,"border-sky-200 bg-sky-50 text-sky-900")}{group(t("reviewProblems"),review.attention,"border-red-200 bg-red-50 text-red-900")}{issueGroup(t("reviewConflicts"),review.conflicts,"border-red-200 bg-red-50 text-red-900")}{issueGroup(t("reviewRejected"),review.rejected,"border-red-200 bg-red-50 text-red-900")}</div>{!online?<p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">{t("connectToFinish")}</p>:null}<TaskMessage message={message}/><div className="flex flex-wrap justify-end gap-2">{blocked?<button type="button" onClick={onChanged} className={secondaryClass}>{t("refreshReview")}</button>:null}<button disabled={saving||!online||!canFinish||blocked} className={primaryClass}>{saving?t("finishing"):t("finishDay")}</button></div></form>;
  }
  if (task.code === "stock") {
    const countItems = detail.inventory.filter((item) => item.balances.some((balance) => balance.warehouseId === countWarehouse));
    return <form onSubmit={save} className="grid gap-4"><div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => setStockMode("receipt")} className={stockMode === "receipt" ? primaryClass : secondaryClass}>{t("receiveStock")}</button><button type="button" onClick={() => setStockMode("count")} className={stockMode === "count" ? primaryClass : secondaryClass}>{t("countStock")}</button></div>{stockMode === "receipt" ? <div className="grid gap-3 sm:grid-cols-2"><SelectField label={t("warehouse")} name="warehouse" required defaultValue={initialWarehouse}><option value="">{t("choose")}</option>{detail.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectField><SelectField label={t("item")} name="item" required><option value="">{t("choose")}</option>{detail.inventory.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</SelectField><Field label={t("quantity")} name="quantity" type="number" min="0.01" step="0.01" required/><Field label={t("unitCost")} name="unit_cost" type="number" min="0" step="0.01" required/><Field label={t("supplier")} name="supplier"/><Field label={t("invoice")} name="invoice"/></div> : <div className="grid gap-4"><label className="grid gap-1.5 text-xs font-semibold text-forest-700">{t("warehouse")}<select name="count_warehouse" required value={countWarehouse} onChange={(event) => setCountWarehouse(event.target.value)} className={inputClass}><option value="">{t("choose")}</option>{detail.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{dueWarehouses.has(w.id) ? ` · ${t("countDue")}` : ""}</option>)}</select></label><div className="grid gap-3">{countWarehouse ? countItems.map((item) => {const balance = item.balances.find((row) => row.warehouseId === countWarehouse)?.quantity ?? 0; return <Field key={item.id} label={`${item.name} (${item.unit})`} name={`count_${item.id}`} type="number" min="0" step="0.01" required defaultValue={balance}/>;}) : <p className="rounded-xl bg-sand-50 p-4 text-sm text-forest-700">{t("chooseWarehouseToCount")}</p>}</div><Field label={t("notes")} name="notes"/></div>}<TaskMessage message={message}/><div className="flex justify-end"><button disabled={saving || (stockMode === "count" && (!countWarehouse || countItems.length === 0))} className={primaryClass}>{stockMode === "receipt" ? t("receiveStock") : t("saveStockCount")}</button></div></form>;
  }
  if(task.code==="sales")return <form onSubmit={save} className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><SelectField label={t("category")} name="category" required><option value="egg">{t("eggs")}</option><option value="bird">{t("birds")}</option><option value="training">{t("training")}</option><option value="equipment_medicine">{t("equipmentMedicine")}</option><option value="consultancy">{t("consultancy")}</option><option value="package">{t("package")}</option></SelectField><Field label={t("product")} name="label" required/><Field label={t("quantity")} name="quantity" type="number" min="0.01" step="0.01" required/><Field label={t("unit")} name="unit" required/><Field label={t("unitPrice")} name="unit_price" type="number" min="0" step="0.01" required/><Field label={t("paid")} name="paid" type="number" min="0" step="0.01" required/></div><TaskMessage message={message}/><div className="flex justify-end"><button disabled={saving} className={primaryClass}>{t("recordSale")}</button></div></form>;
  return <form onSubmit={save} className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><SelectField label={t("category")} name="category" required><option value="feed">{t("feed")}</option><option value="medicine">{t("medicine")}</option><option value="utility">{t("utility")}</option><option value="transport">{t("transport")}</option><option value="maintenance">{t("maintenance")}</option><option value="labor">{t("labor")}</option><option value="miscellaneous">{t("miscellaneous")}</option></SelectField><Field label={t("description")} name="description" required/><Field label={t("amountEtb")} name="amount" type="number" min="0.01" step="0.01" required/><SelectField label={t("warehouseOptional")} name="warehouse" defaultValue={initialWarehouse}><option value="">{t("none")}</option>{detail.warehouses.map((w)=><option key={w.id} value={w.id}>{w.name}</option>)}</SelectField></div><TaskMessage message={message}/><div className="flex justify-end"><button disabled={saving} className={primaryClass}>{t("recordExpense")}</button></div></form>;
}

function AssignedFixes({detail, onChanged, onSaved}: {detail: TodayTaskDetail; onChanged: () => void; onSaved: () => void}) {
  const t = useTranslations("Today.embedded");
  const {saving, message, submit} = useTaskSubmit();
  const actions = rows(detail.data.actions);
  async function update(action: Row, eventType: "acknowledged" | "started" | "completion_submitted") {
    const note = eventType === "completion_submitted" ? window.prompt(t("completionNote"))?.trim() : t(eventType === "acknowledged" ? "acknowledgedNote" : "startedNote");
    if (!note) return;
    await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "update_assigned_action", farm_id: detail.farmId, work_date: detail.workDate, payload: {action_id: String(action.id), event_type: eventType, note}}, t("fixUpdated"), eventType === "completion_submitted" ? onSaved : onChanged);
  }
  if (!actions.length) return <p className="rounded-xl bg-leaf-500/10 p-4 text-sm text-leaf-700">{t("noAssignedFixes")}</p>;
  return <div className="grid gap-3">{actions.map((action) => <article key={String(action.id)} className="rounded-xl border border-sand-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-forest-900">{String(action.title)}</h4><p className="mt-1 text-sm text-forest-600">{String(action.context)}</p></div><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{String(action.status)}</span></div><div className="mt-3 flex flex-wrap gap-2"><button disabled={saving} onClick={() => void update(action, "acknowledged")} className={secondaryClass}>{t("acknowledge")}</button><button disabled={saving} onClick={() => void update(action, "started")} className={secondaryClass}>{t("start")}</button><button disabled={saving} onClick={() => void update(action, "completion_submitted")} className={primaryClass}>{t("submitCompletion")}</button>{action.source_route ? <Link href={String(action.source_route)} className={secondaryClass}>{t("openEvidence")}<ExternalLink className="h-4 w-4"/></Link> : null}</div></article>)}<TaskMessage message={message}/></div>;
}

export function EmbeddedTaskCard({task,flock,farmId,workDate,expanded,onToggle,onChanged,onSaved,dayRevision,reviewTasks,finishIssues,online,canFinish}:{task:TodayTask;flock?:TodayFlockContext;farmId:string;workDate:string;expanded:boolean;onToggle:()=>void;onChanged:()=>void;onSaved:()=>void;dayRevision?:string;reviewTasks?:ReviewTask[];finishIssues?:FinishIssue[];online?:boolean;canFinish?:boolean}){
  const t=useTranslations("Today");const [detail,setDetail]=useState<TodayTaskDetail|null>(null);const [loading,setLoading]=useState(false);const [loadError,setLoadError]=useState(false);
  const flockId=flock?.id;
  useEffect(()=>{if(!expanded)return;const controller=new AbortController();const params=new URLSearchParams({farm_id:farmId,date:workDate});if(flockId)params.set("flock_id",flockId);const load=async()=>{setLoading(true);setLoadError(false);try{const response=await fetch(`/api/farm-manager/today/tasks/${task.code}?${params}`,{cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error();setDetail(await response.json() as TodayTaskDetail)}catch(error:unknown){if(error instanceof DOMException&&error.name==="AbortError")return;setLoadError(true)}finally{if(!controller.signal.aborted)setLoading(false)}};void load();return()=>controller.abort()},[expanded,farmId,flockId,task.code,task.resourceRevision,workDate]);
  const title=t(({birds:"tasks.birds",feeding:"tasks.feeding",eggs_water:"tasks.eggsWater",health_deaths:"tasks.healthDeaths",routine_supplies:"tasks.supplies",review_finish:"tasks.review",stock:"tasks.stock",sales:"tasks.sales",expenses:"tasks.expenses",assigned_fixes:"tasks.assignedFixes"} as const)[task.code]);
  const exampleKey=({birds:"embedded.examples.birds",feeding:"embedded.examples.feeding",eggs_water:"embedded.examples.eggsWater",health_deaths:"embedded.examples.healthDeaths",routine_supplies:"embedded.examples.supplies",review_finish:"embedded.examples.review",stock:"embedded.examples.stock",sales:"embedded.examples.sales",expenses:"embedded.examples.expenses",assigned_fixes:"embedded.examples.assignedFixes"} as const)[task.code];
  const summary=useMemo(()=>{
    if(task.state==="needs_attention") return t("embedded.attentionSummary");
    if(task.state!=="complete") return t("embedded.readySummary");
    if(task.code==="feeding"&&flock?.feedActualKg!=null) return t("embedded.feedSummary",{amount:flock.feedActualKg});
    if(task.code==="eggs_water"&&flock) return t("embedded.eggsWaterSummary",{water:flock.eggsWaterSummary.waterLiters??0,eggs:flock.eggsWaterSummary.totalEggs??0});
    if(task.code==="health_deaths"&&flock) return flock.healthSummary.confirmedNone?t("embedded.healthNoneSummary"):t("embedded.healthRecordedSummary");
    if(task.code==="routine_supplies"&&flock) return flock.suppliesSummary.confirmedNone?t("embedded.suppliesNoneSummary"):t("embedded.suppliesRecordedSummary");
    return t("embedded.completedSummary");
  },[flock,t,task.code,task.state]);
  return <article id={`today-task-${task.code}`} tabIndex={-1} className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm"><button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-h-16 w-full items-center justify-between gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-forest-700"><span><span className="font-semibold text-forest-900">{title}</span><span className="mt-1 block text-xs text-forest-600">{summary}</span></span><span className="flex items-center gap-2"><span className="rounded-full bg-sand-100 px-2.5 py-1 text-[11px] font-semibold text-forest-700">{stateLabel(task,t)}</span>{expanded?<ChevronUp className="h-5 w-5"/>:<ChevronDown className="h-5 w-5"/>}</span></button>{expanded?<div className="border-t border-sand-200 p-4">{loading?<p role="status" className="py-6 text-sm text-forest-600">{t("loading")}</p>:loadError?<div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-4 w-4"/>{t("loadFailed")}</div>:detail?<div className="grid gap-4"><p className="rounded-xl bg-sand-50 p-3 text-sm text-forest-600">{t(exampleKey)}</p>{task.code==="feeding"&&flock?<FeedingForm key={detail.resourceRevision??"new"} detail={detail} flock={flock} onChanged={onChanged} onSaved={onSaved}/>:null}{task.code==="eggs_water"&&flock?<EggsWaterForm detail={detail} flock={flock} onSaved={onSaved}/>:null}{task.code==="health_deaths"&&flock?<HealthTaskForm detail={detail} flock={flock} onChanged={onChanged} onSaved={onSaved}/>:null}{task.code==="routine_supplies"&&flock?<SuppliesForm detail={detail} flock={flock} task={task} onSaved={onSaved}/>:null}{["stock","sales","expenses","review_finish"].includes(task.code)?<SimpleFarmForm detail={detail} task={task} onChanged={onChanged} onSaved={onSaved} dayRevision={dayRevision} reviewTasks={reviewTasks} finishIssues={finishIssues} online={online} canFinish={canFinish}/>:null}{task.code==="assigned_fixes"?<AssignedFixes detail={detail} onChanged={onChanged} onSaved={onSaved}/>:null}</div>:null}</div>:null}</article>;
}
