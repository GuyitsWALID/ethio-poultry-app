import {getTranslations} from "next-intl/server";
import { feedAdmin, feedJson, getFeedContext, resolveFeedBatch, type FeedTemplateInputRow, validateTemplateRows } from "@/lib/feed-control";
import {getAccessContext,isAccessResponse} from "@/lib/access-context";
import {submitGovernanceRequest} from "@/lib/governance-workflow";

export async function POST(request: Request) {
  const t = await getTranslations("FeedValidation");
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: t("templates") }, 403);
  const body = await request.json().catch(() => null) as { batchId?: string; name?: string; sourceType?: string; rows?: FeedTemplateInputRow[] } | null;
  if (!body?.batchId || !Array.isArray(body.rows)) return feedJson({ error: t("rows") }, 400);
  const resolved = await resolveFeedBatch(ctx, body.batchId); if (!resolved.batch) return feedJson({ error: resolved.error }, 403);
  const validation = validateTemplateRows(body.rows, (key, values) => t(key as Parameters<typeof t>[0], values)); if (validation) return feedJson({ error: validation }, 400);
  const sourceType = body.sourceType ?? "manual"; if (!["breed_standard", "manual", "upload"].includes(sourceType)) return feedJson({ error: t("source") }, 400);
  if(!ctx.supportSessionId){const access=await getAccessContext({tenant:true});if(isAccessResponse(access))return access;try{const data=await submitGovernanceRequest(access,{request_type:"feed_template",farm_id:resolved.batch.farm_id,changed_fields:["name","source_type","rows"],proposed_values:{batch_id:body.batchId,name:body.name??"Batch feed template",source_type:sourceType,rows:body.rows},reason:`Replace the feed template for batch ${resolved.batch.batch_code}.`,correction_route:"/app/feeding-log"});return feedJson({request:data},201)}catch(error){return feedJson({error:error instanceof Error?error.message:t("submit")},400)}}
  const { data, error } = await feedAdmin.rpc("save_feed_template", { p_actor_id: ctx.userId, p_batch_id: body.batchId, p_name: body.name ?? "Batch feed template", p_source_type: sourceType, p_rows: body.rows });
  return error ? feedJson({ error: error.message }, 400) : feedJson({ result: data });
}
