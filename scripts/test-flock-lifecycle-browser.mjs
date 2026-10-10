import assert from 'node:assert/strict';
import {createHmac, randomBytes, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {createServer, request} from 'node:http';
import {createClient} from '@supabase/supabase-js';

// Fully disposable LOCAL stack. Never redirect the user's normal Supabase API
// or read remote credentials. Only the fixed migrated Docker template is read.
const suffix=randomUUID().replaceAll('-','');
const database=`flock_browser_${suffix}`;
const dbContainer='supabase_db_ethio-poultry-app';
const template='ethio_flock_lifecycle_dryrun_20261007';
const created=[];
let cloned=false, app, proxy;
assert.match(database,/^flock_browser_[a-f0-9]{32}$/);
function docker(args,input){
  const result=spawnSync('docker',args,{input,encoding:'utf8',maxBuffer:8*1024*1024});
  // Never print a failing command: Docker env arguments contain local secrets.
  if(result.status!==0)throw new Error(`Local Docker operation failed (${args[0]}).${args.includes('psql')?` ${result.stderr}`:''}`);
  return result.stdout;
}
const inspect=name=>JSON.parse(docker(['inspect',name]))[0];
const envMap=info=>Object.fromEntries(info.Config.Env.map(value=>{const i=value.indexOf('=');return[value.slice(0,i),value.slice(i+1)];}));
const query=sql=>docker(['exec','-i',dbContainer,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq'],sql);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(url,timeout=60_000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){try{const r=await fetch(url,{signal:AbortSignal.timeout(2000)});if(r.ok)return;}catch{}await sleep(500);}
  throw new Error(`Local service was not ready: ${new URL(url).pathname}`);
}
function runNode(args,env){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{env,stdio:'inherit'});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Local test command failed (${args[0]}).`)));
  });
}
try{
  docker(['exec',dbContainer,'createdb','-U','postgres','--template',template,database]);cloned=true;
  // The SQL-only template has Auth's current schema but no migration-history
  // rows. Copy that metadata, not real users, so GoTrue does not replay older
  // Auth migrations over the already-current schema.
  const authHistory=docker(['exec',dbContainer,'pg_dump','-U','postgres','-d','postgres','--data-only','--table=auth.schema_migrations']);
  docker(['exec','-i',dbContainer,'sh','-c',`PGPASSWORD="$POSTGRES_PASSWORD" psql -U supabase_admin -d ${database} -v ON_ERROR_STOP=1 -Atq`],authHistory);
  const authInfo=inspect('supabase_auth_ethio-poultry-app');
  const restInfo=inspect('supabase_rest_ethio-poultry-app');
  const network=Object.keys(inspect(dbContainer).NetworkSettings.Networks)[0];
  assert.equal(network,'supabase_network_ethio-poultry-app');
  const authEnv=envMap(authInfo),restEnv=envMap(restInfo);
  for(const [kind,info,values,key,port,target] of [
    ['auth',authInfo,authEnv,'GOTRUE_DB_DATABASE_URL',45432,9999],
    ['rest',restInfo,restEnv,'PGRST_DB_URI',45433,3000],
  ]){
    const connection=new URL(values[key]);
    assert.equal(connection.hostname,dbContainer);assert.equal(connection.pathname,'/postgres');
    connection.pathname=`/${database}`;values[key]=connection.href;
    if(kind==='rest')values.PGRST_DB_SCHEMAS='public';
    if(kind==='auth'){
      values.API_EXTERNAL_URL='http://127.0.0.1:45431';values.GOTRUE_SITE_URL='http://127.0.0.1:3100';
      values.GOTRUE_JWT_ISSUER='http://127.0.0.1:45431/auth/v1';values.GOTRUE_MAILER_AUTOCONFIRM='true';
    }
    const name=`flock_${kind}_${suffix}`;
    const args=['run','-d','--name',name,'--network',network,'-p',`127.0.0.1:${port}:${target}`];
    for(const [key,value] of Object.entries(values))args.push('-e',`${key}=${value}`);
    args.push(info.Config.Image,...info.Config.Cmd);
    created.push(name);docker(args);
  }
  proxy=createServer((incoming,outgoing)=>{
    const auth=incoming.url?.startsWith('/auth/v1/'),rest=incoming.url?.startsWith('/rest/v1/');
    // Node normalizes upstream header names to lowercase. Use matching names
    // so GoTrue's wildcard origin is replaced, not emitted as a second value.
    const headers={'access-control-allow-origin':'http://127.0.0.1:3100','access-control-allow-headers':'authorization, apikey, content-type, accept-profile, content-profile, prefer, range, range-unit, x-client-info, x-supabase-api-version, x-retry-count','access-control-allow-methods':'GET,POST,PATCH,DELETE,PUT,OPTIONS','cache-control':'no-store'};
    if(incoming.method==='OPTIONS'){outgoing.writeHead(204,headers);outgoing.end();return;}
    if(!auth&&!rest){outgoing.writeHead(404,headers);outgoing.end();return;}
    const upstream=request({hostname:'127.0.0.1',port:auth?45432:45433,method:incoming.method,path:incoming.url.replace(auth?'/auth/v1':'/rest/v1',''),headers:incoming.headers},response=>{
      outgoing.writeHead(response.statusCode,{...response.headers,...headers});response.pipe(outgoing);
    });
    upstream.on('error',()=>{outgoing.writeHead(502,headers);outgoing.end();});incoming.pipe(upstream);
  });
  await new Promise(resolve=>proxy.listen(45431,'127.0.0.1',resolve));
  await ready('http://127.0.0.1:45431/auth/v1/health');
  const corsProbe=await fetch('http://127.0.0.1:45431/auth/v1/health',{headers:{Origin:'http://127.0.0.1:3100'}});
  assert.equal(corsProbe.headers.get('access-control-allow-origin'),'http://127.0.0.1:3100','Local proxy must emit exactly one allowed origin');
  const token=role=>{
    const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
    const payload=Buffer.from(JSON.stringify({role,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+7200})).toString('base64url');
    return `${header}.${payload}.${createHmac('sha256',authEnv.GOTRUE_JWT_SECRET).update(`${header}.${payload}`).digest('base64url')}`;
  };
  const service=token('service_role'),anon=token('anon'),password=randomBytes(24).toString('base64url');
  const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:45431',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:anon,
    SUPABASE_SERVICE_ROLE_KEY:service,LOCAL_E2E_PASSWORD:password,APP_BASE_URL:'http://127.0.0.1:3100',APP_ENVIRONMENT:'local',
    APP_RELEASE:'local-lifecycle-test',SUPABASE_PROJECT_REF:'local-lifecycle-test',ADMIN_ACCESS_CODE:randomBytes(24).toString('hex'),
    MONITORING_INGEST_TOKEN:randomBytes(24).toString('hex'),NOTIFICATION_EMAIL_ENABLED:'false',RECONCILIATION_AI_ENABLED:'false',
    E2E_FARM_MANAGER_EMAIL:'item1-farm-manager@local.test',E2E_FARM_MANAGER_PASSWORD:password,
    E2E_CEO_EMAIL:'item1-ceo@local.test',E2E_CEO_PASSWORD:password,E2E_LOCAL_LIFECYCLE:'true',NEXT_TELEMETRY_DISABLED:'1'};
  await ready('http://127.0.0.1:45431/rest/v1/');
  await runNode(['scripts/provision-local-e2e.mjs'],env);
  const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,service,{auth:{persistSession:false}});
  const users=await admin.auth.admin.listUsers();assert.ifError(users.error);
  const manager=users.data.users.find(user=>user.email===env.E2E_FARM_MANAGER_EMAIL);assert(manager);
  const ceo=users.data.users.find(user=>user.email===env.E2E_CEO_EMAIL);assert(ceo);
  const ceoClient=createClient(env.NEXT_PUBLIC_SUPABASE_URL,anon,{auth:{persistSession:false}});
  const signIn=await ceoClient.auth.signInWithPassword({email:env.E2E_CEO_EMAIL,password});assert.ifError(signIn.error);
  const rollout=await ceoClient.rpc('ceo_toggle_today_workspace',{p_actor_id:ceo.id,p_enabled:true,p_reason:'Enable disposable local lifecycle browser acceptance'});
  assert.ifError(rollout.error);
  query(`begin;
    insert into public.batch_cycles(id,org_id,farm_id,cycle_code,production_purpose,status,placement_date,placed_at)
    values('12000000-0000-4000-8000-000000000010','12000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000003','BROWSER-CYCLE','layer','active',current_date-40,now()-interval '40 days');
    insert into public.batches(id,org_id,branch_id,farm_id,house_id,batch_cycle_id,batch_code,source,placement_date,age_at_placement_days,total_count,status)
    values('12000000-0000-4000-8000-000000000011','12000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000003','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000010','BROWSER-BATCH','external_purchase',current_date-40,120,100,'active');
    insert into public.flocks(id,org_id,farm_id,house_id,batch_id,flock_code,flock_type,source,placement_date,placed_at,age_at_placement_days,initial_count,current_count,status)
    values('12000000-0000-4000-8000-000000000012','12000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000003','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000011','BROWSER-LAYER','layer','external_purchase',current_date-40,now()-interval '40 days',120,100,100,'active');
    insert into public.houses(id,org_id,branch_id,farm_id,name,house_type)
    values('12000000-0000-4000-8000-000000000013','12000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000003','Empty replacement house','layer');
    commit;`);
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3100'],{env,stdio:'inherit'});
  await ready(`${env.APP_BASE_URL}/auth/sign-in`,180_000);
  console.log('Isolated migrated local API and application ready. Remote databases untouched.');
  await runNode(['node_modules/@playwright/test/cli.js','test','tests/browser/flock-lifecycle.spec.ts','--workers=1','--max-failures=1','--timeout=240000',...process.argv.slice(2)],env);
}finally{
  if(app?.pid){
    if(process.platform==='win32')spawnSync('taskkill',['/PID',String(app.pid),'/T','/F'],{stdio:'ignore'});
    else app.kill('SIGTERM');
  }
  if(proxy)proxy.closeAllConnections();proxy?.close();
  for(const container of created.reverse())docker(['rm','-f',container]);
  if(cloned)docker(['exec',dbContainer,'dropdb','-U','postgres',database]);
}
