import type {TodayCommandResult, TodayErrorCode, TodayTask} from "./contracts.ts";

export type ReviewTask = TodayTask & {contextLabel?: string};
export type FinishIssue = {
  commandId: string;
  kind: "conflict" | "rejected";
  errorCode?: TodayErrorCode;
};

export function buildFinishReview(tasks: ReviewTask[], issues: FinishIssue[]) {
  return {
    completed: tasks.filter((item) => item.state === "complete"),
    missing: tasks.filter((item) => item.state === "not_started"),
    queued: tasks.filter((item) => item.state === "draft_on_tablet" || item.state === "waiting_to_sync"),
    attention: tasks.filter((item) => item.state === "needs_attention"),
    conflicts: issues.filter((item) => item.kind === "conflict"),
    rejected: issues.filter((item) => item.kind === "rejected"),
  };
}

export function finishIssueFromResult(result: TodayCommandResult): FinishIssue | null {
  if (result.status === "applied") return null;
  return {
    commandId: result.command_id,
    kind: result.status === "conflict" ? "conflict" : "rejected",
    errorCode: result.error_code,
  };
}
