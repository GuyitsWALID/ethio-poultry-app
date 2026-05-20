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

    if (profile?.org_id) {
      return new Response(
        JSON.stringify({
          userId: user.id,
          orgId: profile.org_id,
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

    return new Response(
      JSON.stringify({
        userId: user.id,
        orgId: adminProfile?.org_id ?? null,
        role: normalizeRole(adminProfile?.role),
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
    });
  }
}
