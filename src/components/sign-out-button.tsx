"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useState } from "react";

import { createClient } from "@/utils/supabase/client";

type SignOutButtonProps = {
  iconOnly?: boolean;
  compact?: boolean;
  tone?: "light" | "dark";
  redirectTo?: string;
};

export function SignOutButton({ iconOnly = false, compact = false, tone = "light", redirectTo = "/auth/sign-in" }: SignOutButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleSignOut = async () => {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace(redirectTo);
  };

  const toneClass = tone === "dark"
    ? "border-white/15 text-sand-50 hover:border-white/30 hover:bg-white/10 focus:ring-amber-300"
    : "border-sand-200 bg-white text-forest-700 hover:border-forest-400 hover:bg-sand-50 focus:ring-forest-500";

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 disabled:cursor-wait disabled:opacity-60 ${toneClass} ${iconOnly ? "w-10 px-0" : ""}`}
      type="button"
      onClick={() => void handleSignOut()}
      disabled={pending}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {iconOnly ? <span className="sr-only">Sign out</span> : <span className={compact ? "hidden sm:inline" : ""}>{pending ? "Signing out…" : "Sign out"}</span>}
    </button>
  );
}
