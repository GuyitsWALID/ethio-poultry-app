"use client";

import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, Terminal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type GateState = "idle" | "verifying" | "error";

export default function AdminEntryPage() {
  const router = useRouter();
  const gateInput = useRef<HTMLInputElement>(null);
  const [showGate, setShowGate] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [gateCode, setGateCode] = useState("");
  const [gateState, setGateState] = useState<GateState>("idle");
  const [gateError, setGateError] = useState<string | null>(null);
  const [publicNotice, setPublicNotice] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault(); setShowGate(true); setGateError(null); setGateState("idle");
        window.setTimeout(() => gateInput.current?.focus(), 40);
      }
      if (event.key === "Escape") setShowGate(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const verifyGate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setGateState("verifying"); setGateError(null);
    const response = await fetch("/api/admin/gate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: gateCode }) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      setGateError(payload?.message ?? "The access code was not accepted."); setGateState("error"); return;
    }
    router.replace("/admin/login");
  };

  return <main className="min-h-screen bg-[#F5F8F6] text-[#0B1714] lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(420px,.75fr)]">
    <section className="relative hidden min-h-screen overflow-hidden bg-[#0B1714] px-10 py-12 text-[#F5F8F6] lg:flex lg:flex-col lg:justify-between xl:px-16">
      <div className="absolute inset-0 opacity-25" aria-hidden="true"><svg className="h-full w-full" viewBox="0 0 900 900" preserveAspectRatio="none"><path d="M85 0v300h210v160h235v245h370M0 710h220V560h205V380h230V190h245" fill="none" stroke="#79998B" strokeWidth="1"/><circle cx="295" cy="300" r="6" fill="#E7A92F"/><circle cx="530" cy="460" r="6" fill="#E7A92F"/><circle cx="655" cy="190" r="6" fill="#E7A92F"/></svg></div>
      <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[14px] border border-[#E7A92F]/30 bg-[#E7A92F]/10 text-[#E7A92F]"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.25em] text-[#A5C0B4]">EthioPoultry</p><p className="mt-1 text-sm font-semibold">Platform custody</p></div></div>
      <div className="relative max-w-2xl pb-10"><p className="text-[10px] font-semibold uppercase tracking-[.28em] text-[#E7A92F]">Restricted infrastructure surface</p><h1 className="mt-5 font-[var(--font-display)] text-5xl font-semibold leading-[1.02] xl:text-6xl">The quiet side of reliable farm operations.</h1><p className="mt-6 max-w-xl text-base leading-7 text-[#A5C0B4]">Tenant data stays separated. Support access stays CEO-controlled. Every privileged action leaves evidence.</p><div className="mt-10 grid max-w-xl grid-cols-3 border-y border-white/10 py-5 text-xs"><div><strong className="block text-lg text-white">Scoped</strong><span className="text-[#79998B]">Tenant access</span></div><div className="border-l border-white/10 pl-5"><strong className="block text-lg text-white">Audited</strong><span className="text-[#79998B]">Support custody</span></div><div className="border-l border-white/10 pl-5"><strong className="block text-lg text-white">Verified</strong><span className="text-[#79998B]">Recovery evidence</span></div></div></div>
      <p className="relative text-[10px] uppercase tracking-[.16em] text-[#587A6B]">System administration · authorized operators only</p>
    </section>

    <section className="flex min-h-screen items-center px-5 py-10 sm:px-10 xl:px-16"><div className="mx-auto w-full max-w-md"><div className="mb-10 flex items-center gap-3 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0B1714] text-[#E7A92F]"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.2em] text-[#587A6B]">EthioPoultry</p><p className="text-sm font-semibold">Secure portal</p></div></div><p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#587A6B]">Authorized personnel</p><h2 className="mt-3 font-[var(--font-display)] text-4xl font-semibold">Sign in to your workspace</h2><p className="mt-3 text-sm leading-6 text-[#587A6B]">Use the login issued for your organization.</p>
      <form className="mt-8 space-y-4" onSubmit={(event) => { event.preventDefault(); setPublicNotice("These credentials were not recognized. Check the address and password, then try again."); }}><label className="block text-xs font-semibold text-[#15382E]">Email address<input name="email" type="email" required autoComplete="email" className="mt-2 h-12 w-full rounded-xl border border-[#D7E7DF] bg-white px-4 text-sm outline-none transition focus:border-[#15382E] focus:ring-2 focus:ring-[#D7E7DF]" /></label><label className="block text-xs font-semibold text-[#15382E]">Password<input name="password" type="password" required autoComplete="current-password" className="mt-2 h-12 w-full rounded-xl border border-[#D7E7DF] bg-white px-4 text-sm outline-none transition focus:border-[#15382E] focus:ring-2 focus:ring-[#D7E7DF]" /></label>{publicNotice ? <p role="alert" className="rounded-xl border border-[#D95C45]/25 bg-[#D95C45]/[.07] px-4 py-3 text-sm leading-5 text-[#A43D2D]">{publicNotice}</p> : null}<button className="h-12 w-full rounded-xl bg-[#15382E] text-sm font-semibold text-white transition hover:bg-[#0B1714] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15382E]">Continue</button></form><div className="mt-8 flex items-center gap-3 border-t border-[#D7E7DF] pt-5 text-xs text-[#587A6B]"><LockKeyhole className="h-4 w-4" />Credentials and access events are protected.</div></div></section>

    {showGate ? <div className="fixed inset-0 z-[200] grid place-items-center bg-[#0B1714]/75 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGate(false); }}><section role="dialog" aria-modal="true" aria-labelledby="admin-gate-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#F5F8F6] shadow-2xl"><header className="flex items-start justify-between bg-[#0B1714] p-5 text-white"><div className="flex gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-[#E7A92F]/30 bg-[#E7A92F]/10 text-[#E7A92F]"><Terminal className="h-5 w-5" /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.22em] text-[#A5C0B4]">Restricted route</p><h2 id="admin-gate-title" className="mt-1 text-lg font-semibold">Unlock administrator access</h2></div></div><button type="button" onClick={() => setShowGate(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-lg border border-white/15"><X className="h-4 w-4" /></button></header><form className="p-5" onSubmit={verifyGate}><p className="text-sm leading-6 text-[#587A6B]">Enter the platform activation code. A successful unlock remains valid for 15 minutes.</p><label className="mt-5 block text-xs font-semibold text-[#15382E]">Activation code<span className="relative mt-2 block"><KeyRound className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-[#587A6B]" /><input ref={gateInput} type={showCode ? "text" : "password"} value={gateCode} onChange={(event) => setGateCode(event.target.value)} required autoComplete="one-time-code" className="h-12 w-full rounded-xl border border-[#D7E7DF] bg-white pl-10 pr-12 text-sm outline-none focus:border-[#15382E] focus:ring-2 focus:ring-[#D7E7DF]" /><button type="button" onClick={() => setShowCode((value) => !value)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center text-[#587A6B]" aria-label={showCode ? "Hide activation code" : "Show activation code"}>{showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>{gateError ? <p role="alert" className="mt-3 rounded-xl border border-[#D95C45]/25 bg-[#D95C45]/[.07] px-4 py-3 text-sm text-[#A43D2D]">{gateError}</p> : null}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowGate(false)} className="h-11 rounded-xl border border-[#D7E7DF] px-4 text-xs font-semibold text-[#15382E]">Cancel</button><button type="submit" disabled={gateState === "verifying"} className="h-11 rounded-xl bg-[#15382E] px-5 text-xs font-semibold text-white disabled:opacity-60">{gateState === "verifying" ? "Verifying…" : "Unlock console"}</button></div></form></section></div> : null}
  </main>;
}
