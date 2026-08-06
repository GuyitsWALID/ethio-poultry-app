import { createClient } from "@supabase/supabase-js";

import { hasCapability } from "@/lib/permissions";
import { type AppRole } from "@/lib/roles";
import { getAccessContext,isAccessResponse } from "@/lib/access-context";
import type { Database } from "@/types/supabase";

export { calculateFeedPerBirdDay, calculateGrowthFcr, calculateInventoryCover, calculateLayerFcr, roundFeed } from "@/lib/feed-calculations";

export const feedAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export type FeedContext = {
  userId: string;
  orgId: string;
  role: AppRole;
  canManage: boolean;
  allowedFarmIds: Set<string>;
  supportSessionId:string|null;
};

export type FeedTemplateInputRow = {
  week_number: number;
  age_day_start: number;
  age_day_end: number;
  feed_intake_std_g_per_head: number | null;
  feed_intake_recommended_g_per_head: number | null;
  target_weight_min_g: number | null;
  target_weight_max_g: number | null;
  feed_type_plan: string;
  light_on_time: string;
  light_off_time: string;
};

export function feedJson(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function addisDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function dateDays(start: string, end: string) {
  return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export async function getFeedContext(): Promise<FeedContext | Response> {
  const access=await getAccessContext({tenant:true});if(isAccessResponse(access))return access;const role=access.role;const support=Boolean(access.supportSessionId);
  if (!support&&!hasCapability(role, "tenant:view")) {
    return feedJson({ error: "Feed Control access is required." }, 403);
  }
  const now = new Date().toISOString();
  const farms = role === "farm_manager"
    ? await feedAdmin.from("user_farm_access").select("farm_id").eq("profile_id", access.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`)
    : support?await feedAdmin.from("farms").select("id").eq("org_id",access.orgId):{ data: [] };
  return {
    userId: access.userId,
    orgId: access.orgId,
    role,
    canManage: support||hasCapability(role, "farm:operate"),
    allowedFarmIds: new Set((farms.data ?? []).map((row) => "farm_id" in row?row.farm_id:row.id)),
    supportSessionId:access.supportSessionId,
  };
}

export async function resolveFeedBatch(ctx: FeedContext, batchId: string) {
  const { data, error } = await feedAdmin.from("batches")
    .select("id,batch_code,org_id,branch_id,farm_id,house_id,placement_date,age_at_placement_days,total_count,status")
    .eq("id", batchId).eq("org_id", ctx.orgId).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Batch is not available in this organization." };
  if (ctx.role === "farm_manager" && !ctx.allowedFarmIds.has(data.farm_id)) {
    return { error: "You do not have access to this batch." };
  }
  return { batch: data };
}

export function validateTemplateRows(rows: FeedTemplateInputRow[]) {
  if (!rows.length) return "Add at least one template row.";
  const weeks = new Set<number>();
  const ordered = [...rows].sort((a, b) => a.age_day_start - b.age_day_start);
  for (let index = 0; index < ordered.length; index += 1) {
    const row = ordered[index];
    if (!Number.isInteger(row.week_number) || row.week_number < 0 || weeks.has(row.week_number)) return "Every template week must be a unique non-negative whole number.";
    weeks.add(row.week_number);
    if (row.age_day_start < 0 || row.age_day_end < row.age_day_start) return `Week ${row.week_number} has an invalid age range.`;
    if (index > 0 && row.age_day_start <= ordered[index - 1].age_day_end) return `Week ${row.week_number} overlaps the previous age range.`;
    if (row.feed_intake_recommended_g_per_head === null || row.feed_intake_recommended_g_per_head < 0) return `Week ${row.week_number} needs a non-negative recommended feed target.`;
    if (row.target_weight_min_g === null || row.target_weight_max_g === null || row.target_weight_min_g < 0 || row.target_weight_max_g < row.target_weight_min_g) return `Week ${row.week_number} needs a valid weight band.`;
    if (!row.feed_type_plan.trim()) return `Week ${row.week_number} needs a feed plan.`;
  }
  return null;
}

export function statusFromVariance(variancePct: number | null, warning: number, critical: number) {
  if (variancePct === null) return { label: "Unavailable", tone: "neutral" as const };
  const magnitude = Math.abs(variancePct);
  if (magnitude >= critical) return { label: "Critical variance", tone: "critical" as const };
  if (magnitude >= warning) return { label: "Review variance", tone: "warning" as const };
  return { label: "On plan", tone: "good" as const };
}
