import type { BreedTarget, FlockType, WeightSample } from "@/lib/farm-manager-dashboard";

export type AnalyticsDailyRow = {
  id: string;
  record_date: string;
  flock_id: string;
  opening_birds: number | null;
  closing_birds: number | null;
  deaths: number | null;
  deaths_cause: string | null;
  total_eggs: number | null;
  normal_eggs: number | null;
  broken_eggs: number | null;
  dirty_eggs: number | null;
  feed_intake_grams: number | null;
  feed_type: string | null;
  feed_leftover_grams: number | null;
  average_egg_weight_g: number | null;
  water_consumed_liters: number | null;
  updated_at: string;
};

export type AnalyticsFlock = {
  id: string;
  code: string;
  type: FlockType;
  farmId: string;
  farmName: string;
  houseId: string;
  houseName: string;
  placementDate: string;
  ageAtPlacementDays: number | null;
  currentBirds: number;
  breedId: string | null;
};

export type PeriodSummary = {
  records: number;
  expectedRecords: number;
  recordCoveragePct: number | null;
  birdDays: number;
  layerBirdDays: number;
  eggs: number | null;
  deaths: number | null;
  feedKg: number | null;
  hdep: number | null;
  feedPerBirdGrams: number | null;
  mortalityPer1000BirdDays: number | null;
  cumulativeMortalityPct: number | null;
  marketableRate: number | null;
  layerFcr: number | null;
  waterFeedRatio: number | null;
  feedLeftoverKg: number | null;
};

export type ComparisonMetric = {
  current: number | null;
  previous: number | null;
  deltaPct: number | null;
  direction: "up" | "down" | "flat" | "unavailable";
};

export type DailyAnalyticsPoint = {
  date: string;
  eggs: number | null;
  deaths: number | null;
  hdep: number | null;
  feedPerBirdGrams: number | null;
  mortalityPer1000BirdDays: number | null;
  marketableRate: number | null;
  recordCoveragePct: number | null;
  records: number;
  expectedRecords: number;
};

export type FlockAnalyticsRow = {
  id: string;
  code: string;
  type: FlockType;
  farmId: string;
  farmName: string;
  houseId: string;
  houseName: string;
  ageWeeks: number;
  liveBirds: number;
  primaryLabel: string;
  primaryValue: number | null;
  primaryUnit: "%" | "g";
  target: number | null;
  targetGap: number | null;
  baseline: number | null;
  trend: ComparisonMetric["direction"];
  targetAttainmentPct: number | null;
  hdep: number | null;
  feedPerBirdGrams: number | null;
  feedTargetGrams: number | null;
  feedVariancePct: number | null;
  mortalityPer1000BirdDays: number | null;
  cumulativeMortalityPct: number | null;
  mortalityTargetPct: number | null;
  marketableRate: number | null;
  latestWeightG: number | null;
  uniformityPct: number | null;
  weightChangePerDay: number | null;
  latestWeightDate: string | null;
  eggs: number | null;
  deaths: number | null;
  recordCoveragePct: number | null;
  status: "critical" | "watch" | "good" | "insufficient";
  statusReason: string;
  attentionScore: number;
};

