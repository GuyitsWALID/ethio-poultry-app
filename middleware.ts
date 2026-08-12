import { createClient } from "@/utils/supabase/middleware";
import { parseActiveRole } from "@/lib/permissions";
import { routeForRole, type AppRole } from "@/lib/roles";
import { type NextRequest, NextResponse } from "next/server";

const dashboardRouteAccess: Record<string, AppRole[]> = {
  "/app/ceo": ["ceo"],
  "/app/farm-manager": ["farm_manager"],
};

const resolveRoleForAccess = (rawRole: unknown): AppRole | null => parseActiveRole(rawRole);

type SupportSessionQuery = {
  select(columns: string): SupportSessionQuery;
  eq(column: string, value: string): SupportSessionQuery;
  is(column: string, value: null): SupportSessionQuery;
  lte(column: string, value: string): SupportSessionQuery;
  gt(column: string, value: string): SupportSessionQuery;
  limit(value: number): SupportSessionQuery;
  maybeSingle(): Promise<{ data: { id: string } | null }>;
};
type SupportRpc={rpc(name:string,args:Record<string,string>):PromiseLike<unknown>};

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
    const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    const resolvedRole = profile?.role ?? user.app_metadata?.role ?? user.user_metadata?.role ?? null;
    currentRole = profile?.is_active === false ? null : resolveRoleForAccess(resolvedRole);
    if ((currentRole === "ceo" || currentRole === "system_admin") && user.last_sign_in_at && Date.now() - Date.parse(user.last_sign_in_at) >= 8 * 60 * 60 * 1000) {
      await supabase.auth.signOut();
      const url=request.nextUrl.clone();url.pathname=currentRole==="system_admin"?"/admin":"/auth/sign-in";url.searchParams.set("reason","session_expired");return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/admin") && pathname !== "/admin") {
    const hasGate = request.cookies.get("admin_gate")?.value === "true";
    if (!hasGate) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/app") && currentRole === "system_admin") {
    const now = new Date().toISOString();
    const supportDb = supabase as unknown as { from(table: string): SupportSessionQuery };
    const { data: session } = await supportDb
      .from("break_glass_sessions")
      .select("id")
      .eq("administrator_id", user!.id)
      .is("revoked_at", null)
      .lte("started_at", now)
      .gt("expires_at", now)
      .limit(1)
      .maybeSingle();
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      return NextResponse.redirect(url);
    }
    await (supabase as unknown as SupportRpc).rpc("record_support_access",{p_path:pathname,p_method:request.method});
  }

  if (lockedOrgRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    if (currentRole !== "ceo") {
      const url = request.nextUrl.clone();
      url.pathname = currentRole ? routeForRole(currentRole) : "/auth/sign-in";
      return NextResponse.redirect(url);
    }

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
