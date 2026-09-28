"use client";

import {useState, type FormEvent, type ReactNode} from "react";
import {useTranslations} from "next-intl";
import {Save} from "lucide-react";

import type {TodayFlockContext, TodayTaskDetail} from "@/lib/today-workspace/contracts";
import {sendTodayCommand} from "@/lib/today-workspace/sync";

type Choice = "none" | "death" | "cull" | "health" | "vaccination";
type Row = Record<string, unknown>;
const inputClass = "min-h-12 w-full rounded-xl border border-sand-300 bg-white px-3 text-base text-forest-900 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-200";
const saveClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white disabled:opacity-50";
const string = (value: FormDataEntryValue | null) => String(value ?? "").trim();
const number = (value: FormDataEntryValue | null) => Number(value ?? 0);

function Field({label, name, type = "text", required = false, min, step}: {label: string; name: string; type?: string; required?: boolean; min?: string; step?: string}) {
  return <label className="grid gap-1.5 text-xs font-semibold text-forest-700">{label}<input className={inputClass} name={name} type={type} required={required} min={min} step={type === "number" ? (step ?? "1") : undefined} inputMode={type === "number" ? (step ? "decimal" : "numeric") : undefined}/></label>;
}

function Select({label, name, children, required = false}: {label: string; name: string; children: ReactNode; required?: boolean}) {
  return <label className="grid gap-1.5 text-xs font-semibold text-forest-700">{label}<select className={inputClass} name={name} required={required}>{children}</select></label>;
}

