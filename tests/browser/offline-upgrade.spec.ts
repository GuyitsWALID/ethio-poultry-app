import {expect,test,type Page} from '@playwright/test';
import {createServer,type Server} from 'node:http';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

declare global {
  interface Window {
    offlineAcceptance:typeof import('../../src/lib/today-workspace/offline-store');
    upgradeBlocker:IDBDatabase;
  }
}

const source=readFileSync('src/lib/today-workspace/offline-store.ts','utf8');
const worker=readFileSync('public/sw.js','utf8');
const identity={tenantId:'upgrade-test',userId:'manager',authorizedWorkDate:'2026-11-12'};
let server:Server,origin:string,revision=1,failShell=false,networkDown=false;

test.beforeAll(async()=>{
  server=createServer((request,response)=>{
    if(networkDown){request.socket.destroy();return;}
    response.setHeader('Cache-Control','no-store');
    if(request.url==='/sw.js'){
      response.setHeader('Content-Type','application/javascript');
      response.end(`// acceptance revision ${revision}\n${worker}`);
    }else if(request.url==='/offline'){
      response.setHeader('X-Offline-Shell','public-v1');
      response.setHeader('Content-Type','text/html');
      response.writeHead(failShell?503:200);
      response.end('<!doctype html><p>Safe offline shell</p><script src="/_next/static/shell.js"></script>');
    }else if(request.url==='/_next/static/shell.js'){
      response.setHeader('Content-Type','application/javascript');response.end('/* public shell */');
    }else{response.setHeader('Content-Type','text/html');response.end('<!doctype html><title>Offline acceptance</title>');}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();
  if(!address||typeof address==='string')throw Error('Missing local acceptance address');
  origin=`http://127.0.0.1:${address.port}`;
});
test.afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
test.beforeEach(async({page})=>{revision=1;failShell=false;networkDown=false;await page.goto(origin);await loadStore(page);});

async function loadStore(page:Page,version=1,abort=false){
  // Exercise the existing migration algorithm at a synthetic next version;
  // no production schema bump or invented migration is shipped by this test.
  const candidate=source.replace('export const OFFLINE_STORE_VERSION = 1;',`export const OFFLINE_STORE_VERSION = ${version};`)
    .replace('const database = request.result;',`const database = request.result;${abort?'request.transaction?.abort();':''}`);
  const script=ts.transpileModule(candidate,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  await page.addScriptTag({content:`window.offlineAcceptance=(()=>{const exports={};${script};return exports;})();`});
}
async function seed(page:Page){
  return page.evaluate(async identity=>{
    const store=await window.offlineAcceptance.openOfflineStore(identity);
    await store.putDraft({key:'draft',taskId:'health_deaths',workDate:identity.authorizedWorkDate,value:{deaths:2},updatedAt:'2026-11-12T08:00:00Z'});
    await store.putCommand({command:{schema_version:1,command_id:'saved-command',type:'confirm_no_activity',farm_id:'farm',work_date:identity.authorizedWorkDate,payload:{task_code:'routine_supplies',source_fingerprint:'original-evidence'}},state:'queued',queuedAt:'2026-11-12T08:00:00Z'});
    return {drafts:await store.listDrafts(),commands:await store.listCommands()};
  },identity);
}
async function read(page:Page){
  return page.evaluate(async identity=>{
    const store=await window.offlineAcceptance.openOfflineStore(identity);
    return {drafts:await store.listDrafts(),commands:await store.listCommands()};
  },identity);
}

test('storage upgrade closes old managed connections and preserves drafts and commands',async({page})=>{
  const original=await seed(page);
  await loadStore(page,2);
  expect(await read(page)).toEqual(original);
  await page.reload();await loadStore(page,2);
  expect(await read(page)).toEqual(original);
  await loadStore(page,1);
  expect(await page.evaluate(async identity=>{
    try{await window.offlineAcceptance.openOfflineStore(identity);return null;}catch(error){return (error as {code:string}).code;}
  },identity)).toBe('UPGRADE_FAILED');
  await loadStore(page,2);expect(await read(page)).toEqual(original);
});

test('blocked storage upgrade reports failure then recovers without losing work',async({page})=>{
  const original=await seed(page);
  await page.evaluate(async identity=>{
    window.upgradeBlocker=await new Promise<IDBDatabase>((resolve,reject)=>{
      const request=indexedDB.open(window.offlineAcceptance.identityNamespace(identity),1);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
  },identity);
  await loadStore(page,2);
  expect(await page.evaluate(async identity=>{
    try{await window.offlineAcceptance.openOfflineStore(identity);return null;}catch(error){return (error as {code:string}).code;}
  },identity)).toBe('UPGRADE_FAILED');
  await page.evaluate(()=>window.upgradeBlocker.close());
  expect(await read(page)).toEqual(original);
});

test('aborted storage upgrade rolls back safely and the old schema remains readable',async({page})=>{
  const original=await seed(page);
  await loadStore(page,2,true);
  expect(await page.evaluate(async identity=>{
    try{await window.offlineAcceptance.openOfflineStore(identity);return null;}catch(error){return (error as {code:string}).code;}
  },identity)).toBe('UPGRADE_FAILED');
  await loadStore(page,1);expect(await read(page)).toEqual(original);
});

test('failed service-worker replacement retains the active offline shell and unsent work',async({page})=>{
  const original=await seed(page);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  revision=2;failShell=true;
  expect(await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    if(!registration)throw Error('Worker registration missing');
    const active=registration.active;
    const failed=new Promise<boolean>(resolve=>registration.addEventListener('updatefound',()=>{
      const installing=registration.installing!;
      installing.addEventListener('statechange',()=>{if(installing.state==='redundant')resolve(registration.active===active);});
    },{once:true}));
    await registration.update();return failed;
  })).toBe(true);
  // Browser offline emulation differs for workers. Disconnect the local
  // server so every engine exercises a real fetch failure instead.
  networkDown=true;
  await page.goto(`${origin}/app/today`);
  await expect(page.getByText('Safe offline shell')).toBeVisible();
  await loadStore(page);expect(await read(page)).toEqual(original);
  networkDown=false;failShell=false;revision=3;
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    if(!registration)throw Error('Worker registration missing');
    const activated=new Promise<void>(resolve=>registration.addEventListener('updatefound',()=>{
      const installing=registration.installing!;
      installing.addEventListener('statechange',()=>{if(installing.state==='activated')resolve();});
    },{once:true}));
    await registration.update();await activated;
  });
  expect(await read(page)).toEqual(original);
  expect(await page.evaluate(async()=>{
    const cache=await caches.open('ethiopoultry-static-v3');return (await cache.keys()).map(request=>new URL(request.url).pathname);
  })).not.toContain('/app/today');
});
