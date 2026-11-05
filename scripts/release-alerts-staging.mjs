import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import nextEnv from '@next/env';
import {verifyMigrationLock} from './deployment-contract.mjs';

nextEnv.loadEnvConfig(process.cwd());
const project = 'uzmhpecehmlwojdmitgj';
const connection = process.env.STAGING_DB_URL;
assert.ok(connection, 'STAGING_DB_URL is required; do not paste it into chat.');
const target = new URL(connection);
assert.ok(target.hostname === `db.${project}.supabase.co` ||
  (target.hostname.endsWith('.pooler.supabase.com') && target.username === `postgres.${project}`),
  'Refusing an unverified staging target.');
const [mode, finding] = process.argv.slice(2);
assert.ok(['check', 'deploy'].includes(mode), 'Use check or deploy followed by a finding number.');
const names = {
  1: '20261016000000_atomic_action_acknowledgement.sql',
  3: '20261016001000_atomic_action_transitions.sql',
  4: '20261016002000_exact_action_source_verification.sql',
  5: '20261017000000_authoritative_performance_warnings.sql',
  7: '20261017001000_bounded_alert_reads.sql',
};
const name = names[finding];
assert.ok(name, 'Only findings 1, 3, 4, 5 and 7 have database migrations.');
const version = name.split('_')[0];
function sql(input) {
  const result = spawnSync('psql', ['-X', '-Atq', '-v', 'ON_ERROR_STOP=1', '--dbname', connection],
    {input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120000});
  // Database errors may contain connection information. Never print them.
  assert.equal(result.status, 0, 'Staging SQL failed; release stopped. Credentials withheld.');
  return result.stdout.trim();
}
const lock = await verifyMigrationLock();
assert.ok(lock.ok, lock.errors?.join('\n'));
const local = Object.keys(lock.actual.files).map(file => file.split('_')[0]);
const remote = sql('select version from supabase_migrations.schema_migrations order by version;').split(/\r?\n/);
assert.ok(remote.every(v => local.includes(v)), 'Unknown staging migration; inspect before continuing.');
assert.ok(local.filter(v => v < version).every(v => remote.includes(v)), 'Staging is missing a predecessor.');
assert.ok(!remote.some(v => v > version), 'Staging is already beyond this finding; inspect rather than replaying it.');
const pending = !remote.includes(version);
console.log(`Verified staging ${project}; finding ${finding}: ${pending ? 'pending' : 'already applied'}.`);
if (mode === 'deploy') {
  const tables = ['daily_farm_records', 'daily_sales_records', 'stock_ledger', 'feed_day_closures',
    'feeding_session_records', 'mortality_events', 'flock_cull_events', 'flocks', 'batches', 'organizations',
    'operational_actions', 'operational_action_events', 'governance_audit_events'];
  const fingerprint = () => sql(`begin read only; ${tables.map(table =>
    `select '${table}',count(*),md5(coalesce(string_agg((to_jsonb(t)-'revision')::text,'' order by id),'')) from public.${table} t;`).join('\n')} rollback;`);
  const before = fingerprint();
  if (pending) {
    const body = await readFile(`supabase/migrations/${name}`, 'utf8');
    const delimiter = '$alerts_migration_body$';
    assert.ok(!body.includes(delimiter), 'SQL quoting delimiter collision.');
    sql(`begin; set local lock_timeout='10s'; set local statement_timeout='90s';
      select pg_advisory_xact_lock(hashtext('alerts_staging_release'));
      ${body}
      insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${version}','${name.slice(version.length + 1, -4)}',array[${delimiter}${body}${delimiter}]);
      commit;`);
  }
  assert.equal(fingerprint(), before, 'Source preservation mismatch. Stop; do not automatically reverse migrations.');
  assert.equal(sql(`select count(*) from supabase_migrations.schema_migrations where version='${version}';`), '1');
  const signature = {
    1: 'public.acknowledge_operational_action(uuid,uuid,uuid,timestamptz,text,uuid,text,uuid)',
    3: 'public.apply_operational_action_transition(uuid,uuid,uuid,bigint,jsonb,text,text,text,boolean,uuid)',
    4: 'public.operational_action_source_state(uuid,uuid)',
    5: 'public.operational_performance_warnings(uuid,uuid,date)',
    7: 'public.operational_low_stock_balances(uuid)',
  }[finding];
  assert.equal(sql(`select has_function_privilege('service_role','${signature}','execute')
    and not has_function_privilege('authenticated','${signature}','execute')
    and not has_function_privilege('anon','${signature}','execute');`), 't');
  console.log(`PASS finding ${finding}: staging migration, internal permissions and unchanged source fingerprints. Production not accessed.`);
}
