import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const contextRoute = await readFile(new URL("../src/app/api/me/context/route.ts", import.meta.url), "utf8");
const scopeProvider = await readFile(new URL("../src/components/farm-scope-context.tsx", import.meta.url), "utf8");
const sidebar = await readFile(new URL("../src/components/app-sidebar.tsx", import.meta.url), "utf8");
const signIn = await readFile(new URL("../src/app/auth/sign-in/page.tsx", import.meta.url), "utf8");
const appLayout = await readFile(new URL("../src/app/app/layout.tsx", import.meta.url), "utf8");
const appShell = await readFile(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const scopeOptionsRoute = await readFile(new URL("../src/app/api/scope/options/route.ts", import.meta.url), "utf8");

test("role context cannot be reused across authenticated identities", () => {
  assert.match(contextRoute, /Cache-Control["']:\s*["']private, no-store["']/);
  assert.match(scopeProvider, /fetch\("\/api\/me\/context",\s*\{\s*method:\s*"GET",\s*cache:\s*"no-store"\s*\}\)/);
  assert.match(sidebar, /fetch\("\/api\/me\/context",\s*\{\s*method:\s*"GET",\s*cache:\s*"no-store"\s*\}\)/);
});

test("successful sign-in starts a fresh authenticated document", () => {
  const hardNavigations = signIn.match(/window\.location\.replace\(await destinationForRole\(/g) ?? [];
  assert.equal(hardNavigations.length, 2);
  assert.doesNotMatch(signIn, /router\.replace\(routeForRole\(/);
  assert.match(signIn, /todayWorkspaceEnabled \? "\/app\/today"/);
});

test("authenticated routes use the server-confirmed role instead of a client-side CEO default", () => {
  assert.match(appLayout, /<FarmScopeProvider viewerRole=\{viewerRole\} todayWorkspaceEnabled=\{todayWorkspaceEnabled\}>/);
  assert.match(appShell, /<AppSidebar viewerRole=\{viewerRole\}/);
  assert.match(scopeProvider, /FarmScopeProvider\(\{ children, viewerRole, todayWorkspaceEnabled/);
  assert.match(sidebar, /AppSidebar\(\{ viewerRole,/);
  assert.doesNotMatch(sidebar, /useState<AppRole>\("ceo"\)/);
});

test("assigned farm options cannot be reused across authenticated identities", () => {
  assert.match(scopeOptionsRoute, /Cache-Control["']:\s*["']private, no-store["']/);
  assert.match(scopeProvider, /fetch\("\/api\/scope\/options",\s*\{\s*method:\s*"GET",\s*cache:\s*"no-store"\s*\}\)/);
});
