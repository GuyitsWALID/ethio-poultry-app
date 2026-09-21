import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260920000000_simplified_bilingual_farm_operations.sql", import.meta.url),
  "utf8",
);
const finishDayHardening = await readFile(
  new URL("../supabase/migrations/20260921000000_finish_day_composite_return.sql", import.meta.url),
  "utf8",
);

test("Today foundation is additive and feature gated", () => {
  assert.match(migration, /add column if not exists preferred_locale text not null default 'en'/i);
  assert.match(migration, /preferred_locale in \('en', 'am'\)/i);
  assert.match(migration, /today_workspace_enabled boolean not null default false/i);
  assert.match(migration, /simplified_ceo_workspace_enabled boolean not null default false/i);
  assert.match(migration, /not simplified_ceo_workspace_enabled or today_pilot_accepted_at is not null/i);
});

test("operation receipts enforce identity, schema, and payload uniqueness", () => {
  assert.match(migration, /create table if not exists public\.client_operation_receipts/i);
  assert.match(migration, /schema_version = 1/i);
  assert.match(migration, /payload_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(migration, /unique \(org_id, actor_id, command_id\)/i);
  assert.match(migration, /canonical_today_payload_hash/i);
  assert.match(migration, /different payload/i);
});

test("daily task attestations are scoped and invalidated by source fingerprints", () => {
  assert.match(migration, /create table if not exists public\.daily_task_attestations/i);
  assert.match(migration, /health_deaths', 'routine_supplies', 'no_active_flock/i);
  assert.match(migration, /daily_task_attestations_active_unique/i);
  assert.match(migration, /today_source_fingerprint/i);
  assert.match(migration, /source records changed/i);
  assert.match(migration, /set superseded_at = now\(\)/i);
});

test("receipts and attestations are server-owned with tenant-aware reads", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /client_operation_receipts_scoped_read/i);
  assert.match(migration, /daily_task_attestations_scoped_read/i);
  assert.match(migration, /public\.has_active_farm_access\(farm_id\)/i);
  assert.match(migration, /public\.has_active_break_glass\(org_id\)/i);
  assert.match(migration, /revoke insert, update, delete on public\.client_operation_receipts, public\.daily_task_attestations[\s\S]*from anon, authenticated/i);
});

test("versioned Finish day locks, checks revisions, and reuses the authoritative close", () => {
  assert.match(migration, /finish_farm_operating_day_v1/i);
  assert.match(migration, /pg_advisory_xact_lock/i);
  assert.match(migration, /today_resource_revision\('operating_day'/i);
  assert.match(migration, /operating day changed/i);
  assert.match(migration, /Daily Record is still missing/i);
  assert.match(migration, /feeding day is still open/i);
  assert.match(migration, /Confirm health and deaths for every flock/i);
  assert.match(migration, /Confirm routine supplies for every flock/i);
  assert.match(migration, /public\.close_farm_operating_day\(p_farm_id, p_operating_date/i);
  assert.match(migration, /operating day is already closed/i);
  assert.match(
    finishDayHardening,
    /select \* into v_day\s+from public\.close_farm_operating_day\(p_farm_id, p_operating_date/i,
  );
  assert.doesNotMatch(
    finishDayHardening,
    /select public\.close_farm_operating_day\(p_farm_id, p_operating_date[^;]+into v_day/i,
  );
});

test("command helpers are not directly executable from the browser", () => {
  assert.match(migration, /revoke all on function public\.apply_daily_task_attestation_v1[\s\S]*from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.apply_daily_task_attestation_v1[\s\S]*to service_role/i);
  assert.match(migration, /grant execute on function public\.finish_farm_operating_day_v1[\s\S]*to authenticated/i);
});
