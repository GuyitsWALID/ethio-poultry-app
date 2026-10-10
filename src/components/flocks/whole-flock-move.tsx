"use client";

import {useEffect, useRef, useState} from "react";
import Link from "next/link";
import {useLocale, useTranslations} from "next-intl";
import {useFarmScope} from "@/components/farm-scope-context";
import {OperationDateInput} from "@/components/operation-date-input";
import {formatNumber} from "@/i18n/formats";
import type {AppLocale} from "@/i18n/locale";
import {wholeFlockMoveSchema, type CycleContext, type MovementContext} from "@/lib/flock-lifecycle/cycle-contracts";

const inputClass="min-h-12 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm text-forest-950";
const buttonClass="min-h-12 rounded-xl border border-sand-300 px-4 text-sm font-semibold disabled:opacity-50";

export function WholeFlockMove({flockId}: {flockId: string}) {
  const {role} = useFarmScope();
  return role === "farm_manager" ? <MoveForm key={flockId} flockId={flockId}/> : null;
}

function MoveForm({flockId}: {flockId: string}) {
  const t=useTranslations("FlockMove"), locale=useLocale() as AppLocale;
  const {farms}=useFarmScope();
  const [open,setOpen]=useState(false), [farm,setFarm]=useState("");
  const [source,setSource]=useState<MovementContext|null>(null), [destination,setDestination]=useState<CycleContext|null>(null);
  const [house,setHouse]=useState(""), [day,setDay]=useState(""), [time,setTime]=useState(""), [reason,setReason]=useState("");
  const [error,setError]=useState(false), [busy,setBusy]=useState(false), [request,setRequest]=useState<string|null>(null);
  const submission=useRef<{body:string;id:string}|null>(null);
  useEffect(()=>{
    if(!open)return;
    const controller=new AbortController();
    void fetch(`/api/flocks/${flockId}/movement-context`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error();setSource(await response.json() as MovementContext);})
      .catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();
  },[open,flockId]);
  useEffect(()=>{
    if(!open||!farm)return;
    const controller=new AbortController();
    void fetch(`/api/flocks/cycles/context?${new URLSearchParams({farm_id:farm})}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error();setDestination(await response.json() as CycleContext);})
      .catch(()=>{if(!controller.signal.aborted)setError(true);});
    return()=>controller.abort();
  },[open,farm]);
  async function submit(event: React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!source?.flock.eligible||!destination)return;
    const target=destination.houses.find(row=>row.id===house&&row.eligible);
    const parsed=wholeFlockMoveSchema.safeParse({flock_id:flockId,from_house_id:source.flock.houseId,farm_id:farm,house_id:house,
      bird_count:source.flock.birds,moved_at:`${day}T${time}:00+03:00`,expected_revision:source.flock.revision,destination_revision:target?.revision});
    if(!parsed.success||reason.trim().length<8){setError(true);return;}
    const body=JSON.stringify({request_type:"flock_transfer",farm_id:source.flock.farmId,reason:reason.trim(),proposed_values:parsed.data});
    if(submission.current?.body!==body)submission.current={body,id:crypto.randomUUID()};
    setBusy(true);setError(false);
    try{
      const response=await fetch("/api/governance/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...JSON.parse(body),idempotency_key:submission.current.id})});
      if(!response.ok)throw new Error();
      const result=await response.json() as {id?:string;request?:{id?:string}};
      const id=result.id??result.request?.id;if(!id)throw new Error();setRequest(id);
    }catch{setError(true);}finally{setBusy(false);}
  }
  return <section className="mt-4 rounded-xl border border-sand-300 p-4"><button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className={buttonClass}>{t("title")}</button>
    {open?<div className="mt-4 space-y-4"><p className="text-sm leading-6 text-forest-700">{t("help")}</p>
      {error?<p role="alert" className="rounded-xl bg-ember-50 p-3 text-sm text-ember-800">{t("error")}</p>:null}
      {request?<p role="status" className="text-sm text-forest-800">{t("submitted")} <Link href={`/app/governance?request=${request}`} className="inline-flex min-h-12 items-center font-semibold underline">{t("review")}</Link></p>
        :!source?<p role="status">{t("loading")}</p>:!source.flock.eligible?<p role="alert">{t("unavailable")}</p>:<form onSubmit={submit} className="space-y-4">
          <p className="rounded-xl bg-sand-50 p-3 text-sm font-semibold text-forest-900">{t("wholeCount",{count:formatNumber(source.flock.birds,locale)})}</p>
          <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm">{t("farm")}<select required className={inputClass} value={farm} onChange={event=>{setFarm(event.target.value);setHouse("");setDestination(null);setError(false);}}><option value="">{t("choose")}</option>{farms.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label className="grid gap-2 text-sm">{t("house")}<select required disabled={!destination||destination.farm.id!==farm} className={inputClass} value={house} onChange={event=>setHouse(event.target.value)}><option value="">{t("choose")}</option>{destination?.farm.id===farm?destination.houses.filter(row=>row.eligible&&row.id!==source.flock.houseId).map(row=><option key={row.id} value={row.id}>{row.name}</option>):null}</select></label>
            <label className="grid gap-2 text-sm">{t("date")}<OperationDateInput value={day} onChange={event=>setDay(event.target.value)} required className={inputClass}/></label>
            <label className="grid gap-2 text-sm">{t("time")}<input type="time" value={time} onChange={event=>setTime(event.target.value)} required className={inputClass}/></label></div>
          <label className="grid gap-2 text-sm">{t("reason")}<textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={8} maxLength={2000} required className={`${inputClass} py-3`}/></label>
          <button disabled={busy||!house||!day||!time} className={`${buttonClass} bg-forest-900 text-white`}>{busy?t("saving"):t("submit")}</button>
        </form>}
    </div>:null}
  </section>;
}
