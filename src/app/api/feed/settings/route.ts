import { feedAdmin, feedJson, getFeedContext } from "@/lib/feed-control";
import { governanceAdmin } from "@/lib/access-context";

export async function POST(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (ctx.role !== "farm_manager"&&!ctx.supportSessionId) return feedJson({ error: "Farm managers submit threshold proposals; CEOs approve them in Governance." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const warning = Number(body?.warningVariancePct); const critical = Number(body?.criticalVariancePct);
  if (!Number.isFinite(warning) || !Number.isFinite(critical) || warning <= 0 || critical <= warning) return feedJson({ error: "Critical variance must be greater than a positive warning variance." }, 400);
  if(ctx.supportSessionId){const {data,error}=await feedAdmin.from("feed_control_settings").upsert({org_id:ctx.orgId,warning_variance_pct:warning,critical_variance_pct:critical,updated_at:new Date().toISOString()},{onConflict:"org_id"}).select().single();if(!error)await governanceAdmin.from("governance_audit_events").insert({org_id:ctx.orgId,actor_id:ctx.userId,actor_role:ctx.role,support_session_id:ctx.supportSessionId,event_type:"support.feed_threshold.updated",entity_table:"feed_control_settings",entity_id:data?.id,reason:String(body?.reason??"Approved support intervention"),after_values:data});return error?feedJson({error:error.message},400):feedJson({settings:data})}
  const { data: current } = await feedAdmin.from("feed_control_settings").select("id,updated_at").eq("org_id",ctx.orgId).maybeSingle();
  const { data, error } = await governanceAdmin.from("governance_requests").insert({org_id:ctx.orgId,request_type:"warning_threshold",source_table:current?"feed_control_settings":null,source_id:current?.id??null,source_version:current?.updated_at??null,changed_fields:["warning_variance_pct","critical_variance_pct"],proposed_values:{warning_variance_pct:warning,critical_variance_pct:critical},reason:String(body?.reason??"Adjust Feed Control warning and critical variance thresholds.").trim(),requested_by:ctx.userId}).select().single();
  return error ? feedJson({ error: error.message }, 400) : feedJson({ request: data },201);
}
