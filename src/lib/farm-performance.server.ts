import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {governanceAdmin, type AccessContext} from "@/lib/access-context";
import {loadOperationsAnalytics} from "@/lib/operations-analytics-service";
import {loadReportEvidence} from "@/lib/report-evidence.server";
import {PerformanceError, performanceParams, readPerformance} from "@/lib/farm-performance";
import type {ReportInput} from "@/lib/report-workspace";
import type {OperationsAnalyticsResponse} from "@/lib/operational-analytics";
import {readReportQuery} from "@/lib/report-pagination";
import {effectiveWarehouseIds} from "@/lib/warehouse-access";
import {selectEvidenceScope, type EvidenceRow} from "@/lib/report-evidence";
import {selectReportLocations, projectLocationFlocks, reportRowInLocations, type ReportLocation} from "@/lib/report-locations";
import {performancePeriod} from "@/lib/farm-performance";
import {reportOperatingDate} from "@/lib/report-safety";
import {loadSalesAnalytics} from "@/lib/sales-analytics-service";
import {projectFeedingPerformance, projectStockPerformance, projectSalesPerformance, selectPerformanceWarehouses, type PerformanceWarehouse, type StockLedgerRow, type SalesPerformanceData} from "@/lib/farm-performance-adapters";
import {reportResources, type ReportResources} from "@/lib/report-snapshot";

const db = governanceAdmin as any;
const all = async <T = EvidenceRow>(make: () => any): Promise<T[]> => (await readReportQuery<T>(make)).data;
async function responseData<T>(response: Response): Promise<T> {
  if (!response.ok) throw new PerformanceError(response.status === 403 ? "REPORT_SCOPE_DENIED" : response.status === 409 ? "REPORT_EVIDENCE_CONFLICT" : "REPORT_LOAD_FAILED", response.status);
  return await response.json() as T;
}
async function loadScope(ctx: AccessContext, input: ReportInput) {
  const restricted = ctx.role === "farm_manager" && !ctx.supportSessionId;
  const now = new Date().toISOString();
  const assignments = restricted ? await all(() => db.from("user_farm_access").select("id,farm_id").eq("org_id", ctx.orgId).eq("profile_id", ctx.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).order("id")) : [];
  const assigned = new Set(assignments.map(row => String(row.farm_id)));
  const [farmRows, flocks, houses, batches, locations, stores] = await Promise.all([
    all(() => db.from("farms").select("id,org_id,branch_id,name").eq("org_id", ctx.orgId).order("id")),
    all(() => db.from("flocks").select("id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,status,placement_date").eq("org_id", ctx.orgId).order("id")),
    all(() => db.from("houses").select("id,org_id,farm_id").eq("org_id", ctx.orgId).order("id")),
    all(() => db.from("batches").select("id,org_id,farm_id,house_id").eq("org_id", ctx.orgId).order("id")),
    all<ReportLocation>(() => db.rpc("report_flock_locations", {p_org: ctx.orgId}).order("flock_id").order("from_at").order("house_id")),
    restricted ? effectiveWarehouseIds(ctx) : Promise.resolve(null),
  ]);
  const farms = farmRows.filter(row => !restricted || assigned.has(String(row.id)));
  const selectedLocations = selectReportLocations(locations, flocks, farms, input);
  const authorizedLocations = selectReportLocations(locations.filter(row => row.verified), flocks, farms, {});
  const scope = selectEvidenceScope(ctx.orgId, restricted, farms, projectLocationFlocks(flocks, authorizedLocations), input, {houses, batches});
  const warehouseRows = await all<PerformanceWarehouse>(() => db.from("warehouses").select("id,name,farm_id,branch_id,status").eq("org_id", ctx.orgId).eq("status", "active").order("id"));
  const permittedStores = stores === null ? warehouseRows : warehouseRows.filter(row => stores.includes(row.id));
  const stockFarmIds = input.houseId ? houses.filter(row => row.id === input.houseId).map(row => String(row.farm_id))
    : input.flockId || input.batchId ? [...new Set(selectedLocations.filter(row => row.from_date <= input.dateTo && (!row.to_date || row.to_date >= input.dateFrom)).map(row => row.farm_id))] : scope.farmIds;
  const selectedFarms = farms.filter(row => stockFarmIds.includes(String(row.id)));
  const availableWarehouses = selectPerformanceWarehouses(permittedStores, {...input, warehouseId: undefined}, stockFarmIds, selectedFarms.map(row => String(row.branch_id)));
  const warehouses = availableWarehouses.filter(row => !input.warehouseId || row.id === input.warehouseId);
  if (input.warehouseId && !warehouses.some(row => row.id === input.warehouseId)) throw new PerformanceError("REPORT_SCOPE_DENIED", 403);
  return {scope, farms, flocks, selectedLocations, stores, warehouses, availableWarehouses, assigned};
}

