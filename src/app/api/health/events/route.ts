import {getTranslations} from "next-intl/server";
import {accessJson,getAccessContext,governanceAdmin,isAccessResponse} from "@/lib/access-context";
import {FarmOperationError, farmOperationErrorBody,recordHealthEvidence} from "@/lib/farm-operations";

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
  const validation = await getTranslations("OperationValidation");
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(ctx.role!=="farm_manager"&&!ctx.supportSessionId)return accessJson({error:validation("onlyAnAssignedFarmManagerCanRecordHealth")},403);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  try{
    const result=await recordHealthEvidence(ctx,body);
    return result.kind==="vaccination"?accessJson({completion:result.data},201):accessJson({event:result.data},201);
  }catch(error){
    if(error instanceof FarmOperationError)return accessJson(await farmOperationErrorBody(error),error.status);
    return accessJson({error:error instanceof Error?error.message:"Unknown error"},500);
  }
}

export async function PATCH(request:Request){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;if(ctx.role!=="farm_manager"&&!ctx.supportSessionId)return accessJson({error:"Only an assigned farm manager can update health schedule evidence."},403);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const scheduleId=String(body?.schedule_id??"").trim();const eventDate=String(body?.event_date??"").trim();const flockId=String(body?.flock_id??"").trim();const farmId=String(body?.farm_id??"").trim();const houseId=String(body?.house_id??"").trim();
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(!uuid.test(scheduleId)||!DATE.test(eventDate)||!uuid.test(farmId)||(flockId&&!uuid.test(flockId))||(houseId&&!uuid.test(houseId))||!["vaccination","cleanup"].includes(String(body?.kind))||typeof body?.expected_version!=="string"||!Number.isFinite(Date.parse(body.expected_version)))return accessJson({error:"Refresh the schedule and choose a valid date and location."},400);
  const rpc=governanceAdmin as unknown as {rpc(name:string,args:Record<string,unknown>):Promise<{data:unknown;error:{message:string;code?:string}|null}>};
  const {data,error}=await rpc.rpc("edit_legacy_health_schedule",{p_actor:ctx.userId,p_org:ctx.orgId,p_schedule:scheduleId,p_kind:body.kind,p_expected_version:body.expected_version,p_date:eventDate,p_farm:farmId,p_house:houseId||null,p_flock:flockId||null,p_changes:body.changes??{}});
  return error?accessJson({error:error.message},error.code==="42501"?403:error.code==="40001"?409:error.code==="55000"?423:400):accessJson(data);
}
