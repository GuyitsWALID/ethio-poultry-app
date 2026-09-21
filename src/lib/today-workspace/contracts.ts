import {z} from "zod";

export const TODAY_SCHEMA_VERSION = 1 as const;

export const todayCommandTypes = [
  "save_daily_record",
  "save_feed_session",
  "close_feed_day",
  "record_mortality_event",
  "record_health_event",
  "complete_vaccination",
  "confirm_no_activity",
  "record_stock_receipt",
  "record_sale",
  "record_expense",
  "update_assigned_action",
  "finish_operating_day",
] as const;

export type TodayCommandType = (typeof todayCommandTypes)[number];

export const todayErrorCodes = [
  "AUTH_REQUIRED",
  "ROLE_NOT_ALLOWED",
  "ASSIGNMENT_REQUIRED",
  "FEATURE_DISABLED",
  "INVALID_COMMAND",
  "INVALID_PAYLOAD",
  "UNSUPPORTED_SCHEMA_VERSION",
  "COMMAND_ID_REUSED",
  "RESOURCE_CONFLICT",
  "OPERATING_DAY_LOCKED",
  "OPERATING_WINDOW_EXPIRED",
  "INSUFFICIENT_STOCK",
  "ITEM_CATEGORY_NOT_ALLOWED",
  "DEPENDENCY_INCOMPLETE",
  "MISSING_REQUIRED_WORK",
  "ONLINE_REQUIRED",
  "SOURCE_NOT_FOUND",
  "INTERNAL_ERROR",
] as const;

export type TodayErrorCode = (typeof todayErrorCodes)[number];
export type TodayCommandStatus = "applied" | "conflict" | "rejected";

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonEmpty = z.string().trim().min(1);
const positive = z.number().positive();
const nullableUuid = uuid.nullable().optional();

const baseCommand = z.object({
  schema_version: z.literal(TODAY_SCHEMA_VERSION),
  command_id: uuid,
  farm_id: uuid,
  flock_id: nullableUuid,
  work_date: date,
  expected_resource_revision: nonEmpty.optional(),
  depends_on: z.array(uuid).max(32).optional(),
});

const usageRow = z.object({
  item_id: uuid,
  warehouse_id: uuid,
  quantity: positive,
});

const commandSchemas = {
  save_daily_record: baseCommand.extend({
    type: z.literal("save_daily_record"),
    flock_id: uuid,
    payload: z.object({
      daily_record_id: nullableUuid,
      record: z.record(z.string(), z.unknown()),
      usages: z.array(usageRow).default([]),
    }),
  }),
  save_feed_session: baseCommand.extend({
    type: z.literal("save_feed_session"),
    flock_id: uuid,
    payload: z.object({
      session_id: nullableUuid,
      session: z.record(z.string(), z.unknown()),
    }),
  }),
  close_feed_day: baseCommand.extend({
    type: z.literal("close_feed_day"),
    flock_id: uuid,
    expected_resource_revision: nonEmpty,
    payload: z.object({override_reason: z.string().trim().max(1000).nullable().optional()}),
  }),
  record_mortality_event: baseCommand.extend({
    type: z.literal("record_mortality_event"),
    flock_id: uuid,
    payload: z.object({
      count: z.number().int().positive(),
      cause: nonEmpty,
      recorded_time: z.string().trim().nullable().optional(),
      diagnosis: z.string().trim().nullable().optional(),
      notes: z.string().trim().nullable().optional(),
    }),
  }),
  record_health_event: baseCommand.extend({
    type: z.literal("record_health_event"),
    flock_id: uuid,
    payload: z.object({
      event_type: z.enum(["disease", "treatment", "observation"]),
      event: z.record(z.string(), z.unknown()),
      inventory_usage: usageRow.nullable().optional(),
    }),
  }),
  complete_vaccination: baseCommand.extend({
    type: z.literal("complete_vaccination"),
    flock_id: uuid,
    payload: z.object({schedule_id: uuid, ...usageRow.shape}),
  }),
  confirm_no_activity: baseCommand.extend({
    type: z.literal("confirm_no_activity"),
    payload: z.object({
      task_code: z.enum(["health_deaths", "routine_supplies", "no_active_flock"]),
      source_fingerprint: nonEmpty,
    }),
  }),
  record_stock_receipt: baseCommand.extend({
    type: z.literal("record_stock_receipt"),
    payload: z.object({
      warehouse_id: uuid,
      item_id: nullableUuid,
      quantity: positive,
      unit_cost: z.number().nonnegative(),
      item: z.record(z.string(), z.unknown()).optional(),
      details: z.record(z.string(), z.unknown()).default({}),
    }),
  }),
  record_sale: baseCommand.extend({
    type: z.literal("record_sale"),
    payload: z.record(z.string(), z.unknown()),
  }),
  record_expense: baseCommand.extend({
    type: z.literal("record_expense"),
    payload: z.record(z.string(), z.unknown()),
  }),
  update_assigned_action: baseCommand.extend({
    type: z.literal("update_assigned_action"),
    payload: z.object({
      action_id: uuid,
      event_type: z.enum(["acknowledged", "started", "completion_submitted"]),
      note: z.string().trim().min(4).max(2000),
    }),
  }),
  finish_operating_day: baseCommand.extend({
    type: z.literal("finish_operating_day"),
    expected_resource_revision: nonEmpty,
    payload: z.object({}),
  }),
} satisfies Record<TodayCommandType, z.ZodTypeAny>;

