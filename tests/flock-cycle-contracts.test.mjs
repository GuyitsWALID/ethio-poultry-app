import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCycleSchema,closeCycleSchema,wholeFlockMoveSchema,archivedCycleCorrectionSchema} from '../src/lib/flock-lifecycle/cycle-contracts.ts';
const id=n=>`17000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const revision='a'.repeat(64);
test('archived corrections require evidence, exact fields, unique records and balanced whole bird counts',()=>{
  const row={id:id(1),opening_birds:100,deaths:3,culls:0,transfers_in:0,transfers_out:0,other_removals:97,closing_birds:0};
  const value={cycle_id:id(2),expected_revision:revision,supporting_reference:'Paper sheet 17',records:[row]};
  assert(archivedCycleCorrectionSchema.safeParse(value).success);
  for(const records of [[{...row,closing_birds:1}],[{...row,deaths:1.5}],[{...row,current_count:100}],[row,row]]) assert(!archivedCycleCorrectionSchema.safeParse({...value,records}).success);
  assert(!archivedCycleCorrectionSchema.safeParse({...value,supporting_reference:''}).success);
  assert(!archivedCycleCorrectionSchema.safeParse({...value,expected_revision:'stale'}).success);
});
test('whole-flock moves require actual time, current head count and both source/destination revisions',()=>{
  const move={flock_id:id(8),from_house_id:id(6),farm_id:id(5),house_id:id(7),bird_count:100,moved_at:'2026-10-08T10:00:00+03:00',expected_revision:revision,destination_revision:revision};
  assert(wholeFlockMoveSchema.safeParse(move).success);
  assert(!wholeFlockMoveSchema.safeParse({...move,bird_count:0}).success);
  assert(!wholeFlockMoveSchema.safeParse({...move,moved_at:'2026-10-08T10:00'}).success);
  assert(!wholeFlockMoveSchema.safeParse({...move,destination_revision:undefined}).success);
});
test('broader archived correction requires exact loss-event totals and unique event identities',()=>{
  const row={id:id(1),opening_birds:100,deaths:4,culls:0,transfers_in:0,transfers_out:0,other_removals:96,closing_birds:0};
  const event={id:id(3),record_id:row.id,kind:'death',count:4,explanation:'Paper death register'};
  const value={cycle_id:id(2),expected_revision:revision,supporting_reference:'Paper sheet',records:[row],loss_events:[event],departures:[{flock_id:id(8),kind:'sale',quantity:96,sale_id:id(9),sale_revision:revision}]};
  assert(archivedCycleCorrectionSchema.safeParse(value).success);
  assert(!archivedCycleCorrectionSchema.safeParse({...value,loss_events:[{...event,count:3}]}).success);
  assert(!archivedCycleCorrectionSchema.safeParse({...value,loss_events:[{...event,record_id:id(4)}]}).success);
  assert(!archivedCycleCorrectionSchema.safeParse({...value,loss_events:[{...event,count:2},{...event,count:2}]}).success);
  assert(!archivedCycleCorrectionSchema.safeParse({...value,departures:[{...value.departures[0],sale_revision:'stale'}]}).success);
});
const create={farm_id:id(5),cycle_code:'Arrival cohort',production_purpose:'layer',source:'external_purchase',placed_at:'2026-10-07T07:00:00+03:00',actual_date_confirmed:true,age_at_placement_days:120,placement_total:100,placements:[{house_id:id(6),expected_revision:revision,starting_birds:100,batch_code:'Batch A',flock_code:'Flock A'}]};
test('new cycle requires actual-date confirmation and independent house counts',()=>{
  assert(createCycleSchema.safeParse(create).success);
  assert(!createCycleSchema.safeParse({...create,actual_date_confirmed:false}).success);
  assert(!createCycleSchema.safeParse({...create,placements:[{...create.placements[0],starting_birds:0}]}).success);
});
test('new cycle rejects duplicate houses, unrelated purpose and mismatched totals',()=>{
  assert(!createCycleSchema.safeParse({...create,placement_total:200,placements:[...create.placements,...create.placements]}).success);
  assert(!createCycleSchema.safeParse({...create,placement_total:101}).success);
  assert(!createCycleSchema.safeParse({...create,production_purpose:'mixed'}).success);
});
test('timestamps require an explicit timezone and revisions cannot be replaced with labels',()=>{
  assert(!createCycleSchema.safeParse({...create,placed_at:'2026-10-07T07:00'}).success);
  assert(!createCycleSchema.safeParse({...create,placements:[{...create.placements[0],expected_revision:'current'}]}).success);
});
test('departure schema distinguishes sale allocation, physical evidence and non-sale departures',()=>{
  const close={cycle_id:id(1),mode:'close',completed_at:'2026-10-07T10:00:00+03:00',expected_revision:revision,dispositions:[{flock_id:id(9),kind:'sale',quantity:100,sale_id:id(10),sale_revision:revision}]};
  assert(closeCycleSchema.safeParse(close).success);
  assert(!closeCycleSchema.safeParse({...close,dispositions:[{...close.dispositions[0],quantity:1.5}]}).success);
  assert(!closeCycleSchema.safeParse({...close,dispositions:[{flock_id:id(9),kind:'other',quantity:100,reason:'gone'}]}).success);
  assert(!closeCycleSchema.safeParse({...close,mode:'legacy_attestation'}).success);
  assert(closeCycleSchema.safeParse({...close,mode:'legacy_attestation',supporting_reference:'CEO checked empty house',dispositions:[]}).success);
});
test('cycle context uses authorized targets, bounded reads and private responses',async()=>{
  const server=await readFile(new URL('../src/lib/flock-lifecycle/cycles.ts',import.meta.url),'utf8');
  const route=await readFile(new URL('../src/app/api/flocks/cycles/context/route.ts',import.meta.url),'utf8');
  assert.match(server,/import "server-only"/);assert.match(server,/canAccessFarm\(ctx, farmId\)/);assert.match(server,/SOURCE_LIMIT/);
  assert.match(route,/getAccessContext\(\{tenant: true\}\)/);assert.match(route,/accessJson/);assert.doesNotMatch(route,/error\.message/);
});
test('canonical SQL is append-only, no automatic archive, no kilograms-to-birds inference',async()=>{
  const schema=await readFile(new URL('../supabase/migrations/20261007000000_safe_flock_cycle_foundation.sql',import.meta.url),'utf8');
  const apply=await readFile(new URL('../supabase/migrations/20261007001000_atomic_flock_cycle_governance.sql',import.meta.url),'utf8');
  assert.match(schema,/immutable_lifecycle_evidence/);assert.match(schema,/Automatic batch replacement has been retired/);
  assert.match(apply,/Birds cannot be inferred from kilograms/);assert.match(apply,/v_used\+v_quantity>v_capacity/);
  assert.match(apply,/r\.status='applied' then return r/);assert.match(apply,/status='pending' and decided_by is null/);
});
