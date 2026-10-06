import "server-only";
import {z} from "zod";
import {governanceAdmin, type AccessContext} from "./access-context";

const dates = z.object({starts_at:z.string().datetime({offset:true}).optional(),expires_at:z.string().datetime({offset:true}).nullable().optional()});
export const grantAssignmentSchema = dates.extend({profile_id:z.string().uuid(),scope_type:z.enum(["farm","warehouse"]),scope_id:z.string().uuid()});
export const revokeAssignmentSchema = z.object({scope_type:z.enum(["farm","warehouse"]),assignment_id:z.string().uuid(),reason:z.string().trim().min(8).max(2000)});
export const handoverSchema = z.object({farm_id:z.string().uuid(),replacement_id:z.string().uuid(),assignment_id:z.string().uuid(),revision:z.string().regex(/^[a-f0-9]{32}$/),reason:z.string().trim().min(8).max(2000),confirmed:z.literal(true),expires_at:z.string().datetime({offset:true}).nullable().optional()});

export class AssignmentError extends Error {
  constructor(message:string,readonly status=400,readonly code="INVALID_ASSIGNMENT") {super(message);}
}
type RpcResult={data:unknown;error:{message:string;code?:string}|null};
function rpc(name:string,args:Record<string,unknown>) {
  return (governanceAdmin as unknown as {rpc(name:string,args:Record<string,unknown>):Promise<RpcResult>}).rpc(name,args);
}
function requireCeo(ctx:AccessContext) {
  if(ctx.role!=="ceo"||ctx.supportSessionId)throw new AssignmentError("Only the CEO can change assignments.",403,"CEO_REQUIRED");
}
async function result(call:Promise<RpcResult>) {
  const {data,error}=await call;
  if(error)throw new AssignmentError(error.message,error.code==="40001"||error.code==="23P01"?409:error.code==="42501"?403:400,error.code==="40001"||error.code==="23P01"?"ASSIGNMENT_CHANGED":"INVALID_ASSIGNMENT");
  return data;
}
export async function previewFarmHandover(ctx:AccessContext,farmId:string,replacementId:string) {
  requireCeo(ctx); z.string().uuid().parse(farmId);z.string().uuid().parse(replacementId);
  return result(rpc("farm_manager_handover_preview",{p_actor_id:ctx.userId,p_farm_id:farmId,p_replacement_id:replacementId}));
}
export async function confirmFarmHandover(ctx:AccessContext,input:unknown) {
  requireCeo(ctx);const value=handoverSchema.parse(input);
  return result(rpc("change_farm_manager_assignment",{p_actor_id:ctx.userId,p_farm_id:value.farm_id,p_manager_id:value.replacement_id,p_starts_at:new Date().toISOString(),p_expires_at:value.expires_at??null,p_assignment_id:value.assignment_id,p_expected_revision:value.revision,p_reason:value.reason,p_operation:"handover"}));
}
export async function grantFarmAssignment(ctx:AccessContext,input:z.infer<typeof grantAssignmentSchema>) {
  requireCeo(ctx);
  return result(rpc("change_farm_manager_assignment",{p_actor_id:ctx.userId,p_farm_id:input.scope_id,p_manager_id:input.profile_id,p_starts_at:input.starts_at??new Date().toISOString(),p_expires_at:input.expires_at??null,p_assignment_id:null,p_expected_revision:null,p_reason:"CEO granted farm assignment including farm-owned warehouses.",p_operation:"grant"}));
}
export async function revokeFarmAssignment(ctx:AccessContext,assignmentId:string,reason:string) {
  requireCeo(ctx);
  const {data:assignment,error}=await governanceAdmin.from("user_farm_access").select("farm_id").eq("org_id",ctx.orgId).eq("id",assignmentId).maybeSingle();
  if(error||!assignment)throw new AssignmentError("Assignment not found.",404);
  return result(rpc("change_farm_manager_assignment",{p_actor_id:ctx.userId,p_farm_id:assignment.farm_id,p_manager_id:null,p_starts_at:null,p_expires_at:null,p_assignment_id:assignmentId,p_expected_revision:null,p_reason:reason,p_operation:"revoke"}));
}
