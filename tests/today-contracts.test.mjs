import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTodayCommand,
  todayCommandResultSchema,
  todayCommandTypes,
} from "../src/lib/today-workspace/contracts.ts";

const base = {
  schema_version: 1,
  command_id: "10000000-0000-4000-8000-000000000001",
  farm_id: "10000000-0000-4000-8000-000000000002",
  flock_id: "10000000-0000-4000-8000-000000000003",
  work_date: "2026-09-20",
};

test("Today command catalogue is closed and complete", () => {
  assert.equal(todayCommandTypes.length, 12);
  assert.throws(() => parseTodayCommand({...base, type: "invent_new_command", payload: {}}));
});

test("unknown schema versions are rejected", () => {
  assert.throws(() => parseTodayCommand({
    ...base,
    schema_version: 2,
    type: "finish_operating_day",
    expected_resource_revision: "revision-1",
    payload: {},
  }));
});

test("Finish day requires a resource revision", () => {
  assert.throws(() => parseTodayCommand({...base, type: "finish_operating_day", payload: {}}));
  const command = parseTodayCommand({
    ...base,
    type: "finish_operating_day",
    expected_resource_revision: "revision-1",
    payload: {},
  });
  assert.equal(command.type, "finish_operating_day");
});

test("no-activity confirmation requires a supported task and fingerprint", () => {
  const command = parseTodayCommand({
    ...base,
    type: "confirm_no_activity",
    payload: {task_code: "health_deaths", source_fingerprint: "fingerprint"},
  });
  assert.equal(command.payload.task_code, "health_deaths");
  assert.throws(() => parseTodayCommand({
    ...base,
    type: "confirm_no_activity",
    payload: {task_code: "feeding", source_fingerprint: "fingerprint"},
  }));
});

test("inventory and treatment quantities must be positive", () => {
  assert.throws(() => parseTodayCommand({
    ...base,
    type: "record_stock_receipt",
    payload: {
      warehouse_id: "10000000-0000-4000-8000-000000000004",
      item_id: "10000000-0000-4000-8000-000000000005",
      quantity: 0,
      unit_cost: 2,
    },
  }));
});

test("command result contract supports structured conflicts", () => {
  const result = todayCommandResultSchema.parse({
    command_id: base.command_id,
    status: "conflict",
    error_code: "RESOURCE_CONFLICT",
    conflict: {
      tablet_value: {closing_birds: 100},
      server_value: {closing_birds: 99},
      correction_destination: "/app/daily-records?record=example",
    },
  });
  assert.equal(result.status, "conflict");
});
