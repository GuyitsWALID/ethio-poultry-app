"use client";
import {useEffect, useRef, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import Link from "next/link";
import {archivedBirdFields, archivedCycleCorrectionSchema, type ArchivedCorrectionContext, type ArchivedCycleCorrection} from "@/lib/flock-lifecycle/cycle-contracts";
import {formatOperationDate} from "@/i18n/formats";
import type {AppLocale} from "@/i18n/locale";

const control="min-h-12 w-full rounded-xl border border-sand-300 bg-white px-3 text-forest-950";
export function ArchivedCorrection({cycleId}: {cycleId: string}) {
  const t=useTranslations("ArchivedCorrection"), locale=useLocale() as AppLocale;
  const c=useTranslations("FlockCycles");
  const [context,setContext]=useState<ArchivedCorrectionContext|null>(null), [failed,setFailed]=useState(false);
  const [selected,setSelected]=useState<Record<string,Record<string,string>>>({});
  const [reason,setReason]=useState(""), [reference,setReference]=useState("");
  const [busy,setBusy]=useState(false), [request,setRequest]=useState<string|null>(null), [retry,setRetry]=useState(0);
  const [reviewLosses,setReviewLosses]=useState(false), [reviewDepartures,setReviewDepartures]=useState(false);
  const [losses,setLosses]=useState<NonNullable<ArchivedCycleCorrection["loss_events"]>>([]);
  type Departure={flock_id:string;kind:"sale"|"other";quantity:number;sale_id:string;physical_head_count:string;reason:string;supporting_reference:string};
  const [departures,setDepartures]=useState<Departure[]>([]);
  const identity=useRef<{body:string;id:string}|null>(null);
  useEffect(()=>{
    const abort=new AbortController();
    void fetch(`/api/flocks/cycles/corrections?cycle_id=${cycleId}`,{cache:"no-store",signal:abort.signal}).then(async response=>{
      if(!response.ok)throw new Error("unavailable");const data=await response.json() as ArchivedCorrectionContext;
      if(!abort.signal.aborted){setContext(data);setFailed(false);
        if(!reviewLosses)setLosses([...data.lossEvents,...data.records.flatMap(row=>(["death","cull"] as const).flatMap(kind=>{
          const field=kind==="death"?"deaths":"culls";
          return row[field]&&!data.lossEvents.some(e=>e.record_id===row.id&&e.kind===kind)?[{id:crypto.randomUUID(),record_id:row.id,kind,count:row[field]!,explanation:""}]:[];
        }))]);
        if(!reviewDepartures)setDepartures(data.departures.map(d=>({flock_id:d.flock_id,kind:d.kind,quantity:d.quantity,sale_id:d.kind==="sale"?d.sale_id:"",physical_head_count:"",reason:d.kind==="other"?d.reason:"",supporting_reference:d.supporting_reference||""})));
      }
    }).catch(()=>{if(!abort.signal.aborted)setFailed(true);});
    return ()=>abort.abort();
  // Draft toggles intentionally do not trigger a source refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cycleId,retry]);
  async function submit(event:React.FormEvent){
    event.preventDefault();if(!context||busy)return;
    const parsed=archivedCycleCorrectionSchema.safeParse({cycle_id:cycleId,expected_revision:context.cycle.revision,supporting_reference:reference,
      records:Object.entries(selected).map(([id,values])=>({id,...Object.fromEntries(archivedBirdFields.map(field=>[field,values[field]?.trim()===""?null:Number(values[field])]))})),
      ...(reviewLosses?{loss_events:losses.filter(e=>selected[e.record_id])}:{}),
      ...(reviewDepartures?{departures:departures.map(d=>d.kind==="sale"?{kind:d.kind,flock_id:d.flock_id,quantity:d.quantity,sale_id:d.sale_id,sale_revision:context.sales.find(s=>s.id===d.sale_id)?.revision,physical_head_count:d.physical_head_count===""?undefined:Number(d.physical_head_count),supporting_reference:d.supporting_reference||undefined}:{kind:d.kind,flock_id:d.flock_id,quantity:d.quantity,reason:d.reason,supporting_reference:d.supporting_reference})}:{})});
    if(!parsed.success){setFailed(true);return;}
    const intent={request_type:"archived_cycle_correction",farm_id:context.cycle.farmId,reason,proposed_values:parsed.data};
    const body=JSON.stringify(intent);if(identity.current?.body!==body)identity.current={body,id:crypto.randomUUID()};
    setBusy(true);setFailed(false);
    try{
      const response=await fetch("/api/governance/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...intent,idempotency_key:identity.current.id})});
      if(!response.ok)throw new Error("rejected");
      const data=await response.json();setRequest(data.request.id);
    }catch{setFailed(true);}finally{setBusy(false);}
  }
  return <section className="space-y-4 rounded-xl border border-sand-300 p-4" aria-label={t("title")}>
    <h3 className="text-xl font-semibold">{t("title")}</h3><p className="text-sm leading-6">{t("warning")}</p>
    {failed?<p role="alert" className="rounded-xl bg-ember-50 p-3">{t("failed")} <button className="min-h-12 underline" type="button" onClick={()=>setRetry(v=>v+1)}>{t("refresh")}</button></p>:null}
    {!context&&!failed?<p role="status">{t("loading")}</p>:null}
    {request?<p role="status">{t("submitted")} <Link className="inline-flex min-h-12 items-center underline" href={`/app/governance?request=${request}`}>{t("approvals")}</Link></p>:context?<form onSubmit={event=>void submit(event)} className="space-y-4">
      {context.records.map(row=><fieldset key={row.id} className="rounded-xl border border-sand-200 p-3">
        <label className="flex min-h-12 items-center gap-3 font-semibold"><input type="checkbox" className="size-5" checked={Boolean(selected[row.id])} onChange={event=>setSelected(current=>{
          const next={...current};if(event.target.checked)next[row.id]=Object.fromEntries(archivedBirdFields.map(field=>[field,row[field]===null?"":String(row[field])]));else delete next[row.id];return next;
        })}/>{row.flock} · {row.house} · {formatOperationDate(`${row.date}T12:00:00Z`,locale)} {row.final?`· ${t("final")}`:""}</label>
        {selected[row.id]?<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{archivedBirdFields.map(field=><label key={field} className="grid gap-2 text-sm">{t(field)}<input required min={0} max={2147483647} type="number" inputMode="numeric" step={1} className={control} value={selected[row.id][field]} onChange={event=>setSelected(current=>({...current,[row.id]:{...current[row.id],[field]:event.target.value}}))}/></label>)}</div>:null}
      </fieldset>)}
      <label className="flex min-h-12 items-center gap-3"><input type="checkbox" className="size-5" checked={reviewLosses} onChange={e=>setReviewLosses(e.target.checked)}/>{t("reviewLosses")}</label>
      {reviewLosses?<section className="space-y-3"><p>{t("lossHelp")}</p>{losses.map((loss,index)=>selected[loss.record_id]?<fieldset key={loss.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3"><legend>{context.records.find(r=>r.id===loss.record_id)?.flock} · {formatOperationDate(`${context.records.find(r=>r.id===loss.record_id)?.date}T12:00:00Z`,locale)} · {t(loss.kind==="death"?"deaths":"culls")}</legend>
        <label>{t("quantity")}<input className={control} type="number" min={0} max={2147483647} step={1} inputMode="numeric" required value={loss.count} onChange={e=>setLosses(rows=>rows.map((row,i)=>i===index?{...row,count:Number(e.target.value)}:row))}/></label>
        <label className="sm:col-span-2">{t("explanation")}<input className={control} minLength={3} maxLength={1000} required value={loss.explanation} onChange={e=>setLosses(rows=>rows.map((row,i)=>i===index?{...row,explanation:e.target.value}:row))}/></label>
      </fieldset>:null)}{Object.keys(selected).map(id=><div key={id} className="flex flex-wrap gap-3"><span>{context.records.find(r=>r.id===id)?.flock} · {formatOperationDate(`${context.records.find(r=>r.id===id)?.date}T12:00:00Z`,locale)}</span>{(["death","cull"] as const).map(kind=><button type="button" key={kind} className="min-h-12 rounded-xl border px-3" onClick={()=>setLosses(rows=>[...rows,{id:crypto.randomUUID(),record_id:id,kind,count:0,explanation:""}])}>{t(kind==="death"?"addDeath":"addCull")}</button>)}</div>)}</section>:null}
      <label className="flex min-h-12 items-center gap-3"><input type="checkbox" className="size-5" checked={reviewDepartures} onChange={e=>{
        setReviewDepartures(e.target.checked);if(e.target.checked)setSelected(current=>({...current,...Object.fromEntries(context.records.filter(r=>r.final).map(r=>[r.id,current[r.id]||Object.fromEntries(archivedBirdFields.map(field=>[field,r[field]===null?"":String(r[field])]))]))}));
      }}/>{t("reviewDepartures")}</label>
      {reviewDepartures?<section className="space-y-3"><p>{t("departureHelp")}</p>{departures.map((d,index)=><fieldset key={index} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
        <label>{c("flock")}<select className={control} value={d.flock_id} onChange={e=>setDepartures(rows=>rows.map((row,i)=>i===index?{...row,flock_id:e.target.value}:row))}>{context.members.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
        <label>{c("departureType")}<select className={control} value={d.kind} onChange={e=>setDepartures(rows=>rows.map((row,i)=>i===index?{...row,kind:e.target.value as "sale"|"other"}:row))}><option value="sale">{c("sold")}</option><option value="other">{c("otherDeparture")}</option></select></label>
        <label>{c("quantity")}<input className={control} type="number" inputMode="numeric" required min={1} max={2147483647} step={1} value={d.quantity} onChange={e=>setDepartures(rows=>rows.map((row,i)=>i===index?{...row,quantity:Number(e.target.value)}:row))}/></label>
        {d.kind==="sale"?<><label>{t("sale")}<select className={control} required value={d.sale_id} onChange={e=>setDepartures(rows=>rows.map((row,i)=>i===index?{...row,sale_id:e.target.value}:row))}><option value="">{c("choose")}</option>{context.sales.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>{context.sales.find(s=>s.id===d.sale_id)?.unit.toLowerCase()!=="bird"?<label>{t("headCount")}<input className={control} type="number" min={1} max={2147483647} inputMode="numeric" value={d.physical_head_count} onChange={e=>setDepartures(rows=>rows.map((row,i)=>i===index?{...row,physical_head_count:e.target.value}:row))}/></label>:null}</>:<label>{t("reason")}<input className={control} required minLength={8} value={d.reason} onChange={e=>setDepartures(rows=>rows.map((row,i)=>i===index?{...row,reason:e.target.value}:row))}/></label>}
        <label>{t("reference")}<input className={control} required={d.kind==="other"||Boolean(d.physical_head_count)} minLength={3} value={d.supporting_reference} onChange={e=>setDepartures(rows=>rows.map((row,i)=>i===index?{...row,supporting_reference:e.target.value}:row))}/></label>
        <button type="button" className="min-h-12 underline" onClick={()=>setDepartures(rows=>rows.filter((_,i)=>i!==index))}>{t("removeDeparture")}</button>
      </fieldset>)}<button type="button" className="min-h-12 rounded-xl border px-3" onClick={()=>setDepartures(rows=>[...rows,{flock_id:context.members[0].id,kind:"sale",quantity:0,sale_id:"",physical_head_count:"",reason:"",supporting_reference:""}])}>{t("addDeparture")}</button></section>:null}
      <label className="grid gap-2">{t("reference")}<input className={control} required minLength={3} maxLength={1000} value={reference} onChange={e=>setReference(e.target.value)}/></label>
      <label className="grid gap-2">{t("reason")}<textarea className={`${control} py-3`} required minLength={8} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <button disabled={busy||!Object.keys(selected).length} className="min-h-12 rounded-xl bg-forest-900 px-4 font-semibold text-white disabled:opacity-50">{t(busy?"sending":"send")}</button>
    </form>:null}
  </section>;
}