export type OperationsAnalyticsResponse = {
  meta: {
    dateFrom: string;
    dateTo: string;
    previousFrom: string;
    previousTo: string;
    timezone: "Africa/Addis_Ababa";
    scopeLabel: string;
    refreshedAt: string;
    latestRecordAt: string | null;
    activeFlocks: number;
    days: number;
  };
  summary: {
    liveBirds: number;
    activeFlocks: number;
    current: PeriodSummary;
    previous: PeriodSummary;
    comparisons: {
      hdep: ComparisonMetric;
      feedPerBirdGrams: ComparisonMetric;
      mortalityPer1000BirdDays: ComparisonMetric;
      marketableRate: ComparisonMetric;
      recordCoveragePct: ComparisonMetric;
      feedKg: ComparisonMetric;
    };
  };
  targets: {
    hdep: number | null;
    feedPerBirdGrams: number | null;
    mortalityPct: number | null;
    coveragePct: number;
  };
  trends: DailyAnalyticsPoint[];
  flocks: FlockAnalyticsRow[];
  farms: Array<{
    id: string;
    name: string;
    liveBirds: number;
    flocks: number;
    hdep: number | null;
    feedPerBirdGrams: number | null;
    mortalityPer1000BirdDays: number | null;
    marketableRate: number | null;
    recordCoveragePct: number | null;
  }>;
  breakdowns: {
    eggQuality: Array<{ label: string; value: number; sharePct: number }>;
    mortalityCauses: Array<{ label: string; value: number; sharePct: number; cumulativePct: number }>;
    feedTypes: Array<{ label: string; valueKg: number; sharePct: number }>;
  };
  economics: {
    feedCost: number | null;
    feedCostPerEgg: number | null;
    feedCostPerBirdDay: number | null;
    lowStockCount: number;
    confidence: "actual" | "unavailable";
  };
  insights: Array<{
    id: string;
    severity: "critical" | "watch" | "positive" | "info";
    title: string;
    detail: string;
    route: string;
  }>;
  dataTrust: {
    recordCoveragePct: number | null;
    targetCoveragePct: number;
    feedDataCoveragePct: number | null;
    mortalityCauseCoveragePct: number | null;
    latestRecordAt: string | null;
    notes: string[];
  };
  recentRecords: Array<{
    id: string;
    date: string;
    flock: string;
    farm: string;
    birds: number | null;
    eggs: number | null;
    hdep: number | null;
    feedPerBirdGrams: number | null;
    deaths: number | null;
    marketableRate: number | null;
    updatedAt: string;
  }>;
};

export function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.max(0, Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000));
}

function ageOnDate(placementDate: string, ageAtPlacementDays: number | null, asOf: string) {
  return Math.max(0, daysBetween(placementDate, asOf) + Math.max(0, ageAtPlacementDays ?? 0));
}

export function percent(numerator: number, denominator: number) {
  return denominator > 0 ? round((numerator / denominator) * 100) : null;
}

export function dateRange(dateFrom: string, dateTo: string) {
  const days = daysBetween(dateFrom, dateTo);
  return Array.from({ length: days + 1 }, (_, index) => addDays(dateFrom, index));
}

export function previousPeriod(dateFrom: string, dateTo: string) {
  const days = daysBetween(dateFrom, dateTo) + 1;
  const previousTo = addDays(dateFrom, -1);
  return { previousFrom: addDays(previousTo, -days + 1), previousTo, days };
}

function birdCount(row: AnalyticsDailyRow) {
  const birds = row.opening_birds ?? row.closing_birds;
  return birds !== null && birds > 0 ? birds : null;
}

export function expectedRecordsForPeriod(flocks: AnalyticsFlock[], dateFrom: string, dateTo: string) {
  return flocks.reduce((total, flock) => {
    if (flock.placementDate > dateTo) return total;
    const effectiveFrom = flock.placementDate > dateFrom ? flock.placementDate : dateFrom;
    return total + daysBetween(effectiveFrom, dateTo) + 1;
  }, 0);
}

