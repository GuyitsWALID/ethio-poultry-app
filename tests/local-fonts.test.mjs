import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("production typography is bundled locally without remote font downloads", async () => {
  const layout = await readFile(resolve("src/app/layout.tsx"), "utf8");
  assert.match(layout, /from\s+["']next\/font\/local["']/);
  assert.doesNotMatch(layout, /next\/font\/google|fonts\.googleapis|fonts\.gstatic/);

  const sourceFiles = [
    resolve("src/app/fonts/Fraunces-Variable.ttf"),
    resolve("src/app/fonts/IBMPlexSans-Variable.ttf"),
  ];
  for (const file of sourceFiles) {
    const content = await readFile(file);
    assert.ok(content.byteLength > 100_000, `${file} must contain a bundled font, not a placeholder.`);
  }
});
