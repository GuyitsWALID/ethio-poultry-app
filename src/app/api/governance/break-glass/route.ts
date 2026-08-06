import { accessJson,getAccessContext,governanceAdmin,isAccessResponse } from "@/lib/access-context";

export async function GET(){const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;if(ctx.role!=="ceo")return accessJson({error:"CEO access is required."},403);const {data,error}=await governanceAdmin.from("break_glass_requests").select("*").eq("target_org_id",ctx.orgId).order("requested_at",{ascending:false}).limit(100);return error?accessJson({error:error.message},500):accessJson({requests:data??[]});}
