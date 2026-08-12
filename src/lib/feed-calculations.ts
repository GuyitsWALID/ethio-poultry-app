export function roundFeed(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function calculateInventoryCover(onHandKg: number, consumedKg: number, coveredDays: number) {
  if (onHandKg < 0 || consumedKg <= 0 || coveredDays <= 0) return null;
  return roundFeed(onHandKg / (consumedKg / coveredDays));
}

export function calculateLayerFcr(feedKg: number, eggMassKg: number) {
  return feedKg >= 0 && eggMassKg > 0 ? roundFeed(feedKg / eggMassKg) : null;
}

export function calculateFeedPerBirdDay(feedKg: number, openingBirdDays: number) {
  return feedKg >= 0 && openingBirdDays > 0 ? roundFeed(feedKg * 1000 / openingBirdDays) : null;
}

export function calculateGrowthFcr(feedKg: number, biomassGainKg: number) {
  return feedKg >= 0 && biomassGainKg > 0 ? roundFeed(feedKg / biomassGainKg) : null;
}
