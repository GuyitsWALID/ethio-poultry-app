import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import nextEnv from '@next/env';
import {verifyMigrationLock} from './deployment-contract.mjs';

nextEnv.loadEnvConfig(process.cwd());
const project='uzmhpecehmlwojdmitgj';
const connection=process.env.STAGING_DB_URL;
assert.ok(connection,'STAGING_DB_URL is required; never paste it into the chat.');
const target=new URL(connection);
assert.ok(target.hostname===`db.${project}.supabase.co`||target.username===`postgres.${project}`,'Refusing an unverified staging target.');
const mode=process.argv[2];
assert.ok(['check','deploy'].includes(mode),'Use check or deploy.');
const env={...process.env,DATABASE_URL:connection};
const candidates=['20261007000000','20261007001000','20261007002000','20261008000000','20261010000000','20261010001000'];
function run(command,args){
 const result=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:8*1024*1024});
 // Do not echo commands or database errors containing connection information.
 if(result.status!==0)throw new Error(`${command} failed; staging release stopped. Credentials withheld.`);
 return result.stdout;
}
function sql(query){return run('psql',['-X','-Atq','-v','ON_ERROR_STOP=1','--dbname',connection,'-c',query]).trim();}
const lock=await verifyMigrationLock();assert.ok(lock.ok,lock.errors?.join('\n'));
const versions=sql('select version from supabase_migrations.schema_migrations order by version').split(/\r?\n/);
const pending=candidates.filter(v=>!versions.includes(v));
assert.equal(versions.filter(v=>v>'20261006001000'&&!candidates.includes(v)).length,0,'Unexpected newer staging migration.');
// The currently verified staging baseline contains all preceding migrations.
assert.ok(versions.includes('20261006001000'),'Staging assignment baseline is missing.');
const preflight=run('psql',['-X','-v','ON_ERROR_STOP=1','--dbname',connection,'--file','supabase/verification/flock_lifecycle_preflight.sql']);
const counts=[...preflight.matchAll(/\((\d+) rows?\)/g)].map(m=>Number(m[1]));
assert.equal(counts.length,9,'Preflight output contract changed; inspect before migrating.');
assert.ok(counts.every(n=>n===0),'Unresolved lifecycle preflight conflicts block staging deployment.');
console.log(`Verified staging ${project}: nine clean preflight checks; ${pending.length} pending lifecycle migrations.`);
if(mode==='deploy'){
 const tables=['daily_farm_records','daily_sales_records','stock_ledger','feed_day_closures','mortality_events','flock_cull_events','flocks','batches'];
 const fingerprint=()=>sql(`begin read only; ${tables.map(table=>`select '${table}',count(*),md5(coalesce(string_agg((to_jsonb(t)-array['batch_cycle_id','placed_at','completed_at'])::text,'' order by id),'')) from public.${table} t;`).join(' ')} rollback;`);
 const before=fingerprint();
 if(pending.length){
  env.DATABASE_DEPLOY_CONFIRM='APPLY_LOCKED_MIGRATIONS';
  console.log(run(process.execPath,['scripts/database-release.mjs','deploy']).trim());
 }
 assert.equal(fingerprint(),before,'Staging source preservation mismatch: stop and investigate; do not reverse migrations automatically.');
 assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version in (${candidates.map(v=>`'${v}'`).join(',')})`),'6');
 assert.equal(sql("select to_regclass('public.effective_cycle_dispositions') is not null and to_regclass('public.effective_cycle_clearances') is not null and to_regprocedure('public.validate_archived_accounting(public.governance_requests)') is not null"),'t');
 assert.equal(sql("select has_function_privilege('authenticated','public.validate_archived_accounting(public.governance_requests)','execute') or has_function_privilege('authenticated','public.apply_archived_loss_events(public.governance_requests)','execute') or has_function_privilege('anon','public.archived_cycle_sale_choices(uuid,uuid)','execute')"),'f');
 console.log('PASS staging migration head, effective evidence views, internal-helper permissions and unchanged operational source fingerprints. Production not accessed.');
}
