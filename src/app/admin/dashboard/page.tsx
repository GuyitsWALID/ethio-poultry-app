"use client";

import { useEffect, useState } from "react";

type OverviewMetrics = {
  totalOrganizations: number;
  activeOrganizations: number;
  totalUsers: number;
  newOrganizations30d: number;
};

type OnboardResult = {
  organizationId: string;
  adminUserId: string;
};
type SupportRequest={id:string;target_org_id:string;status:string;reason:string;ticket_reference:string;requested_minutes:number;expires_at:string|null};

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success">(
    "idle"
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [supportRequests,setSupportRequests]=useState<SupportRequest[]>([]);
  const [supportMessage,setSupportMessage]=useState<string|null>(null);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/overview", {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      const detail = payload?.message ? ` (${payload.message})` : "";
      setError(`Unable to load admin metrics${detail}.`);
      setLoading(false);
      return;
    }
    const data = (await response.json()) as OverviewMetrics;
    setMetrics(data);
    const supportResponse=await fetch("/api/admin/break-glass",{cache:"no-store"});if(supportResponse.ok)setSupportRequests((await supportResponse.json()).requests??[]);
    setLoading(false);
  };

  const requestSupport=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();setSupportMessage(null);const form=new FormData(event.currentTarget);const response=await fetch("/api/admin/break-glass",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({target_org_id:form.get("target_org_id"),ticket_reference:form.get("ticket_reference"),reason:form.get("reason"),requested_minutes:Number(form.get("requested_minutes"))})});const payload=await response.json();setSupportMessage(response.ok?"Support access request sent to the tenant CEO.":payload.error??"Unable to request access.");if(response.ok){event.currentTarget.reset();await loadMetrics()}};

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMetrics();
  }, []);

  const handleOnboard = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitState("submitting");

    const formData = new FormData(event.currentTarget);
    const payload = {
      organization: {
        name: formData.get("org_name")?.toString().trim(),
        plan: formData.get("plan")?.toString().trim() || null,
        branch_count: Number(formData.get("branch_count") ?? 0),
        primary_location: formData.get("primary_location")?.toString().trim() || null,
        contact_email: formData.get("org_email")?.toString().trim() || null,
        contact_phone: formData.get("org_phone")?.toString().trim() || null,
      },
      admin: {
        full_name: formData.get("admin_full_name")?.toString().trim(),
        email: formData.get("admin_email")?.toString().trim(),
        phone: formData.get("admin_phone")?.toString().trim() || null,
        password: formData.get("admin_password")?.toString() ?? "",
      },
    };

    const response = await fetch("/api/admin/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      setSubmitError(data?.message ?? "Unable to onboard organization.");
      setSubmitState("idle");
      return;
    }

    const data = (await response.json()) as OnboardResult;
    setResult(data);
    setSubmitState("success");
    event.currentTarget?.reset();
    await loadMetrics();
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-forest-500">System admin</p>
          <h1 className="mt-2 text-2xl font-semibold text-forest-900">
            Organization onboarding
          </h1>
          <p className="mt-2 text-sm text-forest-600">
            Register new companies, assign CEO/Manager accounts, and track adoption.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total organizations", value: metrics?.totalOrganizations ?? "--" },
            { label: "Active organizations", value: metrics?.activeOrganizations ?? "--" },
            { label: "Total users", value: metrics?.totalUsers ?? "--" },
            { label: "New orgs (30d)", value: metrics?.newOrganizations30d ?? "--" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-forest-500">
                {item.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-forest-900">
                {loading ? "..." : item.value}
              </p>
            </div>
          ))}
          {error ? (
            <p className="md:col-span-4 text-sm text-ember-500">{error}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-ember-300 bg-ember-50 p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.2em] text-ember-700">CEO-approved support</p><h2 className="mt-2 text-lg font-semibold text-forest-900">Request break-glass tenant access</h2><p className="mt-2 text-sm text-forest-600">Access is tenant-specific, fully audited, and automatically expires in no more than four hours.</p>{supportMessage?<p role="status" className="mt-3 text-sm font-semibold text-forest-800">{supportMessage}</p>:null}<form onSubmit={requestSupport} className="mt-5 grid gap-3 md:grid-cols-2"><input name="target_org_id" required placeholder="Target organization ID" className="h-11 rounded-xl border border-sand-200 px-3 text-sm"/><input name="ticket_reference" required placeholder="Support ticket reference" className="h-11 rounded-xl border border-sand-200 px-3 text-sm"/><input name="requested_minutes" required type="number" min={1} max={240} defaultValue={60} className="h-11 rounded-xl border border-sand-200 px-3 text-sm"/><textarea name="reason" required minLength={12} placeholder="Specific support purpose" className="min-h-24 rounded-xl border border-sand-200 p-3 text-sm md:col-span-2"/><button className="h-11 rounded-xl bg-forest-900 px-4 text-sm font-semibold text-white">Request CEO approval</button></form><div className="mt-5 space-y-2">{supportRequests.slice(0,8).map(row=><div key={row.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-white p-3 text-sm"><div><p className="font-semibold">{row.ticket_reference} · {row.status}</p><p className="text-xs text-forest-600">{row.target_org_id} · {row.requested_minutes} minutes</p></div>{row.status==="approved"&&row.expires_at?<a href="/app" className="rounded-lg bg-ember-600 px-3 py-2 text-xs font-semibold text-white">Enter audited tenant session</a>:null}</div>)}</div></section>

        <section className="rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-forest-900">Onboard a new organization</h2>
          <p className="mt-2 text-sm text-forest-600">
            Create the organization record and the CEO/Manager login in one step.
          </p>

          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleOnboard}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="org-name">
                Organization name
              </label>
              <input
                id="org-name"
                name="org_name"
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="plan">
                Plan
              </label>
              <input
                id="plan"
                name="plan"
                placeholder="Enterprise / Pilot"
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="branch-count">
                Branch count
              </label>
              <input
                id="branch-count"
                name="branch_count"
                type="number"
                min={0}
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="primary-location">
                Primary location
              </label>
              <input
                id="primary-location"
                name="primary_location"
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="org-email">
                Org email
              </label>
              <input
                id="org-email"
                name="org_email"
                type="email"
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="org-phone">
                Org phone
              </label>
              <input
                id="org-phone"
                name="org_phone"
                type="tel"
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
              />
            </div>

            <div className="md:col-span-2 mt-4 border-t border-sand-200 pt-4 text-sm font-semibold text-forest-700">
              CEO / Manager account
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="admin-full-name">
                Full name
              </label>
              <input
                id="admin-full-name"
                name="admin_full_name"
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="admin-email">
                Email
              </label>
              <input
                id="admin-email"
                name="admin_email"
                type="email"
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="admin-phone">
                Phone
              </label>
              <input
                id="admin-phone"
                name="admin_phone"
                type="tel"
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-forest-900" htmlFor="admin-password">
                Temporary password
              </label>
              <input
                id="admin-password"
                name="admin_password"
                type="password"
                minLength={12}
                className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
                required
              />
            </div>

            {submitError ? (
              <p className="md:col-span-2 rounded-xl border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-sm text-ember-500">
                {submitError}
              </p>
            ) : null}

            {submitState === "success" && result ? (
              <p className="md:col-span-2 rounded-xl border border-leaf-500/40 bg-leaf-500/10 px-3 py-2 text-sm text-leaf-600">
                Organization created. Org ID: {result.organizationId}. Admin User ID:
                {" "}
                {result.adminUserId}.
              </p>
            ) : null}

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={submitState === "submitting"}
                className="rounded-full bg-forest-900 px-5 py-2 text-sm text-sand-50 disabled:opacity-60"
              >
                {submitState === "submitting" ? "Creating..." : "Create organization"}
              </button>
            </div>
          </form>
        </section>
    </div>
  );
}
