/* eslint-disable @typescript-eslint/no-explicit-any */
import { accessJson,getAccessContext,isAccessResponse } from "@/lib/access-context";
import { hasCapability } from "@/lib/permissions";
import { createClient } from "@/utils/supabase/server";

export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(!hasCapability(ctx.role,"governance:request"))return accessJson({error:"Only an assigned Farm Manager can apply an approved change."},403);
  const {id}=await params;const auth=await createClient();const {data,error}=await (auth as any).rpc("apply_governance_request",{p_request_id:id});
  if(error)return accessJson({error:error.message},error.code==="42501"?403:error.code==="40001"?409:400);
  if(data?.status==="conflict")return accessJson({error:"The source changed after approval. Submit a fresh request.",request:data},409);
  if(data?.status==="expired")return accessJson({error:"This authorization expired. Submit it again for CEO review.",request:data},410);
  return accessJson({request:data});
}
