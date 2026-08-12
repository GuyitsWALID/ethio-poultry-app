import { feedAdmin, feedJson, getFeedContext, resolveFeedBatch, type FeedTemplateInputRow, validateTemplateRows } from "@/lib/feed-control";
import {governanceAdmin} from "@/lib/access-context";

export async function POST(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: "Only an operations manager can manage feed templates." }, 403);
  const body = await request.json().catch(() => null) as { batchId?: string; name?: string; sourceType?: string; rows?: FeedTemplateInputRow[] } | null;
  if (!body?.batchId || !Array.isArray(body.rows)) return feedJson({ error: "Batch and template rows are required." }, 400);
  const resolved = await resolveFeedBatch(ctx, body.batchId); if (!resolved.batch) return feedJson({ error: resolved.error }, 403);
  const validation = validateTemplateRows(body.rows); if (validation) return feedJson({ error: validation }, 400);
  const sourceType = body.sourceType ?? "manual"; if (!["breed_standard", "manual", "upload"].includes(sourceType)) return feedJson({ error: "Unsupported template source." }, 400);
  if(!ctx.supportSessionId){const {data,error}=await governanceAdmin.from("governance_requests").insert({org_id:ctx.orgId,request_type:"feed_template",farm_id:resolved.batch.farm_id,changed_fields:["name","source_type","rows"],proposed_values:{batch_id:body.batchId,name:body.name??"Batch feed template",source_type:sourceType,rows:body.rows},reason:`Replace the feed template for batch ${resolved.batch.batch_code}.`,requested_by:ctx.userId}).select().single();return error?feedJson({error:error.message},400):feedJson({request:data},201)}
  const { data, error } = await feedAdmin.rpc("save_feed_template", { p_actor_id: ctx.userId, p_batch_id: body.batchId, p_name: body.name ?? "Batch feed template", p_source_type: sourceType, p_rows: body.rows });
  return error ? feedJson({ error: error.message }, 400) : feedJson({ result: data });
}
