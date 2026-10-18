import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {historySources, sourceColumns} from "../src/lib/history/sources.ts";

const migration = readFileSync("supabase/migrations/20261018000000_history_stock_operating_dates.sql", "utf8");
const integration = readFileSync("tests/database/history-stock-projection.integration.sql", "utf8").replace(/^begin;\s*/, "").replace(/rollback;\s*$/, "");
const projections = historySources.map(source => `select ${sourceColumns(source)} from public.${source.table} limit 0;`).join("\n");
const result = spawnSync("docker", ["--context", "desktop-linux", "exec", "-i", "supabase_db_ethio-poultry-app", "psql", "-X", "-U", "postgres", "-d", "ethio_flock_lifecycle_dryrun_20261007", "-Atq", "-v", "ON_ERROR_STOP=1"], {
  input: `begin;\n${migration}\n${integration}\n${projections}\nrollback;`, encoding: "utf8", timeout: 60000, maxBuffer: 1024 * 1024,
});
assert.equal(result.status, 0, result.stderr || "Local Docker dry run failed.");
console.log("PASS: History view migration, role grants, source preservation, Addis date boundary and all source projections. Transaction rolled back; no remote database accessed.");