export function HealthTaskForm({detail, flock, onChanged, onSaved}: {detail: TodayTaskDetail; flock: TodayFlockContext; onChanged: () => void; onSaved: () => void}) {
  const t = useTranslations("Today.embedded");
  const errors = useTranslations("Errors");
  const vaccinations = Array.isArray(detail.data.vaccinations) ? detail.data.vaccinations as Row[] : [];
  const medicines = detail.inventory.filter((item) => item.category === "medicine");
  const vaccines = detail.inventory.filter((item) => item.category === "vaccine");
  const [selected, setSelected] = useState<Choice[]>([]);
  const [saved, setSaved] = useState<Choice[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{error: boolean; text: string} | null>(null);

  function toggle(choice: Choice) {
    setMessage(null);
    setSelected((current) => choice === "none"
      ? current.includes("none") ? [] : ["none"]
      : current.includes(choice) ? current.filter((item) => item !== choice)
        : [...current.filter((item) => item !== "none"), choice]);
  }

  async function submit(command: Parameters<typeof sendTodayCommand>[0], success: string, choices: Choice[]) {
    setSaving(true);
    setMessage(null);
    try {
      const result = await sendTodayCommand(command);
      if (result.status !== "applied") {
        setMessage({error: true, text: result.error_code === "RESOURCE_CONFLICT" ? errors("staleRevision") : errors("validation")});
        return;
      }
      const next = [...new Set([...saved, ...choices])];
      setSaved(next);
      setMessage({error: false, text: success});
      if (selected.every((choice) => next.includes(choice))) onSaved();
      else onChanged();
    } catch { setMessage({error: true, text: errors("unknown")}); }
    finally { setSaving(false); }
  }

  async function saveLoss(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flock.birdCheck.dailyRecordId || !flock.birdCheck.resourceRevision) {
      setMessage({error: true, text: t("startBirdCheckFirst")});
      return;
    }
    const form = new FormData(event.currentTarget);
    const deaths = selected.includes("death") ? number(form.get("death_count")) : 0;
    const culls = selected.includes("cull") ? number(form.get("cull_count")) : 0;
    await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "save_daily_record",
      farm_id: detail.farmId, flock_id: flock.id, work_date: detail.workDate,
      expected_resource_revision: flock.birdCheck.resourceRevision,
      payload: {daily_record_id: flock.birdCheck.dailyRecordId, usages: null, record: {
        record_date: detail.workDate,
        _today_bird_loss: {deaths, culls, cause: string(form.get("cause")), cull_reason: string(form.get("cull_reason")),
          recorded_time: string(form.get("time")), diagnosis: string(form.get("diagnosis")), notes: string(form.get("notes")),
          expected_revision: flock.birdCheck.resourceRevision},
      }},
    }, t("lossSaved"), ["death", "cull"].filter((choice) => selected.includes(choice as Choice)) as Choice[]);
  }

  async function saveHealth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = string(form.get("item")); const warehouse = string(form.get("warehouse"));
    await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "record_health_event",
      farm_id: detail.farmId, flock_id: flock.id, work_date: detail.workDate,
      payload: {event_type: string(form.get("event_type")) as "disease" | "treatment" | "observation",
        event: {description: string(form.get("description")), diagnosis: string(form.get("diagnosis")) || null, treatment: string(form.get("treatment")) || null},
        inventory_usage: item && warehouse ? {item_id: item, warehouse_id: warehouse, quantity: number(form.get("quantity"))} : null}},
    t("healthSaved"), ["health"]);
  }

  async function saveVaccination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "complete_vaccination",
      farm_id: detail.farmId, flock_id: flock.id, work_date: detail.workDate,
      payload: {schedule_id: string(form.get("schedule")), item_id: string(form.get("item")),
        warehouse_id: string(form.get("warehouse")), quantity: number(form.get("quantity"))}},
    t("vaccinationSaved"), ["vaccination"]);
  }

  async function confirmNone() {
    await submit({schema_version: 1, command_id: crypto.randomUUID(), type: "confirm_no_activity",
      farm_id: detail.farmId, flock_id: flock.id, work_date: detail.workDate,
      payload: {task_code: "health_deaths", source_fingerprint: String(flock.tasks.find((task) => task.code === "health_deaths")?.sourceFingerprint ?? "")}},
    t("confirmedNone"), ["none"]);
  }

  const choices: Choice[] = vaccinations.length ? ["none", "death", "cull", "health", "vaccination"] : ["none", "death", "cull", "health"];
  const lossChosen = selected.includes("death") || selected.includes("cull");
  return <div className="grid gap-4">
    <p className="text-sm text-forest-600">{t("healthChoicesHelp")}</p>
    <div className="grid gap-2 sm:grid-cols-2">{choices.map((choice) => <label key={choice} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${selected.includes(choice) ? "border-forest-900 bg-forest-900 text-white" : "border-sand-300 text-forest-900"}`}><input type="checkbox" checked={selected.includes(choice)} disabled={choice === "none" && flock.healthSummary.hasActivity} onChange={() => toggle(choice)} className="h-5 w-5 accent-leaf-500"/><span>{t(`healthModes.${choice}`)}</span></label>)}</div>
    <p className="rounded-xl bg-sand-50 p-3 text-sm text-forest-700">{t("recordedLosses", {deaths: flock.birdCheck.deaths, culls: flock.birdCheck.culls})}</p>
    {selected.includes("none") ? <div className="flex justify-end"><button type="button" onClick={() => void confirmNone()} disabled={saving || saved.includes("none")} className={saveClass}><Save className="h-4 w-4"/>{t("confirmNone")}</button></div> : null}
    {lossChosen && !["death", "cull"].filter((choice) => selected.includes(choice as Choice)).every((choice) => saved.includes(choice as Choice)) ? <form onSubmit={saveLoss} className="grid gap-3 rounded-xl border border-sand-200 p-4">
      {!flock.birdCheck.dailyRecordId ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("startBirdCheckFirst")}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">{selected.includes("death") ? <><Field label={t("deathCount")} name="death_count" type="number" min="1" required/><Select label={t("cause")} name="cause" required><option value="">{t("choose")}</option><option value="Natural">{t("deathCauses.natural")}</option><option value="Illness">{t("deathCauses.illness")}</option><option value="Unknown">{t("deathCauses.unknown")}</option></Select><Field label={t("time")} name="time" type="time"/><Field label={t("diagnosis")} name="diagnosis"/><Field label={t("notes")} name="notes"/></> : null}{selected.includes("cull") ? <><Field label={t("cullCount")} name="cull_count" type="number" min="1" required/><Field label={t("cullReason")} name="cull_reason" required/></> : null}</div>
      <div className="flex justify-end"><button disabled={saving || !flock.birdCheck.dailyRecordId} className={saveClass}><Save className="h-4 w-4"/>{t("saveLoss")}</button></div>
    </form> : null}
    {selected.includes("health") && !saved.includes("health") ? <form onSubmit={saveHealth} className="grid gap-3 rounded-xl border border-sand-200 p-4"><div className="grid gap-3 sm:grid-cols-2"><Select label={t("eventType")} name="event_type" required><option value="observation">{t("observation")}</option><option value="disease">{t("disease")}</option><option value="treatment">{t("treatment")}</option></Select><Field label={t("description")} name="description" required/><Field label={t("diagnosis")} name="diagnosis"/><Field label={t("treatment")} name="treatment"/><Select label={t("medicine")} name="item"><option value="">{t("noneUsed")}</option>{medicines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select label={t("warehouse")} name="warehouse"><option value="">{t("choose")}</option>{detail.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</Select><Field label={t("quantity")} name="quantity" type="number" min="0.01" step="0.01"/></div><div className="flex justify-end"><button disabled={saving} className={saveClass}><Save className="h-4 w-4"/>{t("saveContinue")}</button></div></form> : null}
    {selected.includes("vaccination") && !saved.includes("vaccination") ? <form onSubmit={saveVaccination} className="grid gap-3 rounded-xl border border-sand-200 p-4"><div className="grid gap-3 sm:grid-cols-2"><Select label={t("vaccination")} name="schedule" required><option value="">{t("choose")}</option>{vaccinations.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.vaccine_name)} · {String(row.dosage ?? "")}</option>)}</Select><Select label={t("vaccine")} name="item" required><option value="">{t("choose")}</option>{vaccines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select label={t("warehouse")} name="warehouse" required><option value="">{t("choose")}</option>{detail.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</Select><Field label={t("quantity")} name="quantity" type="number" min="0.01" step="0.01" required/></div><div className="flex justify-end"><button disabled={saving} className={saveClass}><Save className="h-4 w-4"/>{t("saveContinue")}</button></div></form> : null}
    {message ? <p role={message.error ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${message.error ? "bg-red-50 text-red-800" : "bg-leaf-500/10 text-leaf-700"}`}>{message.text}</p> : null}
  </div>;
}
