import { feedAdmin, feedJson, getFeedContext } from "@/lib/feed-control";

export async function POST(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!["ceo", "system_admin", "super_admin"].includes(ctx.role)) return feedJson({ error: "CEO or administrator access is required to change feed thresholds." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const warning = Number(body?.warningVariancePct); const critical = Number(body?.criticalVariancePct);
  if (!Number.isFinite(warning) || !Number.isFinite(critical) || warning <= 0 || critical <= warning) return feedJson({ error: "Critical variance must be greater than a positive warning variance." }, 400);
  const { data, error } = await feedAdmin.from("feed_control_settings").upsert({ org_id: ctx.orgId, warning_variance_pct: warning, critical_variance_pct: critical, updated_at: new Date().toISOString() }, { onConflict: "org_id" }).select().single();
  return error ? feedJson({ error: error.message }, 400) : feedJson({ settings: data });
}
