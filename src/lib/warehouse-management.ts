import "server-only";

import { z } from "zod";

import { type AccessContext, governanceAdmin } from "@/lib/access-context";

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
  const nowIso = new Date().toISOString();
  let allowedIds: string[] | null = null;
  if (ctx.role === "farm_manager") {
    const { data, error } = await governanceAdmin
      .from("user_warehouse_access")
      .select("warehouse_id")
      .eq("org_id", ctx.orgId)
      .eq("profile_id", ctx.userId)
      .is("revoked_at", null)
      .lte("starts_at", nowIso)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    if (error) throw new WarehouseManagementError(error.message, 500);
    allowedIds = (data ?? []).map((row) => String(row.warehouse_id));
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
  if (ctx.role === "farm_manager") {
    managerQuery.eq("id", ctx.userId);
    assignmentQuery.eq("profile_id", ctx.userId);
  }
  const [warehousesResult, branchesResult, farmsResult, managersResult, assignmentsResult] = await Promise.all([
    warehouseQuery,
    governanceAdmin.from("branches").select("id,name").eq("org_id", ctx.orgId).order("name"),
    governanceAdmin.from("farms").select("id,branch_id,name").eq("org_id", ctx.orgId).order("name"),
    managerQuery.order("full_name"),
    assignmentQuery,
  ]);
  const failure = [warehousesResult, branchesResult, farmsResult, managersResult, assignmentsResult].find((result) => result.error)?.error;
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
      manager_names: assignmentsByWarehouse.get(row.id) ?? [],
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

  await governanceAdmin.from("governance_audit_events").insert({
    org_id: ctx.orgId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    support_session_id: ctx.supportSessionId,
    event_type: "warehouse.created",
    entity_table: "warehouses",
    entity_id: warehouse.id,
    after_values: warehouse,
    metadata: { requested_manager_id: values.managerId ?? null },
  });

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
      await governanceAdmin.from("governance_audit_events").insert({ org_id: ctx.orgId, actor_id: ctx.userId, actor_role: ctx.role, support_session_id: ctx.supportSessionId, event_type: "assignment.warehouse.failed", entity_table: "warehouses", entity_id: warehouse.id, reason: assignmentResult.error.message });
    } else {
      assignment = assignmentResult.data;
      await governanceAdmin.from("governance_audit_events").insert({ org_id: ctx.orgId, actor_id: ctx.userId, actor_role: ctx.role, support_session_id: ctx.supportSessionId, event_type: "assignment.warehouse.granted", entity_table: "user_warehouse_access", entity_id: assignment.id, after_values: assignment });
    }
  }
  return { warehouse, assignment, warning };
}
