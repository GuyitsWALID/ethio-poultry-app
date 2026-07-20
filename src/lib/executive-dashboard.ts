export type Confidence = "actual" | "estimate" | "unavailable";

export type ExecutiveDailyRow = {
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
  feed_leftover_grams: number | null;
  average_egg_weight_g: number | null;
  water_consumed_liters: number | null;
  updated_at: string;
};

export function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function percent(numerator: number, denominator: number) {
  return denominator > 0 ? round((numerator / denominator) * 100) : null;
}

export function previousPeriod(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - days + 1);
  return { dateFrom: previousStart.toISOString().slice(0, 10), dateTo: previousEnd.toISOString().slice(0, 10) };
}

export function calculateProduction(rows: ExecutiveDailyRow[]) {
  let birdDays = 0;
  let layerBirdDays = 0;
  let deaths = 0;
  let eggs = 0;
  let normalEggs = 0;
  let brokenEggs = 0;
  let dirtyEggs = 0;
  let feedGrams = 0;
  let leftoverGrams = 0;
  let waterLiters = 0;
  let eggMassGrams = 0;
  let completeRows = 0;
  let latestAt: string | null = null;
  const byDate = new Map<string, { date: string; eggs: number; deaths: number; birdDays: number; layerBirdDays: number; feedGrams: number }>();

  rows.forEach((row) => {
    const birds = row.opening_birds ?? row.closing_birds;
    const rowEggs = row.total_eggs ?? 0;
    const rowDeaths = row.deaths ?? 0;
    const current = byDate.get(row.record_date) ?? { date: row.record_date, eggs: 0, deaths: 0, birdDays: 0, layerBirdDays: 0, feedGrams: 0 };
    current.eggs += rowEggs;
    current.deaths += rowDeaths;
    current.feedGrams += row.feed_intake_grams ?? 0;
    if (birds !== null && birds > 0) current.birdDays += birds;
    if (birds !== null && birds > 0 && row.total_eggs !== null) current.layerBirdDays += birds;
    byDate.set(row.record_date, current);
    if (birds !== null && birds > 0) birdDays += birds;
    if (birds !== null && birds > 0 && row.total_eggs !== null) layerBirdDays += birds;
    deaths += rowDeaths;
    eggs += rowEggs;
    normalEggs += row.normal_eggs ?? rowEggs;
    brokenEggs += row.broken_eggs ?? 0;
    dirtyEggs += row.dirty_eggs ?? 0;
    feedGrams += row.feed_intake_grams ?? 0;
    leftoverGrams += row.feed_leftover_grams ?? 0;
    waterLiters += row.water_consumed_liters ?? 0;
    if (row.average_egg_weight_g && rowEggs > 0) eggMassGrams += row.average_egg_weight_g * rowEggs;
    if (birds !== null && row.total_eggs !== null && row.deaths !== null && row.feed_intake_grams !== null) completeRows += 1;
    if (!latestAt || row.updated_at > latestAt) latestAt = row.updated_at;
  });

  const firstByFlock = new Map<string, ExecutiveDailyRow>();
  [...rows].sort((a, b) => a.record_date.localeCompare(b.record_date)).forEach((row) => {
    if (!firstByFlock.has(row.flock_id)) firstByFlock.set(row.flock_id, row);
  });
  const birdsAtRisk = Array.from(firstByFlock.values()).reduce((sum, row) => sum + (row.opening_birds ?? row.closing_birds ?? 0), 0);
  const trends = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({
    date: row.date,
    eggs: row.eggs,
    hdep: percent(row.eggs, row.layerBirdDays),
    mortality: percent(row.deaths, row.birdDays),
    feedPerBirdGrams: row.birdDays > 0 ? round(row.feedGrams / row.birdDays) : null,
  }));

  return {
    birdDays,
    deaths,
    eggs,
    normalEggs,
    brokenEggs,
    dirtyEggs,
    feedKg: round(feedGrams / 1000),
    feedLeftoverKg: round(leftoverGrams / 1000),
    waterLiters: round(waterLiters),
    hdep: percent(eggs, layerBirdDays),
    mortality: percent(deaths, birdsAtRisk),
    feedPerBirdGrams: birdDays > 0 ? round(feedGrams / birdDays) : null,
    layerFcr: eggMassGrams > 0 ? round((feedGrams / 1000) / (eggMassGrams / 1000)) : null,
    waterFeedRatio: feedGrams > 0 ? round(waterLiters / (feedGrams / 1000)) : null,
    marketableRate: percent(normalEggs, normalEggs + brokenEggs + dirtyEggs),
    completeness: rows.length > 0 ? round((completeRows / rows.length) * 100) : 0,
    latestAt,
    trends,
  };
}

export function summarizeSales(rows: Array<{ gross_amount: number; paid_amount: number; balance_due: number; product_category: string; farm_id: string | null }>) {
  const revenue = rows.reduce((sum, row) => sum + Number(row.gross_amount ?? 0), 0);
  const paid = rows.reduce((sum, row) => sum + Number(row.paid_amount ?? 0), 0);
  const receivables = rows.reduce((sum, row) => sum + Number(row.balance_due ?? 0), 0);
  const mix = Array.from(rows.reduce((map, row) => map.set(row.product_category, (map.get(row.product_category) ?? 0) + Number(row.gross_amount ?? 0)), new Map<string, number>()))
    .map(([label, value]) => ({ label, value: round(value) })).sort((a, b) => b.value - a.value);
  return { revenue: round(revenue), paid: round(paid), receivables: round(receivables), collectionRate: percent(paid, revenue), mix };
}
