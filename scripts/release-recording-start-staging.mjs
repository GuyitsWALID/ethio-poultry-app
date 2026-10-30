import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import nextEnv from "@next/env";
import {verifyMigrationLock} from "./deployment-contract.mjs";

nextEnv.loadEnvConfig(process.cwd());
const mode = process.argv[2];
assert.ok(["inspect", "check", "deploy"].includes(mode), "Use inspect, check (rollback), or deploy.");
const connection = process.env.STAGING_DB_URL;
assert.ok(connection, "STAGING_DB_URL is required; never paste credentials.");
const project = "uzmhpecehmlwojdmitgj", target = new URL(connection);
assert.ok(target.hostname === `db.${project}.supabase.co` ||
  target.hostname.endsWith(".pooler.supabase.com") && target.username === `postgres.${project}`,
  "Unverified staging target. Stopped.");
function sql(input) {
  const result = spawnSync("psql", ["-X", "-Atq", "-v", "ON_ERROR_STOP=1", "--dbname", connection], {
    input, encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    // SQL errors can contain record contents or connection details.
    const state = result.stderr?.match(/ERROR:\s*([^\r\n]+)/)?.[1];
    const safe = state?.startsWith("RELEASE_CHECK:") ? state : "Staging SQL failed; connection and record details withheld.";
    throw new Error(safe);
  }
  return result.stdout.trim();
}
const lock = await verifyMigrationLock();
assert.ok(lock.ok, "Migration lock mismatch. Review before release.");
const files = Object.keys(lock.actual.files).sort();
const local = files.map(file => file.slice(0,14));
const remote = sql("select version from supabase_migrations.schema_migrations order by version;").split(/\r?\n/);
const allowed = ["20261030000000_verified_today_opening_source.sql", "20261030001000_governed_recording_start.sql"];
assert.ok(remote.every(version => local.includes(version)), "Unknown staging migration history. Stopped.");
const pending = files.filter(file => !remote.includes(file.slice(0,14)));
assert.ok(pending.every(file => allowed.includes(file)), "Unrelated pending staging migrations. Stopped.");
assert.ok(allowed.every(file => files.includes(file)), "Expected release files are missing.");
console.log(`Verified staging ${project}; pending: ${pending.join(", ") || "none"}`);
if (mode !== "inspect") {
  const tables = ["organizations","profiles","user_farm_access","flocks","batches","daily_farm_records",
    "mortality_events","flock_cull_events","stock_ledger","daily_sales_records","governance_requests",
    "governance_audit_events","egg_custody_opening_balances"];
  if (remote.includes("20261030001000")) tables.push("flock_recording_starts");
  const fingerprint = table => `md5(coalesce((select string_agg(to_jsonb(t)::text,'' order by id) from public.${table} t),''))`;
  const before = tables.map(table => `('${table}',${fingerprint(table)})`).join(",");
  const statements = [];
  for (const file of pending) {
    const body = await readFile(`supabase/migrations/${file}`, "utf8");
    const delimiter = "$recording_start_release$";
    assert.ok(!body.includes(delimiter));
    statements.push(body);
    statements.push(`insert into supabase_migrations.schema_migrations(version,name,statements)
      values('${file.slice(0,14)}','${file.slice(15,-4)}',array[${delimiter}${body}${delimiter}]);`);
  }
  const checks = `
do $$ begin
 if not has_table_privilege('authenticated','public.flock_recording_starts','select')
  or has_table_privilege('authenticated','public.flock_recording_starts','insert')
  or has_table_privilege('anon','public.flock_recording_starts','select')
  or not (select relrowsecurity from pg_class where oid='public.flock_recording_starts'::regclass)
  or has_function_privilege('authenticated','public.recording_start_context(uuid,uuid)','execute')
  or has_function_privilege('authenticated','public.recording_start_revision(uuid,uuid)','execute')
  or has_function_privilege('authenticated','public.save_daily_record_with_usage_before_opening_source(uuid,uuid,uuid,jsonb,jsonb)','execute')
  or not has_function_privilege('authenticated','public.apply_recording_start_request(uuid)','execute')
  or has_function_privilege('anon','public.apply_recording_start_request(uuid)','execute')
 then raise exception 'RELEASE_CHECK: starting-count permissions differ from the reviewed contract'; end if;
 if position('_today_opening' in pg_get_functiondef('public.save_daily_record_with_usage(uuid,uuid,uuid,jsonb,jsonb)'::regprocedure))=0
  or position('flock_recording_starts' in pg_get_functiondef('public.apply_daily_farm_record_counts()'::regprocedure))=0
 then raise exception 'RELEASE_CHECK: starting-count guards are missing'; end if;
end $$;
${tables.map(table => `do $$ begin if (select hash from release_sources where name='${table}') is distinct from ${fingerprint(table)}
 then raise exception 'RELEASE_CHECK: operational sources changed during migration'; end if; end $$;`).join("\n")}
`;
  const history = remote.map(value => `'${value}'`).join(",");
  sql(`begin;
set local lock_timeout='10s'; set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('recording_start_staging_release'));
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $$ begin if (select array_agg(version order by version)::text[] from supabase_migrations.schema_migrations)
 is distinct from array[${history}]::text[] then raise exception 'RELEASE_CHECK: staging history changed; inspect again'; end if; end $$;
lock table ${tables.map(table => `public.${table}`).join(",")} in share mode;
create temporary table release_sources(name text primary key,hash text) on commit drop;
insert into release_sources values ${before};
${statements.join("\n")}
${checks}
${mode === "deploy" ? "commit" : "rollback"};`);
  console.log(`PASS: starting-count staging ${mode === "deploy" ? "migrations committed" : "dry run rolled back"}; permissions and operational source preservation verified. Production not accessed.`);
}
