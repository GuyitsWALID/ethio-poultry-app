import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {buildFlockProfile, profilePeriod} from "../src/lib/flock-lifecycle/profile.ts";

const flock = {id:"flock-1",code:"L-1",farmId:"farm-1",farmName:"Farm",houseId:"house-1",houseName:"House",batchId:"batch-1",batchLabel:"B-1",breedName:"Breed",type:"layer",status:"active",placementDate:"2026-09-01",ageAtPlacementDays:100,startingBirds:1000,currentBirds:997,completionDate:null,beforeClearanceBirds:null};
const daily = (changes={}) => ({record_date:"2026-09-30",flock_id:flock.id,opening_birds:1000,closing_birds:997,deaths:1,culls:2,total_eggs:900,normal_eggs:880,broken_eggs:10,dirty_eggs:10,feed_intake_grams:110000,updated_at:"2026-09-30T12:00:00Z",...changes});
const target = (changes={}) => ({week_number:18,target_hdep_pct:90,target_mortality_pct:0.1,target_feed_g:110,target_weight_g:1000,...changes});
const profile = (changes={}) => buildFlockProfile({flock,days:30,today:"2026-09-30",daily:[daily()],closedFeedDates:["2026-09-30"],targets:[target()],weights:[],warningVariancePct:5,criticalVariancePct:10,...changes});

for (const days of [7,30,90]) test(`${days}-day profile clips to placement and includes arrival age`,()=>{
  const result=profile({days});
  assert.equal(result.period.to,"2026-09-30");
  assert.equal(result.period.expectedDays,Math.min(days,30));
  assert.equal(result.flock.ageDays,129);
});

test("period percentages use summed bird-days, not average percentages",()=>{
  const result=profile({daily:[daily({record_date:"2026-09-29",opening_birds:1000,total_eggs:900}),daily({opening_birds:800,total_eggs:640})]});
  assert.equal(result.results.productionPct,85.56);
  assert.equal(result.results.eggs,1540);
  assert.equal(result.results.losses,6);
});

test("missing numerator or denominator does not dilute evidence-based rates",()=>{
  const result=profile({daily:[daily(),daily({record_date:"2026-09-29",feed_intake_grams:null,total_eggs:null,deaths:null,culls:null}),daily({record_date:"2026-09-28",opening_birds:null,closing_birds:null})]});
  assert.equal(result.results.feedPerBirdGrams,110);
  assert.equal(result.results.productionPct,90);
  assert.equal(result.results.mortalityPct,0.1);
  assert.equal(result.coverage.feedDays,1);
  assert.equal(result.coverage.productionDays,1);
});

test("no evidence is unavailable; explicitly recorded zero remains zero",()=>{
  const missing=profile({daily:[]});
  assert.equal(missing.results.deaths,null);assert.equal(missing.results.feedKg,null);assert.equal(missing.results.productionPct,null);
  const zero=profile({daily:[daily({deaths:0,culls:0,total_eggs:0,normal_eggs:0,broken_eggs:0,dirty_eggs:0,feed_intake_grams:0})]});
  assert.equal(zero.results.losses,0);assert.equal(zero.results.eggs,0);assert.equal(zero.results.productionPct,0);assert.equal(zero.results.saleablePct,null);
});

test("quality rate excludes incomplete classifications",()=>{
  const result=profile({daily:[daily(),daily({record_date:"2026-09-29",normal_eggs:900,broken_eggs:null,dirty_eggs:null})]});
  assert.equal(result.results.saleablePct,97.78);assert.equal(result.coverage.qualityDays,1);
});

test("pre-placement, future and other-flock evidence is excluded",()=>{
  const result=profile({daily:[daily(),daily({record_date:"2026-08-31"}),daily({record_date:"2026-10-01"}),daily({flock_id:"other"})]});
  assert.equal(result.results.eggs,900);assert.equal(result.coverage.records,1);
});

test("targets are bird-day weighted and missing targets are not imputed",()=>{
  const result=profile({flock:{...flock,ageAtPlacementDays:0},daily:[daily({record_date:"2026-09-07",opening_birds:1000,total_eggs:500}),daily({record_date:"2026-09-08",opening_birds:500,total_eggs:450})],targets:[target({week_number:0,target_hdep_pct:50}),target({week_number:1,target_hdep_pct:90})]});
  assert.equal(result.results.productionTargetPct,63.33);
  const incomplete=profile({targets:[]});assert.equal(incomplete.results.productionTargetPct,null);assert(incomplete.steps.some(step=>step.code==="missing_targets"));
});

for (const type of ["broiler","rearing"]) test(`${type} weight uses sample age, not current age`,()=>{
  const result=profile({flock:{...flock,type,ageAtPlacementDays:0},targets:[target({week_number:1,target_weight_g:1000}),target({week_number:4,target_weight_g:3300})],weights:[{record_date:"2026-09-10",average_weight_g:1000,uniformity_pct:90}]});
  assert.equal(result.results.latestWeight.targetWeightGrams,1000);
  assert.equal(result.results.eggs,null);
  assert(!result.steps.some(step=>step.code==="growth_variance"));
  assert(result.steps.some(step=>step.code==="stale_weight"));
});

