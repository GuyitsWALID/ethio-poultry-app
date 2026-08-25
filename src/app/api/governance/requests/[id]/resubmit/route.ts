/* eslint-disable @typescript-eslint/no-explicit-any */
import { accessJson,getAccessContext,isAccessResponse } from "@/lib/access-context";
import { hasCapability } from "@/lib/permissions";
import { refreshGovernanceRequestContext } from "@/lib/governance-workflow";
import { createClient } from "@/utils/supabase/server";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(!hasCapability(ctx.role,"governance:request"))return accessJson({error:"Only Farm Managers can resubmit returned requests."},403);
  const {id}=await params;const body=await request.json().catch(()=>null) as {reason?:string;proposed_values?:Record<string,unknown>;changed_fields?:string[]}|null;
  const auth=await createClient();const {data,error}=await (auth as any).rpc("resubmit_governance_request",{p_request_id:id,p_reason:String(body?.reason??"").trim(),p_proposed_values:body?.proposed_values??{},p_changed_fields:Array.isArray(body?.changed_fields)?body.changed_fields:[]});
  if(error)return accessJson({error:error.message},error.code==="40001"?409:400);
  await refreshGovernanceRequestContext(ctx,id,body?.proposed_values??{});
  return accessJson({request:data});
}
