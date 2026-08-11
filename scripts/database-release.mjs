import { spawnSync } from "node:child_process";
import path from "node:path";

import {
  buildMigrationLock,
  loadMigrationBaseline,
  repositoryRoot,
  verifyMigrationLock,
} from "./deployment-contract.mjs";

const command = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;
const supabaseCli = path.join(repositoryRoot, "node_modules", "supabase", "dist", "supabase.js");
const preflightSql = path.join(repositoryRoot, "supabase", "verification", "deployment_preflight.sql");
const baselinePreflightSql = path.join(repositoryRoot, "supabase", "verification", "baseline_preflight.sql");

if (!databaseUrl) fail("DATABASE_URL is required. It is never printed by this command.");

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function run(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: process.env,
    shell: false,
  });
  if (result.error) fail(`Unable to run ${path.basename(executable)}: ${result.error.message}`);
  if (result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    fail(`${path.basename(executable)} exited with status ${result.status}.`);
  }
  return options.capture ? result.stdout.trim() : "";
}

function psqlCapture(sql) {
  return run("psql", ["-X", "-A", "-t", "-q", "--variable", "ON_ERROR_STOP=1", "--dbname", databaseUrl, "--command", sql], { capture: true });
}

function publicTableCount() {
  return Number(psqlCapture("select count(*) from pg_tables where schemaname='public';"));
}

function remoteMigrationVersions() {
  const exists = psqlCapture("select to_regclass('supabase_migrations.schema_migrations') is not null;") === "t";
  if (!exists) return [];
  const output = psqlCapture("select version from supabase_migrations.schema_migrations order by version;");
  return output ? output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) : [];
}

function runPreflight() {
  run("psql", ["-X", "--single-transaction", "--variable", "ON_ERROR_STOP=1", "--file", preflightSql, "--dbname", databaseUrl]);
}

function runBaselinePreflight() {
  run("psql", ["-X", "--single-transaction", "--variable", "ON_ERROR_STOP=1", "--file", baselinePreflightSql, "--dbname", databaseUrl]);
}

function runSupabase(args) {
  if (process.platform === "win32") run("supabase.exe", args);
  else run(process.execPath, [supabaseCli, ...args]);
}

async function migrationState() {
  const lock = await buildMigrationLock();
  const localVersions = [...new Set(Object.keys(lock.files).map((name) => name.split("_", 1)[0]))];
  const remoteVersions = remoteMigrationVersions();
  const remote = new Set(remoteVersions);
  const local = new Set(localVersions);
  const retired = new Set(lock.baseline.retiredHistoryVersions || []);
  return {
    lock,
    localVersions,
    remoteVersions,
    missingCovered: lock.baselineCoveredVersions.filter((version) => !remote.has(version)),
    pending: localVersions.filter((version) => !remote.has(version) && !lock.baselineCoveredVersions.includes(version)),
    retiredRemote: remoteVersions.filter((version) => retired.has(version)),
    unknownRemote: remoteVersions.filter((version) => !local.has(version) && !retired.has(version)),
  };
}

async function ensureLockedMigrations() {
  const verification = await verifyMigrationLock();
  if (!verification.ok) fail(verification.errors.join("\n"));
}

async function inspect() {
  await ensureLockedMigrations();
  const state = await migrationState();
  console.log(`Public tables: ${publicTableCount()}`);
  console.log(`Remote migration versions: ${state.remoteVersions.length}`);
  console.log(`Baseline-covered versions missing remotely: ${state.missingCovered.length}`);
  console.log(`Pending post-baseline migrations: ${state.pending.length}`);
  console.log(`Retired date-only history versions: ${state.retiredRemote.length}`);
  console.log(`Unknown remote versions: ${state.unknownRemote.length}`);
  if (state.missingCovered.length) console.log(`Missing: ${state.missingCovered.join(", ")}`);
  if (state.pending.length) console.log(`Pending: ${state.pending.join(", ")}`);
  if (state.retiredRemote.length) console.log(`Retired: ${state.retiredRemote.join(", ")}`);
  if (state.unknownRemote.length) console.log(`Unknown: ${state.unknownRemote.join(", ")}`);
}

