import "server-only";

import { z } from "zod";

import { type AccessContext, governanceAdmin } from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";
import {effectiveWarehouseIds} from "@/lib/warehouse-access";

const warehouseTypes = ["farm_store", "pharmacy", "equipment_store", "central_warehouse"] as const;

const warehouseSetupSchema = z.object({
  name: z.string().trim().min(2, "Enter a warehouse name.").max(100),
  branchId: z.string().uuid("Select a branch."),
  farmId: z.string().uuid().nullable().optional(),
  type: z.enum(warehouseTypes),
  managerId: z.string().uuid().nullable().optional(),
});

export type WarehouseSetupInput = z.infer<typeof warehouseSetupSchema>;

export class WarehouseManagementError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function activeAssignment(row: { starts_at: string; expires_at: string | null; revoked_at: string | null }, now: number) {
  return !row.revoked_at && Date.parse(row.starts_at) <= now && (!row.expires_at || Date.parse(row.expires_at) > now);
}

export async function listInventoryWarehouses(ctx: AccessContext) {
  let allowedIds: string[] | null = null;
  if (ctx.role === "farm_manager") {
    allowedIds = await effectiveWarehouseIds(ctx);
  }

  let warehouseQuery = governanceAdmin
    .from("warehouses")
    .select("id,org_id,branch_id,farm_id,name,type,status,created_at,updated_at")
    .eq("org_id", ctx.orgId)
    .order("name");
  if (ctx.role === "farm_manager") {
    if (!allowedIds?.length) return { warehouses: [], branches: [], farms: [], managers: [] };
    warehouseQuery = warehouseQuery.in("id", allowedIds).eq("status", "active");
  }

  const managerQuery = governanceAdmin.from("profiles").select("id,full_name").eq("org_id", ctx.orgId).eq("role", "farm_manager").eq("is_active", true);
  const assignmentQuery = governanceAdmin.from("user_warehouse_access").select("warehouse_id,profile_id,starts_at,expires_at,revoked_at").eq("org_id", ctx.orgId);
  const farmAssignmentQuery = governanceAdmin.from("user_farm_access").select("farm_id,profile_id,starts_at,expires_at,revoked_at").eq("org_id", ctx.orgId);
  if (ctx.role === "farm_manager") {
    managerQuery.eq("id", ctx.userId);
    assignmentQuery.eq("profile_id", ctx.userId);
    farmAssignmentQuery.eq("profile_id", ctx.userId);
  }
  const [warehousesResult, branchesResult, farmsResult, managersResult, assignmentsResult, farmAssignmentsResult] = await Promise.all([
    warehouseQuery,
    governanceAdmin.from("branches").select("id,name").eq("org_id", ctx.orgId).order("name"),
    governanceAdmin.from("farms").select("id,branch_id,name").eq("org_id", ctx.orgId).order("name"),
    managerQuery.order("full_name"),
    assignmentQuery,
    farmAssignmentQuery,
  ]);
  const failure = [warehousesResult, branchesResult, farmsResult, managersResult, assignmentsResult, farmAssignmentsResult].find((result) => result.error)?.error;
  if (failure) throw new WarehouseManagementError(failure.message, 500);

  const branchNames = new Map((branchesResult.data ?? []).map((row) => [row.id, row.name]));
  const farmNames = new Map((farmsResult.data ?? []).map((row) => [row.id, row.name]));
  const managerNames = new Map((managersResult.data ?? []).map((row) => [row.id, row.full_name || "Farm manager"]));
  const now = Date.now();
  const assignmentsByWarehouse = new Map<string, string[]>();
  for (const assignment of assignmentsResult.data ?? []) {
    if (!activeAssignment(assignment, now)) continue;
    const names = assignmentsByWarehouse.get(assignment.warehouse_id) ?? [];
    const name = managerNames.get(assignment.profile_id);
    if (name) names.push(name);
    assignmentsByWarehouse.set(assignment.warehouse_id, names);
  }

  return {
    warehouses: (warehousesResult.data ?? []).map((row) => ({
      ...row,
      branch_name: branchNames.get(row.branch_id) ?? "Unknown branch",
      farm_name: row.farm_id ? farmNames.get(row.farm_id) ?? "Unknown farm" : null,
      access_source: row.farm_id ? "farm_assignment" as const : "warehouse_assignment" as const,
      manager_names: row.farm_id
        ? (farmAssignmentsResult.data ?? []).filter(assignment => assignment.farm_id === row.farm_id && activeAssignment(assignment, now)).map(assignment => managerNames.get(assignment.profile_id)).filter((name): name is string => Boolean(name))
        : assignmentsByWarehouse.get(row.id) ?? [],
    })),
    branches: branchesResult.data ?? [],
    farms: farmsResult.data ?? [],
    managers: ctx.role === "farm_manager" ? [] : managersResult.data ?? [],
  };
}

