import { feedAdmin, feedJson, getFeedContext, resolveFeedBatch } from "@/lib/feed-control";

export async function POST(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: "Only an operations manager can close a feeding day." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return feedJson({ error: "Invalid request body." }, 400);
  const resolved = await resolveFeedBatch(ctx, String(body.batchId ?? "")); if (!resolved.batch) return feedJson({ error: resolved.error }, 403);
  const { data, error } = await feedAdmin.rpc("close_feed_day", { p_actor_id: ctx.userId, p_flock_id: String(body.flockId ?? ""), p_record_date: String(body.recordDate ?? ""), p_override_reason: String(body.overrideReason ?? "").trim() || null });
  return error ? feedJson({ error: error.message }, 400) : feedJson({ result: data });
}

export async function DELETE(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: "Only an operations manager can reopen a feeding day." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !String(body.reason ?? "").trim()) return feedJson({ error: "A reopen reason is required." }, 400);
  const resolved = await resolveFeedBatch(ctx, String(body.batchId ?? "")); if (!resolved.batch) return feedJson({ error: resolved.error }, 403);
  const { data, error } = await feedAdmin.rpc("reopen_feed_day", { p_actor_id: ctx.userId, p_flock_id: String(body.flockId ?? ""), p_record_date: String(body.recordDate ?? ""), p_reason: String(body.reason).trim() });
  return error ? feedJson({ error: error.message }, 400) : feedJson({ result: data });
}
