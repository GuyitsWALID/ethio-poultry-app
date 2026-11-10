import assert from 'node:assert/strict';
import test from 'node:test';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

const state={rows:{},failure:null,calls:[]};
globalThis.__todayInventoryPagination=state;
class Query {
  constructor(table){this.table=table;}
  select(){return this;} eq(){return this;} in(){return this;} or(){return this;} order(){return this;}
  maybeSingle(){return Promise.resolve({data:state.rows[this.table]?.[0]??null,error:null});}
  range(from,to){state.calls.push([this.table,from]);return Promise.resolve({data:state.rows[this.table]?.slice(from,to+1)??[],error:state.failure?.table===this.table&&from>=500?{message:'stock read failed'}:null});}
}
state.db={from:table=>new Query(table)};
const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/lib/today-workspace/task-details.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'inventory-fixture',setup(b){
 b.onResolve({filter:/^(server-only|@\/lib\/access-context|@\/lib\/warehouse-access|@\/lib\/expenses|@\/lib\/scheduler\/server|\.\/workspace)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='server-only'?'':a.path.endsWith('scheduler/server')?'export const dueScheduledWork=async()=>[];':a.path.endsWith('expenses')?'export const expenseTemplates=async()=>[];':a.path.endsWith('access-context')?'export const governanceAdmin=globalThis.__todayInventoryPagination.db;export const canAccessFarm=async()=>true;':a.path.endsWith('warehouse-access')?'export const effectiveWarehouseIds=async()=>["store"];':'export class TodayWorkspaceError extends Error {}'}));
}}]});
const {loadTodayTaskDetail}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const context={role:'farm_manager',orgId:'org'};
const input={task:'expenses',farmId:'farm',workDate:'2026-11-10'};
test('Today stock includes every item and movement beyond API row caps',async()=>{
 state.rows={organizations:[{today_workspace_enabled:true}],farms:[{branch_id:'branch'}],warehouses:[{id:'store',name:'Store',farm_id:'farm',branch_id:'branch'}],
 inventory_items:Array.from({length:1201},(_,i)=>({id:`item${i}`,name:`Item ${i}`,category:'feed',unit:'kg'})),
 stock_ledger:Array.from({length:1501},(_,i)=>({item_id:'item0',warehouse_id:'store',quantity:1,transaction_type:i===1500?'issue':'receipt'}))};
 const detail=await loadTodayTaskDetail(context,input);
 assert.equal(detail.inventory.length,1201);
 assert.equal(detail.inventory[0].balances[0].quantity,1499);
 assert.ok(state.calls.some(([table,from])=>table==='stock_ledger'&&from===1500));
});
test('Today never returns a partial stock balance after a later page fails',async()=>{
 state.failure={table:'stock_ledger'};
 await assert.rejects(loadTodayTaskDetail(context,input),/stock read failed/);
 state.failure=null;
});
