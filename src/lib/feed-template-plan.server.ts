import "server-only";
import {governanceAdmin, type AccessContext} from "@/lib/access-context";
import {resolveBirdOpening} from "@/lib/today-workspace/opening-source";
import {calculateTemplateFeedPlan, type FeedTemplatePlan} from "./feed-template-plan";

export async function loadTemplateFeedPlan(context: AccessContext, flock: Record<string, unknown>, date: string): Promise<FeedTemplatePlan> {
  const ageDays = (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${flock.placement_date}T00:00:00Z`)) / 86400000 + (flock.age_at_placement_days == null ? NaN : Number(flock.age_at_placement_days));
  if (!Number.isInteger(ageDays) || ageDays < 0) throw Error("Feed target age is unavailable.");
  const template = await governanceAdmin.from("batch_feed_templates").select("id,name").eq("org_id", context.orgId).eq("batch_id", String(flock.batch_id)).eq("is_active", true).maybeSingle();
  if (template.error) throw Error(template.error.message);
  if (!template.data) return {state: "missing_template", ageDays};
  const previous = new Date(`${date}T00:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1);
  const [target, daily, prior, baseline] = await Promise.all([
    governanceAdmin.from("batch_feed_template_rows").select("feed_intake_recommended_g_per_head,feed_type_plan").eq("template_id", template.data.id).lte("age_day_start", ageDays).gte("age_day_end", ageDays).maybeSingle(),
    governanceAdmin.from("daily_farm_records").select("opening_birds").eq("org_id", context.orgId).eq("flock_id", String(flock.id)).eq("record_date", date).is("voided_at", null).maybeSingle(),
    governanceAdmin.from("daily_farm_records").select("closing_birds,record_date").eq("org_id", context.orgId).eq("flock_id", String(flock.id)).eq("record_date", previous.toISOString().slice(0, 10)).is("voided_at", null).maybeSingle(),
    governanceAdmin.from("flock_recording_starts").select("effective_date,live_birds").eq("org_id", context.orgId).eq("flock_id", String(flock.id)).eq("effective_date", date).maybeSingle(),
  ]);
  const error = [target, daily, prior, baseline].find(result => result.error)?.error;
  if (error) throw Error(error.message);
  const opening = resolveBirdOpening({workDate: date, placementDate: String(flock.placement_date), initialCount: flock.initial_count == null ? null : Number(flock.initial_count),
    dailyRecord: daily.data ? {openingBirds: daily.data.opening_birds} : null,
    previousClosingBirds: prior.data?.closing_birds ?? null, previousRecordDate: prior.data?.record_date,
    recordingStart: baseline.data ? {effectiveDate: baseline.data.effective_date, liveBirds: baseline.data.live_birds} : null});
  return calculateTemplateFeedPlan(ageDays, template.data.name, target.data, opening.openingBirds);
}
