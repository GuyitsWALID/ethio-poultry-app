import { createClient } from "@supabase/supabase-js";

import { normalizeRole } from "@/lib/roles";
import { createClient as createAuthedClient } from "@/utils/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET() {
  try {
    const supabase = await createAuthedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .maybeSingle();

    const getOrgName = async (orgId: string | null | undefined) => {
      if (!orgId) return null;
      const { data: org } = await supabaseAdmin
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .maybeSingle();
      return org?.name ?? null;
    };

    if (profile?.org_id) {
      const orgName = await getOrgName(profile.org_id);
      return new Response(
        JSON.stringify({
          userId: user.id,
          orgId: profile.org_id,
          orgName,
          role: normalizeRole(profile.role),
        }),
        { status: 200 }
      );
    }

    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (adminProfileError) {
      return new Response(JSON.stringify({ error: adminProfileError.message }), { status: 500 });
    }

    const orgName = await getOrgName(adminProfile?.org_id);
    return new Response(
      JSON.stringify({
        userId: user.id,
        orgId: adminProfile?.org_id ?? null,
        orgName,
        role: normalizeRole(adminProfile?.role),
      }),
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
    });
  }
}
