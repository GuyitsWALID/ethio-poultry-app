import { getAccessContext,isAccessResponse,accessJson,canAccessFarm,governanceAdmin } from "@/lib/access-context";
import { hasCapability } from "@/lib/permissions";
import {recordAuditEvent} from "@/lib/audit-ledger";

const types=new Set(["batch_create","batch_archive","flock_place","flock_transfer","flock_close","flock_archive","feed_template","breed_target","health_schedule","warning_threshold","locked_correction","void_record"]);

export async function GET(){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(!hasCapability(ctx.role,"tenant:view"))return accessJson({error:"Tenant access is required."},403);
  let query=governanceAdmin.from("governance_requests").select("*").eq("org_id",ctx.orgId).order("requested_at",{ascending:false});
  if(ctx.role==="farm_manager")query=query.eq("requested_by",ctx.userId);
  const {data,error}=await query.limit(250);return error?accessJson({error:error.message},500):accessJson({requests:data??[],role:ctx.role});
}

export async function POST(request:Request){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(!hasCapability(ctx.role,"governance:request"))return accessJson({error:"Only farm managers can submit governance requests."},403);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const requestType=String(body?.request_type??"");const reason=String(body?.reason??"").trim();const farmId=body?.farm_id?String(body.farm_id):null;
  if(!types.has(requestType)||reason.length<8)return accessJson({error:"A supported request type and a reason of at least eight characters are required."},400);
  if(farmId&&!await canAccessFarm(ctx,farmId))return accessJson({error:"The selected farm is outside your active assignment."},403);
  const row={org_id:ctx.orgId,request_type:requestType,farm_id:farmId,warehouse_id:body?.warehouse_id||null,source_table:body?.source_table||null,source_id:body?.source_id||null,source_version:body?.source_version||null,changed_fields:Array.isArray(body?.changed_fields)?body.changed_fields:[],proposed_values:body?.proposed_values&&typeof body.proposed_values==="object"?body.proposed_values:{},reason,attachments:Array.isArray(body?.attachments)?body.attachments:[],requested_by:ctx.userId};
  const {data,error}=await governanceAdmin.from("governance_requests").insert(row).select("*").single();
  if(error)return accessJson({error:error.message},400);
  await recordAuditEvent(ctx,{eventType:"governance_request.submitted",operation:"decision",entityTable:"governance_requests",entityId:String(data.id),reason,after:data,farmId,warehouseId:body?.warehouse_id?String(body.warehouse_id):null});
  return accessJson({request:data},201);
}
