import {accessJson,getAccessContext,isAccessResponse} from "@/lib/access-context";
import {loadManagerAccessSnapshot} from "@/lib/warehouse-access";
export async function GET() {
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  if(ctx.role!=="farm_manager")return accessJson({code:"ROLE_NOT_ALLOWED"},403);
  try{return accessJson(await loadManagerAccessSnapshot(ctx));}
  catch{return accessJson({code:"ACCESS_REFRESH_FAILED"},503);}
}
