import { accessJson,getAccessContext,isAccessResponse } from "@/lib/access-context";
import { loadGovernanceDesk } from "@/lib/governance-workflow";

export async function GET(){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  try{return accessJson(await loadGovernanceDesk(ctx))}catch(error){return accessJson({error:error instanceof Error?error.message:"Governance desk could not load."},500)}
}
