"use client";

import {Suspense, useEffect, useRef, useState} from "react";
import {useSearchParams} from "next/navigation";
import {useLocale, useTranslations} from "next-intl";
import Link from "next/link";
import {useFarmScope} from "@/components/farm-scope-context";
import {OperationDateInput} from "@/components/operation-date-input";
import {formatNumber, formatOperationDate} from "@/i18n/formats";
import type {AppLocale} from "@/i18n/locale";
import {ArchivedCorrection} from "./archived-correction";
import {createCycleSchema, closeCycleSchema, type CycleContext} from "@/lib/flock-lifecycle/cycle-contracts";

const control = "min-h-12 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-forest-950";
const button = "min-h-12 rounded-xl border border-sand-300 px-4 text-sm font-semibold disabled:opacity-50";
type PlacementDraft = {houseId: string; count: string; batchCode: string; flockCode: string; transport: string; other: string};
type DepartureDraft = {flockId: string; kind: "sale" | "other"; quantity: string; saleId: string; capacity: string; reason: string; reference: string};
type Failure = "unavailable" | "loadFailed" | "invalidFields" | "missingWork" | "submitFailed";
function operatingDate() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(new Date()).map(row => [row.type, row.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

type CycleTarget = {farm: string; cycle: string; batch: string};
export function CycleWorkspace() {
  const t = useTranslations("FlockCycles");
  return <Suspense fallback={<p role="status">{t("loading")}</p>}><CycleWorkspaceFromQuery/></Suspense>;
}
function CycleWorkspaceFromQuery() {
  const params = useSearchParams();
  const target = {farm: params.get("farm_id") || "", cycle: params.get("cycle") || "", batch: params.get("batch") || ""};
  return <CycleWorkspaceContent key={`${target.farm}:${target.cycle}:${target.batch}`} target={target}/>;
}
function CycleWorkspaceContent({target}: {target: CycleTarget}) {
  const t = useTranslations("FlockCycles"), locale = useLocale() as AppLocale;
  const {farms, scope, role} = useFarmScope();
  const [farmId, setFarmId] = useState(() => target.farm || (target.batch || target.cycle ? "" : scope.farmId || ""));
  const [cycleId, setCycleId] = useState(target.cycle), [batchId, setBatchId] = useState(target.batch);
  const [mode, setMode] = useState<"create" | "close">(() => target.cycle || target.batch ? "close" : "create");
  const [day, setDay] = useState(operatingDate), [time, setTime] = useState("");
  const [loaded, setLoaded] = useState<{key: string; context: CycleContext} | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null), [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false), [submitted, setSubmitted] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const submission = useRef<{body: string; id: string} | null>(null);
  const [reason, setReason] = useState(""), [reference, setReference] = useState("");
  const [code, setCode] = useState(""), [purpose, setPurpose] = useState("broiler"), [breed, setBreed] = useState("");
  const [age, setAge] = useState("0"), [supplier, setSupplier] = useState(""), [cost, setCost] = useState("");
  const [confirmed, setConfirmed] = useState(false), [placements, setPlacements] = useState<PlacementDraft[]>([]);
  const [departures, setDepartures] = useState<DepartureDraft[]>([]);
  const key = `${farmId}:${cycleId}:${batchId}:${day}`;
  const context = loaded?.key === key && !["unavailable", "loadFailed"].includes(failure ?? "") ? loaded.context : null;
  useEffect(() => {
    if (!farmId && !cycleId && !batchId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const query = new URLSearchParams({date: day});
        if (farmId) query.set("farm_id", farmId);
        if (cycleId) query.set("cycle_id", cycleId);
        if (batchId) query.set("batch_id", batchId);
        const response = await fetch(`/api/flocks/cycles/context?${query}`, {cache: "no-store", signal: controller.signal});
        if (!response.ok) {if (!controller.signal.aborted) setFailure(response.status === 404 ? "unavailable" : "loadFailed"); return;}
        const result = await response.json() as CycleContext;
        if (!controller.signal.aborted) {setFailure(null); setLoaded({key, context: result});}
      } catch {if (!controller.signal.aborted) setFailure("loadFailed");}
    })();
    return () => controller.abort();
  }, [farmId, cycleId, batchId, day, key, retry]);
  const resetContext = () => {setFailure(null); setLoaded(null); setSubmitted(false); setRequestId(null); setBatchId(""); setPlacements([]); setDepartures([]);};
  const number = (value: number) => formatNumber(value, locale);
  const date = (value: string) => formatOperationDate(`${value}T12:00:00Z`, locale);
  const legacy = context?.cycle?.legacy && context.cycle.status === "archived" && !context.cycle.completionVerified;
  const changeDeparture = (index: number, change: Partial<DepartureDraft>) => setDepartures(rows => rows.map((row, i) => i === index ? {...row, ...change} : row));
  const changePlacement = (index: number, change: Partial<PlacementDraft>) => setPlacements(rows => rows.map((row, i) => i === index ? {...row, ...change} : row));
  const closureReady = Boolean(context?.cycle && (legacy || (context.cycle.status === "active" && context.members.length && context.members.every(member => member.finalRecord && member.feedClosed && member.healthConfirmed && member.suppliesConfirmed && member.balanced && departures.filter(row => row.flockId === member.id).reduce((sum, row) => sum + Number(row.quantity), 0) === member.currentBirds))));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!context || busy || submitted) return;
    setFailure(null);
    const timestamp = `${day}T${time}:00+03:00`;
    const proposed = mode === "create" ? createCycleSchema.safeParse({farm_id: context.farm.id, cycle_code: code, production_purpose: purpose, source: "external_purchase", placed_at: timestamp, actual_date_confirmed: confirmed, age_at_placement_days: Number(age), breed_id: breed || null, supplier_name: supplier, purchase_cost_per_bird: cost === "" ? null : Number(cost), placement_total: placements.reduce((sum, row) => sum + Number(row.count), 0), placements: placements.map(row => ({house_id: row.houseId, expected_revision: context.houses.find(house => house.id === row.houseId)?.revision, starting_birds: Number(row.count), batch_code: row.batchCode, flock_code: row.flockCode, transport_cost: Number(row.transport || 0), other_cost: Number(row.other || 0)}))}) : closeCycleSchema.safeParse({cycle_id: context.cycle?.id, mode: legacy ? "legacy_attestation" : "close", completed_at: timestamp, expected_revision: context.cycle?.revision, supporting_reference: reference || undefined, dispositions: legacy ? [] : departures.map(row => row.kind === "sale" ? {kind: "sale", flock_id: row.flockId, quantity: Number(row.quantity), sale_id: row.saleId, sale_revision: context.sales.find(sale => sale.id === row.saleId)?.revision, physical_head_count: row.capacity === "" ? undefined : Number(row.capacity), supporting_reference: row.reference || undefined} : {kind: "other", flock_id: row.flockId, quantity: Number(row.quantity), reason: row.reason, supporting_reference: row.reference})});
    if (!proposed.success) {setFailure("invalidFields"); return;}
    if (mode === "close" && !closureReady) {setFailure("missingWork"); return;}
    setBusy(true);
    try {
      const intent = {request_type: mode === "create" ? "batch_cycle_create" : "batch_cycle_close", farm_id: context.farm.id, reason, proposed_values: proposed.data};
      const body = JSON.stringify(intent);
      if (submission.current?.body !== body) submission.current = {body, id: crypto.randomUUID()};
      const response = await fetch("/api/governance/requests", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({...intent, idempotency_key: submission.current.id})});
      if (!response.ok) {setFailure("submitFailed"); return;}
      const result = await response.json() as {request?: {id?: string}};
      setRequestId(result.request?.id ?? null);
      setSubmitted(true);
    } catch {setFailure("submitFailed");} finally {setBusy(false);}
  };
  return <section id="batch-cycle-controls" className="space-y-5 rounded-2xl border border-sand-200 bg-white p-5 sm:p-6">
    <header><h2 className="font-display text-2xl font-semibold text-forest-950">{t("title")}</h2><p className="mt-2 text-sm text-forest-700">{t("sequence")}</p></header>
    <label className="grid max-w-lg gap-2 text-sm font-semibold">{t("farm")}<select className={control} value={context?.farm.id || farmId} onChange={event => {resetContext(); setFarmId(event.target.value); setCycleId("");}}><option value="">{t("choose")}</option>{farms.map(farm => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select></label>
    <div role="group" aria-label={t("title")} className="flex flex-wrap gap-2">{(["create", "close"] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} className={`${button} ${mode === value ? "bg-forest-900 text-white" : "text-forest-900"}`} onClick={() => {setFarmId(context?.farm.id || farmId); resetContext(); setMode(value); setCycleId("");}}>{t(value)}</button>)}</div>
    {mode === "close" ? <label className="grid max-w-lg gap-2 text-sm font-semibold">{t("cycle")}<select className={control} value={context?.cycle?.id || cycleId} onChange={event => {setFarmId(context?.farm.id || farmId); resetContext(); setCycleId(event.target.value);}}><option value="">{t("choose")}</option>{(loaded?.context.cycles ?? []).map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.code} · {t(cycle.status === "active" ? "active" : "archived")}</option>)}</select></label> : null}
    {failure ? <div role="alert" className="rounded-xl border border-ember-300 bg-ember-50 p-4"><p>{t(failure)}</p><button type="button" className={`${button} mt-3`} onClick={() => {setFailure(null); setRetry(value => value + 1);}}>{t("refresh")}</button></div> : null}
    {(farmId || cycleId || batchId) && !context && !failure ? <p role="status">{t("loading")}</p> : null}
    {context && role !== "farm_manager" ? <p className="rounded-xl bg-sand-50 p-4">{t("managerProposes")}</p> : null}
    {context?.cycle?.status === "archived" && context.cycle.completionVerified && mode === "close" && role === "farm_manager" ? <ArchivedCorrection key={context.cycle.id} cycleId={context.cycle.id}/> : null}
    {context && role === "farm_manager" && !submitted && (mode === "create" || (context.cycle && !context.cycle.completionVerified)) ? <form onSubmit={event => void submit(event)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">{t(mode === "create" ? "placementDate" : "completionDate")}<OperationDateInput className={control} required value={day} max={operatingDate()} onChange={event => {setFailure(null); setDay(event.target.value);}}/></label><label className="grid gap-2 text-sm font-semibold">{t("time")}<input type="time" className={control} required value={time} onChange={event => setTime(event.target.value)}/></label></div>
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{t(mode === "create" ? "actualDateWarning" : "closeWarning")}</p>
      {mode === "create" ? <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-2 text-sm">{t("cycleCode")}<input className={control} required maxLength={120} value={code} onChange={event => setCode(event.target.value)}/></label>
          <label className="grid gap-2 text-sm">{t("purpose")}<select className={control} value={purpose} onChange={event => setPurpose(event.target.value)}>{(["layer", "broiler", "rearing", "parent_stock"] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
          <label className="grid gap-2 text-sm">{t("breed")}<select className={control} value={breed} onChange={event => setBreed(event.target.value)}><option value="">{t("choose")}</option>{context.breeds.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="grid gap-2 text-sm">{t("arrivalAge")}<input type="number" inputMode="numeric" min={0} max={3650} required className={control} value={age} onChange={event => setAge(event.target.value)}/></label>
          <label className="grid gap-2 text-sm">{t("supplier")}<input className={control} maxLength={200} value={supplier} onChange={event => setSupplier(event.target.value)}/></label>
          <label className="grid gap-2 text-sm">{t("cost")}<input type="number" inputMode="decimal" min={0} step="0.01" className={control} value={cost} onChange={event => setCost(event.target.value)}/></label>
        </div>
        <div className="space-y-3">{context.houses.map(house => {
          const index = placements.findIndex(row => row.houseId === house.id), row = placements[index];
          return <div key={house.id} className="rounded-xl border border-sand-200 p-4"><label className="flex min-h-12 items-center gap-3 font-semibold"><input type="checkbox" className="size-5" checked={index >= 0} disabled={!house.eligible} onChange={event => setPlacements(current => event.target.checked ? [...current, {houseId: house.id, count: "", batchCode: "", flockCode: "", transport: "", other: ""}] : current.filter(item => item.houseId !== house.id))}/>{house.name}</label>{house.blocker ? <p className="text-sm text-amber-900">{t(house.blocker === "OCCUPIED" ? "occupied" : "unverified")}</p> : null}{row ? <div className="mt-3 grid gap-3 sm:grid-cols-3">{(["count", "batchCode", "flockCode", "transport", "other"] as const).map(field => <label key={field} className="grid gap-2 text-sm">{t(field)}<input className={control} type={["count", "transport", "other"].includes(field) ? "number" : "text"} inputMode={field === "count" ? "numeric" : ["transport", "other"].includes(field) ? "decimal" : "text"} min={field === "count" ? 1 : 0} step={field === "count" ? 1 : "0.01"} required={["count", "batchCode", "flockCode"].includes(field)} value={row[field]} onChange={event => changePlacement(index, {[field]: event.target.value})}/></label>)}</div> : null}</div>;
        })}</div>
        <p className="font-semibold">{t("total", {count: number(placements.reduce((sum, row) => sum + Number(row.count), 0))})}</p>
        <label className="flex min-h-12 items-center gap-3 text-sm"><input className="size-5" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>{t("confirmDate")}</label>
      </> : legacy ? <><p className="rounded-xl bg-sand-50 p-4 text-sm">{t("legacyWarning")}</p><label className="grid gap-2 text-sm">{t("reference")}<input className={control} minLength={3} maxLength={1000} required value={reference} onChange={event => setReference(event.target.value)}/></label></> : <>
        <div className="space-y-3">{context.members.map(member => <div className="rounded-xl border border-sand-200 p-4" key={member.id}><h3 className="font-semibold">{member.code} · {member.house}</h3><p className="mt-1 text-sm">{t("remaining", {count: number(member.currentBirds)})}</p><ul className="mt-2 space-y-1 text-sm">{([["finalRecord", member.finalRecord], ["feedClosed", member.feedClosed], ["healthConfirmed", member.healthConfirmed], ["suppliesConfirmed", member.suppliesConfirmed], ["balanced", member.balanced]] as const).map(([label, complete]) => <li key={String(label)}>{t(label)}: {t(complete ? "ready" : "missing")}</li>)}</ul></div>)}</div>
        {departures.map((row, index) => {
          const sale = context.sales.find(item => item.id === row.saleId);
          return <fieldset key={index} className="space-y-3 rounded-xl border border-sand-200 p-4"><legend className="px-2 font-semibold">{t("departure", {number: number(index + 1)})}</legend><div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-2 text-sm">{t("flock")}<select required className={control} value={row.flockId} onChange={event => changeDeparture(index, {flockId: event.target.value})}><option value="">{t("choose")}</option>{context.members.map(member => <option key={member.id} value={member.id}>{member.code} · {member.house}</option>)}</select></label><label className="grid gap-2 text-sm">{t("departureType")}<select className={control} value={row.kind} onChange={event => changeDeparture(index, {kind: event.target.value as "sale" | "other", saleId: ""})}><option value="sale">{t("sold")}</option><option value="other">{t("otherDeparture")}</option></select></label><label className="grid gap-2 text-sm">{t("quantity")}<input type="number" inputMode="numeric" className={control} min={1} required value={row.quantity} onChange={event => changeDeparture(index, {quantity: event.target.value})}/></label></div>
            {row.kind === "sale" ? <><label className="grid gap-2 text-sm">{t("sale")}<select required className={control} value={row.saleId} onChange={event => changeDeparture(index, {saleId: event.target.value, capacity: ""})}><option value="">{t("choose")}</option>{context.sales.map(item => <option key={item.id} value={item.id}>{item.label} · {date(item.date)} · {number(item.quantity)} {item.unit}</option>)}</select></label>{sale ? <p className="text-sm">{t("allocated", {count: number(sale.allocated)})}</p> : null}{sale && sale.unit.trim().toLowerCase() !== "bird" ? <><p className="text-sm text-amber-950">{t("physicalWarning")}</p><label className="grid gap-2 text-sm">{t("physicalCount")}<input type="number" inputMode="numeric" className={control} min={1} required={!sale.headCount} value={row.capacity} placeholder={sale.headCount ? number(sale.headCount) : undefined} onChange={event => changeDeparture(index, {capacity: event.target.value})}/></label></> : null}</> : <label className="grid gap-2 text-sm">{t("departureReason")}<textarea className={control} required minLength={8} maxLength={2000} value={row.reason} onChange={event => changeDeparture(index, {reason: event.target.value})}/></label>}
            <label className="grid gap-2 text-sm">{t("reference")}<input className={control} required={row.kind === "other" || Boolean(sale && sale.unit.trim().toLowerCase() !== "bird" && !sale.headCount)} minLength={3} maxLength={1000} value={row.reference} onChange={event => changeDeparture(index, {reference: event.target.value})}/></label><button type="button" className={button} onClick={() => setDepartures(rows => rows.filter((_, i) => i !== index))}>{t("remove")}</button>
          </fieldset>;
        })}
        <button type="button" className={button} onClick={() => setDepartures(rows => [...rows, {flockId: "", kind: "sale", quantity: "", saleId: "", capacity: "", reason: "", reference: ""}])}>{t("addDeparture")}</button>
        {!closureReady ? <p className="text-sm text-amber-950">{t("missingWork")}</p> : null}
      </>}
      <label className="grid gap-2 text-sm font-semibold">{t("reason")}<textarea className={`${control} py-3`} required minLength={8} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)}/></label>
      <button className={`${button} bg-forest-900 text-white`} disabled={busy || (mode === "close" && !closureReady)}>{t(busy ? "sending" : "send")}</button>
    </form> : null}
    {submitted ? <p role="status" className="rounded-xl bg-leaf-50 p-4">{t("submitted")}</p> : null}
    <Link href={requestId ? `/app/governance?request=${encodeURIComponent(requestId)}` : "/app/governance"} className="inline-flex min-h-12 items-center font-semibold underline">{t("approvals")}</Link>
  </section>;
}
