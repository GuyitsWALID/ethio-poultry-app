// Feed consumes stock for an assigned farm. Other warehouse operations retain
// their independent warehouse assignment requirement.
export function isTodayWarehouseEligible(
  task: string,
  farmId: string,
  branchId: string | null,
  warehouse: {id: string; farmId: string | null; branchId: string | null},
  assignedIds: ReadonlySet<string>,
) {
  if (warehouse.farmId !== null && warehouse.farmId !== farmId) return false;
  if (task === "feeding") {
    return warehouse.farmId === farmId || (branchId !== null && warehouse.branchId === branchId);
  }
  return assignedIds.has(warehouse.id);
}
