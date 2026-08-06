import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import {
  addDays,
  authorizedFarmIds,
  buildFlockComparison,
  percent,
  summarizeDaily,
  type BreedTarget,
  type FlockComparison,
  type FlockType,
  type ManagerDailyRow,
  type WeightSample,
} from "@/lib/farm-manager-dashboard";
import {
  capacityUtilization,
  monitoringStatus,
  type FarmMonitoringResponse,
  type MonitoringStatus,
} from "@/lib/farm-monitoring";
import { parseActiveRole } from "@/lib/permissions";
import { getAccessContext,isAccessResponse } from "@/lib/access-context";

type Row = Record<string, unknown>;
type DbError = { message: string } | null;
const json = (value: unknown, status = 200) => Response.json(value, { status });

async function allRows<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: DbError }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await load(from, from + 999);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function addisDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function statusCounts(comparisons: FlockComparison[]) {
  return {
    critical: comparisons.filter((row) => row.status === "critical").length,
    watch: comparisons.filter((row) => row.status === "watch").length,
    pending: comparisons.filter((row) => row.status === "pending").length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const access=await getAccessContext({tenant:true});if(isAccessResponse(access))return access;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return json({ error: "Supabase server configuration is missing." }, 500);
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const orgId=access.orgId;const role=parseActiveRole(access.role);const user={id:access.userId};if((!role||!["farm_manager","ceo"].includes(role))&&!access.supportSessionId)return json({error:"Management access is required."},403);

    const [branches, farms, houses, flocks, farmAccess] = await Promise.all([
      allRows<Row>((a, b) => db.from("branches").select("id,name").eq("org_id", orgId).range(a, b)),
      allRows<Row>((a, b) => db.from("farms").select("id,name,branch_id,capacity_birds").eq("org_id", orgId).order("name").range(a, b)),
      allRows<Row>((a, b) => db.from("houses").select("id,name,farm_id,house_type,capacity").eq("org_id", orgId).order("name").range(a, b)),
      allRows<Row>((a, b) => db.from("flocks").select("id,flock_code,flock_type,farm_id,house_id,batch_id,current_count,status,placement_date,age_at_placement_days,breed_id").eq("org_id", orgId).range(a, b)),
      role === "farm_manager" ? allRows<{ farm_id: string }>((a, b) => db.from("user_farm_access").select("farm_id").eq("profile_id", user.id).is("revoked_at",null).lte("starts_at",new Date().toISOString()).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).range(a, b)) : Promise.resolve([]),
    ]);
    const permittedFarmIds = role === "farm_manager"
      ? authorizedFarmIds(farms.map((row) => ({ id: String(row.id), branch_id: String(row.branch_id) })), [], farmAccess.map((row) => row.farm_id))
      : new Set(farms.map((row) => String(row.id)));
    const branchId = request.nextUrl.searchParams.get("branch_id") ?? "";
    const visibleFarms = farms.filter((row) => permittedFarmIds.has(String(row.id)) && (!branchId || String(row.branch_id) === branchId));
    const visibleFarmIds = new Set(visibleFarms.map((row) => String(row.id)));
    const visibleHouses = houses.filter((row) => visibleFarmIds.has(String(row.farm_id)));
    const activeFlocks = flocks.filter((row) => visibleFarmIds.has(String(row.farm_id)) && String(row.status) === "active");
    const today = addisDate();
    const from = addDays(today, -7);
    const next14 = addDays(today, 14);
    const flockIds = activeFlocks.map((row) => String(row.id));
    const breedIds = [...new Set(activeFlocks.map((row) => String(row.breed_id ?? "")).filter(Boolean))];

    const [dailyRows, closures, standards, weights, settingsResult, healthEvents] = flockIds.length ? await Promise.all([
      allRows<ManagerDailyRow>((a, b) => db.from("daily_farm_records").select("record_date,flock_id,opening_birds,closing_birds,deaths,total_eggs,normal_eggs,broken_eggs,dirty_eggs,feed_intake_grams,updated_at").eq("org_id", orgId).is("voided_at",null).in("flock_id", flockIds).gte("record_date", from).lte("record_date", today).range(a, b)),
      allRows<Row>((a, b) => db.from("feed_day_closures").select("flock_id,record_date,status").eq("org_id", orgId).in("flock_id", flockIds).eq("record_date", today).range(a, b)),
      breedIds.length ? allRows<Row>((a, b) => db.from("breed_standards").select("breed_id,week_number,target_hdep_pct,target_mortality_pct,target_feed_g,target_weight_g").eq("org_id", orgId).in("breed_id", breedIds).range(a, b)) : Promise.resolve([]),
      allRows<Row>((a, b) => db.from("weight_records").select("flock_id,record_date,average_weight_g,uniformity_pct").eq("org_id", orgId).in("flock_id", flockIds).lte("record_date", today).order("record_date", { ascending: false }).range(a, b)),
      db.from("feed_control_settings").select("warning_variance_pct,critical_variance_pct").eq("org_id", orgId).maybeSingle(),
      allRows<Row>((a, b) => db.from("vaccination_events").select("id,flock_id,event_date,vaccine_name").eq("org_id", orgId).in("flock_id", flockIds).gte("event_date", today).lte("event_date", next14).range(a, b)),
    ]) : [[], [], [], [], { data: null, error: null }, []];

    const branchMap = new Map(branches.map((row) => [String(row.id), String(row.name)]));
    const farmMap = new Map(visibleFarms.map((row) => [String(row.id), row]));
    const houseMap = new Map(visibleHouses.map((row) => [String(row.id), row]));
    const closureKeys = new Set(closures.filter((row) => String(row.status) === "closed").map((row) => `${row.flock_id}:${row.record_date}`));
    const healthByFlock = new Map<string, number>();
    for (const row of healthEvents) healthByFlock.set(String(row.flock_id), (healthByFlock.get(String(row.flock_id)) ?? 0) + 1);
    const targetsByBreed = new Map<string, BreedTarget[]>();
    for (const row of standards) {
      const key = String(row.breed_id);
      targetsByBreed.set(key, [...(targetsByBreed.get(key) ?? []), {
        week_number: Number(row.week_number),
        target_hdep_pct: row.target_hdep_pct === null ? null : Number(row.target_hdep_pct),
        target_mortality_pct: row.target_mortality_pct === null ? null : Number(row.target_mortality_pct),
        target_feed_g: row.target_feed_g === null ? null : Number(row.target_feed_g),
        target_weight_g: row.target_weight_g === null ? null : Number(row.target_weight_g),
      }]);
    }
    const weightsByFlock = new Map<string, WeightSample[]>();
    for (const row of weights) {
      const key = String(row.flock_id);
      weightsByFlock.set(key, [...(weightsByFlock.get(key) ?? []), {
        record_date: String(row.record_date),
        average_weight_g: row.average_weight_g === null ? null : Number(row.average_weight_g),
        uniformity_pct: row.uniformity_pct === null ? null : Number(row.uniformity_pct),
      }]);
    }
    const dailyByFlock = new Map<string, ManagerDailyRow[]>();
    for (const row of dailyRows) dailyByFlock.set(row.flock_id, [...(dailyByFlock.get(row.flock_id) ?? []), row]);
    const warningVariance = Number(settingsResult.data?.warning_variance_pct ?? 5);
    const criticalVariance = Number(settingsResult.data?.critical_variance_pct ?? 10);
    const comparisons = activeFlocks.map((flock) => buildFlockComparison({
      flock: {
        id: String(flock.id), code: String(flock.flock_code), type: String(flock.flock_type) as FlockType,
        farmId: String(flock.farm_id), farmName: String(farmMap.get(String(flock.farm_id))?.name ?? "Farm"),
        houseId: String(flock.house_id), houseName: String(houseMap.get(String(flock.house_id))?.name ?? "House"),
        placementDate: String(flock.placement_date ?? today), ageAtPlacementDays: Number(flock.age_at_placement_days ?? 0), liveBirds: Number(flock.current_count ?? 0),
      },
      asOf: today,
      dailyRows: dailyByFlock.get(String(flock.id)) ?? [],
      targets: targetsByBreed.get(String(flock.breed_id ?? "")) ?? [],
      weights: weightsByFlock.get(String(flock.id)) ?? [],
      feedClosed: closureKeys.has(`${flock.id}:${today}`),
      warningVariancePct: warningVariance,
      criticalVariancePct: criticalVariance,
    }));

    const actions: FarmMonitoringResponse["actions"] = [];
    for (const comparison of comparisons) {
      if (comparison.status === "good") continue;
      actions.push({
        id: `flock:${comparison.id}`,
        severity: comparison.status === "critical" ? "critical" : comparison.status === "watch" ? "warning" : "pending",
        title: comparison.nextAction,
        context: `${comparison.farmName} · ${comparison.houseName} · ${comparison.code}`,
        route: comparison.actionRoute,
        farmId: comparison.farmId,
        houseId: comparison.houseId,
        flockId: comparison.id,
      });
    }
    const actionRank = { critical: 3, warning: 2, pending: 1 } as const;
    actions.sort((a, b) => actionRank[b.severity] - actionRank[a.severity] || a.context.localeCompare(b.context));

    const farmRows: FarmMonitoringResponse["farms"] = visibleFarms.map((farm) => {
      const farmId = String(farm.id);
      const farmHouses = visibleHouses.filter((house) => String(house.farm_id) === farmId);
      const farmComparisons = comparisons.filter((row) => row.farmId === farmId);
      const todayRows = dailyRows.filter((row) => row.record_date === today && farmComparisons.some((item) => item.id === row.flock_id));
      const layerIds = new Set(farmComparisons.filter((row) => row.type === "layer" || row.type === "parent_stock").map((row) => row.id));
      const aggregate = summarizeDaily(todayRows);
      const hdep = summarizeDaily(todayRows.filter((row) => layerIds.has(row.flock_id))).hdep;
      const liveBirds = farmComparisons.reduce((sum, row) => sum + row.liveBirds, 0);
      const operatingHouses = new Set(farmComparisons.map((row) => row.houseId)).size;
      const counts = statusCounts(farmComparisons);
      const status = monitoringStatus({ ...counts, empty: farmComparisons.length === 0 });
      const housesForFarm = farmHouses.map((house) => {
        const houseId = String(house.id);
        const houseComparisons = farmComparisons.filter((row) => row.houseId === houseId);
        const houseLiveBirds = houseComparisons.reduce((sum, row) => sum + row.liveBirds, 0);
        const houseCounts = statusCounts(houseComparisons);
        const houseStatus = monitoringStatus({ ...houseCounts, empty: houseComparisons.length === 0 });
        return {
          id: houseId,
          name: String(house.name),
          type: String(house.house_type ?? "house").replaceAll("_", " "),
          capacity: house.capacity === null ? null : Number(house.capacity),
          liveBirds: houseLiveBirds,
          utilizationPct: capacityUtilization(houseLiveBirds, house.capacity === null ? null : Number(house.capacity)),
          status: houseStatus,
          recordsComplete: houseComparisons.filter((row) => row.hasTodayRecord).length,
          recordsExpected: houseComparisons.length,
          feedDaysClosed: houseComparisons.filter((row) => row.feedClosed).length,
          feedDaysExpected: houseComparisons.length,
          upcomingHealthWork: houseComparisons.reduce((sum, row) => sum + (healthByFlock.get(row.id) ?? 0), 0),
          flocks: houseComparisons.map((row) => ({
            id: row.id, code: row.code, type: row.type.replaceAll("_", " "), ageWeeks: row.ageWeeks, liveBirds: row.liveBirds,
            metricLabel: row.metricLabel, actual: row.actual, unit: row.unit, target: row.target, targetAttainment: row.targetAttainment,
            trend: row.trend, feedPerBirdGrams: row.feedPerBirdGrams, mortalityPct: row.mortalityRate, marketableRate: row.marketableRate,
            uniformityPct: row.uniformityPct, recordStatus: !row.hasTodayRecord ? "missing" as const : row.dataStatus === "complete" ? "complete" as const : "pending" as const,
            feedClosed: row.feedClosed, dataUpdatedAt: row.recordUpdatedAt, nextAction: row.nextAction, actionRoute: row.actionRoute,
            status: row.status === "good" ? "on_track" as const : row.status, upcomingHealthWork: healthByFlock.get(row.id) ?? 0,
          })),
        };
      });
      return {
        id: farmId,
        name: String(farm.name),
        branchName: branchMap.get(String(farm.branch_id)) ?? "Branch",
        capacity: farm.capacity_birds === null ? null : Number(farm.capacity_birds),
        houseCount: farmHouses.length,
        operatingHouses,
        emptyHouses: Math.max(0, farmHouses.length - operatingHouses),
        activeFlocks: farmComparisons.length,
        liveBirds,
        utilizationPct: capacityUtilization(liveBirds, farm.capacity_birds === null ? null : Number(farm.capacity_birds)),
        hdep,
        mortalityPct: aggregate.mortality,
        feedPerBirdGrams: aggregate.feedPerBirdGrams,
        recordsComplete: farmComparisons.filter((row) => row.hasTodayRecord).length,
        recordsExpected: farmComparisons.length,
        feedDaysClosed: farmComparisons.filter((row) => row.feedClosed).length,
        feedDaysExpected: farmComparisons.length,
        upcomingHealthWork: farmComparisons.reduce((sum, row) => sum + (healthByFlock.get(row.id) ?? 0), 0),
        status,
        houses: housesForFarm,
      };
    }).sort((a, b) => {
      const rank: Record<MonitoringStatus, number> = { critical: 5, watch: 4, data_gap: 3, on_track: 2, empty: 1 };
      return rank[b.status] - rank[a.status] || a.name.localeCompare(b.name);
    });

    const todayRows = dailyRows.filter((row) => row.record_date === today);
    const layerIds = new Set(comparisons.filter((row) => row.type === "layer" || row.type === "parent_stock").map((row) => row.id));
    const liveBirds = comparisons.reduce((sum, row) => sum + row.liveBirds, 0);
    const totalCapacityValues = visibleFarms.map((row) => row.capacity_birds === null ? null : Number(row.capacity_birds)).filter((value): value is number => value !== null && value > 0);
    const totalCapacity = totalCapacityValues.length ? totalCapacityValues.reduce((sum, value) => sum + value, 0) : null;
    const recordsComplete = comparisons.filter((row) => row.hasTodayRecord).length;
    const feedDaysClosed = comparisons.filter((row) => row.feedClosed).length;
    const targetCoveragePct = percent(comparisons.filter((row) => row.targetAvailable).length, comparisons.length) ?? 0;
    const recordCoveragePct = percent(recordsComplete, comparisons.length) ?? 0;
    const feedClosurePct = percent(feedDaysClosed, comparisons.length) ?? 0;
    const notes = [
      ...(recordsComplete < comparisons.length ? [`${comparisons.length - recordsComplete} active flock(s) still need today’s Daily Record.`] : []),
      ...(feedDaysClosed < comparisons.length ? [`${comparisons.length - feedDaysClosed} feeding day(s) remain open.`] : []),
      ...(targetCoveragePct < 100 ? [`Breed/age targets cover ${targetCoveragePct}% of active flocks.`] : []),
      ...(visibleHouses.length > 0 && farmRows.reduce((sum, row) => sum + row.emptyHouses, 0) > 0 ? [`${farmRows.reduce((sum, row) => sum + row.emptyHouses, 0)} house(s) currently have no active flock.`] : []),
    ];
    const response: FarmMonitoringResponse = {
      meta: {
        today,
        timezone: "Africa/Addis_Ababa",
        refreshedAt: new Date().toISOString(),
        scopeLabel: visibleFarms.length === 1 ? visibleFarms[0].name as string : `${visibleFarms.length} assigned farms`,
        latestRecordAt: dailyRows.map((row) => row.updated_at).sort().at(-1) ?? null,
      },
      summary: {
        farms: farmRows.length,
        houses: visibleHouses.length,
        operatingHouses: new Set(comparisons.map((row) => row.houseId)).size,
        emptyHouses: farmRows.reduce((sum, row) => sum + row.emptyHouses, 0),
        activeFlocks: comparisons.length,
        liveBirds,
        capacityUtilizationPct: totalCapacity === null ? null : capacityUtilization(liveBirds, totalCapacity),
        todayHdep: summarizeDaily(todayRows.filter((row) => layerIds.has(row.flock_id))).hdep,
        mortalityPct: summarizeDaily(todayRows).mortality,
        recordsComplete,
        recordsExpected: comparisons.length,
        feedDaysClosed,
        feedDaysExpected: comparisons.length,
        housesNeedingAttention: farmRows.flatMap((row) => row.houses).filter((row) => row.status === "critical" || row.status === "watch" || row.status === "data_gap").length,
      },
      farms: farmRows,
      actions: actions.slice(0, 20),
      dataTrust: { recordCoveragePct, feedClosurePct, targetCoveragePct, notes: notes.length ? notes : ["Today’s monitoring inputs are complete for all active flocks."] },
    };
    return json(response);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Could not load farm monitoring." }, 500);
  }
}
