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
    const now = new Date().toISOString();
    let allowedFarmIds: string[] | null = null;

    if (access.role === "farm_manager" && !access.supportSessionId) {
      const { data: assignments, error: assignmentError } = await supabaseAdmin
        .from("user_farm_access")
        .select("farm_id")
        .eq("org_id", orgId)
        .eq("profile_id", access.userId)
        .is("revoked_at", null)
        .lte("starts_at", now)
        .or(`expires_at.is.null,expires_at.gt.${now}`);
      if (assignmentError) return new Response(JSON.stringify({ error: assignmentError.message }), { status: 500 });
      allowedFarmIds = (assignments ?? []).map((row) => String(row.farm_id));
    }

    let farmsQuery = supabaseAdmin.from("farms").select("id, name, branch_id").eq("org_id", orgId);
    let housesQuery = supabaseAdmin.from("houses").select("id, name, farm_id").eq("org_id", orgId);
    let flocksQuery = supabaseAdmin.from("flocks").select("id, flock_code, farm_id, house_id, batch_id, initial_count, current_count, status").eq("org_id", orgId);
    let batchesQuery = supabaseAdmin
      .from("batches")
      .select("id, batch_code, status, branch_id, farm_id, house_id, placement_date, age_at_placement_days")
      .eq("org_id", orgId);

    if (allowedFarmIds !== null) {
      const ids = allowedFarmIds.length ? allowedFarmIds : ["00000000-0000-0000-0000-000000000000"];
      farmsQuery = farmsQuery.in("id", ids);
      housesQuery = housesQuery.in("farm_id", ids);
      flocksQuery = flocksQuery.in("farm_id", ids);
      batchesQuery = batchesQuery.in("farm_id", ids);
    }

    const [farmsRes, housesRes, flocksRes, batchesRes] = await Promise.all([
      farmsQuery.order("name"),
      housesQuery.order("name"),
      flocksQuery.order("flock_code"),
      batchesQuery.order("placement_date", { ascending: false }),
    ]);

    const firstError = farmsRes.error ?? housesRes.error ?? flocksRes.error ?? batchesRes.error;
    if (firstError) {
      return new Response(JSON.stringify({ error: firstError.message }), { status: 500 });
    }

    const branchIds = Array.from(new Set((farmsRes.data ?? []).map((farm) => farm.branch_id).filter(Boolean)));
    const branchesRes = branchIds.length
      ? await supabaseAdmin.from("branches").select("id, name").eq("org_id", orgId).in("id", branchIds).order("name")
      : { data: [], error: null };
    if (branchesRes.error) return new Response(JSON.stringify({ error: branchesRes.error.message }), { status: 500 });

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