export async function createInventoryWarehouse(ctx: AccessContext, input: unknown) {
  if (ctx.role !== "ceo" && !ctx.supportSessionId) {
    throw new WarehouseManagementError("Only the CEO can create a warehouse.", 403);
  }
  const parsed = warehouseSetupSchema.safeParse(input);
  if (!parsed.success) throw new WarehouseManagementError(parsed.error.issues[0]?.message ?? "Invalid warehouse setup.");
  const values = parsed.data;
  if (values.farmId && values.managerId) throw new WarehouseManagementError("Farm stores inherit their Farm Manager. Assign or replace the manager from Access & Users.", 400);

  const { data: branch } = await governanceAdmin.from("branches").select("id").eq("id", values.branchId).eq("org_id", ctx.orgId).maybeSingle();
  if (!branch) throw new WarehouseManagementError("The selected branch is outside this organization.");
  if (values.farmId) {
    const { data: farm } = await governanceAdmin.from("farms").select("id").eq("id", values.farmId).eq("branch_id", values.branchId).eq("org_id", ctx.orgId).maybeSingle();
    if (!farm) throw new WarehouseManagementError("The selected farm does not belong to this branch.");
  }
  if (values.managerId) {
    const { data: manager } = await governanceAdmin.from("profiles").select("id").eq("id", values.managerId).eq("org_id", ctx.orgId).eq("role", "farm_manager").eq("is_active", true).maybeSingle();
    if (!manager) throw new WarehouseManagementError("Select an active Farm Manager from this organization.");
  }

  const { data: warehouse, error } = await governanceAdmin.from("warehouses").insert({
    org_id: ctx.orgId,
    branch_id: values.branchId,
    farm_id: values.farmId ?? null,
    name: values.name,
    type: values.type,
    status: "active",
  }).select("id,org_id,branch_id,farm_id,name,type,status,created_at,updated_at").single();
  if (error) {
    if (error.code === "23505") throw new WarehouseManagementError("A warehouse with this name already exists in the selected branch.", 409);
    throw new WarehouseManagementError(error.message);
  }

  await recordAuditEvent(ctx,{eventType:"warehouse.created",operation:"insert",entityTable:"warehouses",entityId:String(warehouse.id),reason:"Created an inventory warehouse.",after:warehouse,farmId:warehouse.farm_id,warehouseId:String(warehouse.id),metadata:{requested_manager_id:values.managerId??null}});

  let assignment = null;
  let warning: string | null = null;
  if (values.managerId) {
    const assignmentResult = await governanceAdmin.from("user_warehouse_access").upsert({
      org_id: ctx.orgId,
      profile_id: values.managerId,
      warehouse_id: warehouse.id,
      starts_at: new Date().toISOString(),
      expires_at: null,
      revoked_at: null,
      revoked_by: null,
      revocation_reason: null,
      granted_by: ctx.userId,
    }, { onConflict: "profile_id,warehouse_id" }).select("*").single();
    if (assignmentResult.error) {
      warning = "Warehouse created, but its Farm Manager assignment could not be completed. Assign it from Governance before posting stock.";
      await recordAuditEvent(ctx,{eventType:"assignment.warehouse.failed",operation:"access",entityTable:"warehouses",entityId:String(warehouse.id),reason:assignmentResult.error.message,farmId:warehouse.farm_id,warehouseId:String(warehouse.id)});
    } else {
      assignment = assignmentResult.data;
      await recordAuditEvent(ctx,{eventType:"assignment.warehouse.granted",operation:"access",entityTable:"user_warehouse_access",entityId:String(assignment.id),reason:"Granted warehouse assignment during setup.",after:assignment,farmId:warehouse.farm_id,warehouseId:String(warehouse.id)});
    }
  }
  return { warehouse, assignment, warning };
}
