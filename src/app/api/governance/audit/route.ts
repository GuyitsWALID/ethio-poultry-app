import { accessJson, getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";

export async function GET(request: Request) {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  let query = governanceAdmin.from("governance_audit_events").select("*").eq("org_id", ctx.orgId).order("occurred_at", { ascending: false }).limit(limit);
  if (ctx.role === "farm_manager") query = query.eq("actor_id", ctx.userId);
  if (ctx.role === "system_admin") query = query.eq("support_session_id", ctx.supportSessionId!);
  const { data, error } = await query;
  return error ? accessJson({ error: error.message }, 500) : accessJson({ events: data ?? [] });
}
