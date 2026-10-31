import type {OfflineAccessGrant} from "./contracts.ts";
import type {OfflineIdentity} from "./offline-store.ts";

export type StoredOfflineGrant = {grant: OfflineAccessGrant; receivedAt: number; lastSeenAt: number};
export type OfflineEditDecision = "allowed" | "expired" | "clock_changed" | "not_authorized";

// navigator.onLine is only a hint (especially during a service-worker reload).
// A transport failure cannot prove sign-out. Cached editing still needs its
// unexpired grant; foreground synchronization independently reauthorizes online.
export async function verifyRecoveryIdentity(identity: OfflineIdentity, read: () => Promise<Response>): Promise<"verified" | "offline"> {
  const response = await read().catch(() => null);
  if (!response) return "offline";
  if (!response.ok) throw Error("AUTH_REQUIRED");
  const current = await response.json();
  if (current?.role !== "farm_manager" || current.userId !== identity.userId || current.orgId !== identity.tenantId) throw Error("AUTH_REQUIRED");
  return "verified";
}

export function offlineEditDecision(stored: StoredOfflineGrant | undefined, identity: OfflineIdentity, selection: {farmId: string; flockId?: string | null; workDate: string}, now = Date.now()): OfflineEditDecision {
  if (!stored) return "not_authorized";
  const {grant, receivedAt, lastSeenAt} = stored;
  if (grant.tenantId !== identity.tenantId || grant.userId !== identity.userId || grant.farmId !== selection.farmId || grant.workDate !== selection.workDate || (selection.flockId && !grant.flockIds.includes(selection.flockId))) return "not_authorized";
  if (![now, receivedAt, lastSeenAt].every(Number.isFinite) || now < receivedAt || now < lastSeenAt) return "clock_changed";
  const issued = Date.parse(grant.issuedAt), expires = Date.parse(grant.expiresAt);
  // The server's clock establishes the operating day. A device with an
  // initially skewed clock cannot select a different day or extend the grant.
  const boundary = Date.parse(`${grant.workDate}T21:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(grant.workDate) || !Number.isFinite(boundary) || new Date(boundary).toISOString().slice(0,10) !== grant.workDate || !Number.isFinite(issued) || !Number.isFinite(expires) || issued < boundary - 86400000 || expires <= issued || expires > boundary) return "not_authorized";
  return issued + now - receivedAt < expires ? "allowed" : "expired";
}
