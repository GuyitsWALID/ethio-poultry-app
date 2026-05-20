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
      return new Response(JSON.stringify({ rows: [] }), { status: 200 });
    }

    const [branchesRes, farmsRes, housesRes, flocksRes, batchesRes] = await Promise.all([
      supabaseAdmin.from("branches").select("id, name, location, org_id").eq("org_id", orgId).order("name"),
      supabaseAdmin.from("farms").select("id, name, branch_id, org_id").eq("org_id", orgId).order("name"),
      supabaseAdmin.from("houses").select("id, name, farm_id, branch_id, org_id").eq("org_id", orgId).order("name"),
      supabaseAdmin.from("flocks").select("id, flock_code, house_id, farm_id, org_id").eq("org_id", orgId).order("flock_code"),
      supabaseAdmin
        .from("batches")
        .select("id, batch_code, status, flock_id, house_id, farm_id, branch_id, org_id")
        .eq("org_id", orgId)
        .order("batch_code"),
    ]);

    const firstError =
      branchesRes.error ??
      farmsRes.error ??
      housesRes.error ??
      flocksRes.error ??
      batchesRes.error;

    if (firstError) {
      return new Response(JSON.stringify({ error: firstError.message }), { status: 500 });
    }

    const branches = branchesRes.data ?? [];
    const farms = farmsRes.data ?? [];
    const houses = housesRes.data ?? [];
    const flocks = flocksRes.data ?? [];
    const batches = batchesRes.data ?? [];

    const farmsByBranch = new Map<string, Array<{ id: string; name: string }>>();
    farms.forEach((farm) => {
      farmsByBranch.set(farm.branch_id, [...(farmsByBranch.get(farm.branch_id) ?? []), farm]);
    });

    const housesByFarm = new Map<string, Array<{ id: string; name: string }>>();
    houses.forEach((house) => {
      housesByFarm.set(house.farm_id, [...(housesByFarm.get(house.farm_id) ?? []), house]);
    });

    const flocksByHouse = new Map<string, Array<{ id: string; flock_code: string }>>();
    flocks.forEach((flock) => {
      flocksByHouse.set(flock.house_id, [...(flocksByHouse.get(flock.house_id) ?? []), flock]);
    });

    const batchesByFlock = new Map<string, Array<{ id: string; batch_code: string; status: string | null }>>();
    batches.forEach((batch) => {
      batchesByFlock.set(batch.flock_id, [...(batchesByFlock.get(batch.flock_id) ?? []), batch]);
    });

    const rows: Array<{
      key: string;
      branchName: string;
      branchLocation: string;
      farmName: string;
      houseName: string;
      flockCode: string;
      batchCode: string;
      batchStatus: string;
    }> = [];

    branches.forEach((branch) => {
      const branchFarms = farmsByBranch.get(branch.id) ?? [];
      if (branchFarms.length === 0) {
        rows.push({
          key: `branch-${branch.id}`,
          branchName: branch.name,
          branchLocation: branch.location ?? "-",
          farmName: "-",
          houseName: "-",
          flockCode: "-",
          batchCode: "-",
          batchStatus: "none",
        });
        return;
      }

      branchFarms.forEach((farm) => {
        const farmHouses = housesByFarm.get(farm.id) ?? [];
        if (farmHouses.length === 0) {
          rows.push({
            key: `farm-${farm.id}`,
            branchName: branch.name,
            branchLocation: branch.location ?? "-",
            farmName: farm.name,
            houseName: "-",
            flockCode: "-",
            batchCode: "-",
            batchStatus: "none",
          });
          return;
        }

        farmHouses.forEach((house) => {
          const houseFlocks = flocksByHouse.get(house.id) ?? [];
          if (houseFlocks.length === 0) {
            rows.push({
              key: `house-${house.id}`,
              branchName: branch.name,
              branchLocation: branch.location ?? "-",
              farmName: farm.name,
              houseName: house.name,
              flockCode: "-",
              batchCode: "-",
              batchStatus: "none",
            });
            return;
          }

          houseFlocks.forEach((flock) => {
            const flockBatches = batchesByFlock.get(flock.id) ?? [];
            if (flockBatches.length === 0) {
              rows.push({
                key: `flock-${flock.id}`,
                branchName: branch.name,
                branchLocation: branch.location ?? "-",
                farmName: farm.name,
                houseName: house.name,
                flockCode: flock.flock_code,
                batchCode: "-",
                batchStatus: "none",
              });
              return;
            }

            flockBatches.forEach((batch) => {
              rows.push({
                key: `batch-${batch.id}`,
                branchName: branch.name,
                branchLocation: branch.location ?? "-",
                farmName: farm.name,
                houseName: house.name,
                flockCode: flock.flock_code,
                batchCode: batch.batch_code,
                batchStatus: batch.status ?? "unknown",
              });
            });
          });
        });
      });
    });

    return new Response(JSON.stringify({ rows }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
    });
  }
}
