import assert from "node:assert/strict";
import test from "node:test";
import {build} from "esbuild";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const id = n => `88000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const state = {calls: [], ctx: {}, rows: {}, access: true};
globalThis.__securityContainment = state;
class Query {
  constructor(table) {this.table=table; state.calls.push(["from",table]);}
  select(_columns, options) {this.head=options?.head; return this;}
  eq() {return this;} is() {return this;} or() {return this;} in() {return this;} order() {return this;} limit() {return this;}
  insert() {return this;} upsert() {return this;} update() {return this;}
  maybeSingle() {return Promise.resolve({data: state.rows[this.table]?.[0] ?? null, error:null});}
  single() {return this.maybeSingle();}
  then(resolve,reject) {return Promise.resolve({data:this.head?null:state.rows[this.table]??[],count:(state.rows[this.table]??[]).length,error:null}).then(resolve,reject);}
}
state.db = {
  from: table=>new Query(table),
  rpc: async (name,args)=>{state.calls.push(["rpc",name,args]); return name==="notification_recipient_has_access"?{data:state.access,error:state.accessError??null}:{data:{events:[],revision:"new"},error:state.rpcError??null};},
  auth: {admin: {
    createUser: async data=>{state.calls.push(["createUser",data]);return {data:{user:{id:id(9)}},error:null};},
    deleteUser: async ()=>({error:null}),
    getUserById: async ()=>{state.calls.push(["emailLookup"]);return {data:{user:{email:"test@example.invalid"}},error:null};},
  }},
};
const root=fileURLToPath(new URL("..",import.meta.url));
const bundle=await build({stdin:{contents:`export {POST as onboard} from "./src/app/api/admin/onboard/route";
export {POST as setup} from "./src/app/api/ceo/setup/route";
export {POST as template} from "./src/app/api/feed/templates/route";
export {POST as legacyWeight} from "./src/app/api/scheduler/legacy-weight/route";
export {PATCH as health} from "./src/app/api/health/events/route";
export {loadNotificationCenter,dispatchNotificationOutbox} from "./src/lib/notification-service";`,resolveDir:root},bundle:true,write:false,format:"esm",platform:"node",plugins:[{name:"security-boundaries",setup(b){
  b.onResolve({filter:/^(server-only|next\/server|next-intl\/server|@supabase\/supabase-js|@\/lib\/(access-context|audit-ledger|feed-control|farm-operations|governance-workflow|notification-email))$/},a=>({path:a.path,namespace:"security"}));
  b.onLoad({filter:/.*/,namespace:"security"},a=>({contents:(()=>{
    const pre="const s=globalThis.__securityContainment;";
    if(a.path==="server-only")return "";
    if(a.path==="next/server")return "export const NextResponse=Response;";
    if(a.path==="next-intl/server")return "export const getTranslations=async()=>key=>key;";
    if(a.path==="@supabase/supabase-js")return pre+"export const createClient=()=>s.db;";
    if(a.path.endsWith("access-context"))return pre+"export const governanceAdmin=s.db;export const getAccessContext=async()=>s.ctx;export const isAccessResponse=v=>v instanceof Response;export const accessJson=(v,status=200)=>Response.json(v,{status});";
    if(a.path.endsWith("audit-ledger"))return "export const recordAuditEvent=async()=>{};";
    if(a.path.endsWith("feed-control"))return pre+"export const getFeedContext=async()=>s.feed;export const feedJson=(v,status=200)=>Response.json(v,{status});export const resolveFeedBatch=async()=>({batch:{farm_id:'farm',batch_code:'Batch'}});export const validateTemplateRows=()=>null;";
    if(a.path.endsWith("farm-operations"))return "export class FarmOperationError extends Error{};export const farmOperationErrorBody=()=>{};export const recordHealthEvidence=()=>{};";
    if(a.path.endsWith("governance-workflow"))return pre+"export const submitGovernanceRequest=async(_ctx,input)=>{s.calls.push(['governance',input]);return {id:'request'};};";
    if(a.path.endsWith("notification-email"))return pre+"export const emailDeliveryReadiness=()=>({available:true});export const sendNotificationEmail=async()=>{s.calls.push(['send']);return {providerMessageId:'test'};};";
    throw Error(a.path);
  })()}));
}}]});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
function reset(role="farm_manager") {state.ctx={role,userId:id(1),orgId:id(2),supportSessionId:null};state.calls=[];state.rows={};state.rpcError=null;state.access=true;state.accessError=null;state.feed={canManage:true,supportSessionId:null};}
const req=body=>new Request("http://test.invalid/api",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});

test("setup endpoints require active server authority before any business writes",async()=>{
  for(const ctx of [Response.json({error:"Inactive"},{status:403}),Response.json({error:"Unauthorized"},{status:401})]){
    reset();state.ctx=ctx;
    for(const call of [api.onboard,api.setup])assert.equal((await call(req({user_metadata:{role:"system_admin"},app_metadata:{role:"ceo"}}))).status,ctx.status);
    assert.deepEqual(state.calls,[]);
  }
  for(const role of ["farm_manager","veterinarian"]){reset(role);assert.equal((await api.onboard(req({role:"system_admin"}))).status,403);assert.equal((await api.setup(req({role:"ceo"}))).status,403);assert.deepEqual(state.calls,[]);}
});
test("CEO setup retires bundled credentials and placement; only structure reaches the trusted organization RPC",async()=>{
  const body={branch:{name:"Branch"},intakeBatch:{placement_date:"2026-11-01",total_count:10,age_at_placement_days:0},manager:{email:"manager@example.invalid",fullName:"Manager",phone:"123"}};
  for(const password of [undefined,"TemporaryPassword123!".slice(0,5),""]){reset("ceo");assert.equal((await api.setup(req({...body,manager:{...body.manager,password}}))).status,400);assert.deepEqual(state.calls,[]);}
  reset("ceo");
  const structure={request_id:id(10),branch:{name:"Branch"},farms:[{name:"Farm",houses:[{name:"House",capacity:100,house_type:"layer"}]}],manager_id:id(11)};
  assert.equal((await api.setup(req({...structure,org_id:id(99)}))).status,400);
  assert.deepEqual(state.calls,[]);
  assert.equal((await api.setup(req(structure))).status,201);
  assert.equal(state.calls.some(c=>c[0]==="createUser"),false);
  assert.equal(state.calls.find(c=>c[0]==="rpc")[2].p_org,id(2));
  assert.equal(state.calls.find(c=>c[0]==="rpc")[1],"create_branch_structure");
});
test("templates only submit Governance requests; support has no direct apply bypass",async()=>{
  reset();state.feed.supportSessionId=id(8);assert.equal((await api.template(req({batchId:id(3),rows:[{}]}))).status,403);assert.deepEqual(state.calls,[]);
  reset();assert.equal((await api.template(req({batchId:id(3),rows:[{}]}))).status,201);assert.equal(state.calls[0][0],"governance");assert.equal(state.calls[0][1].request_type,"feed_template");
});

test("legacy template decisions require CEO, exact evidence and trusted actor with readable failures",async()=>{
 const body={request_id:id(70),legacy_id:id(71),revision:"2026-11-10T08:00:00.123456+00:00",date:"2026-11-10",reason:"Reviewed legacy work"};
 reset();assert.equal((await api.legacyWeight(req(body))).status,403);assert.deepEqual(state.calls,[]);
 reset("ceo");assert.equal((await api.legacyWeight(req({...body,date:"2026-02-30"}))).status,400);assert.deepEqual(state.calls,[]);
 assert.equal((await api.legacyWeight(req(body))).status,201);assert.equal(state.calls[0][1],"reschedule_legacy_template_weight");assert.equal(state.calls[0][2].p_actor,id(1));
 for(const [code,status] of [["42501",403],["40001",409],["55000",409],["XX000",500]]){reset("ceo");state.rpcError={message:"Operation failed",code};assert.equal((await api.legacyWeight(req(body))).status,status);}
});
test("schedule PATCH sends one revision-bound atomic operation and returns permission/conflict/lock errors",async()=>{
  const body={schedule_id:id(3),kind:"vaccination",expected_version:"2026-11-08T10:00:00Z",event_date:"2026-11-09",farm_id:id(4),house_id:id(5),flock_id:id(6),changes:{dosage:"1 ml"}};
  reset();assert.equal((await api.health(req({...body,expected_version:undefined}))).status,400);assert.deepEqual(state.calls,[]);
  reset();assert.equal((await api.health(req(body))).status,200);assert.equal(state.calls.length,1);assert.equal(state.calls[0][1],"edit_legacy_health_schedule");assert.equal(state.calls[0][2].p_actor,id(1));assert.deepEqual(state.calls[0][2].p_changes,body.changes);
  for(const [code,status] of [["42501",403],["40001",409],["55000",423]]){reset();state.rpcError={code,message:"Blocked"};assert.equal((await api.health(req(body))).status,status);}
  const ui=await readFile(new URL("../src/app/app/health/page.tsx",import.meta.url),"utf8");
  assert.doesNotMatch(ui.split("const saveScheduleEdit =")[1].split("const saveWeightRecord")[0],/\.update\(/);
});
test("notification lists/counts filter current access before limits; revoked recipients never get email",async()=>{
  reset();state.rows.notification_preferences=[{profile_id:id(1),email_enabled:true,email_minimum_severity:"low",in_app_minimum_severity:"low",updated_at:"2020-01-01"}];
  state.rows.authorized_notifications=[{id:id(7),recipient_id:id(1),severity:"high",event_type:"assigned",created_at:new Date().toISOString()}];
  const center=await api.loadNotificationCenter(state.ctx);assert.equal(center.unreadCount,1);assert.equal(state.calls.filter(c=>c[1]==="authorized_notifications").length,2);assert.ok(!state.calls.some(c=>c[1]==="notifications"));
  state.calls=[];state.access=false;const result=await api.dispatchNotificationOutbox();assert.equal(result.sent,0);assert.ok(!state.calls.some(c=>["send","emailLookup"].includes(c[0])));
  state.calls=[];state.access=true;await api.dispatchNotificationOutbox();assert.ok(state.calls.some(c=>c[0]==="send"));
  state.calls=[];state.accessError={message:"DB failed"};assert.equal((await api.dispatchNotificationOutbox()).sent,0);assert.ok(!state.calls.some(c=>c[0]==="send"));
});

test("real access resolver ignores editable role metadata and rejects inactive or missing profiles",async()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://test.invalid";process.env.SUPABASE_SERVICE_ROLE_KEY="test-only";
  const result=await build({entryPoints:[`${root}/src/lib/access-context.ts`],bundle:true,write:false,format:"esm",platform:"node",plugins:[{name:"authenticated-profile",setup(b){
    b.onResolve({filter:/^(?:@supabase\/supabase-js|@\/utils\/supabase\/server|\.\/warehouse-access)$/},a=>({path:a.path,namespace:"auth"}));
    b.onLoad({filter:/.*/,namespace:"auth"},a=>({contents:a.path==="@supabase/supabase-js"?"export const createClient=()=>globalThis.__securityContainment.db;":a.path.endsWith("warehouse-access")?"export const managerHasWarehouseAccess=()=>false;":"export const createClient=async()=>({auth:{getUser:async()=>({data:{user:{id:'user',user_metadata:{role:'system_admin'},app_metadata:{role:'ceo'}}}})}});"}));
  }}]});
  const {getAccessContext}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  reset();state.rows.profiles=[{org_id:id(2),role:"farm_manager",is_active:true}];
  assert.equal((await getAccessContext()).role,"farm_manager");
  state.rows.profiles[0].is_active=false;assert.equal((await getAccessContext()).status,403);
  state.rows.profiles=[];assert.equal((await getAccessContext()).status,403);
});
