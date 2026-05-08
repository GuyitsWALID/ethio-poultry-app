"use client";

import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/auth/sign-in");
  };

  return (
    <button
      className="rounded-full border border-forest-900/20 px-4 py-2"
      type="button"
      onClick={handleSignOut}
    >
      Sign out
    </button>
  );
}
