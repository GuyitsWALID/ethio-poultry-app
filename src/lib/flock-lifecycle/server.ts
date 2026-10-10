import "server-only";
import {canAccessFarm, governanceAdmin as db, type AccessContext} from "@/lib/access-context";
import {buildFlockProfile, profilePeriod, type ProfileDays, type ProfileDaily, type ProfileFlock} from "./profile";
import {loadTodayWorkspace} from "@/lib/today-workspace/workspace";
import type {FlockType} from "@/lib/farm-manager-dashboard";

export class FlockLifecycleError extends Error {
  constructor(public code: "UNAVAILABLE" | "INVALID_PERIOD" | "SOURCE_LIMIT" | "LOAD_FAILED", public status: number) {super(code);}
}

function required<T>(result: {data: T | null; error: unknown}): T {
  if (result.error || result.data === null) throw new FlockLifecycleError("LOAD_FAILED", 500);
  return result.data;
}

export function addisOperatingDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function loadFlockProfile(context: AccessContext, flockId: string, days: ProfileDays) {
  if (context.role !== "farm_manager" && context.role !== "ceo" && !context.supportSessionId) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const source = await db.from("flocks").select("id,flock_code,farm_id,house_id,batch_id,breed_id,flock_type,status,placement_date,age_at_placement_days,initial_count,current_count").eq("org_id", context.orgId).eq("id", flockId).maybeSingle();
  if (source.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
  if (!source.data || !(await canAccessFarm(context, source.data.farm_id))) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const flock = source.data;
  // The generated catalogue still represents the pre-cycle schema.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cyclesDb = db as any;
  const [farmResult, houseResult, batchResult, breedResult, orgResult, settingsResult, clearanceResult] = await Promise.all([
    db.from("farms").select("name").eq("org_id", context.orgId).eq("id", flock.farm_id).maybeSingle(),
    db.from("houses").select("name").eq("org_id", context.orgId).eq("id", flock.house_id).maybeSingle(),
    flock.batch_id ? cyclesDb.from("batches").select("batch_code,batch_cycle_id").eq("org_id", context.orgId).eq("id", flock.batch_id).maybeSingle() : Promise.resolve({data: null, error: null}),
    flock.breed_id ? db.from("breeds").select("name").eq("org_id", context.orgId).eq("id", flock.breed_id).maybeSingle() : Promise.resolve({data: null, error: null}),
    db.from("organizations").select("today_workspace_enabled").eq("id", context.orgId).single(),
    db.from("feed_control_settings").select("warning_variance_pct,critical_variance_pct").eq("org_id", context.orgId).maybeSingle(),
    cyclesDb.from("effective_cycle_clearances").select("before_clearance_birds,closure_id").eq("org_id", context.orgId).eq("flock_id", flock.id).maybeSingle(),
  ]);
  if ([farmResult, houseResult, batchResult, breedResult, settingsResult, clearanceResult].some(result => result.error)) throw new FlockLifecycleError("LOAD_FAILED", 500);
  const closureResult = clearanceResult.data ? await cyclesDb.from("batch_cycle_closures").select("completed_at,mode").eq("org_id", context.orgId).eq("id", clearanceResult.data.closure_id).single() : {data: null, error: null};
  if (closureResult.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
  const completionDate = closureResult.data ? addisOperatingDate(new Date(closureResult.data.completed_at)) : null;
  const organization = required(orgResult);
  const today = addisOperatingDate();
  if (flock.placement_date > today) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const metadata: ProfileFlock = {
    id: flock.id, code: flock.flock_code, farmId: flock.farm_id, farmName: farmResult.data?.name ?? "",
    houseId: flock.house_id, houseName: houseResult.data?.name ?? "", batchId: flock.batch_id, batchLabel: batchResult.data?.batch_code ?? null,
    breedName: breedResult.data?.name ?? null, type: flock.flock_type as FlockType, status: flock.status,
    placementDate: flock.placement_date, ageAtPlacementDays: flock.age_at_placement_days ?? 0,
    startingBirds: flock.initial_count, currentBirds: clearanceResult.data ? 0 : flock.current_count,
    // An evidenced legacy clearance means no birds are present; the old source
    // population remains in immutable before-clearance evidence, not rewritten.
    completionDate, beforeClearanceBirds: clearanceResult.data?.before_clearance_birds ?? null,
  };
  const period = profilePeriod(metadata, days, today);
  const [dailyResult, feedResult, weightResult, targetResult] = await Promise.all([
    period.from && period.to ? db.from("daily_farm_records").select("record_date,flock_id,opening_birds,closing_birds,deaths,culls,total_eggs,normal_eggs,broken_eggs,dirty_eggs,feed_intake_grams,updated_at").eq("org_id", context.orgId).eq("flock_id", flock.id).is("voided_at", null).gte("record_date", period.from).lte("record_date", period.to).order("record_date").limit(1000) : Promise.resolve({data: [], error: null}),
    period.from && period.to ? db.from("feed_day_closures").select("record_date").eq("org_id", context.orgId).eq("flock_id", flock.id).eq("status", "closed").gte("record_date", period.from).lte("record_date", period.to).order("record_date").limit(1000) : Promise.resolve({data: [], error: null}),
    period.to ? db.from("weight_records").select("record_date,average_weight_g,uniformity_pct").eq("org_id", context.orgId).eq("flock_id", flock.id).gte("record_date", flock.placement_date).lte("record_date", period.to).order("record_date", {ascending: false}).order("created_at", {ascending: false}).order("id", {ascending: false}).limit(1000) : Promise.resolve({data: [], error: null}),
    flock.breed_id ? db.from("breed_standards").select("week_number,target_hdep_pct,target_mortality_pct,target_feed_g,target_weight_g").eq("org_id", context.orgId).eq("breed_id", flock.breed_id).order("week_number").limit(1000) : Promise.resolve({data: [], error: null}),
  ]);
  const daily = required(dailyResult), feed = required(feedResult), weights = required(weightResult), targets = required(targetResult);
  if ([daily, feed, weights, targets].some(rows => rows.length >= 1000)) throw new FlockLifecycleError("SOURCE_LIMIT", 409);
  const profile = buildFlockProfile({flock: metadata, days, today, daily: daily as ProfileDaily[], closedFeedDates: feed.map(row => row.record_date),
    weights, targets, allowTodayActions: context.role === "farm_manager" && organization.today_workspace_enabled,
    warningVariancePct: settingsResult.data?.warning_variance_pct ?? 5, criticalVariancePct: settingsResult.data?.critical_variance_pct ?? 10});
  if (flock.status === "active" && organization.today_workspace_enabled && context.role === "farm_manager") {
    const workspace = await loadTodayWorkspace(context, {farmId: flock.farm_id, workDate: today});
    const current = workspace.flocks.find(row => row.id === flock.id);
    profile.todayTasks = (current?.tasks ?? []).filter(task => task.applicable && task.required && task.state !== "complete").map(task => ({
      code: task.code, state: task.state,
      href: `/app/today?${new URLSearchParams({farm_id: flock.farm_id, house_id: flock.house_id, flock_id: flock.id, date: today, task: task.code})}`,
    }));
    profile.todayTasksAvailable = true;
  }
  return profile;
}
