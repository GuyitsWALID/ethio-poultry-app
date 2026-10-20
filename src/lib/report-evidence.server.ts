import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {governanceAdmin, type AccessContext} from "@/lib/access-context";
import {reportRequest, type ReportInput} from "@/lib/report-workspace";
import {projectReportEvidence, readAllEvidence, selectEvidenceScope, ReportEvidenceError} from "@/lib/report-evidence";
import {effectiveWarehouseIds} from "@/lib/warehouse-access";
import {projectLocationFlocks, reportRowInLocations, selectReportLocations, type ReportLocation} from "@/lib/report-locations";
import {reportResources, type ReportResources} from "@/lib/report-snapshot";

export async function loadReportEvidence(ctx: AccessContext, section: "health" | "finance", input: ReportInput, captureResources?: (resources: ReportResources) => void) {
  if (!ctx.supportSessionId && ctx.role !== "ceo" && ctx.role !== "farm_manager") throw new ReportEvidenceError("REPORT_SCOPE_DENIED", 403);
  reportRequest(section, input);
  for (const value of [input.branchId, input.farmId, input.houseId, input.flockId, input.batchId]) if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ReportEvidenceError("INVALID_REPORT_SCOPE");
  const db = governanceAdmin as any;
  const all = (make: () => any) => readAllEvidence(async (start, end) => {
    const {data, error} = await make().range(start, end);
    if (error) throw new ReportEvidenceError("REPORT_LOAD_FAILED", 500);
    return data ?? [];
  });
  const restricted = ctx.role === "farm_manager" && !ctx.supportSessionId;
  let assigned: string[] | null = null;
  if (restricted) {
    const now = new Date().toISOString();
    const assignments = await all(() => db.from("user_farm_access").select("id,farm_id").eq("org_id", ctx.orgId).eq("profile_id", ctx.userId).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).order("id"));
    assigned = assignments.map(row => String(row.farm_id));
  }
  const farms = assigned?.length === 0 ? [] : await all(() => {
    let query = db.from("farms").select("id,org_id,branch_id,name").eq("org_id", ctx.orgId).order("id");
    if (assigned) query = query.in("id", assigned);
    return query;
  });
  const flocks = !farms.length ? [] : await all(() => db.from("flocks").select("id,org_id,farm_id,house_id,batch_id,flock_code").eq("org_id", ctx.orgId).order("id"));
  const locations = !farms.length ? [] : await all(() => db.rpc("report_flock_locations",{p_org:ctx.orgId}).order("flock_id").order("from_at").order("house_id")) as ReportLocation[];
  const selectedLocations = selectReportLocations(locations,flocks,farms,input);
  const [houses, batches, branches] = await Promise.all([
    input.houseId && farms.length ? all(() => db.from("houses").select("id,org_id,farm_id").eq("org_id", ctx.orgId).in("farm_id", farms.map(row => row.id)).order("id")) : Promise.resolve(undefined),
    input.batchId && farms.length ? all(() => db.from("batches").select("id,org_id,farm_id,house_id").eq("org_id", ctx.orgId).order("id")) : Promise.resolve(undefined),
    input.branchId && !restricted ? all(() => db.from("branches").select("id,org_id").eq("org_id", ctx.orgId).order("id")) : Promise.resolve(undefined),
  ]);
  const scope = selectEvidenceScope(ctx.orgId, restricted, farms, projectLocationFlocks(flocks,selectReportLocations(locations.filter(row=>row.verified),flocks,farms,{})), input, {houses, batches, branches});
  scope.warehouseIds = restricted ? new Set(await effectiveWarehouseIds(ctx)) : null;
  if (section === "health") {
    if (!scope.flockIds.length) return projectReportEvidence(section, input, scope, {});
    const events = await all(() => db.from("health_events").select("id,org_id,flock_id,event_date,event_type,description,diagnosis,treatment,voided_at").eq("org_id", ctx.orgId).in("flock_id", scope.flockIds).is("voided_at", null).gte("event_date", input.dateFrom).lte("event_date", input.dateTo).order("event_date", {ascending: false}).order("id"));
    const vaccinations = await all(() => db.from("vaccination_events").select("id,org_id,flock_id,vaccine_name,voided_at").eq("org_id", ctx.orgId).in("flock_id", scope.flockIds).is("voided_at", null).order("id"));
    return projectReportEvidence(section, input, scope, {events:events.filter(row=>reportRowInLocations(row,selectedLocations,"event_date")), vaccinations});
  }
  if (scope.restricted && !scope.farmIds.length) return projectReportEvidence(section, input, scope, {});
  const filter = (query: any) => {
    if (scope.restricted) query = query.in("farm_id", scope.farmIds);
    for (const [column, value] of [["branch_id", input.branchId], ["house_id", input.houseId], ["flock_id", input.flockId], ["batch_id", input.batchId]]) if (value) query = query.eq(column, value);
    return query;
  };
  const [expenses, periods] = await Promise.all([
    all(() => filter(db.from("cost_entries").select("id,org_id,branch_id,farm_id,house_id,flock_id,batch_id,warehouse_id,entry_date,category,description,amount").eq("org_id", ctx.orgId).gte("entry_date", input.dateFrom).lte("entry_date", input.dateTo)).order("entry_date", {ascending: false}).order("id")),
    all(() => filter(db.from("monthly_cost_periods").select("id,org_id,branch_id,farm_id,house_id,flock_id,batch_id,period_start,period_end,status,total_absorbed_cost,unallocated_cost,reconciliation_warnings").eq("org_id", ctx.orgId).gte("period_end", input.dateFrom).lte("period_start", input.dateTo)).order("period_start", {ascending: false}).order("id")),
  ]);
  const evidence = projectReportEvidence(section, input, scope, {expenses, periods});
  const ids = new Set(evidence.items.filter(row => row.kind === "expense").map(row => row.sourceId));
  captureResources?.(reportResources(scope.farmIds, expenses.filter(row => ids.has(String(row.id)) && row.warehouse_id)));
  return evidence;
}
