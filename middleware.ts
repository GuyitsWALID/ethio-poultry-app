import { createClient } from "@/utils/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const response = createClient(request);
  const { pathname } = request.nextUrl;
  const lockedOrgRoutes = ["/app/crm", "/app/training", "/app/hr", "/app/fleet", "/app/users", "/app/alerts"];

  if (pathname.startsWith("/admin") && pathname !== "/admin") {
    const hasGate = request.cookies.get("admin_gate")?.value === "true";
    if (!hasGate) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  if (lockedOrgRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/ceo";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
