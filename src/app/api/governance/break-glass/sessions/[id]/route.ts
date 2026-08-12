import {accessJson,getAccessContext,isAccessResponse} from "@/lib/access-context";
import {createClient} from "@/utils/supabase/server";

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getAccessContext();if(isAccessResponse(ctx))return ctx;if(!["ceo","system_admin"].includes(ctx.role))return accessJson({error:"Only the tenant CEO or assigned administrator can end support access."},403);
  const {id}=await params;const body=await request.json().catch(()=>null) as {reason?:string}|null;const reason=String(body?.reason??"").trim();if(reason.length<8)return accessJson({error:"A revocation reason of at least eight characters is required."},400);
  const auth=await createClient();const {data,error}=await auth.rpc("revoke_break_glass_session",{p_session_id:id,p_reason:reason});
  return error?accessJson({error:error.message},error.code==="42501"?403:error.code==="40001"?409:400):accessJson({session:data});
}
