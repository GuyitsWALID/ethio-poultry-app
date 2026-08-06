export const ACTIVE_ROLES = ["ceo", "farm_manager", "system_admin"] as const;
export type ActiveRole = (typeof ACTIVE_ROLES)[number];

export const CAPABILITIES = [
  "tenant:view",
  "tenant:manage",
  "farm:operate",
  "warehouse:operate",
  "governance:request",
  "governance:approve",
  "finance:reconcile",
  "audit:view_tenant",
  "audit:view_scope",
  "platform:admin",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const roleCapabilities: Record<ActiveRole, ReadonlySet<Capability>> = {
  ceo: new Set(["tenant:view", "tenant:manage", "governance:approve", "finance:reconcile", "audit:view_tenant"]),
  farm_manager: new Set(["tenant:view", "farm:operate", "warehouse:operate", "governance:request", "audit:view_scope"]),
  system_admin: new Set(["platform:admin"]),
};

export function parseActiveRole(value: unknown): ActiveRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "manager") return "ceo";
  if (normalized === "super_admin") return "system_admin";
  return ACTIVE_ROLES.includes(normalized as ActiveRole) ? normalized as ActiveRole : null;
}

export function hasCapability(role: ActiveRole | null, capability: Capability) {
  return role !== null && roleCapabilities[role].has(capability);
}

export function capabilitiesFor(role: ActiveRole | null): Capability[] {
  return role === null ? [] : [...roleCapabilities[role]];
}

export function isOperationalRole(role: ActiveRole | null): role is "farm_manager" {
  return hasCapability(role, "farm:operate");
}
