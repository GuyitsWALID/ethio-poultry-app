import type { ManagerDailyRow } from "@/lib/farm-manager-dashboard";

export type MonitoringStatus = "critical" | "watch" | "on_track" | "data_gap" | "empty";

export type FarmMonitoringResponse = {
  meta: { today: string; timezone: string; refreshedAt: string; scopeLabel: string; latestRecordAt: string | null };
  summary: {
    farms: number; houses: number; operatingHouses: number; emptyHouses: number; activeFlocks: number; liveBirds: number;
    capacityUtilizationPct: number | null; todayHdep: number | null; mortalityPct: number | null;
    recordsComplete: number; recordsExpected: number; feedDaysClosed: number; feedDaysExpected: number; housesNeedingAttention: number;
  };
  farms: Array<{
    id: string; name: string; branchName: string; capacity: number | null; houseCount: number; operatingHouses: number; emptyHouses: number;
    activeFlocks: number; liveBirds: number; utilizationPct: number | null; hdep: number | null; mortalityPct: number | null;
    feedPerBirdGrams: number | null; recordsComplete: number; recordsExpected: number; feedDaysClosed: number; feedDaysExpected: number;
    upcomingHealthWork: number; status: MonitoringStatus;
    houses: Array<{
      id: string; name: string; type: string; capacity: number | null; liveBirds: number; utilizationPct: number | null;
      status: MonitoringStatus; recordsComplete: number; recordsExpected: number; feedDaysClosed: number; feedDaysExpected: number;
      upcomingHealthWork: number;
      flocks: Array<{
        id: string; code: string; type: string; ageWeeks: number; liveBirds: number; metricLabel: string; actual: number | null; unit: string;
        target: number | null; targetAttainment: number | null; trend: "up" | "down" | "flat" | "unavailable";
        feedPerBirdGrams: number | null; mortalityPct: number | null; marketableRate: number | null; uniformityPct: number | null;
        recordStatus: "complete" | "pending" | "missing"; feedClosed: boolean; dataUpdatedAt: string | null;
        nextAction: string; actionRoute: string; status: "critical" | "watch" | "pending" | "on_track"; upcomingHealthWork: number;
      }>;
    }>;
  }>;
  actions: Array<{ id: string; severity: "critical" | "warning" | "pending"; title: string; context: string; route: string; farmId: string; houseId?: string; flockId?: string }>;
  dataTrust: { recordCoveragePct: number; feedClosurePct: number; targetCoveragePct: number; notes: string[] };
};

export function capacityUtilization(liveBirds: number, capacity: number | null) {
  if (capacity === null || capacity <= 0) return null;
  return Math.round((liveBirds / capacity) * 10000) / 100;
}

export function monitoringStatus(values: { empty?: boolean; critical: number; watch: number; pending: number }): MonitoringStatus {
  if (values.empty) return "empty";
  if (values.critical > 0) return "critical";
  if (values.watch > 0) return "watch";
  if (values.pending > 0) return "data_gap";
  return "on_track";
}

export function monitoringAggregate(rows: ManagerDailyRow[]) {
  let birdDays = 0;
  let eggs = 0;
  let feedGrams = 0;
  let deaths = 0;
  let eggRows = 0;
  let feedRows = 0;
  let mortalityRows = 0;
  for (const row of rows) {
    const birds = row.opening_birds ?? row.closing_birds;
    if (birds !== null && birds > 0) birdDays += birds;
    if (row.total_eggs !== null) { eggs += row.total_eggs; eggRows += 1; }
    if (row.feed_intake_grams !== null) { feedGrams += row.feed_intake_grams; feedRows += 1; }
    if (row.deaths !== null) { deaths += row.deaths; mortalityRows += 1; }
  }
  const rounded = (value: number, places = 2) => {
    const scale = 10 ** places;
    return Math.round(value * scale) / scale;
  };
  return {
    liveBirds: rows.reduce((sum, row) => sum + (row.closing_birds ?? row.opening_birds ?? 0), 0),
    hdep: eggRows && birdDays > 0 ? rounded((eggs / birdDays) * 100) : null,
    mortalityPct: mortalityRows && birdDays > 0 ? rounded((deaths / birdDays) * 100) : null,
    feedPerBirdGrams: feedRows && birdDays > 0 ? rounded(feedGrams / birdDays, 1) : null,
  };
}
