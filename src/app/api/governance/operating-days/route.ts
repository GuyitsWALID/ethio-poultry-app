import { accessJson, canAccessFarm, getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";
import {createClient as createAuthedClient} from "@/utils/supabase/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function addisToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function GET(request: Request) {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  const url = new URL(request.url);
  const farmId = url.searchParams.get("farm_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const readinessDate = url.searchParams.get("date") ?? addisToday();
  if (!DATE.test(readinessDate)) return accessJson({ error: "A valid readiness date is required." }, 400);
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
  if (error) return accessJson({ error: error.message }, 500);

  const now = new Date().toISOString();
  let accessibleFarmIds: string[] = [];
  if (farmId) accessibleFarmIds = [farmId];
  else if (ctx.role === "ceo" || ctx.supportSessionId) {
    const { data: farms } = await governanceAdmin.from("farms").select("id").eq("org_id", ctx.orgId);
    accessibleFarmIds = (farms ?? []).map((row) => String(row.id));
  } else {
    const { data: assignments } = await governanceAdmin.from("user_farm_access").select("farm_id").eq("org_id", ctx.orgId).eq("profile_id", ctx.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`);
    accessibleFarmIds = (assignments ?? []).map((row) => String(row.farm_id));
  }
  if (!accessibleFarmIds.length) return accessJson({ operatingDays: data ?? [], readiness: [], meta: { date: readinessDate, timezone: "Africa/Addis_Ababa", canClose: ctx.role === "farm_manager", lockTime: "10:00:00", lockGraceDays: 7, scheduler: null } });

  const [farmsRes, flocksRes, recordsRes, closuresRes, daysRes, orgRes, schedulerRes] = await Promise.all([
    governanceAdmin.from("farms").select("id,name").eq("org_id", ctx.orgId).in("id", accessibleFarmIds),
    governanceAdmin.from("flocks").select("id,flock_code,farm_id").eq("org_id", ctx.orgId).eq("status", "active").in("farm_id", accessibleFarmIds),
    governanceAdmin.from("daily_farm_records").select("flock_id").eq("org_id", ctx.orgId).eq("record_date", readinessDate).is("voided_at", null),
    governanceAdmin.from("feed_day_closures").select("flock_id,status").eq("org_id", ctx.orgId).eq("record_date", readinessDate).eq("status", "closed"),
    governanceAdmin.from("farm_operating_days").select("*").eq("org_id", ctx.orgId).eq("operating_date", readinessDate).in("farm_id", accessibleFarmIds),
    governanceAdmin.from("organizations").select("operational_day_lock_time,operational_day_lock_grace_days").eq("id", ctx.orgId).maybeSingle(),
    governanceAdmin.from("governance_scheduler_health").select("last_started_at,last_completed_at,last_locked_count").eq("scheduler_key", "operating_day_lock").maybeSingle(),
  ]);
  const firstError = farmsRes.error ?? flocksRes.error ?? recordsRes.error ?? closuresRes.error ?? daysRes.error ?? orgRes.error ?? schedulerRes.error;
  if (firstError) return accessJson({ error: firstError.message }, 500);
  const recordIds = new Set((recordsRes.data ?? []).map((row) => String(row.flock_id)));
  const closedIds = new Set((closuresRes.data ?? []).map((row) => String(row.flock_id)));
  const dayByFarm = new Map((daysRes.data ?? []).map((row) => [String(row.farm_id), row]));
  const flocks = (flocksRes.data ?? []).map((row) => ({ id: String(row.id), code: String(row.flock_code), farmId: String(row.farm_id), dailyRecordComplete: recordIds.has(String(row.id)), feedClosed: closedIds.has(String(row.id)) }));
  const readiness = (farmsRes.data ?? []).map((farm) => {
    const farmFlocks = flocks.filter((flock) => flock.farmId === String(farm.id));
    const day = dayByFarm.get(String(farm.id));
    return { farmId: String(farm.id), farmName: String(farm.name), date: readinessDate, status: String(day?.status ?? "open"), exceptions: Array.isArray(day?.exceptions) ? day.exceptions : [], closedAt: day?.closed_at ?? null, lockedAt: day?.locked_at ?? null, flocks: farmFlocks, recordsComplete: farmFlocks.filter((flock) => flock.dailyRecordComplete).length, feedClosed: farmFlocks.filter((flock) => flock.feedClosed).length, expected: farmFlocks.length };
  });
  const scheduler=schedulerRes.data?{...schedulerRes.data,is_fresh:Boolean(schedulerRes.data.last_completed_at&&Date.now()-Date.parse(schedulerRes.data.last_completed_at)<45*60*1000)}:null;
  return accessJson({ operatingDays: data ?? [], readiness, meta: { date: readinessDate, timezone: "Africa/Addis_Ababa", canClose: ctx.role === "farm_manager", lockTime: orgRes.data?.operational_day_lock_time ?? "10:00:00", lockGraceDays: orgRes.data?.operational_day_lock_grace_days ?? 7, scheduler } });
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
