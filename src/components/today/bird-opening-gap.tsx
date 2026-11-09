"use client";

import {useLocale, useTranslations} from "next-intl";
import {formatNumber, formatOperationDate} from "@/i18n/formats";
import type {AppLocale} from "@/i18n/locale";
import type {TodayFlockContext} from "@/lib/today-workspace/contracts";

export function BirdOpeningGap({flock}: {flock: TodayFlockContext}) {
  const t = useTranslations("Today.birdCheck");
  const locale = useLocale() as AppLocale;
  const {previousRecordDate, recordingGapDays} = flock.birdCheck;
  if (!previousRecordDate || !recordingGapDays || flock.birdCheck.openingBirds !== null) return null;
  return <p className="text-sm leading-6 text-amber-900">{t("recordingGap", {date: formatOperationDate(previousRecordDate, locale), birds: flock.previousClosingBirds === null ? "—" : formatNumber(flock.previousClosingBirds, locale), days: recordingGapDays})}</p>;
}
