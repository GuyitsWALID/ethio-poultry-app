import type {TodayErrorCode, TodayTask, TodayTaskState} from "../lib/today-workspace/contracts.ts";

export const todayTaskMessageKeys = {
  birds: "tasks.birds",
  feeding: "tasks.feeding",
  eggs_water: "tasks.eggsWater",
  health_deaths: "tasks.healthDeaths",
  routine_supplies: "tasks.supplies",
  review_finish: "tasks.review",
  stock: "tasks.stock",
  sales: "tasks.sales",
  expenses: "tasks.expenses",
  assigned_fixes: "tasks.assignedFixes",
} as const satisfies Record<TodayTask["code"], `tasks.${string}`>;

export const todayStateMessageKeys = {
  not_started: "states.notStarted",
  draft_on_tablet: "states.draft",
  waiting_to_sync: "states.waiting",
  complete: "states.complete",
  needs_attention: "states.needsAttention",
} as const satisfies Record<TodayTaskState, `states.${string}`>;

export const todayErrorMessageKeys = {
  AUTH_REQUIRED: "unauthorized",
  ROLE_NOT_ALLOWED: "unauthorized",
  ASSIGNMENT_REQUIRED: "assignmentChanged",
  FEATURE_DISABLED: "unknown",
  INVALID_COMMAND: "validation",
  INVALID_PAYLOAD: "validation",
  UNSUPPORTED_SCHEMA_VERSION: "validation",
  COMMAND_ID_REUSED: "validation",
  RESOURCE_CONFLICT: "staleRevision",
  OPERATING_DAY_LOCKED: "locked",
  OPERATING_WINDOW_EXPIRED: "locked",
  INSUFFICIENT_STOCK: "insufficientStock",
  ITEM_CATEGORY_NOT_ALLOWED: "validation",
  DEPENDENCY_INCOMPLETE: "validation",
  MISSING_REQUIRED_WORK: "validation",
  ONLINE_REQUIRED: "offlineFinish",
  SOURCE_NOT_FOUND: "unknown",
  INTERNAL_ERROR: "unknown",
} as const satisfies Record<TodayErrorCode, string>;
