"use client";

import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Feather,
  LockKeyhole,
  NotebookTabs,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { normalizeRole, routeForRole } from "@/lib/roles";
import { createClient } from "@/utils/supabase/client";

const workdaySteps = [
  { icon: Building2, label: "Assigned operation", detail: "See only the farms and stores you manage" },
  { icon: NotebookTabs, label: "Today’s records", detail: "Continue daily work from one clear desk" },
  { icon: ShieldCheck, label: "Verified handover", detail: "Every important change keeps its evidence" },
];

export default function SignInPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const resolvedRole = profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role;
      router.replace(routeForRole(normalizeRole(resolvedRole)));
    };

    void checkSession();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("The email or password was not recognized. Check both fields and try again.");
      setIsLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Your session could not be confirmed. Sign in again to continue.");
      setIsLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const resolvedRole = profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role;
    const normalizedRole = normalizeRole(resolvedRole);

    if (!resolvedRole) {
      setError("Your workspace role is missing. Ask your organization administrator to review your account.");
      await supabase.auth.signOut();
      setIsLoading(false);
      return;
    }

    router.replace(routeForRole(normalizedRole));
  };

  return (
    <main className="min-h-screen bg-[#F6F4EC] text-[#132A22] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(430px,.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#17352A] px-10 py-10 text-[#F7F4E9] lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-12">
        <div className="absolute inset-0 opacity-40" aria-hidden="true">
          <svg className="h-full w-full" viewBox="0 0 900 900" preserveAspectRatio="none">
            <path d="M0 690h190V540h190V390h190V240h330" fill="none" stroke="#6E927F" strokeWidth="1" />
            <path d="M125 900V620h190V470h190V320h190V0" fill="none" stroke="#6E927F" strokeWidth="1" />
            <circle cx="190" cy="540" r="7" fill="#E6A62F" />
            <circle cx="505" cy="320" r="7" fill="#E6A62F" />
            <circle cx="380" cy="390" r="5" fill="#F7F4E9" />
          </svg>
        </div>

        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[14px] border border-[#E6A62F]/30 bg-[#E6A62F]/10 text-[#E6A62F]">
            <Feather className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[.25em] text-[#A9C1B4]">EthioPoultry</p>
            <p className="mt-1 text-sm font-semibold">Farm operations workspace</p>
          </div>
        </div>

        <div className="relative max-w-2xl pb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[.28em] text-[#E6A62F]">Your working day, in order</p>
          <h1 className="mt-5 max-w-xl font-[var(--font-display)] text-5xl font-semibold leading-[1.02] xl:text-6xl">
            Start with the flock that needs you first.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#B9CDC2]">
            Sign in to the operation assigned to you. Records, stock, health work, and follow-ups stay connected to the right farm.
          </p>

          <div className="mt-10 max-w-xl border-y border-white/10">
            {workdaySteps.map(({ icon: Icon, label, detail }, index) => (
              <div key={label} className="grid grid-cols-[42px_1fr_auto] items-center gap-4 border-b border-white/10 py-4 last:border-b-0">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/[.04] text-[#E6A62F]">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="mt-1 text-xs text-[#8FA99B]">{detail}</p>
                </div>
                <span className="font-[var(--font-display)] text-lg text-[#6E927F]">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-[10px] uppercase tracking-[.18em] text-[#6E927F]">One organization · one assigned scope · one trusted record</p>
      </section>

      <section className="flex min-h-screen items-center px-5 py-10 sm:px-10 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#17352A] text-[#E6A62F]">
              <Feather className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[.24em] text-[#587568]">EthioPoultry</p>
              <p className="mt-0.5 text-sm font-semibold">Farm operations workspace</p>
            </div>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-[.25em] text-[#587568]">Welcome back</p>
          <h2 className="mt-3 font-[var(--font-display)] text-4xl font-semibold leading-tight sm:text-[44px]">Return to your operation</h2>
          <p className="mt-3 text-sm leading-6 text-[#587568]">Use the account issued for your organization.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-xs font-semibold text-[#17352A]" htmlFor="email">
              Work email
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                placeholder="name@organization.com"
                className="mt-2 h-12 w-full rounded-xl border border-[#CFDDD5] bg-white px-4 text-sm outline-none transition placeholder:text-[#91A69B] focus:border-[#17352A] focus:ring-2 focus:ring-[#D8E5DE]"
              />
            </label>

            <label className="block text-xs font-semibold text-[#17352A]" htmlFor="password">
              Password
              <span className="relative mt-2 block">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-[#CFDDD5] bg-white px-4 pr-12 text-sm outline-none transition focus:border-[#17352A] focus:ring-2 focus:ring-[#D8E5DE]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-[#587568] transition hover:bg-[#EEF2EE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#17352A]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            {error ? (
              <p role="alert" className="rounded-xl border border-[#D95C45]/30 bg-[#D95C45]/[.07] px-4 py-3 text-sm leading-5 text-[#A43D2D]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#17352A] text-sm font-semibold text-white transition hover:bg-[#0F241D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17352A] disabled:cursor-wait disabled:opacity-60"
            >
              {isLoading ? "Checking your workspace…" : "Open my workspace"}
              {isLoading ? null : <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>

          <div className="mt-7 flex items-start gap-3 border-t border-[#CFDDD5] pt-5 text-xs leading-5 text-[#587568]">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Your role and assigned farms determine what opens after sign-in.</p>
          </div>

          <div className="mt-8 rounded-xl border border-[#CFDDD5] bg-white/60 px-4 py-3 text-sm text-[#587568]">
            <p className="flex items-center gap-2 font-medium text-[#17352A]"><Check className="h-4 w-4 text-[#2C9A62]" />New organization?</p>
            <p className="mt-1 pl-6 text-xs leading-5">Create the first account only when setting up a new poultry business.</p>
            <Link href="/auth/sign-up" className="mt-2 inline-flex items-center gap-1 pl-6 text-xs font-semibold text-[#17352A] underline decoration-[#E6A62F] decoration-2 underline-offset-4">
              Start organization setup <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
