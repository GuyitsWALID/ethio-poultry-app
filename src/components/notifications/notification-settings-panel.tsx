/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { BellRing, CheckCircle2, Mail, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { InAppThreshold, NotificationCenter, NotificationSeverity } from "@/lib/notification-contract";

export function NotificationSettingsPanel() {
  const [center, setCenter] = useState<NotificationCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [inAppMinimumSeverity, setInAppMinimumSeverity] = useState<InAppThreshold>("low");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailMinimumSeverity, setEmailMinimumSeverity] = useState<NotificationSeverity>("high");

  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const body = await response.json() as NotificationCenter & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Notification preferences could not be loaded.");
      setCenter(body); setInAppMinimumSeverity(body.preferences.inAppMinimumSeverity); setEmailEnabled(body.email.available && body.preferences.emailEnabled); setEmailMinimumSeverity(body.preferences.emailMinimumSeverity);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Notification preferences could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command: "update_preferences", inAppMinimumSeverity, emailEnabled, emailMinimumSeverity }) });
      const body = await response.json() as NotificationCenter & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Notification preferences could not be saved.");
      setCenter(body); setMessage("Notification preferences saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Notification preferences could not be saved."); }
    finally { setSaving(false); }
  };

  return <section id="notification-settings" className="scroll-mt-24 overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm">
    <div className="grid lg:grid-cols-[.8fr_1.2fr]"><div className="bg-forest-900 p-5 text-sand-50 sm:p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-400"><BellRing className="h-5 w-5" /></div><p className="mt-5 text-[10px] font-semibold uppercase tracking-[.2em] text-amber-400">Notification control</p><h2 className="mt-2 font-display text-2xl font-semibold">Choose what interrupts you.</h2><p className="mt-2 text-sm leading-6 text-sand-200">The action desk always keeps the full record. These settings control which updates appear in your bell and, when available, reach your email.</p><div className="mt-5 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-sand-200"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />Changing notifications never changes ownership, deadlines, escalation, or verification.</div></div>
      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6"><label className="block text-xs font-semibold text-forest-900"><span className="flex items-center gap-2"><BellRing className="h-4 w-4 text-forest-500" />Show in the notification bell</span><select disabled={loading} value={inAppMinimumSeverity} onChange={(event) => setInAppMinimumSeverity(event.target.value as InAppThreshold)} className="mt-2 h-11 w-full rounded-xl border border-sand-200 bg-white px-3 text-sm"><option value="low">All action updates</option><option value="medium">Review and urgent only</option><option value="high">Urgent only</option><option value="off">Do not show bell updates</option></select><span className="mt-1.5 block font-normal leading-5 text-forest-500">Your assigned actions remain available in the action desk.</span></label>
        <div className="rounded-xl border border-sand-200 bg-sand-50 p-4"><div className="flex items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-xs font-semibold text-forest-900"><Mail className="h-4 w-4 text-forest-500" />Email updates</p><p className="mt-1 text-xs leading-5 text-forest-500">Transactional notices for assigned work and escalation.</p></div><label className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${emailEnabled ? "bg-forest-800" : "bg-sand-300"}`}><input type="checkbox" className="sr-only" checked={emailEnabled} disabled={loading || !center?.email.available} onChange={(event) => setEmailEnabled(event.target.checked)} /><span className={`h-5 w-5 rounded-full bg-white shadow transition ${emailEnabled ? "translate-x-5" : "translate-x-0.5"}`} /><span className="sr-only">Enable email notifications</span></label></div><select disabled={loading || !emailEnabled || !center?.email.available} value={emailMinimumSeverity} onChange={(event) => setEmailMinimumSeverity(event.target.value as NotificationSeverity)} className="mt-3 h-10 w-full rounded-lg border border-sand-200 bg-white px-3 text-xs"><option value="high">Urgent only</option><option value="medium">Review and urgent</option><option value="low">All action updates</option></select>{center?.email.available ? <p className="mt-2 flex items-center gap-1.5 text-[10px] text-leaf-600"><CheckCircle2 className="h-3.5 w-3.5" />Cloudflare email delivery is ready.</p> : <p className="mt-2 text-[10px] leading-4 text-amber-700">{center?.email.reason ?? "Checking email delivery…"}</p>}</div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2"><button type="button" onClick={() => void save()} disabled={loading || saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-forest-900 px-4 text-xs font-semibold text-white disabled:opacity-60">{saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{saving ? "Saving…" : "Save notification preferences"}</button>{message ? <p role="status" className={`text-xs ${/saved/i.test(message) ? "text-leaf-700" : "text-ember-600"}`}>{message}</p> : null}</div></div></div>
  </section>;
}
