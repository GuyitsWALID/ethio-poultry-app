export type MortalityDailyInput = {
  flockId: string;
  recordDate: string;
  deaths: number | null;
  openingBirds: number | null;
  closingBirds: number | null;
  cause: string | null;
};

export type MortalityEventInput = {
  id: string;
  flockId: string;
  recordDate: string;
  count: number;
  cause: string;
  diagnosis: string | null;
  recordedTime: string | null;
  notes: string | null;
};

export type CauseAllocation = {
  cause: string;
  deaths: number;
  source: "event" | "daily_record" | "unexplained";
};

export type MortalityDashboardResponse = {
  meta: { dateFrom: string; dateTo: string; previousFrom: string; previousTo: string; timezone: string; refreshedAt: string; scopeLabel: string; days: number };
  summary: {
    officialDeaths: number | null; mortalityPerThousand: number | null; previousDeaths: number | null;
    direction: "up" | "down" | "flat" | "unavailable"; changePct: number | null; affectedFlocks: number;
    recordsComplete: number; recordsExpected: number; unexplainedDeaths: number; eventDeaths: number;
    peakDate: string | null; peakDeaths: number | null;
  };
  trends: Array<{ date: string; deaths: number | null; mortalityPerThousand: number | null; rollingAverage: number | null; records: number }>;
  fingerprint: { dates: string[]; flocks: Array<{ id: string; code: string; farmName: string; houseName: string; days: Array<{ date: string; deaths: number | null; mortalityPerThousand: number | null }> }> };
  comparisons: Array<{
    id: string; code: string; farmName: string; houseName: string; liveBirds: number; deaths: number | null;
    mortalityPerThousand: number | null; weeklyRatePct: number | null; targetPct: number | null; targetGapPct: number | null;
    previousDeaths: number | null; direction: "up" | "down" | "flat" | "unavailable"; changePct: number | null;
    leadingCause: string | null; unexplainedPct: number | null; deathDays: number; lastDeathDate: string | null;
    status: "critical" | "watch" | "stable" | "insufficient_data"; coveragePct: number;
  }>;
  causes: Array<{ cause: string; deaths: number; sharePct: number }>;
  timeBands: Array<{ band: string; deaths: number }>;
  diagnoses: Array<{ diagnosis: string; deaths: number }>;
  actions: Array<{ id: string; severity: "critical" | "warning" | "data"; title: string; explanation: string; route: string; flockCode?: string }>;
  events: Array<{ id: string; date: string; time: string | null; flockCode: string; farmName: string; cause: string; diagnosis: string | null; count: number; notes: string | null }>;
  dataTrust: { coveragePct: number; eventReconciliationPct: number | null; notes: string[] };
};

export function roundMortality(value: number, places = 2) {
  const scale = 10 ** places;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

export function birdDays(row: Pick<MortalityDailyInput, "openingBirds" | "closingBirds">) {
  if (row.openingBirds !== null && row.closingBirds !== null) return (row.openingBirds + row.closingBirds) / 2;
  return row.openingBirds ?? row.closingBirds;
}

export function mortalityPerThousand(rows: MortalityDailyInput[]) {
  const recorded = rows.filter((row) => row.deaths !== null && birdDays(row) !== null);
  if (!recorded.length) return null;
  const denominator = recorded.reduce((sum, row) => sum + (birdDays(row) ?? 0), 0);
  if (denominator <= 0) return null;
  const deaths = recorded.reduce((sum, row) => sum + (row.deaths ?? 0), 0);
  return roundMortality((deaths / denominator) * 1000, 3);
}

export function reconcileCauses(row: MortalityDailyInput, events: MortalityEventInput[]): CauseAllocation[] {
  const officialDeaths = row.deaths ?? 0;
  if (officialDeaths <= 0) return [];
  const validEvents = events.filter((event) => event.flockId === row.flockId && event.recordDate === row.recordDate && event.count > 0);
  const eventTotal = validEvents.reduce((sum, event) => sum + event.count, 0);
  const scale = eventTotal > officialDeaths ? officialDeaths / eventTotal : 1;
  const allocations = new Map<string, number>();
  for (const event of validEvents) {
    const cause = event.cause.trim() || "Unspecified";
    allocations.set(cause, (allocations.get(cause) ?? 0) + event.count * scale);
  }
  const explained = [...allocations.values()].reduce((sum, value) => sum + value, 0);
  const remainder = Math.max(officialDeaths - explained, 0);
  const rows: CauseAllocation[] = [...allocations.entries()].map(([cause, deaths]) => ({ cause, deaths, source: "event" }));
  if (remainder > 0) {
    const dailyCause = row.cause?.trim();
    rows.push({ cause: dailyCause || "Unexplained", deaths: remainder, source: dailyCause ? "daily_record" : "unexplained" });
  }
  return rows;
}

export function periodDirection(current: number | null, previous: number | null) {
  if (current === null || previous === null) return { direction: "unavailable" as const, changePct: null };
  if (previous === 0) return current === 0
    ? { direction: "flat" as const, changePct: 0 }
    : { direction: "up" as const, changePct: null };
  const changePct = roundMortality(((current - previous) / previous) * 100, 1);
  return { direction: Math.abs(changePct) < 1 ? "flat" as const : changePct > 0 ? "up" as const : "down" as const, changePct };
}

export function dateRange(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return [];
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function timeBand(value: string | null) {
  if (!value) return "Unknown";
  const hour = Number(value.slice(0, 2));
  if (!Number.isFinite(hour)) return "Unknown";
  if (hour < 6) return "Overnight";
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}
