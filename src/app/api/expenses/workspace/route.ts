import {accessJson,getAccessContext,isAccessResponse} from '@/lib/access-context';
import {expenseWorkspace} from '@/lib/expenses';
export async function GET(request:Request){const ctx=await getAccessContext({tenant:true});if(isAccessResponse(ctx))return ctx;
 try{return accessJson(await expenseWorkspace(ctx,new URL(request.url).searchParams.get('farm_id')??undefined));}
 catch(error){return accessJson({error:error instanceof Error?error.message:'FAILED'},error instanceof Error&&error.message==='DENIED'?403:503);}}
