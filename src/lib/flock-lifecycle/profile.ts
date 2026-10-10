import {addDays, ageOnDate, daysBetween, percent, round, summarizeDaily} from "../farm-manager-dashboard.ts";
import type {BreedTarget, FlockType, ManagerDailyRow, WeightSample} from "../farm-manager-dashboard.ts";

export const profilePeriods = [7, 30, 90] as const;
export type ProfileDays = typeof profilePeriods[number];
export type ProfileDaily = ManagerDailyRow & {culls: number | null};
export type ProfileFlock = {
  id: string; code: string; farmId: string; farmName: string; houseId: string; houseName: string;
  batchId: string | null; batchLabel: string | null; breedName: string | null; type: FlockType; status: string;
  placementDate: string; ageAtPlacementDays: number; startingBirds: number; currentBirds: number;
  completionDate: string | null; beforeClearanceBirds: number | null;
};
export type ProfileStepCode = "production_shortfall" | "growth_variance" | "mortality_high" | "feed_variance" | "stale_weight" | "missing_targets" | "missing_records" | "unfinished_feed" | "completion_unverified";
export type ProfileStep = {code: ProfileStepCode; severity: "critical" | "watch" | "pending"; date: string | null; href: string; count?: number};

export function profilePeriod(flock: ProfileFlock, days: ProfileDays, today: string) {
  const operating = flock.status === "active" || flock.status === "quarantined";
  const end = operating ? today : flock.completionDate;
  if (!end || end < flock.placementDate) return {from: null, to: null, expectedDays: 0};
  const from = [addDays(end, 1 - days), flock.placementDate].sort().at(-1)!;
  return {from, to: end, expectedDays: daysBetween(from, end) + 1};
}

