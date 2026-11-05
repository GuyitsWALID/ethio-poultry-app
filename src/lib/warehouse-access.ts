import "server-only";

import {governanceAdmin, type AccessContext} from "./access-context";
import {createHash} from "node:crypto";

export type EffectiveWarehouse = {
  id: string; name: string; farm_id: string | null; branch_id: string;
  access_source: "farm_assignment" | "warehouse_assignment";
};

// The database is the authority for both lists and mutation checks. These RPCs
// are service-only; callers supply an actor only after verifying tenant/role.
function accessRpc() {
  return governanceAdmin as unknown as {rpc(name: string, args: Record<string, string>): Promise<{data: unknown; error: {message: string} | null}>};
}

export async function managerWarehouseAccess(actorId: string, orgId: string): Promise<EffectiveWarehouse[]> {
  const result = await accessRpc().rpc("manager_warehouse_access_scope", {p_actor_id: actorId, p_org_id: orgId});
  if (result.error) throw new Error(`Warehouse access could not be refreshed: ${result.error.message}`);
  return (result.data ?? []) as EffectiveWarehouse[];
}

export async function managerHasWarehouseAccess(actorId: string, warehouseId: string): Promise<boolean> {
  const result = await accessRpc().rpc("manager_has_effective_warehouse_access", {p_actor_id: actorId, p_warehouse_id: warehouseId});
  if (result.error) throw new Error(`Warehouse access could not be refreshed: ${result.error.message}`);
  return result.data === true;
}

export async function effectiveWarehouseIds(ctx: AccessContext): Promise<string[]> {
  return (await managerWarehouseAccess(ctx.userId, ctx.orgId)).map(row => row.id);
}

// Compatibility adapter for callers that combine scope readers in Promise.all.
export async function warehouseAssignmentScope(ctx: AccessContext) {
  return {data: (await effectiveWarehouseIds(ctx)).map(warehouse_id => ({warehouse_id}))};
}

export async function loadManagerAccessSnapshot(ctx:AccessContext) {
  const now=new Date().toISOString();
  const [warehouses,farms]=await Promise.all([
    managerWarehouseAccess(ctx.userId,ctx.orgId),
    governanceAdmin.from("user_farm_access").select("farm_id,starts_at,expires_at").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`).order("farm_id"),
  ]);
  if(farms.error)throw new Error("Farm access could not be refreshed.");
  return {warehouses,farms:farms.data??[],revision:createHash("sha256").update(JSON.stringify({warehouses,farms:farms.data??[]})).digest("hex")};
}
