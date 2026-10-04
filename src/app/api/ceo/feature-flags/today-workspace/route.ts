import { getAccessContext } from "@/lib/access-context";
import { validTodayRolloutReason } from "@/lib/today-rollout";
import { createClient } from "@/utils/supabase/server";

function privateJson(body: unknown, status = 200) {
  return Response.json(body, {status, headers: {"Cache-Control": "private, no-store"}});
}

export async function POST(req: Request) {
  const ctx = await getAccessContext();
  if (ctx instanceof Response) {
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
    return privateJson({ error: error.message }, error.code === "42501" ? 403 : 400);
  }

  return privateJson(data);
}
