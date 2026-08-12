export type FlockType = "layer" | "parent_stock" | "broiler" | "rearing";
export type AttentionStatus = "critical" | "watch" | "good" | "pending";
export type TrendDirection = "up" | "down" | "flat" | "unavailable";

export type ManagerDailyRow = {
  record_date: string;
  flock_id: string;
  opening_birds: number | null;
  closing_birds: number | null;
  deaths: number | null;
  total_eggs: number | null;
  normal_eggs: number | null;
  broken_eggs: number | null;
  dirty_eggs: number | null;
  feed_intake_grams: number | null;
  updated_at: string;
};

export type BreedTarget = {
  week_number: number;
  target_hdep_pct: number | null;
  target_mortality_pct: number | null;
  target_feed_g: number | null;
  target_weight_g: number | null;
};

export type WeightSample = {
  record_date: string;
  average_weight_g: number | null;
  uniformity_pct: number | null;
};

export type FlockComparison = {
  id: string;
  code: string;
  type: FlockType;
  farmId: string;
  farmName: string;
  houseId: string;
  houseName: string;
  ageDays: number;
  ageWeeks: number;
  liveBirds: number;
  metricKind: "hdep" | "weight";
  metricLabel: string;
  actual: number | null;
  target: number | null;
  baseline: number | null;
  unit: "%" | "g";
  targetAttainment: number | null;
  targetGap: number | null;
  trend: TrendDirection;
  feedPerBirdGrams: number | null;
  feedTargetGrams: number | null;
  mortalityRate: number | null;
  mortalityTarget: number | null;
  marketableRate: number | null;
  uniformityPct: number | null;
  weightChangePerDay: number | null;
  latestWeightDate: string | null;
  recordUpdatedAt: string | null;
  hasTodayRecord: boolean;
  feedClosed: boolean;
  targetAvailable: boolean;
  status: AttentionStatus;
  attentionScore: number;
  nextAction: string;
  actionRoute: string;
  dataStatus: "complete" | "partial" | "missing";
};

export type ManagerAction = {
  id: string;
  severity: "high" | "medium" | "pending" | "low";
  title: string;
  context: string;
  route: string;
  farmName?: string;
  flockCode?: string;
};

export type FarmManagerDashboardResponse = {
  meta: {
    asOf: string;
    timezone: string;
    refreshedAt: string;
    scopeLabel: string;
    trailingFrom: string;
    baselineFrom: string;
    targetCoveragePct: number;
    latestRecordAt: string | null;
  };
  summary: {
    liveBirds: number;
    activeFlocks: number;
    todayEggs: number | null;
    marketableEggs: number | null;
    feedPerBirdGrams: number | null;
    mortalityRate: number | null;
    recordsComplete: number;
    recordsExpected: number;
    feedDaysClosed: number;
    feedDaysExpected: number;
  };
  farmGroups: Array<{
    id: string;
    name: string;
    liveBirds: number;
    recordCoveragePct: number;
    feedClosurePct: number;
    attentionCount: number;
    flocks: FlockComparison[];
  }>;
  trends: Array<{
    date: string;
    eggs: number | null;
    hdep: number | null;
    feedPerBirdGrams: number | null;
    mortality: number | null;
  }>;
  actions: ManagerAction[];
  operationalCosts: {
    feedCost7d: number | null;
    feedCostPerEgg: number | null;
    feedCostPerGrowingBirdDay: number | null;
    lowStockCount: number;
    confidence: "actual" | "unavailable";
  };
  dataTrust: {
    recordCoveragePct: number;
    feedClosurePct: number;
    targetCoveragePct: number;
    notes: string[];
  };
};

export function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function percent(numerator: number, denominator: number) {
  return denominator > 0 ? round((numerator / denominator) * 100) : null;
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.max(0, Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000));
}

export function ageOnDate(placementDate: string, ageAtPlacementDays: number | null, asOf: string) {
  return Math.max(0, daysBetween(placementDate, asOf) + Math.max(0, ageAtPlacementDays ?? 0));
}

