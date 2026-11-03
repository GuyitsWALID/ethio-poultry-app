import 'server-only';
import {canAccessFarm,governanceAdmin,type AccessContext} from '@/lib/access-context';
import {addisOperatingDate} from '@/lib/flock-lifecycle/server';
import {allAlertRows} from '@/lib/alert-pagination';
import {validHistoryDate,historyUuid} from '@/lib/history/contracts';
import {scheduleRuleSchema,type SchedulerContext,type ScheduledOccurrence,type ScheduledRule} from './contracts';

// New tables use the same guarded service client; public reads are separately RLS-scoped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db=governanceAdmin as any;
export async function schedulerScope(ctx:AccessContext,farmId?:string){
 if(!['ceo','farm_manager'].includes(ctx.role))throw Error('SCHEDULER_DENIED');
 if(farmId&&!historyUuid.test(farmId))throw Error('SCHEDULER_INVALID');
 if(farmId&&!await canAccessFarm(ctx,farmId))throw Error('SCHEDULER_DENIED');
 const org=await governanceAdmin.from('organizations').select('today_workspace_enabled').eq('id',ctx.orgId).single();
 if(org.error)throw Error('SCHEDULER_FAILED');
 if(!org.data.today_workspace_enabled)throw Error('SCHEDULER_DISABLED');
 const farms=await governanceAdmin.from('farms').select('id,name').eq('org_id',ctx.orgId).order('name');
 if(farms.error)throw Error('SCHEDULER_FAILED');
 const allowed=[];
 for(const farm of farms.data??[])if((!farmId||farm.id===farmId)&&await canAccessFarm(ctx,farm.id))allowed.push(farm);
 return allowed;
}
export async function readScheduler(ctx:AccessContext,options:{farmId?:string;cursor?:string;from?:string;to?:string}={}):Promise<SchedulerContext>{
 const farms=await schedulerScope(ctx,options.farmId),ids=farms.map(farm=>farm.id),today=addisOperatingDate(new Date());
 if(!ids.length)return {role:ctx.role as 'ceo'|'farm_manager',userId:ctx.userId,today,farms,flocks:[],rules:[],occurrences:[],nextCursor:null};
 const from=options.from??today,to=options.to??new Date(Date.parse(`${today}T00:00:00Z`)+89*86400000).toISOString().slice(0,10);
 if(!validHistoryDate(from)||!validHistoryDate(to)||from>to||Date.parse(to)-Date.parse(from)>366*86400000)throw Error('SCHEDULER_INVALID');
 const offset=options.cursor?Number(options.cursor):0;
 if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('SCHEDULER_INVALID');
 let occurrenceQuery=db.from('scheduled_work_occurrences').select('*').eq('org_id',ctx.orgId).in('farm_id',ids);
 occurrenceQuery=options.from?occurrenceQuery.gte('due_date',from).lte('due_date',to):occurrenceQuery.or(`and(status.eq.pending,due_date.lt.${today}),and(due_date.gte.${today},due_date.lte.${to})`);
 const [flocks,rules,occurrences,legacy]=await Promise.all([
  allAlertRows<{id:string;farm_id:string;flock_code:string;status:string;completed_at:string|null}>((from,to)=>governanceAdmin.from('flocks').select('id,farm_id,flock_code,status,completed_at').eq('org_id',ctx.orgId).in('farm_id',ids).order('id').range(from,to)).then(data=>({data,error:null})),
  db.from('scheduled_work_rules').select('*').eq('org_id',ctx.orgId).in('farm_id',ids).order('created_at',{ascending:false}).limit(501),
  occurrenceQuery.order('due_date').order('id').range(offset,offset+50),
  db.rpc('scheduler_legacy_preflight',{p_org:ctx.orgId,p_farms:ids}).order('due_date').limit(501),
 ]);
 if(flocks.error||rules.error||occurrences.error||legacy.error||rules.data.length>500||legacy.data.length>500)throw Error('SCHEDULER_FAILED');
 return {role:ctx.role as 'ceo'|'farm_manager',userId:ctx.userId,today,farms,flocks:flocks.data.map(f=>({id:f.id,farm_id:f.farm_id,flock_code:f.flock_code,eligible:!f.completed_at&&['active','quarantined'].includes(f.status)})),rules:rules.data as ScheduledRule[],
  occurrences:occurrences.data.slice(0,50),nextCursor:occurrences.data.length>50?String(offset+50):null,legacy:legacy.data};
}
export async function saveScheduler(ctx:AccessContext,input:unknown){
 const parsed=scheduleRuleSchema.safeParse(input);if(!parsed.success)throw Error('SCHEDULER_INVALID');
 const {request_id,id,revision,...spec}=parsed.data;await schedulerScope(ctx,spec.farm_id);
 const {data,error}=await db.rpc('save_scheduled_work_rule',{p_actor:ctx.userId,p_request:request_id,p_id:id??null,p_revision:revision??null,p_spec:spec});
 if(error)throw Error(error.code==='42501'?'SCHEDULER_DENIED':error.code==='40001'?'SCHEDULER_CHANGED':'SCHEDULER_INVALID');
 return data;
}
export async function dueScheduledWork(ctx:AccessContext,farm:string,date:string,flock?:string):Promise<ScheduledOccurrence[]>{
 if(!await canAccessFarm(ctx,farm))throw Error('SCHEDULER_DENIED');
 return allAlertRows<ScheduledOccurrence>((from,to)=>{let q=db.from('scheduled_work_occurrences').select('*').eq('org_id',ctx.orgId).eq('farm_id',farm).eq('status','pending').lte('due_date',date);if(flock)q=q.eq('flock_id',flock);return q.order('due_date').order('id').range(from,to);});
}
export async function refreshScheduler(){
 const today=addisOperatingDate(new Date());let created=0;
 const [rules,pending]=await Promise.all([
  db.from('scheduled_work_rules').select('org_id,farm_id').eq('active',true).limit(10001),
  db.from('scheduled_work_occurrences').select('org_id,farm_id').eq('status','pending').lte('due_date',today).limit(10001),
 ]);
 if(rules.error||pending.error||rules.data.length>10000||pending.data.length>10000)throw Error('SCHEDULER_FAILED');
 // Stopping future work must not stop reminders for work already promised today.
 const keys=new Map<string,{org_id:string;farm_id:string}>();for(const rule of [...rules.data,...pending.data])keys.set(rule.farm_id,rule);
 for(const rule of keys.values()){const result=await db.rpc('generate_scheduled_work',{p_org:rule.org_id,p_farm:rule.farm_id,p_today:today});if(result.error)throw Error('SCHEDULER_FAILED');created+=Number(result.data);}
 return {created};
}
