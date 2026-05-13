"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/utils/supabase/client";

type SignOutButtonProps = {
  iconOnly?: boolean;
};

export function SignOutButton({ iconOnly = false }: SignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/sign-in");
  };

  return (
    <button
      className={`flex items-center gap-2 rounded-full border border-forest-900/20 px-4 py-2 ${
        iconOnly ? "justify-center" : ""
      }`}
      type="button"
      onClick={handleSignOut}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {iconOnly ? null : <span>Sign out</span>}
    </button>
  );
}