export function summarizeDaily(rows: ManagerDailyRow[]) {
  let birdDays = 0;
  let eggs = 0;
  let feedGrams = 0;
  let deaths = 0;
  let normalEggs = 0;
  let qualityEggs = 0;
  let eggRows = 0;
  let feedRows = 0;
  let mortalityRows = 0;
  for (const row of rows) {
    const birds = row.opening_birds ?? row.closing_birds;
    if (birds !== null && birds > 0) birdDays += birds;
    if (row.total_eggs !== null) { eggs += row.total_eggs; eggRows += 1; }
    if (row.feed_intake_grams !== null) { feedGrams += row.feed_intake_grams; feedRows += 1; }
    if (row.deaths !== null) { deaths += row.deaths; mortalityRows += 1; }
    if (row.normal_eggs !== null) normalEggs += row.normal_eggs;
    const qualityTotal = (row.normal_eggs ?? 0) + (row.broken_eggs ?? 0) + (row.dirty_eggs ?? 0);
    if (qualityTotal > 0) qualityEggs += qualityTotal;
  }
  return {
    birdDays,
    eggs: eggRows ? eggs : null,
    hdep: eggRows ? percent(eggs, birdDays) : null,
    feedPerBirdGrams: feedRows && birdDays > 0 ? round(feedGrams / birdDays) : null,
    mortality: mortalityRows ? percent(deaths, birdDays) : null,
    marketableRate: qualityEggs > 0 ? percent(normalEggs, qualityEggs) : null,
    deaths: mortalityRows ? deaths : null,
    feedGrams: feedRows ? feedGrams : null,
  };
}

function direction(actual: number | null, baseline: number | null, tolerance: number): TrendDirection {
  if (actual === null || baseline === null) return "unavailable";
  if (actual > baseline + tolerance) return "up";
  if (actual < baseline - tolerance) return "down";
  return "flat";
}