export function summarizePeriod(
  rows: AnalyticsDailyRow[],
  layerFlockIds: ReadonlySet<string>,
  expectedRecords = rows.length,
): PeriodSummary {
  let birdDays = 0;
  let layerBirdDays = 0;
  let feedBirdDays = 0;
  let mortalityBirdDays = 0;
  let eggs = 0;
  let deaths = 0;
  let feedGrams = 0;
  let leftoverGrams = 0;
  let waterLiters = 0;
  let eggMassGrams = 0;
  let normalEggs = 0;
  let qualityEggs = 0;
  let eggRows = 0;
  let deathRows = 0;
  let feedRows = 0;
  let leftoverRows = 0;
  let waterRows = 0;
  const firstBirdsByFlock = new Map<string, { date: string; birds: number }>();

  for (const row of rows) {
    const birds = birdCount(row);
    if (birds !== null) {
      birdDays += birds;
      if (layerFlockIds.has(row.flock_id) && row.total_eggs !== null) layerBirdDays += birds;
      const current = firstBirdsByFlock.get(row.flock_id);
      if (!current || row.record_date < current.date) firstBirdsByFlock.set(row.flock_id, { date: row.record_date, birds });
    }
    if (row.total_eggs !== null) {
      eggRows += 1;
      eggs += row.total_eggs;
      if (row.average_egg_weight_g !== null) eggMassGrams += row.total_eggs * row.average_egg_weight_g;
    }
    if (row.deaths !== null) {
      deathRows += 1;
      deaths += row.deaths;
      if (birds !== null) mortalityBirdDays += birds;
    }
    if (row.feed_intake_grams !== null) {
      feedRows += 1;
      feedGrams += row.feed_intake_grams;
      if (birds !== null) feedBirdDays += birds;
    }
    if (row.feed_leftover_grams !== null) {
      leftoverRows += 1;
      leftoverGrams += row.feed_leftover_grams;
    }
    if (row.water_consumed_liters !== null) {
      waterRows += 1;
      waterLiters += row.water_consumed_liters;
    }
    if (row.normal_eggs !== null || row.broken_eggs !== null || row.dirty_eggs !== null) {
      const qualityTotal = (row.normal_eggs ?? 0) + (row.broken_eggs ?? 0) + (row.dirty_eggs ?? 0);
      normalEggs += row.normal_eggs ?? 0;
      qualityEggs += qualityTotal;
    }
  }

  const birdsAtRisk = [...firstBirdsByFlock.values()].reduce((sum, value) => sum + value.birds, 0);
  return {
    records: rows.length,
    expectedRecords,
    recordCoveragePct: expectedRecords > 0 ? percent(rows.length, expectedRecords) : null,
    birdDays,
    layerBirdDays,
    eggs: eggRows > 0 ? eggs : null,
    deaths: deathRows > 0 ? deaths : null,
    feedKg: feedRows > 0 ? round(feedGrams / 1000) : null,
    hdep: eggRows > 0 && layerBirdDays > 0 ? percent(eggs, layerBirdDays) : null,
    feedPerBirdGrams: feedRows > 0 && feedBirdDays > 0 ? round(feedGrams / feedBirdDays) : null,
    mortalityPer1000BirdDays: deathRows > 0 && mortalityBirdDays > 0 ? round((deaths / mortalityBirdDays) * 1000, 3) : null,
    cumulativeMortalityPct: deathRows > 0 && birdsAtRisk > 0 ? percent(deaths, birdsAtRisk) : null,
    marketableRate: qualityEggs > 0 ? percent(normalEggs, qualityEggs) : null,
    layerFcr: eggMassGrams > 0 && feedRows > 0 ? round((feedGrams / 1000) / (eggMassGrams / 1000)) : null,
    waterFeedRatio: waterRows > 0 && feedGrams > 0 ? round(waterLiters / (feedGrams / 1000)) : null,
    feedLeftoverKg: leftoverRows > 0 ? round(leftoverGrams / 1000) : null,
  };
}

export function compareMetric(current: number | null, previous: number | null): ComparisonMetric {
  if (current === null || previous === null) return { current, previous, deltaPct: null, direction: "unavailable" };
  if (current === previous) return { current, previous, deltaPct: 0, direction: "flat" };
  const deltaPct = previous === 0 ? null : round(((current - previous) / Math.abs(previous)) * 100);
  const tolerance = Math.max(0.001, Math.abs(previous) * 0.005);
  return { current, previous, deltaPct, direction: Math.abs(current - previous) <= tolerance ? "flat" : current > previous ? "up" : "down" };
}

export function buildDailySeries(
  rows: AnalyticsDailyRow[],
  flocks: AnalyticsFlock[],
  dateFrom: string,
  dateTo: string,
): DailyAnalyticsPoint[] {
  const layerIds = new Set(flocks.filter((flock) => flock.type === "layer" || flock.type === "parent_stock").map((flock) => flock.id));
  return dateRange(dateFrom, dateTo).map((date) => {
    const dayRows = rows.filter((row) => row.record_date === date);
    const expected = flocks.filter((flock) => flock.placementDate <= date).length;
    const summary = summarizePeriod(dayRows, layerIds, expected);
    return {
      date,
      eggs: summary.eggs,
      deaths: summary.deaths,
      hdep: summary.hdep,
      feedPerBirdGrams: summary.feedPerBirdGrams,
      mortalityPer1000BirdDays: summary.mortalityPer1000BirdDays,
      marketableRate: summary.marketableRate,
      recordCoveragePct: summary.recordCoveragePct,
      records: dayRows.length,
      expectedRecords: expected,
    };
  });
}

function metricDirection(current: number | null, baseline: number | null, tolerance: number) {
  if (current === null || baseline === null) return "unavailable" as const;
  if (current > baseline + tolerance) return "up" as const;
  if (current < baseline - tolerance) return "down" as const;
  return "flat" as const;
}

