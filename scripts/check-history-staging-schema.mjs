import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import nextEnv from "@next/env";
import {historySources, sourceColumns} from "../src/lib/history/sources.ts";

nextEnv.loadEnvConfig(process.cwd());
const connection = process.env.STAGING_DB_URL;
assert.ok(connection, "STAGING_DB_URL is required; credentials must not be pasted into chat.");
const target = new URL(connection), project = "uzmhpecehmlwojdmitgj";
assert.ok(target.hostname === `db.${project}.supabase.co` ||
  (target.hostname.endsWith(".pooler.supabase.com") && target.username === `postgres.${project}`),
  "Refusing an unverified staging target.");
const queries = historySources.map(source => `select ${sourceColumns(source)} from public.${source.table} limit 0;`);
const result = spawnSync("psql", ["-X", "-Atq", "-v", "ON_ERROR_STOP=1", "--dbname", connection], {
  input: `begin read only;\n${queries.join("\n")}\nselect table_name,column_name,data_type from information_schema.columns where table_schema='public' and (${historySources.map(source => `(table_name='${source.table}' and column_name='${source.date}')`).join(" or ")});\nrollback;`,
  encoding: "utf8", timeout: 60000, maxBuffer: 1024 * 1024,
});
// Do not print database errors or connection details: they can contain credentials.
if (result.status !== 0) {
  const missing = result.stderr?.match(/(?:column|relation) [^\r\n]+? does not exist/);
  throw new Error(`Read-only staging schema check failed. ${missing?.[0] ?? "Connection details withheld."}`);
}
const dateTypes = result.stdout.trim().split(/\r?\n/).filter(row => row.includes("|"));
assert.ok(dateTypes.length > 0, "No operational date metadata returned.");
assert.ok(dateTypes.every(row => row.endsWith("|date")), `History operational dates must be date columns: ${dateTypes.filter(row => !row.endsWith("|date")).join(", ")}`);
console.log(`PASS: ${historySources.length} History source projections and operational date types verified against staging, read-only. Production not accessed.`);
