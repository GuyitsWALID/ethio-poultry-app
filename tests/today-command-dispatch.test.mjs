import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260920000000_simplified_bilingual_farm_operations.sql", import.meta.url), "utf8");
const domainGuards = await readFile(new URL("../supabase/migrations/20260922000000_today_command_domain_guards.sql", import.meta.url), "utf8");
const apiBoundary = await readFile(new URL("../supabase/migrations/20260922001000_today_command_api_boundary.sql", import.meta.url), "utf8");
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

test("feed-session dispatch shares closed-day, catalogue, warehouse, and assignment invariants", () => {
  assert.match(domainGuards, /before insert or update on public\.feeding_session_records/);
  assert.match(domainGuards, /feed_day_closures[\s\S]*status = 'closed'/);
  assert.match(domainGuards, /i\.category = 'feed'/);
  assert.match(domainGuards, /'kg', 'kilogram', 'kilograms'/);
  assert.match(domainGuards, /v_warehouse_branch_id is distinct from v_flock_branch_id/);
  assert.match(migration, /v_command_type = 'save_feed_session'[\s\S]*user_warehouse_access/);
});

test("the service delegates each command to a server-only atomic function", () => {
  assert.match(service, /import "server-only"/);
  assert.match(service, /dispatch_today_command_v1/);
  assert.match(service, /mapDatabaseError/);
  assert.doesNotMatch(service, /governanceAdmin/);
});

test("the POST endpoint is thin, private, and returns structured statuses", () => {
  assert.match(route, /executeTodayCommand\(context/);
  assert.match(route, /private, no-store/);
  assert.match(route, /context\.status === 401 \? "AUTH_REQUIRED"/);
  assert.match(route, /status: "rejected"/);
  assert.match(route, /result\.status === "conflict"/);
  assert.doesNotMatch(route, /\.from\(|\.rpc\(/);
});

test("the database dispatcher owns replay and current authorization checks", () => {
  assert.match(apiBoundary, /auth\.uid\(\) is distinct from p_actor_id/);
  assert.match(apiBoundary, /today_workspace_enabled/);
  assert.match(apiBoundary, /v_receipt\.payload_hash <> v_hash/);
  assert.match(apiBoundary, /active farm assignment is required/i);
  assert.match(apiBoundary, /outside the operating window and has expired/i);
  assert.match(apiBoundary, /required earlier command is not complete/i);
  assert.match(apiBoundary, /exception when sqlstate '40001'/);
  assert.match(apiBoundary, /'status', 'conflict'/);
  assert.match(apiBoundary, /Persist the normalized result so retries are/);
  assert.match(apiBoundary, /jsonb_set\(v_result, '\{resource_revision\}'/);
});

test("feed revisions include both sessions and closures", () => {
  assert.match(apiBoundary, /'sessions'[\s\S]*feeding_session_records/);
  assert.match(apiBoundary, /'closures'[\s\S]*feed_day_closures/);
});

test("stable failures map to the intended client recovery state", () => {
  assert.match(service, /COMMAND_ID_REUSED/);
  assert.match(service, /DEPENDENCY_INCOMPLETE/);
  assert.match(service, /INSUFFICIENT_STOCK/);
  assert.match(service, /ITEM_CATEGORY_NOT_ALLOWED/);
  assert.match(service, /FEATURE_DISABLED/);
  assert.match(route, /OPERATING_WINDOW_EXPIRED/);
});
