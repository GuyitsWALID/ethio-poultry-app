import {tokenMatches} from '@/lib/platform-observability';
import {refreshScheduler} from '@/lib/scheduler/server';
export async function POST(request:Request){
 const token=process.env.MONITORING_INGEST_TOKEN?.trim();if(!token)return Response.json({error:'Scheduler generation is not configured.'},{status:503});
 const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')??'';
 if(!supplied||!await tokenMatches(supplied,token))return Response.json({error:'Unauthorized'},{status:401});
 try{return Response.json(await refreshScheduler());}catch{return Response.json({error:'Scheduler generation failed.'},{status:503});}
}
