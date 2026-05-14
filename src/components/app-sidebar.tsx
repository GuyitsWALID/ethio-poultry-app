"use client";

import Link from "next/link";
import {
  Bird,
  Box,
  Briefcase,
  Factory,
  LineChart,
  Shield,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { AppRole } from "@/lib/roles";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/utils/supabase/client";

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
      { label: "Mortality", href: "/app/mortality" },
      { label: "Alerts", href: "/app/alerts" },
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
    items: [
      { label: "CRM", href: "/app/crm" },
      { label: "Training", href: "/app/training" },
      { label: "HR", href: "/app/hr" },
      { label: "Fleet", href: "/app/fleet" },
      { label: "Users & Roles", href: "/app/users" },
      { label: "Settings", href: "/app/settings" },
    ],
  },
];

const farmManagerNavSections: NavSection[] = [
  {
    title: "Farm Operations",
    items: [
      { label: "Manager Dashboard", href: "/app/farm-manager" },
      { label: "Daily Records", href: "/app/daily-records" },
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
      { label: "Alerts", href: "/app/alerts" },
      { label: "Sensors", href: "/app/sensors" },
    ],
  },
  {
    title: "Support Functions",
    items: [
      { label: "Health Log", href: "/app/health" },
      { label: "Inventory Log", href: "/app/inventory" },
      { label: "Settings", href: "/app/settings" },
    ],
  },
];

export function AppSidebar() {
  const [role, setRole] = useState<AppRole>("ceo");
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const resolveRole = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRole("ceo");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      setRole((profile?.role as AppRole) ?? "ceo");
    };

    void resolveRole();
  }, []);

  const navSections =
    role === "farm_manager"
      ? farmManagerNavSections
      : role === "veterinarian"
        ? [
            {
              title: "Veterinary",
              items: [
                { label: "Vet Dashboard", href: "/app/veterinarian" },
                { label: "Mortality", href: "/app/mortality" },
                { label: "Health", href: "/app/health" },
              ],
            },
          ]
        : role === "store_keeper"
          ? [
              {
                title: "Store Operations",
                items: [
                  { label: "Store Dashboard", href: "/app/store-keeper" },
                  { label: "Inventory", href: "/app/inventory" },
                ],
              },
            ]
          : ceoNavSections;
  const footer = role === "farm_manager" ? "Assigned Branch Scope" : "Organization Scope";
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

  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    navSections.forEach((section) => {
      defaults[section.title] = true;
    });
    setOpenSections(defaults);
  }, [navSections]);

  return (
    <aside
      className={`hidden flex-col border-r border-sand-200 bg-forest-900 text-sand-50 lg:flex ${
        collapsed ? "w-20" : "w-64"
      } transition-all duration-300`}
    >
      <div className="flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          {collapsed ? <Bird aria-hidden="true" className="h-6 w-6" /> : null}
          {!collapsed ? (
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sand-200">
                Ethiopoultry
              </p>
              <h1 className="mt-1 text-xl font-semibold font-[var(--font-display)]">
                Management System
              </h1>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="rounded-full border border-sand-200/30 px-2 py-1 text-xs text-sand-50"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? ">>" : "<<"}
        </button>
      </div>

      <nav className="flex-1 space-y-4 px-4 pb-6 text-sm">
        {navSections.map((section) => {
          const isOpen = openSections[section.title];
          return (
            <div key={section.title}>
              <button
                type="button"
                onClick={() =>
                  setOpenSections((prev) => ({
                    ...prev,
                    [section.title]: !prev[section.title],
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
          <div className="flex items-center justify-between text-xs text-sand-200">
            <span>{footer}</span>
            <SignOutButton />
          </div>
        ) : (
          <SignOutButton iconOnly />
        )}
      </div>
    </aside>
  );
}
