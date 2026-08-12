import { spawnSync } from "node:child_process";
import path from "node:path";

import { repositoryRoot } from "./deployment-contract.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("error: DATABASE_URL is required. It is never printed by this command.");
  process.exit(1);
}

const verificationFile = path.join(repositoryRoot, "supabase", "verification", "deployment_preflight.sql");
const result = spawnSync("psql", ["-X", "--single-transaction", "--variable", "ON_ERROR_STOP=1", "--file", verificationFile, "--dbname", databaseUrl], {
  cwd: repositoryRoot,
  encoding: "utf8",
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) {
  console.error(`error: Unable to execute psql: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
