import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const container='supabase_db_ethio-poultry-app', database=`egg_sale_race_${randomUUID().replaceAll('-','')}`;
assert.match(database,/^egg_sale_race_[a-f0-9]{32}$/);
function docker(args){const r=spawnSync('docker',['exec',container,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout;}
function sql(input){return new Promise((resolve,reject)=>{
  const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq']);
  let stdout='',stderr='';child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
  child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));child.stdin.end(input);
});}
async function sleeping(){
  for(let i=0;i<60;i++){const r=await sql("select exists(select 1 from pg_stat_activity where datname=current_database() and wait_event='PgSleep');");if(r.stdout.trim()==='t')return;}
  throw Error('Controlled sale transaction did not reach its lock hold');
}
const payload=JSON.stringify({product_category:'egg',product_label:'Race eggs',quantity:3,unit:'tray',unit_price:10,egg_sources:[{flock_id:'22000000-0000-4000-8000-000000000001',egg_quantity:90}]});
const call=id=>`select id from public.record_egg_sale('22000000-0000-4000-8000-000000000011','22000000-0000-4000-8000-000000000014',(now() at time zone 'Africa/Addis_Ababa')::date,'${payload}','${id}');`;
let created=false;
try {
  docker(['createdb','-U','postgres','--template','ethio_flock_lifecycle_dryrun_20261007',database]);created=true;
  const setup=await sql(readFileSync('tests/database/egg-sale-sources.integration.sql','utf8').split('-- END EGG FIXTURE')[0]+'commit;');
  assert.equal(setup.code,0,setup.stderr);
  const id=randomUUID(), first=sql(`begin;${call(id)}select pg_sleep(5);commit;`);
  await sleeping();
  const second=sql(`begin;${call(randomUUID())}commit;`);
  const [a,b]=await Promise.all([first,second]);
  assert.equal(a.code,0,a.stderr);assert.notEqual(b.code,0);assert.match(b.stderr,/Insufficient traceable eggs/);
  const replay=await sql(`begin;${call(id)}commit;`);assert.equal(replay.code,0,replay.stderr);
  const count=await sql("select count(*),sum(gross_amount) from public.daily_sales_records where product_label='Race eggs';select count(*) from public.egg_sale_sources;");
  assert.equal(count.stdout.trim(),'1|30.00\n1');
  console.log('PASS concurrent egg sales: one financial record, one allocation, no oversell, retry-safe replay.');
} finally {if(created)docker(['dropdb','-U','postgres',database]);}
