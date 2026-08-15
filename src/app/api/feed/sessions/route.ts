import { feedAdmin, feedJson, getFeedContext, resolveFeedBatch } from "@/lib/feed-control";
import { governanceAdmin } from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";

const FEED_TYPES = new Set(["starter_feed", "grower_pullet_feed", "layer_feed", "broiler_feed", "medicated_feed"]);

export async function POST(request: Request) {
  const ctx = await getFeedContext();
  if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: "Only an operations manager can record feeding sessions." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return feedJson({ error: "Invalid request body." }, 400);
  const batchId = String(body.batchId ?? ""); const flockId = String(body.flockId ?? "");
  const resolved = await resolveFeedBatch(ctx, batchId);
  if (!resolved.batch) return feedJson({ error: resolved.error }, 403);
  const db = feedAdmin;
  const { data: flock } = await db.from("flocks").select("id").eq("id", flockId).eq("batch_id", batchId).eq("org_id", ctx.orgId).maybeSingle();
  if (!flock) return feedJson({ error: "Flock is not part of the selected batch." }, 400);
  const sessionName = String(body.sessionName ?? "").trim(); const recordDate = String(body.recordDate ?? "");
  const { data: closure } = await db.from("feed_day_closures").select("id").eq("org_id", ctx.orgId).eq("flock_id", flockId).eq("record_date", recordDate).eq("status", "closed").maybeSingle();
  if (closure) return feedJson({ error: "Reopen the feeding day before changing its sessions." }, 409);
  const planned = Number(body.plannedFeedKg); const actual = body.actualFeedKg === null || body.actualFeedKg === "" ? null : Number(body.actualFeedKg);
  const feeders = Number(body.feedersCount); const status = String(body.status ?? "planned"); const feedType = String(body.feedType ?? "");
  if (!sessionName || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate) || !Number.isFinite(planned) || planned <= 0 || !Number.isInteger(feeders) || feeders <= 0) return feedJson({ error: "Session name, date, positive plan, and feeder count are required." }, 400);
  if (actual !== null && (!Number.isFinite(actual) || actual < 0)) return feedJson({ error: "Actual feed cannot be negative." }, 400);
  if (!["planned", "completed", "missed"].includes(status) || (status === "completed" && actual === null)) return feedJson({ error: "Completed sessions require actual feed." }, 400);
  if (!FEED_TYPES.has(feedType)) return feedJson({ error: "Select a valid feed type." }, 400);
  const feedItemId = String(body.feedItemId ?? ""); const warehouseId = String(body.warehouseId ?? "");
  if (status === "completed" && (!feedItemId || !warehouseId)) return feedJson({ error: "Completed sessions require a feed item and warehouse." }, 400);
  if (feedItemId || warehouseId) {
    const now=new Date().toISOString();const {data:warehouseAccess}=ctx.supportSessionId?{data:{id:ctx.supportSessionId}}:await governanceAdmin.from("user_warehouse_access").select("id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).eq("warehouse_id",warehouseId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();if(!warehouseAccess)return feedJson({error:"An active assignment to the selected warehouse is required."},403);
    const [{ data: item }, { data: warehouse }] = await Promise.all([
      db.from("inventory_items").select("id,unit").eq("id", feedItemId).eq("org_id", ctx.orgId).eq("category", "feed").maybeSingle(),
      db.from("warehouses").select("id,branch_id").eq("id", warehouseId).eq("org_id", ctx.orgId).eq("branch_id", resolved.batch.branch_id).maybeSingle(),
    ]);
    if (!item || !["kg", "kilogram", "kilograms"].includes(String(item.unit).toLowerCase())) return feedJson({ error: "Select a feed inventory item measured in kilograms." }, 400);
    if (!warehouse) return feedJson({ error: "Select a warehouse in the batch branch." }, 400);
  }
  const payload = { org_id: ctx.orgId, batch_id: batchId, flock_id: flockId, record_date: recordDate, session_name: sessionName, session_time: String(body.sessionTime ?? "") || null, feeders_count: feeders, planned_feed_kg: planned, actual_feed_kg: actual, notes: String(body.notes ?? "").trim() || null, feed_item_id: feedItemId || null, warehouse_id: warehouseId || null, feed_type: feedType as "starter_feed" | "grower_pullet_feed" | "layer_feed" | "broiler_feed" | "medicated_feed", status, completed_at: status === "completed" ? new Date().toISOString() : null, completed_by: status === "completed" ? ctx.userId : null, recorded_by: ctx.userId, updated_at: new Date().toISOString() };
  const { data, error } = await db.from("feeding_session_records").upsert(payload, { onConflict: "org_id,flock_id,record_date,session_name" }).select().single();
  return error ? feedJson({ error: error.message }, 400) : feedJson({ session: data });
}

export async function DELETE(request: Request) {
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: "Only an operations manager can remove feeding sessions." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = String(body?.id ?? ""); const batchId = String(body?.batchId ?? "");const reason=String(body?.reason??"").trim();
  if (!id || !batchId||reason.length<8) return feedJson({ error: "Session, batch, and a void reason of at least eight characters are required." }, 400);
  const resolved = await resolveFeedBatch(ctx, batchId); if (!resolved.batch) return feedJson({ error: resolved.error }, 403);
  const { data: session } = await feedAdmin.from("feeding_session_records").select("id,flock_id,record_date").eq("id", id).eq("batch_id", batchId).eq("org_id", ctx.orgId).maybeSingle();
  if (!session) return feedJson({ error: "Feeding session was not found." }, 404);
  const { data: closure } = await feedAdmin.from("feed_day_closures").select("id").eq("org_id", ctx.orgId).eq("flock_id", session.flock_id).eq("record_date", session.record_date).eq("status", "closed").maybeSingle();
  if (closure) return feedJson({ error: "Reopen the feeding day before removing a session." }, 409);
  const { error } = await feedAdmin.from("feeding_session_records").update({voided_at:new Date().toISOString(),voided_by:ctx.userId,void_reason:reason} as never).eq("id", id).eq("org_id", ctx.orgId);
  if(!error)await recordAuditEvent(ctx,{eventType:"business_record.voided",operation:"update",entityTable:"feeding_session_records",entityId:id,reason,before:session,after:{voided:true},farmId:String(resolved.batch.farm_id),flockId:String(session.flock_id),batchId});
  return error ? feedJson({ error: error.message }, 400) : feedJson({ voided: true });
}
