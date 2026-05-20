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

export async function POST(req: Request) {
  let createdAuthUserId: string | null = null;

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
      .select("role, org_id")
      .eq("id", user.id)
      .maybeSingle();

    const metadataRole = normalizeRole(
      (user.app_metadata?.role as string | undefined) ??
      (user.user_metadata?.role as string | undefined)
    );

    let effectiveRole = normalizeRole(profile?.role);
    let orgId = profile?.org_id ?? null;

    if (!profile || !orgId) {
      const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
        .from("profiles")
        .select("role, org_id")
        .eq("id", user.id)
        .maybeSingle();

      if (adminProfileError) {
        throw new Error(`Profile lookup failed: ${adminProfileError.message}`);
      }

      effectiveRole = normalizeRole(adminProfile?.role ?? effectiveRole);
      orgId = adminProfile?.org_id ?? orgId;
    }

    if (effectiveRole !== "ceo" && metadataRole !== "ceo") {
      return new Response(
        JSON.stringify({ error: "Forbidden: CEO role required" }),
        { status: 403 }
      );
    }

    if (!orgId) {
      return new Response(JSON.stringify({ error: "Profile is missing org_id" }), {
        status: 400,
      });
    }
    const body = await req.json();
    const { branch, intakeBatch, farms, manager } = body;

    if (
      !branch?.name ||
      !intakeBatch?.placement_date ||
      !intakeBatch?.total_count ||
      !manager?.email ||
      !manager?.fullName ||
      !manager?.phone
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required setup fields" }),
        { status: 400 }
      );
    }

    const { data: userAuthData, error: userAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email: manager.email,
        email_confirm: true,
        user_metadata: {
          role: "farm_manager",
          full_name: manager.fullName,
        },
        app_metadata: {
          role: "farm_manager",
        },
        password: manager.password || "TemporaryPassword123!",
      });

    if (userAuthError) {
      throw new Error(`User creation failed: ${userAuthError.message}`);
    }

    createdAuthUserId = userAuthData.user?.id ?? null;
    if (!createdAuthUserId) {
      throw new Error("User ID not returned after creation");
    }

    const { data: setupResult, error: setupError } = await supabaseAdmin.rpc(
      "ceo_initialize_branch_hierarchy",
      {
        p_org_id: orgId,
        p_branch: branch,
        p_intake_batch: intakeBatch,
        p_farms: farms ?? [],
        p_manager: {
          user_id: createdAuthUserId,
          full_name: manager.fullName,
          email: manager.email,
          phone: manager.phone,
        },
      }
    );

    if (setupError) {
      throw new Error(`Setup transaction failed: ${setupError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ids: setupResult,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    if (createdAuthUserId) {
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
    }

    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
