import { createClient } from "@supabase/supabase-js";
import { createRouteHandler } from "next/server";
import { createClient as createAuthedClient } from "@/utils/supabase/server";
import { normalizeRole } from "@/lib/roles";

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
  try {
    const supabase = createAuthedClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || normalizeRole(profile.role) !== "ceo") {
      return new Response(JSON.stringify({ error: "Forbidden: CEO role required" }), { status: 403 });
    }

    const body = await req.json();
    const {
      branch,
      intakeBatch,
      farms,
      manager,
      orgId,
    } = body;

    // 1. Create Branch
    const { data: branchData, error: branchError } = await supabaseAdmin
      .from("branches")
      .insert({
        name: branch.name,
        location: branch.location,
        org_id: orgId,
      })
      .select()
      .single();

    if (branchError) throw new Error(`Branch creation failed: ${branchError.message}`);
    const branchId = branchData.id;

    // 2. Create Branch Intake Batch
    const { data: bibData, error: bibError } = await supabaseAdmin
      .from("branch_intake_batches")
      .insert({
        org_id: orgId,
        branch_id: branchId,
        source: intakeBatch.source,
        supplier_name: intakeBatch.supplier_name,
        purchase_date: intakeBatch.purchase_date,
        placement_date: intakeBatch.placement_date,
        total_count: intakeBatch.total_count,
        purchase_cost_per_bird: intakeBatch.purchase_cost_per_bird,
        transport_cost: intakeBatch.transport_cost,
        other_cost: intakeBatch.other_cost,
        total_cost: intakeBatch.total_cost,
        status: "pending",
        notes: intakeBatch.notes,
      })
      .select()
      .single();

    if (bibError) throw new Error(`Intake batch creation failed: ${bibError.message}`);
    const bibId = bibData.id;
    const generatedBatchCode = bibData.batch_code;

    // 3. Create Farms and their infrastructure
    const createdFarmIds: string[] = [];

    for (const farmConfig of farms) {
      const { data: farmData, error: farmError } = await supabaseAdmin
        .from("farms")
        .insert({
          name: farmConfig.name,
          location: farmConfig.location,
          branch_id: branchId,
          org_id: orgId,
        })
        .select()
        .single();

      if (farmError) throw new Error(`Farm creation failed for ${farmConfig.name}: ${farmError.message}`);
      const farmId = farmData.id;
      createdFarmIds.push(farmId);

      // Create Houses for this farm
      for (const houseConfig of farmConfig.houses) {
        const { data: houseData, error: houseError } = await supabaseAdmin
          .from("houses")
          .insert({
            name: houseConfig.name,
            capacity: houseConfig.capacity,
            farm_id: farmId,
            org_id: orgId,
          })
          .select()
          .single();

        if (houseError) throw new Error(`House creation failed for ${houseConfig.name}: ${houseError.message}`);
        const houseId = houseData.id;

        // Create Flocks for this house
        for (const flockConfig of houseConfig.flocks) {
          const { data: flockData, error: flockError } = await supabaseAdmin
            .from("flocks")
            .insert({
              flock_code: `FLK-${Math.random().toString(36).substring(2, 7).toUpperCase()}`, // Basic unique code
              type: flockConfig.type,
              age_at_placement_weeks: flockConfig.age_at_placement_weeks,
              template_id: flockConfig.template_id,
              house_id: houseId,
              farm_id: farmId,
              org_id: orgId,
            })
            .select()
            .single();

          if (flockError) throw new Error(`Flock creation failed: ${flockError.message}`);
          const flockId = flockData.id;

          // Finalize the Batch linked to this flock
          const { error: batchError } = await supabaseAdmin
            .from("batches")
            .insert({
              org_id: orgId,
              branch_id: branchId,
              farm_id: farmId,
              house_id: houseId,
              flock_id: flockId,
              batch_code: generatedBatchCode,
              source: intakeBatch.source,
              supplier_name: intakeBatch.supplier_name,
              purchase_date: intakeBatch.purchase_date,
              placement_date: intakeBatch.placement_date,
              total_count: intakeBatch.total_count,
              purchase_cost_per_bird: intakeBatch.purchase_cost_per_bird,
              transport_cost: intakeBatch.transport_cost,
              other_cost: intakeBatch.other_cost,
              status: "active",
            });

          if (batchError) throw new Error(`Batch linking failed: ${batchError.message}`);
        }
      }
    }

    // 7. Create Farm Manager User
    const { data: userAuthData, error: userAuthError } = await supabaseAdmin.auth.admin.createUser({
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

    if (userAuthError) throw new Error(`User creation failed: ${userAuthError.message}`);
    const userId = userAuthData.user?.id;

    if (!userId) throw new Error("User ID not returned after creation");

    // 8. Create Profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        org_id: orgId,
        role: "farm_manager",
        full_name: manager.fullName,
        email: manager.email,
      });

    if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);

    // 9. Assign Branch Access
    const { error: accessError } = await supabaseAdmin
      .from("user_branch_access")
      .insert({
        profile_id: userId,
        branch_id: branchId,
      });

    if (accessError) throw new Error(`Branch access assignment failed: ${accessError.message}`);

    return new Response(JSON.stringify({
      success: true,
      ids: {
        branchId,
        bibId,
        farmIds: createdFarmIds,
      },
    }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
