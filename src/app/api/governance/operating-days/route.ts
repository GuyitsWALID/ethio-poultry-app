import { accessJson, canAccessFarm, getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";
import {createClient as createAuthedClient} from "@/utils/supabase/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  const url = new URL(request.url);
  const farmId = url.searchParams.get("farm_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  let query = governanceAdmin.from("farm_operating_days").select("*").eq("org_id", ctx.orgId).order("operating_date", { ascending: false }).limit(100);
  if (farmId) {
    if (!(await canAccessFarm(ctx, farmId))) return accessJson({ error: "Active farm assignment is required." }, 403);
    query = query.eq("farm_id", farmId);
  } else if (ctx.role === "farm_manager") {
    const now = new Date().toISOString();
    const { data } = await governanceAdmin.from("user_farm_access").select("farm_id").eq("org_id", ctx.orgId).eq("profile_id", ctx.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`);
    query = query.in("farm_id", (data ?? []).map((row) => row.farm_id));
  }
  if (from && DATE.test(from)) query = query.gte("operating_date", from);
  if (to && DATE.test(to)) query = query.lte("operating_date", to);
  const { data, error } = await query;
  return error ? accessJson({ error: error.message }, 500) : accessJson({ operatingDays: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  if (ctx.role !== "farm_manager") return accessJson({ error: "Only a farm manager can close an operating day." }, 403);
  const body = await request.json().catch(() => null) as { farm_id?: string; operating_date?: string; exceptions?: unknown[] } | null;
  const farmId = String(body?.farm_id ?? "");
  const operatingDate = String(body?.operating_date ?? "");
  if (!farmId || !DATE.test(operatingDate)) return accessJson({ error: "Farm and operating date are required." }, 400);
  if (!(await canAccessFarm(ctx, farmId))) return accessJson({ error: "Active farm assignment is required." }, 403);
  const auth=await createAuthedClient();const { data, error } = await auth.rpc("close_farm_operating_day", { p_farm_id: farmId, p_operating_date: operatingDate, p_exceptions: body?.exceptions ?? [] });
  return error ? accessJson({ error: error.message }, error.code === "23514" ? 409 : 400) : accessJson({ operatingDay: data });
}
