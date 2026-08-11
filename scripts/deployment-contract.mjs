import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const migrationDirectory = path.join(repositoryRoot, "supabase", "migrations");
export const migrationLockPath = path.join(repositoryRoot, "supabase", "migrations.lock.json");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const present = (value) => typeof value === "string" && value.trim().length > 0;

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
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_ACCESS_CODE",
  ];

  if (!["local", "ci", "staging", "production"].includes(environment)) {
    errors.push("APP_ENVIRONMENT must be local, ci, staging, or production.");
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

export async function buildMigrationLock() {
  const names = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
  const files = {};
  const versions = new Map();
  for (const name of names) {
    if (!/^\d{8}(?:\d{6})?_[a-z0-9][a-z0-9_]*\.sql$/.test(name)) {
      throw new Error(`Migration filename is not deterministic: ${name}`);
    }
    const version = name.split("_", 1)[0];
    versions.set(version, [...(versions.get(version) || []), name]);
    files[name] = sha256(await readFile(path.join(migrationDirectory, name)));
  }
  const duplicateVersions = [...versions.entries()].filter(([, entries]) => entries.length > 1).map(([version]) => version);
  const canonical = Object.entries(files).map(([name, hash]) => `${name}\0${hash}\n`).join("");
  return {
    version: 1,
    algorithm: "sha256",
    count: names.length,
    latest: names.at(-1) || null,
    aggregateSha256: sha256(canonical),
    legacyDuplicateVersions: duplicateVersions,
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
  const approvedLegacy = new Set(expected.legacyDuplicateVersions || []);
  for (const version of actual.legacyDuplicateVersions) {
    if (!approvedLegacy.has(version)) errors.push(`New duplicate migration version ${version} is not allowed.`);
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
  };
}
