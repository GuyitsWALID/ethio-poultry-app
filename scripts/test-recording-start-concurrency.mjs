import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

// Only a newly named clone of the verified disposable local template is writable.
const container='supabase_db_ethio-poultry-app';
const database=`recording_race_${randomUUID().replaceAll('-','')}`;
assert.match(database,/^recording_race_[a-f0-9]{32}$/);
function docker(args){const r=spawnSync('docker',['exec',container,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;}
function sql(input){return new Promise((resolve,reject)=>{
  const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq']);
  let stdout='',stderr='';child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
  child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));child.stdin.end(input);
});}
const id=n=>`19000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const auth=`select set_config('request.jwt.claim.sub','${id(2)}',true);`;
async function sleeping(){
  for(let i=0;i<60;i++){const r=await sql("select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='PgSleep');");if(r.stdout.trim()==='t')return;}
  throw Error('Controlled transaction did not reach its lock hold');
}
let created=false;
try {
  docker(['createdb','-U','postgres','--template','ethio_flock_lifecycle_dryrun_20261007',database]);created=true;
  const fixture=readFileSync('tests/database/recording-start.integration.sql','utf8').split('set local role authenticated;')[0];
  const setup=await sql(`${fixture}commit; begin; select set_config('request.jwt.claim.sub','${id(8)}',true);select public.decide_governance_request('${id(200)}','approved','Concurrent starting count review.');commit;`);
  assert.equal(setup.code,0,setup.stderr);
  const first=sql(`begin;${auth}select public.apply_recording_start_request('${id(200)}');select pg_sleep(3);commit;`);
  await sleeping();
  const second=sql(`begin;${auth}select public.apply_recording_start_request('${id(200)}');commit;`);
  for(const result of await Promise.all([first,second]))assert.equal(result.code,0,result.stderr);
  const counts=await sql(`select (select count(*) from public.flock_recording_starts),(select count(*) from public.egg_custody_opening_balances),(select current_count from public.flocks where id='${id(7)}');`);
  assert.equal(counts.stdout.trim(),'1|1|98');
  const command=n=>`jsonb_build_object('schema_version',1,'command_id','${id(n)}','type','save_daily_record','farm_id','${id(4)}','flock_id','${id(7)}','work_date',(now() at time zone 'Africa/Addis_Ababa')::date,'payload',jsonb_build_object('daily_record_id',null,'usages',null,'record',jsonb_build_object('record_date',(now() at time zone 'Africa/Addis_Ababa')::date,'opening_birds',98,'closing_birds',98,'_today_opening',jsonb_build_object('source','baseline','count',98))))`;
  const winner=sql(`begin;${auth}select public.dispatch_today_command_v1('${id(2)}',${command(201)})->>'status';select pg_sleep(3);commit;`);
  await sleeping();
  const loser=sql(`begin;${auth}select public.dispatch_today_command_v1('${id(2)}',${command(202)})->>'status';commit;`);
  const [a,b]=await Promise.all([winner,loser]);
  assert.equal(a.code,0,a.stderr);assert.equal(b.code,0,b.stderr);assert.match(a.stdout,/applied/);assert.match(b.stdout,/conflict/);
  const final=await sql(`select count(*),min(opening_birds),max(closing_birds) from public.daily_farm_records where flock_id='${id(7)}';`);
  assert.equal(final.stdout.trim(),'1|98|98');
  console.log('PASS real concurrent baseline replay and competing Today starts: one immutable baseline, one daily row, safe conflict.');
} finally {if(created)docker(['dropdb','-U','postgres',database]);}
