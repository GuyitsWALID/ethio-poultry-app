import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function worker(fail=false){
 const handlers=new Map(),stores=new Map([['ethiopoultry-static-v1',new Map([['old',new Response('old')]])]]);let activated=false;
 const fetch=async path=>{if(typeof path==='object'&&path.mode==='navigate')throw Error('offline');if(String(path)==='/offline')return new Response('<script src="/_next/static/shell.js"></script>',{headers:{'X-Offline-Shell':'public-v1'}});if(fail)throw Error('quota or interrupted upgrade');return new Response('asset');};
 const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async key=>{
  const values=stores.get(key)??new Map();stores.set(key,values);
  return {addAll:async paths=>{for(const path of paths)values.set(path,await fetch(path));},put:async(key,value)=>values.set(key,value),match:async key=>values.get(typeof key==='string'?key:key.url)};
 }};
 const self={location:{origin:'https://farm.test'},addEventListener:(type,handler)=>handlers.set(type,handler),skipWaiting:async()=>{activated=true;},clients:{claim(){},matchAll:async()=>[]}};
 runInNewContext(source,{self,caches,fetch,Response,URL,Error});
 return {handlers,stores,activated:()=>activated};
}
test('public shell is credential-free and failed upgrade preserves previous cache',async()=>{
 assert.match(readFileSync(new URL('../next.config.ts',import.meta.url),'utf8'),/source: "\/offline", headers: \[\{key: "X-Offline-Shell", value: "public-v1"\}\]/);
 assert.match(source,/credentials:"omit"/);assert.doesNotMatch(source,/indexedDB|localStorage/);
 const state=worker(true);let installation;
 state.handlers.get('install')({waitUntil:value=>{installation=value;}});
 await assert.rejects(installation,/upgrade/);
 assert.equal(state.activated(),false);assert.ok(state.stores.get('ethiopoultry-static-v1').has('old'));
});
test('offline Today navigation gets only generic shell; API and other protected pages are never cached',async()=>{
 const state=worker();let installation;state.handlers.get('install')({waitUntil:value=>{installation=value;}});await installation;
 assert.equal(state.activated(),true);
 let recovery;state.handlers.get('fetch')({request:{method:'GET',mode:'navigate',url:'https://farm.test/app/today'},respondWith:value=>{recovery=value;}});
 assert.equal(await (await recovery).text(),'<script src="/_next/static/shell.js"></script>');
 for(const path of ['/api/me/context','/app/ceo','/app/inventory']){
  let intercepted=false;state.handlers.get('fetch')({request:{method:'GET',mode:'navigate',url:`https://farm.test${path}`},respondWith(){intercepted=true;}});assert.equal(intercepted,false);
 }
});
