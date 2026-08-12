"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type GateState = "idle" | "verifying" | "error";

export default function AdminEntryPage() {
  const router = useRouter();
  const [showGate, setShowGate] = useState(false);
  const [gateCode, setGateCode] = useState("");
  const [gateState, setGateState] = useState<GateState>("idle");
  const [gateError, setGateError] = useState<string | null>(null);
  const [dummyNotice, setDummyNotice] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setShowGate(true);
        setGateError(null);
        setGateState("idle");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const verifyGate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGateState("verifying");
    setGateError(null);

    const response = await fetch("/api/admin/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: gateCode }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setGateError(payload?.message ?? "Invalid access code.");
      setGateState("error");
      return;
    }

    router.replace("/admin/login");
  };

  const handleDummySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDummyNotice("Login failed.");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-sand-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-sand-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-forest-500">Portal</p>
        <h1 className="mt-2 text-2xl font-semibold text-forest-900">Sign in</h1>
        <p className="mt-2 text-sm text-forest-600">
          Authorized personnel only. Admin access requires a secure unlock sequence.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleDummySubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-forest-900" htmlFor="dummy-email">
              Email
            </label>
            <input
              id="dummy-email"
              name="email"
              type="email"
              required
              className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-forest-900" htmlFor="dummy-password">
              Password
            </label>
            <input
              id="dummy-password"
              name="password"
              type="password"
              required
              className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
            />
          </div>

          {dummyNotice ? (
            <p className="rounded-xl border border-forest-900/20 bg-sand-50 px-3 py-2 text-sm text-forest-700">
              {dummyNotice}
            </p>
          ) : null}

          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-forest-900 text-sm font-medium text-sand-50"
          >
            Sign in
          </button>
        </form>
      </div>

      {showGate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-sand-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-forest-900">Admin access</h2>
            <p className="mt-2 text-sm text-forest-600">
              Enter the system admin access code to continue.
            </p>

            <form className="mt-4 space-y-4" onSubmit={verifyGate}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-forest-900" htmlFor="gate-code">
                  Access code
                </label>
                <input
                  id="gate-code"
                  type="password"
                  value={gateCode}
                  onChange={(event) => setGateCode(event.target.value)}
                  className="h-11 w-full rounded-xl border border-sand-200 px-3 text-sm"
                  required
                />
              </div>

              {gateError ? (
                <p className="rounded-xl border border-ember-500/40 bg-ember-500/10 px-3 py-2 text-sm text-ember-500">
                  {gateError}
                </p>
              ) : null}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-full border border-forest-900/20 px-4 py-2 text-sm text-forest-700"
                  onClick={() => setShowGate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={gateState === "verifying"}
                  className="rounded-full bg-forest-900 px-4 py-2 text-sm text-sand-50 disabled:opacity-60"
                >
                  {gateState === "verifying" ? "Verifying..." : "Unlock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