export function buildFlockAnalytics(input: {
  flock: AnalyticsFlock;
  rows: AnalyticsDailyRow[];
  previousRows: AnalyticsDailyRow[];
  weights: WeightSample[];
  targets: BreedTarget[];
  dateFrom: string;
  dateTo: string;
  warningVariancePct: number;
  criticalVariancePct: number;
}): FlockAnalyticsRow {
  const { flock } = input;
  const layerMode = flock.type === "layer" || flock.type === "parent_stock";
  const layerIds = new Set(layerMode ? [flock.id] : []);
  const expected = expectedRecordsForPeriod([flock], input.dateFrom, input.dateTo);
  const summary = summarizePeriod(input.rows, layerIds, expected);
  const previous = summarizePeriod(input.previousRows, layerIds, input.previousRows.length || expected);
  const ageDays = ageOnDate(flock.placementDate, flock.ageAtPlacementDays, input.dateTo);
  const ageWeeks = Math.floor(ageDays / 7);
  const target = input.targets.find((item) => item.week_number === ageWeeks) ?? null;
  const weights = input.weights.filter((row) => row.record_date <= input.dateTo && row.average_weight_g !== null).sort((a, b) => b.record_date.localeCompare(a.record_date));
  const latestWeight = weights[0] ?? null;
  const previousWeight = weights[1] ?? null;
  const primaryValue = layerMode ? summary.hdep : latestWeight?.average_weight_g ?? null;
  const primaryTarget = layerMode ? target?.target_hdep_pct ?? null : target?.target_weight_g ?? null;
  const baseline = layerMode ? previous.hdep : previousWeight?.average_weight_g ?? null;
  const targetGap = primaryValue !== null && primaryTarget !== null ? round(primaryValue - primaryTarget) : null;
  const targetAttainmentPct = primaryValue !== null && primaryTarget !== null && primaryTarget > 0 ? percent(primaryValue, primaryTarget) : null;
  const feedTarget = target?.target_feed_g ?? null;
  const feedVariancePct = summary.feedPerBirdGrams !== null && feedTarget !== null && feedTarget > 0
    ? round(((summary.feedPerBirdGrams - feedTarget) / feedTarget) * 100)
    : null;
  const mortalityTarget = target?.target_mortality_pct ?? null;
  const weightChangePerDay = latestWeight?.average_weight_g !== null && latestWeight?.average_weight_g !== undefined && previousWeight?.average_weight_g !== null && previousWeight?.average_weight_g !== undefined
    ? round((latestWeight.average_weight_g - previousWeight.average_weight_g) / Math.max(1, daysBetween(previousWeight.record_date, latestWeight.record_date)))
    : null;

  let status: FlockAnalyticsRow["status"] = "good";
  let statusReason = "Operating within the available comparison bands.";
  let attentionScore = 0;
  if (summary.records === 0) {
    status = "insufficient";
    statusReason = "No Daily Records were found in this period.";
    attentionScore = 100;
  } else if ((summary.recordCoveragePct ?? 0) < 70) {
    status = "critical";
    statusReason = `Only ${round(summary.recordCoveragePct ?? 0)}% of expected flock-days are recorded.`;
    attentionScore = 95;
  } else if ((summary.recordCoveragePct ?? 0) < 90) {
    status = "watch";
    statusReason = `Record coverage is ${round(summary.recordCoveragePct ?? 0)}%.`;
    attentionScore = 65;
  }

  if (targetGap !== null) {
    const criticalGap = layerMode ? targetGap < -7.5 : (targetAttainmentPct ?? 100) < 90;
    const watchGap = layerMode ? targetGap < -3 : (targetAttainmentPct ?? 100) < 95;
    if (criticalGap && attentionScore < 90) {
      status = "critical";
      statusReason = `${layerMode ? "HDEP" : "Weight"} is materially below the age target.`;
      attentionScore = 90;
    } else if (watchGap && attentionScore < 60) {
      status = "watch";
      statusReason = `${layerMode ? "HDEP" : "Weight"} is below the age target.`;
      attentionScore = 60;
    }
  } else if (layerMode && summary.hdep !== null && previous.hdep !== null && previous.hdep - summary.hdep > 5 && attentionScore < 55) {
    status = "watch";
    statusReason = "HDEP declined by more than five points from the previous period.";
    attentionScore = 55;
  }

  if (mortalityTarget !== null && summary.cumulativeMortalityPct !== null && summary.cumulativeMortalityPct > mortalityTarget && attentionScore < 85) {
    status = "critical";
    statusReason = "Mortality is above the available breed/week target.";
    attentionScore = 85;
  }
  if (feedVariancePct !== null && Math.abs(feedVariancePct) >= input.criticalVariancePct && attentionScore < 80) {
    status = "critical";
    statusReason = "Feed per bird is outside the critical target variance band.";
    attentionScore = 80;
  } else if (feedVariancePct !== null && Math.abs(feedVariancePct) >= input.warningVariancePct && attentionScore < 50) {
    status = "watch";
    statusReason = "Feed per bird is outside the warning target variance band.";
    attentionScore = 50;
  }
  if (!layerMode && (!latestWeight || daysBetween(latestWeight.record_date, input.dateTo) > 14) && attentionScore < 70) {
    status = "watch";
    statusReason = "The latest weight sample is more than 14 days old.";
    attentionScore = 70;
  }

  return {
    id: flock.id,
    code: flock.code,
    type: flock.type,
    farmId: flock.farmId,
    farmName: flock.farmName,
    houseId: flock.houseId,
    houseName: flock.houseName,
    ageWeeks,
    liveBirds: flock.currentBirds,
    primaryLabel: layerMode ? "Period HDEP" : "Latest weight",
    primaryValue,
    primaryUnit: layerMode ? "%" : "g",
    target: primaryTarget,
    targetGap,
    baseline,
    trend: metricDirection(primaryValue, baseline, layerMode ? 1 : 10),
    targetAttainmentPct,
    hdep: summary.hdep,
    feedPerBirdGrams: summary.feedPerBirdGrams,
    feedTargetGrams: feedTarget,
    feedVariancePct,
    mortalityPer1000BirdDays: summary.mortalityPer1000BirdDays,
    cumulativeMortalityPct: summary.cumulativeMortalityPct,
    mortalityTargetPct: mortalityTarget,
    marketableRate: summary.marketableRate,
    latestWeightG: latestWeight?.average_weight_g ?? null,
    uniformityPct: latestWeight?.uniformity_pct ?? null,
    weightChangePerDay,
    latestWeightDate: latestWeight?.record_date ?? null,
    eggs: summary.eggs,
    deaths: summary.deaths,
    recordCoveragePct: summary.recordCoveragePct,
    status,
    statusReason,
    attentionScore,
  };
}

