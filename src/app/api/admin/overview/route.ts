import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { normalizeRole } from "@/lib/roles";
import { createClient as createAuthedClient } from "@/utils/supabase/server";

const adminRoles = new Set(["system_admin"]);

export async function GET() {
  try {
    const supabase = await createAuthedClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const metadataRole = normalizeRole(user.user_metadata?.role);
    let normalizedRole = metadataRole;

    if (!metadataRole || !adminRoles.has(metadataRole)) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        return NextResponse.json({ message: profileError.message }, { status: 500 });
      }

      normalizedRole = normalizeRole(profile?.role);
    }

    if (!normalizedRole || !adminRoles.has(normalizedRole)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { message: "Missing server configuration" },
        { status: 500 }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const [orgResult, userResult, activeResult] = await Promise.all([
      adminClient.from("organizations").select("id", { count: "exact", head: true }),
      adminClient.from("profiles").select("id", { count: "exact", head: true }),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

    if (orgResult.error || userResult.error || activeResult.error) {
      return NextResponse.json(
        {
          message: orgResult.error?.message ??
            userResult.error?.message ??
            activeResult.error?.message ??
            "Unable to load metrics",
        },
        { status: 500 }
      );
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { count: newOrganizations30d, error: newOrgError } = await adminClient
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (newOrgError) {
      return NextResponse.json({ message: newOrgError.message }, { status: 500 });
    }

    return NextResponse.json({
      totalOrganizations: orgResult.count ?? 0,
      activeOrganizations: activeResult.count ?? 0,
      totalUsers: userResult.count ?? 0,
      newOrganizations30d: newOrganizations30d ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
