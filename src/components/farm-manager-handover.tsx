"use client";
import {useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import {formatOperationDateTime} from "@/i18n/formats";
import type {AppLocale} from "@/i18n/locale";

type Preview={farm:{id:string;name:string};current_manager:{name:string};replacement_manager:{name:string};assignment_id:string;revision:string;warehouses:{id:string;name:string;status:string}[];unfinished_actions:{id:string;title:string;status:"open"|"assigned"|"acknowledged"|"in_progress"|"escalated";due_at:string}[]};
export function FarmManagerHandover({farmId,replacementId,onChanged}:{farmId:string;replacementId:string;onChanged:()=>void}) {
  const t=useTranslations("WarehouseAccess");
  const actionText=useTranslations("Notifications");const locale=useLocale() as AppLocale;
  const [preview,setPreview]=useState<Preview|null>(null);const [reason,setReason]=useState("");
  const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);
  async function review() {
    setBusy(true);setPreview(null);setConfirmed(false);setError(null);
    try{
      const response=await fetch(`/api/governance/assignments/handover?${new URLSearchParams({farm_id:farmId,replacement_id:replacementId})}`,{cache:"no-store"});
      const body=await response.json();if(!response.ok)throw new Error(body.code==="ASSIGNMENT_CHANGED"?t("changed"):t("previewFailed"));
      setPreview(body);
    }catch(error){setError(error instanceof Error?error.message:t("previewFailed"));}finally{setBusy(false);}
  }
  async function apply() {
    if(!preview)return;setBusy(true);setError(null);
    try{
      const response=await fetch("/api/governance/assignments/handover",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({farm_id:farmId,replacement_id:replacementId,assignment_id:preview.assignment_id,revision:preview.revision,reason,confirmed})});
      const body=await response.json();if(!response.ok){setPreview(null);throw new Error(body.code==="ASSIGNMENT_CHANGED"?t("changed"):t("applyFailed"));}
      setPreview(null);setReason("");setConfirmed(false);
      window.dispatchEvent(new Event("ethiopoultry:access-changed"));onChanged();
    }catch(error){setError(error instanceof Error?error.message:t("applyFailed"));}finally{setBusy(false);}
  }
  // A selection change invalidates the displayed snapshot, never the server token.
  const relevant=preview?.farm.id===farmId&&preview!==null;
  return <section className="mt-4 rounded-xl border border-sand-200 p-4" aria-label={t("handover")}>
    <h3 className="font-semibold text-forest-900">{t("handover")}</h3>
    <p className="mt-1 text-sm text-forest-600">{t("handoverHelp")}</p>
    <button className="mt-3 min-h-12 rounded-xl border border-sand-300 px-4 disabled:opacity-50" type="button" disabled={busy||!farmId||!replacementId} onClick={()=>void review()}>{t("preview")}</button>
    {error&&<p role="alert" className="mt-3 text-ember-600">{error}</p>}
    {relevant&&preview&&<div className="mt-4 space-y-3">
      <p><strong>{preview.farm.name}</strong>: {preview.current_manager.name} → {preview.replacement_manager.name}</p>
      <p className="text-sm">{t("includesStores")}</p>
      <ul className="list-inside list-disc">{preview.warehouses.map(w=><li key={w.id}>{w.name}</li>)}</ul>
      <p className="font-semibold">{t("unfinished",{count:preview.unfinished_actions.length})}</p>
      <ul className="list-inside list-disc">{preview.unfinished_actions.map(a=><li key={a.id}>{a.title} · {actionText(`status.${a.status}`)}{a.due_at?` · ${formatOperationDateTime(a.due_at,locale)}`:""}</li>)}</ul>
      <p className="text-sm text-forest-600">{t("preserved")}</p>
      <label className="grid gap-1">{t("reason")}<textarea className="min-h-24 rounded-xl border border-sand-300 p-3" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></label>
      <label className="flex min-h-12 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>{t("confirm")}</label>
      <button type="button" className="min-h-12 rounded-xl bg-forest-900 px-4 text-white disabled:opacity-50" disabled={busy||!confirmed||reason.trim().length<8} onClick={()=>void apply()}>{t("replace")}</button>
    </div>}
  </section>;
}
