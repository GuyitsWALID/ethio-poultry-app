"use client";

import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useTranslations} from "next-intl";
import {safeHistoryReturn} from "@/lib/history/contracts";

export function HistoryReturn() {
  const query = useSearchParams(), t = useTranslations("History");
  const href = safeHistoryReturn(query.get("history_return"));
  return href ? <div className="mx-4 mt-4 sm:mx-6 lg:mx-8"><Link href={href} className="inline-flex min-h-12 items-center rounded-lg border border-sand-300 bg-white px-4 font-semibold text-forest-900 underline underline-offset-4 visited:text-forest-600">{t("back")}</Link></div> : null;
}
