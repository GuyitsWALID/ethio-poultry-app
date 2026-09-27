import type {TodayTaskCode} from "./contracts.ts";

export type TodayEntryTarget = {
  farmId?: string;
  houseId?: string;
  flockId?: string;
  date?: string;
  warehouseId?: string;
  stockMode?: "receipt" | "count";
};

// These destinations are exceptional workflows, not routine daily entry.
export function isLegacyCorrectionTarget(query: Pick<URLSearchParams, "get">) {
  return ["finding", "governance_request", "approval", "authorization", "record", "record_id", "source_id", "action", "action_id"].some((key) => Boolean(query.get(key)));
}

export function buildTodayEntryHref(task: TodayTaskCode, target: TodayEntryTarget, scope: TodayEntryTarget, flocks: Array<{id: string; farm_id: string; house_id: string}>, houses: Array<{id: string; farm_id: string}>, today: string) {
  const flockId = target.flockId ?? (target.farmId !== undefined || target.houseId !== undefined ? "" : scope.flockId);
  const flock = flocks.find((row) => row.id === flockId);
  const houseId = flock?.house_id ?? target.houseId ?? (target.farmId !== undefined || target.flockId !== undefined ? "" : scope.houseId);
  const house = houses.find((row) => row.id === houseId);
  const farmId = flock?.farm_id ?? house?.farm_id ?? target.farmId ?? (target.flockId !== undefined ? "" : scope.farmId);
  const query = new URLSearchParams({task, date: target.date ?? today});
  if (farmId) query.set("farm_id", farmId);
  if (houseId) query.set("house_id", houseId);
  if (flockId) query.set("flock_id", flockId);
  if (target.warehouseId) query.set("warehouse_id", target.warehouseId);
  if (task === "stock" && target.stockMode) query.set("stock_mode", target.stockMode);
  return `/app/today?${query.toString()}`;
}