export async function loadFarmPerformance(ctx: AccessContext, input: ReportInput, captureResources?: (resources: ReportResources) => void) {
  if (ctx.role !== "ceo" && ctx.role !== "farm_manager" && !ctx.supportSessionId) throw new PerformanceError("REPORT_SCOPE_DENIED", 403);
  const scope = await loadScope(ctx, input);
  const captured: ReportResources[] = [reportResources(scope.scope.farmIds, scope.warehouses.map(row => ({warehouse_id: row.id})))];
  const capture = (resources: ReportResources) => {captured.push(resources);};
  const asOf = Date.now();
  const prior = performancePeriod(input);
  const previousInput = {...input, dateFrom: prior.previousFrom, dateTo: prior.previousTo};
  const result = await readPerformance(input, {
    operations: async input => {
      const response = await loadOperationsAnalytics(ctx, performanceParams(input), capture);
      return responseData<OperationsAnalyticsResponse>(response);
    },
    health: input => loadReportEvidence(ctx, "health", input),
    stock: async () => {
      if (!scope.warehouses.length) return projectStockPerformance(input, [], [], []);
      const ids = scope.warehouses.map(row => row.id);
      const [items, ledger] = await Promise.all([
        all(() => db.from("inventory_items").select("id,name,unit,unit_cost,reorder_level").eq("org_id", ctx.orgId).order("id")),
        all<StockLedgerRow>(() => db.from("stock_ledger").select("item_id,warehouse_id,transaction_type,quantity,transaction_date").eq("org_id", ctx.orgId).in("warehouse_id", ids).order("transaction_date").order("id")),
      ]);
      return projectStockPerformance(input, scope.warehouses, items, ledger, asOf);
    },
    feeding: async (_input, operations) => {
      const ids = scope.scope.flockIds;
      if (!ids.length) return projectFeedingPerformance(input, {sessions: [], closures: [], daily: [], weights: [], flocks: [], ambiguousMovementDays: false}, operations);
      const [sessions, closures, daily, weights, clearances, cycleClosures] = await Promise.all([
        all(() => db.from("feeding_session_records").select("id,flock_id,record_date,session_name,session_time,feed_type,planned_feed_kg,actual_feed_kg,status,warehouse_id").eq("org_id", ctx.orgId).in("flock_id", ids).is("voided_at", null).gte("record_date", prior.previousFrom).lte("record_date", input.dateTo).order("record_date").order("id")),
        all(() => db.from("feed_day_closures").select("id,flock_id,record_date,status").eq("org_id", ctx.orgId).in("flock_id", ids).gte("record_date", prior.previousFrom).lte("record_date", input.dateTo).order("record_date").order("id")),
        all(() => db.from("daily_farm_records").select("id,flock_id,farm_id,house_id,record_date,opening_birds,closing_birds,feed_intake_grams,total_eggs,average_egg_weight_g").eq("org_id", ctx.orgId).in("flock_id", ids).is("voided_at", null).gte("record_date", prior.previousFrom).lte("record_date", input.dateTo).order("record_date").order("id")),
        all(() => db.from("weight_records").select("id,flock_id,record_date,average_weight_g").eq("org_id", ctx.orgId).in("flock_id", ids).gte("record_date", prior.previousFrom).lte("record_date", input.dateTo).order("record_date").order("id")),
        all(() => db.from("effective_cycle_clearances").select("flock_id,closure_id").eq("org_id", ctx.orgId).order("flock_id")),
        all(() => db.from("batch_cycle_closures").select("id,completed_at").eq("org_id", ctx.orgId).order("id")),
      ]);
      const ends = new Map(cycleClosures.map(row => [row.id, reportOperatingDate(String(row.completed_at))]));
      const completed = new Map(clearances.map(row => [row.flock_id, ends.get(row.closure_id)]));
      const eligible = (row: EvidenceRow) => (!completed.get(row.flock_id) || String(row.record_date) <= completed.get(row.flock_id)!) && reportRowInLocations(row, scope.selectedLocations);
      const locatedSessions = sessions.map((row): EvidenceRow => ({...row, recorded_time: row.session_time})).filter(eligible);
      if (scope.stores && locatedSessions.some(row => row.warehouse_id && !scope.stores!.includes(String(row.warehouse_id)))) throw new PerformanceError("REPORT_SHARED_STORE_DENIED", 403);
      capture(reportResources(scope.scope.farmIds, locatedSessions.filter(row => row.warehouse_id)));
      return projectFeedingPerformance(input, {sessions: locatedSessions, closures: closures.filter(eligible), daily: daily.filter(eligible), weights: weights.filter(eligible), flocks: scope.flocks.filter(row => ids.includes(String(row.id))), ambiguousMovementDays: locatedSessions.length !== sessions.length || closures.filter(eligible).length !== closures.length}, operations);
    },
    salesCosts: async () => {
      const salesContext = {userId: ctx.userId, orgId: ctx.orgId, role: ctx.role, canView: true, canMutate: false, allowedFarmIds: scope.assigned, supportSessionId: ctx.supportSessionId};
      const [current, previous, expenses, previousExpenses] = await Promise.all([
        loadSalesAnalytics(salesContext, performanceParams(input), capture).then(responseData<SalesPerformanceData>),
        loadSalesAnalytics(salesContext, performanceParams(previousInput), capture).then(responseData<SalesPerformanceData>),
        loadReportEvidence(ctx, "finance", input, capture), loadReportEvidence(ctx, "finance", previousInput, capture),
      ]);
      return projectSalesPerformance(input, current, previous, expenses, previousExpenses);
    },
  });
  result.options = {warehouses: scope.availableWarehouses.map(row => ({id: row.id, name: row.name}))};
  result.meta.generatedAt = new Date(asOf).toISOString();
  const resources = reportResources(input.farmId ? [input.farmId] : captured.flatMap(row => row.farm_ids), captured.flatMap(row => row.warehouse_ids.map(warehouse_id => ({warehouse_id}))));
  resources.complete = captured.every(row => row.complete);
  captureResources?.(resources);
  return result;
}
