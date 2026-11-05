"use client";
import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import type {EggSaleSource} from "@/lib/egg-sale-sources";

export function EggSaleSourceEditor({farmId, date, value, onChange}: {farmId: string; date: string; value: EggSaleSource[]; onChange: (rows: EggSaleSource[]) => void}) {
  const t = useTranslations("EggSaleSources");
  const [flocks, setFlocks] = useState<Array<{id: string; flock_code: string}>>([]), [state, setState] = useState("loading");
  useEffect(() => {
    const abort = new AbortController();
    if (!farmId || !date) return;
    void fetch(`/api/sales/sources?${new URLSearchParams({farm_id: farmId, date})}`, {cache: "no-store", signal: abort.signal})
      .then(async response => {const data = await response.json(); if (!response.ok) throw Error(); setFlocks(data.flocks); setState("ready");})
      .catch(() => {if (!abort.signal.aborted) {setFlocks([]); setState("failed");}});
    return () => abort.abort();
  }, [farmId, date]);
  return <fieldset className="grid min-w-0 gap-3"><legend className="mb-2 font-semibold">{t("title")}</legend><p className="text-sm text-forest-600">{t("help")}</p>{state !== "ready" ? <p role="status">{t(state === "failed" ? "failed" : "loading")}</p> : null}{value.map((row,index) => <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="grid gap-1 text-sm font-semibold">{t("flock")}<select required value={row.flock_id} onChange={event => onChange(value.map((current,i) => i === index ? {...current,flock_id: event.target.value} : current))} className="min-h-12 min-w-0 rounded-xl border border-sand-300 px-3"><option value="">{t("choose")}</option>{flocks.map(flock => <option key={flock.id} value={flock.id}>{flock.flock_code}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">{t("eggs")}<input required type="number" min="1" step="1" value={row.egg_quantity || ""} onChange={event => onChange(value.map((current,i) => i === index ? {...current,egg_quantity: Number(event.target.value)} : current))} className="min-h-12 min-w-0 rounded-xl border border-sand-300 px-3"/></label><button type="button" className="min-h-12 rounded-xl border border-sand-300 px-4" onClick={() => onChange(value.filter((_,i) => i !== index))}>{t("remove")}</button></div>)}<button type="button" className="min-h-12 rounded-xl border border-sand-300 px-4" disabled={value.length >= 100 || state !== "ready"} onClick={() => onChange([...value,{flock_id: "",egg_quantity: 0}])}>+ {t("add")}</button></fieldset>;
}
