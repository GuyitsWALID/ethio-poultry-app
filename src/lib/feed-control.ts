import { createClient } from "@supabase/supabase-js";

import { normalizeRole, type AppRole } from "@/lib/roles";
import type { Database } from "@/types/supabase";
import { createClient as createAuthedClient } from "@/utils/supabase/server";

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
  allowedBranchIds: Set<string>;
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
  const auth = await createAuthedClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return feedJson({ error: "Unauthorized" }, 401);
  const { data: profile, error } = await feedAdmin.from("profiles").select("org_id,role").eq("id", user.id).maybeSingle();
  if (error) return feedJson({ error: error.message }, 500);
  if (!profile?.org_id) return feedJson({ error: "Profile is missing organization access." }, 403);
  const role = normalizeRole(profile.role);
  if (!["farm_manager", "veterinarian", "store_keeper", "ceo", "system_admin", "super_admin"].includes(role)) {
    return feedJson({ error: "Feed Control access is required." }, 403);
  }
  const [farms, branches] = role === "farm_manager"
    ? await Promise.all([
        feedAdmin.from("user_farm_access").select("farm_id").eq("profile_id", user.id),
        feedAdmin.from("user_branch_access").select("branch_id").eq("profile_id", user.id),
      ])
    : [{ data: [] }, { data: [] }];
  return {
    userId: user.id,
    orgId: profile.org_id,
    role,
    canManage: ["farm_manager", "ceo", "system_admin", "super_admin"].includes(role),
    allowedFarmIds: new Set((farms.data ?? []).map((row) => row.farm_id)),
    allowedBranchIds: new Set((branches.data ?? []).map((row) => row.branch_id)),
  };
}

export async function resolveFeedBatch(ctx: FeedContext, batchId: string) {
  const { data, error } = await feedAdmin.from("batches")
    .select("id,batch_code,org_id,branch_id,farm_id,house_id,placement_date,age_at_placement_days,total_count,status")
    .eq("id", batchId).eq("org_id", ctx.orgId).maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Batch is not available in this organization." };
  if (ctx.role === "farm_manager" && !ctx.allowedFarmIds.has(data.farm_id) && !ctx.allowedBranchIds.has(data.branch_id)) {
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
