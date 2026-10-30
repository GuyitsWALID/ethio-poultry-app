export type BirdOpeningSource = "daily_record" | "previous_close" | "baseline" | "placement" | "missing";
type Evidence = {
  workDate: string; placementDate: string; initialCount?: number | null;
  dailyRecord: {openingBirds: number | null} | null;
  previousClosingBirds: number | null; previousRecordDate?: string | null;
  recordingStart?: {effectiveDate: string; liveBirds: number} | null;
};

const count = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

export function resolveBirdOpening(evidence: Evidence): {openingBirds: number | null; source: BirdOpeningSource} {
  // An incomplete saved record needs correction, not a silently substituted count.
  if (evidence.dailyRecord) return count(evidence.dailyRecord.openingBirds)
    ? {openingBirds: evidence.dailyRecord.openingBirds, source: "daily_record"}
    : {openingBirds: null, source: "missing"};
  const previous = new Date(`${evidence.workDate}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  if (Number.isFinite(previous.getTime()) && evidence.previousRecordDate === previous.toISOString().slice(0, 10) && count(evidence.previousClosingBirds)) {
    return {openingBirds: evidence.previousClosingBirds, source: "previous_close"};
  }
  if (evidence.recordingStart?.effectiveDate === evidence.workDate && count(evidence.recordingStart.liveBirds)) {
    return {openingBirds: evidence.recordingStart.liveBirds, source: "baseline"};
  }
  if (evidence.workDate === evidence.placementDate && count(evidence.initialCount) && !evidence.previousRecordDate) {
    return {openingBirds: evidence.initialCount, source: "placement"};
  }
  return {openingBirds: null, source: "missing"};
}
