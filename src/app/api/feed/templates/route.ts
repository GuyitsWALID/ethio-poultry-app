import { feedAdmin, feedJson, getFeedContext, resolveFeedBatch, type FeedTemplateInputRow, validateTemplateRows } from "@/lib/feed-control";

export async function POST(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: "Only an operations manager can manage feed templates." }, 403);
  const body = await request.json().catch(() => null) as { batchId?: string; name?: string; sourceType?: string; rows?: FeedTemplateInputRow[] } | null;
  if (!body?.batchId || !Array.isArray(body.rows)) return feedJson({ error: "Batch and template rows are required." }, 400);
  const resolved = await resolveFeedBatch(ctx, body.batchId); if (!resolved.batch) return feedJson({ error: resolved.error }, 403);
  const validation = validateTemplateRows(body.rows); if (validation) return feedJson({ error: validation }, 400);
  const sourceType = body.sourceType ?? "manual"; if (!["breed_standard", "manual", "upload"].includes(sourceType)) return feedJson({ error: "Unsupported template source." }, 400);
  const { data, error } = await feedAdmin.rpc("save_feed_template", { p_actor_id: ctx.userId, p_batch_id: body.batchId, p_name: body.name ?? "Batch feed template", p_source_type: sourceType, p_rows: body.rows });
  return error ? feedJson({ error: error.message }, 400) : feedJson({ result: data });
}