test("parent stock has production fields and broiler growth uses distinct dates",()=>{
  assert.equal(profile({flock:{...flock,type:"parent_stock"}}).results.productionPct,90);
  const result=profile({flock:{...flock,type:"broiler"},weights:[{record_date:"2026-09-30",average_weight_g:1300,uniformity_pct:90},{record_date:"2026-09-20",average_weight_g:1000,uniformity_pct:80}]});
  assert.equal(result.results.growthPerDay,30);
});

test("older latest sample is labelled outside selected period",()=>{
  const result=profile({days:7,flock:{...flock,type:"broiler"},weights:[{record_date:"2026-09-10",average_weight_g:1000,uniformity_pct:90}]});
  assert.equal(result.results.latestWeight.outsidePeriod,true);assert.deepEqual(result.results.measurements,[]);assert.equal(result.results.growthPerDay,null);
});

test("completed flock period ends at verified completion and never links to Today",()=>{
  const ended={...flock,status:"archived",completionDate:"2026-09-20",currentBirds:0,beforeClearanceBirds:997};
  const result=profile({flock:ended,daily:[daily({record_date:"2026-09-20"})]});
  assert.equal(result.period.to,"2026-09-20");assert.equal(result.flock.currentBirds,0);assert.equal(result.results.losses,3);
  assert(result.steps.every(step=>!step.href.startsWith("/app/today")));
  assert.equal(result.flock.beforeClearanceBirds,997);
});

test("legacy archive date is not inferred from records or today",()=>{
  const result=profile({flock:{...flock,status:"archived"}});
  assert.deepEqual(profilePeriod({...flock,status:"archived"},30,"2026-09-30"),{from:null,to:null,expectedDays:0});
  assert.equal(result.results.losses,null);assert.equal(result.period.to,null);assert(result.steps.some(step=>step.code==="completion_unverified"));
});

test("CEO and disabled-manager profiles do not offer manager-only Today entry",()=>{
  const result=profile({allowTodayActions:false,flock:{...flock,placementDate:"2026-09-30"},daily:[],closedFeedDates:[]});
  assert(result.steps.every(step=>!step.href.startsWith("/app/today")));
});

test("quantity evidence is distinct from ratio evidence when bird counts are missing",()=>{
  const result=profile({daily:[daily({opening_birds:null,closing_birds:null})]});
  assert.equal(result.coverage.eggsDays,1);assert.equal(result.coverage.feedQuantityDays,1);
  assert.equal(result.coverage.productionDays,0);assert.equal(result.coverage.feedDays,0);
  assert.equal(result.results.eggs,900);assert.equal(result.results.productionPct,null);
});

test("all concerns survive prioritization and missing dates target exact sources",()=>{
  const result=profile({daily:[daily({total_eggs:600,deaths:100,feed_intake_grams:50000})]});
  assert.deepEqual(result.steps.slice(0,3).map(step=>step.code),["production_shortfall","mortality_high","feed_variance"]);
  const gap=result.steps.find(step=>step.code==="missing_records");
  assert.equal(gap.date,"2026-09-01");assert(gap.href.includes("filter_flockId=flock-1"));assert(gap.href.includes("filter_page_filterDate=2026-09-01"));
  assert(result.steps.every(step=>!step.href.startsWith("/app/flocks?")));
});

test("new read seam requires source authorization and never caches or exposes SQL errors",async()=>{
  const server=await readFile(new URL("../src/lib/flock-lifecycle/server.ts",import.meta.url),"utf8");
  const route=await readFile(new URL("../src/app/api/flocks/[id]/profile/route.ts",import.meta.url),"utf8");
  assert.match(server,/import "server-only"/);assert.match(server,/canAccessFarm\(context, source.data.farm_id\)/);assert.match(server,/eq\("org_id", context.orgId\)/);
  assert.match(route,/getAccessContext\(\{tenant: true\}\)/);assert.match(route,/accessJson/);assert.doesNotMatch(route,/error\.message/);
});

test("inline controls and old profile URLs preserve exact context without generic redirects",async()=>{
  const ui=await readFile(new URL("../src/components/flocks/inline-profile.tsx",import.meta.url),"utf8");
  const page=await readFile(new URL("../src/app/app/flocks/page.tsx",import.meta.url),"utf8");
  const legacy=await readFile(new URL("../src/app/app/flocks/[flockId]/page.tsx",import.meta.url),"utf8");
  assert.match(ui,/motion-reduce:transition-none/);assert.match(ui,/inert=\{!open\}/);assert.match(ui,/type="button" disabled/);assert.match(ui,/AbortController/);
  assert.match(page,/simplifiedManager.*value!=="flocks"/);assert.match(page,/statusStyle\(row.status,true\)/);
  assert.doesNotMatch(page,/Open full flock profile/);assert.match(legacy,/query.set\("flock", flockId\)/);assert.match(legacy,/Object.entries\(await searchParams\)/);
});

test("lifecycle preflight is read-only and surfaces every operator decision",async()=>{
  const sql=await readFile(new URL("../supabase/verification/flock_lifecycle_preflight.sql",import.meta.url),"utf8");
  const statements=sql.replace(/--[^\n]*/g,"").split(";").map(value=>value.trim()).filter(Boolean);
  assert(statements.every(value=>/^(select|begin transaction read only|rollback)\b/i.test(value)));
  for(const issue of ["overlapping_house_occupancy","ambiguous_batch_membership","broken_placement_lineage","placement_population_mismatch","current_population_mismatch","future_active_placement","legacy_completion_attestation_required","lifecycle_approval_requires_review"]) assert(sql.includes(issue));
});
