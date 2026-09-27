"use client";

import Link from "next/link";
import {useMemo, useState} from "react";
import {useTranslations} from "next-intl";
import {Bird, CheckCircle2, ChevronDown, ChevronUp, Save} from "lucide-react";

import type {TodayFlockContext, TodayTask} from "@/lib/today-workspace/contracts";
import {assessBirdCheck} from "@/lib/today-workspace/bird-check";
import {sendTodayCommand} from "@/lib/today-workspace/sync";

type NumericKey = "transfersIn" | "deaths" | "culls" | "transfersOut" | "otherRemovals" | "closingBirds";
type FormValues = Record<NumericKey, string>;

function inputValue(value: number | null) {
  return value === null ? "" : String(value);
}

function parsed(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export function BirdCheckCard({
  flock,
  task,
  farmId,
  workDate,
  online,
  expanded,
  onToggle,
  onSaved,
}: {
  flock: TodayFlockContext;
  task: TodayTask;
  farmId: string;
  workDate: string;
  online: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("Today");
  const errors = useTranslations("Errors");
  const initial = flock.birdCheck;
  const [values, setValues] = useState<FormValues>({
    transfersIn: inputValue(initial.transfersIn),
    deaths: inputValue(initial.deaths),
    culls: inputValue(initial.culls),
    transfersOut: inputValue(initial.transfersOut),
    otherRemovals: inputValue(initial.otherRemovals),
    closingBirds: inputValue(initial.closingBirds),
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{tone: "success" | "error"; text: string; href?: string} | null>(null);

  const assessment = useMemo(() => assessBirdCheck({
    openingBirds: initial.openingBirds,
    transfersIn: parsed(values.transfersIn),
    deaths: parsed(values.deaths),
    culls: parsed(values.culls),
    transfersOut: parsed(values.transfersOut),
    otherRemovals: parsed(values.otherRemovals),
    closingBirds: parsed(values.closingBirds),
  }), [initial.openingBirds, values]);
  const displayState = dirty ? "draft_on_tablet" : task.state;
  const displayStateLabel = displayState === "complete"
    ? t("states.complete")
    : displayState === "needs_attention"
      ? t("states.needsAttention")
      : displayState === "draft_on_tablet"
        ? t("states.draft")
        : t("states.notStarted");

  const correctionParams = new URLSearchParams({farm_id: farmId, flock_id: flock.id, date: workDate});
  const correctionHref = `/app/daily-records?${correctionParams.toString()}`;

  function update(key: NumericKey, value: string) {
    setValues((current) => ({...current, [key]: value}));
    setDirty(true);
    setMessage(null);
  }

  async function save() {
    if (!online || !assessment.valid) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await sendTodayCommand({
        schema_version: 1,
        command_id: crypto.randomUUID(),
        type: "save_daily_record",
        farm_id: farmId,
        flock_id: flock.id,
        work_date: workDate,
        expected_resource_revision: initial.dailyRecordId ? initial.resourceRevision : undefined,
        payload: {
          daily_record_id: initial.dailyRecordId,
          record: {
            record_date: workDate,
            opening_birds: initial.openingBirds,
            transfers_in: parsed(values.transfersIn),
            deaths: parsed(values.deaths),
            culls: parsed(values.culls),
            transfers_out: parsed(values.transfersOut),
            other_removals: parsed(values.otherRemovals),
            closing_birds: parsed(values.closingBirds),
          },
          usages: null,
        },
      });
      if (result.status === "applied") {
        setDirty(false);
        setMessage({tone: "success", text: t("birdCheck.saved")});
        onSaved();
        return;
      }
      const text = result.error_code === "RESOURCE_CONFLICT"
        ? errors("staleRevision")
        : result.error_code === "OPERATING_DAY_LOCKED" || result.error_code === "OPERATING_WINDOW_EXPIRED"
          ? errors("locked")
          : errors("validation");
      setMessage({tone: "error", text, href: result.conflict?.correction_destination ?? correctionHref});
    } catch {
      setMessage({tone: "error", text: errors("unknown"), href: correctionHref});
    } finally {
      setSaving(false);
    }
  }

  const fields: Array<{key: NumericKey; label: string; decimal?: boolean}> = [
    {key: "transfersIn", label: t("birdCheck.transfersIn")},
    {key: "deaths", label: t("birdCheck.deaths")},
    {key: "culls", label: t("birdCheck.culls")},
    {key: "transfersOut", label: t("birdCheck.transfersOut")},
    {key: "otherRemovals", label: t("birdCheck.otherRemovals")},
    {key: "closingBirds", label: t("birdCheck.closing")},
  ];

  return <article id="today-task-birds" className="overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
    <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-h-16 w-full flex-wrap items-start justify-between gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-forest-700">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-sand-300 bg-sand-50 text-forest-700"><Bird className="h-5 w-5" aria-hidden="true" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-forest-900">{t("birdCheck.title")}</h3><span className="rounded-full bg-sand-100 px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-forest-600">{t("required")}</span></div><p className="mt-1 text-sm leading-5 text-forest-600">{t("birdCheck.help")}</p></div></div>
      <span className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${displayState === "complete" ? "border-leaf-500/30 bg-leaf-500/10 text-leaf-700" : displayState === "needs_attention" ? "border-red-300 bg-red-50 text-red-800" : displayState === "draft_on_tablet" ? "border-amber-500/30 bg-amber-500/10 text-amber-800" : "border-sand-300 bg-sand-50 text-forest-600"}`}>{displayStateLabel}</span>{expanded?<ChevronUp className="h-5 w-5"/>:<ChevronDown className="h-5 w-5"/>}</span>
    </button>

    {expanded ? <div className="border-t border-sand-200 p-4">

    <div className="mt-4 rounded-xl bg-forest-900 p-4 text-white"><span className="text-xs text-sand-100/70">{t("birdCheck.opening")}</span><div className="mt-1 flex flex-wrap items-baseline justify-between gap-2"><strong className="text-2xl tabular-nums">{initial.openingBirds ?? "—"}</strong><span className="text-xs text-sand-100/75">{t(`birdCheck.sources.${initial.openingSource}`)}</span></div></div>
    {initial.openingSource === "missing" ? <div role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t("birdCheck.missingOpening")} <Link href={correctionHref} className="font-semibold underline">{t("birdCheck.openRecord")}</Link></div> : null}

    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {fields.map((field) => <label key={field.key} className="grid gap-1.5 text-xs font-semibold text-forest-700">{field.label}<input type="number" min="0" step={field.decimal ? "0.1" : "1"} inputMode={field.decimal ? "decimal" : "numeric"} value={values[field.key]} onChange={(event)=>update(field.key,event.target.value)} aria-invalid={(field.key === "closingBirds" && assessment.issues.includes("CLOSING_MISMATCH")) || assessment.issues.includes("MOVEMENT_INVALID")} className="min-h-12 rounded-xl border border-sand-300 px-3 text-base font-medium text-forest-900 aria-[invalid=true]:border-red-500 aria-[invalid=true]:bg-red-50" /></label>)}
    </div>

    <div className={`mt-4 rounded-xl border p-3 text-sm ${assessment.issues.includes("CLOSING_MISMATCH") || assessment.issues.includes("MOVEMENT_INVALID") ? "border-red-300 bg-red-50 text-red-800" : "border-leaf-500/30 bg-leaf-500/10 text-forest-800"}`}><p className="font-semibold">{t("birdCheck.equation")}</p><p className="mt-1">{assessment.expectedClosingBirds === null ? t("birdCheck.enterCounts") : t("birdCheck.expectedClose", {count: assessment.expectedClosingBirds})}</p>{assessment.issues.includes("CLOSING_MISMATCH") ? <p className="mt-1 font-semibold">{t("birdCheck.mismatch")}</p> : null}{assessment.issues.includes("MOVEMENT_INVALID") ? <p className="mt-1 font-semibold">{errors("validation")}</p> : null}</div>
    {message ? <div role={message.tone === "error" ? "alert" : "status"} className={`mt-3 flex flex-wrap items-center gap-2 rounded-xl p-3 text-sm ${message.tone === "error" ? "bg-red-50 text-red-800" : "bg-leaf-500/10 text-leaf-700"}`}>{message.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : null}<span>{message.text}</span>{message.href ? <Link href={message.href} className="font-semibold underline">{t("birdCheck.openRecord")}</Link> : null}</div> : null}
    {!online && dirty ? <p role="status" className="mt-3 text-sm font-medium text-amber-800">{t("birdCheck.offlineHelp")}</p> : null}
    <div className="mt-4 flex justify-end"><button type="button" onClick={save} disabled={saving || !online || !assessment.valid || initial.openingSource === "missing"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-4 w-4" aria-hidden="true" />{saving ? t("birdCheck.saving") : t("birdCheck.save")}</button></div>
    </div> : null}
  </article>;
}
