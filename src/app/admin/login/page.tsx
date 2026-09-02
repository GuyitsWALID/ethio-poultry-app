"use client";

import { ArrowLeft, Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { normalizeRole } from "@/lib/roles";
import { createClient } from "@/utils/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(null); setIsLoading(true);
    const formData = new FormData(event.currentTarget);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: formData.get("email")?.toString().trim() ?? "", password: formData.get("password")?.toString() ?? "" });
    if (signInError) { setError("The email or password was not accepted."); setIsLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("The session could not be verified. Sign in again."); setIsLoading(false); return; }
    let role = normalizeRole(user.user_metadata?.role);
    if (role !== "system_admin") {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      role = normalizeRole(profile?.role);
    }
    if (role !== "system_admin") { await supabase.auth.signOut(); setError("This account does not have platform administrator access."); setIsLoading(false); return; }
    router.replace("/admin/dashboard");
  };

  return <main className="grid min-h-screen bg-[#0B1714] p-3 text-[#F5F8F6] sm:p-5 lg:grid-cols-[minmax(360px,520px)_1fr] lg:gap-5">
    <section className="order-2 flex items-center rounded-[28px] bg-[#F5F8F6] px-5 py-10 text-[#0B1714] sm:px-10 lg:order-1 xl:px-14"><div className="mx-auto w-full max-w-md"><Link href="/admin" className="mb-10 inline-flex items-center gap-2 text-xs font-semibold text-[#587A6B] hover:text-[#15382E]"><ArrowLeft className="h-4 w-4" />Return to secure portal</Link><p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#587A6B]">Identity verification</p><h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold">Administrator sign in</h1><p className="mt-3 text-sm leading-6 text-[#587A6B]">Use the dedicated System Administrator account. Tenant user credentials cannot enter this console.</p><form className="mt-8 space-y-5" onSubmit={handleSubmit}><label className="block text-xs font-semibold text-[#15382E]">Administrator email<input name="email" type="email" required autoComplete="username" autoFocus className="mt-2 h-12 w-full rounded-xl border border-[#D7E7DF] bg-white px-4 text-sm outline-none focus:border-[#15382E] focus:ring-2 focus:ring-[#D7E7DF]" /></label><label className="block text-xs font-semibold text-[#15382E]">Password<span className="relative mt-2 block"><input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" className="h-12 w-full rounded-xl border border-[#D7E7DF] bg-white px-4 pr-12 text-sm outline-none focus:border-[#15382E] focus:ring-2 focus:ring-[#D7E7DF]" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-2 grid h-8 w-8 place-items-center text-[#587A6B]" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>{error ? <p role="alert" className="rounded-xl border border-[#D95C45]/25 bg-[#D95C45]/[.07] px-4 py-3 text-sm leading-5 text-[#A43D2D]">{error}</p> : null}<button type="submit" disabled={isLoading} className="h-12 w-full rounded-xl bg-[#15382E] text-sm font-semibold text-white transition hover:bg-[#0B1714] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15382E] disabled:cursor-wait disabled:opacity-60">{isLoading ? "Verifying administrator…" : "Enter control room"}</button></form><p className="mt-6 flex items-center gap-2 text-xs text-[#587A6B]"><LockKeyhole className="h-4 w-4" />Role and session are verified before access.</p></div></section>
    <section className="relative order-1 hidden overflow-hidden rounded-[28px] border border-white/10 px-10 py-12 lg:order-2 lg:flex lg:flex-col lg:justify-between"><div className="absolute inset-0 opacity-30" aria-hidden="true"><svg className="h-full w-full" viewBox="0 0 900 900" preserveAspectRatio="none"><path d="M0 180h230v180h205v230h250v150h215M120 900V690h185V490h230V245h365" fill="none" stroke="#79998B" strokeWidth="1"/><circle cx="435" cy="360" r="7" fill="#E7A92F"/><circle cx="535" cy="490" r="7" fill="#E7A92F"/><circle cx="685" cy="740" r="7" fill="#E7A92F"/></svg></div><div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-[14px] border border-[#E7A92F]/30 bg-[#E7A92F]/10 text-[#E7A92F]"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.24em] text-[#A5C0B4]">EthioPoultry</p><p className="mt-1 text-sm font-semibold">Platform custody</p></div></div><div className="relative max-w-xl"><p className="text-[10px] font-semibold uppercase tracking-[.24em] text-[#E7A92F]">Access contract</p><h2 className="mt-4 font-[var(--font-display)] text-5xl font-semibold leading-[1.05]">Power stays separate from farm decisions.</h2><div className="mt-8 space-y-4">{["Platform health without tenant business authority", "CEO approval before tenant support access", "Immutable evidence for privileged actions"].map((item) => <div key={item} className="flex items-center gap-3 border-t border-white/10 pt-4 text-sm text-[#C8D9D1]"><span className="grid h-6 w-6 place-items-center rounded-full border border-[#E7A92F]/30 text-[#E7A92F]"><Check className="h-3.5 w-3.5" /></span>{item}</div>)}</div></div><p className="relative text-[10px] uppercase tracking-[.16em] text-[#587A6B]">Authentication events are retained</p></section>
  </main>;
}
