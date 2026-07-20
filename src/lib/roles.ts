import type { Enums } from "@/types/supabase";

export type AppRole = Enums<"user_role">;

const roleRouteMap: Record<AppRole, string> = {
  super_admin: "/app/ceo",
  system_admin: "/app/ceo",
  ceo: "/app/ceo",
  farm_manager: "/app/farm-manager",
  veterinarian: "/app/health",
  store_keeper: "/app/inventory",
};

const aliasMap: Record<string, AppRole> = {
  manager: "farm_manager",
  ceo: "ceo",
  super_admin: "super_admin",
  system_admin: "system_admin",
  farm_manager: "farm_manager",
  veterinarian: "veterinarian",
  store_keeper: "store_keeper",
};

export function normalizeRole(role: string | null | undefined): AppRole {
  if (!role) {
    return "ceo";
  }

  return aliasMap[role.trim().toLowerCase()] ?? "ceo";
}

export function routeForRole(role: string | null | undefined): string {
  return roleRouteMap[normalizeRole(role)];
}