export function eggQualityBreakdown(rows: AnalyticsDailyRow[]) {
  const values = [
    { label: "Marketable", value: rows.reduce((sum, row) => sum + (row.normal_eggs ?? 0), 0) },
    { label: "Broken", value: rows.reduce((sum, row) => sum + (row.broken_eggs ?? 0), 0) },
    { label: "Dirty", value: rows.reduce((sum, row) => sum + (row.dirty_eggs ?? 0), 0) },
  ];
  const total = values.reduce((sum, item) => sum + item.value, 0);
  return values.map((item) => ({ ...item, sharePct: percent(item.value, total) ?? 0 }));
}

export function mortalityCausePareto(rows: AnalyticsDailyRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if ((row.deaths ?? 0) <= 0) continue;
    const label = row.deaths_cause?.trim() || "Unspecified";
    totals.set(label, (totals.get(label) ?? 0) + (row.deaths ?? 0));
  }
  const sorted = [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  let cumulative = 0;
  return sorted.map((item) => {
    cumulative += item.value;
    return { ...item, sharePct: percent(item.value, total) ?? 0, cumulativePct: percent(cumulative, total) ?? 0 };
  });
}

export function feedTypeBreakdown(rows: AnalyticsDailyRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.feed_intake_grams === null) continue;
    const label = row.feed_type?.replaceAll("_", " ") || "Unspecified";
    totals.set(label, (totals.get(label) ?? 0) + row.feed_intake_grams / 1000);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals]
    .map(([label, valueKg]) => ({ label, valueKg: round(valueKg), sharePct: percent(valueKg, total) ?? 0 }))
    .sort((a, b) => b.valueKg - a.valueKg);
}
