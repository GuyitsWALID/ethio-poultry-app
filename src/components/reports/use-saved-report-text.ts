"use client";
import {useLocale} from "next-intl";
import en from "../../../messages/en.json";
import am from "../../../messages/am.json";
import {formatOperationDate, formatOperationDateTime} from "@/i18n/formats";

export function useSavedReportText() {
  const locale = useLocale() === "am" ? "am" : "en";
  return {locale, copy: (locale === "am" ? am : en).SavedReports,
    date: (value: string) => formatOperationDate(value, locale),
    timestamp: (value: string) => formatOperationDateTime(value, locale)};
}
