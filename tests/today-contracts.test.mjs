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

test("every version-one command has a usable validated interface", () => {
  const itemId = "10000000-0000-4000-8000-000000000004";
  const warehouseId = "10000000-0000-4000-8000-000000000005";
  const actionId = "10000000-0000-4000-8000-000000000006";
  const commands = [
    {...base, type: "save_daily_record", payload: {record: {record_date: base.work_date}, usages: []}},
    {...base, type: "save_feed_session", expected_resource_revision: "feed-revision", payload: {session: {session_name: "Morning", feeders_count: 4, planned_feed_kg: 25, feed_type: "layer_feed", status: "planned"}}},
    {...base, type: "close_feed_day", expected_resource_revision: "feed-revision", payload: {}},
    {...base, type: "record_mortality_event", payload: {count: 1, cause: "Natural causes"}},
    {...base, type: "record_health_event", payload: {event_type: "observation", event: {description: "Healthy flock"}}},
    {...base, type: "complete_vaccination", payload: {schedule_id: actionId, item_id: itemId, warehouse_id: warehouseId, quantity: 100}},
    {...base, type: "confirm_no_activity", payload: {task_code: "routine_supplies", source_fingerprint: "source-fingerprint"}},
    {...base, type: "record_stock_receipt", payload: {warehouse_id: warehouseId, item_id: itemId, quantity: 10, unit_cost: 25}},
    {...base, type: "record_sale", payload: {product_category: "egg", product_label: "Egg trays", quantity: 2, unit_price: 100, unit: "tray"}},
    {...base, type: "record_expense", payload: {category: "transport", description: "Delivery", amount: 500}},
    {...base, type: "update_assigned_action", payload: {action_id: actionId, event_type: "started", note: "Started the assigned work"}},
    {...base, type: "finish_operating_day", expected_resource_revision: "day-revision", payload: {}},
  ];
  assert.deepEqual(commands.map((command) => parseTodayCommand(command).type), todayCommandTypes);
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

test("stock receipts require one item source and normalize a valid purchase type", () => {
  const command = parseTodayCommand({
    ...base,
    type: "record_stock_receipt",
    payload: {
      warehouse_id: "10000000-0000-4000-8000-000000000004",
      item_id: "10000000-0000-4000-8000-000000000005",
      quantity: 12,
      unit_cost: 50,
    },
  });
  assert.equal(command.payload.details.procurement_type, "miscellaneous");
  assert.throws(() => parseTodayCommand({
    ...base,
    type: "record_stock_receipt",
    payload: {
      warehouse_id: "10000000-0000-4000-8000-000000000004",
      item_id: "10000000-0000-4000-8000-000000000005",
      item: {name: "Layer mash", category: "feed", unit: "kg", reorderLevel: 20},
      quantity: 12,
      unit_cost: 50,
    },
  }));
});

test("completed feed sessions require actual feed and assigned stock selections", () => {
  const session = {
    session_name: "Morning",
    feeders_count: 4,
    planned_feed_kg: 25,
    actual_feed_kg: 24.5,
    feed_item_id: "10000000-0000-4000-8000-000000000004",
    warehouse_id: "10000000-0000-4000-8000-000000000005",
    feed_type: "layer_feed",
    status: "completed",
  };
  assert.equal(parseTodayCommand({...base, type: "save_feed_session", expected_resource_revision: "feed-revision", payload: {session}}).payload.session.status, "completed");
  assert.throws(() => parseTodayCommand({...base, type: "save_feed_session", expected_resource_revision: "feed-revision", payload: {session: {...session, warehouse_id: null}}}));
});

test("mutable Daily Record and feed commands require their resource revision", () => {
  const daily = {record: {record_date: base.work_date}, usages: [], daily_record_id: "10000000-0000-4000-8000-000000000006"};
  assert.throws(() => parseTodayCommand({...base, type: "save_daily_record", payload: daily}));
  assert.doesNotThrow(() => parseTodayCommand({...base, type: "save_daily_record", expected_resource_revision: "daily-revision", payload: daily}));
  assert.throws(() => parseTodayCommand({...base, type: "save_feed_session", payload: {session: {session_name: "Morning", feeders_count: 4, planned_feed_kg: 25, feed_type: "layer_feed"}}}));
});

test("sales and expenses are validated before entering the receipt transaction", () => {
  assert.throws(() => parseTodayCommand({
    ...base,
    type: "record_sale",
    payload: {product_category: "egg", product_label: "Egg trays", quantity: 2, unit_price: 100, paid_amount: 250, unit: "tray"},
  }));
  const expense = parseTodayCommand({
    ...base,
    type: "record_expense",
    payload: {category: "transport", description: "Emergency delivery", amount: 500},
  });
  assert.equal(expense.payload.entry_kind, "one_off");
  assert.equal(expense.payload.allocation_method, "direct");
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
