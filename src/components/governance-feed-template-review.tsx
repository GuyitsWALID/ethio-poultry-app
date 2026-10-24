"use client";

import {useLocale, useTranslations} from "next-intl";
import {formatNumber} from "@/i18n/formats";
import type {AppLocale} from "@/i18n/locale";

type FeedTemplateRow = {
  week_number?: unknown;
  age_day_start?: unknown;
  age_day_end?: unknown;
  feed_intake_std_g_per_head?: unknown;
  feed_intake_recommended_g_per_head?: unknown;
  target_weight_min_g?: unknown;
  target_weight_max_g?: unknown;
  feed_type_plan?: unknown;
  light_on_time?: unknown;
  light_off_time?: unknown;
};

export function FeedTemplateReview({ rows }: { rows: unknown }) {
  const t = useTranslations("FeedTemplateReview");
  const types = useTranslations("History.codes");
  const locale = useLocale() as AppLocale;
  const text = (value: unknown) => typeof value === "number" ? formatNumber(value, locale) : value === null || value === undefined || value === "" ? "—" : String(value);
  const feedType = (value: unknown) => {
    const key = (["starter_feed", "grower_pullet_feed", "layer_feed", "broiler_feed", "medicated_feed"] as const).find(key => key === value);
    return key ? types(key) : text(value);
  };
  if (!Array.isArray(rows)) return <p className="text-sm text-forest-600">{t("empty")}</p>;

  return <div className="overflow-x-auto rounded-xl border border-sand-200 bg-white">
    <table className="min-w-[1120px] w-full text-left text-xs">
      <caption className="border-b border-sand-200 bg-sand-50 px-3 py-2 text-left font-semibold text-forest-700">
        {t("rowCount", {count: rows.length})}
      </caption>
      <thead className="bg-sand-50 uppercase tracking-wide text-forest-500"><tr>
        <th className="p-3">{t("week")}</th><th className="p-3">{t("ageDays")}</th><th className="p-3">{t("standard")}</th><th className="p-3">{t("recommended")}</th><th className="p-3">{t("targetWeight")}</th><th className="p-3">{t("feedType")}</th><th className="p-3">{t("lightsOn")}</th><th className="p-3">{t("lightsOff")}</th>
      </tr></thead>
      <tbody>{rows.map((item, index) => {
        const row = item && typeof item === "object" ? item as FeedTemplateRow : {};
        return <tr key={`${text(row.week_number)}-${index}`} className="border-t border-sand-100 text-forest-800">
          <td className="p-3 font-semibold">{text(row.week_number)}</td>
          <td className="p-3">{text(row.age_day_start)}–{text(row.age_day_end)}</td>
          <td className="p-3">{text(row.feed_intake_std_g_per_head)}</td>
          <td className="p-3 font-semibold">{text(row.feed_intake_recommended_g_per_head)}</td>
          <td className="p-3">{text(row.target_weight_min_g)}–{text(row.target_weight_max_g)} {t("grams")}</td>
          <td className="p-3">{feedType(row.feed_type_plan)}</td>
          <td className="p-3">{text(row.light_on_time)}</td>
          <td className="p-3">{text(row.light_off_time)}</td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
