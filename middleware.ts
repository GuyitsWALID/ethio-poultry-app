import { createClient } from "@/utils/supabase/middleware";
import { routeForRole, type AppRole } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";

const dashboardRouteAccess: Record<string, AppRole[]> = {
  "/app/ceo": ["ceo", "system_admin", "super_admin"],
  "/app/farm-manager": ["farm_manager"],
  "/app/veterinarian": ["veterinarian", "farm_manager"],
  "/app/store-keeper": ["store_keeper", "farm_manager"],
};

function resolveRoleForAccess(rawRole: unknown): AppRole | null {
  const value = typeof rawRole === "string" ? rawRole.trim().toLowerCase() : "";
  if (!value) return null;

  if (value === "manager") return "farm_manager";
  if (value === "ceo") return "ceo";
  if (value === "system_admin") return "system_admin";
  if (value === "super_admin") return "super_admin";
  if (value === "farm_manager") return "farm_manager";
  if (value === "veterinarian") return "veterinarian";
  if (value === "store_keeper") return "store_keeper";

  return null;
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);
  const { pathname } = request.nextUrl;
  const lockedOrgRoutes = ["/app/crm", "/app/training", "/app/hr", "/app/fleet", "/app/users", "/app/alerts"];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthRoute = pathname.startsWith("/app");

  if (isAuthRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    return NextResponse.redirect(url);
  }

  let currentRole: AppRole | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const resolvedRole = profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role ?? null;
    currentRole = resolveRoleForAccess(resolvedRole);
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin") {
    const hasGate = request.cookies.get("admin_gate")?.value === "true";
    if (!hasGate) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  if (lockedOrgRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    if (!currentRole || !["ceo", "system_admin", "super_admin"].includes(currentRole)) {
      const url = request.nextUrl.clone();
      url.pathname = currentRole ? routeForRole(currentRole) : "/auth/sign-in";
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    url.pathname = "/app/ceo";
    return NextResponse.redirect(url);
  }

  const matchedDashboardRoute = Object.keys(dashboardRouteAccess).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (matchedDashboardRoute) {
    if (!currentRole) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/sign-in";
      return NextResponse.redirect(url);
    }

    const allowedRoles = dashboardRouteAccess[matchedDashboardRoute];
    if (!allowedRoles.includes(currentRole)) {
      const url = request.nextUrl.clone();
      url.pathname = routeForRole(currentRole);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
