export type FeedTemplatePlan = {
  state: "ready" | "missing_template" | "missing_age_range" | "missing_population" | "invalid_template";
  ageDays: number; templateName?: string; gramsPerBird?: number; feedType?: string;
  openingBirds?: number; dailyKg?: number;
};
export function calculateTemplateFeedPlan(ageDays: number, templateName: string, row: {feed_intake_recommended_g_per_head: unknown; feed_type_plan: unknown} | null, openingBirds: number | null): FeedTemplatePlan {
  if (!row) return {state: "missing_age_range", ageDays, templateName};
  const grams = row.feed_intake_recommended_g_per_head === null ? NaN : Number(row.feed_intake_recommended_g_per_head);
  const feedType = String(row.feed_type_plan ?? "");
  if (!Number.isFinite(grams) || grams < 0 || !["starter_feed", "grower_pullet_feed", "layer_feed", "broiler_feed", "medicated_feed"].includes(feedType)) return {state: "invalid_template", ageDays, templateName};
  if (openingBirds === null || !Number.isInteger(openingBirds) || openingBirds < 0) return {state: "missing_population", ageDays, templateName, gramsPerBird: grams, feedType};
  return {state: "ready", ageDays, templateName, gramsPerBird: grams, feedType, openingBirds, dailyKg: Math.round(openingBirds * grams / 10) / 100};
}
