"use client";

import { CalendarDays, Menu, PanelsTopLeft, ShieldX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { HeaderAlertBell } from "@/components/header-alert-bell";
import { HeaderOrgBrand } from "@/components/header-org-brand";
import { LocaleSwitch } from "@/components/locale-switch";
import { SignOutButton } from "@/components/sign-out-button";
import { GovernanceAuthorizationBanner } from "@/components/governance-authorization-banner";
import { formatHeaderDate } from "@/i18n/formats";
import type { AppLocale } from "@/i18n/locale";
import type { ActiveRole } from "@/lib/permissions";

const routeTitles = [
  ["/app/farm-manager", "managerDashboard", "groups.farmOperations"],
  ["/app/ceo/setup", "branchNetwork", "groups.executiveOversight"],
  ["/app/ceo", "commandCenter", "groups.executiveOversight"],
  ["/app/daily-records", "dailyRecords", "groups.farmOperations"],
  ["/app/feeding-log", "feedControl", "groups.farmOperations"],
  ["/app/mortality", "mortality", "groups.farmOperations"],
  ["/app/farms", "farmMonitoring", "groups.farmOperations"],
  ["/app/flocks", "flocksBatches", "groups.farmOperations"],
  ["/app/analytics", "operationsAnalytics", "groups.branchIntelligence"],
  ["/app/reports", "branchReports", "groups.branchIntelligence"],
  ["/app/health", "healthLog", "groups.supportFunctions"],
  ["/app/inventory", "inventoryLog", "groups.supportFunctions"],
  ["/app/sales", "sales", "groups.supportFunctions"],
  ["/app/alerts", "alerts", "groups.operationsAttention"],
  ["/app/governance", "governance", "groups.controlledChange"],
  ["/app/operating-days", "operatingDays", "groups.dailyClosebook"],
  ["/app/reconciliation", "recordChecks", "groups.automaticVerification"],
] as const;

export function AppShell({ children, viewerRole }: { children: React.ReactNode; viewerRole: ActiveRole | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const tCommon = useTranslations("Common");
  const tPage = useTranslations("PageTitles");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [support, setSupport] = useState<{ id:string;expiresAt: string; orgName: string } | null>(null);

  useEffect(() => {
    void fetch("/api/me/context", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => {
      if (data?.supportSessionId && data?.supportExpiresAt) setSupport({ id:String(data.supportSessionId),expiresAt: String(data.supportExpiresAt), orgName: String(data.orgName ?? "tenant") });
    });
  }, []);

  const endSupport=async()=>{if(!support)return;const reason=window.prompt("Why are you ending this support session?")?.trim();if(!reason)return;const response=await fetch(`/api/governance/break-glass/sessions/${support.id}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason})});if(response.ok){setSupport(null);router.push("/admin/dashboard")}};

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileNavOpen]);

  const route = routeTitles.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const pageTitle = tPage(route?.[1] ?? "operationsWorkspace");
  const pageGroup = tPage(route?.[2] ?? "groups.poultryManagement");

  return (
    <div className="min-h-screen bg-sand-50">
      <div className="flex min-h-screen">
        <AppSidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          {support ? <div role="status" className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-3 bg-ember-600 px-4 py-2 text-center text-xs font-semibold text-white"><span>Support access active for {support.orgName}. Every read and change is audited. Expires {new Date(support.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.</span><button type="button" onClick={()=>void endSupport()} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white/30 px-3 hover:bg-white/10"><ShieldX className="h-3.5 w-3.5"/>End support session</button></div> : null}
          <header className="sticky top-0 z-40 border-b border-sand-200 bg-white/95 shadow-[0_1px_0_rgba(29,42,31,.04)] backdrop-blur-xl">
            <div className="flex min-h-[76px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => setMobileNavOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-sand-200 text-forest-800 transition hover:bg-sand-50 focus:outline-none focus:ring-2 focus:ring-forest-500 lg:hidden" aria-label={tCommon("openNavigation")}><Menu className="h-5 w-5" aria-hidden="true" /></button>
                <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-900 text-sand-50 sm:grid"><PanelsTopLeft className="h-5 w-5" aria-hidden="true" /></div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500"><span className="truncate">{pageGroup}</span><span className="h-1 w-1 shrink-0 rounded-full bg-amber-500" /><HeaderOrgBrand className="truncate normal-case tracking-normal text-forest-500" /></div>
                  <h1 className="mt-0.5 truncate font-display text-xl font-semibold text-forest-900 sm:text-2xl">{pageTitle}</h1>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <div className="hidden items-center gap-2 px-2 text-xs text-forest-600 md:flex"><CalendarDays className="h-4 w-4" aria-hidden="true" /><span>{formatHeaderDate(new Date(), locale)}</span><span className="hidden text-forest-400 xl:inline">· {tCommon("addisAbaba")}</span></div>
                <LocaleSwitch viewerRole={viewerRole} />
                <HeaderAlertBell />
                <SignOutButton compact />
              </div>
            </div>
          </header>

          <GovernanceAuthorizationBanner />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
