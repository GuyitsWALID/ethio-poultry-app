import { accessJson,getAccessContext,isAccessResponse } from "@/lib/access-context";
import { hasCapability } from "@/lib/permissions";
import {createClient as createAuthedClient} from "@/utils/supabase/server";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(!hasCapability(ctx.role,"governance:approve"))return accessJson({error:"Only the organization CEO can decide requests."},403);
  const {id}=await params;const body=await request.json().catch(()=>null) as {decision?:string;note?:string}|null;
  const decision=String(body?.decision??"");const note=String(body?.note??"").trim();
  if(!["approved","rejected"].includes(decision)||note.length<4)return accessJson({error:"Decision and note are required."},400);
  const auth=await createAuthedClient();const {data,error}=await auth.rpc("decide_governance_request",{p_request_id:id,p_decision:decision,p_note:note});
  if(!error&&(data as {status?:string}|null)?.status==="conflict")return accessJson({error:"The source changed after submission. Refresh and submit a new request.",request:data},409);
  return error?accessJson({error:error.message},error.code==="40001"?409:400):accessJson({request:data});
}
