"use client";

import Link from "next/link";
import {useState, type FormEvent} from "react";
import {useLocale, useTranslations} from "next-intl";
import {formatOperationDate} from "@/i18n/formats";

export function RecordingStartForm({farmId, flockId, workDate, eggProducing, online, findingId}: {
  farmId: string; flockId: string; workDate: string; eggProducing: boolean; online: boolean; findingId?: string;
}) {
  const t = useTranslations("RecordingStart");
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [failure, setFailure] = useState("");
  const [retryId] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online || requestId) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setFailure("");
    try {
      const response = await fetch("/api/governance/requests", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({request_type: "recording_start", farm_id: farmId, ...(findingId ? {finding_id: findingId} : {}), reason: String(form.get("reason")), idempotency_key: retryId,
          proposed_values: {flock_id: flockId, effective_date: workDate, live_birds: String(form.get("birds")),
            opening_eggs: eggProducing ? String(form.get("eggs")) : null, supporting_reference: String(form.get("reference"))}})});
      const result = await response.json();
      if (!response.ok) {
        const code = typeof result.error === "string" && t.has(`errors.${result.error}` as Parameters<typeof t.has>[0]) ? result.error : "FAILED";
        setFailure(t(`errors.${code}` as Parameters<typeof t>[0]));
      } else setRequestId(String(result.request.id));
    } catch {setFailure(t("errors.FAILED"));}
    finally {setBusy(false);}
  }
  const control = "min-h-12 min-w-0 w-full rounded-xl border border-sand-300 bg-white px-3 text-base";
  return <details className="rounded-xl border border-sand-300 bg-white p-4">
    <summary className="flex min-h-12 cursor-pointer items-center font-semibold">{t("title")}</summary>
    <p className="my-3 text-sm text-forest-700">{t("help")}</p>
    {findingId ? <p className="mb-3 text-sm text-forest-700">{t("recordCheckHelp")}</p> : null}
    <p className="mb-3 text-sm">{t("date")}: {formatOperationDate(workDate, locale)}</p>
    {!online ? <p role="status">{t("onlineRequired")}</p> : null}
    {requestId ?
      <p role="status">{t("submitted")} <Link className="inline-flex min-h-12 items-center underline" href={`/app/governance?request=${encodeURIComponent(requestId)}`}>{t("openApproval")}</Link></p> :
      <form onSubmit={submit}><fieldset disabled={!online || busy} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">{t("birds")}<input name="birds" type="number" min="0" step="1" required className={control}/></label>
        {eggProducing ? <label className="grid gap-1 text-sm font-semibold">{t("eggs")}<input name="eggs" type="number" min="0" step="1" required className={control}/><span className="font-normal">{t("eggsHelp")}</span></label> : null}
        <label className="grid gap-1 text-sm font-semibold">{t("reference")}<input name="reference" minLength={3} maxLength={1000} required className={control}/></label>
        <label className="grid gap-1 text-sm font-semibold">{t("reason")}<textarea name="reason" minLength={8} maxLength={2000} required className={`${control} min-h-24 py-3`}/></label>
        {failure ? <p role="alert" className="text-red-800">{failure}</p> : null}
        <button disabled={busy} className="min-h-12 rounded-xl bg-forest-900 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? t("sending") : t("send")}</button>
      </fieldset></form>}
  </details>;
}
