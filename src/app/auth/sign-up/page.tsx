"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { normalizeRole, routeForRole } from "@/lib/roles";
import { createClient } from "@/utils/supabase/client";

export default function SignUpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const fullName = formData.get("full_name")?.toString().trim() ?? "";
    const orgName = formData.get("organization_name")?.toString().trim() ?? "";
    const phone = formData.get("phone")?.toString().trim() ?? "";
    const email = formData.get("email")?.toString().trim() ?? "";
    const password = formData.get("password")?.toString() ?? "";
    const selectedRole = normalizeRole(formData.get("role")?.toString());

    const supabase = createClient();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: selectedRole },
      },
    });

    if (signUpError || !signUpData.user) {
      setError(signUpError?.message ?? "Unable to create account.");
      setIsLoading(false);
      return;
    }

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: orgName })
      .select("id")
      .single();

    if (orgError || !org) {
      setError(orgError?.message ?? "Organization could not be created.");
      setIsLoading(false);
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: signUpData.user.id,
      full_name: fullName || null,
      phone: phone || null,
      org_id: org.id,
      role: selectedRole,
      is_active: true,
    });

    if (profileError) {
      setError(profileError.message);
      setIsLoading(false);
      return;
    }

    router.replace(routeForRole(selectedRole));
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Auth</p>
        <h1 className="mt-2 text-2xl font-semibold text-forest-900">Create account</h1>
        <p className="mt-2 text-sm text-forest-600">
          Register your organization and launch your dashboard.
        </p>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-forest-900" htmlFor="full-name">
              Full name
            </label>
            <input
              id="full-name"
              name="full_name"
              type="text"
              required
              className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-forest-900" htmlFor="organization-name">
              Organization name
            </label>
            <input
              id="organization-name"
              name="organization_name"
              type="text"
              required
              className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-forest-900" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-forest-900" htmlFor="role">
              Role
            </label>
            <select
              id="role"
              name="role"
              defaultValue="manager"
              className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
            >
              <option value="manager">Manager (CEO access)</option>
              <option value="farm_manager">Farm Manager</option>
              <option value="veterinarian">Veterinarian</option>
              <option value="store_keeper">Store Keeper</option>
            </select>
          </div>

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
              minLength={8}
              required
              className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
            />
          </div>

          {error ? (
            <p className="md:col-span-2 rounded-xl border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-sm text-ember-500">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="md:col-span-2 h-11 rounded-xl bg-forest-900 text-sm font-medium text-sand-50 disabled:opacity-60"
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-sm text-forest-600">
          Already have an account?{" "}
          <Link href="/auth/sign-in" className="font-medium text-forest-900">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
