/* eslint-disable @typescript-eslint/no-explicit-any */
import { accessJson,getAccessContext,governanceAdmin,isAccessResponse,type AccessContext } from "@/lib/access-context";
import { canAccessFarm,canAccessWarehouse } from "@/lib/access-context";

const db=governanceAdmin as any;const allowed=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);

async function accessible(ctx:AccessContext,id:string){
  const {data}=await db.from("governance_requests").select("id,requested_by,farm_id,warehouse_id").eq("id",id).eq("org_id",ctx.orgId).maybeSingle();if(!data)return null;
  if(ctx.role==="ceo"||ctx.supportSessionId||data.requested_by===ctx.userId)return data;
  if(data.farm_id&&await canAccessFarm(ctx,String(data.farm_id)))return data;if(data.warehouse_id&&await canAccessWarehouse(ctx,String(data.warehouse_id)))return data;return null;
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;const {id}=await params;if(!await accessible(ctx,id))return accessJson({error:"Request evidence is outside your scope."},403);
  const existing=await db.from("governance_request_evidence").select("id",{count:"exact",head:true}).eq("request_id",id);if((existing.count??0)>=5)return accessJson({error:"A request can contain at most five files."},409);
  const form=await request.formData();const file=form.get("file");if(!(file instanceof File)||!allowed.has(file.type)||file.size>8*1024*1024)return accessJson({error:"Use a PDF, JPEG, PNG, or WebP file no larger than 8 MB."},400);
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`${ctx.orgId}/${id}/${crypto.randomUUID()}-${safe}`;const uploaded=await governanceAdmin.storage.from("governance-evidence").upload(path,file,{contentType:file.type,upsert:false});if(uploaded.error)return accessJson({error:"Evidence upload failed."},502);
  const {data,error}=await db.from("governance_request_evidence").insert({org_id:ctx.orgId,request_id:id,storage_path:path,file_name:file.name,content_type:file.type,byte_size:file.size,uploaded_by:ctx.userId}).select("id,file_name,content_type,byte_size,uploaded_at").single();
  if(error){await governanceAdmin.storage.from("governance-evidence").remove([path]);return accessJson({error:error.message},400)}
  return accessJson({evidence:data},201);
}

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;const {id}=await params;if(!await accessible(ctx,id))return accessJson({error:"Request evidence is outside your scope."},403);
  const evidenceId=new URL(request.url).searchParams.get("evidence_id");const {data}=await db.from("governance_request_evidence").select("storage_path").eq("id",evidenceId).eq("request_id",id).eq("org_id",ctx.orgId).maybeSingle();if(!data?.storage_path)return accessJson({error:"Evidence file not found."},404);
  const signed=await governanceAdmin.storage.from("governance-evidence").createSignedUrl(data.storage_path,60);if(signed.error)return accessJson({error:"Evidence link could not be created."},500);return Response.redirect(signed.data.signedUrl,302);
}
