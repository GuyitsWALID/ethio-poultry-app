import { parseActiveRole, type ActiveRole } from "@/lib/permissions";

export type AppRole = ActiveRole;

const roleRouteMap: Record<AppRole, string> = {
  system_admin: "/admin/dashboard",
  ceo: "/app/ceo",
  farm_manager: "/app/farm-manager",
};

const aliasMap: Record<string, AppRole> = {
  manager: "ceo",
  ceo: "ceo",
  super_admin: "system_admin",
  system_admin: "system_admin",
  farm_manager: "farm_manager",
};

export function normalizeRole(role: string | null | undefined): AppRole | null {
  if (typeof role !== "string") return null;
  return aliasMap[role.trim().toLowerCase()] ?? parseActiveRole(role);
}

export function routeForRole(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  return normalized ? roleRouteMap[normalized] : "/auth/sign-in";
}
