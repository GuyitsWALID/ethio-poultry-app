import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
const sourceUrl = required("RECOVERY_SOURCE_DATABASE_URL");
const destinationUrl = process.env.RECOVERY_DESTINATION_DATABASE_URL?.trim() || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const destination = new URL(destinationUrl);
if (!["127.0.0.1", "localhost"].includes(destination.hostname)) {
  throw new Error("Recovery drills may restore only into an isolated local database.");
}
if (sourceUrl === destinationUrl) throw new Error("Recovery source and destination must be different databases.");

const appBaseUrl = required("APP_BASE_URL").replace(/\/$/, "");
const ingestToken = required("MONITORING_INGEST_TOKEN");
const environment = required("APP_ENVIRONMENT");
const release = process.env.APP_RELEASE?.trim() || null;
const runIdentity = `${process.env.GITHUB_RUN_ID || Date.now()}:${process.env.GITHUB_RUN_ATTEMPT || "1"}`;
const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const work = await mkdtemp(path.join(tmpdir(), "ethio-poultry-recovery-"));
const schemaPath = path.join(work, "schema.sql");
const dataPath = path.join(work, "data.sql");
const startedAt = Date.now();

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: capture ? "utf8" : undefined, shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}.`);
  return capture ? result.stdout.trim() : "";
}

function rowCounts(databaseUrl) {
  const sql = "select json_build_object('organizations',(select count(*) from public.organizations),'profiles',(select count(*) from public.profiles),'dailyRecords',(select count(*) from public.daily_farm_records),'auditEvents',(select count(*) from public.governance_audit_events))::text;";
  return JSON.parse(run("psql", [databaseUrl, "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], true));
}

async function submit(status, summary, details) {
  const durationMs = Date.now() - startedAt;
  const response = await fetch(`${appBaseUrl}/api/internal/monitoring/evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ingestToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      evidenceKind: "restore_drill", environment, status, provider: "supabase-cli",
      checkedAt: new Date().toISOString(), durationMs, release, summary, details,
      idempotencyKey: `${environment}:restore_drill:${runIdentity}`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Recovery evidence intake returned HTTP ${response.status}.`);
}

try {
  const sourceCounts = rowCounts(sourceUrl);
  run(executable, ["supabase", "db", "dump", "--db-url", sourceUrl, "--schema", "public", "-f", schemaPath]);
  run(executable, ["supabase", "db", "dump", "--db-url", sourceUrl, "--schema", "public", "--data-only", "--use-copy", "-f", dataPath]);
  run("psql", [destinationUrl, "-v", "ON_ERROR_STOP=1", "-c", "drop schema if exists public cascade; create schema public; grant all on schema public to postgres; grant usage on schema public to anon, authenticated, service_role;"]);
  run("psql", [destinationUrl, "-v", "ON_ERROR_STOP=1", "-f", schemaPath]);
  run("psql", [destinationUrl, "-v", "ON_ERROR_STOP=1", "-c", "set session_replication_role = replica;", "-f", dataPath, "-c", "set session_replication_role = origin;"]);
  run("psql", [destinationUrl, "-v", "ON_ERROR_STOP=1", "-f", "scripts/verify-recovery.sql"]);
  const restoredCounts = rowCounts(destinationUrl);
  if (JSON.stringify(sourceCounts) !== JSON.stringify(restoredCounts)) throw new Error("Restored critical row counts do not match the source database.");
  await submit("healthy", "The production public schema and data restored into an isolated database and passed integrity checks.", {
    destination: "isolated-local", verification: "critical-tables-and-row-counts",
    organizationRows: restoredCounts.organizations, profileRows: restoredCounts.profiles,
    dailyRecordRows: restoredCounts.dailyRecords, auditEventRows: restoredCounts.auditEvents,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : "Recovery drill failed.";
  try { await submit("failed", "The isolated restore drill did not complete.", { destination: "isolated-local", failedStep: message.slice(0, 160) }); } catch { /* The workflow failure remains external evidence if intake is unavailable. */ }
  throw error;
} finally {
  await rm(work, { recursive: true, force: true });
}
