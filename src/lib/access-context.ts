import { createClient } from "@supabase/supabase-js";

import { capabilitiesFor, parseActiveRole, type ActiveRole, type Capability } from "@/lib/permissions";
import { createClient as createAuthedClient } from "@/utils/supabase/server";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{autoRefreshToken:false,persistSession:false} });

export type AccessContext = {
  userId:string; homeOrgId:string; orgId:string; role:ActiveRole; capabilities:Capability[];
  supportSessionId:string|null; supportExpiresAt:string|null;
};

export function accessJson(value:unknown,status=200){return Response.json(value,{status});}

export async function getAccessContext(options:{tenant?:boolean}={}):Promise<AccessContext|Response>{
  const auth=await createAuthedClient();const {data:{user}}=await auth.auth.getUser();
  if(!user)return accessJson({error:"Unauthorized"},401);
  const {data:profile,error}=await admin.from("profiles").select("org_id,role,is_active").eq("id",user.id).maybeSingle();
  if(error)return accessJson({error:error.message},500);
  const role=parseActiveRole(profile?.role);
  if(!profile?.org_id||!profile.is_active||!role)return accessJson({error:"This account has no active role assignment."},403);
  let orgId=String(profile.org_id);let supportSessionId:string|null=null;let supportExpiresAt:string|null=null;
  if(role==="system_admin"&&options.tenant){
    const {data:session}=await admin.from("break_glass_sessions").select("id,target_org_id,expires_at").eq("administrator_id",user.id).is("revoked_at",null).lte("started_at",new Date().toISOString()).gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:false}).limit(1).maybeSingle();
    if(!session)return accessJson({error:"An active CEO-approved support session is required."},403);
    orgId=String(session.target_org_id);supportSessionId=String(session.id);supportExpiresAt=String(session.expires_at);
  }
  return{userId:user.id,homeOrgId:String(profile.org_id),orgId,role,capabilities:capabilitiesFor(role),supportSessionId,supportExpiresAt};
}

export function isAccessResponse(value:AccessContext|Response):value is Response{return value instanceof Response;}

export async function canAccessFarm(ctx:AccessContext,farmId:string){
  if(ctx.role==="ceo"||ctx.supportSessionId)return true;if(ctx.role!=="farm_manager")return false;
  const now=new Date().toISOString();const {data}=await admin.from("user_farm_access").select("id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).eq("farm_id",farmId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`).limit(1).maybeSingle();return Boolean(data);
}

export async function canAccessWarehouse(ctx:AccessContext,warehouseId:string){
  if(ctx.supportSessionId)return true;if(ctx.role!=="farm_manager")return false;
  const now=new Date().toISOString();const {data}=await admin.from("user_warehouse_access").select("id").eq("org_id",ctx.orgId).eq("profile_id",ctx.userId).eq("warehouse_id",warehouseId).is("revoked_at",null).lte("starts_at",now).or(`expires_at.is.null,expires_at.gt.${now}`).limit(1).maybeSingle();return Boolean(data);
}

export {admin as governanceAdmin};
