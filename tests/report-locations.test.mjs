import test from 'node:test';
import assert from 'node:assert/strict';
import {projectLocationFlocks,reportRowInLocations,selectReportLocations} from '../src/lib/report-locations.ts';
const farms=[{id:'a',org_id:'o',branch_id:'east'},{id:'b',org_id:'o',branch_id:'west'}];
const flock={id:'f',org_id:'o',farm_id:'b',house_id:'hb',batch_id:'batch',flock_code:'Test'};
const locations=[{flock_id:'f',farm_id:'a',house_id:'ha',from_date:'2026-10-01',to_date:'2026-10-10',verified:true},
  {flock_id:'f',farm_id:'b',house_id:'hb',from_date:'2026-10-10',to_date:null,verified:true,starts_with_move:true,from_at:'2026-10-10T09:00:00Z'}];
test('historical scopes use approved placement locations, not the current flock farm',()=>{
  const selected=selectReportLocations(locations,[flock],[farms[0]],{farmId:'a'});
  assert.equal(selected.length,1);
  assert.equal(projectLocationFlocks([flock],selected)[0].farm_id,'a');
  assert.equal(reportRowInLocations({flock_id:'f',record_date:'2026-10-05'},selected),true);
  assert.equal(reportRowInLocations({flock_id:'f',record_date:'2026-10-11'},selected),false);
});
test('grant at destination does not expose earlier records at the source',()=>{
  const selected=selectReportLocations(locations,[flock],[farms[1]],{});
  assert.equal(reportRowInLocations({flock_id:'f',record_date:'2026-10-05'},selected),false);
  assert.equal(reportRowInLocations({flock_id:'f',record_date:'2026-10-11'},selected),true);
  assert.equal(selectReportLocations(locations,[flock],[],{}).length,0);
});
test('movement-day records retain explicit location; ambiguous locationless evidence is not guessed',()=>{
  assert.equal(reportRowInLocations({flock_id:'f',record_date:'2026-10-10',house_id:'ha'},[locations[0]]),true);
  assert.equal(reportRowInLocations({flock_id:'f',record_date:'2026-10-10',house_id:'ha'},[locations[1]]),false);
  assert.equal(reportRowInLocations({flock_id:'f',event_date:'2026-10-10'},[locations[0]],'event_date'),false);
  assert.equal(reportRowInLocations({flock_id:'f',event_date:'2026-10-10'},[locations[1]],'event_date'),false);
  assert.equal(reportRowInLocations({flock_id:'f',record_date:'2026-10-10',recorded_time:'13:00'},[locations[1]]),true);
  assert.equal(reportRowInLocations({flock_id:'f',record_date:'2026-10-10',recorded_time:'11:00'},[locations[1]]),false);
});
test('unverified applicable chains fail closed, not silently relocated',()=>{
  assert.throws(()=>selectReportLocations([{...locations[0],verified:false}],[flock],farms,{}),/REPORT_MOVEMENT_EVIDENCE_CONFLICT/);
  assert.deepEqual(selectReportLocations([{...locations[0],verified:false}],[flock],[farms[1]],{}),[]);
});
