"use client";

import {useLocale, useTranslations} from "next-intl";
import { formatOperationDateTime} from "@/i18n/formats";

import { CheckCircle2, Clock3, DatabaseZap, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type AuditChange = { field: string; before: string; after: string };
type AuditEvent = {
  key: string;
  title: string;
  subject: string;
  reason: string;
  actorName: string;
  actorRole: string;
  occurredAt: string;
  evidenceType: "automatic" | "workflow";
  changes: AuditChange[];
};
type Integrity = { valid: boolean; eventCount: number; firstInvalidSequence: number | null; verifiedAt: string };
type AuditResponse = { events: AuditEvent[]; integrity: Integrity | null; meta: { role: string; limit: number } };
type AuditResult = { data: AuditResponse | null; error: string };

async function requestAudit(fallback: string): Promise<AuditResult> {
  const response = await fetch("/api/governance/audit?limit=100", { cache: "no-store" });
  const body = await response.json().catch(() => null);
  return response.ok
    ? { data: body as AuditResponse, error: "" }
    : { data: null, error: body?.error ?? fallback };
}

export function GovernanceAuditHistory({ role }: { role: string }) {
  const ui = useTranslations("OperationUI");
  const chartText = useTranslations("OperationCharts");
  const locale = useLocale();
  const roles = useTranslations("History.codes");
  const fields = useTranslations("History.fields");
  const roleLabel = (value: string) => roles.has((value) as Parameters<typeof roles>[0]) ? roles((value) as Parameters<typeof roles>[0]) : value.replaceAll("_", " ");
  const dateTime = (value: string) => formatOperationDateTime(value, locale);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await requestAudit(chartText("auditLoadFailed"));
    if (result.data) setData(result.data);
    else setError(result.error);
    setLoading(false);
  }, [chartText]);

  useEffect(() => {
    let active = true;
    void requestAudit(chartText("auditLoadFailed")).then((result) => {
      if (!active) return;
      if (result.data) setData(result.data);
      else setError(result.error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [chartText]);

  return <section className="overflow-hidden rounded-2xl border border-sand-200 bg-white" aria-labelledby="audit-history-title">
    <header className="grid gap-5 border-b border-sand-200 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest-900 text-amber-300"><Clock3 className="h-5 w-5" aria-hidden="true"/></span>
        <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-forest-500">{ui("permanentEvidence")}</p><h2 id="audit-history-title" className="mt-1 font-display text-2xl text-forest-950">{ui("permanentChangeHistory")}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-forest-600">{ui("seeWhoChangedAnImportantRecordWhatChangedWhenIt")}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {role === "ceo" && data?.integrity ? <div className={`min-w-48 rounded-xl border px-4 py-3 ${data.integrity.valid ? "border-leaf-300 bg-leaf-50" : "border-ember-300 bg-ember-50"}`} role="status"><p className="flex items-center gap-2 text-sm font-semibold text-forest-950"><ShieldCheck className="h-4 w-4"/>{data.integrity.valid ? ui("historyVerified") : ui("integrityReviewRequired")}</p><p className="mt-1 text-xs text-forest-600">{data.integrity.eventCount.toLocaleString(locale)} {ui("entriesChecked")}</p></div> : null}
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sand-200 px-4 text-sm font-semibold text-forest-800 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>{ui("refreshHistory")}</button>
      </div>
    </header>
    <div className="border-b border-sand-100 bg-sand-50/70 px-5 py-3 text-xs leading-5 text-forest-600">{role === "farm_manager" ? ui("youCanSeeYourOwnActionsPlusActivityForFarms") : ui("youCanReviewImportantActivityAcrossTheOrganizationTheVerification")}</div>
    {error ? <div className="p-5"><p role="alert" className="rounded-xl border border-ember-200 bg-ember-50 p-4 text-sm text-ember-800">{error} {ui("useRefreshHistoryToTryAgain")}</p></div> : loading && !data ? <div className="grid gap-3 p-5">{[1,2,3].map((row) => <div key={row} className="h-24 animate-pulse rounded-xl bg-sand-100"/>)}</div> : !data?.events.length ? <div className="p-8 text-center"><CheckCircle2 className="mx-auto h-7 w-7 text-leaf-600"/><p className="mt-3 font-semibold text-forest-900">{ui("noRecordedChangesInThisScope")}</p><p className="mt-1 text-sm text-forest-600">{ui("newGovernedActivityWillAppearHereAutomatically")}</p></div> : <div className="divide-y divide-sand-100">
      {data.events.map((event) => <article key={event.key} className="relative grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 gap-3"><span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${event.evidenceType === "automatic" ? "bg-sky-50 text-sky-700" : "bg-leaf-50 text-leaf-700"}`}>{event.evidenceType === "automatic" ? <DatabaseZap className="h-4 w-4"/> : <ShieldCheck className="h-4 w-4"/>}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-forest-950">{event.title} · {event.subject}</h3><span className="rounded-full bg-sand-100 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-forest-600">{event.evidenceType === "automatic" ? ui("recordedAutomatically") : ui("workflowRecord")}</span></div><p className="mt-1 text-sm leading-6 text-forest-600">{event.reason}</p><p className="mt-2 text-xs font-semibold text-forest-700">{event.actorName} · {roleLabel(event.actorRole)}</p>{event.changes.length ? <details className="mt-3 overflow-hidden rounded-xl border border-sand-200 bg-sand-50"><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-forest-700">{chartText("changedValues", {count: event.changes.length})}</summary><div className="grid gap-2 border-t border-sand-200 p-3 sm:grid-cols-2">{event.changes.map((change) => <div key={change.field} className="rounded-lg bg-white p-3 text-xs"><p className="font-semibold capitalize text-forest-800">{fields.has((change.field) as Parameters<typeof fields>[0]) ? fields((change.field) as Parameters<typeof fields>[0]) : change.field}</p><p className="mt-1 text-forest-500">{ui("before")} {change.before}</p><p className="text-forest-700">{ui("after")} {change.after}</p></div>)}</div></details> : null}</div></div>
        <time dateTime={event.occurredAt} className="text-xs text-forest-500 lg:text-right">{dateTime(event.occurredAt)}</time>
      </article>)}
    </div>}
  </section>;
}
