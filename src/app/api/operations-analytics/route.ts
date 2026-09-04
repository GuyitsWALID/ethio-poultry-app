import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import { addDays, authorizedFarmIds, type BreedTarget, type FlockType, type WeightSample } from "@/lib/farm-manager-dashboard";
import {
  buildDailySeries,
  buildFlockAnalytics,
  compareMetric,
  eggQualityBreakdown,
  expectedRecordsForPeriod,
  feedTypeBreakdown,
  mortalityCausePareto,
  percent,
  previousPeriod,
  round,
  summarizePeriod,
  type AnalyticsDailyRow,
  type AnalyticsFlock,
  type OperationsAnalyticsResponse,
  type PeriodSummary,
} from "@/lib/operational-analytics";
import { getAccessContext,governanceAdmin,isAccessResponse,type AccessContext } from "@/lib/access-context";
import { tokenMatches } from "@/lib/platform-observability";
import { capabilitiesFor } from "@/lib/permissions";

type DbError = { message: string } | null;
type Row = Record<string, unknown>;

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
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function emptyPeriod(expectedRecords = 0): PeriodSummary {
  return {
    records: 0,
    expectedRecords,
    recordCoveragePct: expectedRecords > 0 ? 0 : null,
    birdDays: 0,
    layerBirdDays: 0,
    eggs: null,
    deaths: null,
    feedKg: null,
    hdep: null,
    feedPerBirdGrams: null,
    mortalityPer1000BirdDays: null,
    cumulativeMortalityPct: null,
    marketableRate: null,
    layerFcr: null,
    waterFeedRatio: null,
    feedLeftoverKg: null,
  };
}

function emptyResponse(input: {
  dateFrom: string;
  dateTo: string;
  previousFrom: string;
  previousTo: string;
  days: number;
  scopeLabel: string;
}): OperationsAnalyticsResponse {
  const current = emptyPeriod();
  const previous = emptyPeriod();
  return {
    meta: {
      ...input,
      timezone: "Africa/Addis_Ababa",
      refreshedAt: new Date().toISOString(),
      latestRecordAt: null,
      activeFlocks: 0,
    },
    summary: {
      liveBirds: 0,
      activeFlocks: 0,
      current,
      previous,
      comparisons: {
        hdep: compareMetric(null, null),
        feedPerBirdGrams: compareMetric(null, null),
        mortalityPer1000BirdDays: compareMetric(null, null),
        marketableRate: compareMetric(null, null),
        recordCoveragePct: compareMetric(null, null),
        feedKg: compareMetric(null, null),
      },
    },
    targets: { hdep: null, feedPerBirdGrams: null, mortalityPct: null, coveragePct: 0 },
    trends: [],
    flocks: [],
    farms: [],
    breakdowns: { eggQuality: [], mortalityCauses: [], feedTypes: [] },
    economics: { feedCost: null, feedCostPerEgg: null, feedCostPerBirdDay: null, lowStockCount: 0, confidence: "unavailable" },
    insights: [{ id: "no-flocks", severity: "info", title: "No active flocks in this scope", detail: "Choose another scope or activate a flock before running operational comparisons.", route: "/app/flocks" }],
    dataTrust: { recordCoveragePct: null, targetCoveragePct: 0, feedDataCoveragePct: null, mortalityCauseCoveragePct: null, latestRecordAt: null, notes: ["No active flocks are available for this analysis."] },
    recentRecords: [],
  };
}

function weightedAverage(values: Array<{ value: number | null; weight: number }>) {
  const available = values.filter((item): item is { value: number; weight: number } => item.value !== null && item.weight > 0);
  const weight = available.reduce((sum, item) => sum + item.weight, 0);
  return weight > 0 ? round(available.reduce((sum, item) => sum + item.value * item.weight, 0) / weight) : null;
}

function flockType(value: unknown): FlockType {
  return ["layer", "parent_stock", "broiler", "rearing"].includes(String(value)) ? String(value) as FlockType : "rearing";
}

