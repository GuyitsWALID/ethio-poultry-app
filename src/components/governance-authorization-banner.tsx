/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type DisplayValue={field:string;label:string;value:unknown};
type Authorization={id:string;status:string;approval_expires_at?:string|null;decision_note?:string|null;context_snapshot?:{sourceLabel?:string;proposedValues?:DisplayValue[]}};

export function GovernanceAuthorizationBanner(){
  const pathname=usePathname();const [row,setRow]=useState<Authorization|null>(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get("governance_request");if(!id){setRow(null);return}void fetch("/api/governance/desk",{cache:"no-store"}).then(async response=>response.ok?response.json():null).then(data=>setRow((data?.requests??[]).find((item:Authorization)=>item.id===id)??null))},[pathname]);
  if(!row)return null;
  const apply=async()=>{setBusy(true);setMessage("");const response=await fetch(`/api/governance/requests/${row.id}/apply`,{method:"POST"});const data=await response.json().catch(()=>null);setBusy(false);if(!response.ok){setMessage(data?.error??"The authorized change could not be applied.");return}setRow(data.request);setMessage("The approved values were applied once and recorded in the audit history.")};
  return <section className="mx-4 mt-5 overflow-hidden rounded-2xl border border-leaf-300 bg-white sm:mx-6 lg:mx-8" aria-label="Approved governance correction"><div className="flex flex-wrap items-start justify-between gap-4 bg-forest-900 p-4 text-white"><div className="flex gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-500/20 text-leaf-200"><ShieldCheck className="h-5 w-5"/></div><div><p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Exact change authorized</p><h2 className="mt-1 font-semibold">{row.context_snapshot?.sourceLabel??"Protected record"}</h2><p className="mt-1 text-xs text-sand-200">CEO note: {row.decision_note??"Approved correction"}</p></div></div>{row.status==="approved"?<button disabled={busy} onClick={()=>void apply()} className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-forest-950 disabled:opacity-50">{busy?"Applying exact values…":"Apply approved correction"}</button>:<span className="inline-flex items-center gap-2 rounded-xl bg-leaf-500/15 px-4 py-3 text-sm font-semibold text-leaf-100"><CheckCircle2 className="h-4 w-4"/>Authorization {row.status}</span>}</div><div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">{(row.context_snapshot?.proposedValues??[]).map(item=><div key={item.field} className="rounded-xl bg-sand-50 p-3 text-sm"><span className="text-forest-500">{item.label}</span><strong className="mt-1 block text-forest-950">{String(item.value??"Not recorded")}</strong></div>)}</div>{message?<p role="status" className={`border-t px-4 py-3 text-sm ${row.status==="applied"?"border-leaf-200 bg-leaf-50 text-leaf-800":"border-ember-200 bg-ember-50 text-ember-800"}`}>{message}</p>:null}</section>
}
