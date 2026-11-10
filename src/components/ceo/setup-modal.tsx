"use client";

import Link from "next/link";
import {useLocale} from "next-intl";
import {useEffect, useRef, useState} from "react";
import {branchSetupCopy} from "@/i18n/branch-setup-copy";

type House = {name: string; capacity: number; house_type: "layer" | "broiler" | "rearing" | "parent_stock"};
type Farm = {name: string; houses: House[]};
const emptyHouse = (): House => ({name: "", capacity: 0, house_type: "layer"});
const fieldClass = "min-h-12 w-full rounded-xl border border-sand-200 bg-white px-3 py-2 text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700";
const buttonClass = "min-h-12 rounded-xl border border-sand-200 px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

export function SetupModal({isOpen, onClose, onSuccess}: {isOpen: boolean; onClose: () => void; onSuccess: () => void}) {
  const locale = useLocale();
  const t = branchSetupCopy[locale === "am" ? "am" : "en"];
  const dialog = useRef<HTMLDialogElement>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [branch, setBranch] = useState({name: "", location: ""});
  const [farms, setFarms] = useState<Farm[]>([{name: "", houses: [emptyHouse()]}]);
  const [managerId, setManagerId] = useState("");
  const [managers, setManagers] = useState<{id: string; full_name: string}[]>([]);
  const [managerFailure, setManagerFailure] = useState(false);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {if (isOpen && !dialog.current?.open) dialog.current?.showModal();}, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    fetch("/api/governance/assignments", {signal: controller.signal, cache: "no-store"})
      .then(async response => {if (!response.ok) throw Error(); return response.json();})
      .then(data => {setManagers((data.profiles ?? []).filter((p: {role: string; is_active: boolean}) => p.role === "farm_manager" && p.is_active)); setManagerFailure(false);})
      .catch(() => {if (!controller.signal.aborted) setManagerFailure(true);});
    return () => controller.abort();
  }, [isOpen, reload]);

  const updateFarm = (index: number, update: Partial<Farm>) => setFarms(current => current.map((farm, i) => i === index ? {...farm, ...update} : farm));
  const updateHouse = (farmIndex: number, houseIndex: number, update: Partial<House>) => setFarms(current => current.map((farm, i) => i === farmIndex ? {...farm, houses: farm.houses.map((house, j) => j === houseIndex ? {...house, ...update} : house)} : farm));

  return <dialog ref={dialog} onClose={onClose} onCancel={event => {if (saving) event.preventDefault();}}
    aria-labelledby="branch-structure-title" className="m-auto max-h-[90dvh] w-[min(95vw,64rem)] overflow-y-auto rounded-2xl border border-sand-200 bg-white p-5 text-forest-900 shadow-xl backdrop:bg-forest-900/50 sm:p-8">
    <form className="grid gap-6" onSubmit={async event => {
      event.preventDefault(); if (saving || saved) return;
      setSaving(true); setFailure(false);
      try {
        const response = await fetch("/api/ceo/setup", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({request_id: requestId, branch, farms, manager_id: managerId || null})});
        if (!response.ok) throw Error();
        setSaved(true); onSuccess();
      } catch {setFailure(true);} finally {setSaving(false);}
    }}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="branch-structure-title" className="font-display text-2xl font-semibold">{t.title}</h2><button type="button" disabled={saving} onClick={onClose} className={buttonClass}>{t.cancel}</button></div>
      <p className="rounded-xl bg-sand-50 p-4 text-sm leading-6">{t.help}</p>
      {saved ? <section role="status" className="grid gap-4 rounded-xl border border-green-300 bg-green-50 p-4"><p>{t.success}</p><div className="flex flex-wrap gap-3"><Link href="/app/batches" className={buttonClass}>{t.cycles}</Link><Link href="/app/users" className={buttonClass}>{t.access}</Link></div></section> : null}
      {failure ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{t.failed}</p> : null}
      <fieldset disabled={saving || saved} className="grid gap-6 disabled:opacity-70">
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1">{t.name}<input required maxLength={120} className={fieldClass} value={branch.name} onChange={e => setBranch({...branch, name: e.target.value})}/></label><label className="grid gap-1">{t.location}<input maxLength={300} className={fieldClass} value={branch.location} onChange={e => setBranch({...branch, location: e.target.value})}/></label></div>
        <label className="grid gap-1">{t.manager}<select className={fieldClass} value={managerId} onChange={e => setManagerId(e.target.value)}><option value="">{t.later}</option>{managers.map(manager => <option key={manager.id} value={manager.id}>{manager.full_name}</option>)}</select><span className="text-sm text-forest-600">{t.managerHelp}</span></label>
        {managerFailure ? <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>{t.managerFailed}</p><button type="button" className={buttonClass} onClick={() => setReload(current => current + 1)}>{t.retry}</button></div> : null}
        <h3 className="text-lg font-semibold">{t.farms}</h3>
        {farms.map((farm, i) => <section key={i} className="grid gap-4 rounded-xl border border-sand-200 p-4">
          <div className="flex flex-wrap items-end gap-3"><label className="grid flex-1 gap-1">{t.farm}<input required maxLength={120} className={fieldClass} value={farm.name} onChange={e => updateFarm(i, {name: e.target.value})}/></label>{farms.length > 1 ? <button type="button" className={buttonClass} onClick={() => setFarms(current => current.filter((_, index) => index !== i))}>{t.remove}</button> : null}</div>
          {farm.houses.map((house, j) => <div key={j} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
            <label className="grid gap-1">{t.house}<input required maxLength={120} className={fieldClass} value={house.name} onChange={e => updateHouse(i, j, {name: e.target.value})}/></label>
            <label className="grid gap-1">{t.capacity}<input required type="number" min={1} max={10000000} step={1} className={fieldClass} value={house.capacity || ""} onChange={e => updateHouse(i, j, {capacity: Number(e.target.value)})}/></label>
            <label className="grid gap-1">{t.type}<select className={fieldClass} value={house.house_type} onChange={e => updateHouse(i, j, {house_type: e.target.value as House["house_type"]})}>{(["layer", "broiler", "rearing", "parent_stock"] as const).map(type => <option key={type} value={type}>{t[type]}</option>)}</select></label>
            {farm.houses.length > 1 ? <button type="button" className={buttonClass} onClick={() => updateFarm(i, {houses: farm.houses.filter((_, index) => index !== j)})}>{t.remove}</button> : null}
          </div>)}
          <button type="button" disabled={farm.houses.length >= 100} className={buttonClass} onClick={() => updateFarm(i, {houses: [...farm.houses, emptyHouse()]})}>{t.addHouse}</button>
        </section>)}
        <button type="button" disabled={farms.length >= 20} className={buttonClass} onClick={() => setFarms(current => [...current, {name: "", houses: [emptyHouse()]}])}>{t.addFarm}</button>
        <button type="submit" className={`${buttonClass} bg-forest-900 text-white`}>{saving ? t.saving : t.save}</button>
      </fieldset>
    </form>
  </dialog>;
}
