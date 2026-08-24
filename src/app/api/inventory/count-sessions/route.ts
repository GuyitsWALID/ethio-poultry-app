import { accessJson, getAccessContext, isAccessResponse } from "@/lib/access-context";
import { InventoryOperationsError, submitMonthlyCount } from "@/lib/inventory-operations";

export async function POST(request:Request){
  const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
  try{return accessJson({session:await submitMonthlyCount(ctx,await request.json())},201);}
  catch(error){return accessJson({error:error instanceof Error?error.message:"Monthly count could not be submitted."},error instanceof InventoryOperationsError?error.status:500);}
}
