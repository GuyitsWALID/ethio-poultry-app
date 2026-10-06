import {isLegacyCorrectionTarget} from "./today-workspace/entry-routing.ts";

type BatchChoice = {id: string; status: string};

// Metadata is already tenant/assignment scoped by /api/scope/options. This
// selection preserves context only; the feed APIs still authorize every read.
export function feedBatchChoices<T extends BatchChoice>(eligible: T[], selectedId: string, query: Pick<URLSearchParams, "get">): T[] {
  const active = eligible.filter(batch => batch.status === "active");
  const target = query.get("feed_target");
  const exact = isLegacyCorrectionTarget(query) || query.get("view") === "advanced" || ["template_management", "today_sessions", "feed_history"].includes(target || "");
  if (!exact || active.some(batch => batch.id === selectedId)) return active;
  const historical = eligible.find(batch => batch.id === selectedId);
  return historical ? [historical, ...active] : active;
}
