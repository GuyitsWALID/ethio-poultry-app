import type { ActionSeverity, ActionStatus } from "@/lib/action-desk-contract";

export type WorkflowCommand = "assign" | "claim" | "acknowledge" | "start" | "submit_resolution" | "verify";

export function actionDeadlineAt(severity: ActionSeverity, reference = new Date()) {
  const hours = severity === "high" ? 24 : severity === "medium" ? 72 : 168;
  return new Date(reference.getTime() + hours * 3600000).toISOString();
}

export function actionStatusAfter(command: WorkflowCommand, current: ActionStatus, sourceStillActive = true): ActionStatus {
  if (current === "resolved") return "resolved";
  if (command === "assign" || command === "claim") return "assigned";
  if (command === "acknowledge") return "acknowledged";
  if (command === "start") return "in_progress";
  if (command === "submit_resolution") return "awaiting_verification";
  return sourceStillActive ? "in_progress" : "resolved";
}
