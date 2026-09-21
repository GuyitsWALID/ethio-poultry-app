import { NextResponse } from "next/server";

import { getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";
import { isAppLocale } from "@/i18n/request";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function PATCH(request: Request) {
  const context = await getAccessContext();
  if (isAccessResponse(context)) return context;
  if (context.role !== "ceo" && context.role !== "farm_manager") {
    return NextResponse.json({ code: "ROLE_NOT_ALLOWED" }, { status: 403, headers: privateHeaders });
  }

  const body = await request.json().catch(() => null) as { locale?: unknown } | null;
  if (!isAppLocale(body?.locale)) {
    return NextResponse.json({ code: "INVALID_LOCALE" }, { status: 400, headers: privateHeaders });
  }

  const { error } = await governanceAdmin
    .from("profiles")
    .update({ preferred_locale: body.locale })
    .eq("id", context.userId)
    .eq("org_id", context.homeOrgId);
  if (error) {
    return NextResponse.json({ code: "LOCALE_SAVE_FAILED" }, { status: 500, headers: privateHeaders });
  }

  const response = NextResponse.json({ locale: body.locale }, { headers: privateHeaders });
  response.cookies.set("preferred_locale", body.locale, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}
