"use client";

import { NextIntlClientProvider } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";

import am from "../../messages/am.json";
import en from "../../messages/en.json";
import { isAppLocale, type AppLocale } from "./locale";

const catalogs = { en, am } as const;
export const LOCALE_STORAGE_KEY = "ethiopoultry.preferred_locale";
export const LOCALE_CHANGE_EVENT = "ethiopoultry:locale-change";

export function setDeviceLocale(locale: AppLocale) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.cookie = `preferred_locale=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent<AppLocale>(LOCALE_CHANGE_EVENT, { detail: locale }));
}

export function LocaleProvider({ initialLocale, children }: { initialLocale: AppLocale; children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
      window.addEventListener("storage", onStoreChange);
      return () => {
        window.removeEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      return isAppLocale(saved) ? saved : initialLocale;
    },
    () => initialLocale,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="Africa/Addis_Ababa">
      {children}
    </NextIntlClientProvider>
  );
}
