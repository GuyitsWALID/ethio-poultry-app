import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { createClient as createAuthedClient } from "@/utils/supabase/server";

const adminRoles = new Set(["system_admin", "super_admin"]);

export async function GET() {
  const supabase = createAuthedClient(cookies());
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !adminRoles.has(profile.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ message: "Missing server configuration" }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const [{ count: totalOrganizations }, { count: totalUsers }, { count: activeUsers }] =
    await Promise.all([
      adminClient.from("organizations").select("id", { count: "exact", head: true }),
      adminClient.from("profiles").select("id", { count: "exact", head: true }),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: newOrganizations30d } = await adminClient
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .gte("created_at", thirtyDaysAgo.toISOString());

  return NextResponse.json({
    totalOrganizations: totalOrganizations ?? 0,
    activeOrganizations: activeUsers ?? 0,
    totalUsers: totalUsers ?? 0,
    newOrganizations30d: newOrganizations30d ?? 0,
  });
}
