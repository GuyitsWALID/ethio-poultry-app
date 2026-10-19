import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePeriod} from '../src/lib/operational-analytics.ts';
import {calculateReportFcr} from '../src/lib/feed-calculations.ts';
import {birdDays,reconcileCauses} from '../src/lib/mortality-dashboard.ts';
import {reportSaleCost} from '../src/lib/profitability.ts';
const daily=(id,overrides={})=>({id,flock_id:id,record_date:'2026-10-01',opening_birds:100,closing_birds:100,deaths:0,culls:0,
  total_eggs:80,normal_eggs:80,broken_eggs:0,dirty_eggs:0,feed_intake_grams:10000,average_egg_weight_g:50,water_consumed_liters:20,...overrides});
test('layer FCR excludes growth feed and never averages cohort percentages',()=>{
  const result=summarizePeriod([daily('layer'),daily('broiler',{feed_intake_grams:90000,total_eggs:0})],new Set(['layer']),2);
  assert.equal(result.layerFcr,2.5);
  assert.equal(result.feedKg,100);
});
test('missing egg weight or layer feed cannot inflate an apparently valid FCR',()=>{
  for(const missing of [{average_egg_weight_g:null},{feed_intake_grams:null}]){
    assert.equal(summarizePeriod([daily('layer'),daily('layer2',missing)],new Set(['layer','layer2']),2).layerFcr,null);
  }
});

test('partial mortality or quality denominators cannot look like complete healthy evidence',()=>{
  const rows=[daily('layer'),daily('other',{deaths:null,normal_eggs:null,broken_eggs:null,dirty_eggs:null})];
  const result=summarizePeriod(rows,new Set(['layer','other']),2);
  assert.equal(result.cumulativeMortalityPct,null);
  assert.equal(result.marketableRate,null);
  assert.equal(summarizePeriod([daily('layer')],new Set(['layer']),30).cumulativeMortalityPct,null);
});
test('deaths and culls remain separate without adding supporting events',()=>{
  const result=summarizePeriod([daily('layer',{deaths:2,culls:3,closing_birds:0,other_removals:95})],new Set(['layer']),1);
  assert.equal(result.deaths,2);assert.equal(result.culls,3);assert.equal(result.birdLosses,5);
  const row={flockId:'layer',recordDate:'2026-10-01',deaths:2,openingBirds:100,closingBirds:0,otherRemovals:95};
  assert.equal(birdDays(row),97.5);
  assert.equal(reconcileCauses(row,[{flockId:'layer',recordDate:'2026-10-01',count:2,cause:'Sickness'}]).reduce((n,r)=>n+r.deaths,0),2);
});
test('mixed production returns two compatible FCR types, never one blended ratio',()=>{
  const flocks=[{id:'layer',flock_type:'parent_stock'},{id:'broiler',flock_type:'broiler'}];
  const dailyRows=[daily('layer'),daily('broiler',{record_date:'2026-10-01'}),daily('broiler',{record_date:'2026-10-02'})];
  const weights=[{flock_id:'broiler',record_date:'2026-10-01',average_weight_g:100},{flock_id:'broiler',record_date:'2026-10-02',average_weight_g:200}];
  const result=calculateReportFcr(flocks,dailyRows,weights);
  assert.equal(result.layer,2.5);assert.equal(result.growth,2);assert.equal(result.mixed,true);
  assert.equal(calculateReportFcr(flocks,dailyRows.slice(0,2),weights).growth,null);
  assert.equal(calculateReportFcr(flocks,[...dailyRows.slice(0,2),{...dailyRows[2],closing_birds:90}],weights).growth,null);
});

test('missing sales costs and non-head-count bird units stay unavailable, not zero',()=>{
  const bird={product_category:'bird',quantity:10,unit:'birds',batch_id:'batch'};
  assert.equal(reportSaleCost(bird,null,new Map([['batch',20]])),200);
  assert.equal(reportSaleCost({...bird,unit:'kg'},null,new Map([['batch',20]])),null);
  assert.equal(reportSaleCost(bird,null,new Map()),null);
  assert.equal(reportSaleCost({...bird,product_category:'egg',unit:'tray'},null,new Map()),null);
  assert.equal(reportSaleCost({...bird,product_category:'egg',unit:'tray'},2,new Map()),600);
});
