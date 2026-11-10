"use client";
import {useLocale} from "next-intl";
import {formatNumber} from "@/i18n/formats";
import {feedPlanCopy} from "@/i18n/feed-plan-copy";
import type {FeedTemplatePlan} from "@/lib/feed-template-plan";

export function FeedPlanSummary({plan, sessions}: {plan?: FeedTemplatePlan; sessions: Record<string, unknown>[]}) {
 const locale = useLocale(), t = feedPlanCopy[locale === "am" ? "am" : "en"];
 const quantities = sessions.map(row => row.planned_feed_kg == null ? NaN : Number(row.planned_feed_kg));
 const allocated = quantities.every(value => Number.isFinite(value) && value >= 0) ? quantities.reduce((sum, value) => sum + value, 0) : null;
 const remaining = plan?.dailyKg != null && allocated != null ? Math.round((plan.dailyKg - allocated) * 100) / 100 : null;
 const value = (number?: number | null) => number == null ? t.unavailable : formatNumber(number, locale);
 return <section aria-label={t.title} className="grid gap-3 rounded-xl border border-sand-200 bg-sand-50 p-4">
  <h4 className="font-semibold">{t.title}{plan?.templateName ? ` · ${plan.templateName}` : ""}</h4>
  {!plan || plan.state !== "ready" ? <p role="status" className="text-sm text-amber-900">{t[plan?.state && plan.state !== "ready" ? plan.state : "missing_template"]}</p> : null}
  <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">{[[t.age, plan?.ageDays], [t.birds, plan?.openingBirds], [t.grams, plan?.gramsPerBird], [t.target, plan?.dailyKg], [t.allocated, allocated], [t.remaining, remaining]].map(([label, number]) => <div key={String(label)}><dt className="text-forest-600">{label}</dt><dd className="font-semibold">{value(number as number | null | undefined)}</dd></div>)}</dl>
  <p className="text-sm leading-6 text-forest-700">{t.help}</p>
 </section>;
}
