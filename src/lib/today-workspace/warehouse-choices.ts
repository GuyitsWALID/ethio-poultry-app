// Authorization is supplied by the shared database-backed access module.
// Task-specific compatibility is an additional restriction, never a grant.
export function isTodayWarehouseEligible(
  task: string,
  farmId: string,
  branchId: string | null,
  warehouse: {id: string; farmId: string | null; branchId: string | null},
  assignedIds: ReadonlySet<string>,
) {
  if (!assignedIds.has(warehouse.id)) return false;
  if (warehouse.farmId !== null && warehouse.farmId !== farmId) return false;
  if (task === "feeding") {
    return warehouse.farmId === farmId || (branchId !== null && warehouse.branchId === branchId);
  }
  return true;
}
