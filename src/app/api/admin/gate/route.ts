import { NextResponse } from "next/server";

const ACCESS_COOKIE = "admin_gate";

export async function POST(request: Request) {
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  const expected = process.env.ADMIN_ACCESS_CODE;

  if (!expected || !code || code !== expected) {
    return NextResponse.json({ message: "Invalid access code." }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ACCESS_COOKIE,
    value: "true",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 15,
    path: "/",
  });

  return response;
}
