import { accessJson,getAccessContext,governanceAdmin,isAccessResponse } from "@/lib/access-context";
import { hasCapability } from "@/lib/permissions";

export async function GET(){const ctx=await getAccessContext();if(isAccessResponse(ctx))return ctx;if(!hasCapability(ctx.role,"platform:admin"))return accessJson({error:"Platform administrator access is required."},403);const {data,error}=await governanceAdmin.from("break_glass_requests").select("*,organizations:target_org_id(name)").eq("administrator_id",ctx.userId).order("requested_at",{ascending:false}).limit(100);return error?accessJson({error:error.message},500):accessJson({requests:data??[]});}

export async function POST(request:Request){
  const ctx=await getAccessContext();if(isAccessResponse(ctx))return ctx;if(!hasCapability(ctx.role,"platform:admin"))return accessJson({error:"Platform administrator access is required."},403);
  const body=await request.json().catch(()=>null) as {target_org_id?:string;reason?:string;ticket_reference?:string;requested_minutes?:number}|null;
  const reason=String(body?.reason??"").trim();const ticket=String(body?.ticket_reference??"").trim();const minutes=Number(body?.requested_minutes??0);const orgId=String(body?.target_org_id??"");
  if(!orgId||reason.length<12||!ticket||!Number.isInteger(minutes)||minutes<1||minutes>240)return accessJson({error:"Organization, ticket, a detailed reason, and a duration from 1 to 240 minutes are required."},400);
  const {data:org}=await governanceAdmin.from("organizations").select("id").eq("id",orgId).maybeSingle();if(!org)return accessJson({error:"Organization not found."},404);
  const {data,error}=await governanceAdmin.from("break_glass_requests").insert({target_org_id:orgId,administrator_id:ctx.userId,reason,ticket_reference:ticket,requested_minutes:minutes}).select("*").single();
  if(error)return accessJson({error:error.message},400);return accessJson({request:data},201);
}
