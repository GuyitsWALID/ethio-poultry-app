import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const id=n=>`99000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const revision='a'.repeat(64);
const state={rows:{},calls:[],access:true,mode:'archive'};globalThis.__historyJobs=state;
class Query{
 constructor(table){this.table=table;this.filters=[];this.orders=[];this.cap=Infinity;this.from=0;this.to=Infinity;state.calls.push(['table',table]);}
 select(){return this;}eq(k,v){this.filters.push(r=>r[k]===undefined||r[k]===v);return this;}
 in(k,v){this.filters.push(r=>v.includes(r[k]));return this;}is(){return this;}not(){return this;}
 lt(){return this;}lte(){return this;}order(k,o){this.orders.push([k,o?.ascending!==false]);return this;}
 limit(n){this.cap=n;return this;}range(a,b){this.from=a;this.to=b;return this;}
 or(value){if(value.startsWith('record_date.lt.')){const [,date,,same,,key]=value.match(/record_date.lt.([^,]+),and\((record_date.eq).([^,]+),(id.lt).([^)]+)\)/);this.filters.push(r=>r.record_date<date||(r.record_date===same&&r.id<key));}return this;}
 result(single=false){let rows=(state.rows[this.table]??[]).filter(r=>this.filters.every(f=>f(r)));rows.sort((a,b)=>{for(const [k,asc]of this.orders){if(a[k]!==b[k])return(a[k]<b[k]?-1:1)*(asc?1:-1);}return 0;});rows=rows.slice(this.from,Math.min(this.to+1,this.from+this.cap));return {data:single?rows[0]??null:rows,error:null};}
 maybeSingle(){return Promise.resolve(this.result(true));}single(){return this.maybeSingle();}then(a,b){return Promise.resolve(this.result()).then(a,b);}
}
state.db={from:t=>new Query(t),rpc:async(name,args)=>{
 state.calls.push(['rpc',name,args]);
 if(name==='archived_cycle_revision')return {data:revision,error:null};
 if(name==='archived_cycle_sale_choices')return {data:[],error:null};
 if(name==='due_management_report_schedules')return {data:state.schedules.filter(s=>!args.p_after_id||s.id>args.p_after_id).slice(0,20),error:null};
 if(name==='record_report_schedule_failure')return {data:true,error:null};
 if(name==='today_farm_resource_tokens')return {data:{operating_revision:'operating',flocks:args.p_flocks.map(f=>({flock_id:f,daily_record_id:null,daily_revision:null,feed_revision:'feed',health_fingerprint:'health',supplies_fingerprint:'supplies',start_context:null}))},error:state.tokenError??null};
 throw Error(name);
}};
const bundle=await build({stdin:{contents:`export {loadArchivedCorrectionContext,prepareArchivedCorrection} from './src/lib/flock-lifecycle/archived-corrections';export {loadTodayWorkspace} from './src/lib/today-workspace/workspace';export {dispatchScheduledManagementReports} from './src/lib/management-reports';`,resolveDir:root},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'job-boundaries',setup(b){
 b.onResolve({filter:/^(server-only|@\/lib\/(access-context|scheduler\/server|farm-performance.server|flock-lifecycle\/server)|\.\/server)$/},a=>({path:a.path,namespace:'stub'}));
 b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='server-only'?'':a.path.endsWith('access-context')?'const s=globalThis.__historyJobs;export const governanceAdmin=s.db;export const canAccessFarm=async()=>s.access;':a.path.endsWith('scheduler/server')?'export const dueScheduledWork=async()=>[];':a.path.endsWith('farm-performance.server')?'export const loadFarmPerformance=async()=>{throw Error("Not invoked")};':'export class FlockLifecycleError extends Error{constructor(code,status){super(code);this.code=code;this.status=status;}}export const addisOperatingDate=()=>"2026-11-10";'}));
}}]});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text+'\n//# sourceURL=history-jobs-bundle.mjs').toString('base64')}`);
const ctx={userId:id(1),orgId:id(2),role:'farm_manager',supportSessionId:null};
function archive(){state.calls=[];state.access=true;state.rows={batch_cycles:[{id:id(3),cycle_code:'Cycle',farm_id:id(4),status:'archived',completion_verified:true}],batches:[{id:id(5),batch_cycle_id:id(3)}],flocks:[0,1].map(i=>({id:id(6+i),flock_code:`Flock ${i}`,house_id:id(8+i),farm_id:id(4),batch_id:id(5)})),houses:[0,1].map(i=>({id:id(8+i),name:`House ${i}`})),batch_cycle_closures:[{cycle_id:id(3),mode:'close'}],batch_cycle_clearances:[]};
 state.rows.daily_farm_records=Array.from({length:600},(_,i)=>({id:id(100+i),flock_id:id(6+i%2),record_date:new Date(Date.UTC(2026,0,1+Math.floor(i/2))).toISOString().slice(0,10),opening_birds:100,closing_birds:100,deaths:0,culls:0,transfers_in:0,transfers_out:0,other_removals:0}));}
