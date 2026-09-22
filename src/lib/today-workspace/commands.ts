import "server-only";

import type {AccessContext} from "@/lib/access-context";
import {createClient as createAuthedClient} from "@/utils/supabase/server";

import {
  parseTodayCommand,
  todayCommandResultSchema,
  type TodayCommand,
  type TodayCommandResult,
  type TodayErrorCode,
} from "./contracts";

type DatabaseError = {code?: string; message: string};

function rejected(commandId: string, code: TodayErrorCode, params?: Record<string, string | number>): TodayCommandResult {
  const conflict = code === "RESOURCE_CONFLICT" || code === "COMMAND_ID_REUSED";
  return {command_id: commandId, status: conflict ? "conflict" : "rejected", error_code: code, error_params: params};
}

function mapDatabaseError(error: DatabaseError): TodayErrorCode {
  const message = error.message.toLowerCase();
  if (error.code === "40001" || /changed|refresh|revision/.test(message)) return "RESOURCE_CONFLICT";
  if (/already used with a different payload/.test(message)) return "COMMAND_ID_REUSED";
  if (/required earlier command|dependency/.test(message)) return "DEPENDENCY_INCOMPLETE";
  if (/insufficient.*stock/.test(message)) return "INSUFFICIENT_STOCK";
  if (/category|medicine items only|vaccine items only|feed inventory item/.test(message)) return "ITEM_CATEGORY_NOT_ALLOWED";
  if (/today workspace is not enabled/.test(message)) return "FEATURE_DISABLED";
  if (error.code === "42501" || /assignment|assigned to you|farm manager/.test(message)) return "ASSIGNMENT_REQUIRED";
  if (error.code === "55000" || /operating day.*(locked|not open)/.test(message)) return "OPERATING_DAY_LOCKED";
  if (/operating window|seven.day|too old|expired/.test(message)) return "OPERATING_WINDOW_EXPIRED";
  if (/still missing|still open|confirm .* every flock/.test(message)) return "MISSING_REQUIRED_WORK";
  if (error.code === "P0002" || /not found/.test(message)) return "SOURCE_NOT_FOUND";
  if (["22023", "22P02", "23502", "23503", "23505", "23514"].includes(error.code ?? "")) return "INVALID_PAYLOAD";
  return "INTERNAL_ERROR";
}

function asResult(value: unknown, commandId: string): TodayCommandResult {
  const parsed = todayCommandResultSchema.safeParse(value);
  return parsed.success ? parsed.data : rejected(commandId, "INTERNAL_ERROR");
}

const zeroCommandId = "00000000-0000-0000-0000-000000000000";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function commandIdFrom(input: unknown) {
  if (typeof input !== "object" || input === null || !("command_id" in input)) return zeroCommandId;
  const value = String((input as {command_id?: unknown}).command_id ?? "");
  return uuidPattern.test(value) ? value : zeroCommandId;
}

export async function executeTodayCommand(context: AccessContext, input: unknown): Promise<TodayCommandResult> {
  let command: TodayCommand;
  try {
    command = parseTodayCommand(input);
  } catch {
    const schemaVersion = typeof input === "object" && input !== null && "schema_version" in input
      ? (input as {schema_version?: unknown}).schema_version
      : undefined;
    return rejected(commandIdFrom(input), schemaVersion !== undefined && schemaVersion !== 1
      ? "UNSUPPORTED_SCHEMA_VERSION"
      : "INVALID_COMMAND");
  }
  if (context.role !== "farm_manager") return rejected(command.command_id, "ROLE_NOT_ALLOWED");
  const auth = await createAuthedClient();
  const {data, error} = await auth.rpc("dispatch_today_command_v1", {
    p_actor_id: context.userId,
    p_command: command,
  });
  return error ? rejected(command.command_id, mapDatabaseError(error)) : asResult(data, command.command_id);
}
