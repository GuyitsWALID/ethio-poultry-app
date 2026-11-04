import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const container='supabase_db_ethio-poultry-app',database=`expense_race_${randomUUID().replaceAll('-','')}`;
assert.match(database,/^expense_race_[a-f0-9]{32}$/);
function docker(args){const r=spawnSync('docker',['exec',container,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;}
function sql(input){return new Promise((resolve,reject)=>{const c=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq']);let stdout='',stderr='';c.stdout.on('data',v=>stdout+=v);c.stderr.on('data',v=>stderr+=v);c.on('error',reject);c.on('close',code=>resolve({code,stdout,stderr}));c.stdin.end(input);});}
const command=id=>`begin;select (public.record_operational_expense('44000000-0000-4000-8000-000000000002','44000000-0000-4000-8000-000000000001',(now() at time zone 'Africa/Addis_Ababa')::date,
 '{"farm_id":"44000000-0000-4000-8000-000000000005","category":"rent","description":"Concurrent farm rent","amount":1500,"entry_kind":"monthly","remember_template":true}','${id}')).id;`;
let created=false;try{
 docker(['createdb','-U','postgres','--template','ethio_flock_lifecycle_dryrun_20261007',database]);created=true;
 const setup=await sql(readFileSync('tests/database/expenses.integration.sql','utf8').split('create temporary table expense_fixture')[0]+'commit;');assert.equal(setup.code,0,setup.stderr);
 const first=sql(command(randomUUID())+'select pg_sleep(5);commit;');let held=false;
 for(let n=0;n<60;n++){const r=await sql("select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='PgSleep');");if(r.stdout.trim()==='t'){held=true;break;}}
 assert.equal(held,true,'First confirmation did not hold its transaction');
 const [a,b]=await Promise.all([first,sql(command(randomUUID())+'commit;')]);assert.equal(a.code,0,a.stderr);assert.equal(b.code,0,b.stderr);
 const count=await sql("select count(*) from public.cost_entries where org_id='44000000-0000-4000-8000-000000000001';select count(*) from public.recurring_cost_templates where org_id='44000000-0000-4000-8000-000000000001';select count(*) from public.governance_audit_events where event_type='cost_entry.recorded';");
 assert.equal(count.stdout.trim(),'1\n1\n1');console.log('PASS concurrent monthly confirmation: one template, one expense and one explicit audit.');
}finally{if(created)docker(['dropdb','-U','postgres',database]);}
