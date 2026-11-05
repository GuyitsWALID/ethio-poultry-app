import {ReportEvidenceError, type EvidenceRow} from "./report-evidence.ts";

export type ReportLocation = {flock_id: string; farm_id: string; house_id: string; from_date: string; to_date: string | null; verified: boolean; from_at?:string; to_at?:string|null; starts_with_move?:boolean};
export type LocationFilter = {branchId?: string; farmId?: string; houseId?: string; flockId?: string; batchId?: string};
export function selectReportLocations(locations: ReportLocation[], flocks: EvidenceRow[], farms: EvidenceRow[], filter: LocationFilter) {
  const farmsById = new Map(farms.map(row => [String(row.id), row]));
  const flocksById = new Map(flocks.map(row => [String(row.id), row]));
  return locations.filter(location => {
    const farm = farmsById.get(location.farm_id), flock = flocksById.get(location.flock_id);
    if (!farm || !flock || filter.branchId && farm.branch_id !== filter.branchId || filter.farmId && location.farm_id !== filter.farmId
      || filter.houseId && location.house_id !== filter.houseId || filter.flockId && location.flock_id !== filter.flockId
      || filter.batchId && flock.batch_id !== filter.batchId) return false;
    if (!location.verified) throw new ReportEvidenceError("REPORT_MOVEMENT_EVIDENCE_CONFLICT", 409);
    return true;
  });
}

// Stored location or an actual recorded time can disambiguate a movement day.
// Without either, do not guess which farm owns the evidence.
export function reportRowInLocations(row: EvidenceRow, locations: ReportLocation[], dateKey = "record_date") {
  const date = String(row[dateKey] ?? "").slice(0,10);
  if (!date) return false;
  return locations.some(location => {
    if(location.flock_id!==row.flock_id||location.from_date>date||location.to_date&&location.to_date<date
      ||row.house_id&&row.house_id!==location.house_id||row.farm_id&&row.farm_id!==location.farm_id)return false;
    if(row.house_id||row.farm_id)return true;
    const time=typeof row.recorded_time==="string"&&/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(row.recorded_time)?Date.parse(`${date}T${row.recorded_time}+03:00`):NaN;
    if(Number.isFinite(time)&&location.from_at)return time>=Date.parse(location.from_at)&&(!location.to_at||time<Date.parse(location.to_at));
    return !(location.to_date===date||location.starts_with_move&&location.from_date===date);
  });
}

export function projectLocationFlocks(flocks: EvidenceRow[], locations: ReportLocation[]) {
  const flockMap = new Map(flocks.map(row => [String(row.id),row]));
  return locations.map(location => ({...flockMap.get(location.flock_id), id: location.flock_id, farm_id: location.farm_id, house_id: location.house_id}));
}
