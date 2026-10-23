import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {governanceAdmin, type AccessContext} from "@/lib/access-context";
import {readReportQuery} from "@/lib/report-pagination";
import {performancePeriod} from "@/lib/farm-performance";
import type {ReportInput} from "@/lib/report-workspace";
import type {EvidenceRow} from "@/lib/report-evidence";
import {reportTimestampBounds} from "@/lib/report-safety";
import {effectiveWarehouseIds} from "@/lib/warehouse-access";
import {selectEvidenceScope, ReportEvidenceError} from "@/lib/report-evidence";
import {projectLocationFlocks, selectReportLocations, type ReportLocation} from "@/lib/report-locations";

type Actor = Pick<AccessContext, "orgId" | "userId" | "role"> & {supportSessionId?: string | null};
const sources = {
  farms: "id,org_id,name,branch_id",
  houses: "id,org_id,name,farm_id",
  flocks: "id,org_id,flock_code,flock_type,farm_id,house_id,batch_id,current_count,status,placement_date,age_at_placement_days,breed_id",
  batches: "id,org_id,farm_id,house_id,batch_code,total_count,purchase_cost_per_bird,transport_cost,other_cost,total_batch_cost",
  warehouses: "id,org_id,name,farm_id,branch_id,status",
  inventory_items: "id,name,category,unit,unit_cost,reorder_level",
  effective_cycle_clearances: "flock_id,closure_id",
  batch_cycle_closures: "id,completed_at",
  daily_farm_records: "id,record_date,flock_id,opening_birds,closing_birds,deaths,culls,deaths_cause,total_eggs,normal_eggs,broken_eggs,dirty_eggs,feed_intake_grams,feed_type,feed_leftover_grams,average_egg_weight_g,water_consumed_liters,updated_at",
  weight_records: "id,flock_id,record_date,average_weight_g,uniformity_pct",
  stock_ledger: "id,item_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,warehouse_id",
  daily_sales_records: "*",
  cost_entries: "id,org_id,branch_id,farm_id,house_id,flock_id,batch_id,warehouse_id,entry_date,category,description,amount",
  monthly_cost_periods: "*",
  health_events: "id,org_id,flock_id,event_date,event_type,description,diagnosis,treatment,voided_at",
  vaccination_events: "id,org_id,flock_id,vaccine_name,voided_at",
  branches: "id,org_id",
} as const;
type Source = keyof typeof sources | "farmAccess" | "warehouseAccess" | "locations";
const scopeKeys = ["branchId", "farmId", "houseId", "flockId", "batchId"] as const;

/** One report attempt only. Not a cross-request cache or an authorization bypass.
 * Privileged source rows stay server-side; canonical domain readers still apply
 * assignment, historical location, warehouse and task-specific restrictions.
 */
export class ReportReadSession {
  private readonly actor: Actor;
  private readonly scope: ReportInput;
  private readonly pending = new Map<Source, Promise<EvidenceRow[]>>();
  private readonly now = new Date().toISOString();
  readonly from: string;
  readonly to: string;
  constructor(actor: Actor, input: ReportInput) {
    reportTimestampBounds(input.dateFrom, input.dateTo);
    this.actor = {...actor}; this.scope = {...input};
    this.from = performancePeriod(input).previousFrom; this.to = input.dateTo;
  }
  assert(actor: Actor, input: ReportInput) {
    if (actor.orgId !== this.actor.orgId || actor.userId !== this.actor.userId || actor.role !== this.actor.role || (actor.supportSessionId ?? null) !== (this.actor.supportSessionId ?? null)
      || scopeKeys.some(key => (input[key] ?? "") !== (this.scope[key] ?? "")) || input.dateFrom < this.from || input.dateTo > this.to || input.dateFrom > input.dateTo) throw new ReportEvidenceError("REPORT_SCOPE_DENIED", 403);
  }
  rows<T = EvidenceRow>(source: Source): Promise<T[]> {
    let read = this.pending.get(source);
    if (!read) {
      read = this.load(source);
      this.pending.set(source, read);
      // Keep the rejected promise: one failing source must not be retried into a
      // different evidence set while other topics are using this attempt.
    }
    return read as Promise<T[]>;
  }
  private async load(source: Source): Promise<EvidenceRow[]> {
    const db = governanceAdmin as any, ctx = this.actor;
    if (source === "warehouseAccess") {
      if (ctx.role !== "farm_manager" || ctx.supportSessionId) return [];
      return (await effectiveWarehouseIds(ctx as AccessContext)).map(id => ({id}));
    }
    if (source === "farmAccess" && (ctx.role !== "farm_manager" || ctx.supportSessionId)) return [];
    let flockIds: string[] | null = null;
    if (["daily_farm_records", "weight_records", "health_events", "vaccination_events"].includes(source)) {
      const [farms, flocks, locations, assignments, houses, batches] = await Promise.all([
        this.rows("farms"), this.rows("flocks"), this.rows<ReportLocation>("locations"), this.rows("farmAccess"), this.rows("houses"), this.rows("batches"),
      ]);
      const restricted = ctx.role === "farm_manager" && !ctx.supportSessionId;
      const allowed = new Set(assignments.map(row => String(row.farm_id)));
      const permitted = farms.filter(row => !restricted || allowed.has(String(row.id)));
      const authorizedLocations = selectReportLocations(locations.filter(row => row.verified), flocks, permitted, {});
      flockIds = selectEvidenceScope(ctx.orgId, restricted, permitted, projectLocationFlocks(flocks, authorizedLocations), this.scope, {houses, batches}).flockIds;
      if (!flockIds.length) return [];
    }
    return (await readReportQuery<EvidenceRow>(() => {
      if (source === "locations") return db.rpc("report_flock_locations", {p_org: ctx.orgId}).order("flock_id").order("from_at").order("house_id");
      if (source === "farmAccess") return db.from("user_farm_access").select("id,farm_id").eq("org_id", ctx.orgId).eq("profile_id", ctx.userId).is("revoked_at", null).lte("starts_at", this.now).or(`expires_at.is.null,expires_at.gt.${this.now}`).order("id");
      let query = db.from(source).select(sources[source]).eq("org_id", ctx.orgId);
      if (flockIds) query = query.in("flock_id", flockIds);
      if (["daily_farm_records", "daily_sales_records", "health_events", "vaccination_events"].includes(source)) query = query.is("voided_at", null);
      if (source === "daily_farm_records") return query.gte("record_date", this.from).lte("record_date", this.to).order("record_date").order("id");
      if (source === "weight_records") return query.lte("record_date", this.to).order("record_date", {ascending: false}).order("id");
      if (source === "daily_sales_records") return query.gte("sale_date", this.from).lte("sale_date", this.to).order("sale_date").order("id");
      if (source === "cost_entries") return query.gte("entry_date", this.from).lte("entry_date", this.to).order("entry_date").order("id");
      if (source === "monthly_cost_periods") return query.lte("period_start", this.to).gte("period_end", this.from).order("period_start", {ascending: false}).order("id");
      if (source === "health_events") return query.gte("event_date", this.from).lte("event_date", this.to).order("event_date", {ascending: false}).order("id");
      if (source === "stock_ledger") return query.order("transaction_date").order("id");
      if (source === "effective_cycle_clearances") return query.order("flock_id");
      return query.order("id");
    })).data;
  }
}
