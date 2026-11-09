import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

const migration=await readFile(new URL('../supabase/migrations/20261109000000_exclude_voided_feed_sessions.sql',import.meta.url),'utf8');
const preflight=await readFile(new URL('../supabase/verification/voided_feed_session_preflight.sql',import.meta.url),'utf8');
test('feed-close migration filters all five session reads and retains the existing authoritative body',()=>{
 assert.match(migration,/<>3/);assert.match(migration,/<>2/);
 assert.match(migration,/unaliased\|\|' and voided_at is null'/);
 assert.match(migration,/aliased\|\|' and s\.voided_at is null'/);
 assert.match(migration,/pg_get_functiondef\('public\.close_feed_day/);
 assert.match(migration,/from public,anon,authenticated/);
 assert.match(migration,/to service_role/);
 assert.doesNotMatch(migration,/insert into|update public\.|delete from/i);
});
test('historical review is read-only, scoped to affected closures and compares live evidence with posted stock',()=>{
 assert.match(preflight,/voided_at is null/);assert.match(preflight,/s\.voided_at is not null/);
 assert.match(preflight,/c\.status='closed'/);assert.match(preflight,/posted_issue_kg/);
 assert.doesNotMatch(preflight,/\b(insert|update|delete|truncate|alter|create)\b/i);
});
