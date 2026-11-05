export function validTodayRolloutReason(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 4 && value.trim().length <= 2000;
}

export function canSubmitTodayRollout(enabled: boolean | null, saving: boolean, reason: string) {
  return enabled !== null && !saving && validTodayRolloutReason(reason);
}

export type TodayRolloutEvent = {
  sequence: number;
  enabled: boolean;
  actorName: string;
  source: "ceo" | "system_release";
  reason: string;
  occurredAt: string;
  releaseReference: string | null;
};

export function describeTodayRolloutEvent(
  row: {sequence_number: number; actor_id: string | null; reason: string | null; occurred_at: string; after_values: unknown; metadata: unknown},
  actorName: string | null,
): TodayRolloutEvent {
  const after = row.after_values as {today_workspace_enabled?: boolean} | null;
  const metadata = row.metadata as {release_reference?: string} | null;
  return {
    sequence: Number(row.sequence_number), enabled: after?.today_workspace_enabled === true,
    actorName: actorName?.trim() || (row.actor_id ? "CEO" : "System release"),
    source: row.actor_id ? "ceo" : "system_release", reason: row.reason ?? "",
    occurredAt: row.occurred_at, releaseReference: metadata?.release_reference ?? null,
  };
}
