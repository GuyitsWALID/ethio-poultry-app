import { createClient } from "@supabase/supabase-js";

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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
    }

    const orgId = profile?.org_id;
    if (!orgId) {
      return new Response(JSON.stringify({ branches: [], farms: [], houses: [], flocks: [], batches: [] }), { status: 200 });
    }

    const [branchesRes, farmsRes, housesRes, flocksRes, batchesRes] = await Promise.all([
      supabaseAdmin.from("branches").select("id, name").eq("org_id", orgId).order("name"),
      supabaseAdmin.from("farms").select("id, name, branch_id").eq("org_id", orgId).order("name"),
      supabaseAdmin.from("houses").select("id, name, farm_id").eq("org_id", orgId).order("name"),
      supabaseAdmin.from("flocks").select("id, flock_code, farm_id, house_id").eq("org_id", orgId).order("flock_code"),
      supabaseAdmin
        .from("batches")
        .select("id, batch_code, branch_id, farm_id, house_id, flock_id")
        .eq("org_id", orgId)
        .order("placement_date", { ascending: false }),
    ]);

    const firstError =
      branchesRes.error ?? farmsRes.error ?? housesRes.error ?? flocksRes.error ?? batchesRes.error;
    if (firstError) {
      return new Response(JSON.stringify({ error: firstError.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({
        branches: branchesRes.data ?? [],
        farms: farmsRes.data ?? [],
        houses: housesRes.data ?? [],
        flocks: flocksRes.data ?? [],
        batches: batchesRes.data ?? [],
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), { status: 500 });
  }
}
