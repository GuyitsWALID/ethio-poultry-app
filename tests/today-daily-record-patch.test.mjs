import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260926000000_today_daily_record_partial_updates.sql", import.meta.url), "utf8");

test("focused Today saves preserve unrelated Daily Record fields", () => {
  assert.match(migration, /rename to save_daily_record_with_usage_full_v1/i);
  assert.match(migration, /to_jsonb\(v_existing\)[\s\S]*\|\| coalesce\(p_record/i);
  assert.match(migration, /p_usages is null or p_usages = 'null'::jsonb/i);
  assert.match(migration, /'feed_intake_grams'[\s\S]*'feed_intake_quantity'[\s\S]*'feed_type'/i);
  assert.match(migration, /save_daily_record_with_usage_full_v1\([\s\S]*v_merged_record,[\s\S]*v_normalized_usages/i);
});

test("the focused wrapper keeps the stable RPC private", () => {
  assert.match(migration, /revoke all on function public\.save_daily_record_with_usage\([\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.save_daily_record_with_usage\([\s\S]*to service_role/i);
});
