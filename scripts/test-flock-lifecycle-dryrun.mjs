import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';

// Rebuild ONLY this disposable Docker clone. Original local postgres and all
// remote databases remain unchanged. No connection URL or credentials printed.
const container='supabase_db_ethio-poultry-app';
const database='ethio_flock_lifecycle_dryrun_20261007';
assert.equal(database,'ethio_flock_lifecycle_dryrun_20261007');
function docker(args,input){
  const result=spawnSync('docker',['exec',...(input?['-i']:[]),container,...args],{input,encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.status!==0)throw new Error(result.error?.message||result.stderr||result.stdout||'Docker command failed');
  return result.stdout;
}
function sql(input){return docker(['psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','--single-transaction','-Atq'],input);}
const latest=docker(['psql','-U','postgres','-d','postgres','-Atqc','select max(version) from supabase_migrations.schema_migrations']).trim();
assert.equal(latest,'20260927000000','Original local baseline changed; review clone procedure first.');
console.log(`Recreating disposable Docker database ${database}; original postgres is read-only.`);
docker(['dropdb','-U','postgres','--if-exists',database]);
docker(['createdb','-U','postgres',database]);
sql('drop schema public cascade;');
docker(['sh','-c',`set -e; pg_dump -U postgres -d postgres --schema-only --schema=public --schema=auth --schema=extensions --schema=supabase_migrations --no-publications --no-subscriptions | PGPASSWORD="$POSTGRES_PASSWORD" psql -U supabase_admin -d ${database} -v ON_ERROR_STOP=1 -q`]);
sql('create extension if not exists pgcrypto with schema extensions;');
const migrations=readdirSync('supabase/migrations').filter(name=>name.endsWith('.sql')&&name.slice(0,14)>latest).sort();
assert.ok(migrations.includes('20261008000000_approved_whole_flock_moves.sql'));
for(const name of migrations){
  if(name==='20261007000000_safe_flock_cycle_foundation.sql'){
    sql(readFileSync('tests/database/fixtures/flock-cycle-before-migration.sql','utf8'));
    console.log('Populated pre-migration fixture loaded.');
  }
  sql(readFileSync(`supabase/migrations/${name}`,'utf8'));
  console.log(`PASS migration ${name}`);
}
sql(readFileSync('tests/database/fixtures/flock-cycle-after-migration.sql','utf8'));
console.log('PASS populated migration preservation checks.');
for(const name of readdirSync('tests/database').filter(name=>name.endsWith('.integration.sql')).sort()){
  sql(readFileSync(`tests/database/${name}`,'utf8'));
  console.log(`PASS ${name}`);
}
const fixture=readFileSync('tests/database/flock-cycle.integration.sql','utf8');
const seam='do $$ declare v_daily uuid; v_before timestamptz;';
assert.equal(fixture.split(seam).length,2);
sql(fixture.split(seam)[0]+readFileSync('tests/database/archived-cycle-corrections.assertions.sql','utf8'));
console.log('PASS archived-cycle-corrections.assertions.sql');
assert.equal(docker(['psql','-U','postgres','-d','postgres','-Atqc','select max(version) from supabase_migrations.schema_migrations']).trim(),latest);
console.log(`PASS ${migrations.length} forward migrations; original local migration history unchanged. No remote database used.`);
