import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("manifest supplies an installable standalone application identity", async () => {
  const manifest = await read("../src/app/manifest.ts");
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /start_url: "\/app\/farm-manager"/);
  assert.match(manifest, /purpose: "maskable"/);
});

test("service worker caches only static assets and never protected routes", async () => {
  const worker = await read("../public/sw.js");
  assert.match(worker, /\/_next\/static\//);
  assert.doesNotMatch(worker, /pathname\.startsWith\("\/app\//);
  assert.doesNotMatch(worker, /pathname\.startsWith\("\/api\//);
  assert.match(worker, /request\.method !== "GET"/);
});

test("deployment headers prevent caching service worker, APIs, and app pages", async () => {
  const headers = await read("../public/_headers");
  for (const path of ["/sw.js", "/api/*", "/app/*"]) assert.match(headers, new RegExp(path.replace(/[/*]/g, "\\$&")));
  assert.match(headers, /private, no-store/);
  assert.match(headers, /Service-Worker-Allowed: \//);
});
