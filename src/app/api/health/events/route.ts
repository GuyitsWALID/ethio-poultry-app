/* eslint-disable @typescript-eslint/no-explicit-any */

import {accessJson,canAccessFarm,getAccessContext,governanceAdmin,isAccessResponse} from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";

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
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;if(ctx.role!=="farm_manager"&&!ctx.supportSessionId)return accessJson({error:"Only an assigned farm manager can record health evidence."},403);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const vaccinationScheduleId=String(body?.vaccination_schedule_id??"").trim();
  if(vaccinationScheduleId){
    const itemId=String(body?.inventory_item_id??"").trim();const warehouseId=String(body?.warehouse_id??"").trim();const quantity=Number(body?.quantity);const administeredOn=String(body?.administered_on??"").trim();
    if(!itemId||!warehouseId||!Number.isFinite(quantity)||quantity<=0||!DATE.test(administeredOn))return accessJson({error:"Vaccine item, warehouse, administered quantity, and actual administration date are required."},400);
    const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Addis_Ababa",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    if(administeredOn>today)return accessJson({error:"The administration date cannot be in the future."},400);
    const {data,error}=await (governanceAdmin as any).rpc("complete_vaccination_with_inventory",{p_actor_id:ctx.userId,p_schedule_id:vaccinationScheduleId,p_item_id:itemId,p_warehouse_id:warehouseId,p_quantity:quantity,p_administered_on:administeredOn});
    if(error)return accessJson({error:error.message},error.code==="42501"?403:error.code==="55000"?423:400);
    await recordAuditEvent(ctx,{eventType:"vaccination.completed_with_inventory",operation:"insert",entityTable:"vaccination_events",entityId:vaccinationScheduleId,reason:"Completed vaccination and issued vaccine stock atomically.",after:data,warehouseId});
    return accessJson({completion:data},201);
  }
  const flockId=String(body?.flock_id??"");const eventDate=String(body?.event_date??"");const eventType=String(body?.event_type??"observation");if(!flockId||!DATE.test(eventDate)||!["disease","treatment","observation"].includes(eventType))return accessJson({error:"Flock, date, and a valid event type are required."},400);
  const {data:flock}=await governanceAdmin.from("flocks").select("farm_id").eq("id",flockId).eq("org_id",ctx.orgId).maybeSingle();if(!flock||!(await canAccessFarm(ctx,String(flock.farm_id))))return accessJson({error:"Active farm assignment is required."},403);
  if(!ctx.supportSessionId){const {data:operatingDay}=await governanceAdmin.from("farm_operating_days").select("status").eq("farm_id",flock.farm_id).eq("operating_date",eventDate).maybeSingle();if(operatingDay?.status==="locked")return accessJson({error:"This operating day is locked. Submit a governed correction request instead."},423);}
  const vetName=String(body?.external_veterinarian_name??"").trim();const recommendation=String(body?.veterinarian_recommendation??"").trim();const reference=String(body?.veterinarian_reference??"").trim();const attachment=String(body?.attachment_url??"").trim();const recommendationStatus=String(body?.recommendation_status??"").trim();const hasVetEvidence=Boolean(vetName||recommendation||reference||attachment||recommendationStatus);if(hasVetEvidence&&(!vetName||!recommendation))return accessJson({error:"Veterinarian name and recommendation are required when external guidance is recorded."},400);if(recommendationStatus&&!["received","planned","implemented","declined"].includes(recommendationStatus))return accessJson({error:"Invalid recommendation status."},400);if(recommendationStatus==="declined"&&String(body?.treatment??"").trim().length<8)return accessJson({error:"Declined guidance requires an explanation in the action taken field."},400);
  const inventoryItemId=String(body?.inventory_item_id??"").trim()||null;const warehouseId=String(body?.warehouse_id??"").trim()||null;const quantity=body?.quantity==null||body.quantity===""?null:Number(body.quantity);
  if((inventoryItemId||warehouseId||quantity!==null)&&(!inventoryItemId||!warehouseId||quantity===null||!Number.isFinite(quantity)||quantity<=0))return accessJson({error:"Medicine item, warehouse, and administered quantity must be supplied together."},400);
  const row={org_id:ctx.orgId,flock_id:flockId,event_date:eventDate,event_type:eventType,description:String(body?.description??"").trim()||null,diagnosis:String(body?.diagnosis??"").trim()||null,treatment:String(body?.treatment??"").trim()||null,attachment_url:attachment||null,vet_id:ctx.userId,external_veterinarian_name:vetName||null,veterinarian_recommendation:recommendation||null,veterinarian_reference:reference||null,veterinarian_attachment:attachment?{url:attachment}:null,recommendation_status:recommendationStatus||null};
  if(inventoryItemId){
    const {data,error}=await (governanceAdmin as any).rpc("record_health_event_with_inventory",{p_actor_id:ctx.userId,p_flock_id:flockId,p_event_date:eventDate,p_event_type:eventType,p_event:row,p_item_id:inventoryItemId,p_warehouse_id:warehouseId,p_quantity:quantity});
    if(error)return accessJson({error:error.message},error.code==="42501"?403:error.code==="55000"?423:400);
    await recordAuditEvent(ctx,{eventType:"health_treatment.recorded_with_inventory",operation:"insert",entityTable:"health_events",entityId:String(data.event_id),reason:"Recorded treatment and medicine usage atomically.",after:data,farmId:String(flock.farm_id),flockId,warehouseId});return accessJson({event:data},201);
  }
  const {data,error}=await governanceAdmin.from("health_events").insert(row).select("*").single();if(error)return accessJson({error:error.message},400);await recordAuditEvent(ctx,{eventType:"health_evidence.recorded",operation:"insert",entityTable:"health_events",entityId:String(data.id),reason:`Recorded ${eventType} health evidence.`,after:data,farmId:String(flock.farm_id),flockId});return accessJson({event:data},201);
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
