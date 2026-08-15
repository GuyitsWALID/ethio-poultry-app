import { accessJson,canAccessFarm,getAccessContext,governanceAdmin,isAccessResponse } from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";

const allowed=new Set(["daily_farm_records","feeding_session_records","daily_sales_records","health_events","vaccination_events","biosecurity_checks","batch_weight_check_tasks"]);

export async function POST(request:Request){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;if(ctx.role!=="farm_manager")return accessJson({error:"Only farm managers can void routine operational records."},403);
  const body=await request.json().catch(()=>null) as {table?:string;id?:string;reason?:string}|null;const table=String(body?.table??"");const id=String(body?.id??"");const reason=String(body?.reason??"").trim();if(!allowed.has(table)||!id||reason.length<8)return accessJson({error:"Supported record, ID, and a void reason of at least eight characters are required."},400);
  const {data:row,error:readError}=await governanceAdmin.from(table).select("*").eq("id",id).eq("org_id",ctx.orgId).maybeSingle();if(readError)return accessJson({error:readError.message},400);if(!row)return accessJson({error:"Record not found."},404);if(row.voided_at)return accessJson({error:"Record is already voided."},409);
  let farmId=row.farm_id?String(row.farm_id):"";if(!farmId&&row.flock_id){const {data:flock}=await governanceAdmin.from("flocks").select("farm_id").eq("id",row.flock_id).eq("org_id",ctx.orgId).maybeSingle();farmId=String(flock?.farm_id??"")}if(!farmId||!(await canAccessFarm(ctx,farmId)))return accessJson({error:"Active farm assignment is required."},403);
  const recordDate=String(row.record_date??row.sale_date??row.event_date??row.check_date??"");if(recordDate){const {data:day}=await governanceAdmin.from("farm_operating_days").select("status").eq("farm_id",farmId).eq("operating_date",recordDate).maybeSingle();if(day?.status==="locked")return accessJson({error:"This operating day is locked. Submit a locked-record correction request."},423)}
  const now=new Date().toISOString();const {data,error}=await governanceAdmin.from(table).update({voided_at:now,voided_by:ctx.userId,void_reason:reason}).eq("id",id).eq("org_id",ctx.orgId).select("*").single();if(error)return accessJson({error:error.message},400);
  if(table==="vaccination_events"||table==="biosecurity_checks"||table==="batch_weight_check_tasks")await governanceAdmin.from("health_events").update({voided_at:now,voided_by:ctx.userId,void_reason:`Source record voided: ${reason}`}).eq("org_id",ctx.orgId).or(`description.like.SCHEDULE_TARGET|${id}|%,description.like.SCHEDULE_STATUS|${id}|%`);
  await recordAuditEvent(ctx,{eventType:"business_record.voided",operation:"update",entityTable:table,entityId:id,reason,before:row,after:data,farmId,flockId:row.flock_id?String(row.flock_id):null});return accessJson({record:data});
}
