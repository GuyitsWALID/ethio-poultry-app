import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import { normalizeRole } from "@/lib/roles";
import type { Database } from "@/types/supabase";
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

type FlockRow = Database["public"]["Tables"]["flocks"]["Row"];
type FarmRow = Pick<Database["public"]["Tables"]["farms"]["Row"], "id" | "name" | "branch_id">;
type HouseRow = Pick<Database["public"]["Tables"]["houses"]["Row"], "id" | "name" | "farm_id">;
type BatchRow = Pick<
  Database["public"]["Tables"]["batches"]["Row"],
  | "id"
  | "batch_code"
  | "branch_id"
  | "farm_id"
  | "house_id"
  | "flock_id"
  | "total_count"
  | "purchase_cost_per_bird"
  | "transport_cost"
  | "other_cost"
  | "total_batch_cost"
>;
type DailyRow = Database["public"]["Tables"]["daily_farm_records"]["Row"];
type InventoryItem = Pick<Database["public"]["Tables"]["inventory_items"]["Row"], "id" | "name" | "reorder_level" | "category" | "unit_cost">;
type StockLedgerRow = Pick<Database["public"]["Tables"]["stock_ledger"]["Row"], "item_id" | "quantity" | "transaction_type" | "unit_cost" | "flock_id">;

const feedTypeLabels: Record<string, string> = {
  starter_feed: "Starter Feed",
  grower_pullet_feed: "Grower Pullet Feed",
  layer_feed: "Layer Feed",
  broiler_feed: "Broiler Feed",
  medicated_feed: "Medicated Feed",
};