export const todayCommandSchema = z.discriminatedUnion("type", [
  commandSchemas.save_daily_record,
  commandSchemas.save_feed_session,
  commandSchemas.close_feed_day,
  commandSchemas.record_mortality_event,
  commandSchemas.record_health_event,
  commandSchemas.complete_vaccination,
  commandSchemas.confirm_no_activity,
  commandSchemas.record_stock_receipt,
  commandSchemas.record_sale,
  commandSchemas.record_expense,
  commandSchemas.update_assigned_action,
  commandSchemas.finish_operating_day,
]);

export type TodayCommand = z.infer<typeof todayCommandSchema>;

export type TodayCommandResult = {
  command_id: string;
  status: TodayCommandStatus;
  source_ref?: string;
  resource_revision?: string;
  operating_day_revision?: string;
  error_code?: TodayErrorCode;
  error_params?: Record<string, string | number>;
  conflict?: {
    tablet_value: unknown;
    server_value: unknown;
    correction_destination: string;
  };
};

export const todayCommandResultSchema = z.object({
  command_id: uuid,
  status: z.enum(["applied", "conflict", "rejected"]),
  source_ref: z.string().optional(),
  resource_revision: z.string().optional(),
  operating_day_revision: z.string().optional(),
  error_code: z.enum(todayErrorCodes).optional(),
  error_params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  conflict: z.object({
    tablet_value: z.unknown(),
    server_value: z.unknown(),
    correction_destination: z.string(),
  }).optional(),
});

export function parseTodayCommand(input: unknown): TodayCommand {
  return todayCommandSchema.parse(input);
}

export type TodayTaskState = "not_started" | "draft_on_tablet" | "waiting_to_sync" | "complete" | "needs_attention";

export type TodayTask = {
  code: "birds" | "feeding" | "eggs_water" | "health_deaths" | "routine_supplies" | "review_finish" | "stock" | "sales" | "expenses" | "assigned_fixes";
  required: boolean;
  applicable: boolean;
  state: TodayTaskState;
  sourceRef?: string;
  sourceFingerprint?: string;
  resourceRevision?: string;
  errorCode?: TodayErrorCode;
  errorParams?: Record<string, string | number>;
};

export type TodayFlockContext = {
  id: string;
  code: string;
  type: string;
  batchLabel: string | null;
  houseLabel: string;
  ageDays: number;
  openingBirds: number | null;
  previousClosingBirds: number | null;
  tasks: TodayTask[];
};

export type TodayWorkspace = {
  schemaVersion: typeof TODAY_SCHEMA_VERSION;
  timezone: "Africa/Addis_Ababa";
  farm: {id: string; name: string};
  workDate: string;
  locale: "en" | "am";
  operatingDay: {status: "open" | "closed" | "locked"; revision: string};
  flocks: TodayFlockContext[];
  farmTasks: TodayTask[];
  capabilities: {canEdit: boolean; canFinish: boolean; offlineAuthorizedUntil: string};
};
