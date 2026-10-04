import "server-only";

import {canAccessFarm, governanceAdmin, type AccessContext} from "@/lib/access-context";

import type {TodayTaskCode, TodayTaskDetail} from "./contracts";
import {TodayWorkspaceError} from "./workspace";
import {isTodayWarehouseEligible} from "./warehouse-choices";

type Row = Record<string, unknown>;

const flockTasks = new Set<TodayTaskCode>(["birds", "feeding", "eggs_water", "health_deaths", "routine_supplies"]);
const supportedTasks = new Set<TodayTaskCode>(["birds", "feeding", "eggs_water", "health_deaths", "routine_supplies", "stock", "sales", "expenses", "assigned_fixes", "review_finish"]);

function rows(result: {data: unknown[] | null; error: {message: string} | null}, label: string) {
  if (result.error) throw new TodayWorkspaceError("INTERNAL_ERROR", `${label}: ${result.error.message}`, 500);
  return (result.data ?? []) as Row[];
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function resourceRevision(resourceType: "daily_record" | "feed_day" | "operating_day", resourceId: string, workDate?: string) {
  const revisionClient = governanceAdmin as unknown as {
    rpc(name: "today_resource_revision", args: {p_resource_type: string; p_resource_id: string; p_work_date: string | null}): Promise<{data: unknown; error: {message: string} | null}>;
  };
  const result = await revisionClient.rpc("today_resource_revision", {
    p_resource_type: resourceType,
    p_resource_id: resourceId,
    p_work_date: workDate ?? null,
  });
  if (result.error) throw new TodayWorkspaceError("INTERNAL_ERROR", `Resource revision: ${result.error.message}`, 500);
  return String(result.data);
}

async function assignedWarehouses(context: AccessContext, farmId: string, task: TodayTaskCode) {
  const farmResult = await governanceAdmin.from("farms").select("branch_id").eq("org_id", context.orgId).eq("id", farmId).maybeSingle();
  if (farmResult.error) throw new TodayWorkspaceError("INTERNAL_ERROR", farmResult.error.message, 500);
  if (!farmResult.data) throw new TodayWorkspaceError("SOURCE_NOT_FOUND", "The selected farm is unavailable.", 404);
  const branchId = farmResult.data.branch_id ? String(farmResult.data.branch_id) : null;
  const assignedIds = new Set<string>();
  if (task !== "feeding") {
    const now = new Date().toISOString();
    const access = await governanceAdmin.from("user_warehouse_access")
      .select("warehouse_id").eq("org_id", context.orgId).eq("profile_id", context.userId)
      .is("revoked_at", null).lte("starts_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`);
    for (const assignment of rows(access, "Warehouse assignments")) assignedIds.add(String(assignment.warehouse_id));
    if (!assignedIds.size) return [];
  }
  const result = await governanceAdmin.from("warehouses")
    .select("id,name,farm_id,branch_id,type")
    .eq("org_id", context.orgId)
    .eq("status", "active")
    .or(`farm_id.eq.${farmId},farm_id.is.null`)
    .order("name");
  return rows(result, "Warehouses").filter((warehouse) => isTodayWarehouseEligible(task, farmId, branchId, {
    id: String(warehouse.id),
    farmId: warehouse.farm_id ? String(warehouse.farm_id) : null,
    branchId: warehouse.branch_id ? String(warehouse.branch_id) : null,
  }, assignedIds));
}

async function inventoryOptions(context: AccessContext, warehouses: Row[]) {
  const warehouseIds = warehouses.map((row) => String(row.id));
  const [itemsResult, ledgerResult] = await Promise.all([
    governanceAdmin.from("inventory_items").select("id,name,category,unit,unit_cost,reorder_level").eq("org_id", context.orgId).order("name"),
    warehouseIds.length
      ? governanceAdmin.from("stock_ledger").select("item_id,warehouse_id,quantity,transaction_type").eq("org_id", context.orgId).in("warehouse_id", warehouseIds)
      : Promise.resolve({data: [] as Row[], error: null}),
  ]);
  const items = rows(itemsResult, "Inventory items");
  const ledger = rows(ledgerResult, "Inventory balance");
  return items.map((item) => ({
    id: String(item.id),
    name: String(item.name),
    category: String(item.category),
    unit: String(item.unit),
    unitCost: number(item.unit_cost),
    reorderLevel: number(item.reorder_level),
    balances: warehouses.map((warehouse) => ({
      warehouseId: String(warehouse.id),
      quantity: ledger.filter((movement) => movement.item_id === item.id && movement.warehouse_id === warehouse.id).reduce((total, movement) => {
        const quantity = number(movement.quantity);
        if (["issue", "transfer_out"].includes(String(movement.transaction_type))) return total - Math.abs(quantity);
        if (String(movement.transaction_type) === "adjustment") return total + quantity;
        return total + Math.abs(quantity);
      }, 0),
    })),
  }));
}

export async function loadTodayTaskDetail(
  context: AccessContext,
  input: {task: string; farmId: string; flockId?: string; workDate: string},
): Promise<TodayTaskDetail> {
  if (context.role !== "farm_manager" && !context.supportSessionId) throw new TodayWorkspaceError("ROLE_NOT_ALLOWED", "Today is for Farm Managers.", 403);
  if (!supportedTasks.has(input.task as TodayTaskCode) || !/^\d{4}-\d{2}-\d{2}$/.test(input.workDate)) throw new TodayWorkspaceError("INVALID_PAYLOAD", "Choose a valid Today task and date.", 400);
  const task = input.task as TodayTaskCode;
  const organization = await governanceAdmin.from("organizations").select("today_workspace_enabled").eq("id", context.orgId).maybeSingle();
  if (organization.error) throw new TodayWorkspaceError("INTERNAL_ERROR", organization.error.message, 500);
  if (!organization.data?.today_workspace_enabled) throw new TodayWorkspaceError("FEATURE_DISABLED", "Today is not enabled for this organization.", 403);
  if (!(await canAccessFarm(context, input.farmId))) throw new TodayWorkspaceError("ASSIGNMENT_REQUIRED", "An active farm assignment is required.", 403);
  if (flockTasks.has(task) && !input.flockId) throw new TodayWorkspaceError("INVALID_PAYLOAD", "Choose a flock first.", 400);

  let flock: Row | null = null;
  if (input.flockId) {
    const result = await governanceAdmin.from("flocks")
      .select("id,flock_code,flock_type,batch_id,house_id,farm_id")
      .eq("id", input.flockId).eq("org_id", context.orgId).eq("farm_id", input.farmId).maybeSingle();
    if (result.error) throw new TodayWorkspaceError("INTERNAL_ERROR", result.error.message, 500);
    if (!result.data) throw new TodayWorkspaceError("SOURCE_NOT_FOUND", "The selected flock is unavailable.", 404);
    flock = result.data as Row;
  }

  const warehouses = await assignedWarehouses(context, input.farmId, task);
  const inventory = await inventoryOptions(context, warehouses);
  const correctionBase = `/app/today?farm_id=${input.farmId}&date=${input.workDate}${input.flockId ? `&flock_id=${input.flockId}` : ""}`;
  const base = {
    task,
    farmId: input.farmId,
    flockId: input.flockId ?? null,
    workDate: input.workDate,
    warehouses: warehouses.map((row) => ({id: String(row.id), name: String(row.name)})),
    inventory,
    correctionDestination: `${correctionBase}&task=${task}`,
    dependencies: [],
  };

  if (task === "feeding") {
    const [sessionsResult, closureResult, scheduleResult] = await Promise.all([
      governanceAdmin.from("feeding_session_records").select("id,session_name,session_time,feeders_count,planned_feed_kg,actual_feed_kg,notes,feed_item_id,warehouse_id,feed_type,status").eq("org_id", context.orgId).eq("flock_id", input.flockId!).eq("record_date", input.workDate).is("voided_at", null).order("session_time"),
      governanceAdmin.from("feed_day_closures").select("id,status,updated_at").eq("org_id", context.orgId).eq("flock_id", input.flockId!).eq("record_date", input.workDate).maybeSingle(),
      governanceAdmin.from("feeding_schedules").select("feed_type").eq("org_id", context.orgId).eq("batch_id", String(flock!.batch_id)).eq("schedule_date", input.workDate).maybeSingle(),
    ]);
    if (closureResult.error || scheduleResult.error) throw new TodayWorkspaceError("INTERNAL_ERROR", closureResult.error?.message ?? scheduleResult.error!.message, 500);
    const sessions = rows(sessionsResult, "Feed sessions");
    return {...base, task, resourceRevision: await resourceRevision("feed_day", input.flockId!, input.workDate), data: {
      closed: closureResult.data?.status === "closed",
      sessions,
      scheduledFeedType: scheduleResult.data?.feed_type ?? "layer_feed",
    }};
  }

  if (["birds", "eggs_water", "routine_supplies"].includes(task)) {
    const dailyResult = await governanceAdmin.from("daily_farm_records")
      .select("id,opening_birds,closing_birds,deaths,culls,transfers_in,transfers_out,other_removals,normal_eggs,broken_eggs,dirty_eggs,total_eggs,average_egg_weight_g,water_consumed_liters,updated_at")
      .eq("org_id", context.orgId).eq("flock_id", input.flockId!).eq("record_date", input.workDate).is("voided_at", null).maybeSingle();
    if (dailyResult.error) throw new TodayWorkspaceError("INTERNAL_ERROR", dailyResult.error.message, 500);
    return {...base, task, resourceRevision: dailyResult.data?.id ? await resourceRevision("daily_record", String(dailyResult.data.id)) : undefined, data: {dailyRecord: dailyResult.data, flockType: String(flock!.flock_type)}};
  }

  if (task === "stock") {
    const warehouseIds = warehouses.map((row) => String(row.id));
    const monthStart = `${input.workDate.slice(0, 7)}-01`;
    const nextMonth = new Date(`${monthStart}T00:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const sessionsResult = warehouseIds.length
      ? await governanceAdmin.from("inventory_count_sessions")
        .select("id,warehouse_id,count_month,counted_on,status,notes")
        .eq("org_id", context.orgId)
        .in("warehouse_id", warehouseIds)
        .gte("counted_on", monthStart)
        .lt("counted_on", nextMonth.toISOString().slice(0, 10))
        .order("counted_on", {ascending: false})
      : {data: [] as Row[], error: null};
    const sessions = rows(sessionsResult, "Stock count sessions");
    const countedWarehouses = new Set(sessions.map((row) => String(row.warehouse_id)));
    return {...base, task, data: {
      countSessions: sessions,
      countDueWarehouseIds: warehouseIds.filter((id) => !countedWarehouses.has(id)),
    }};
  }

  if (task === "health_deaths") {
    const [mortalityResult, healthResult, vaccinationResult] = await Promise.all([
      governanceAdmin.from("mortality_events").select("id,count,cause,recorded_time,diagnosis,notes").eq("org_id", context.orgId).eq("flock_id", input.flockId!).eq("record_date", input.workDate),
      governanceAdmin.from("health_events").select("id,event_type,description,diagnosis,treatment").eq("org_id", context.orgId).eq("flock_id", input.flockId!).eq("event_date", input.workDate).is("voided_at", null),
      governanceAdmin.from("vaccination_events").select("id,event_date,vaccine_name,dosage,route,batch_number").eq("org_id", context.orgId).eq("flock_id", input.flockId!).eq("event_date", input.workDate),
    ]);
    return {...base, task, data: {mortality: rows(mortalityResult, "Mortality"), health: rows(healthResult, "Health"), vaccinations: rows(vaccinationResult, "Vaccinations")}};
  }

  if (task === "assigned_fixes") {
    const result = await governanceAdmin.from("operational_actions")
      .select("id,title,context,status,severity,due_at,source_route,source_resolved_at")
      .eq("org_id", context.orgId).eq("owner_id", context.userId).eq("farm_id", input.farmId).not("status", "in", "(resolved)").order("due_at");
    return {...base, task, data: {actions: rows(result, "Assigned fixes")}};
  }

  if (task === "review_finish") {
    const day = await governanceAdmin.from("farm_operating_days")
      .select("status,closed_at")
      .eq("org_id", context.orgId)
      .eq("farm_id", input.farmId)
      .eq("operating_date", input.workDate)
      .maybeSingle();
    if (day.error) throw new TodayWorkspaceError("INTERNAL_ERROR", day.error.message, 500);
    return {
      ...base,
      task,
      resourceRevision: await resourceRevision("operating_day", input.farmId, input.workDate),
      data: {status: day.data?.status ?? "open", closedAt: day.data?.closed_at ?? null},
    };
  }

  return {...base, task, data: {}};
}
