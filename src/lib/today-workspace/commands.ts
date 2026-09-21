import "server-only";

import {canAccessFarm, governanceAdmin, type AccessContext} from "@/lib/access-context";
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
  return {command_id: commandId, status: code === "RESOURCE_CONFLICT" ? "conflict" : "rejected", error_code: code, error_params: params};
}

function mapDatabaseError(error: DatabaseError): TodayErrorCode {
  const message = error.message.toLowerCase();
  if (error.code === "40001" || /changed|refresh|revision/.test(message)) return "RESOURCE_CONFLICT";
  if (error.code === "42501" || /assignment|assigned to you|farm manager/.test(message)) return "ASSIGNMENT_REQUIRED";
  if (error.code === "55000" || /operating day.*(locked|not open)/.test(message)) return "OPERATING_DAY_LOCKED";
  if (/insufficient.*stock/.test(message)) return "INSUFFICIENT_STOCK";
  if (/category|medicine items only|vaccine items only|feed inventory item/.test(message)) return "ITEM_CATEGORY_NOT_ALLOWED";
  if (/already used with a different payload/.test(message)) return "COMMAND_ID_REUSED";
  if (error.code === "23514" || /still missing|still open|confirm .* every flock/.test(message)) return "MISSING_REQUIRED_WORK";
  if (error.code === "P0002" || /not found/.test(message)) return "SOURCE_NOT_FOUND";
  if (error.code === "22023") return "INVALID_PAYLOAD";
  return "INTERNAL_ERROR";
}

function asResult(value: unknown, commandId: string): TodayCommandResult {
  const parsed = todayCommandResultSchema.safeParse(value);
  return parsed.success ? parsed.data : rejected(commandId, "INTERNAL_ERROR");
}

async function executeAttestation(context: AccessContext, command: Extract<TodayCommand, {type: "confirm_no_activity"}>) {
  const {data, error} = await governanceAdmin.rpc("apply_daily_task_attestation_v1", {
    p_actor_id: context.userId,
    p_command_id: command.command_id,
    p_schema_version: command.schema_version,
    p_command_type: command.type,
    p_payload: command,
    p_farm_id: command.farm_id,
    p_flock_id: command.flock_id ?? null,
    p_work_date: command.work_date,
    p_task_code: command.payload.task_code,
    p_expected_source_fingerprint: command.payload.source_fingerprint,
  });
  return error ? rejected(command.command_id, mapDatabaseError(error)) : asResult(data, command.command_id);
}

async function finishDay(context: AccessContext, command: Extract<TodayCommand, {type: "finish_operating_day"}>) {
  const auth = await createAuthedClient();
  const {data, error} = await auth.rpc("finish_farm_operating_day_v1", {
    p_actor_id: context.userId,
    p_command_id: command.command_id,
    p_schema_version: command.schema_version,
    p_payload: command,
    p_farm_id: command.farm_id,
    p_operating_date: command.work_date,
    p_expected_revision: command.expected_resource_revision,
  });
  return error ? rejected(command.command_id, mapDatabaseError(error)) : asResult(data, command.command_id);
}

export async function executeTodayCommand(context: AccessContext, input: unknown): Promise<TodayCommandResult> {
  let command: TodayCommand;
  try {
    command = parseTodayCommand(input);
  } catch {
    const commandId = typeof input === "object" && input !== null && "command_id" in input
      ? String((input as {command_id?: unknown}).command_id ?? "00000000-0000-0000-0000-000000000000")
      : "00000000-0000-0000-0000-000000000000";
    return rejected(commandId, "INVALID_COMMAND");
  }
  if (context.role !== "farm_manager") return rejected(command.command_id, "ROLE_NOT_ALLOWED");
  if (!(await canAccessFarm(context, command.farm_id))) return rejected(command.command_id, "ASSIGNMENT_REQUIRED");
  if (command.type === "confirm_no_activity") return executeAttestation(context, command);
  if (command.type === "finish_operating_day") return finishDay(context, command);

  const {data, error} = await governanceAdmin.rpc("execute_today_command_v1", {
    p_actor_id: context.userId,
    p_command: command,
  });
  return error ? rejected(command.command_id, mapDatabaseError(error)) : asResult(data, command.command_id);
}
