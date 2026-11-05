import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import nextEnv from "@next/env";
import {verifyMigrationLock} from "./deployment-contract.mjs";

nextEnv.loadEnvConfig(process.cwd());
const mode = process.argv[2];
assert.ok(["inspect", "check", "deploy"].includes(mode), "Use inspect, check (rollback), or deploy.");
const connection = process.env.STAGING_DB_URL;
assert.ok(connection, "STAGING_DB_URL is required. Do not paste credentials.");
const target = new URL(connection), project = "uzmhpecehmlwojdmitgj";
assert.ok(target.hostname === `db.${project}.supabase.co` || target.hostname.endsWith(".pooler.supabase.com") && target.username === `postgres.${project}`, "Unverified staging identity. Stopped.");
function sql(input) {
  const result = spawnSync("psql", ["-X", "-Atq", "-v", "ON_ERROR_STOP=1", "--dbname", connection], {input, encoding: "utf8", timeout: 90000, maxBuffer: 1024 * 1024});
  assert.equal(result.status, 0, "Staging SQL failed; credentials/source contents withheld.");
  return result.stdout.trim();
}
const lock = await verifyMigrationLock();
assert.ok(lock.ok, "Migration lock mismatch. Review migrations before release.");
const files = Object.keys(lock.actual.files).sort();
const local = files.map(file => file.slice(0, 14));
const remote = sql("select version from supabase_migrations.schema_migrations order by version;").split(/\r?\n/);
assert.ok(remote.every(version => local.includes(version)), "Unknown staging migration history. Stopped.");
const pending = files.filter(file => !remote.includes(file.slice(0, 14)));
console.log(`Verified staging ${project}; pending: ${pending.join(", ") || "none"}`);
if (mode === "inspect") {
  console.log(sql("select 'report_locations='||(to_regprocedure('public.report_flock_locations(uuid)') is not null)::text;"));
  console.log(sql(`select json_build_object('last90_daily_records',count(*),'egg_values',count(d.total_eggs),
    'positive_egg_records',count(*) filter(where d.total_eggs>0),
    'layer_parent_records',count(*) filter(where f.flock_type in ('layer','parent_stock')),
    'first_record',min(d.record_date),'last_record',max(d.record_date))
    from public.daily_farm_records d join public.flocks f on f.id=d.flock_id and f.org_id=d.org_id
    where d.voided_at is null and d.record_date between (now() at time zone 'Africa/Addis_Ababa')::date-89 and (now() at time zone 'Africa/Addis_Ababa')::date;`));
} else {
  assert.ok(pending.every(file => /^202610(18|19|20)\d{6}_/.test(file)), "Pending migrations outside reporting release window require review.");
  const statements = [];
  for (const file of pending) {
    const body = await readFile(`supabase/migrations/${file}`, "utf8");
    const delimiter = "$performance_release_sql$";
    assert.ok(!body.includes(delimiter));
    statements.push(body);
    if (mode === "deploy") statements.push(`insert into supabase_migrations.schema_migrations(version,name,statements) values('${file.slice(0,14)}','${file.slice(15,-4)}',array[${delimiter}${body}${delimiter}]);`);
  }
  statements.push("select * from public.report_flock_locations((select id from public.organizations order by id limit 1)) limit 0;");
  sql(`begin; set local lock_timeout='10s'; set local statement_timeout='60s'; select pg_advisory_xact_lock(hashtext('farm_performance_staging_release'));\n${statements.join("\n")}\n${mode === "deploy" ? "commit" : "rollback"};`);
  console.log(`PASS: staging reporting ${mode === "deploy" ? "migration transaction committed" : "dry run rolled back"}. Production not accessed.`);
}
