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
  Warehouse,
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
  "Flock Portfolio": Egg,
  Batches: Boxes,
  "Daily Records": ClipboardList,
  Feed: Package,
  Mortality: Activity,
  Health: HeartPulse,
  Inventory: Box,
  Sales: Briefcase,
  "Manager Dashboard": LayoutDashboard,
  "Farm Monitoring": Warehouse,
  "Flock & Batch Tracking": Egg,
  "Operations Analytics": ChartNoAxesCombined,
  "Branch Reports": ClipboardList,
  "Health Log": Stethoscope,
  "Inventory Log": Package,
};

const ceoNavSections: NavSection[] = [
  {
    title: "Executive",
    items: [
      { label: "Command Center", href: "/app/ceo" },
      { label: "Branch Network", href: "/app/ceo/setup" },
      { label: "Analytics", href: "/app/analytics" },
      { label: "Reports", href: "/app/reports" },
    ],
  },
  {
    title: "Operations Oversight",
    items: [
      { label: "Farm Network", href: "/app/farms" },
      { label: "Flock Portfolio", href: "/app/flocks" },
      { label: "Batches", href: "/app/batches" },
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
      { label: "Feed", href: "/app/feeding-log" },
      { label: "Mortality", href: "/app/mortality" },
      { label: "Farm Monitoring", href: "/app/farms" },
      { label: "Flock & Batch Tracking", href: "/app/flocks" },
      { label: "Batches", href: "/app/batches" },
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

export function AppSidebar() {
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
      setRole(normalizeRole(data?.role) as AppRole);
      const nextOrgName = String(data?.orgName ?? "").trim();
      if (nextOrgName) setOrgName(nextOrgName);
    };

    void resolveRole();
  }, []);

  const navSections = useMemo<NavSection[]>(() => {
    if (role === "farm_manager") return farmManagerNavSections;
    if (role === "veterinarian") {
      return [
        {
          title: "Veterinary",
          items: [
            { label: "Mortality", href: "/app/mortality" },
            { label: "Health", href: "/app/health" },
          ],
        },
      ];
    }
    if (role === "store_keeper") {
      return [
        {
          title: "Store Operations",
          items: [
            { label: "Inventory", href: "/app/inventory" },
          ],
        },
      ];
    }
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

  return (
    <aside
      className={`hidden flex-col border-r border-sand-200 bg-forest-900 text-sand-50 lg:flex ${
        collapsed ? "w-20" : "w-64"
      } transition-[width] duration-300`}
    >
      <div
        className={`border-b border-sand-200/10 ${
          collapsed
            ? "flex flex-col items-center gap-3 px-3 py-4"
            : "flex items-center justify-between gap-3 px-4 py-4"
        }`}
      >
        <Link
          href="/app"
          className={`flex items-center rounded-xl text-sand-50 transition hover:bg-forest-800 focus-visible:ring-2 focus-visible:ring-sand-50 ${
            collapsed ? "h-10 w-10 justify-center" : "min-w-0 flex-1 gap-3 px-2 py-2"
          }`}
          aria-label="Dashboard"
          title={collapsed ? "Dashboard" : undefined}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sand-50 text-forest-900">
            <Egg aria-hidden="true" className="h-5 w-5" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-xs uppercase tracking-[0.3em] text-sand-200">
                {orgName}
              </span>
              <span className="block text-sm font-semibold">Poultry Farms</span>
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sand-200/20 text-sand-100 transition hover:border-sand-200/40 hover:bg-forest-800 focus-visible:ring-2 focus-visible:ring-sand-50"
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

      <nav className={`${collapsed ? "space-y-2 px-3" : "space-y-5 px-4"} flex-1 overflow-y-auto py-5 text-sm`}>
        {collapsed
          ? collapsedItems.map((item) => {
              const Icon = itemIcons[item.label] ?? ChevronRight;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition focus-visible:ring-2 focus-visible:ring-sand-50 ${
                    active
                      ? "bg-sand-50 text-forest-900"
                      : "text-sand-100 hover:bg-forest-800 hover:text-white"
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
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sand-100 transition hover:bg-forest-800 focus-visible:ring-2 focus-visible:ring-sand-50"
                    aria-expanded={isOpen}
                  >
                    <span className="text-xs uppercase tracking-[0.25em]">
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
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 transition focus-visible:ring-2 focus-visible:ring-sand-50 ${
                              active
                                ? "bg-sand-50 text-forest-900"
                                : "text-sand-100 hover:bg-forest-800 hover:text-white"
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
      <div className={`mt-auto border-t border-sand-200/10 ${collapsed ? "px-3 py-4" : "px-6 py-4"}`}>
        {!collapsed ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-sand-200">
              <span>{footer}</span>
              <SignOutButton />
            </div>
          </div>
        ) : (
          <SignOutButton iconOnly />
        )}
      </div>
    </aside>
  );
}