async function analyticsAccess(request: NextRequest): Promise<AccessContext | Response> {
  const expected = process.env.MONITORING_INGEST_TOKEN?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const orgId = request.nextUrl.searchParams.get("internal_org_id")?.trim();
  const userId = request.nextUrl.searchParams.get("internal_user_id")?.trim();
  if (expected && provided && orgId && userId && await tokenMatches(provided, expected)) {
    const { data: profile, error } = await governanceAdmin.from("profiles").select("id,org_id,role,is_active").eq("id", userId).eq("org_id", orgId).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    const role = profile?.role === "ceo" || profile?.role === "farm_manager" ? profile.role : null;
    if (!profile?.is_active || !role) return json({ error: "The report owner no longer has active management access." }, 403);
    return { userId, homeOrgId: orgId, orgId, role, capabilities: capabilitiesFor(role), supportSessionId: null, supportExpiresAt: null };
  }
  return getAccessContext({ tenant: true });
}

export async function GET(request: NextRequest) {
  try {
    const access=await analyticsAccess(request);if(isAccessResponse(access))return access;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return json({ error: "Supabase server configuration is missing." }, 500);
    const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const role=access.role;if(role!=="ceo"&&role!=="farm_manager"&&!access.supportSessionId)return json({error:"Management analytics access required."},403);const orgId=access.orgId;const user={id:access.userId};

    const params = request.nextUrl.searchParams;
    const dateTo = params.get("date_to") || addisDate();
    const dateFrom = params.get("date_from") || addDays(dateTo, -29);
    if (!validDate(dateFrom) || !validDate(dateTo) || dateFrom > dateTo) return json({ error: "Choose a valid date range." }, 400);
    const prior = previousPeriod(dateFrom, dateTo);
    if (prior.days > 366) return json({ error: "Analytics ranges are limited to 366 days." }, 400);

    const [farms, houses, flockRows, farmAccess] = await Promise.all([
      allRows<Row>((from, to) => db.from("farms").select("id,name,branch_id").eq("org_id", orgId).range(from, to)),
      allRows<Row>((from, to) => db.from("houses").select("id,name,farm_id").eq("org_id", orgId).range(from, to)),
      allRows<Row>((from, to) => db.from("flocks").select("id,flock_code,flock_type,farm_id,house_id,batch_id,current_count,status,placement_date,age_at_placement_days,breed_id").eq("org_id", orgId).range(from, to)),
      role === "farm_manager" ? allRows<{ farm_id: string }>((from, to) => db.from("user_farm_access").select("farm_id").eq("profile_id", user.id).is("revoked_at",null).lte("starts_at",new Date().toISOString()).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).range(from, to)) : Promise.resolve([]),
    ]);

    const allFarmIds = new Set(farms.map((farm) => String(farm.id)));
    const permittedFarmIds = role === "farm_manager"
      ? authorizedFarmIds(farms.map((farm) => ({ id: String(farm.id), branch_id: String(farm.branch_id) })), [], farmAccess.map((row) => row.farm_id))
      : allFarmIds;
    const requestedBranch = params.get("branch_id") ?? "";
    const requestedFarm = params.get("farm_id") ?? "";
    const requestedHouse = params.get("house_id") ?? "";
    const requestedFlock = params.get("flock_id") ?? "";
    const requestedBatch = params.get("batch_id") ?? "";
    if (requestedFarm && !permittedFarmIds.has(requestedFarm)) return json({ error: "The selected farm is outside your assigned scope." }, 403);

    const farmById = new Map(farms.map((farm) => [String(farm.id), farm]));
    const houseById = new Map(houses.map((house) => [String(house.id), house]));
    const scopedFlocks: AnalyticsFlock[] = flockRows.filter((row) => {
      const farm = farmById.get(String(row.farm_id));
      if (!farm || String(row.status) !== "active" || !permittedFarmIds.has(String(row.farm_id))) return false;
      if (requestedBranch && String(farm.branch_id) !== requestedBranch) return false;
      if (requestedFarm && String(row.farm_id) !== requestedFarm) return false;
      if (requestedHouse && String(row.house_id) !== requestedHouse) return false;
      if (requestedFlock && String(row.id) !== requestedFlock) return false;
      if (requestedBatch && String(row.batch_id ?? "") !== requestedBatch) return false;
      return true;
    }).map((row) => ({
      id: String(row.id),
      code: String(row.flock_code),
      type: flockType(row.flock_type),
      farmId: String(row.farm_id),
      farmName: String(farmById.get(String(row.farm_id))?.name ?? "Unknown farm"),
      houseId: String(row.house_id),
      houseName: String(houseById.get(String(row.house_id))?.name ?? "Unknown house"),
      placementDate: String(row.placement_date),
      ageAtPlacementDays: row.age_at_placement_days === null ? null : Number(row.age_at_placement_days),
      currentBirds: Number(row.current_count ?? 0),
      breedId: row.breed_id ? String(row.breed_id) : null,
    }));

    const selectedFarmIds = new Set(scopedFlocks.map((flock) => flock.farmId));
    const scopeLabel = requestedFlock
      ? scopedFlocks[0]?.code ?? "Selected flock"
      : requestedFarm
        ? String(farmById.get(requestedFarm)?.name ?? "Selected farm")
        : selectedFarmIds.size === 1
          ? String(farmById.get([...selectedFarmIds][0])?.name ?? "Assigned farm")
          : `${selectedFarmIds.size} farms`;
    if (!scopedFlocks.length) return json(emptyResponse({ dateFrom, dateTo, previousFrom: prior.previousFrom, previousTo: prior.previousTo, days: prior.days, scopeLabel }));

    const flockIds = scopedFlocks.map((flock) => flock.id);
    const breedIds = [...new Set(scopedFlocks.map((flock) => flock.breedId).filter((value): value is string => Boolean(value)))];
    const [allDailyRows, weightRows, standardRows, settingsResult, inventoryRows, stockRows] = await Promise.all([
      allRows<AnalyticsDailyRow>((from, to) => db.from("daily_farm_records").select("id,record_date,flock_id,opening_birds,closing_birds,deaths,deaths_cause,total_eggs,normal_eggs,broken_eggs,dirty_eggs,feed_intake_grams,feed_type,feed_leftover_grams,average_egg_weight_g,water_consumed_liters,updated_at").eq("org_id", orgId).is("voided_at",null).in("flock_id", flockIds).gte("record_date", prior.previousFrom).lte("record_date", dateTo).order("record_date").range(from, to)),
      allRows<Row>((from, to) => db.from("weight_records").select("flock_id,record_date,average_weight_g,uniformity_pct").eq("org_id", orgId).in("flock_id", flockIds).lte("record_date", dateTo).order("record_date", { ascending: false }).range(from, to)),
      breedIds.length ? allRows<Row>((from, to) => db.from("breed_standards").select("breed_id,week_number,target_hdep_pct,target_mortality_pct,target_feed_g,target_weight_g").eq("org_id", orgId).in("breed_id", breedIds).range(from, to)) : Promise.resolve([]),
      db.from("feed_control_settings").select("warning_variance_pct,critical_variance_pct").eq("org_id", orgId).maybeSingle(),
      allRows<Row>((from, to) => db.from("inventory_items").select("id,name,category,reorder_level,unit").eq("org_id", orgId).range(from, to)),
      allRows<Row>((from, to) => db.from("stock_ledger").select("item_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,flock_id").eq("org_id", orgId).range(from, to)),
    ]);

    const currentRows = allDailyRows.filter((row) => row.record_date >= dateFrom && row.record_date <= dateTo);
    const previousRows = allDailyRows.filter((row) => row.record_date >= prior.previousFrom && row.record_date <= prior.previousTo);
    const layerIds = new Set(scopedFlocks.filter((flock) => flock.type === "layer" || flock.type === "parent_stock").map((flock) => flock.id));
    const currentExpected = expectedRecordsForPeriod(scopedFlocks, dateFrom, dateTo);
    const previousExpected = expectedRecordsForPeriod(scopedFlocks, prior.previousFrom, prior.previousTo);
    const current = summarizePeriod(currentRows, layerIds, currentExpected);
    const previous = summarizePeriod(previousRows, layerIds, previousExpected);

    const standardsByBreed = new Map<string, BreedTarget[]>();
    for (const row of standardRows) {
      const breedId = String(row.breed_id);
      const values = standardsByBreed.get(breedId) ?? [];
      values.push({
        week_number: Number(row.week_number),
        target_hdep_pct: row.target_hdep_pct === null ? null : Number(row.target_hdep_pct),
        target_mortality_pct: row.target_mortality_pct === null ? null : Number(row.target_mortality_pct),
        target_feed_g: row.target_feed_g === null ? null : Number(row.target_feed_g),
        target_weight_g: row.target_weight_g === null ? null : Number(row.target_weight_g),
      });
      standardsByBreed.set(breedId, values);
    }
    const weightsByFlock = new Map<string, WeightSample[]>();
    for (const row of weightRows) {
      const flockId = String(row.flock_id);
      weightsByFlock.set(flockId, [...(weightsByFlock.get(flockId) ?? []), {
        record_date: String(row.record_date),
        average_weight_g: row.average_weight_g === null ? null : Number(row.average_weight_g),
        uniformity_pct: row.uniformity_pct === null ? null : Number(row.uniformity_pct),
      }]);
    }
    const settings = settingsResult.data;
    const warningVariancePct = Number(settings?.warning_variance_pct ?? 5);
    const criticalVariancePct = Number(settings?.critical_variance_pct ?? 10);
    const flockAnalytics = scopedFlocks.map((flock) => buildFlockAnalytics({
      flock,
      rows: currentRows.filter((row) => row.flock_id === flock.id),
      previousRows: previousRows.filter((row) => row.flock_id === flock.id),
      weights: weightsByFlock.get(flock.id) ?? [],
      targets: standardsByBreed.get(flock.breedId ?? "") ?? [],
      dateFrom,
      dateTo,
      warningVariancePct,
      criticalVariancePct,
    })).sort((a, b) => b.attentionScore - a.attentionScore || a.code.localeCompare(b.code));

    const targetFlocks = flockAnalytics.filter((flock) => flock.target !== null);
    const targets = {
      hdep: weightedAverage(flockAnalytics.filter((flock) => flock.type === "layer" || flock.type === "parent_stock").map((flock) => ({ value: flock.target, weight: flock.liveBirds }))),
      feedPerBirdGrams: weightedAverage(flockAnalytics.map((flock) => ({ value: flock.feedTargetGrams, weight: flock.liveBirds }))),
      mortalityPct: weightedAverage(flockAnalytics.map((flock) => ({ value: flock.mortalityTargetPct, weight: flock.liveBirds }))),
      coveragePct: percent(targetFlocks.length, flockAnalytics.length) ?? 0,
    };

    const farmsAnalytics = [...selectedFarmIds].map((farmId) => {
      const farmFlocks = scopedFlocks.filter((flock) => flock.farmId === farmId);
      const farmFlockIds = new Set(farmFlocks.map((flock) => flock.id));
      const rows = currentRows.filter((row) => farmFlockIds.has(row.flock_id));
      const summary = summarizePeriod(rows, new Set([...layerIds].filter((id) => farmFlockIds.has(id))), expectedRecordsForPeriod(farmFlocks, dateFrom, dateTo));
      return {
        id: farmId,
        name: String(farmById.get(farmId)?.name ?? "Unknown farm"),
        liveBirds: farmFlocks.reduce((sum, flock) => sum + flock.currentBirds, 0),
        flocks: farmFlocks.length,
        hdep: summary.hdep,
        feedPerBirdGrams: summary.feedPerBirdGrams,
        mortalityPer1000BirdDays: summary.mortalityPer1000BirdDays,
        marketableRate: summary.marketableRate,
        recordCoveragePct: summary.recordCoveragePct,
      };
    }).sort((a, b) => (b.hdep ?? -1) - (a.hdep ?? -1));

    const selectedBranchIds = new Set([...selectedFarmIds].map((farmId) => String(farmById.get(farmId)?.branch_id ?? "")));
    const scopedStock = stockRows.filter((row) => {
      if (row.flock_id && flockIds.includes(String(row.flock_id))) return true;
      if (row.farm_id && selectedFarmIds.has(String(row.farm_id))) return true;
      return Boolean(row.branch_id && selectedBranchIds.has(String(row.branch_id)));
    });
    const feedItemIds = new Set(inventoryRows.filter((row) => String(row.category) === "feed").map((row) => String(row.id)));
    const periodFeedIssues = scopedStock.filter((row) => feedItemIds.has(String(row.item_id)) && ["issue", "transfer_out"].includes(String(row.transaction_type)) && String(row.transaction_date) >= dateFrom && String(row.transaction_date) <= dateTo);
    const costedFeedIssues = periodFeedIssues.filter((row) => Number(row.unit_cost ?? 0) > 0);
    const feedCost = costedFeedIssues.length ? round(costedFeedIssues.reduce((sum, row) => sum + Math.abs(Number(row.quantity ?? 0)) * Number(row.unit_cost ?? 0), 0)) : null;
    const balanceByItem = new Map<string, number>();
    for (const row of scopedStock) {
      const quantity = Number(row.quantity ?? 0);
      const transactionType = String(row.transaction_type);
      const delta = ["issue", "transfer_out"].includes(transactionType) ? -Math.abs(quantity) : transactionType === "adjustment" ? quantity : Math.abs(quantity);
      balanceByItem.set(String(row.item_id), (balanceByItem.get(String(row.item_id)) ?? 0) + delta);
    }
    const lowStockCount = inventoryRows.filter((row) => row.reorder_level !== null && (balanceByItem.get(String(row.id)) ?? 0) <= Number(row.reorder_level)).length;

    const deathCount = currentRows.reduce((sum, row) => sum + (row.deaths ?? 0), 0);
    const deathsWithCause = currentRows.reduce((sum, row) => sum + (row.deaths_cause?.trim() ? row.deaths ?? 0 : 0), 0);
    const feedRows = currentRows.filter((row) => row.feed_intake_grams !== null).length;
    const insights: OperationsAnalyticsResponse["insights"] = [];
    if ((current.recordCoveragePct ?? 0) < 90) insights.push({ id: "coverage", severity: (current.recordCoveragePct ?? 0) < 70 ? "critical" : "watch", title: "Analysis is constrained by missing flock-days", detail: `${round(current.recordCoveragePct ?? 0)}% of expected Daily Records are present. Close the gaps before treating movements as final.`, route: "/app/daily-records" });
    const criticalFlock = flockAnalytics.find((flock) => flock.status === "critical");
    if (criticalFlock) insights.push({ id: `critical-${criticalFlock.id}`, severity: "critical", title: `${criticalFlock.code} needs the first review`, detail: `${criticalFlock.farmName} · ${criticalFlock.statusReason}`, route: criticalFlock.mortalityTargetPct !== null && (criticalFlock.cumulativeMortalityPct ?? 0) > criticalFlock.mortalityTargetPct ? "/app/mortality" : "/app/flocks" });
    const productionComparison = compareMetric(current.hdep, previous.hdep);
    if (productionComparison.direction === "down" && (productionComparison.deltaPct ?? 0) <= -3) insights.push({ id: "production-down", severity: "watch", title: "HDEP moved below the previous period", detail: `Production declined ${Math.abs(productionComparison.deltaPct ?? 0)}% period over period. Compare flock rows with feed and mortality timing.`, route: "/app/daily-records" });
    const mortalityComparison = compareMetric(current.mortalityPer1000BirdDays, previous.mortalityPer1000BirdDays);
    if (mortalityComparison.direction === "up" && (mortalityComparison.deltaPct ?? 0) >= 10) insights.push({ id: "mortality-up", severity: "critical", title: "Mortality intensity increased", detail: `Deaths per 1,000 bird-days increased ${mortalityComparison.deltaPct}% from the previous period.`, route: "/app/mortality" });
    if (current.marketableRate !== null && current.marketableRate < 95) insights.push({ id: "quality", severity: "watch", title: "Egg quality is reducing marketable output", detail: `${round(100 - current.marketableRate)}% of quality-classified eggs were broken or dirty.`, route: "/app/daily-records" });
    if (!insights.some((item) => item.severity === "critical" || item.severity === "watch") && current.records > 0) insights.push({ id: "stable", severity: "positive", title: "No major exception is visible in this period", detail: "Performance and data coverage are within the available comparison bands. Continue monitoring flock-level movement.", route: "/app/flocks" });
    if (targets.coveragePct < 100) insights.push({ id: "targets", severity: "info", title: "Some comparisons use period baselines", detail: `Breed/week targets are available for ${round(targets.coveragePct)}% of active flocks. Missing targets are shown as unavailable.`, route: "/app/flocks" });

    const flockById = new Map(scopedFlocks.map((flock) => [flock.id, flock]));
    const recentRecords = [...currentRows].sort((a, b) => b.record_date.localeCompare(a.record_date) || b.updated_at.localeCompare(a.updated_at)).slice(0, 12).map((row) => {
      const flock = flockById.get(row.flock_id);
      const birds = row.opening_birds ?? row.closing_birds;
      const qualityTotal = (row.normal_eggs ?? 0) + (row.broken_eggs ?? 0) + (row.dirty_eggs ?? 0);
      return {
        id: row.id,
        date: row.record_date,
        flock: flock?.code ?? row.flock_id,
        farm: flock?.farmName ?? "Unknown farm",
        birds,
        eggs: row.total_eggs,
        hdep: row.total_eggs !== null && birds !== null && birds > 0 && layerIds.has(row.flock_id) ? percent(row.total_eggs, birds) : null,
        feedPerBirdGrams: row.feed_intake_grams !== null && birds !== null && birds > 0 ? round(row.feed_intake_grams / birds) : null,
        deaths: row.deaths,
        marketableRate: qualityTotal > 0 ? percent(row.normal_eggs ?? 0, qualityTotal) : null,
        updatedAt: row.updated_at,
      };
    });

    const latestRecordAt = currentRows.map((row) => row.updated_at).sort().at(-1) ?? null;
    const response: OperationsAnalyticsResponse = {
      meta: { dateFrom, dateTo, previousFrom: prior.previousFrom, previousTo: prior.previousTo, timezone: "Africa/Addis_Ababa", scopeLabel, refreshedAt: new Date().toISOString(), latestRecordAt, activeFlocks: scopedFlocks.length, days: prior.days },
      summary: {
        liveBirds: scopedFlocks.reduce((sum, flock) => sum + flock.currentBirds, 0),
        activeFlocks: scopedFlocks.length,
        current,
        previous,
        comparisons: {
          hdep: productionComparison,
          feedPerBirdGrams: compareMetric(current.feedPerBirdGrams, previous.feedPerBirdGrams),
          mortalityPer1000BirdDays: mortalityComparison,
          marketableRate: compareMetric(current.marketableRate, previous.marketableRate),
          recordCoveragePct: compareMetric(current.recordCoveragePct, previous.recordCoveragePct),
          feedKg: compareMetric(current.feedKg, previous.feedKg),
        },
      },
      targets,
      trends: buildDailySeries(currentRows, scopedFlocks, dateFrom, dateTo),
      flocks: flockAnalytics,
      farms: farmsAnalytics,
      breakdowns: { eggQuality: eggQualityBreakdown(currentRows), mortalityCauses: mortalityCausePareto(currentRows), feedTypes: feedTypeBreakdown(currentRows) },
      economics: {
        feedCost,
        feedCostPerEgg: feedCost !== null && (current.eggs ?? 0) > 0 ? round(feedCost / (current.eggs ?? 1), 4) : null,
        feedCostPerBirdDay: feedCost !== null && current.birdDays > 0 ? round(feedCost / current.birdDays, 4) : null,
        lowStockCount,
        confidence: feedCost !== null ? "actual" : "unavailable",
      },
      insights: insights.slice(0, 6),
      dataTrust: {
        recordCoveragePct: current.recordCoveragePct,
        targetCoveragePct: targets.coveragePct,
        feedDataCoveragePct: current.records > 0 ? percent(feedRows, current.records) : null,
        mortalityCauseCoveragePct: deathCount > 0 ? percent(deathsWithCause, deathCount) : null,
        latestRecordAt,
        notes: [
          ...(current.records === 0 ? ["No Daily Records were found for the selected period."] : []),
          ...((current.recordCoveragePct ?? 100) < 100 ? [`${currentExpected - current.records} expected flock-day record(s) are missing.`] : []),
          ...(feedRows < current.records ? [`${current.records - feedRows} record(s) do not contain synchronized feed totals.`] : []),
          ...(deathCount > deathsWithCause ? [`${deathCount - deathsWithCause} death(s) do not have a recorded cause.`] : []),
          ...(targets.coveragePct < 100 ? ["Target gaps are unavailable where breed/week standards have not been configured."] : []),
        ],
      },
      recentRecords,
    };
    if (!response.dataTrust.notes.length) response.dataTrust.notes.push("Records, feed values, causes, and targets are complete for the selected scope.");
    return json(response);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Could not load Operations Analytics." }, 500);
  }
}
