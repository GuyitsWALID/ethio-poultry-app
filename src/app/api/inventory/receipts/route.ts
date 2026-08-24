import { accessJson, getAccessContext, isAccessResponse } from "@/lib/access-context";
import { InventoryOperationsError, receiveInventoryStock } from "@/lib/inventory-operations";

export async function POST(request:Request){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  try{return accessJson({receipt:await receiveInventoryStock(ctx,await request.json().catch(()=>null))},201);}
  catch(error){return accessJson({error:error instanceof Error?error.message:"Stock could not be received."},error instanceof InventoryOperationsError?error.status:500);}
}
