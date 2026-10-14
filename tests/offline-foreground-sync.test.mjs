import assert from 'node:assert/strict';
import test from 'node:test';
import {MemoryOfflineStore} from '../src/lib/today-workspace/offline-store.ts';
import {startForegroundSync} from '../src/lib/today-workspace/foreground-sync.ts';

const flush = () => new Promise(resolve => setImmediate(resolve));
const row = {command: {schema_version:1,command_id:'queued',type:'save_feed_session',farm_id:'farm',work_date:'2026-10-10',payload:{}},state:'queued',queuedAt:'2026-10-10T09:00:00Z'};
function environment() {
  const state = {online:true,visible:true,timers:[],unlistened:false,locked:false};
  const host = {
    online:()=>state.online, visible:()=>state.visible,
    listen(wake) {state.wake=wake;return ()=>{state.unlistened=true;};},
    schedule(wake,delay) {const timer={wake,delay};state.timers.push(timer);return timer;},
    cancel(timer) {state.timers=state.timers.filter(item=>item!==timer);},
    withLock:async (_name,run)=>state.locked?undefined:run(),
  };
  return {state,host};
}

test('foreground drain refreshes authorization and resumes on reconnect',async()=>{
  const store=new MemoryOfflineStore();await store.putCommand(row);
  const {state,host}=environment();state.online=false;
  const order=[];
  const sync=startForegroundSync({store,host,lockName:'identity',beforeSync:async()=>{order.push('authorize');return true;},send:async command=>{order.push('send');return{command_id:command.command_id,status:'applied'};},onSummary:()=>order.push('summary'),onError:assert.fail});
  await flush();assert.deepEqual(order,[]);
  state.online=true;state.wake();await flush();
  assert.deepEqual(order,['authorize','send','summary']);
  assert.equal((await store.listCommands()).length,0);sync.stop();
  assert.equal(state.unlistened,true);
});

test('failed authorization preserves work until an explicit refreshed wake',async()=>{
  const store=new MemoryOfflineStore();await store.putCommand(row);
  const {host}=environment();let allowed=false,calls=0;
  const sync=startForegroundSync({store,host,lockName:'identity',beforeSync:async()=>allowed,send:async command=>{calls++;return{command_id:command.command_id,status:'applied'};},onSummary:()=>{},onError:assert.fail});
  await flush();assert.equal(calls,0);assert.equal((await store.listCommands()).length,1);
  allowed=true;sync.wake();await flush();assert.equal(calls,1);sync.stop();
});

test('retry timer follows persisted backoff and stop cancels it',async()=>{
  const store=new MemoryOfflineStore();await store.putCommand(row);
  const {state,host}=environment();let clock=Date.parse('2026-10-10T09:00:00Z'),calls=0;
  const sync=startForegroundSync({store,host,lockName:'identity',now:()=>clock,beforeSync:async()=>true,send:async command=>{calls++;if(calls===1)throw Error('offline');return{command_id:command.command_id,status:'applied'};},onSummary:()=>{},onError:assert.fail});
  await flush();assert.equal(state.timers[0].delay,1000);
  clock+=1000;state.timers.shift().wake();await flush();
  assert.equal(calls,2);assert.equal((await store.listCommands()).length,0);
  sync.stop();assert.equal(state.timers.length,0);
});

test('hidden and stopped clients do not drain and another tab lock is respected',async()=>{
  const store=new MemoryOfflineStore();await store.putCommand(row);
  const {state,host}=environment();state.visible=false;let calls=0;
  const sync=startForegroundSync({store,host,lockName:'identity',beforeSync:async()=>true,send:async command=>{calls++;return{command_id:command.command_id,status:'applied'};},onSummary:()=>{},onError:assert.fail});
  await flush();assert.equal(calls,0);
  state.visible=true;state.locked=true;sync.wake();await flush();
  assert.equal(calls,0);assert.equal(state.timers[0].delay,1000);
  sync.stop();assert.equal(state.timers.length,0);sync.wake();await flush();assert.equal(calls,0);
});

test('storage failures surface without automatic retry or queue deletion',async()=>{
  const store=new MemoryOfflineStore();await store.putCommand(row);
  store.listCommands=async()=>{throw Error('storage unavailable');};
  const {state,host}=environment();const errors=[];
  const sync=startForegroundSync({store,host,lockName:'identity',beforeSync:async()=>true,send:async()=>assert.fail('must not send'),onSummary:()=>assert.fail('must not claim sync'),onError:error=>errors.push(error.message)});
  await flush();assert.deepEqual(errors,['storage unavailable']);assert.equal(state.timers.length,0);sync.stop();
});

test('Today runtime drain runs after authorization and replaces the generic drain',async()=>{
  const store=new MemoryOfflineStore();await store.putCommand(row);
  const {host}=environment();const order=[];
  const summary={applied:['queued'],conflicts:[],rejected:[],blocked:[],deferred:[],offline:false,authorizationRequired:false};
  const sync=startForegroundSync({store,host,lockName:'identity',beforeSync:async()=>{order.push('authorize');return true;},send:async()=>assert.fail('must use runtime drain'),drain:async()=>{order.push('runtime');return summary;},onSummary:result=>{assert.equal(result,summary);order.push('summary');},onError:assert.fail});
  await flush();assert.deepEqual(order,['authorize','runtime','summary']);sync.stop();
});
