import assert from 'node:assert/strict';
import test from 'node:test';
import {MemoryOfflineStore} from '../src/lib/today-workspace/offline-store.ts';
import {offlineEditDecision} from '../src/lib/today-workspace/offline-policy.ts';
import {TodayOfflineRuntime, taskDraftKey, remainingDraft} from '../src/lib/today-workspace/offline-runtime.ts';

const identity={tenantId:'org',userId:'manager',authorizedWorkDate:'2026-10-10'};
const selection={farmId:'farm',flockId:'flock',workDate:'2026-10-10'};
const grant={tenantId:'org',userId:'manager',farmId:'farm',flockIds:['flock'],workDate:'2026-10-10',issuedAt:'2026-10-10T09:00:00Z',expiresAt:'2026-10-10T21:00:00Z'};
const workspace={farm:{id:'farm'},workDate:selection.workDate,offlineAccess:grant};
const command=(id='one')=>({schema_version:1,command_id:id,type:'save_daily_record',farm_id:'farm',flock_id:'flock',work_date:selection.workDate,expected_resource_revision:'original',payload:{value:3}});
const applied=async c=>({command_id:c.command_id,status:'applied'});
const key=taskDraftKey(selection,'birds');
const draft={key,taskId:'birds',workDate:selection.workDate,value:{count:3},updatedAt:grant.issuedAt};
async function setup(){const store=new MemoryOfflineStore();const state={online:true,now:1000};const runtime=new TodayOfflineRuntime(store,identity,()=>state.online,()=>state.now);await runtime.rememberWorkspace(workspace);return{store,state,runtime};}

test('offline lease uses server operating day despite initial device clock skew',()=>{
 const stored={grant,receivedAt:1000,lastSeenAt:1000};
 assert.equal(offlineEditDecision(stored,identity,selection,2000),'allowed');
 assert.equal(offlineEditDecision(stored,identity,selection,1000+12*3600000),'expired');
 assert.equal(offlineEditDecision(stored,identity,selection,999),'clock_changed');
 assert.equal(offlineEditDecision({...stored,lastSeenAt:3000},identity,selection,2000),'clock_changed');
});
test('offline lease rejects identity, farm, flock, historical day and malformed boundaries',()=>{
 const stored={grant,receivedAt:1000,lastSeenAt:1000};
 for(const bad of [{...identity,userId:'other'},{...identity,tenantId:'other'}])assert.equal(offlineEditDecision(stored,bad,selection,1000),'not_authorized');
 for(const bad of [{...selection,farmId:'other'},{...selection,flockId:'other'},{...selection,workDate:'2026-10-09'}])assert.equal(offlineEditDecision(stored,identity,bad,1000),'not_authorized');
 for(const bad of [{...grant,expiresAt:'2026-10-11T00:00:00Z'},{...grant,issuedAt:'2026-10-09T09:00:00Z'},{...grant,workDate:'invalid'}])assert.equal(offlineEditDecision({...stored,grant:bad},identity,{...selection,workDate:bad.workDate},1000),'not_authorized');
});
test('offline drafts and saves survive expiry but cannot be edited or sent offline',async()=>{
 const {store,state,runtime}=await setup();state.online=false;
 await runtime.saveDraft(selection,draft);await runtime.enqueue(command(),key);
 assert.equal((await store.listCommands())[0].command.expected_resource_revision,'original');
 state.now+=12*3600000;
 await assert.rejects(runtime.saveDraft(selection,{...draft,value:4}),/OFFLINE_EXPIRED/);
 await assert.rejects(runtime.enqueue(command('two'),'other'),/OFFLINE_EXPIRED/);
 assert.equal(await runtime.drain(applied,async()=>true),undefined);
 assert.deepEqual((await store.getDraft(key)).value,{count:3});
});
test('duplicate command retains receipt identity; changed mutable edits explicitly chain receipts',async()=>{
 const {runtime,store}=await setup();await runtime.enqueue(command(),key);await runtime.enqueue(command(),key);
 assert.equal((await store.listCommands()).length,1);
 await assert.rejects(runtime.enqueue({...command(),payload:{value:4}},key),/COMMAND_ID_REUSED/);
 await runtime.enqueue({...command('two'),payload:{value:4}},'other');
 const next=(await store.listCommands()).find(row=>row.command.command_id==='two').command;
 assert.equal(next.expected_resource_revision,'original');
 assert.equal(next.revision_from,'one');assert.deepEqual(next.depends_on,['one']);
 await runtime.enqueue({...command('two'),payload:{value:4}},'other');
 assert.equal((await store.listCommands()).length,2);
});

