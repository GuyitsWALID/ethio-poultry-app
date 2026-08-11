import { writeFile } from "node:fs/promises";

import {
  buildMigrationLock,
  createReleaseManifest,
  loadDeploymentEnvironment,
  migrationLockPath,
  validateEnvironment,
  verifyMigrationLock,
} from "./deployment-contract.mjs";

const command = process.argv[2];
const environment = await loadDeploymentEnvironment(process.env);

if (command === "env") {
  const result = validateEnvironment(environment);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`error: ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`Environment contract valid for ${result.environment} (${result.release}).`);
  }
} else if (command === "migrations") {
  const result = await verifyMigrationLock();
  if (!result.ok) {
    for (const error of result.errors) console.error(`error: ${error}`);
    console.error("Review the SQL, then run `npm run migrations:lock` and commit the updated lock intentionally.");
    process.exitCode = 1;
  } else {
    console.log(`Migration contract valid: ${result.actual.count} files through ${result.actual.latest}.`);
  }
} else if (command === "lock") {
  const lock = await buildMigrationLock();
  await writeFile(migrationLockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  console.log(`Locked ${lock.count} reviewed migrations in supabase/migrations.lock.json.`);
} else if (command === "manifest") {
  console.log(JSON.stringify(await createReleaseManifest(environment), null, 2));
} else {
  console.error("Usage: node scripts/deployment-check.mjs <env|migrations|lock|manifest>");
  process.exitCode = 1;
}
