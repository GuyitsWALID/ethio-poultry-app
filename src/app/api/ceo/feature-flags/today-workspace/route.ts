import { getAccessContext } from "@/lib/access-context";
import { describeTodayRolloutEvent, validTodayRolloutReason } from "@/lib/today-rollout";
import { createClient } from "@/utils/supabase/server";

function privateJson(body: unknown, status = 200) {
  return Response.json(body, {status, headers: {"Cache-Control": "private, no-store"}});
}

export async function GET() {
  const ctx = await getAccessContext();
  if (ctx instanceof Response) { ctx.headers.set("Cache-Control", "private, no-store"); return ctx; }
  if (ctx.role !== "ceo") return privateJson({code: "FORBIDDEN"}, 403);
  const supabase = await createClient();
  const [organization, audit] = await Promise.all([
    supabase.from("organizations").select("today_workspace_enabled").eq("id", ctx.orgId).maybeSingle(),
    supabase.from("governance_audit_events")
      .select("sequence_number,actor_id,reason,occurred_at,after_values,metadata")
      .eq("org_id", ctx.orgId).eq("source", "semantic")
      .in("event_type", ["today_workspace.enabled", "today_workspace.disabled"])
      .order("sequence_number", {ascending: false}).limit(20),
  ]);
  if (organization.error || audit.error || !organization.data) return privateJson({code: "ROLLOUT_LOAD_FAILED"}, 500);
  const ids = [...new Set((audit.data ?? []).map((row) => row.actor_id).filter(Boolean))] as string[];
  const actors = ids.length ? await supabase.from("profiles").select("id,full_name").eq("org_id", ctx.orgId).in("id", ids) : {data: [], error: null};
  if (actors.error) return privateJson({code: "ROLLOUT_LOAD_FAILED"}, 500);
  const names = new Map((actors.data ?? []).map((row) => [String(row.id), String(row.full_name ?? "")]));
  return privateJson({
    enabled: organization.data.today_workspace_enabled === true,
    events: (audit.data ?? []).map((row) => describeTodayRolloutEvent(row, row.actor_id ? names.get(row.actor_id) ?? null : null)),
  });
}

export async function POST(req: Request) {
  const ctx = await getAccessContext();
  if (ctx instanceof Response) {
    ctx.headers.set("Cache-Control", "private, no-store");
    return ctx;
  }

  if (ctx.role !== "ceo") {
    return privateJson({ error: "Forbidden: CEO role required" }, 403);
  }

  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return privateJson({error: "A JSON object is required"}, 400);
  }
  const { enabled, reason } = body as { enabled?: unknown; reason?: unknown };

  if (typeof enabled !== "boolean") {
    return privateJson({ error: "enabled (boolean) is required" }, 400);
  }
  if (!validTodayRolloutReason(reason)) {
    return privateJson({error: "A reason of 4 to 2000 characters is required."}, 400);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ceo_toggle_today_workspace", {
    p_actor_id: ctx.userId,
    p_enabled: enabled,
    p_reason: reason.trim(),
  });

  if (error) {
    return privateJson({ code: error.code === "42501" ? "FORBIDDEN" : "ROLLOUT_SAVE_FAILED" }, error.code === "42501" ? 403 : 400);
  }

  return privateJson(data);
}
