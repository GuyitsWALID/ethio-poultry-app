import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import type { OperationalAlert } from "@/lib/action-desk-contract";

export type CurrentAlert = OperationalAlert;

type InventoryItem = Pick<
  Database["public"]["Tables"]["inventory_items"]["Row"],
  "id" | "name" | "unit" | "reorder_level" | "updated_at"
>;

type StockLedgerRow = Pick<
  Database["public"]["Tables"]["stock_ledger"]["Row"],
  "item_id" | "warehouse_id" | "quantity" | "transaction_type"
>;

type DailyRow = Pick<
  Database["public"]["Tables"]["daily_farm_records"]["Row"],
  "record_date" | "deaths" | "total_eggs" | "flock_id" | "created_at"
>;

function stockSignedQuantity(row: StockLedgerRow) {
  return row.transaction_type === "issue" || row.transaction_type === "transfer_out"
    ? -row.quantity
    : row.quantity;
}

function pct(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function toSeverity(priority: string | null | undefined): CurrentAlert["severity"] {
  if (priority === "high" || priority === "emergency") return "high";
  if (priority === "medium") return "medium";
  return "low";
}

export async function getCurrentAlerts(
  supabaseAdmin: SupabaseClient<Database>,
  orgId: string
): Promise<CurrentAlert[]> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    openAlertsRes,
    inventoryRes,
    ledgerRes,
    mortalityRes,
    dailyTodayRes,
    dailyPeriodRes,
    flocksRes,
    scheduleMissRes,
    warehousesRes,
  ] = await Promise.all([
    supabaseAdmin
      .from("alerts")
      .select("id, message, priority, category, created_at, triggered_at, triggered_value")
      .eq("org_id", orgId)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("inventory_items")
      .select("id, name, unit, reorder_level, updated_at")
      .eq("org_id", orgId)
      .limit(500),
    supabaseAdmin
      .from("stock_ledger")
      .select("item_id, warehouse_id, quantity, transaction_type")
      .eq("org_id", orgId)
      .limit(5000),
    supabaseAdmin
      .from("mortality_events")
      .select("flock_id, record_date, count")
      .eq("org_id", orgId)
      .gte("record_date", sevenDaysAgo)
      .lte("record_date", today),
    supabaseAdmin
      .from("daily_farm_records")
      .select("flock_id")
      .eq("org_id", orgId)
      .eq("record_date", today)
      .limit(2000),
    supabaseAdmin
      .from("daily_farm_records")
      .select("record_date, deaths, total_eggs, flock_id, created_at")
      .eq("org_id", orgId)
      .gte("record_date", thirtyDaysAgo)
      .lte("record_date", today)
      .limit(2000),
    supabaseAdmin
      .from("flocks")
      .select("id, farm_id, house_id, flock_code, current_count, status, placement_date, completed_at")
      .eq("org_id", orgId),
    supabaseAdmin
      .from("health_events")
      .select("id, flock_id, event_date, description, diagnosis, created_at")
      .eq("org_id", orgId)
      .is("voided_at", null)
      .lte("event_date", today)
      .like("description", "SCHEDULE_STATUS|%")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(2000),
    supabaseAdmin.from("warehouses").select("id,name,farm_id").eq("org_id", orgId).eq("status", "active").limit(500),
  ]);

  // A failed read is not evidence that a warning disappeared.
  if ([openAlertsRes, inventoryRes, ledgerRes, mortalityRes, dailyTodayRes, dailyPeriodRes, flocksRes, scheduleMissRes, warehousesRes].some(result => result.error)) {
    throw new Error("Operational warnings could not be checked. Refresh and try again.");
  }

  const alerts: CurrentAlert[] = [];

  (openAlertsRes.data ?? []).forEach((row) => {
    alerts.push({
      id: `db-${row.id}`,
      title: row.message,
      severity: toSeverity(row.priority),
      source: "Alert Rule",
      context: `${row.category} alert${row.triggered_value === null ? "" : `, value ${row.triggered_value}`}`,
      // Legacy rule rows have no trustworthy farm/store target. Keep them
      // CEO-only; neither their text nor assigned_to proves source access.
      route: "/app/alerts",
      createdAt: row.triggered_at ?? row.created_at,
    });
  });

  const inventoryItems = (inventoryRes.data ?? []) as InventoryItem[];
  const stockRows = (ledgerRes.data ?? []) as StockLedgerRow[];
  for (const warehouse of warehousesRes.data ?? []) {
    const stockByItem = new Map<string, number>();
    stockRows.filter(row => row.warehouse_id === warehouse.id).forEach(row => {
      stockByItem.set(row.item_id, (stockByItem.get(row.item_id) ?? 0) + stockSignedQuantity(row));
    });
    // No ledger evidence for an item in a store means unknown/not stocked,
    // not a shortage for every item in the organization's catalogue.
    inventoryItems.filter(item => item.reorder_level !== null && stockByItem.has(item.id)
      && stockByItem.get(item.id)! <= item.reorder_level).forEach(item => {
      const available = stockByItem.get(item.id)!;
      alerts.push({
        id: `inv-${warehouse.id}-${item.id}`,
        title: `Low inventory: ${item.name}`,
        severity: "high",
        source: "Inventory",
        context: `${warehouse.name}: ${available.toLocaleString()} ${item.unit} on hand, reorder at ${item.reorder_level}`,
        farmId: warehouse.farm_id,
        warehouseId: warehouse.id,
        route: `/app/inventory?filter_page_warehouseId=${encodeURIComponent(warehouse.id)}`,
        createdAt: item.updated_at,
      });
    });
  }

  const recorded = new Set((dailyTodayRes.data ?? []).map(row => row.flock_id));
  const scheduleStates = new Map<string, (NonNullable<typeof scheduleMissRes.data>)[number]>();
  for (const row of scheduleMissRes.data ?? []) {
    const match = /^SCHEDULE_STATUS\|([^|]+)\|(missed|completed)\|/.exec(row.description ?? "");
    if (match && !scheduleStates.has(`${row.flock_id}:${match[1]}`)) scheduleStates.set(`${row.flock_id}:${match[1]}`, row);
  }
  for (const flock of flocksRes.data ?? []) {
  const params = new URLSearchParams({filter_farmId: flock.farm_id, filter_houseId: flock.house_id, filter_flockId: flock.id});
  const recentMortality = (mortalityRes.data ?? []).filter(row => row.flock_id === flock.id).reduce((acc, row) => acc + (row.count ?? 0), 0);
  if (recentMortality >= 20) {
    alerts.push({
      id: `mortality-spike-${flock.id}`,
      title: `High mortality: ${flock.flock_code} (${recentMortality} in last 7 days)`,
      severity: "high",
      source: "Mortality",
      context: `${sevenDaysAgo} to ${today}`,
      farmId: flock.farm_id,
      route: `/app/mortality?${params}`,
      createdAt: now.toISOString(),
    });
  }

  const operatesToday = flock.placement_date <= today && (
    (["active", "quarantined"].includes(flock.status) && !flock.completed_at) ||
    (flock.completed_at !== null && Date.parse(flock.completed_at) >= Date.parse(`${today}T00:00:00+03:00`))
  );
  if (operatesToday && !recorded.has(flock.id)) {
    alerts.push({
      id: `daily-missing-${flock.id}-${today}`,
      title: `Daily record missing: ${flock.flock_code}`,
      severity: "medium",
      source: "Daily Records",
      context: `No daily record for ${flock.flock_code} on ${today}`,
      farmId: flock.farm_id,
      route: `/app/daily-records?${params}&filter_page_filterDate=${today}`,
      createdAt: now.toISOString(),
    });
  }

  const missedSchedules = [...scheduleStates.values()].filter(row => row.flock_id === flock.id && row.description?.split("|")[2] === "missed");
  if (missedSchedules.length > 0) alerts.push({
    id: `schedule-missed-${flock.id}`,
    title: `Missed health schedule: ${flock.flock_code}`,
    severity: "medium", source: "Health", farmId: flock.farm_id,
    context: `${missedSchedules.length} missed schedule record(s) for ${flock.flock_code}`,
    route: `/app/health?${new URLSearchParams({filter_page_healthFarmId: flock.farm_id, filter_page_healthHouseId: flock.house_id, filter_page_healthFlockId: flock.id})}`,
    createdAt: missedSchedules[0].event_date,
  });
  }

  const dailyRows = (dailyPeriodRes.data ?? []) as DailyRow[];
  const liveBirds = (flocksRes.data ?? [])
    .filter((flock) => flock.status === "active")
    .reduce((sum, flock) => sum + (flock.current_count ?? 0), 0);
  const deaths = dailyRows.reduce((sum, row) => sum + (row.deaths ?? 0), 0);
  const totalEggs = dailyRows.reduce((sum, row) => sum + (row.total_eggs ?? 0), 0);
  const mortalityRate = pct(deaths, liveBirds + deaths);
  const productionRate = pct(totalEggs, liveBirds);
  const latestDailyAt = dailyRows.at(-1)?.created_at ?? now.toISOString();

  if (mortalityRate >= 3) {
    alerts.push({
      id: "kpi-mortality-rate",
      title: `Mortality rate is ${mortalityRate}% in the last 30 days`,
      severity: "high",
      source: "Mortality",
      context: `${deaths.toLocaleString()} deaths against ${liveBirds.toLocaleString()} live birds`,
      route: "/app/daily-records",
      createdAt: latestDailyAt,
    });
  }

  if (productionRate > 0 && productionRate < 60) {
    alerts.push({
      id: "kpi-production-rate",
      title: `Production rate is below target at ${productionRate}%`,
      severity: "medium",
      source: "Production",
      context: `${totalEggs.toLocaleString()} eggs against ${liveBirds.toLocaleString()} live birds`,
      route: "/app/daily-records",
      createdAt: latestDailyAt,
    });
  }

  const unique = new Map<string, CurrentAlert>();
  alerts.forEach((alert) => {
    if (!unique.has(alert.id)) unique.set(alert.id, alert);
  });

  return Array.from(unique.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
