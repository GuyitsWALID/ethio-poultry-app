import type { AppLocale } from "./request";

const displayLocales: Record<AppLocale, string> = {
  en: "en-ET",
  am: "am-ET",
};

export const ADDIS_ABABA_TIME_ZONE = "Africa/Addis_Ababa";

export function formatOperationDate(value: Date | string | number, locale: AppLocale) {
  return new Intl.DateTimeFormat(displayLocales[locale], {
    dateStyle: "medium",
    timeZone: ADDIS_ABABA_TIME_ZONE,
  }).format(new Date(value));
}

export function formatOperationDateTime(value: Date | string | number, locale: AppLocale) {
  return new Intl.DateTimeFormat(displayLocales[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ADDIS_ABABA_TIME_ZONE,
  }).format(new Date(value));
}

export function formatHeaderDate(value: Date | string | number, locale: AppLocale) {
  return new Intl.DateTimeFormat(displayLocales[locale], {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: ADDIS_ABABA_TIME_ZONE,
  }).format(new Date(value));
}

export function formatNumber(value: number, locale: AppLocale, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(displayLocales[locale], {
    maximumFractionDigits,
  }).format(value);
}

export function formatEtb(value: number, locale: AppLocale) {
  return new Intl.NumberFormat(displayLocales[locale], {
    style: "currency",
    currency: "ETB",
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(value);
}
