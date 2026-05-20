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

type HouseInput = {
  name: string;
  capacity: number;
  flocks: Array<Record<string, never>>;
};

export async function POST(req: Request) {
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
      .select("org_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
    }

    const role = normalizeRole(profile?.role);
    if (!["ceo", "system_admin", "super_admin"].includes(role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: "Profile missing org_id" }), { status: 400 });
    }

    const body = await req.json();
    const branchId = String(body?.branchId ?? "");
    const farmName = String(body?.farmName ?? "").trim();
    const capacityBirds = Number(body?.capacityBirds ?? 0) || null;
    const houses = (body?.houses ?? []) as HouseInput[];

    if (!branchId || !farmName) {
      return new Response(JSON.stringify({ error: "branchId and farmName are required" }), {
        status: 400,
      });
    }

    const { data: farm, error: farmError } = await supabaseAdmin
      .from("farms")
      .insert({
        org_id: profile.org_id,
        branch_id: branchId,
        name: farmName,
        capacity_birds: capacityBirds,
      })
      .select("id")
      .single();

    if (farmError || !farm) {
      return new Response(JSON.stringify({ error: farmError?.message ?? "Farm creation failed" }), {
        status: 500,
      });
    }

    const placementDate = new Date().toISOString().slice(0, 10);

    for (const house of houses) {
      const houseName = String(house.name ?? "").trim();
      if (!houseName) continue;

      const houseCapacity = Number(house.capacity ?? 0) || 0;

      const { data: createdHouse, error: houseError } = await supabaseAdmin
        .from("houses")
        .insert({
          org_id: profile.org_id,
          branch_id: branchId,
          farm_id: farm.id,
          name: houseName,
          capacity: houseCapacity,
          house_type: "broiler",
        })
        .select("id")
        .single();

      if (houseError || !createdHouse) {
        return new Response(
          JSON.stringify({ error: houseError?.message ?? `Failed creating house ${houseName}` }),
          { status: 500 }
        );
      }

      const flockCount = Math.max(0, house.flocks?.length ?? 0);
      for (let i = 0; i < flockCount; i += 1) {
        const autoCode = `FLK-${Math.random().toString(16).slice(2, 7).toUpperCase()}`;
        const flockSize = Math.max(1, Math.floor((houseCapacity || 1) / flockCount));
        const { error: flockError } = await supabaseAdmin.from("flocks").insert({
          org_id: profile.org_id,
          farm_id: farm.id,
          house_id: createdHouse.id,
          flock_code: autoCode,
          flock_type: "broiler",
          source: "external_purchase",
          placement_date: placementDate,
          initial_count: flockSize,
          current_count: flockSize,
          age_at_placement_days: 0,
        });

        if (flockError) {
          return new Response(
            JSON.stringify({ error: flockError.message }),
            { status: 500 }
          );
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? "Unknown error" }), {
      status: 500,
    });
  }
}
