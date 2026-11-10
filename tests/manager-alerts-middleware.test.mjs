import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const state={role:'farm_manager',user:true};globalThis.__alertsMiddleware=state;
const bundle=await build({entryPoints:[fileURLToPath(new URL('../middleware.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'middleware-fixture',setup(b){
 b.onResolve({filter:/^(next\/server|@\/utils\/supabase\/middleware)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='next/server'?'export const NextResponse={next:()=>({next:true}),redirect:url=>({redirect:url.pathname})};':`const s=globalThis.__alertsMiddleware;export const createClient=()=>({response:{next:true},supabase:{auth:{getUser:async()=>({data:{user:s.user?{id:'manager'}:null}})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{role:s.role,is_active:true}})})}});`}));
}}]});
const {middleware}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const request=pathname=>({nextUrl:{pathname,clone:()=>({pathname,searchParams:new URLSearchParams()})},cookies:{get:()=>null}});
test('Farm Managers and CEOs reach Alerts and exact action targets without a dashboard redirect',async()=>{
 for(const role of ['farm_manager','ceo']){state.role=role;state.user=true;for(const path of ['/app/alerts','/app/alerts/actions/exact'])assert.equal((await middleware(request(path))).next,true);}
});
test('manager executive restrictions and unauthenticated Alerts remain protected',async()=>{
 state.role='farm_manager';state.user=true;assert.equal((await middleware(request('/app/users'))).redirect,'/app/farm-manager');assert.equal((await middleware(request('/app/ceo'))).redirect,'/app/farm-manager');
 state.user=false;assert.equal((await middleware(request('/app/alerts'))).redirect,'/auth/sign-in');state.user=true;
});
