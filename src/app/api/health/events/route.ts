import {accessJson,canAccessFarm,getAccessContext,governanceAdmin,isAccessResponse} from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";
import {FarmOperationError,recordHealthEvidence} from "@/lib/farm-operations";

const DATE=/^\d{4}-\d{2}-\d{2}$/;

export async function GET(){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(!ctx.supportSessionId&&ctx.role!=="ceo"&&ctx.role!=="farm_manager")return accessJson({error:"Health evidence access is not available for this role."},403);
  let flockIds:string[]|null=null;
  if(ctx.role==="farm_manager"&&!ctx.supportSessionId){
    const now=new Date().toISOString();
    const {data:assignments,error:assignmentError}=await governanceAdmin.from("user_farm_access").select("farm_id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`);
    if(assignmentError)return accessJson({error:assignmentError.message},500);
    const farmIds=[...new Set((assignments??[]).map(row=>String(row.farm_id)))];
    if(!farmIds.length)return accessJson({events:[]});
    const {data:flocks,error:flockError}=await governanceAdmin.from("flocks").select("id").eq("org_id",ctx.orgId).in("farm_id",farmIds);
    if(flockError)return accessJson({error:flockError.message},500);
    flockIds=(flocks??[]).map(row=>String(row.id));
    if(!flockIds.length)return accessJson({events:[]});
  }
  let query=governanceAdmin.from("health_events").select("id,event_date,event_type,description,diagnosis,treatment,flock_id,external_veterinarian_name,veterinarian_recommendation,veterinarian_reference,recommendation_status,created_at").eq("org_id",ctx.orgId).is("voided_at",null).order("event_date",{ascending:false}).limit(1000);
  if(flockIds)query=query.in("flock_id",flockIds);
  const {data,error}=await query;
  return error?accessJson({error:error.message},500):accessJson({events:data??[]});
}

export async function POST(request:Request){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(ctx.role!=="farm_manager"&&!ctx.supportSessionId)return accessJson({error:"Only an assigned farm manager can record health evidence."},403);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  try{
    const result=await recordHealthEvidence(ctx,body);
    return result.kind==="vaccination"?accessJson({completion:result.data},201):accessJson({event:result.data},201);
  }catch(error){
    if(error instanceof FarmOperationError)return accessJson({error:error.message,...(error.guidance??{})},error.status);
    return accessJson({error:error instanceof Error?error.message:"Unknown error"},500);
  }
}

export async function PATCH(request:Request){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;if(ctx.role!=="farm_manager"&&!ctx.supportSessionId)return accessJson({error:"Only an assigned farm manager can update health schedule evidence."},403);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const scheduleId=String(body?.schedule_id??"").trim();const eventDate=String(body?.event_date??"").trim();const flockId=String(body?.flock_id??"").trim();const farmId=String(body?.farm_id??"").trim();const houseId=String(body?.house_id??"").trim();
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(scheduleId)||!DATE.test(eventDate)||!flockId||!farmId)return accessJson({error:"Schedule, date, farm, and flock are required."},400);
  const {data:flock}=await governanceAdmin.from("flocks").select("farm_id").eq("id",flockId).eq("org_id",ctx.orgId).maybeSingle();
  if(!flock||!(await canAccessFarm(ctx,String(flock.farm_id))))return accessJson({error:"Active farm assignment is required."},403);
  const beforeResult=await governanceAdmin.from("health_events").select("id,event_date,flock_id,description").eq("org_id",ctx.orgId).or(`description.like.SCHEDULE_TARGET|${scheduleId}|%,description.like.SCHEDULE_STATUS|${scheduleId}|%`);
  if(beforeResult.error)return accessJson({error:beforeResult.error.message},500);
  const [targetResult,statusResult]=await Promise.all([
    governanceAdmin.from("health_events").update({event_date:eventDate,flock_id:flockId,description:`SCHEDULE_TARGET|${scheduleId}|${farmId}|${houseId}|${flockId}`}).eq("org_id",ctx.orgId).like("description",`SCHEDULE_TARGET|${scheduleId}|%`).select("id,event_date,flock_id,description"),
    governanceAdmin.from("health_events").update({event_date:eventDate,flock_id:flockId}).eq("org_id",ctx.orgId).like("description",`SCHEDULE_STATUS|${scheduleId}|%`).select("id,event_date,flock_id,description"),
  ]);
  const error=targetResult.error??statusResult.error;if(error)return accessJson({error:error.message},400);const data=[...(targetResult.data??[]),...(statusResult.data??[])];
  await recordAuditEvent(ctx,{eventType:"health_schedule.evidence_updated",operation:"update",entityTable:"health_events",entityId:scheduleId,reason:"Updated the schedule date or target flock.",before:beforeResult.data??[],after:data,farmId:String(flock.farm_id),flockId});
  return accessJson({events:data});
}
