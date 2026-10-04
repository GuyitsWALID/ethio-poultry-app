export function validTodayRolloutReason(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 4 && value.trim().length <= 2000;
}

export function canSubmitTodayRollout(enabled: boolean | null, saving: boolean, reason: string) {
  return enabled !== null && !saving && validTodayRolloutReason(reason);
}
