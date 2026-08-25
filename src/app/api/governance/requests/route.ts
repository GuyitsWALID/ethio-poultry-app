import { accessJson,getAccessContext,isAccessResponse } from "@/lib/access-context";
import { loadGovernanceDesk,submitGovernanceRequest,type GovernanceInput } from "@/lib/governance-workflow";
import { hasCapability } from "@/lib/permissions";

export async function GET(){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(!hasCapability(ctx.role,"tenant:view"))return accessJson({error:"Tenant access is required."},403);
  try{return accessJson(await loadGovernanceDesk(ctx))}catch(error){return accessJson({error:error instanceof Error?error.message:"Governance desk could not load."},500)}
}

export async function POST(request:Request){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(!hasCapability(ctx.role,"governance:request"))return accessJson({error:"Only farm managers can submit governance requests."},403);
  const body=await request.json().catch(()=>null) as GovernanceInput|null;
  if(!body)return accessJson({error:"A readable change request is required."},400);
  try{return accessJson({request:await submitGovernanceRequest(ctx,body)},201)}catch(error){const message=error instanceof Error?error.message:"Request could not be submitted.";return accessJson({error:message},/outside your active assignment/.test(message)?403:400)}
}