export function buildFlockComparison(input: {
  flock: { id: string; code: string; type: FlockType; farmId: string; farmName: string; houseId: string; houseName: string; placementDate: string; ageAtPlacementDays: number | null; liveBirds: number };
  asOf: string;
  dailyRows: ManagerDailyRow[];
  targets: BreedTarget[];
  weights: WeightSample[];
  feedClosed: boolean;
  warningVariancePct: number;
  criticalVariancePct: number;
}) : FlockComparison {
  const { flock, asOf } = input;
  const ageDays = ageOnDate(flock.placementDate, flock.ageAtPlacementDays, asOf);
  const ageWeeks = Math.floor(ageDays / 7);
  const target = input.targets.find((row) => row.week_number === ageWeeks) ?? null;
  const todayRows = input.dailyRows.filter((row) => row.record_date === asOf);
  const baselineRows = input.dailyRows.filter((row) => row.record_date >= addDays(asOf, -7) && row.record_date < asOf);
  const today = summarizeDaily(todayRows);
  const baseline = summarizeDaily(baselineRows);
  const layerMode = flock.type === "layer" || flock.type === "parent_stock";
  const weights = [...input.weights].filter((row) => row.record_date <= asOf && row.average_weight_g !== null).sort((a, b) => b.record_date.localeCompare(a.record_date));
  const latestWeight = weights[0] ?? null;
  const previousWeight = weights[1] ?? null;
  const actual = layerMode ? today.hdep : latestWeight?.average_weight_g ?? null;
  const targetValue = layerMode ? target?.target_hdep_pct ?? null : target?.target_weight_g ?? null;
  const baselineValue = layerMode ? baseline.hdep : previousWeight?.average_weight_g ?? null;
  const targetAttainment = actual !== null && targetValue !== null && targetValue > 0 ? percent(actual, targetValue) : null;
  const targetGap = actual !== null && targetValue !== null ? round(actual - targetValue) : null;
  const feedTarget = target?.target_feed_g ?? null;
  const feedVariance = today.feedPerBirdGrams !== null && feedTarget !== null && feedTarget > 0
    ? Math.abs(((today.feedPerBirdGrams - feedTarget) / feedTarget) * 100)
    : null;
  const mortalityTarget = target?.target_mortality_pct ?? null;
  const staleWeight = !layerMode && (!latestWeight || daysBetween(latestWeight.record_date, asOf) > 14);
  const weightChangePerDay = latestWeight?.average_weight_g !== null && latestWeight?.average_weight_g !== undefined && previousWeight?.average_weight_g !== null && previousWeight?.average_weight_g !== undefined
    ? round((latestWeight.average_weight_g - previousWeight.average_weight_g) / Math.max(1, daysBetween(previousWeight.record_date, latestWeight.record_date)))
    : null;

  let status: AttentionStatus = "good";
  let attentionScore = 0;
  let nextAction = "Continue current routine";
  let actionRoute = "/app/daily-records";
  if (!todayRows.length) {
    status = "pending"; attentionScore = 80; nextAction = "Complete today’s Daily Record";
  } else if (!input.feedClosed) {
    status = "pending"; attentionScore = 70; nextAction = "Close today’s feeding day"; actionRoute = "/app/feeding-log";
  }
  if (targetAttainment !== null) {
    const deviation = Math.abs(100 - targetAttainment);
    const critical = layerMode ? targetGap !== null && targetGap < -7.5 : deviation > 10;
    const watch = layerMode ? targetGap !== null && targetGap < -3 : deviation > 5;
    if (critical && attentionScore < 100) { status = "critical"; attentionScore = 100; nextAction = layerMode ? "Investigate production shortfall" : "Review growth and feed program"; actionRoute = "/app/analytics"; }
    else if (watch && attentionScore < 60) { status = "watch"; attentionScore = 60; nextAction = layerMode ? "Review production inputs" : "Check weight trend"; actionRoute = "/app/feeding-log"; }
  }
  if (today.mortality !== null && mortalityTarget !== null && today.mortality > mortalityTarget && attentionScore < 95) {
    status = "critical"; attentionScore = 95; nextAction = "Review mortality immediately"; actionRoute = "/app/mortality";
  }
  if (feedVariance !== null && feedVariance >= input.criticalVariancePct && attentionScore < 90) {
    status = "critical"; attentionScore = 90; nextAction = "Investigate critical feed variance"; actionRoute = "/app/feeding-log";
  } else if (feedVariance !== null && feedVariance >= input.warningVariancePct && attentionScore < 55) {
    status = "watch"; attentionScore = 55; nextAction = "Review feed variance"; actionRoute = "/app/feeding-log";
  }
  if (staleWeight && attentionScore < 65) {
    status = "watch"; attentionScore = 65; nextAction = "Record a current weight sample"; actionRoute = "/app/feeding-log";
  }

  const targetAvailable = targetValue !== null;
  const complete = todayRows.length > 0 && input.feedClosed && (layerMode || !staleWeight);
  return {
    id: flock.id, code: flock.code, type: flock.type, farmId: flock.farmId, farmName: flock.farmName,
    houseId: flock.houseId, houseName: flock.houseName, ageDays, ageWeeks, liveBirds: flock.liveBirds,
    metricKind: layerMode ? "hdep" : "weight", metricLabel: layerMode ? "Today HDEP" : "Latest weight",
    actual, target: targetValue, baseline: baselineValue, unit: layerMode ? "%" : "g", targetAttainment, targetGap,
    trend: direction(actual, baselineValue, layerMode ? 1 : 10), feedPerBirdGrams: today.feedPerBirdGrams,
    feedTargetGrams: feedTarget, mortalityRate: today.mortality, mortalityTarget,
    marketableRate: layerMode ? today.marketableRate : null, uniformityPct: latestWeight?.uniformity_pct ?? null,
    weightChangePerDay, latestWeightDate: latestWeight?.record_date ?? null,
    recordUpdatedAt: todayRows.map((row) => row.updated_at).sort().at(-1) ?? null,
    hasTodayRecord: todayRows.length > 0, feedClosed: input.feedClosed, targetAvailable,
    status, attentionScore, nextAction, actionRoute,
    dataStatus: complete && targetAvailable ? "complete" : todayRows.length ? "partial" : "missing",
  };
}

export function authorizedFarmIds(
  farms: Array<{ id: string; branch_id: string }>,
  branchIds: Iterable<string>,
  farmIds: Iterable<string>
) {
  void branchIds;
  const allowedFarms = new Set(farmIds);
  return new Set(farms.filter((farm) => allowedFarms.has(farm.id)).map((farm) => farm.id));
}
