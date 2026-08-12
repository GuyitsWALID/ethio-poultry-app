import { feedAdmin, feedJson, getFeedContext } from "@/lib/feed-control";

export async function POST(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: "Farm manager weight-entry access is required." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return feedJson({ error: "Invalid request body." }, 400);
  const { data, error } = await feedAdmin.rpc("record_feed_weight", { p_actor_id: ctx.userId, p_task_id: String(body.taskId ?? ""), p_record_date: String(body.recordDate ?? ""), p_sample_count: Number(body.sampleCount), p_average_weight_g: Number(body.averageWeightG), p_min_weight_g: Number(body.minWeightG), p_max_weight_g: Number(body.maxWeightG), p_uniformity_pct: Number(body.uniformityPct) });
  return error ? feedJson({ error: error.message }, 400) : feedJson({ result: data });
}
