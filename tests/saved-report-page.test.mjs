import assert from 'node:assert/strict';
import test from 'node:test';
import {readSavedReportCursor, savedReportPage} from '../src/lib/saved-report-page.ts';
const actor = '30000000-0000-4000-8000-000000000001', org = '30000000-0000-4000-8000-000000000002';
const rows = Array.from({length: 51}, (_, index) => ({id: `30000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
  report_name: 'Report', created_at: '2026-10-19T12:34:56.123456+00:00'}));
test('page retains 50 records and preserves PostgreSQL microseconds in its continuation', () => {
  const page = savedReportPage(rows, actor, org);
  assert.equal(page.runs.length, 50);
  assert.deepEqual(readSavedReportCursor(page.nextCursor, actor, org), {version: 1, actor, org, createdAt: rows[49].created_at, id: rows[49].id});
});
test('last or empty pages have no continuation', () => {
  for (const size of [0, 1, 50]) assert.equal(savedReportPage(rows.slice(0, size), actor, org).nextCursor, null);
  assert.equal(readSavedReportCursor(null, actor, org), null);
});
test('continuation is bound to the current user and tenant', () => {
  const cursor = savedReportPage(rows, actor, org).nextCursor;
  assert.throws(() => readSavedReportCursor(cursor, org, org), /Invalid saved-report cursor/);
  assert.throws(() => readSavedReportCursor(cursor, actor, actor), /Invalid saved-report cursor/);
});
test('malformed and incompatible cursors fail explicitly', () => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const valid = readSavedReportCursor(savedReportPage(rows, actor, org).nextCursor, actor, org);
  for (const value of ['%%%', 'x'.repeat(1001), encode({}), encode({...valid, version: 2}), encode({...valid, id: 'other'}),
    encode({...valid, createdAt: 'yesterday'}), encode({...valid, createdAt: '2026-99-01T00:00:00Z'})]) {
    assert.throws(() => readSavedReportCursor(value, actor, org), /Invalid saved-report cursor/);
  }
});
