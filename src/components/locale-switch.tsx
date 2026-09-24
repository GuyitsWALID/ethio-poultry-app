"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { setDeviceLocale } from "@/i18n/locale-provider";
import { isAppLocale, type AppLocale } from "@/i18n/locale";
import type { ActiveRole } from "@/lib/permissions";

type ViewerContext = { role?: string | null; preferredLocale?: unknown };

export function LocaleSwitch({ viewerRole }: { viewerRole: ActiveRole | null }) {
  const activeLocale = useLocale() as AppLocale;
  const t = useTranslations("Common");
  const [role, setRole] = useState<string | null>(viewerRole);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/me/context", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<ViewerContext> : null)
      .then((context) => {
        if (!context) return;
        if (context.role) setRole(context.role);
        if (isAppLocale(context.preferredLocale) && context.preferredLocale !== activeLocale) {
          setDeviceLocale(context.preferredLocale);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [activeLocale]);

  if (role !== "ceo" && role !== "farm_manager") return null;

  const selectLocale = (locale: AppLocale) => {
    if (locale === activeLocale) return;
    setDeviceLocale(locale);
    void fetch("/api/me/locale", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    }).catch(() => undefined);
  };

  return (
    <div className="flex min-h-11 items-center rounded-xl border border-sand-200 bg-white p-1" role="group" aria-label={t("language")}>
      <Languages className="mx-2 hidden h-4 w-4 text-forest-500 lg:block" aria-hidden="true" />
      {(["en", "am"] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => selectLocale(locale)}
          aria-pressed={activeLocale === locale}
          className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold transition ${activeLocale === locale ? "bg-forest-900 text-white" : "text-forest-700 hover:bg-sand-50"}`}
        >
          {locale === "en" ? "EN" : "አማ"}
        </button>
      ))}
    </div>
  );
}
