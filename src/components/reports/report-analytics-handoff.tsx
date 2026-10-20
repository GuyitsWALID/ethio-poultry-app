"use client";

import Link from "next/link";
import {usePathname, useSearchParams} from "next/navigation";
import {FarmPerformanceWorkspace} from "@/components/reports/farm-performance-workspace";
import {useTranslations} from "next-intl";
import {useFarmScope} from "@/components/farm-scope-context";
import {useTodayEntryMode} from "@/components/today/today-entry-link";
import {buildReportHref, type ReportInput, type ReportSection} from "@/lib/report-workspace";

// Hide only analytics, never the authoritative history or correction editor.
export function ReportAnalyticsHandoff({section, input, children}: {section: ReportSection; input?: Partial<ReportInput>; children: React.ReactNode}) {
  const t = useTranslations("ReportWorkspace");
  const {scope, period, role, todayWorkspaceEnabled} = useFarmScope();
  const {enabled} = useTodayEntryMode();
  const query = useSearchParams();
  const pathname = usePathname();
  if (pathname === "/app/analytics" && todayWorkspaceEnabled && (role === "ceo" || role === "farm_manager") && !["finding", "governance_request", "financial_period", "cost_entry"].some(key => query.has(key))) return <FarmPerformanceWorkspace/>;
  if (!enabled || query.get("feed_target") === "feed_history" || query.get("view") === "advanced") return children;
  return <section className="rounded-2xl border border-sand-200 bg-white p-5">
    <p className="text-sm text-forest-700">{t("analyticsMoved")}</p>
    <Link href={buildReportHref(section, {...period, ...scope, ...input})} className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white">{t("openReport", {section: t(`sections.${section}`)})}</Link>
  </section>;
}
