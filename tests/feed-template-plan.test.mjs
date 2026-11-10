import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {calculateTemplateFeedPlan} from '../src/lib/feed-template-plan.ts';
import {feedPlanCopy} from '../src/i18n/feed-plan-copy.ts';
const state={rows:{},calls:[],error:null};globalThis.__feedPlan=state;
class Query{
 constructor(table){this.table=table;this.filters=[];state.calls.push(table);}
 select(){return this;} eq(column,value){this.filters.push([column,value]);return this;} is(){return this;} lte(){return this;} gte(){return this;}
 maybeSingle(){const data=(state.rows[this.table]??[]).find(row=>this.filters.every(([key,value])=>row[key]===value));return Promise.resolve({data:data??null,error:state.error});}
}
state.db={from:table=>new Query(table)};
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/lib/feed-template-plan.server.ts',import.meta.url))],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'feed-plan-fixture',setup(b){
 b.onResolve({filter:/^(server-only|@\/lib\/access-context)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='server-only'?'':'export const governanceAdmin=globalThis.__feedPlan.db;'}));
}}]});
const {loadTemplateFeedPlan}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const flock={id:'flock',batch_id:'batch',placement_date:'2026-01-01',age_at_placement_days:12,initial_count:1000,current_count:9999};
const context={orgId:'org'};
const row={feed_intake_recommended_g_per_head:120,feed_type_plan:'broiler_feed'};
function reset(){state.error=null;state.calls=[];state.rows={batch_feed_templates:[{id:'template',org_id:'org',batch_id:'batch',is_active:true,name:'Broiler plan'}],batch_feed_template_rows:[{template_id:'template',...row}],daily_farm_records:[{org_id:'org',flock_id:'flock',record_date:'2026-11-10',opening_birds:1000}]};}
test('selected-date template target includes arrival age, works past 90 days and does not read generated schedules',async()=>{
 reset();const result=await loadTemplateFeedPlan(context,flock,'2026-11-10');
 assert.equal(result.state,'ready');assert.equal(result.ageDays,325);assert.equal(result.dailyKg,120);assert.equal(result.feedType,'broiler_feed');
 assert.ok(!state.calls.includes('feeding_schedules'));
});
test('missing templates/ranges/populations stay unavailable; current flock count is not a historical substitute',async()=>{
 reset();state.rows.batch_feed_templates=[];assert.equal((await loadTemplateFeedPlan(context,flock,'2026-11-10')).state,'missing_template');
 reset();state.rows.batch_feed_template_rows=[];assert.equal((await loadTemplateFeedPlan(context,flock,'2026-11-10')).state,'missing_age_range');
 reset();state.rows.daily_farm_records=[];assert.equal((await loadTemplateFeedPlan(context,flock,'2026-11-10')).state,'missing_population');
 reset();state.rows.daily_farm_records=[{org_id:'org',flock_id:'flock',record_date:'2026-11-09',closing_birds:900}];assert.equal((await loadTemplateFeedPlan(context,flock,'2026-11-10')).dailyKg,108);
 reset();state.error={message:'Read failed'};await assert.rejects(loadTemplateFeedPlan(context,flock,'2026-11-10'),/Read failed/);
});
test('zero is preserved, invalid feed types never default to layer, and target is per day not per session',()=>{
 assert.equal(calculateTemplateFeedPlan(20,'Plan',row,0).dailyKg,0);
 assert.equal(calculateTemplateFeedPlan(20,'Plan',{...row,feed_type_plan:'unknown'},100).state,'invalid_template');
 assert.equal(calculateTemplateFeedPlan(20,'Plan',{...row,feed_intake_recommended_g_per_head:null},100).state,'invalid_template');
 assert.equal(calculateTemplateFeedPlan(20,'Plan',row,123).dailyKg,14.76);
 assert.deepEqual(Object.keys(feedPlanCopy.en).sort(),Object.keys(feedPlanCopy.am).sort());
});