function toDate(value: string | null, fallback: Date) {
  if (!value) return fallback.toISOString().slice(0, 10);
  return value;
}

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function round(value: number, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function stockSignedQuantity(row: StockLedgerRow) {
  return row.transaction_type === "issue" || row.transaction_type === "transfer_out"
    ? -row.quantity
    : row.quantity;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.org_id) {
      return new Response(JSON.stringify({ error: "Profile is missing organization access." }), {
        status: 403,
      });
    }

    const orgId = profile.org_id;
    const role = normalizeRole(profile.role);
    const params = request.nextUrl.searchParams;
    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setDate(today.getDate() - 29);

    const dateFrom = toDate(params.get("date_from"), defaultFrom);
    const dateTo = toDate(params.get("date_to"), today);
    const branchId = params.get("branch_id") ?? "";
    const farmId = params.get("farm_id") ?? "";
    const houseId = params.get("house_id") ?? "";
    const flockId = params.get("flock_id") ?? "";
    const batchId = params.get("batch_id") ?? "";

    const [
      farmsRes,
      housesRes,
      flocksRes,
      batchesRes,
      branchAccessRes,
      farmAccessRes,
      inventoryRes,
      stockRes,
      vaccinationsRes,
    ] = await Promise.all([
      supabaseAdmin.from("farms").select("id, name, branch_id").eq("org_id", orgId),
      supabaseAdmin.from("houses").select("id, name, farm_id").eq("org_id", orgId),
      supabaseAdmin
        .from("flocks")
        .select("id, flock_code, flock_type, farm_id, house_id, initial_count, current_count, status, placement_date, org_id, source, breed_id, age_at_placement_days, purchase_cost_per_bird, notes, created_at, updated_at")
        .eq("org_id", orgId),
      supabaseAdmin
        .from("batches")
        .select("id, batch_code, branch_id, farm_id, house_id, flock_id, total_count, purchase_cost_per_bird, transport_cost, other_cost, total_batch_cost")
        .eq("org_id", orgId),
      role === "farm_manager"
        ? supabaseAdmin.from("user_branch_access").select("branch_id").eq("profile_id", user.id)
        : Promise.resolve({ data: [] as Array<{ branch_id: string }> }),
      role === "farm_manager"
        ? supabaseAdmin.from("user_farm_access").select("farm_id").eq("profile_id", user.id)
        : Promise.resolve({ data: [] as Array<{ farm_id: string }> }),
      supabaseAdmin.from("inventory_items").select("id, name, reorder_level, category, unit_cost").eq("org_id", orgId).limit(500),
      supabaseAdmin.from("stock_ledger").select("item_id, quantity, transaction_type, unit_cost, flock_id").eq("org_id", orgId).limit(5000),
      supabaseAdmin
        .from("vaccination_events")
        .select("id, event_date, flock_id")
        .eq("org_id", orgId)
        .gte("event_date", today.toISOString().slice(0, 10))
        .lte("event_date", new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    ]);

    const farms = (farmsRes.data ?? []) as FarmRow[];
    const houses = (housesRes.data ?? []) as HouseRow[];
    const batches = (batchesRes.data ?? []) as BatchRow[];
    const allowedBranchIds = new Set((branchAccessRes.data ?? []).map((row) => row.branch_id));
    const allowedFarmIds = new Set((farmAccessRes.data ?? []).map((row) => row.farm_id));
    const farmById = new Map(farms.map((farm) => [farm.id, farm]));
    const houseById = new Map(houses.map((house) => [house.id, house]));
    const batchById = new Map(batches.map((batch) => [batch.id, batch]));

    let scopedFlocks = ((flocksRes.data ?? []) as FlockRow[]).filter((flock) => {
      const farm = farmById.get(flock.farm_id);
      if (!farm) return false;
      if (role === "farm_manager" && allowedBranchIds.size + allowedFarmIds.size > 0) {
        if (!allowedFarmIds.has(flock.farm_id) && !allowedBranchIds.has(farm.branch_id)) return false;
      }
      if (branchId && farm.branch_id !== branchId) return false;
      if (farmId && flock.farm_id !== farmId) return false;
      if (houseId && flock.house_id !== houseId) return false;
      if (flockId && flock.id !== flockId) return false;
      if (batchId) {
        const batch = batchById.get(batchId);
        if (!batch || batch.flock_id !== flock.id) return false;
      }
      return true;
    });

    if (role === "farm_manager" && allowedBranchIds.size + allowedFarmIds.size === 0) {
      scopedFlocks = [];
    }

    const scopedFlockIds = scopedFlocks.map((flock) => flock.id);
    let dailyRows: DailyRow[] = [];
    if (scopedFlockIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("daily_farm_records")
        .select("*")
        .eq("org_id", orgId)
        .gte("record_date", dateFrom)
        .lte("record_date", dateTo)
        .in("flock_id", scopedFlockIds)
        .order("record_date", { ascending: true });
      dailyRows = (data ?? []) as DailyRow[];
    }

    const activeFlocks = scopedFlocks.filter((flock) => flock.status === "active");
    const liveBirds = activeFlocks.reduce((sum, flock) => sum + (flock.current_count ?? 0), 0);
    const activeHouses = new Set(activeFlocks.map((flock) => flock.house_id)).size;
    const activeFarms = new Set(activeFlocks.map((flock) => flock.farm_id)).size;
    const deaths = dailyRows.reduce((sum, row) => sum + (row.deaths ?? 0), 0);
    const totalEggs = dailyRows.reduce((sum, row) => sum + (row.total_eggs ?? 0), 0);
    const normalEggs = dailyRows.reduce((sum, row) => sum + (row.normal_eggs ?? 0), 0);
    const brokenEggs = dailyRows.reduce((sum, row) => sum + (row.broken_eggs ?? 0), 0);
    const feedGrams = dailyRows.reduce((sum, row) => sum + (row.feed_intake_grams ?? 0), 0);
    const feedQuantity = dailyRows.reduce((sum, row) => sum + (row.feed_intake_quantity ?? 0), 0);
    const feedLeftoverGrams = dailyRows.reduce((sum, row) => sum + (row.feed_leftover_grams ?? 0), 0);
    const feedKg = round(feedGrams / 1000);
    const mortalityRate = pct(deaths, liveBirds + deaths);
    const productionRate = pct(totalEggs, liveBirds);
    const feedItems = ((inventoryRes.data ?? []) as InventoryItem[]).filter((item) => item.category === "feed");
    const feedItemIds = new Set(feedItems.map((item) => item.id));
    const avgFeedUnitCostValues = feedItems.map((item) => item.unit_cost ?? 0).filter((cost) => cost > 0);
    const avgFeedUnitCost =
      avgFeedUnitCostValues.length > 0
        ? avgFeedUnitCostValues.reduce((sum, cost) => sum + cost, 0) / avgFeedUnitCostValues.length
        : 0;
    const issuedFeedCost = ((stockRes.data ?? []) as StockLedgerRow[]).reduce((sum, row) => {
      if (!feedItemIds.has(row.item_id)) return sum;
      if (row.transaction_type !== "issue" && row.transaction_type !== "transfer_out") return sum;
      if (row.flock_id && !scopedFlockIds.includes(row.flock_id)) return sum;
      return sum + row.quantity * row.unit_cost;
    }, 0);
    const estimatedFeedCost = feedKg * avgFeedUnitCost;
    const feedCost = issuedFeedCost > 0 ? issuedFeedCost : estimatedFeedCost;
    const feedCostPerEgg = totalEggs > 0 && feedCost > 0 ? round(feedCost / totalEggs) : null;
    const scopedBatchCosts = batches
      .filter((batch) => scopedFlockIds.includes(batch.flock_id))
      .reduce((sum, batch) => {
        const fallback =
          (batch.purchase_cost_per_bird ?? 0) * (batch.total_count ?? 0) +
          (batch.transport_cost ?? 0) +
          (batch.other_cost ?? 0);
        return sum + (batch.total_batch_cost ?? fallback);
      }, 0);
    const costPerBird = liveBirds > 0 && scopedBatchCosts + feedCost > 0 ? round((scopedBatchCosts + feedCost) / liveBirds) : null;
    const costInputsAvailable = feedCost > 0 || scopedBatchCosts > 0;

    const stockByItem = new Map<string, number>();
    ((stockRes.data ?? []) as StockLedgerRow[]).forEach((row) => {
      stockByItem.set(row.item_id, (stockByItem.get(row.item_id) ?? 0) + stockSignedQuantity(row));
    });
    const lowStockItems = ((inventoryRes.data ?? []) as InventoryItem[]).filter((item) => {
      if (item.reorder_level === null) return false;
      return (stockByItem.get(item.id) ?? 0) <= item.reorder_level;
    });

    const dailyMap = new Map<string, { date: string; deaths: number; eggs: number; feedKg: number }>();
    dailyRows.forEach((row) => {
      const current = dailyMap.get(row.record_date) ?? { date: row.record_date, deaths: 0, eggs: 0, feedKg: 0 };
      current.deaths += row.deaths ?? 0;
      current.eggs += row.total_eggs ?? 0;
      current.feedKg += (row.feed_intake_grams ?? 0) / 1000;
      dailyMap.set(row.record_date, current);
    });

    const comparisonMap = new Map<
      string,
      {
        id: string;
        label: string;
        farm: string;
        house: string;
        liveBirds: number;
        deaths: number;
        eggs: number;
        feedKg: number;
        productionRate: number;
        mortalityRate: number;
      }
    >();
    scopedFlocks.forEach((flock) => {
      comparisonMap.set(flock.id, {
        id: flock.id,
        label: flock.flock_code,
        farm: farmById.get(flock.farm_id)?.name ?? "Unknown farm",
        house: houseById.get(flock.house_id)?.name ?? "Unknown house",
        liveBirds: flock.current_count ?? 0,
        deaths: 0,
        eggs: 0,
        feedKg: 0,
        productionRate: 0,
        mortalityRate: 0,
      });
    });
    dailyRows.forEach((row) => {
      const current = comparisonMap.get(row.flock_id);
      if (!current) return;
      current.deaths += row.deaths ?? 0;
      current.eggs += row.total_eggs ?? 0;
      current.feedKg += (row.feed_intake_grams ?? 0) / 1000;
    });
    comparisonMap.forEach((item) => {
      item.productionRate = pct(item.eggs, item.liveBirds);
      item.mortalityRate = pct(item.deaths, item.liveBirds + item.deaths);
      item.feedKg = round(item.feedKg);
    });

    const causeMap = new Map<string, number>();
    const feedTypeMap = new Map<string, number>();
    dailyRows.forEach((row) => {
      if (row.deaths_cause && (row.deaths ?? 0) > 0) {
        causeMap.set(row.deaths_cause, (causeMap.get(row.deaths_cause) ?? 0) + (row.deaths ?? 0));
      }
      if (row.feed_type) {
        const label = feedTypeLabels[row.feed_type] ?? row.feed_type;
        feedTypeMap.set(label, (feedTypeMap.get(label) ?? 0) + 1);
      }
    });

    const latestByFlock = new Map<string, DailyRow>();
    [...dailyRows].reverse().forEach((row) => {
      if (!latestByFlock.has(row.flock_id)) latestByFlock.set(row.flock_id, row);
    });

    const recentRecords = [...dailyRows]
      .sort((a, b) => (a.record_date < b.record_date ? 1 : -1))
      .slice(0, 8)
      .map((row) => {
        const flock = scopedFlocks.find((item) => item.id === row.flock_id);
        return {
          id: row.id,
          date: row.record_date,
          flock: flock?.flock_code ?? row.flock_id,
          farm: flock ? farmById.get(flock.farm_id)?.name ?? "-" : "-",
          age: `${row.flock_age_weeks ?? "-"}w ${row.flock_age_days ?? "-"}d`,
          deaths: row.deaths ?? 0,
          eggs: row.total_eggs ?? 0,
          productionRate: row.production_percentage ?? 0,
          mortalityRate: row.mortality_percentage ?? 0,
          vaccinationStatus: row.vaccination_status ?? "-",
          treatment: row.medication_vitamins ?? "-",
        };
      });

    const alerts = [
      ...lowStockItems.slice(0, 4).map((item) => ({
        title: `Low stock: ${item.name}`,
        severity: "high" as const,
        route: "/app/inventory",
      })),
      ...(mortalityRate >= 3
        ? [
            {
              title: `Mortality rate is ${mortalityRate}% in this period`,
              severity: "high" as const,
              route: "/app/daily-records",
            },
          ]
        : []),
      ...(productionRate > 0 && productionRate < 60
        ? [
            {
              title: `Production rate is below target at ${productionRate}%`,
              severity: "medium" as const,
              route: "/app/daily-records",
            },
          ]
        : []),
    ];

    return new Response(
      JSON.stringify({
        filters: { dateFrom, dateTo, branchId, farmId, houseId, flockId, batchId },
        general: {
          liveBirds,
          activeFlocks: activeFlocks.length,
          activeFarms,
          activeHouses,
          mortalityRate,
          productionRate,
          eggs: { total: totalEggs, normal: normalEggs, broken: brokenEggs },
          feed: { grams: feedGrams, kg: feedKg, quantity: feedQuantity, leftoverGrams: feedLeftoverGrams },
          lowStockCount: lowStockItems.length,
          upcomingVaccinations: (vaccinationsRes.data ?? []).filter((event) => scopedFlockIds.includes(event.flock_id)).length,
          feedCostPerEgg,
          costPerBird,
          costInputsAvailable,
          profitPerFlock: null,
          profitBlockedReason: "Sales data collection not yet defined",
        },
        operational: {
          feedPerBirdGrams: liveBirds > 0 ? round(feedGrams / liveBirds) : 0,
          feedLeftoverGrams,
          dailyDeaths: deaths,
          latestFlockAges: Array.from(latestByFlock.entries()).map(([id, row]) => ({
            flock: comparisonMap.get(id)?.label ?? id,
            weeks: row.flock_age_weeks,
            days: row.flock_age_days,
          })),
        },
        charts: {
          trends: Array.from(dailyMap.values()).map((item) => ({ ...item, feedKg: round(item.feedKg) })),
          flockComparison: Array.from(comparisonMap.values())
            .sort((a, b) => b.eggs + b.deaths + b.feedKg - (a.eggs + a.deaths + a.feedKg))
            .slice(0, 8),
          eggQuality: [
            { label: "Normal", value: normalEggs },
            { label: "Broken", value: brokenEggs },
          ],
          mortalityCauses: Array.from(causeMap.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6),
          feedTypes: Array.from(feedTypeMap.entries()).map(([label, value]) => ({ label, value })),
        },
        recentRecords,
        alerts,
        placeholders: [
          { label: "Profit Per Flock", value: null, note: "Sales data collection not yet defined." },
        ],
      }),
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