test('complete offline day chains sessions before close, daily edits after close and zero confirmations after evidence',async()=>{
 const {runtime,store}=await setup();
 await runtime.enqueue(command('birds'),key);
 const feed={...command('session1'),type:'save_feed_session',payload:{session:{session_name:'First'}}};
 await runtime.enqueue(feed,'feeding');
 await runtime.enqueue({...feed,command_id:'session2',payload:{session:{session_name:'Second'}}},'feeding');
 await runtime.enqueue({...command('close'),type:'close_feed_day',payload:{}},'feeding');
 await runtime.enqueue({...command('water'),payload:{water:123}},'eggs');
 await runtime.enqueue({...command('none'),type:'confirm_no_activity',payload:{task_code:'health_deaths',source_fingerprint:'original'}},'health');
 const commands=(await store.listCommands()).map(row=>row.command);
 assert.equal(commands[2].revision_from,'session1');
 assert.equal(commands[3].revision_from,'session2');assert.equal(commands[3].daily_revision_from,'birds');
 assert.equal(commands[4].revision_from,'close');assert.equal(commands[5].fingerprint_from,'water');
 const sent=[];await runtime.drain(async command=>{sent.push(command.command_id);return applied(command);},async()=>true);
 assert.deepEqual(sent,['birds','session1','session2','close','water','none']);
});

test('distinct append-only commands with identical values are not silently discarded',async()=>{
 for(const type of ['record_expense','record_sale','save_feed_session']){
  const {runtime,store}=await setup();
  await runtime.enqueue({...command('first'),type},key);
  await runtime.enqueue({...command('second'),type},key);
  assert.equal((await store.listCommands()).length,2);
 }
});

