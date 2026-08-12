import { createClient } from "@supabase/supabase-js";

import { getAccessContext,isAccessResponse } from "@/lib/access-context";

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
    const access=await getAccessContext({tenant:true});if(isAccessResponse(access))return access;const orgId=access.orgId;

    const [branchesRes, farmsRes, housesRes, flocksRes, batchesRes] = await Promise.all([
      supabaseAdmin.from("branches").select("id, name").eq("org_id", orgId).order("name"),
      supabaseAdmin.from("farms").select("id, name, branch_id").eq("org_id", orgId).order("name"),
      supabaseAdmin.from("houses").select("id, name, farm_id").eq("org_id", orgId).order("name"),
      supabaseAdmin.from("flocks").select("id, flock_code, farm_id, house_id, batch_id, initial_count, current_count, status").eq("org_id", orgId).order("flock_code"),
      supabaseAdmin
        .from("batches")
        .select("id, batch_code, status, branch_id, farm_id, house_id, placement_date, age_at_placement_days")
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
