"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { AppRole } from "@/lib/roles";
import { createClient } from "@/utils/supabase/client";

type NavSection = {
  title: string;
  items: Array<{ label: string; href: string }>;
};

const ceoNavSections: NavSection[] = [
  {
    title: "Executive",
    items: [
      { label: "Command Center", href: "/app/admin" },
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

  return (
    <aside className="hidden w-64 flex-col border-r border-sand-200 bg-forest-900 text-sand-50 lg:flex">
      <div className="px-6 py-6">
        <p className="text-xs uppercase tracking-[0.3em] text-sand-200">Ethiopoultry</p>
        <h1 className="mt-2 text-2xl font-semibold font-[var(--font-display)]">Management System</h1>
      </div>
      <nav className="flex-1 space-y-6 px-4 pb-6 text-sm">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 text-xs uppercase tracking-[0.25em] text-sand-200">{section.title}</p>
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
          </div>
        ))}
      </nav>
      <div className="border-t border-forest-800 px-6 py-4 text-xs text-sand-200">{footer}</div>
    </aside>
  );
}
