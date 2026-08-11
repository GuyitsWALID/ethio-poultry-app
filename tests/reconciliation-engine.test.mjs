import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/reconciliation-engine.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const engine = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function input(overrides = {}) {
  return {
    asOfDate: "2026-08-09", daily: [], flocks: [], farms: [], houses: [], batches: [], closures: [],
    sessions: [], stock: [], mortality: [], sales: [], conversions: [], physicalCounts: [], warehouses: [],
    costEntries: [], costAllocations: [], costPeriods: [], operatingDays: [], approvedCorrectionSourceIds: new Set(),
    ...overrides,
  };
}

const farm = { id:"farm-1", branchId:"branch-1", name:"Farm One" };
const house = { id:"house-1", farmId:"farm-1", name:"House One" };
const batch = { id:"batch-1", farmId:"farm-1", houseId:"house-1", totalCount:100, status:"active", code:"B-1" };
const flock = { id:"flock-1", code:"F-1", status:"active", farmId:"farm-1", houseId:"house-1", batchId:"batch-1", placementDate:"2026-08-01", initialCount:100, currentCount:99 };
const daily = { id:"daily-1", flockId:"flock-1", recordDate:"2026-08-09", openingBirds:100, closingBirds:99, deaths:2, culls:0, transfersIn:0, transfersOut:0, otherRemovals:0, totalEggs:100, normalEggs:90, brokenEggs:5, dirtyEggs:4, feedKg:8, updatedAt:"2026-08-09T15:00:00Z", recordedBy:"manager-1" };

test("detects bird custody, egg classification, mortality allocation, and locked-record contradictions", () => {
  const findings = engine.evaluateOperationalReconciliation(input({
    farms:[farm], houses:[house], batches:[batch], flocks:[flock], daily:[daily],
    mortality:[{id:"mort-1",flockId:"flock-1",recordDate:"2026-08-09",count:1}],
    operatingDays:[{farmId:"farm-1",date:"2026-08-09",status:"locked",lockedAt:"2026-08-09T10:00:00Z"}],
  }));
  const codes = new Set(findings.map(item => item.ruleCode));
  assert(codes.has("BIRD_DAY_IMBALANCE"));
  assert(codes.has("EGG_CLASSIFICATION_MISMATCH"));
  assert(codes.has("MORTALITY_ALLOCATION_MISMATCH"));
  assert(codes.has("LOCKED_RECORD_CHANGED_WITHOUT_APPROVAL"));
});

test("reconciles a feed close independently against sessions, Daily Records, and stock", () => {
  const findings = engine.evaluateOperationalReconciliation(input({
    farms:[farm], houses:[house], batches:[batch], flocks:[flock], daily:[daily],
    closures:[{id:"close-1",flockId:"flock-1",recordDate:"2026-08-09",actualKg:10,status:"closed"}],
    sessions:[{id:"session-1",flockId:"flock-1",recordDate:"2026-08-09",actualKg:9,status:"completed"}],
    stock:[{id:"stock-1",warehouseId:"wh-1",itemId:"feed-1",flockId:"flock-1",transactionType:"issue",quantity:7,unitCost:50,sourceKind:"feed_day_close",sourceKey:"flock-1:2026-08-09",transactionDate:"2026-08-09",recordedBy:"manager-1"}],
  }));
  const codes = new Set(findings.map(item => item.ruleCode));
  assert(codes.has("FEED_SESSION_CLOSE_MISMATCH"));
  assert(codes.has("FEED_DAILY_SYNC_MISMATCH"));
  assert(codes.has("FEED_STOCK_ISSUE_MISMATCH"));
});

test("flags negative egg custody, duplicate sales, and physical stock exposure", () => {
  const sale = {id:"sale-1",flockId:"flock-1",farmId:"farm-1",saleDate:"2026-08-09",category:"egg",label:"Table eggs",quantity:4,unit:"tray",grossAmount:1200,customer:"Buyer",createdAt:"2026-08-09T12:00:00Z",recordedBy:"manager-1"};
  const findings = engine.evaluateOperationalReconciliation(input({
    farms:[farm], houses:[house], batches:[batch], flocks:[{...flock,placementDate:"2026-08-09"}], daily:[daily], conversions:[{category:"egg",unit:"tray",multiplier:30}],
    sales:[sale,{...sale,id:"sale-2"}], physicalCounts:[{id:"count-1",warehouseId:"wh-1",itemId:"feed-1",countDate:"2026-08-09",ledgerQuantity:100,countedQuantity:80,unitCost:50,countedBy:"manager-1"}],
  }));
  const codes = new Set(findings.map(item => item.ruleCode));
  assert(codes.has("EGG_SALES_EXCEED_PRODUCTION"));
  assert(codes.has("POSSIBLE_DUPLICATE_SALE"));
  assert(codes.has("PHYSICAL_STOCK_VARIANCE"));
  assert.equal(findings.find(item => item.ruleCode === "PHYSICAL_STOCK_VARIANCE").estimatedImpactEtb, 1000);
});

test("trust summary excludes resolved and accepted exceptions", () => {
  const summary = engine.summarizeFindings([
    {severity:"critical",status:"open",domain:"feed",estimatedImpactEtb:500},
    {severity:"high",status:"resolved",domain:"birds",estimatedImpactEtb:900},
    {severity:"medium",status:"accepted_exception",domain:"inventory",estimatedImpactEtb:100},
  ]);
  assert.equal(summary.active, 1);
  assert.equal(summary.critical, 1);
  assert.equal(summary.estimatedImpactEtb, 500);
  assert.equal(summary.trustScore, 80);
});
