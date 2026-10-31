import assert from "node:assert/strict";
import test from "node:test";
import {build} from "esbuild";
import {fileURLToPath} from "node:url";

const state = {};
globalThis.__recordingStartResolution = state;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const org = id(1), farm = id(2), flock = id(3), findingId = id(4);
const actor = {userId: id(5), orgId: org, role: "farm_manager"};
class Query {
  constructor(table) {this.table = table; this.filters = [];}
  select() {return this;}
  eq(key, value) {this.filters.push(row => row[key] === value); return this;}
  order() {return this;}
  then(resolve, reject) {return Promise.resolve({data: [], error: null}).then(resolve, reject);}
  async maybeSingle() {
    const rows = this.table === "reconciliation_findings" ? [state.finding] : [];
    return {data: rows.find(row => this.filters.every(filter => filter(row))) ?? null, error: null};
  }
}
state.db = {from: table => new Query(table), rpc: async (name, args) => {
  state.calls.push({name, args}); return state.rpc;
}};
const stubs = {
  "server-only": "",
  "@/lib/access-context": 'export const governanceAdmin=globalThis.__recordingStartResolution.db; export const canAccessFarm=async()=>globalThis.__recordingStartResolution.allowed; export const canAccessWarehouse=async()=>false;',
  "@/lib/warehouse-access": 'export const managerWarehouseAccess=async()=>[];',
  "@/lib/flock-lifecycle/server": 'export const addisOperatingDate=()=>"2026-10-31";',
  "next-intl/server": 'export const getLocale=async()=>"en"; export const getTranslations=async()=>Object.assign(key=>key,{has:()=>false});',
  "@/lib/reconciliation-workflow": 'export const reconciliationWorkflow=()=>({plainTitle:"Check",plainExplanation:"Evidence missing",verification:"Check again"});',
};
const bundle = await build({stdin: {contents: 'export {loadFindingResolution} from "./src/lib/reconciliation-resolution.ts"; export {prepareRecordingStart} from "./src/lib/recording-start.ts";', resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts"}, bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent", plugins: [{name: "record-check-transport", setup(builder) {
  builder.onResolve({filter: /^(server-only|next-intl\/server|@\/lib\/)/}, args => args.path in stubs ? {path: args.path, namespace: "stub"} : undefined);
  builder.onLoad({filter: /.*/, namespace: "stub"}, args => ({contents: stubs[args.path], loader: "js"}));
}}]});
const {loadFindingResolution, prepareRecordingStart} = await import(`data:text/javascript;base64,${Buffer.from(`${bundle.outputFiles[0].text}\n//# sourceURL=recording-start-resolution-test.js`).toString("base64")}`);
function reset() {
  state.allowed = true; state.calls = [];
  state.finding = {id: findingId, org_id: org, farm_id: farm, flock_id: flock, rule_code: "EGG_OPENING_BALANCE_UNAVAILABLE", status: "open", evidence: {}, record_date: "2026-09-01"};
  state.rpc = {data: {farm_id: farm, flock_type: "layer", placement_date: "2026-09-01", last_record_date: null, existing_start: false, existing_egg_balance: false, expected_revision: "trusted", updated_at: "2026-10-31T00:00:00Z", current_birds: 98}, error: null};
}
test("Record Checks offers today's exact physical-start form without replacing historical choices", async () => {
  reset();
  const result = await loadFindingResolution(actor, findingId);
  assert.deepEqual(result.recordingStart, {farmId: farm, flockId: flock, workDate: "2026-10-31", eggProducing: true});
  assert.equal(result.target.date, "2026-09-01");
  assert.ok(result.choices.some(choice => choice.id === "legacy_balance" && choice.href.includes("egg_opening_balance")));
  assert.deepEqual(state.calls[0].args, {p_actor: actor.userId, p_flock: flock});
});
test("archived, revoked, cross-farm and already-established contexts never offer a new baseline", async () => {
  for (const patch of [{existing_start: true}, {existing_egg_balance: true}, {last_record_date: "2026-10-31"}, {last_record_date: "2026-10-30", last_record_closing_birds: 0}, {farm_id: id(77)}]) {
    reset(); Object.assign(state.rpc.data, patch);
    assert.equal((await loadFindingResolution(actor, findingId)).recordingStart, undefined);
  }
  for (const code of ["23514", "42501"]) {
    reset(); state.rpc = {data: null, error: {code}};
    assert.equal((await loadFindingResolution(actor, findingId)).recordingStart, undefined);
  }
  reset(); state.allowed = false;
  await assert.rejects(loadFindingResolution(actor, findingId), {status: 403});
  assert.equal(state.calls.length, 0);
  reset(); state.finding.org_id = id(99);
  await assert.rejects(loadFindingResolution(actor, findingId), {status: 404});
});
test("CEO, support, resolved and unrelated checks retain correction-only guidance", async () => {
  for (const ctx of [{...actor, role: "ceo"}, {...actor, supportSessionId: id(88)}]) {
    reset(); assert.equal((await loadFindingResolution(ctx, findingId)).recordingStart, undefined);
    assert.equal(state.calls.length, 0);
  }
  for (const patch of [{status: "resolved"}, {status: "accepted_exception"}, {rule_code: "BIRD_DAY_IMBALANCE"}]) {
    reset(); Object.assign(state.finding, patch);
    assert.equal((await loadFindingResolution(actor, findingId)).recordingStart, undefined);
    assert.equal(state.calls.length, 0);
  }
});
test("a read failure is not treated as permission to invent a starting point", async () => {
  reset(); state.rpc = {data: null, error: {code: "08006"}};
  await assert.rejects(loadFindingResolution(actor, findingId), {code: "08006"});
});
const proposal = () => ({request_type: "recording_start", farm_id: farm, finding_id: findingId, proposed_values: {flock_id: flock, effective_date: "2026-10-31", live_birds: 98, opening_eggs: 0, supporting_reference: "Count sheet"}});
test("submission rechecks exact finding scope and retains the return context", async () => {
  reset();
  const prepared = await prepareRecordingStart(actor, proposal());
  const url = new URL(prepared.correction_route, "http://localhost");
  assert.equal(url.pathname, "/app/today");
  assert.equal(url.searchParams.get("finding"), findingId);
  assert.equal(url.searchParams.get("flock_id"), flock);
  assert.equal(url.searchParams.get("task"), "birds");
  assert.equal(prepared.proposed_values.expected_revision, "trusted");
  for (const patch of [{org_id: id(99)}, {farm_id: id(99)}, {flock_id: id(99)}, {status: "resolved"}, {rule_code: "BIRD_DAY_IMBALANCE"}]) {
    reset(); Object.assign(state.finding, patch);
    await assert.rejects(prepareRecordingStart(actor, proposal()), /START_SCOPE_CHANGED/);
  }
});