// Dates/identities come from authorized source records, not client-provided values.
export function buildFlockProfile(input: {
  flock: ProfileFlock; days: ProfileDays; today: string; daily: ProfileDaily[];
  closedFeedDates: string[]; targets: BreedTarget[]; weights: WeightSample[];
  warningVariancePct: number; criticalVariancePct: number;
  allowTodayActions?: boolean;
}) {
  const {flock, today} = input;
  const period = profilePeriod(flock, input.days, today);
  const dates: string[] = [];
  if (period.from && period.to) for (let date = period.from; date <= period.to; date = addDays(date, 1)) dates.push(date);
  const dateSet = new Set(dates);
  const daily = input.daily.filter(row => row.flock_id === flock.id && dateSet.has(row.record_date));
  const missingDates = dates.filter(date => !daily.some(row => row.record_date === date));
  const closedFeed = new Set(input.closedFeedDates);
  const missingFeedDates = dates.filter(date => !closedFeed.has(date));
  const layer = flock.type === "layer" || flock.type === "parent_stock";
  const birdsKnown = (row: ProfileDaily) => (row.opening_birds ?? row.closing_birds) !== null;
  // Match numerator and denominator evidence; missing feed/eggs must not depress rates.
  const productionRows = daily.filter(row => birdsKnown(row) && row.total_eggs !== null);
  const feedRows = daily.filter(row => birdsKnown(row) && row.feed_intake_grams !== null);
  const deathRows = daily.filter(row => birdsKnown(row) && row.deaths !== null);
  const qualityRows = daily.filter(row => row.normal_eggs !== null && row.broken_eggs !== null && row.dirty_eggs !== null);
  const sum = (field: "deaths" | "culls" | "total_eggs" | "feed_intake_grams") => {
    const known = daily.filter(row => row[field] !== null);
    return known.length ? known.reduce((total, row) => total + row[field]!, 0) : null;
  };
  const deaths = sum("deaths"), culls = sum("culls");
  const feedGrams = sum("feed_intake_grams");
  const hdep = layer ? summarizeDaily(productionRows).hdep : null;
  const feedPerBird = summarizeDaily(feedRows).feedPerBirdGrams;
  const mortality = summarizeDaily(deathRows).mortality;
  const targetFor = (date: string) => input.targets.find(row => row.week_number === Math.floor(ageOnDate(flock.placementDate, flock.ageAtPlacementDays, date) / 7));
  const weightedTarget = (rows: ProfileDaily[], field: "target_hdep_pct" | "target_feed_g" | "target_mortality_pct") => {
    if (!rows.length || rows.some(row => targetFor(row.record_date)?.[field] == null)) return null;
    const birdDays = rows.reduce((sum, row) => sum + (row.opening_birds ?? row.closing_birds ?? 0), 0);
    return birdDays > 0 ? round(rows.reduce((sum, row) => sum + (row.opening_birds ?? row.closing_birds ?? 0) * targetFor(row.record_date)![field]!, 0) / birdDays) : null;
  };
  const productionTarget = layer ? weightedTarget(productionRows, "target_hdep_pct") : null;
  const feedTarget = weightedTarget(feedRows, "target_feed_g");
  const mortalityTarget = weightedTarget(deathRows, "target_mortality_pct");
  const weights = input.weights.filter(row => row.record_date >= flock.placementDate && period.to && row.record_date <= period.to && row.average_weight_g !== null).sort((a, b) => b.record_date.localeCompare(a.record_date));
  const latest = weights[0] ?? null;
  const previous = weights.find(row => row.record_date < latest!.record_date && dateSet.has(row.record_date)) ?? null;
  const weightTarget = latest ? targetFor(latest.record_date)?.target_weight_g ?? null : null;
  const measurements = weights.filter(row => dateSet.has(row.record_date)).map(row => ({...row, targetWeightGrams: targetFor(row.record_date)?.target_weight_g ?? null}));
  const growthPerDay = latest && previous ? round((latest.average_weight_g! - previous.average_weight_g!) / daysBetween(previous.record_date, latest.record_date)) : null;
  const sourceQuery = new URLSearchParams({filter_view: "1", filter_farmId: flock.farmId, filter_houseId: flock.houseId, filter_flockId: flock.id});
  const correctionHref = `/app/reconciliation?${sourceQuery}`;
  const todayHref = (task: string, date: string) => `/app/today?${new URLSearchParams({farm_id: flock.farmId, house_id: flock.houseId, flock_id: flock.id, date, task})}`;
  const steps: Array<ProfileStep & {rank: number}> = [];
  const add = (code: ProfileStepCode, severity: ProfileStep["severity"], rank: number, date: string | null, task?: string, count?: number) => {
    const query = new URLSearchParams(sourceQuery);
    if (date) {query.set("filter_dateFrom", date); query.set("filter_dateTo", date); query.set("filter_preset", "custom");}
    let href = correctionHref;
    if (code === "missing_records") {
      query.set("filter_page_dateFilterMode", "single"); if (date) query.set("filter_page_filterDate", date);
      href = `/app/daily-records?${query}`;
    } else if (["unfinished_feed", "missing_targets", "stale_weight", "feed_variance", "growth_variance"].includes(code) && flock.batchId) {
      query.set("filter_batchId", flock.batchId);
      href = `/app/feeding-log?${query}&feed_target=${code === "missing_targets" ? "template_management" : "feed_history"}`;
    }
    steps.push({code, severity, rank, date, href: input.allowTodayActions !== false && task && flock.status === "active" && date === today ? todayHref(task, date) : href, ...(count === undefined ? {} : {count})});
  };
  if (!period.to && !["active", "quarantined"].includes(flock.status)) add("completion_unverified", "pending", 80, null);
  if (productionTarget !== null && hdep !== null) {
    const gap = hdep - productionTarget;
    if (gap < -7.5) add("production_shortfall", "critical", 100, period.to);
    else if (gap < -3) add("production_shortfall", "watch", 60, period.to);
  }
  if (!layer && latest && weightTarget !== null && weightTarget > 0) {
    const deviation = Math.abs(100 - (percent(latest.average_weight_g!, weightTarget) ?? 100));
    if (deviation > 10) add("growth_variance", "critical", 100, latest.record_date);
    else if (deviation > 5) add("growth_variance", "watch", 60, latest.record_date);
  }
  if (mortality !== null && mortalityTarget !== null && mortality > mortalityTarget) add("mortality_high", "critical", 95, period.to);
  if (feedPerBird !== null && feedTarget !== null && feedTarget > 0) {
    const variance = Math.abs((feedPerBird - feedTarget) / feedTarget * 100);
    if (variance >= input.criticalVariancePct) add("feed_variance", "critical", 90, period.to);
    else if (variance >= input.warningVariancePct) add("feed_variance", "watch", 55, period.to);
  }
  if (!layer && period.to && (!latest || daysBetween(latest.record_date, period.to) > 14)) add("stale_weight", "watch", 65, latest?.record_date ?? null);
  const targetMissingDates = dates.filter(date => {
    const target = targetFor(date);
    return !target || target.target_feed_g === null || (layer ? target.target_hdep_pct === null : target.target_weight_g === null);
  });
  if (targetMissingDates.length) add("missing_targets", "pending", 50, targetMissingDates[0], undefined, targetMissingDates.length);
  if (missingDates.length) add("missing_records", "pending", 80, missingDates[0], "birds", missingDates.length);
  if (missingFeedDates.length) add("unfinished_feed", "pending", 70, missingFeedDates[0], "feeding", missingFeedDates.length);
  steps.sort((a, b) => b.rank - a.rank || a.code.localeCompare(b.code));
  return {
    flock: {...flock, ageDays: period.to ? ageOnDate(flock.placementDate, flock.ageAtPlacementDays, period.to) : null},
    period: {...period, days: input.days}, today,
    coverage: {records: new Set(daily.map(row => row.record_date)).size, expected: dates.length, missingDates, missingFeedDates, targetMissingDates,
      feedClosed: dates.filter(date => closedFeed.has(date)).length,
      eggsDays: daily.filter(row => row.total_eggs !== null).length,
      feedQuantityDays: daily.filter(row => row.feed_intake_grams !== null).length,
      productionDays: productionRows.length, feedDays: feedRows.length, deathDays: deathRows.length,
      cullDays: daily.filter(row => row.culls !== null).length, qualityDays: qualityRows.length},
    results: {deaths, culls, losses: deaths === null || culls === null ? null : deaths + culls,
      feedKg: feedGrams === null ? null : round(feedGrams / 1000), feedPerBirdGrams: feedPerBird, feedTargetGrams: feedTarget,
      mortalityPct: mortality, mortalityTargetPct: mortalityTarget, eggs: layer ? sum("total_eggs") : null,
      productionPct: hdep, productionTargetPct: productionTarget, saleablePct: layer ? summarizeDaily(qualityRows).marketableRate : null,
      latestWeight: latest ? {...latest, targetWeightGrams: weightTarget, outsidePeriod: !dateSet.has(latest.record_date)} : null,
      growthPerDay, measurements},
    steps: steps.map(({rank: _rank, ...step}) => {void _rank; return step;}),
    todayTasks: [] as Array<{code: string; state: string; href: string}>,
    todayTasksAvailable: false,
  };
}

export type FlockProfile = ReturnType<typeof buildFlockProfile>;
