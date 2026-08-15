import { accessJson,getAccessContext,governanceAdmin,isAccessResponse } from "@/lib/access-context";
import {recordAuditEvent} from "@/lib/audit-ledger";

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;if(ctx.role!=="ceo")return accessJson({error:"Only the CEO can manage tenant accounts."},403);const {id}=await params;const body=await request.json().catch(()=>null) as {role?:string;is_active?:boolean}|null;
  const {data:before}=await governanceAdmin.from("profiles").select("id,role,is_active").eq("id",id).eq("org_id",ctx.orgId).maybeSingle();if(!before)return accessJson({error:"User not found."},404);
  const nextRole=body?.role??before.role;const nextActive=body?.is_active??before.is_active;if(!["ceo","farm_manager"].includes(nextRole))return accessJson({error:"Only CEO and farm manager are active tenant roles."},400);
  if(before.role==="ceo"&&before.is_active&&(nextRole!=="ceo"||!nextActive))return accessJson({error:"The sole active CEO cannot be deactivated or reassigned. Transfer CEO responsibility in a dedicated continuity procedure first."},409);
  if(nextRole==="ceo"&&nextActive&&before.role!=="ceo")return accessJson({error:"This organization already has its active CEO. CEO transfer requires a continuity procedure."},409);
  const {data,error}=await governanceAdmin.from("profiles").update({role:nextRole,is_active:nextActive}).eq("id",id).eq("org_id",ctx.orgId).select("id,role,is_active").single();if(error)return accessJson({error:error.message},400);await recordAuditEvent(ctx,{eventType:"tenant_user.updated",operation:"access",entityTable:"profiles",entityId:id,reason:"Updated tenant account role or activation status.",before,after:data});return accessJson({profile:data});
}
