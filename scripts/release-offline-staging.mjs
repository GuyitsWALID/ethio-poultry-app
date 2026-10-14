import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import nextEnv from '@next/env';
import {verifyMigrationLock} from './deployment-contract.mjs';

nextEnv.loadEnvConfig(process.cwd());
const project='uzmhpecehmlwojdmitgj';
const connection=process.env.STAGING_DB_URL;
assert.ok(connection,'STAGING_DB_URL is required; never paste it into chat.');
const target=new URL(connection);
assert.ok(target.hostname===`db.${project}.supabase.co`||target.username===`postgres.${project}`,'Refusing an unverified staging target.');
const mode=process.argv[2];
assert.ok(['check','deploy'].includes(mode),'Use check or deploy.');
const env={...process.env,DATABASE_URL:connection};
function run(command,args){
  const result=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.status!==0)throw new Error(`${command} failed; staging release stopped. Credentials withheld.`);
  return result.stdout;
}
function sql(query){return run('psql',['-X','-Atq','-v','ON_ERROR_STOP=1','--dbname',connection,'-c',query]).trim();}
const lock=await verifyMigrationLock();
assert.ok(lock.ok,lock.errors?.join('\n'));
const migration='20261013000000';
const local=Object.keys(lock.actual.files).map(name=>name.split('_')[0]);
const versions=sql('select version from supabase_migrations.schema_migrations order by version').split(/\r?\n/);
assert.ok(versions.every(version=>local.includes(version)),'Unknown staging migration history.');
assert.ok(local.filter(version=>version!==migration).every(version=>versions.includes(version)),'Staging is missing a predecessor; do not apply unrelated migrations.');
const pending=!versions.includes(migration);
console.log(`Verified staging ${project}; ${pending?1:0} pending offline receipt-chain migration.`);
if(mode==='deploy'){
  const tables=['daily_farm_records','daily_sales_records','stock_ledger','feed_day_closures','feeding_session_records','mortality_events','flock_cull_events','flocks','batches','organizations'];
  const fingerprint=()=>sql(`begin read only; ${tables.map(table=>`select '${table}',count(*),md5(coalesce(string_agg(to_jsonb(t)::text,'' order by id),'')) from public.${table} t;`).join(' ')} rollback;`);
  const before=fingerprint();
  if(pending){env.DATABASE_DEPLOY_CONFIRM='APPLY_LOCKED_MIGRATIONS';console.log(run(process.execPath,['scripts/database-release.mjs','deploy']).trim());}
  assert.equal(fingerprint(),before,'Source preservation mismatch: stop; never automatically reverse migrations.');
  assert.equal(sql("select count(*) from information_schema.columns where table_schema='public' and table_name='client_operation_receipts' and column_name='chain_context'"),'1');
  assert.equal(sql("select has_function_privilege('authenticated','public.dispatch_today_command_v1(uuid,jsonb)','execute') and not has_function_privilege('authenticated','public.dispatch_today_command_pre_chains_v1(uuid,jsonb)','execute') and not has_function_privilege('anon','public.dispatch_today_command_v1(uuid,jsonb)','execute')"),'t');
  assert.equal(sql('select max(version) from supabase_migrations.schema_migrations'),migration);
  console.log('PASS staging migration, helper permissions and unchanged operational/organization fingerprints. Production not accessed.');
}
