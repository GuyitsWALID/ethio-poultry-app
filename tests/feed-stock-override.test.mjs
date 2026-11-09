import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {parseTodayCommand} from '../src/lib/today-workspace/contracts.ts';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const [migration,operations,page,en,am]=await Promise.all([
 read('../supabase/migrations/20261109001000_disallow_feed_stock_overrides.sql'),read('../src/lib/farm-operations.ts'),read('../src/app/app/feeding-log/page.tsx'),read('../messages/en.json').then(JSON.parse),read('../messages/am.json').then(JSON.parse),
]);
test('stock guard is unconditional, migration refuses unknown seams and private grants remain',()=>{
 assert.match(migration,/replace\(definition,condition,'if v_available < v_group.quantity then'\)/);
 assert.match(migration,/<>1/);assert.match(migration,/and s\.voided_at is null/);
 assert.match(migration,/from public,anon,authenticated/);assert.match(migration,/to service_role/);
});
test('legacy close does not forward override text or offer a bypass input; shortage is localized',()=>{
 const close=operations.split('export async function closeFeedDay')[1].split('export async function reopenFeedDay')[0];
 assert.doesNotMatch(close,/overrideReason|p_override_reason/);assert.match(close,/"insufficientFeedStock"/);
 assert.doesNotMatch(page,/setOverride|overrideReason|ui\("stockOverrideReason"\)/);
 for(const messages of [en,am]){assert.ok(messages.OperationValidation.insufficientFeedStock);assert.ok(messages.OperationUI.stockRequiredBeforeFeedClose);}
 assert.notEqual(en.OperationValidation.insufficientFeedStock,am.OperationValidation.insufficientFeedStock);
});
test('legacy queued feed-close payload remains parseable without gaining permission',()=>{
 const command=parseTodayCommand({schema_version:1,command_id:'10000000-0000-4000-8000-000000000001',farm_id:'10000000-0000-4000-8000-000000000002',flock_id:'10000000-0000-4000-8000-000000000003',type:'close_feed_day',work_date:'2026-11-09',expected_resource_revision:'revision',payload:{override_reason:'CEO approved'}});
 assert.equal(command.type,'close_feed_day');assert.equal(command.payload.override_reason,'CEO approved');
});
