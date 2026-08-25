import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

export type CurrentAlert = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  source: "Alert Rule" | "Inventory" | "Mortality" | "Daily Records" | "Health" | "Production" | "Reconciliation" | "Governance";
  context: string;
  route: string;
  createdAt: string;
};

type InventoryItem = Pick<
  Database["public"]["Tables"]["inventory_items"]["Row"],
  "id" | "name" | "reorder_level" | "updated_at"
>;

type StockLedgerRow = Pick<
  Database["public"]["Tables"]["stock_ledger"]["Row"],
  "item_id" | "quantity" | "transaction_type"
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
      .select("id, name, reorder_level, updated_at")
      .eq("org_id", orgId)
      .limit(500),
    supabaseAdmin
      .from("stock_ledger")
      .select("item_id, quantity, transaction_type")
      .eq("org_id", orgId)
      .limit(5000),
    supabaseAdmin
      .from("mortality_events")
      .select("record_date, count")
      .eq("org_id", orgId)
      .gte("record_date", sevenDaysAgo),
    supabaseAdmin
      .from("daily_farm_records")
      .select("id")
      .eq("org_id", orgId)
      .eq("record_date", today)
      .limit(1),
    supabaseAdmin
      .from("daily_farm_records")
      .select("record_date, deaths, total_eggs, flock_id, created_at")
      .eq("org_id", orgId)
      .gte("record_date", thirtyDaysAgo)
      .lte("record_date", today)
      .limit(2000),
    supabaseAdmin
      .from("flocks")
      .select("id, current_count, status")
      .eq("org_id", orgId),
    supabaseAdmin
      .from("health_events")
      .select("id, event_date, description, diagnosis")
      .eq("org_id", orgId)
      .like("description", "SCHEDULE_STATUS|%|missed|%")
      .order("event_date", { ascending: false })
      .limit(20),
  ]);

  const alerts: CurrentAlert[] = [];

  (openAlertsRes.data ?? []).forEach((row) => {
    alerts.push({
      id: `db-${row.id}`,
      title: row.message,
      severity: toSeverity(row.priority),
      source: "Alert Rule",
      context: `${row.category} alert${row.triggered_value === null ? "" : `, value ${row.triggered_value}`}`,
      route: row.category === "inventory" ? "/app/inventory" : row.category === "health" ? "/app/health" : "/app/ceo",
      createdAt: row.triggered_at ?? row.created_at,
    });
  });

  const inventoryItems = (inventoryRes.data ?? []) as InventoryItem[];
  const stockRows = (ledgerRes.data ?? []) as StockLedgerRow[];
  const stockByItem = new Map<string, number>();
  stockRows.forEach((row) => {
    stockByItem.set(row.item_id, (stockByItem.get(row.item_id) ?? 0) + stockSignedQuantity(row));
  });

  inventoryItems
    .filter((item) => item.reorder_level !== null && (stockByItem.get(item.id) ?? 0) <= item.reorder_level)
    .slice(0, 8)
    .forEach((item) => {
      const available = stockByItem.get(item.id) ?? 0;
      alerts.push({
        id: `inv-${item.id}`,
        title: `Low inventory: ${item.name}`,
        severity: "high",
        source: "Inventory",
        context: `${available.toLocaleString()} on hand, reorder at ${item.reorder_level}`,
        route: "/app/inventory",
        createdAt: item.updated_at,
      });
    });

  const recentMortality = (mortalityRes.data ?? []).reduce((acc, row) => acc + (row.count ?? 0), 0);
  if (recentMortality >= 20) {
    alerts.push({
      id: "mortality-spike",
      title: `High mortality spike detected (${recentMortality} in last 7 days)`,
      severity: "high",
      source: "Mortality",
      context: `${sevenDaysAgo} to ${today}`,
      route: "/app/mortality",
      createdAt: now.toISOString(),
    });
  }

  if ((dailyTodayRes.data ?? []).length === 0) {
    alerts.push({
      id: "daily-missing",
      title: "Daily records missing for today",
      severity: "medium",
      source: "Daily Records",
      context: `No daily_farm_records entry found for ${today}`,
      route: "/app/daily-records",
      createdAt: now.toISOString(),
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

  const missedSchedules = scheduleMissRes.data ?? [];
  if (missedSchedules.length > 0) {
    alerts.push({
      id: "schedule-missed",
      title: `${missedSchedules.length} missed schedule alert(s)`,
      severity: "medium",
      source: "Health",
      context: "Health schedule status entries marked missed",
      route: "/app/health",
      createdAt: missedSchedules[0].event_date,
    });
  }

  const unique = new Map<string, CurrentAlert>();
  alerts.forEach((alert) => {
    if (!unique.has(alert.id)) unique.set(alert.id, alert);
  });

  return Array.from(unique.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
