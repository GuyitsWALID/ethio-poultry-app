"use client";
import {useLocale} from "next-intl";
import {useState} from "react";
import {OperationDateInput} from "@/components/operation-date-input";
import {formatOperationDate} from "@/i18n/formats";
import type {LegacyScheduleReview} from "@/lib/scheduler/contracts";
const copy = {
 en: {title: "Review legacy template weight checks", help: "Choose the exact check and a new Scheduler date. The original due date and evidence remain unchanged; this does not mark the work complete.", action: "Reschedule explicitly", date: "New check date", reason: "Reason for this decision", confirm: "I confirm this is a deliberate rescheduling decision, not proof that the check was completed.", save: "Confirm rescheduling", close: "Cancel", failed: "Could not reschedule. Refresh if the evidence or permissions changed, then retry."},
 am: {title: "የቀድሞ የአብነት ክብደት ምርመራዎችን ይገምግሙ", help: "ትክክለኛውን ምርመራ እና አዲስ የጊዜ ሰሌዳ ቀን ይምረጡ። የመጀመሪያው ቀን እና ማስረጃ አይቀየሩም፤ ይህ ሥራው እንደተጠናቀቀ አያሳይም።", action: "በግልጽ ውሳኔ ቀጠሮ ቀይር", date: "አዲስ የምርመራ ቀን", reason: "የውሳኔው ምክንያት", confirm: "ይህ ቀጠሮ የመቀየር ውሳኔ እንጂ ምርመራው የመጠናቀቁ ማስረጃ እንዳልሆነ አረጋግጣለሁ።", save: "የቀጠሮ ለውጥ አረጋግጥ", close: "ተው", failed: "ቀጠሮውን መቀየር አልተቻለም። ማስረጃው ወይም ፈቃድ ከተቀየረ ያድሱና እንደገና ይሞክሩ።"},
};
const button = "min-h-12 rounded-xl border border-sand-300 px-4 font-semibold disabled:opacity-50";
export function LegacyWeightReschedule({rows, today, onSaved}: {rows: LegacyScheduleReview[]; today: string; onSaved: () => void}) {
 const locale = useLocale(), t = copy[locale === "am" ? "am" : "en"];
 const [draft, setDraft] = useState<{row: LegacyScheduleReview; date: string; reason: string; requestId: string} | null>(null);
 const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
 const eligible = rows.filter(row => row.kind === "weight" && row.mapping === "review_required" && row.legacy_id && row.revision);
 if (!eligible.length) return null;
 return <section className="grid gap-4 rounded-2xl border border-sand-200 bg-white p-5"><h2 className="font-display text-2xl">{t.title}</h2><p className="text-sm">{t.help}</p>
  {failed ? <p role="alert" className="text-red-700">{t.failed}</p> : null}
  {eligible.map(row => <div key={row.legacy_id} className="grid gap-3 border-t border-sand-200 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{row.flock_label ?? row.title} · {formatOperationDate(row.due_date, locale)}</p><button disabled={busy} className={button} onClick={() => {setFailed(false); setDraft({row, date: today, reason: "", requestId: crypto.randomUUID()});}}>{t.action}</button></div>
   {draft && draft.row.legacy_id === row.legacy_id ? <form className="grid gap-3" onSubmit={async event => {
    event.preventDefault(); if (busy || !draft) return; setBusy(true); setFailed(false);
    try {
     const response = await fetch("/api/scheduler/legacy-weight", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({request_id: draft.requestId, legacy_id: row.legacy_id, revision: row.revision, date: draft.date, reason: draft.reason})});
     if (!response.ok) throw Error(); setDraft(null); onSaved();
    } catch {setFailed(true);} finally {setBusy(false);}
   }}><label className="grid gap-2">{t.date}<OperationDateInput required min={today} value={draft.date} onChange={event => setDraft({...draft, date: event.target.value})} className="min-h-12 rounded-xl border border-sand-300 px-3"/></label><label className="grid gap-2">{t.reason}<textarea required minLength={8} maxLength={2000} value={draft.reason} onChange={event => setDraft({...draft, reason: event.target.value})} className="min-h-24 rounded-xl border border-sand-300 p-3"/></label><label className="flex min-h-12 items-center gap-3"><input type="checkbox" required className="h-5 w-5"/>{t.confirm}</label><div className="flex flex-wrap gap-3"><button disabled={busy} className={button}>{t.save}</button><button type="button" disabled={busy} onClick={() => setDraft(null)} className={button}>{t.close}</button></div></form> : null}
  </div>)}
 </section>;
}
