"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Box,
  Boxes,
  Briefcase,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Egg,
  HeartPulse,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Package,
  Stethoscope,
  X,
  Warehouse,
  ShieldCheck,
  Scale,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AppRole } from "@/lib/roles";
import { normalizeRole } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";

type NavSection = {
  title: string;
  items: Array<{ label: string; href: string }>;
};

const itemIcons: Record<string, LucideIcon> = {
  "Command Center": LayoutDashboard,
  "Branch Network": Building2,
  Analytics: ChartNoAxesCombined,
  Reports: ClipboardList,
  "Farm Network": Warehouse,
  "Flocks & Batches": Boxes,
  "Daily Records": ClipboardList,
  Feed: Package,
  Mortality: Activity,
  Health: HeartPulse,
  Inventory: Box,
  Sales: Briefcase,
  "Manager Dashboard": LayoutDashboard,
  "Farm Monitoring": Warehouse,
  "Operations Analytics": ChartNoAxesCombined,
  "Branch Reports": ClipboardList,
  "Health Log": Stethoscope,
  "Inventory Log": Package,
  Governance: ShieldCheck,
  Requests: ShieldCheck,
  "Operating Days": ClipboardList,
  "Daily Close": ClipboardList,
  "Record Checks": Scale,
  "Access & Users": Users,
};

const ceoNavSections: NavSection[] = [
  {
    title: "Executive",
    items: [
      { label: "Command Center", href: "/app/ceo" },
      { label: "Branch Network", href: "/app/ceo/setup" },
      { label: "Analytics", href: "/app/analytics" },
      { label: "Reports", href: "/app/reports" },
      { label: "Governance", href: "/app/governance" },
      { label: "Access & Users", href: "/app/users" },
      { label: "Operating Days", href: "/app/operating-days" },
      { label: "Record Checks", href: "/app/reconciliation" },
    ],
  },
  {
    title: "Operations Oversight",
    items: [
      { label: "Farm Network", href: "/app/farms" },
      { label: "Flocks & Batches", href: "/app/flocks" },
      { label: "Requests", href: "/app/governance" },
      { label: "Daily Records", href: "/app/daily-records" },
      { label: "Feed", href: "/app/feeding-log" },
      { label: "Mortality", href: "/app/mortality" },
    ],
  },
  {
    title: "Health & Supply Oversight",
    items: [
      { label: "Health", href: "/app/health" },
      { label: "Inventory", href: "/app/inventory" },
      { label: "Sales", href: "/app/sales" },
    ],
  },
];

const farmManagerNavSections: NavSection[] = [
  {
    title: "Farm Operations",
    items: [
      { label: "Manager Dashboard", href: "/app/farm-manager" },
      { label: "Daily Records", href: "/app/daily-records" },
      { label: "Daily Close", href: "/app/operating-days" },
      { label: "Feed", href: "/app/feeding-log" },
      { label: "Mortality", href: "/app/mortality" },
      { label: "Farm Monitoring", href: "/app/farms" },
      { label: "Flocks & Batches", href: "/app/flocks" },
      { label: "Governance", href: "/app/governance" },
      { label: "Record Checks", href: "/app/reconciliation" },
    ],
  },
  {
    title: "Branch Analytics",
    items: [
      { label: "Operations Analytics", href: "/app/analytics" },
      { label: "Branch Reports", href: "/app/reports" },
    ],
  },
  {
    title: "Support Functions",
    items: [
      { label: "Health Log", href: "/app/health" },
      { label: "Inventory Log", href: "/app/inventory" },
      { label: "Sales", href: "/app/sales" },
    ],
  },
];