test('a later unsent draft survives application of an older queued edit',async()=>{
 const {runtime,store}=await setup();await runtime.saveDraft(selection,draft);await runtime.enqueue(command(),key);
 await runtime.saveDraft(selection,{...draft,value:{count:4},updatedAt:'later'});
 await runtime.drain(applied,async()=>true);
 assert.deepEqual((await store.getDraft(key)).value,{count:4});
});
test('reconnect rechecks authorization and applied result clears only its draft',async()=>{
 const {runtime,store}=await setup();await runtime.saveDraft(selection,draft);await runtime.enqueue(command(),key);
 assert.equal(await runtime.drain(()=>assert.fail('unauthorized send'),async()=>false),undefined);
 const result=await runtime.drain(applied,async()=>true);assert.deepEqual(result.applied,['one']);
 assert.equal(await store.getDraft(key),undefined);assert.equal((await store.listCommands()).length,0);
});
test('conflict and mismatched results preserve original inputs',async()=>{
 for(const response of [{command_id:'one',status:'conflict'},{command_id:'wrong',status:'applied'}]){
  const {runtime,store}=await setup();await runtime.saveDraft(selection,draft);await runtime.enqueue(command(),key);
  await runtime.drain(async()=>response,async()=>true);
  assert.deepEqual((await store.getDraft(key)).value,{count:3});assert.equal((await store.listCommands()).length,1);
 }
});
test('storage failures never acknowledge an unpersisted save or hide draft recovery failure',async()=>{
 const {runtime,store}=await setup();store.putCommand=async()=>{throw Error('quota');};
 await assert.rejects(runtime.enqueue(command(),key),/quota/);assert.equal((await store.listCommands()).length,0);
 const next=await setup();await next.runtime.saveDraft(selection,draft);await next.runtime.enqueue(command(),key);
 next.store.removeDraft=async()=>{throw Error('draft recovery');};
 await assert.rejects(next.runtime.drain(applied,async()=>true),/draft recovery/);
 assert.ok(await next.store.getDraft(key));
 assert.equal((await next.store.listCommands())[0].command.command_id,'one');
 next.store.removeDraft=MemoryOfflineStore.prototype.removeDraft.bind(next.store);
 const replayed=[];
 await next.runtime.drain(async command=>{replayed.push(command.command_id);return applied(command);},async()=>true);
 assert.deepEqual(replayed,['one']);
 assert.equal((await next.store.listCommands()).length,0);
 assert.equal(await next.store.getDraft(key),undefined);
});
test('finish is online-only and refuses drafts, queues and expired authorization',async()=>{
 const {runtime,store,state}=await setup();const finish={...command(),type:'finish_operating_day'};
 await assert.rejects(runtime.finish(command(),applied,async()=>true),/INVALID_FINISH_COMMAND/);
 state.online=false;await assert.rejects(runtime.finish(finish,applied,async()=>true),/ONLINE_REQUIRED/);state.online=true;
 await runtime.saveDraft(selection,draft);await assert.rejects(runtime.finish(finish,applied,async()=>true),/UNSYNCED_WORK/);
 await store.removeDraft(key);await runtime.enqueue(command(),key);await assert.rejects(runtime.finish(finish,applied,async()=>true),/UNSYNCED_WORK/);
 await store.removeCommand('one');await assert.rejects(runtime.finish(finish,applied,async()=>false),/OFFLINE_NOT_AUTHORIZED/);
 assert.equal((await runtime.finish(finish,applied,async()=>true)).status,'applied');
 await assert.rejects(runtime.enqueue(finish,key),/ONLINE_REQUIRED/);
});

test('finish waits for an in-flight draft write before checking unsynced work',async()=>{
 const {runtime,store}=await setup();
 const put=store.putDraft.bind(store);let release;
 const held=new Promise(resolve=>{release=resolve;});
 store.putDraft=async row=>{if(row.key===key)await held;return put(row);};
 const saving=runtime.saveDraft(selection,draft);
 const finishing=runtime.finish({...command(),type:'finish_operating_day'},()=>assert.fail('unsaved work must block finish'),async()=>true);
 release();await saving;
 await assert.rejects(finishing,/UNSYNCED_WORK/);
});

test('partial health saves preserve other unsent forms and their original revision',()=>{
 const health={...draft,taskId:'health_deaths',value:{revision:'original',fields:{'health.selected':['death','health','vaccination'],'field:loss:death_count':'2','field:health:description':'Unsent treatment','field:vaccination:quantity':'3'}}};
 const afterLoss=remainingDraft(health,{...command(),payload:{record:{_today_bird_loss:{deaths:2}}}});
 assert.deepEqual(afterLoss.value.fields['health.selected'],['health','vaccination']);
 assert.equal(afterLoss.value.fields['field:loss:death_count'],undefined);
 assert.equal(afterLoss.value.fields['field:health:description'],'Unsent treatment');
 assert.equal(afterLoss.value.revision,'original');
 const afterHealth=remainingDraft(afterLoss,{...command(),type:'record_health_event'});
 assert.deepEqual(afterHealth.value.fields['health.selected'],['vaccination']);
 assert.equal(afterHealth.value.fields['field:vaccination:quantity'],'3');
 assert.equal(remainingDraft(afterHealth,{...command(),type:'complete_vaccination'}),undefined);
});
