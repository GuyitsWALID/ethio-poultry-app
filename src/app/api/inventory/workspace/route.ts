import { accessJson, getAccessContext, isAccessResponse } from "@/lib/access-context";
import { InventoryOperationsError, loadInventoryWorkspace } from "@/lib/inventory-operations";

export async function GET(request:Request){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  const url=new URL(request.url);const month=url.searchParams.get("month")??new Date().toISOString().slice(0,7);
  const from=url.searchParams.get("date_from"), to=url.searchParams.get("date_to");
  if(Boolean(from)!==Boolean(to))return accessJson({error:"Choose both report dates."},400);
  try{return accessJson(await loadInventoryWorkspace(ctx,url.searchParams.get("warehouse_id"),month,from&&to?{from,to}:undefined));}
  catch(error){return accessJson({error:error instanceof Error?error.message:"Inventory workspace could not be loaded."},error instanceof InventoryOperationsError?error.status:500);}
}
