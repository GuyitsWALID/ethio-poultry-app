import {getAccessContext,isAccessResponse} from "@/lib/access-context";
import {AssignmentError,confirmFarmHandover,previewFarmHandover} from "@/lib/farm-assignment-management";
import {ZodError} from "zod";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
function failure(error:unknown) {
  if(error instanceof AssignmentError)return json({error:error.message,code:error.code},error.status);
  if(error instanceof ZodError)return json({error:"Review the farm, replacement, reason and confirmation.",code:"INVALID_ASSIGNMENT"},400);
  return json({error:"Handover could not be completed. Refresh and try again."},500);
}
export async function GET(request:Request) {
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  const query=new URL(request.url).searchParams;
  try{return json(await previewFarmHandover(ctx,query.get("farm_id")??"",query.get("replacement_id")??""));}catch(error){return failure(error);}
}
export async function POST(request:Request) {
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  try{return json(await confirmFarmHandover(ctx,await request.json()));}catch(error){return failure(error);}
}
