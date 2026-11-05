// Read-only real-source integration. Not a browser/session impersonation test.
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import nextEnv from "@next/env";
import {createClient} from "@supabase/supabase-js";
import {build} from "esbuild";
import {execFileSync} from "node:child_process";
nextEnv.loadEnvConfig(process.cwd());
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, "uzmhpecehmlwojdmitgj.supabase.co");
const originalFetch = globalThis.fetch;
let trackReads = false, reads = 0;
const readLimit = Number(process.env.PERFORMANCE_SMOKE_READ_LIMIT ?? Infinity);
globalThis.fetch = async (input, init) => {
  if (trackReads && ++reads > readLimit) throw new Error("Too many subrequests");
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
const bundle = await build({stdin: {contents: 'export {loadFarmPerformance} from "./src/lib/farm-performance.server";export {loadOperationsAnalytics} from "./src/lib/operations-analytics-service";export {GET as mortality} from "./src/app/api/mortality/dashboard/route";', resolveDir: process.cwd()}, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{name: "verified-staging-context", setup(b) {
  b.onResolve({filter: /(?:^server-only$|access-context$)/}, args => ({path: args.path, namespace: "verified"}));
  b.onLoad({filter: /.*/, namespace: "verified"}, args => ({contents: args.path === "server-only" ? "" : "export const governanceAdmin=globalThis.__performanceStagingAdmin;export function getAccessContext(){if(!globalThis.__performanceStagingContext)throw Error('No verified context');return globalThis.__performanceStagingContext;}export const isAccessResponse=value=>value instanceof Response;"}));
}}]});
const filename = path.resolve(".performance-staging-smoke.cjs");
const loaded = new Module(filename);
loaded.filename = filename; loaded.paths = Module._nodeModulePaths(process.cwd());
loaded._compile(bundle.outputFiles[0].text, filename);
let originalReader;
if (process.env.PERFORMANCE_SMOKE_COMPARE_LEGACY === "1") {
  const original = await build({stdin: {contents: 'export {loadFarmPerformance} from "./src/lib/farm-performance.server";', resolveDir: process.cwd()}, bundle: true, write: false, platform: "node", format: "cjs", packages: "external", plugins: [{name: "pre-consolidation-reader", setup(b) {
    b.onResolve({filter: /(?:^server-only$|access-context$)/}, args => ({path: args.path, namespace: "verified"}));
    b.onLoad({filter: /.*/, namespace: "verified"}, args => ({contents: args.path === "server-only" ? "" : "export const governanceAdmin=globalThis.__performanceStagingAdmin;export function getAccessContext(){throw Error('Not a browser auth test')}export const isAccessResponse=value=>value instanceof Response;"}));
    b.onLoad({filter: /(?:farm-performance\.server|operations-analytics-service|sales-analytics-service|report-evidence\.server)\.ts$/}, args => ({contents: execFileSync("git", ["show", `a37a074:${path.relative(process.cwd(), args.path).replaceAll(path.sep, "/")}`], {encoding: "utf8"}), loader: "ts", resolveDir: path.dirname(args.path)}));
  }}]});
  const priorModule = new Module(filename); priorModule.filename = filename; priorModule.paths = loaded.paths; priorModule._compile(original.outputFiles[0].text, filename);
  originalReader = priorModule.exports.loadFarmPerformance;
}
let profileQuery = db.from("profiles").select("id,org_id,role").eq("is_active", true).in("role", ["ceo", "farm_manager"]);
if (process.env.PERFORMANCE_SMOKE_ORG_ID) profileQuery = profileQuery.eq("org_id", process.env.PERFORMANCE_SMOKE_ORG_ID);
const profiles = await profileQuery;
assert.equal(profiles.error, null);
const today = new Intl.DateTimeFormat("en-CA", {timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
const smokeDays = Number(process.env.PERFORMANCE_SMOKE_DAYS ?? 90);
assert.ok([7, 30, 90].includes(smokeDays), "Smoke period must be 7, 30 or 90 days");
for (const role of ["ceo", "farm_manager"]) {
  const actor = profiles.data.find(row => row.role === role); assert.ok(actor);
  const ctx = {userId: actor.id, orgId: actor.org_id, homeOrgId: actor.org_id, role, capabilities: [], supportSessionId: null, supportExpiresAt: null};
  globalThis.__performanceStagingContext = ctx;
  const input = {dateFrom: new Date(Date.parse(`${today}T00:00:00Z`) - (smokeDays - 1) * 86400000).toISOString().slice(0, 10), dateTo: today};
  if (process.env.PERFORMANCE_SMOKE_FROM) input.dateFrom = process.env.PERFORMANCE_SMOKE_FROM;
  if (process.env.PERFORMANCE_SMOKE_TO) input.dateTo = process.env.PERFORMANCE_SMOKE_TO;
  if (role === "farm_manager") {
    const grants = await db.from("user_farm_access").select("farm_id").eq("org_id", actor.org_id).eq("profile_id", actor.id).is("revoked_at", null).lte("starts_at", new Date().toISOString()).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).limit(1);
    assert.equal(grants.error, null); assert.ok(grants.data.length); input.farmId = grants.data[0].farm_id;
  }
  try {
    const params = new URLSearchParams({date_from: input.dateFrom, date_to: input.dateTo});
    if (input.farmId) params.set("farm_id", input.farmId);
    const operations = await loaded.exports.loadOperationsAnalytics(ctx, params);
    if (!operations.ok) console.error("Operations", role, operations.status, (await operations.json()).error);
    const mortality = await loaded.exports.mortality({nextUrl: new URL(`https://staging.invalid/api/mortality/dashboard?${params}`)});
    assert.equal(mortality.status, 200, "Legacy mortality source failed");
    reads = 0; trackReads = true;
    const result = await loaded.exports.loadFarmPerformance(ctx, input);
    trackReads = false;
    console.log(JSON.stringify({role, reads, states: Object.fromEntries(Object.entries(result.sections).map(([key, value]) => [key, value.state]))}));
    assert.ok(Object.values(result.sections).every(section => section.state !== "failed"), "A real staging section failed to load");
    if (originalReader) {
      const original = await originalReader(ctx, input);
      assert.deepEqual(result.sections, original.sections, "Consolidation changed reporting evidence or calculations");
      assert.deepEqual(result.concerns, original.concerns);
      assert.deepEqual(result.options, original.options);
      console.log(`${role}: exact pre-consolidation evidence parity passed`);
    }
  } catch (error) {
    trackReads = false;
    console.error(role, error instanceof Error ? error.message : "Performance reader failed");
    process.exitCode = 1;
  }
}
