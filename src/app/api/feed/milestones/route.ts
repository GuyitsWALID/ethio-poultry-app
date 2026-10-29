import {getTranslations} from "next-intl/server";
import { feedAdmin, feedJson, getFeedContext } from "@/lib/feed-control";

export async function POST(request: Request) {
  const t = await getTranslations("FeedValidation");
  const ctx = await getFeedContext(); if (ctx instanceof Response) return ctx;
  if (!ctx.canManage) return feedJson({ error: t("milestones") }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return feedJson({ error: t("invalid") }, 400);
  const status = String(body.status ?? "completed");
  if (!["completed", "skipped"].includes(status)) return feedJson({ error: t("milestoneStatus") }, 400);
  const { data, error } = await feedAdmin.rpc("record_feed_milestone", { p_actor_id: ctx.userId, p_milestone_id: String(body.milestoneId ?? ""), p_flock_id: String(body.flockId ?? ""), p_status: status, p_notes: String(body.notes ?? "").trim() || undefined });
  return error ? feedJson({ error: error.message }, 400) : feedJson({ result: data });
}
