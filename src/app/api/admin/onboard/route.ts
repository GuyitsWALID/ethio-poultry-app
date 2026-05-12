import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { createClient as createAuthedClient } from "@/utils/supabase/server";

const adminRoles = new Set(["system_admin", "super_admin"]);

type OnboardPayload = {
  organization: {
    name?: string;
    plan?: string | null;
    branch_count?: number | null;
    primary_location?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  };
  admin: {
    full_name?: string;
    email?: string;
    phone?: string | null;
    password?: string;
  };
};

export async function POST(request: Request) {
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

  const payload = (await request.json().catch(() => null)) as OnboardPayload | null;
  if (!payload?.organization?.name || !payload.admin?.email || !payload.admin?.password) {
    return NextResponse.json({ message: "Missing required fields." }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ message: "Missing server configuration" }, { status: 500 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: payload.admin.email,
    password: payload.admin.password,
    email_confirm: true,
    user_metadata: {
      full_name: payload.admin.full_name ?? null,
      role: "ceo",
    },
  });

  if (authError || !authUser.user) {
    return NextResponse.json(
      { message: authError?.message ?? "Unable to create admin user." },
      { status: 400 }
    );
  }

  const { data: organization, error: orgError } = await adminClient
    .from("organizations")
    .insert({
      name: payload.organization.name,
      plan: payload.organization.plan ?? null,
      branch_count: payload.organization.branch_count ?? null,
      primary_location: payload.organization.primary_location ?? null,
      contact_email: payload.organization.contact_email ?? null,
      contact_phone: payload.organization.contact_phone ?? null,
    })
    .select("id")
    .single();

  if (orgError || !organization) {
    return NextResponse.json(
      { message: orgError?.message ?? "Unable to create organization." },
      { status: 400 }
    );
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: authUser.user.id,
    full_name: payload.admin.full_name ?? null,
    phone: payload.admin.phone ?? null,
    org_id: organization.id,
    role: "ceo",
    is_active: true,
  });

  if (profileError) {
    return NextResponse.json({ message: profileError.message }, { status: 400 });
  }

  return NextResponse.json({
    organizationId: organization.id,
    adminUserId: authUser.user.id,
  });
}
