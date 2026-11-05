// Run against a disposable clone, never the application's database.
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const container = 'supabase_db_ethio-poultry-app';
const template = process.env.REPORT_TEST_TEMPLATE ?? 'ethio_flock_lifecycle_dryrun_20261007';
assert.match(template, /^ethio_[a-z0-9_]*dryrun_[a-z0-9_]+$/);
const database = `ethio_report_concurrency_dryrun_${Date.now()}`;
const args = db => ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-qAt'];
const sql = (query, db = database) => execFileSync('docker', args(db), {input: query, encoding: 'utf8', timeout: 30000}).trim();
const org = randomUUID(), actor = randomUUID();
let created = false;
try {
  sql(`create database ${database} template ${template};`, 'postgres');
  created = true;
  sql(`insert into public.organizations(id,name) values('${org}','Concurrent report test');
    insert into public.profiles(id,org_id,full_name,role,is_active) values('${actor}','${org}','CEO','ceo',true);`);
  for (const scheduled of [false, true]) {
    const scheduleId = scheduled ? randomUUID() : null;
    let revision = null;
    if (scheduled) revision = sql(`insert into public.management_report_schedules(id,org_id,created_by,name,cadence,run_day,recipient_ids,next_run_at)
      values('${scheduleId}','${org}','${actor}','Concurrent report','weekly',1,array['${actor}'::uuid],now()-interval '1 hour') returning updated_at;`);
    const request = JSON.stringify({name: 'Concurrent report', scope: {}, recipientIds: [actor], periodFrom: '2026-10-01',
      periodTo: '2026-10-18', version: 'management-report-v1-scoped', scheduleId, scheduleRevision: revision});
    const key = `${scheduled ? 'schedule' : 'manual'}:concurrent-test`;
    const claim = `public.claim_management_report('${org}','${actor}','${key}',repeat('a',64),'${request}'::jsonb)`;
    const snapshot = JSON.stringify({report_resources: {schema_version: 1, complete: true, farm_ids: [], warehouse_ids: []}});
    // Wait for the first worker's claim while its transaction is still open.
    const worker = spawn('docker', args(database), {stdio: ['pipe', 'pipe', 'pipe']});
    let output = '', errors = '';
    let claimed;
    const ready = new Promise(resolve => {claimed = resolve;});
    const finished = new Promise((resolve, reject) => {
      worker.stdout.on('data', data => {output += data; if (output.includes('claimed')) claimed();});
      worker.stderr.on('data', data => {errors += data;});
      worker.on('error', reject);
      worker.on('exit', code => code === 0 ? resolve() : reject(new Error(errors)));
    });
    // Preserve the first claim token without another claim call.
    worker.stdin.end(`begin; create temporary table claimed_report as select ${claim} as value;
      select value from claimed_report; select pg_sleep(2);
      select public.finish_management_report('${org}','${actor}','${key}',(select (value->>'claim_token')::uuid from claimed_report),
        '${snapshot}'::jsonb,repeat('b',64),'Test organization',${scheduled ? "now()+interval '1 week'" : 'null'}); commit;`);
    await Promise.race([ready, finished.then(() => {throw new Error('First worker did not claim');}),
      new Promise((_, reject) => {const timer = setTimeout(() => reject(new Error('Claim timed out')), 15000); timer.unref();})]);
    // A second connection blocks on the receipt, then observes the committed result.
    const replay = JSON.parse(sql(`select ${claim};`));
    await finished;
    assert.equal(replay.status, 'completed');
    assert.equal(sql(`select count(*) from public.management_report_runs where org_id='${org}' and schedule_id is ${scheduled ? `not distinct from '${scheduleId}'::uuid` : 'null'};`), '1');
    assert.equal(sql(`select count(*) from public.governance_audit_events where entity_id='${replay.run_id}' and event_type='management_report.generated';`), '1');
    console.log(`${scheduled ? 'Scheduled' : 'Manual'} competing workers: one completion, one audit, same retry result.`);
  }
} finally {
  if (created) sql(`drop database ${database} with (force);`, 'postgres');
}
