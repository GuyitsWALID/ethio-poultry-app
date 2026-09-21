import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260920000000_simplified_bilingual_farm_operations.sql", import.meta.url), "utf8");
const service = await readFile(new URL("../src/lib/today-workspace/commands.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../src/app/api/farm-manager/today/commands/route.ts", import.meta.url), "utf8");

test("all authoritative command branches execute inside the receipt transaction", () => {
  const expected = [
    "save_daily_record", "save_feed_session", "close_feed_day", "record_mortality_event",
    "record_health_event", "complete_vaccination", "record_stock_receipt", "record_sale",
    "record_expense", "update_assigned_action",
  ];
  const boundary = migration.slice(migration.indexOf("create or replace function public.execute_today_command_v1"));
  for (const command of expected) assert.match(boundary, new RegExp(`v_command_type = '${command}'`));
  assert.match(boundary, /insert into public\.client_operation_receipts[\s\S]*update public\.client_operation_receipts set result/);
  assert.match(boundary, /pg_advisory_xact_lock/);
  assert.match(boundary, /payload_hash <> v_hash/);
});

test("mutable Today commands compare resource revisions in the database transaction", () => {
  assert.match(migration, /v_command_type = 'save_daily_record'[\s\S]*today_resource_revision\('daily_record'/);
  assert.match(migration, /v_command_type in \('save_feed_session', 'close_feed_day'\)[\s\S]*today_resource_revision\('feed_day'/);
  assert.match(migration, /source record changed\. Refresh before saving/);
});

test("the service delegates each command to a server-only atomic function", () => {
  assert.match(service, /import "server-only"/);
  assert.match(service, /apply_daily_task_attestation_v1/);
  assert.match(service, /finish_farm_operating_day_v1/);
  assert.match(service, /execute_today_command_v1/);
  assert.match(service, /mapDatabaseError/);
});

test("the POST endpoint is thin, private, and returns structured statuses", () => {
  assert.match(route, /executeTodayCommand\(context/);
  assert.match(route, /private, no-store/);
  assert.match(route, /result\.status === "conflict"/);
  assert.doesNotMatch(route, /\.from\(|\.rpc\(/);
});
