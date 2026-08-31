import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const migrationDirectory = path.join(repositoryRoot, "supabase", "migrations");
export const migrationLockPath = path.join(repositoryRoot, "supabase", "migrations.lock.json");
export const migrationBaselineManifestPath = path.join(repositoryRoot, "supabase", "migration-baseline.json");
export const legacyMigrationMapPath = path.join(repositoryRoot, "supabase", "legacy-migration-map.json");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const present = (value) => typeof value === "string" && value.trim().length > 0;
const compareCodePoints = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function parseEnvironmentFile(contents) {
  const parsed = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    parsed[match[1]] = value;
  }
  return parsed;
}

export async function loadDeploymentEnvironment(systemEnvironment = process.env) {
  let local = {};
  try {
    local = parseEnvironmentFile(await readFile(path.join(repositoryRoot, ".env.local"), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return { ...local, ...systemEnvironment };
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateEnvironment(env = process.env) {
  const errors = [];
  const warnings = [];
  const environment = env.APP_ENVIRONMENT?.trim() || "local";
  const cloudflareBuild = present(env.WORKERS_CI_COMMIT_SHA);
  const reconciliationAi = env.RECONCILIATION_AI_ENABLED?.trim().toLowerCase();
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_ACCESS_CODE",
  ];

  if (!["local", "ci", "staging", "production"].includes(environment)) {
    errors.push("APP_ENVIRONMENT must be local, ci, staging, or production.");
  }
  if (cloudflareBuild && environment === "local") {
    errors.push("APP_ENVIRONMENT must be explicitly set for a Cloudflare build.");
  }
  if (reconciliationAi && !["true", "false"].includes(reconciliationAi)) {
    errors.push("RECONCILIATION_AI_ENABLED must be true or false when set.");
  }
  if (present(env.NEXT_PUBLIC_GROQ_API_KEY)) {
    errors.push("NEXT_PUBLIC_GROQ_API_KEY is forbidden; GROQ_API_KEY must remain server-only.");
  }
  for (const key of required) if (!present(env[key])) errors.push(`${key} is required.`);

  if (present(env.NEXT_PUBLIC_SUPABASE_URL) && !validHttpUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTP(S) URL.");
  }
  if (present(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.length < 12) {
    errors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is unexpectedly short.");
  }
  if (present(env.SUPABASE_SERVICE_ROLE_KEY) && env.SUPABASE_SERVICE_ROLE_KEY.length < 12) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY is unexpectedly short.");
  }
  if (present(env.ADMIN_ACCESS_CODE) && env.ADMIN_ACCESS_CODE.length < 12) {
    errors.push("ADMIN_ACCESS_CODE must contain at least 12 characters.");
  }
  if (present(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push("The public Supabase key and service-role key must be different.");
  }

  if (["staging", "production"].includes(environment)) {
    if (!present(env.APP_RELEASE) || !/^[A-Za-z0-9._-]{7,128}$/.test(env.APP_RELEASE)) {
      errors.push("APP_RELEASE must identify the immutable commit or release in staging and production.");
    }
    if (!present(env.APP_BASE_URL) || !validHttpUrl(env.APP_BASE_URL)) {
      errors.push("APP_BASE_URL must be a valid URL in staging and production.");
    }
    for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "APP_BASE_URL"]) {
      const value = env[key] || "";
      if (/localhost|127\.0\.0\.1|example\./i.test(value)) errors.push(`${key} cannot use a local or example host in ${environment}.`);
      if (value && !value.startsWith("https://")) errors.push(`${key} must use HTTPS in ${environment}.`);
    }
    if (!present(env.SUPABASE_PROJECT_REF)) errors.push("SUPABASE_PROJECT_REF is required to bind the release to the intended database project.");
    if (!present(env.MONITORING_INGEST_TOKEN) || env.MONITORING_INGEST_TOKEN.trim().length < 24) {
      errors.push("MONITORING_INGEST_TOKEN must contain at least 24 characters in staging and production.");
    }
    if (reconciliationAi === "true" && !present(env.GROQ_API_KEY)) errors.push("GROQ_API_KEY is required when Record Checks AI is enabled.");
    if (present(env.SUPABASE_PROJECT_REF) && present(env.NEXT_PUBLIC_SUPABASE_URL)) {
      const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname;
      if (host.endsWith(".supabase.co") && host.split(".")[0] !== env.SUPABASE_PROJECT_REF) {
        errors.push("SUPABASE_PROJECT_REF does not match NEXT_PUBLIC_SUPABASE_URL.");
      }
    }
  } else if (!present(env.APP_RELEASE)) {
    warnings.push("APP_RELEASE is not set; local builds will be labeled unversioned.");
  }

  if (present(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    warnings.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is unused; configure NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY instead.");
  }

  return {
    ok: errors.length === 0,
    environment,
    release: env.APP_RELEASE || "unversioned",
    errors,
    warnings,
  };
}

export function validateMigrationSequence(names, coveredThrough) {
  const errors = [];
  const versions = new Map();
  const coveredIndex = names.indexOf(coveredThrough);
  if (coveredIndex < 0) errors.push(`Baseline head is missing from migrations: ${coveredThrough}`);

  for (const [index, name] of names.entries()) {
    if (!/^\d{14}_[a-z0-9][a-z0-9_]*\.sql$/.test(name)) {
      errors.push(`Migration filename must use a unique 14-digit UTC version: ${name}`);
      continue;
    }
    const version = name.split("_", 1)[0];
    versions.set(version, [...(versions.get(version) || []), { index, name }]);
  }

  const duplicateVersions = [];
  for (const [version, entries] of versions) {
    if (entries.length < 2) continue;
    duplicateVersions.push(version);
    errors.push(`Duplicate migration version is not allowed: ${version}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    coveredIndex,
    duplicateVersions,
    coveredNames: coveredIndex < 0 ? [] : names.slice(0, coveredIndex + 1),
  };
}

export async function loadMigrationBaseline() {
  const manifest = JSON.parse(await readFile(migrationBaselineManifestPath, "utf8"));
  const schemaPath = path.resolve(path.dirname(migrationBaselineManifestPath), manifest.schemaFile || "");
  const baselineRoot = `${path.join(repositoryRoot, "supabase", "baselines")}${path.sep}`;
  if (!schemaPath.startsWith(baselineRoot)) throw new Error("Migration baseline schemaFile must stay inside supabase/baselines.");
  const schemaHash = sha256(await readFile(schemaPath));
  if (schemaHash !== manifest.schemaSha256) throw new Error("Migration baseline differs from its verified SHA-256 hash.");
  if (manifest.containsBusinessData !== false) throw new Error("Migration baseline must explicitly declare that it contains no business data.");
  if (!Array.isArray(manifest.retiredHistoryVersions) || manifest.retiredHistoryVersions.some((version) => !/^\d{8}$/.test(version))) {
    throw new Error("Migration baseline retiredHistoryVersions must contain only legacy eight-digit versions.");
  }
  return { ...manifest, schemaPath, schemaHash };
}

export async function loadLegacyMigrationMap() {
  const migrationMap = JSON.parse(await readFile(legacyMigrationMapPath, "utf8"));
  const entries = Object.entries(migrationMap.files || {}).sort(([left], [right]) => compareCodePoints(left, right));
  if (!entries.length) throw new Error("Legacy migration map must preserve at least one canonicalized filename.");
  const canonical = [];
  for (const [legacyName, canonicalName] of entries) {
    if (!/^\d{8}_[a-z0-9][a-z0-9_]*\.sql$/.test(legacyName)) throw new Error(`Invalid legacy migration name: ${legacyName}`);
    if (!/^\d{14}_[a-z0-9][a-z0-9_]*\.sql$/.test(canonicalName)) throw new Error(`Invalid canonical migration name: ${canonicalName}`);
    const contentHash = sha256(await readFile(path.join(migrationDirectory, canonicalName)));
    canonical.push(`${legacyName}\0${canonicalName}\0${contentHash}\n`);
  }
  const aggregateSha256 = sha256(canonical.join(""));
  if (aggregateSha256 !== migrationMap.contentAggregateSha256) {
    throw new Error("Canonicalized legacy migration contents differ from the reviewed migration map.");
  }
  return { ...migrationMap, aggregateSha256 };
}

export async function buildMigrationLock() {
  const names = (await readdir(migrationDirectory)).filter((name) => name.endsWith(".sql")).sort(compareCodePoints);
  const baseline = await loadMigrationBaseline();
  const legacyMap = await loadLegacyMigrationMap();
  const sequence = validateMigrationSequence(names, baseline.coveredThrough);
  if (!sequence.ok) throw new Error(sequence.errors.join("\n"));
  const files = {};
  for (const name of names) {
    files[name] = sha256(await readFile(path.join(migrationDirectory, name)));
  }
  const canonical = [
    `baseline\0${baseline.schemaHash}\0${baseline.coveredThrough}\n`,
    `retired\0${baseline.retiredHistoryVersions.join(",")}\n`,
    `legacy-map\0${legacyMap.aggregateSha256}\n`,
    Object.entries(files).map(([name, hash]) => `${name}\0${hash}\n`).join(""),
  ].join("");
  return {
    version: 2,
    algorithm: "sha256",
    count: names.length,
    latest: names.at(-1) || null,
    aggregateSha256: sha256(canonical),
    baseline: {
      schemaFile: baseline.schemaFile,
      schemaSha256: baseline.schemaHash,
      coveredThrough: baseline.coveredThrough,
      containsBusinessData: false,
      retiredHistoryVersions: baseline.retiredHistoryVersions,
    },
    baselineCoveredVersions: [...new Set(sequence.coveredNames.map((name) => name.split("_", 1)[0]))],
    legacyMigrationMapSha256: legacyMap.aggregateSha256,
    files,
  };
}

export async function verifyMigrationLock() {
  const expected = JSON.parse(await readFile(migrationLockPath, "utf8"));
  const actual = await buildMigrationLock();
  const errors = [];
  if (expected.aggregateSha256 !== actual.aggregateSha256) errors.push("Migration files differ from the reviewed lock.");
  if (expected.count !== actual.count) errors.push(`Migration count changed from ${expected.count} to ${actual.count}.`);
  if (expected.latest !== actual.latest) errors.push(`Latest migration changed from ${expected.latest} to ${actual.latest}.`);
  if (expected.baseline?.schemaSha256 !== actual.baseline.schemaSha256) errors.push("Migration baseline hash changed.");
  if (expected.baseline?.coveredThrough !== actual.baseline.coveredThrough) errors.push("Migration baseline coverage changed.");
  if (expected.legacyMigrationMapSha256 !== actual.legacyMigrationMapSha256) errors.push("Legacy migration rename map changed.");
  if (JSON.stringify(expected.baseline?.retiredHistoryVersions || []) !== JSON.stringify(actual.baseline.retiredHistoryVersions)) {
    errors.push("Retired migration-history transition changed.");
  }
  return { ok: errors.length === 0, errors, expected, actual };
}

export async function createReleaseManifest(env = process.env) {
  const migration = await buildMigrationLock();
  const packageLockHash = sha256(await readFile(path.join(repositoryRoot, "package-lock.json")));
  return {
    application: "ethio-poultry-app",
    release: env.APP_RELEASE || "unversioned",
    environment: env.APP_ENVIRONMENT || "local",
    node: process.version,
    packageManager: "npm@10.9.2",
    packageLockSha256: packageLockHash,
    migrationCount: migration.count,
    migrationHead: migration.latest,
    migrationAggregateSha256: migration.aggregateSha256,
    migrationBaselineSha256: migration.baseline.schemaSha256,
    migrationBaselineCoveredThrough: migration.baseline.coveredThrough,
  };
}
