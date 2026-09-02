"use client";

import { Activity, Building2, Headphones, LayoutDashboard, ShieldCheck, UserPlus } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";

const navigation = [
  { label: "Overview", href: "#overview", icon: LayoutDashboard },
  { label: "System health", href: "#system-health", icon: Activity },
  { label: "Organizations", href: "#organizations", icon: Building2 },
  { label: "Tenant support", href: "#tenant-support", icon: Headphones },
  { label: "Onboarding", href: "#onboarding", icon: UserPlus },
];

export function AdminSidebar() {
  return <>
    <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col overflow-hidden bg-[#0B1714] text-[#F5F8F6] lg:flex">
      <div className="border-b border-white/10 px-6 py-7">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[14px] border border-[#E7A92F]/30 bg-[#E7A92F]/10 text-[#E7A92F]"><ShieldCheck className="h-5 w-5" aria-hidden="true" /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.24em] text-[#A5C0B4]">EthioPoultry</p><h1 className="mt-1 text-base font-semibold">Platform custody</h1></div></div>
      </div>
      <div className="px-6 pt-6"><p className="text-[9px] font-semibold uppercase tracking-[.22em] text-[#79998B]">System administrator</p><p className="mt-2 text-xs leading-5 text-[#A5C0B4]">Infrastructure, tenant onboarding, and CEO-authorized support.</p></div>
      <nav className="mt-7 flex-1 space-y-1 px-3" aria-label="Administrator sections">{navigation.map(({ label, href, icon: Icon }) => <a key={href} href={href} className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#C8D9D1] transition hover:bg-white/[.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E7A92F]"><Icon className="h-4 w-4 text-[#79998B] transition group-hover:text-[#E7A92F]" aria-hidden="true" />{label}</a>)}</nav>
      <div className="border-t border-white/10 p-4"><div className="mb-3 flex items-center gap-2 rounded-xl bg-white/[.045] px-3 py-2.5"><span className="relative h-2.5 w-2.5 rounded-full bg-emerald-400 before:absolute before:inset-[-4px] before:rounded-full before:border before:border-emerald-400/30" /><div><p className="text-[10px] font-semibold text-white">Privileged session</p><p className="text-[9px] text-[#79998B]">Platform scope only</p></div></div><SignOutButton tone="dark" redirectTo="/admin" /></div>
    </aside>

    <nav className="flex gap-1 overflow-x-auto border-b border-[#D7E7DF] bg-white px-3 py-2 lg:hidden" aria-label="Administrator sections">{navigation.map(({ label, href, icon: Icon }) => <a key={href} href={href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-[#15382E] hover:bg-[#D7E7DF]/50"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</a>)}</nav>
  </>;
}
