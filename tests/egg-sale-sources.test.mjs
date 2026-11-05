import assert from "node:assert/strict";
import test from "node:test";
import {eggSaleSourcesSchema, projectEggSale, projectEggSales} from "../src/lib/egg-sale-sources.ts";
import {eggUnitsSold, unitPricePerEgg} from "../src/lib/profitability.ts";
import {evaluateOperationalReconciliation} from "../src/lib/reconciliation-engine.ts";
import {isPerformanceReportVersion, readableReportVersion, performanceReportVersion} from "../src/lib/report-snapshot.ts";

const a = "22000000-0000-4000-8000-000000000001", b = "22000000-0000-4000-8000-000000000002";
const sale = {id:"one-sale",product_category:"egg",quantity:3,unit:"tray",unit_price:33.67,gross_amount:101.01,paid_amount:50.01,balance_due:51,
  egg_source_version:1,egg_conversion_multiplier:30,egg_sources:[{flock_id:a,egg_quantity:30,house_id:"A"},{flock_id:b,egg_quantity:60,house_id:"B"}]};
test("multi-flock allocation preserves one sale's money including cent remainders", () => {
  const rows = projectEggSale(sale);
  assert.equal(rows.length,2);
  for (const key of ["gross_amount","paid_amount","balance_due","quantity"]) assert.ok(Math.abs(rows.reduce((n,row)=>n+row[key],0)-sale[key])<1e-9,key);
  assert.equal(new Set(rows.map(row=>row.id)).size,1);
  assert.equal(rows[0].flock_id,a); assert.equal(rows[1].flock_id,b);
  assert.equal(rows[0].gross_amount,33.67); assert.equal(rows[1].gross_amount,67.34);
  assert.deepEqual(projectEggSale({...sale,egg_source_version:0}),[{...sale,egg_source_version:0}]);
  assert.throws(()=>projectEggSale({...sale,egg_sources:[]}));
});
test("source validation rejects duplicates, fractions, blank counts, negative and unsafe quantities", () => {
  for(const rows of [[],[{flock_id:a,egg_quantity:0}],[{flock_id:a,egg_quantity:1.5}],[{flock_id:a,egg_quantity:Infinity}],
    [{flock_id:a,egg_quantity:Number.MAX_SAFE_INTEGER+1}],[{flock_id:a,egg_quantity:1},{flock_id:a,egg_quantity:2}]]) assert.equal(eggSaleSourcesSchema.safeParse(rows).success,false);
  assert.equal(eggSaleSourcesSchema.safeParse(sale.egg_sources).success,true);
});
test("cent allocation never creates negative per-flock balances",()=>{
  const rows=projectEggSale({...sale,gross_amount:0.02,paid_amount:0.01,balance_due:0.01,
    egg_sources:[{flock_id:a,egg_quantity:1},{flock_id:b,egg_quantity:1},{flock_id:'22000000-0000-4000-8000-000000000003',egg_quantity:1}]});
  assert.ok(rows.every(row=>row.paid_amount>=0&&row.paid_amount<=row.gross_amount&&row.balance_due>=0));
  assert.equal(rows.reduce((sum,row)=>sum+row.paid_amount,0),0.01);
  assert.equal(rows.reduce((sum,row)=>sum+row.balance_due,0),0.01);
});
test("report source expansion fails clearly instead of building an unbounded allocation list",()=>{
  assert.equal(projectEggSales([sale]).length,2);
  assert.throws(()=>projectEggSales(Array.from({length:1001},()=>({...sale,egg_sources:Array.from({length:100},()=>({flock_id:a,egg_quantity:1}))}))),/REPORT_TOO_LARGE/);
});
test("frozen egg conversion, not a later unit assumption, drives cost and price", () => {
  assert.equal(eggUnitsSold({...sale,egg_conversion_multiplier:24}),72);
  assert.equal(unitPricePerEgg({...sale,unit_price:48,egg_conversion_multiplier:24}),2);
  assert.equal(eggUnitsSold({quantity:2,unit:"tray"}),60);
});
test("reconciliation allocates exact frozen eggs once without requiring the current conversion", () => {
  const input={asOfDate:"2026-11-02",daily:[],flocks:[a,b].map(id=>({id,code:id,status:"archived",farmId:"farm",placementDate:"2026-11-01",initialCount:100,currentCount:0})),farms:[],houses:[],batches:[],closures:[],sessions:[],stock:[],mortality:[],conversions:[],physicalCounts:[],warehouses:[],costEntries:[],costAllocations:[],costPeriods:[],operatingDays:[],approvedCorrectionSourceIds:new Set(),
    eggOpeningBalances:[{flockId:a,effectiveDate:"2026-11-01",quantity:30},{flockId:b,effectiveDate:"2026-11-01",quantity:60}],
    sales:[{id:"sale",flockId:null,farmId:"farm",saleDate:"2026-11-02",category:"egg",label:"Eggs",quantity:3,unit:"tray",grossAmount:101.01,
      eggSources:[{flockId:a,quantity:30},{flockId:b,quantity:60}]}]};
  assert.equal(evaluateOperationalReconciliation(input).filter(row=>row.domain==="eggs_sales").length,0);
  input.sales[0].eggSources[1].quantity=61;
  const findings=evaluateOperationalReconciliation(input).filter(row=>row.ruleCode==="EGG_SALES_EXCEED_PRODUCTION");
  assert.equal(findings.length,1);assert.equal(findings[0].flockId,b);assert.equal(findings[0].recordedValue,61);
});
test("new snapshots use v3 while frozen v2 readers remain supported",()=>{
  assert.equal(performanceReportVersion,"management-report-v3");
  for(const version of ["management-report-v2","management-report-v3"]) {assert.ok(isPerformanceReportVersion(version));assert.equal(readableReportVersion(version),version);}
  assert.equal(readableReportVersion("management-report-v1"),"management-report-v1");
});
