import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {readPreparedDetail} from '../src/lib/today-workspace/offline-policy.ts';

test('prepared details survive transport failure even when the browser reports online',async()=>{
  const detail={task:'feeding'},signal=new AbortController().signal;
  assert.equal(await readPreparedDetail(true,async()=>{throw Error('disconnected');},async()=>detail,signal),detail);
  assert.equal(await readPreparedDetail(false,async()=>{throw Error('must not fetch');},async()=>detail,signal),detail);
  assert.deepEqual(await readPreparedDetail(true,async()=>Response.json({task:'fresh'}),async()=>detail,signal),{task:'fresh'});
});

test('recovered editing validates its grant after failed reconnect without clearing denial state',async()=>{
  const source=await readFile(new URL('../src/components/today/offline-context.tsx',import.meta.url),'utf8');
  const start=source.indexOf('const reconnect=async()=>{'),end=source.indexOf('\n    };',start);
  assert.ok(start>=0&&end>start);
  const handler=source.slice(start+'const reconnect='.length,end+6);
  for(const denied of [false,true]){
    const state={expired:false,problem:null,checked:0};
    const reconnect=Function('navigator','runtime','setExpired','authorize','currentSelection','cancelled','check','fail',`let usingGrant=false;return ${handler}`)(
      {onLine:true},{},value=>{state.expired=value;},async()=>{if(denied)state.problem='ACCESS_CHANGED';return false;},{},false,
      async()=>{state.checked++;state.expired=false;},error=>{throw error;});
    await reconnect();
    assert.equal(state.checked,1);assert.equal(state.expired,false);
    assert.equal(state.problem,denied?'ACCESS_CHANGED':null);
    assert.equal(state.expired||Boolean(state.problem),denied);
  }
  assert.match(source,/await runtime\.assertEditable\(currentSelection\)/);
  assert.match(source,/blocked=.*Boolean\(offline\.problem\)/);
  assert.match(source,/if\(!navigator\.onLine\|\|usingGrant\)void check\(\)/);
});

test('HTTP denial, malformed responses, cancellation and missing cache never fall back to protected details',async()=>{
  const signal=new AbortController().signal;
  for(const status of [401,403,409,500,503])await assert.rejects(readPreparedDetail(true,async()=>new Response(null,{status}),async()=>{throw Error('cache must not be read');},signal),/OFFLINE_DETAIL_DENIED/);
  await assert.rejects(readPreparedDetail(true,async()=>new Response('invalid'),async()=>{throw Error('cache must not be read');},signal));
  await assert.rejects(readPreparedDetail(false,async()=>Response.json({}),async()=>undefined,signal),/OFFLINE_DETAIL_MISSING/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(readPreparedDetail(true,async()=>{throw Error('aborted');},async()=>{throw Error('cache must not be read');},controller.signal),/aborted/);
});
