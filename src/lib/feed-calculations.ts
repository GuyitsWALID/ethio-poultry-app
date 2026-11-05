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

type ReportRow = Record<string, unknown>;
const known = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
// Sum compatible numerators/denominators, never the flock ratios themselves.
export function calculateReportFcr(flocks: readonly ReportRow[], daily: readonly ReportRow[], weights: readonly ReportRow[]) {
  const layerIds = new Set(flocks.filter(row=>["layer","parent_stock"].includes(String(row.flock_type))).map(row=>row.id));
  const growthIds = new Set(flocks.filter(row=>["broiler","rearing"].includes(String(row.flock_type))).map(row=>row.id));
  const layers=daily.filter(row=>layerIds.has(row.flock_id));
  const layerComplete=layers.length>0&&layers.every(row=>known(row.feed_intake_grams)&&known(row.total_eggs)&&(row.total_eggs===0||known(row.average_egg_weight_g)));
  const layerFeed=layers.reduce((sum,row)=>sum+(known(row.feed_intake_grams)?row.feed_intake_grams:0),0)/1000;
  const eggMass=layers.reduce((sum,row)=>sum+(known(row.total_eggs)&&known(row.average_egg_weight_g)?row.total_eggs*row.average_egg_weight_g:0),0)/1000;
  let growthFeed=0, gain=0, growthComplete=growthIds.size>0;
  for(const id of growthIds){
    const samples=weights.filter(row=>row.flock_id===id&&known(row.average_weight_g)).sort((a,b)=>String(a.record_date).localeCompare(String(b.record_date)));
    const first=samples[0],last=samples.at(-1);
    if(!first||!last||first.record_date===last.record_date){growthComplete=false;continue;}
    const rows=daily.filter(row=>row.flock_id===id&&String(row.record_date)>=String(first.record_date)&&String(row.record_date)<=String(last.record_date));
    const days=Math.round((Date.parse(String(last.record_date))-Date.parse(String(first.record_date)))/86400000)+1;
    const birds=rows[0]?.opening_birds;
    // Removed-bird weights are not recorded. Do not invent biomass for a changing population.
    if(new Set(rows.map(row=>row.record_date)).size!==days||!known(birds)||birds<=0||rows.some(row=>row.opening_birds!==birds||row.closing_birds!==birds||!known(row.feed_intake_grams))){growthComplete=false;continue;}
    const flockGain=(Number(last.average_weight_g)-Number(first.average_weight_g))*birds/1000;
    if(flockGain<=0){growthComplete=false;continue;}
    gain+=flockGain;growthFeed+=rows.reduce((sum,row)=>sum+Number(row.feed_intake_grams)/1000,0);
  }
  return {layer:layerComplete?calculateLayerFcr(layerFeed,eggMass):null,growth:growthComplete?calculateGrowthFcr(growthFeed,gain):null,
    mixed:layerIds.size>0&&growthIds.size>0};
}
