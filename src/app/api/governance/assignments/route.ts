import { accessJson, getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";
import {AssignmentError, grantAssignmentSchema, grantFarmAssignment, revokeAssignmentSchema, revokeFarmAssignment} from "@/lib/farm-assignment-management";
import {ZodError} from "zod";

export async function GET() {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  if (ctx.role !== "ceo") return accessJson({ error: "CEO access is required." }, 403);
  const [farm, warehouse, warehouseRows, profiles, branches, farms] = await Promise.all([
    governanceAdmin.from("user_farm_access").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false }),
    governanceAdmin.from("user_warehouse_access").select("*").eq("org_id", ctx.orgId).order("created_at", { ascending: false }),
    governanceAdmin.from("warehouses").select("id,name,status,farm_id").eq("org_id", ctx.orgId).order("name"),
    governanceAdmin.from("profiles").select("id,full_name,phone,role,is_active").eq("org_id",ctx.orgId).order("full_name"),
    governanceAdmin.from("branches").select("id,name").eq("org_id",ctx.orgId).order("name"),
    governanceAdmin.from("farms").select("id,name,branch_id").eq("org_id",ctx.orgId).order("name"),
  ]);
  const failure=[farm,warehouse,warehouseRows,profiles,branches,farms].find(result=>result.error)?.error;
  if(failure)return accessJson({error:failure.message},500);
  const now = Date.now();
  const active=(row:{revoked_at:string|null;starts_at:string;expires_at:string|null})=>!row.revoked_at&&Date.parse(row.starts_at)<=now&&(!row.expires_at||Date.parse(row.expires_at)>now);
  const activeProfiles=new Set((profiles.data??[]).filter(p=>p.role==="farm_manager"&&p.is_active).map(p=>p.id));
  const warehouseManagerIds = new Set((warehouseRows.data??[]).filter(w=>w.status==="active"&&(w.farm_id
    ?(farm.data??[]).some(a=>a.farm_id===w.farm_id&&active(a)&&activeProfiles.has(a.profile_id))
    :(warehouse.data??[]).some(a=>a.warehouse_id===w.id&&active(a)&&activeProfiles.has(a.profile_id)))).map(w=>w.id));
  const withStatus=<T extends {starts_at:string;expires_at:string|null;revoked_at:string|null}>(rows:T[])=>rows.map(row=>({...row,assignment_status:row.revoked_at?"Revoked":Date.parse(row.starts_at)>now?"Scheduled":row.expires_at&&Date.parse(row.expires_at)<=now?"Expired":"Active"}));
  return accessJson({profiles:profiles.data??[],branches:branches.data??[],farms:farms.data??[],warehouses:warehouseRows.data??[],farmAssignments:withStatus(farm.data??[]),warehouseAssignments:withStatus(warehouse.data??[]),unassignedWarehouses:(warehouseRows.data??[]).filter(row=>!warehouseManagerIds.has(row.id))});
}

export async function POST(request: Request) {
  const ctx = await getAccessContext({ tenant: true });
  if (isAccessResponse(ctx)) return ctx;
  if (ctx.role !== "ceo") return accessJson({ error: "Only the CEO can grant assignments." }, 403);
  const parsed=grantAssignmentSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return accessJson({error:"Select a manager, scope and valid assignment dates."},400);
  const input=parsed.data;const profileId=input.profile_id;const scopeType=input.scope_type;const scopeId=input.scope_id;
  const startsAt=input.starts_at??new Date().toISOString();const expiresAt=input.expires_at??null;
  if(expiresAt&&Date.parse(expiresAt)<=Date.parse(startsAt))return accessJson({error:"Expiry must follow the start."},400);
  if(scopeType==="farm"){
    try{return accessJson(await grantFarmAssignment(ctx,input),201);}catch(error){
      if(error instanceof AssignmentError)return accessJson({error:error.message,code:error.code},error.status);
      if(error instanceof ZodError)return accessJson({error:"Invalid assignment."},400);
      return accessJson({error:"Farm access could not be granted."},500);
    }
  }
  const {data:manager}=await governanceAdmin.from("profiles").select("id").eq("id",profileId).eq("org_id",ctx.orgId).eq("role","farm_manager").eq("is_active",true).maybeSingle();if(!manager)return accessJson({error:"Assignments can only be granted to an active farm manager."},400);
  const table="user_warehouse_access";const scopeColumn="warehouse_id";
  let scope:{id:string;name:string;status?:string;farm_id?:string|null}|null=null;
  {
    const result=await governanceAdmin.from("warehouses").select("id,name,status,farm_id").eq("id",scopeId).eq("org_id",ctx.orgId).maybeSingle();
    if(result.error)return accessJson({error:result.error.message},400);
    scope=result.data;
  }
  if(scope?.farm_id)return accessJson({error:"Includes all warehouses belonging to this farm. Assign the farm instead of granting its warehouse separately.",code:"FARM_ASSIGNMENT_REQUIRED"},400);
  if(!scope)return accessJson({error:"Scope is outside this organization."},400);
  if(scopeType==="warehouse"&&scope.status!=="active")return accessJson({error:"Access can only be granted to an active warehouse."},400);
  const {data,error}=await governanceAdmin.from(table).upsert({org_id:ctx.orgId,profile_id:profileId,[scopeColumn]:scopeId,starts_at:startsAt,expires_at:expiresAt,revoked_at:null,revoked_by:null,revocation_reason:null,granted_by:ctx.userId},{onConflict:`profile_id,${scopeColumn}`}).select("*").single();
  if(error)return accessJson({error:error.message},400);await recordAuditEvent(ctx,{eventType:"assignment.warehouse.granted",operation:"access",entityTable:table,entityId:String(data.id),reason:"Granted shared warehouse assignment.",after:data,farmId:null,warehouseId:scopeId});return accessJson({assignment:{...data,assignment_status:Date.parse(startsAt)>Date.now()?"Scheduled":"Active"},scope:{id:scope.id,name:scope.name}},201);
}

export async function DELETE(request: Request) {
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;if(ctx.role!=="ceo")return accessJson({error:"Only the CEO can revoke assignments."},403);
  const parsed=revokeAssignmentSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return accessJson({error:"Assignment and a reason of at least eight characters are required."},400);
  const {scope_type:scopeType,assignment_id:id,reason}=parsed.data;
  if(scopeType==="farm"){
    try{return accessJson(await revokeFarmAssignment(ctx,id,reason));}catch(error){
      return accessJson({error:error instanceof Error?error.message:"Revocation failed.",code:error instanceof AssignmentError?error.code:"INVALID_ASSIGNMENT"},error instanceof AssignmentError?error.status:500);
    }
  }
  const table="user_warehouse_access";const {data:before}=await governanceAdmin.from(table).select("*").eq("id",id).eq("org_id",ctx.orgId).maybeSingle();if(!before)return accessJson({error:"Assignment not found."},404);if(before.revoked_at)return accessJson({error:"Assignment is already revoked."},409);const {data,error}=await governanceAdmin.from(table).update({revoked_at:new Date().toISOString(),revoked_by:ctx.userId,revocation_reason:reason}).eq("id",id).eq("org_id",ctx.orgId).is("revoked_at",null).select("*").single();if(error)return accessJson({error:error.message},400);await recordAuditEvent(ctx,{eventType:"assignment.warehouse.revoked",operation:"access",entityTable:table,entityId:id,reason,before,after:data,farmId:null,warehouseId:String(before.warehouse_id)});return accessJson({assignment:data});
}