test('archived corrections page all 600 records without duplicates and fetch an older exact record',async()=>{
 archive();const seen=[];let cursor;
 do{const page=await api.loadArchivedCorrectionContext(ctx,id(3),{cursor});assert(page.records.length<=50);seen.push(...page.records.map(r=>r.id));cursor=page.nextCursor;}while(cursor);
 assert.equal(seen.length,600);assert.equal(new Set(seen).size,600);
 const exact=await api.loadArchivedCorrectionContext(ctx,id(3),{recordIds:[id(100)],revision});assert.equal(exact.records[0].id,id(100));
 const row=state.rows.daily_farm_records[0];const {id:recordId,...values}=row;delete values.flock_id;delete values.record_date;
 await api.prepareArchivedCorrection(ctx,{farm_id:id(4),proposed_values:{cycle_id:id(3),expected_revision:revision,supporting_reference:'Reviewed evidence',records:[{id:recordId,...values}]}});
 await assert.rejects(api.loadArchivedCorrectionContext(ctx,id(3),{recordIds:[id(9999)]}));
 await assert.rejects(api.loadArchivedCorrectionContext(ctx,id(3),{recordIds:[recordId],revision:'stale'}));
 state.access=false;await assert.rejects(api.loadArchivedCorrectionContext(ctx,id(3)));
});
test('Today request count stays constant for 1, 4, 8 and 12 flocks, including missing baselines',async()=>{
 const counts=[];
 for(const n of [1,4,8,12]){
  state.calls=[];state.access=true;state.tokenError=null;state.rows={organizations:[{today_workspace_enabled:true}],profiles:[{preferred_locale:'en'}],farms:[{id:id(4),name:'Farm',branch_id:id(10)}],flocks:Array.from({length:n},(_,i)=>({id:id(20+i),flock_code:`Flock ${i}`,flock_type:'layer',farm_id:id(4),house_id:id(40+i),batch_id:id(60+i),placement_date:'2026-01-01',initial_count:100,current_count:100,completed_at:null})),houses:[],batches:[]};
  await api.loadTodayWorkspace(ctx,{farmId:id(4),workDate:'2026-11-10'});
  counts.push(state.calls.length);assert.equal(state.calls.filter(c=>c[0]==='rpc').length,1);
  assert.equal(state.calls.find(c=>c[1]==='today_farm_resource_tokens')[2].p_starts.length,n);
 }
 assert.deepEqual(counts,Array(4).fill(counts[0]));assert(counts[0]<30);
 state.tokenError={message:'Failed'};await assert.rejects(api.loadTodayWorkspace(ctx,{farmId:id(4),workDate:'2026-11-10'}));
});
test('21 invalid schedules are isolated, persisted and advanced beyond the first due page',async()=>{
 state.calls=[];state.rows={profiles:[{role:'farm_manager',is_active:true}]};state.schedules=Array.from({length:21},(_,i)=>({id:id(100+i),created_by:id(1),org_id:id(2),cadence:'weekly',lookback_days:30,next_run_at:'2026-11-01T07:00:00Z',updated_at:'2026-11-01T00:00:00Z',dispatch_failures:0}));
 const result=await api.dispatchScheduledManagementReports('https://example.invalid');assert.equal(result.due,21);assert.equal(result.failed,21);
 assert.equal(state.calls.filter(c=>c[1]==='record_report_schedule_failure').length,21);
 assert.equal(state.calls.filter(c=>c[1]==='due_management_report_schedules').length,2);
});
