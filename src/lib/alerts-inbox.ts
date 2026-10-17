import type {ActionCard} from "./action-desk-contract";

export function managerInboxMatches(action: ActionCard, viewerId: string, view: string) {
  if (view === "unassigned") return action.canClaim && !action.ownerId;
  if (view === "verification") return action.ownerId === viewerId && action.status === "awaiting_verification";
  return action.ownerId === viewerId && !["awaiting_verification", "resolved"].includes(action.status);
}

export function orderInbox(actions: ActionCard[], now = Date.now()) {
  const priority = (action: ActionCard) => action.status === "escalated" || Date.parse(action.dueAt) < now ? 0
    : action.severity === "high" ? 1 : action.severity === "medium" ? 2 : 3;
  return [...actions].sort((a, b) => priority(a) - priority(b) || Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.actionId.localeCompare(b.actionId));
}

// Labels describe the existing exact destination; never substitute a generic page.
export function alertDestinationKey(route: string) {
  const path = route.split(/[?#]/)[0];
  if (path === "/app/today") return "today";
  if (path === "/app/flocks" || path.startsWith("/app/flocks/")) return "flock";
  if (path === "/app/feeding-log") return "feed";
  if (path === "/app/daily-records") return "daily";
  if (path === "/app/inventory") return "stock";
  if (path === "/app/health") return "health";
  if (path === "/app/mortality") return "deaths";
  if (path === "/app/governance") return "approval";
  if (path === "/app/reconciliation") return "check";
  if (path === "/app/sales") return "sale";
  return "record";
}