async function adopt({ confirmed = false } = {}) {
  await ensureLockedMigrations();
  runBaselinePreflight();
  const state = await migrationState();
  if (state.unknownRemote.length) {
    fail(`Remote migration history contains versions absent from the repository: ${state.unknownRemote.join(", ")}`);
  }
  if (!state.missingCovered.length && !state.retiredRemote.length) {
    console.log("Verified baseline migration history is already adopted.");
    return;
  }
  if (!confirmed && process.env.DATABASE_HISTORY_CONFIRM !== "ADOPT_VERIFIED_BASELINE") {
    fail("Set DATABASE_HISTORY_CONFIRM=ADOPT_VERIFIED_BASELINE to authorize metadata-only baseline adoption.");
  }
  if (state.retiredRemote.length) {
    runSupabase(["migration", "repair", ...state.retiredRemote, "--status", "reverted", "--db-url", databaseUrl]);
  }
  if (state.missingCovered.length) {
    runSupabase(["migration", "repair", ...state.missingCovered, "--status", "applied", "--db-url", databaseUrl]);
  }
  const remaining = (await migrationState()).missingCovered;
  if (remaining.length) fail(`Migration history adoption is incomplete: ${remaining.join(", ")}`);
  console.log(`Adopted ${state.missingCovered.length} verified baseline versions and retired ${state.retiredRemote.length} date-only metadata versions without executing business SQL.`);
}

async function deploy({ confirmed = false } = {}) {
  await ensureLockedMigrations();
  if (publicTableCount() === 0) fail("Database is empty. Run `npm run db:bootstrap` instead of db:deploy.");
  const state = await migrationState();
  if (state.unknownRemote.length) fail(`Unknown remote migration versions: ${state.unknownRemote.join(", ")}`);
  if (state.retiredRemote.length) fail("Retired date-only history remains. Run `npm run db:history:adopt` first.");
  if (state.missingCovered.length) fail("Baseline history is not adopted. Run `npm run db:history:adopt` first.");
  if (!confirmed && process.env.DATABASE_DEPLOY_CONFIRM !== "APPLY_LOCKED_MIGRATIONS") {
    fail("Set DATABASE_DEPLOY_CONFIRM=APPLY_LOCKED_MIGRATIONS to authorize pending locked migrations.");
  }
  runSupabase(["db", "push", "--db-url", databaseUrl]);
  runPreflight();
  console.log("Locked migrations applied and database preflight passed.");
}

async function bootstrap() {
  await ensureLockedMigrations();
  if (process.env.DATABASE_BOOTSTRAP_CONFIRM !== "BOOTSTRAP_EMPTY_DATABASE") {
    fail("Set DATABASE_BOOTSTRAP_CONFIRM=BOOTSTRAP_EMPTY_DATABASE to authorize an empty-database bootstrap.");
  }
  if (publicTableCount() !== 0) fail("Bootstrap refused because the database already contains public tables.");
  if (remoteMigrationVersions().length !== 0) fail("Bootstrap refused because remote migration history is not empty.");

  const baseline = await loadMigrationBaseline();
  run("psql", ["-X", "--single-transaction", "--variable", "ON_ERROR_STOP=1", "--file", baseline.schemaPath, "--dbname", databaseUrl]);
  runBaselinePreflight();
  await adopt({ confirmed: true });
  await deploy({ confirmed: true });
  console.log("Empty database bootstrapped from the verified baseline and advanced to the locked migration head.");
}

if (command === "inspect") await inspect();
else if (command === "adopt") await adopt();
else if (command === "deploy") await deploy();
else if (command === "bootstrap") await bootstrap();
else fail("Usage: node scripts/database-release.mjs <inspect|adopt|deploy|bootstrap>");
