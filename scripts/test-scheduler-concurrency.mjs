import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const container='supabase_db_ethio-poultry-app',database=`scheduler_race_${randomUUID().replaceAll('-','')}`;
assert.match(database,/^scheduler_race_[a-f0-9]{32}$/);
function docker(args){const r=spawnSync('docker',['exec',container,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;}
function sql(input){return new Promise((resolve,reject)=>{const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq']);let stdout='',stderr='';child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));child.stdin.end(input);});}
const command=id=>`begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','22000000-0000-4000-8000-000000000011',true);
select set_config('request.jwt.claims','{"sub":"22000000-0000-4000-8000-000000000011","role":"authenticated"}',true);
select public.dispatch_today_command_v1(auth.uid(),jsonb_build_object('schema_version',1,'command_id','${id}','type','complete_scheduled_work','farm_id',farm_id,'flock_id',flock_id,'work_date',due_date,
'payload',jsonb_build_object('occurrence_id',id,'occurrence_revision',1,'outcome','completed','sample_count',10,'average_weight_g',1500,'min_weight_g',1400,'max_weight_g',1600,'uniformity_pct',90)))
from public.scheduled_work_occurrences where flock_id='22000000-0000-4000-8000-000000000001' and kind='weight' and due_date=(now() at time zone 'Africa/Addis_Ababa')::date;`;
let created=false;
try{
 docker(['createdb','-U','postgres','--template','ethio_flock_lifecycle_dryrun_20261007',database]);created=true;
 const setup=await sql(readFileSync('tests/database/scheduler.integration.sql','utf8').split('grant select on scheduler_fixture')[0]+'commit;');assert.equal(setup.code,0,setup.stderr);
 const id=randomUUID(),first=sql(command(id)+'select pg_sleep(5);commit;');
 let held=false;for(let n=0;n<60;n++){const r=await sql("select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='PgSleep');");if(r.stdout.trim()==='t'){held=true;break;}}
 assert.equal(held,true,'Controlled transaction did not hold its completion lock');
 const second=sql(command(randomUUID())+'commit;');const [a,b]=await Promise.all([first,second]);
 assert.equal(a.code,0,a.stderr);assert.match(a.stdout,/"status": "applied"/);
 assert.equal(b.code,0,b.stderr);assert.match(b.stdout,/"status": "conflict"/);
 const replay=await sql(command(id)+'commit;');assert.equal(replay.code,0,replay.stderr);assert.match(replay.stdout,/"status": "applied"/);
 const count=await sql("select count(*) from public.weight_records where org_id='22000000-0000-4000-8000-000000000010';select count(*) from public.governance_audit_events where event_type='scheduler.outcome_recorded';");
 assert.equal(count.stdout.trim(),'1\n1');console.log('PASS concurrent scheduled completion: one weight, one outcome audit, safe competing conflict and retry replay.');
}finally{if(created)docker(['dropdb','-U','postgres',database]);}
