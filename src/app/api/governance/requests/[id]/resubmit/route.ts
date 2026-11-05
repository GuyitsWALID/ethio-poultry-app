/* eslint-disable @typescript-eslint/no-explicit-any */
import { accessJson,getAccessContext,isAccessResponse } from "@/lib/access-context";
import { hasCapability } from "@/lib/permissions";
import { refreshGovernanceRequestContext } from "@/lib/governance-workflow";
import { createClient } from "@/utils/supabase/server";
import {prepareEggSourceCorrection} from "@/lib/egg-sale-sources.server";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(!hasCapability(ctx.role,"governance:request"))return accessJson({error:"Only Farm Managers can resubmit returned requests."},403);
  const {id}=await params;const body=await request.json().catch(()=>null) as {reason?:string;proposed_values?:Record<string,unknown>;changed_fields?:string[]}|null;
  const auth=await createClient();
  const {data: existing} = await auth.from("governance_requests").select("request_type,farm_id,source_table,source_id").eq("id",id).eq("org_id",ctx.orgId).maybeSingle();
  let proposed = body?.proposed_values ?? {}, changed = Array.isArray(body?.changed_fields) ? body.changed_fields : [];
  if (existing?.request_type === "egg_sale_sources") {
    try {const prepared = await prepareEggSourceCorrection(ctx, {...existing, proposed_values: proposed}); proposed = prepared.proposed_values!; changed = prepared.changed_fields!;}
    catch {return accessJson({error: "EGG_SOURCE_INVALID"},400);}
  }
  const {data,error}=await (auth as any).rpc("resubmit_governance_request",{p_request_id:id,p_reason:String(body?.reason??"").trim(),p_proposed_values:proposed,p_changed_fields:changed});
  if(error)return accessJson({error:error.message},error.code==="40001"?409:400);
  await refreshGovernanceRequestContext(ctx,id,proposed);
  return accessJson({request:data});
}
