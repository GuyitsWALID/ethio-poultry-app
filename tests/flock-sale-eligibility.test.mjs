import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {eligibleSaleFlockIds,updateDepartureSelection} from '../src/lib/flock-lifecycle/sale-eligibility.ts';

const day='2026-10-15';
const a={id:'A',farm_id:'farm',batch_id:'batch-a',house_id:'house-a',placement_date:'2026-09-01'};
const b={id:'B',farm_id:'farm',batch_id:'batch-b',house_id:'house-b',placement_date:'2026-10-01'};
const sale={farm_id:'farm',flock_id:null,batch_id:null,house_id:null,sale_date:day,unit:'bird',quantity:100};
test('farm-wide sale can be allocated across eligible members without guessing flock ownership',()=>{
  assert.deepEqual(eligibleSaleFlockIds(sale,[a,b],day),['A','B']);
});
for(const [label,change,expected] of [
  ['flock',{flock_id:'A'},['A']],['batch',{batch_id:'batch-b'},['B']],['house',{house_id:'house-a'},['A']],
  ['other farm',{farm_id:'other'},[]],['unrelated flock',{flock_id:'other'},[]],
  ['future date',{sale_date:'2026-10-16'},[]],['before placement',{sale_date:'2026-08-01'},[]],
  ['before second placement',{sale_date:'2026-09-15'},['A']],
  ['fractional birds',{quantity:1.5},[]],['zero quantity',{quantity:0},[]],
])test(`sale choices respect ${label}`,()=>assert.deepEqual(eligibleSaleFlockIds({...sale,...change},[a,b],day),expected));
test('kilogram sales remain eligible for explicit physical head-count evidence',()=>{
  assert.deepEqual(eligibleSaleFlockIds({...sale,unit:'kg',quantity:12.5},[a,b],day),['A','B']);
});
test('changing flock, departure type or sale clears stale sale evidence',()=>{
  const row={flockId:'A',kind:'sale',saleId:'old-sale',capacity:'100',reference:'Old weighing sheet',quantity:'25'};
  for(const change of [{flockId:'B'},{kind:'other'},{saleId:'new-sale'}]){
    const next=updateDepartureSelection(row,change);
    assert.equal(next.saleId,change.saleId??'');assert.equal(next.capacity,'');assert.equal(next.reference,'');
    assert.equal(next.quantity,'25');
  }
  assert.deepEqual(updateDepartureSelection(row,{quantity:'30'}),{...row,quantity:'30'});
  assert.deepEqual(updateDepartureSelection(row,{flockId:'A'}),row);
});
test('cycle context scopes sale reads before the cap, skips them for creation, and checks submitted sale targets',()=>{
  const source=readFileSync(new URL('../src/lib/flock-lifecycle/cycles.ts',import.meta.url),'utf8');
  assert.match(source,/saleResult=members.length \?/);
  assert.match(source,/\.in\("farm_id",\[\.\.\.memberFarms\]\)/);
  assert.match(source,/\.gte\("sale_date",earliestPlacement\)/);
  assert.match(source,/sale\?\.eligibleFlockIds.includes\(departure.flock_id\)/);
});
test('confirmation is tied to farm, actual placement date and time; UI uses flock-specific sale choices',()=>{
  const source=readFileSync(new URL('../src/components/flocks/cycle-workspace.tsx',import.meta.url),'utf8');
  assert.match(source,/confirmationKey=JSON.stringify\(\[farmId,day,time\]\)/);
  assert.match(source,/confirmed=confirmedFor===confirmationKey/);
  assert.match(source,/item.eligibleFlockIds.includes\(row.flockId\)/);
  assert.match(source,/updateDepartureSelection\(row,change\)/);
});
