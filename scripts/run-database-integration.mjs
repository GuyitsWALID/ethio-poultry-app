import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required for transactional database integration tests.");
  process.exit(1);
}

const directory = resolve("tests/database");
const files = readdirSync(directory).filter((name) => name.endsWith(".integration.sql")).sort();
if (!files.length) {
  console.error("No database integration SQL files were found.");
  process.exit(1);
}

for (const file of files) {
  console.log(`Running transactional database integration test: ${file}`);
  const result = spawnSync(
    "psql",
    ["--variable", "ON_ERROR_STOP=1", "--file", resolve(directory, file), "--dbname", databaseUrl],
    { stdio: "inherit", env: { ...process.env, PGAPPNAME: "ethiopoultry-item1-integration" } }
  );
  if (result.error) {
    console.error(`Unable to start psql: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`${files.length} database integration test file(s) passed and rolled back their fixtures.`);
