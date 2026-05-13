"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { normalizeRole } from "@/lib/roles";
import { createClient } from "@/utils/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email")?.toString().trim() ?? "";
    const password = formData.get("password")?.toString() ?? "";

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const metadataRole = normalizeRole(user?.user_metadata?.role);
    let normalizedRole = metadataRole;

    if (!user) {
      setError("Unable to verify your session.");
      setIsLoading(false);
      return;
    }

    if (metadataRole !== "system_admin" && metadataRole !== "super_admin") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      normalizedRole = normalizeRole(profile?.role);
    }

    if (normalizedRole !== "system_admin" && normalizedRole !== "super_admin") {
      await supabase.auth.signOut();
      setError("This account does not have system admin access.");
      setIsLoading(false);
      return;
    }

    router.replace("/admin/dashboard");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">System Admin</p>
        <h1 className="mt-2 text-2xl font-semibold text-forest-900">Admin login</h1>
        <p className="mt-2 text-sm text-forest-600">
          Sign in with your system admin credentials to access onboarding.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-forest-900" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-forest-900" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-sm text-ember-500">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full rounded-xl bg-forest-900 text-sm font-medium text-sand-50 disabled:opacity-60"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
