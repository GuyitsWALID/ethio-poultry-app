export const scopedReportVersion = "management-report-v1-scoped";
export type ReportResources = {schema_version: 1; complete: boolean; farm_ids: string[]; warehouse_ids: string[]};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// These inputs come from the server reader's used sources, never request fields.
export function reportResources(farmIds: Iterable<string>, stock: readonly {warehouse_id?: unknown}[]): ReportResources {
  const farms = [...new Set(farmIds)].sort();
  if (farms.some(id => !uuid.test(id))) throw new Error("REPORT_RESOURCE_PROVENANCE_INVALID");
  const warehouses = stock.map(row => row.warehouse_id);
  return {schema_version: 1, complete: warehouses.every(id => typeof id === "string" && uuid.test(id)),
    farm_ids: farms, warehouse_ids: [...new Set(warehouses.filter((id): id is string => typeof id === "string" && uuid.test(id)))].sort()};
}

export function readableReportVersion(version: unknown) {
  if (version !== "management-report-v1" && version !== scopedReportVersion) throw new Error("This report version is not supported.");
  return version;
}