export function AppSidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const [role, setRole] = useState<AppRole>("ceo");
  const [orgName, setOrgName] = useState("Organization");
  const [collapsed, setCollapsed] = useState(false);
  const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const resolveRole = async () => {
      const response = await fetch("/api/me/context", { method: "GET" });
      if (!response.ok) {
        setRole("ceo");
        return;
      }

      const data = await response.json();
      const resolvedRole = normalizeRole(data?.role);
      if (resolvedRole) setRole(resolvedRole);
      const nextOrgName = String(data?.orgName ?? "").trim();
      if (nextOrgName) setOrgName(nextOrgName);
    };

    void resolveRole();
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onMobileClose?.(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen, onMobileClose]);

  const navSections = useMemo<NavSection[]>(() => {
    if (role === "farm_manager") return farmManagerNavSections;
    return ceoNavSections;
  }, [role]);
  const footer = role === "farm_manager" ? "Assigned Branch Scope" : "Organization Scope";
  const visibleNavSections = useMemo(
    () => navSections.filter((section) => section.items.length > 0),
    [navSections]
  );
  const collapsedItems = useMemo(
    () => visibleNavSections.flatMap((section) => section.items),
    [visibleNavSections]
  );
  const isActive = (href: string) =>
    pathname === href || (href !== "/app" && pathname.startsWith(`${href}/`));
  const compactSidebar = collapsed && !mobileOpen;

  return (
    <>
    {mobileOpen ? <button type="button" aria-label="Close navigation" onClick={onMobileClose} className="fixed inset-0 z-[119] bg-forest-900/55 backdrop-blur-sm lg:hidden" /> : null}
    <aside
      className={`fixed inset-y-0 left-0 z-[120] flex h-screen w-72 shrink-0 flex-col border-r border-white/10 bg-forest-900 text-sand-50 shadow-2xl transition-[width,transform] duration-300 lg:sticky lg:top-0 lg:z-50 lg:translate-x-0 lg:shadow-none ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${compactSidebar ? "lg:w-20" : "lg:w-72"}`}
    >
      <div
        className={`border-b border-white/10 ${
          compactSidebar
            ? "flex items-center justify-between gap-3 px-4 py-4 lg:flex-col lg:px-3"
            : "flex items-center justify-between gap-3 px-4 py-4"
        }`}
      >
        <Link
          href="/app"
          className={`flex min-w-0 items-center rounded-xl text-sand-50 transition hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
            compactSidebar ? "flex-1 gap-3 px-2 py-2 lg:h-11 lg:w-11 lg:flex-none lg:justify-center lg:px-0" : "flex-1 gap-3 px-2 py-2"
          }`}
          aria-label="Dashboard"
          title={compactSidebar ? "Dashboard" : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sand-50 text-forest-900">
            <Egg aria-hidden="true" className="h-5 w-5" />
          </span>
          <span className={`min-w-0 ${compactSidebar ? "lg:hidden" : ""}`}>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-300">
                {orgName}
              </span>
              <span className="mt-0.5 block font-display text-base font-semibold">Poultry Farms</span>
            </span>
        </Link>
        <button type="button" onClick={onMobileClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 text-sand-100 transition hover:bg-white/10 lg:hidden" aria-label="Close navigation"><X className="h-4 w-4" aria-hidden="true" /></button>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 text-sand-100 transition hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-300 lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="h-5 w-5" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav aria-label="Primary navigation" className={`${compactSidebar ? "space-y-2 px-3" : "space-y-5 px-4"} flex-1 overflow-y-auto py-5 text-sm [scrollbar-color:rgba(239,233,221,.25)_transparent]`}>
        {compactSidebar
          ? collapsedItems.map((item) => {
              const Icon = itemIcons[item.label] ?? ChevronRight;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                    active
                      ? "bg-sand-50 text-forest-900 shadow-sm"
                      : "text-sand-100 hover:bg-white/10 hover:text-white"
                  }`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </Link>
              );
            })
          : visibleNavSections.map((section) => {
              const isOpen = !closedSections[section.title];
              return (
                <div key={section.title}>
                  <button
                    type="button"
                    onClick={() =>
                      setClosedSections((prev) => ({
                        ...prev,
                        [section.title]: !isOpen,
                      }))
                    }
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sand-200 transition hover:bg-white/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    aria-expanded={isOpen}
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em]">
                      {section.title}
                    </span>
                    {isOpen ? (
                      <ChevronDown aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <ChevronRight aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                  {isOpen ? (
                    <div className="mt-2 space-y-1">
                      {section.items.map((item) => {
                        const Icon = itemIcons[item.label] ?? ChevronRight;
                        const active = isActive(item.href);

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={onMobileClose}
                            aria-current={active ? "page" : undefined}
                            className={`relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                              active
                                ? "bg-sand-50 font-semibold text-forest-900 shadow-sm before:absolute before:-left-1 before:h-6 before:w-1 before:rounded-full before:bg-amber-500"
                                : "text-sand-100 hover:bg-white/[.07] hover:text-white"
                            }`}
                          >
                            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
      </nav>
      <div className={`mt-auto border-t border-white/10 bg-forest-800/40 ${compactSidebar ? "px-3 py-4" : "px-5 py-4"}`}>
        <div className={compactSidebar ? "lg:hidden" : ""}>
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-sand-200">{footer}</p>
            <SignOutButton tone="dark" />
          </div>
        </div>
        {compactSidebar ? <div className="hidden justify-center lg:flex"><SignOutButton iconOnly tone="dark" /></div> : null}
      </div>
    </aside>
    </>
  );
}
