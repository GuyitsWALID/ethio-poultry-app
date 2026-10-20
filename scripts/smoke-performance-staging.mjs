// Read-only real-source integration. Not a browser/session impersonation test.
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import nextEnv from "@next/env";
import {createClient} from "@supabase/supabase-js";
import {build} from "esbuild";
nextEnv.loadEnvConfig(process.cwd());
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, "uzmhpecehmlwojdmitgj.supabase.co");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  if (!response.ok) {
    const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
    if (url.hostname === "uzmhpecehmlwojdmitgj.supabase.co" && url.pathname.startsWith("/rest/v1/")) {
      const body = await response.clone().json().catch(() => ({}));
      console.error("Staging read error", url.pathname, body.code, body.message);
    }
  }
  return response;
};
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false, autoRefreshToken: false}});
globalThis.__performanceStagingAdmin = db;
const bundle = await build({stdin: {contents: 'export {loadFarmPerformance} from "./src/lib/farm-performance.server";export {loadOperationsAnalytics} from "./src/lib/operations-analytics-service";', resolveDir: process.cwd()}, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{name: "verified-staging-context", setup(b) {
  b.onResolve({filter: /(?:^server-only$|access-context$)/}, args => ({path: args.path, namespace: "verified"}));
  b.onLoad({filter: /.*/, namespace: "verified"}, args => ({contents: args.path === "server-only" ? "" : "export const governanceAdmin=globalThis.__performanceStagingAdmin;export function getAccessContext(){throw Error('No session injected')}export const isAccessResponse=value=>value instanceof Response;"}));
}}]});
const filename = path.resolve(".performance-staging-smoke.cjs");
const loaded = new Module(filename);
loaded.filename = filename; loaded.paths = Module._nodeModulePaths(process.cwd());
loaded._compile(bundle.outputFiles[0].text, filename);
const profiles = await db.from("profiles").select("id,org_id,role").eq("is_active", true).in("role", ["ceo", "farm_manager"]);
assert.equal(profiles.error, null);
for (const role of ["ceo", "farm_manager"]) {
  const actor = profiles.data.find(row => row.role === role); assert.ok(actor);
  const ctx = {userId: actor.id, orgId: actor.org_id, homeOrgId: actor.org_id, role, capabilities: [], supportSessionId: null, supportExpiresAt: null};
  const input = {dateFrom: "2026-07-23", dateTo: "2026-10-20"};
  if (role === "farm_manager") {
    const grants = await db.from("user_farm_access").select("farm_id").eq("org_id", actor.org_id).eq("profile_id", actor.id).is("revoked_at", null).lte("starts_at", new Date().toISOString()).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1);
    assert.equal(grants.error, null); assert.ok(grants.data.length); input.farmId = grants.data[0].farm_id;
  }
  try {
    const params = new URLSearchParams({date_from: input.dateFrom, date_to: input.dateTo});
    if (input.farmId) params.set("farm_id", input.farmId);
    const operations = await loaded.exports.loadOperationsAnalytics(ctx, params);
    if (!operations.ok) console.error("Operations", role, operations.status, (await operations.json()).error);
    const result = await loaded.exports.loadFarmPerformance(ctx, input);
    console.log(JSON.stringify({role, states: Object.fromEntries(Object.entries(result.sections).map(([key, value]) => [key, value.state]))}));
    assert.ok(Object.values(result.sections).every(section => section.state !== "failed"), "A real staging section failed to load");
  } catch (error) {
    console.error(role, error instanceof Error ? error.message : "Performance reader failed");
    process.exitCode = 1;
  }
}
