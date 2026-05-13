"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { SignOutButton } from "@/components/sign-out-button";

type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard" },
  { label: "Organizations", href: "/admin/organizations" },
  { label: "Onboarding", href: "/admin/onboarding" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex h-screen flex-col border-r border-sand-200 bg-forest-900 text-sand-50 transition-all duration-300 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div className="flex items-center justify-between px-6 py-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-sand-200">
            Ethiopoultry
          </p>
          {!collapsed ? (
            <h1 className="text-xl font-semibold font-[var(--font-display)]">
              System Admin
            </h1>
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

      <nav className="flex-1 space-y-2 px-4 text-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center rounded-xl px-3 py-2 transition ${
                isActive ? "bg-forest-800" : "hover:bg-forest-800"
              }`}
            >
              <span className="text-sand-100">
                {collapsed ? item.label.slice(0, 1) : item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-forest-800 px-4 py-4">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-sand-200">Platform access</span>
            <SignOutButton />
          </div>
        ) : (
          <SignOutButton />
        )}
      </div>
    </aside>
  );
}
