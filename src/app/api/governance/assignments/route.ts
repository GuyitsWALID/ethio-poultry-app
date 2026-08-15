import { accessJson, getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";

export async function GET() {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  if (ctx.role !== "ceo") return accessJson({ error: "CEO access is required." }, 403);
  const [farm, warehouse, unassigned] = await Promise.all([
    governanceAdmin.from("user_farm_access").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false }),
    governanceAdmin.from("user_warehouse_access").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false }),
    governanceAdmin.from("warehouses").select("id,name").eq("org_id", ctx.orgId),
  ]);
  const now = Date.now();
  const warehouseManagerIds = new Set((warehouse.data ?? []).filter((row) => !row.revoked_at && (!row.expires_at || Date.parse(row.expires_at) > now) && Date.parse(row.starts_at) <= now).map((row) => row.warehouse_id));
  const withStatus=<T extends {starts_at:string;expires_at:string|null;revoked_at:string|null}>(rows:T[])=>rows.map(row=>({...row,assignment_status:row.revoked_at?"Revoked":Date.parse(row.starts_at)>now?"Scheduled":row.expires_at&&Date.parse(row.expires_at)<=now?"Expired":"Active"}));
  return accessJson({ farmAssignments: withStatus(farm.data ?? []), warehouseAssignments: withStatus(warehouse.data ?? []), unassignedWarehouses: (unassigned.data ?? []).filter((row) => !warehouseManagerIds.has(row.id)) });
}

export async function POST(request: Request) {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  if (ctx.role !== "ceo") return accessJson({ error: "Only the CEO can grant assignments." }, 403);
  const body = await request.json().catch(() => null) as { profile_id?:string;scope_type?:string;scope_id?:string;starts_at?:string;expires_at?:string|null } | null;
  const profileId=String(body?.profile_id??"");const scopeType=String(body?.scope_type??"");const scopeId=String(body?.scope_id??"");const startsAt=body?.starts_at?new Date(body.starts_at).toISOString():new Date().toISOString();const expiresAt=body?.expires_at?new Date(body.expires_at).toISOString():null;
  if(!profileId||!scopeId||!["farm","warehouse"].includes(scopeType)||Number.isNaN(Date.parse(startsAt))||(expiresAt&&Date.parse(expiresAt)<=Date.parse(startsAt)))return accessJson({error:"User, scope, valid start, and optional later expiry are required."},400);
  const {data:manager}=await governanceAdmin.from("profiles").select("id").eq("id",profileId).eq("org_id",ctx.orgId).eq("role","farm_manager").eq("is_active",true).maybeSingle();if(!manager)return accessJson({error:"Assignments can only be granted to an active farm manager."},400);
  const table=scopeType==="farm"?"user_farm_access":"user_warehouse_access";const scopeColumn=scopeType==="farm"?"farm_id":"warehouse_id";
  const {data:scope}=await governanceAdmin.from(scopeType==="farm"?"farms":"warehouses").select("id").eq("id",scopeId).eq("org_id",ctx.orgId).maybeSingle();if(!scope)return accessJson({error:"Scope is outside this organization."},400);
  const {data,error}=await governanceAdmin.from(table).upsert({org_id:ctx.orgId,profile_id:profileId,[scopeColumn]:scopeId,starts_at:startsAt,expires_at:expiresAt,revoked_at:null,revoked_by:null,revocation_reason:null,granted_by:ctx.userId},{onConflict:`profile_id,${scopeColumn}`}).select("*").single();
  if(error)return accessJson({error:error.message},400);await recordAuditEvent(ctx,{eventType:`assignment.${scopeType}.granted`,operation:"access",entityTable:table,entityId:String(data.id),reason:`Granted ${scopeType} assignment.`,after:data,farmId:scopeType==="farm"?scopeId:null,warehouseId:scopeType==="warehouse"?scopeId:null});return accessJson({assignment:data},201);
}

export async function DELETE(request: Request) {
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;if(ctx.role!=="ceo")return accessJson({error:"Only the CEO can revoke assignments."},403);
  const body=await request.json().catch(()=>null) as {scope_type?:string;assignment_id?:string;reason?:string}|null;const scopeType=String(body?.scope_type??"");const id=String(body?.assignment_id??"");const reason=String(body?.reason??"").trim();if(!["farm","warehouse"].includes(scopeType)||!id||reason.length<8)return accessJson({error:"Assignment and a revocation reason of at least eight characters are required."},400);
  const table=scopeType==="farm"?"user_farm_access":"user_warehouse_access";const {data:before}=await governanceAdmin.from(table).select("*").eq("id",id).eq("org_id",ctx.orgId).maybeSingle();if(!before)return accessJson({error:"Assignment not found."},404);if(before.revoked_at)return accessJson({error:"Assignment is already revoked."},409);const {data,error}=await governanceAdmin.from(table).update({revoked_at:new Date().toISOString(),revoked_by:ctx.userId,revocation_reason:reason}).eq("id",id).eq("org_id",ctx.orgId).select("*").single();if(error)return accessJson({error:error.message},400);await recordAuditEvent(ctx,{eventType:`assignment.${scopeType}.revoked`,operation:"access",entityTable:table,entityId:id,reason,before,after:data,farmId:scopeType==="farm"?String(before.farm_id):null,warehouseId:scopeType==="warehouse"?String(before.warehouse_id):null});return accessJson({assignment:data});
}
