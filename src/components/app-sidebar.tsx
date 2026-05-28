"use client";

import Link from "next/link";
import {
  Bird,
  Box,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Factory,
  LineChart,
  Shield,
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

const ceoNavSections: NavSection[] = [
  {
    title: "Executive",
    items: [
      { label: "Command Center", href: "/app/ceo" },
      { label: "Branch Network", href: "/app/ceo/setup" },
      { label: "Analytics", href: "/app/analytics" },
      { label: "Reports", href: "/app/reports" },
      { label: "Accounting", href: "/app/accounting" },
    ],
  },
  {
    title: "Operations Oversight",
    items: [
      { label: "Farm Network", href: "/app/farms" },
      { label: "Flock Portfolio", href: "/app/flocks" },
      { label: "Batches", href: "/app/batches" },
      { label: "Daily Records", href: "/app/daily-records" },
      { label: "Feeding Scheduler", href: "/app/feeding-log" },
      { label: "Mortality", href: "/app/mortality" },
      { label: "Sensors", href: "/app/sensors" },
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
  {
    title: "Organization",
    items: [],
  },
];

const farmManagerNavSections: NavSection[] = [
  {
    title: "Farm Operations",
    items: [
      { label: "Manager Dashboard", href: "/app/farm-manager" },
      { label: "Daily Records", href: "/app/daily-records" },
      { label: "Feeding Scheduler", href: "/app/feeding-log" },
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
      { label: "Sensors", href: "/app/sensors" },
    ],
  },
  {
    title: "Support Functions",
    items: [
      { label: "Health Log", href: "/app/health" },
      { label: "Inventory Log", href: "/app/inventory" },
    ],
  },
];

export function AppSidebar() {
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
            { label: "Vet Dashboard", href: "/app/veterinarian" },
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
            { label: "Store Dashboard", href: "/app/store-keeper" },
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
  const sectionIcons = useMemo<Record<string, LucideIcon>>(
    () => ({
      Executive: LineChart,
      "Operations Oversight": Factory,
      "Health & Supply Oversight": Shield,
      Organization: Briefcase,
      "Farm Operations": Bird,
      "Branch Analytics": LineChart,
      "Support Functions": Briefcase,
      Veterinary: Shield,
      "Store Operations": Box,
    }),
    []
  );

  return (
    <aside
      className={`hidden flex-col border-r border-sand-200 bg-forest-900 text-sand-50 lg:flex ${
        collapsed ? "w-20" : "w-64"
      } transition-all duration-300`}
    >
      <div className={`px-6 pt-6 ${collapsed ? "pb-3" : "pb-4"}`}>
        <div className={collapsed ? "flex items-center justify-center" : "flex items-center gap-3"}>
          {collapsed ? <Bird aria-hidden="true" className="h-6 w-6" /> : null}
          {!collapsed ? (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-200">
                {orgName}
              </p>
              
            </div>
          ) : null}
        </div>
      </div>

      <div className={`px-4 ${collapsed ? "pb-4" : "pb-3"}`}>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className={`flex items-center rounded-full border border-sand-200/30 text-sand-50 transition hover:bg-forest-800 ${
            collapsed
              ? "mx-auto h-8 w-8 justify-center"
              : "ml-auto h-8 gap-1 px-3"
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              <span className="text-xs">Collapse</span>
            </>
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-4 px-4 pb-6 text-sm">
        {visibleNavSections.map((section) => {
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
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sand-100 transition hover:bg-forest-800"
              >
                <span className="flex items-center gap-2">
                  {collapsed ? (() => {
                    const Icon = sectionIcons[section.title];
                    return Icon ? (
                      <span className="flex h-5 w-5 items-center justify-center">
                        <Icon aria-hidden="true" className="h-5 w-5" />
                      </span>
                    ) : null;
                  })() : null}
                  {!collapsed ? (
                    <span className="text-xs uppercase tracking-[0.25em]">
                      {section.title}
                    </span>
                  ) : null}
                </span>
                {!collapsed ? (
                  <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                ) : null}
              </button>
              {isOpen && !collapsed ? (
                <div className="mt-2 space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sand-100 transition hover:bg-forest-800"
                    >
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-forest-800 px-6 py-4">
        {!collapsed ? (
          <div className="space-y-3">
            <Link
              href="/app/settings"
              className="flex w-full items-center justify-center rounded-xl border border-sand-200/30 px-3 py-2 text-xs text-sand-100 transition hover:bg-forest-800"
            >
              Settings
            </Link>
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
