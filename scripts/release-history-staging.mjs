import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import nextEnv from "@next/env";
import {verifyMigrationLock} from "./deployment-contract.mjs";
import {historySources, sourceColumns} from "../src/lib/history/sources.ts";

nextEnv.loadEnvConfig(process.cwd());
const mode = process.argv[2];
assert.ok(["check", "deploy"].includes(mode), "Use check (rollback) or deploy.");
const project = "uzmhpecehmlwojdmitgj", connection = process.env.STAGING_DB_URL;
assert.ok(connection, "STAGING_DB_URL is required; never paste credentials into chat.");
const target = new URL(connection);
assert.ok(target.hostname === `db.${project}.supabase.co` || (target.hostname.endsWith(".pooler.supabase.com") && target.username === `postgres.${project}`), "Unverified staging target; stopped.");
function sql(input) {
  const result = spawnSync("psql", ["-X", "-Atq", "-v", "ON_ERROR_STOP=1", "--dbname", connection], {input, encoding: "utf8", timeout: 90000, maxBuffer: 1024 * 1024});
  assert.equal(result.status, 0, "Staging SQL failed; credentials and source contents withheld.");
  return result.stdout.trim();
}
const name = "20261018000000_history_stock_operating_dates.sql", version = name.slice(0,14);
const lock = await verifyMigrationLock();
assert.ok(lock.ok, "Migration lock mismatch.");
const local = Object.keys(lock.actual.files).map(file => file.slice(0,14));
const remote = sql("select version from supabase_migrations.schema_migrations order by version;").split(/\r?\n/);
assert.ok(remote.every(value => local.includes(value)), "Unknown staging migration; inspect before release.");
assert.deepEqual(local.filter(value => value !== version), remote.filter(value => value !== version), "Staging predecessor history differs.");
const pending = !remote.includes(version);
const body = await readFile(`supabase/migrations/${name}`, "utf8");
const checks = (await readFile("tests/database/history-stock-projection.integration.sql", "utf8")).replace(/^begin;\s*/, "").replace(/rollback;\s*$/, "");
const projections = historySources.map(source => `select ${sourceColumns(source)} from public.${source.table} limit 0;`).join("\n");
const delimiter = "$history_migration_body$";
assert.ok(!body.includes(delimiter));
const history = pending && mode === "deploy" ? `insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','history_stock_operating_dates',array[${delimiter}${body}${delimiter}]);` : "";
sql(`begin; set local lock_timeout='10s'; set local statement_timeout='60s'; select pg_advisory_xact_lock(hashtext('history_staging_release'));\n${pending ? body : ""}\n${checks}\n${projections}\n${history}\n${mode === "deploy" ? "commit" : "rollback"};`);
console.log(`PASS: staging History ${mode === "deploy" ? "migration applied/verified" : "transactional dry run rolled back"}; view permissions, ledger preservation and ${historySources.length} source projections verified. Production not accessed.`);
