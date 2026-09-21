import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("client localization modules never import the server request configuration", async () => {
  const clientModules = await Promise.all([
    read("../src/i18n/locale-provider.tsx"),
    read("../src/components/locale-switch.tsx"),
  ]);
  for (const source of clientModules) {
    assert.doesNotMatch(source, /i18n\/request|\.\/request/);
    assert.match(source, /i18n\/locale|\.\/locale/);
  }
});

test("next headers remain isolated to the server request configuration", async () => {
  const [request, shared] = await Promise.all([
    read("../src/i18n/request.ts"),
    read("../src/i18n/locale.ts"),
  ]);
  assert.match(request, /next\/headers/);
  assert.doesNotMatch(shared, /next\/headers|next-intl\/server/);
});
