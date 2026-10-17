import {allAlertRows} from "./alert-pagination.ts";
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
  "item_id" | "warehouse_id" | "quantity"
>;

type PerformanceWarning = {flock_id: string; farm_id: string; house_id: string; flock_code: string;
  kind: "production" | "mortality"; state: "active" | "clear" | "unavailable";
  severity: "high" | "medium"; actual: number | null; target: number | null;
  date_from: string; date_to: string; evidence_days: number; expected_days: number};

function stockSignedQuantity(row: StockLedgerRow) { return row.quantity; }

export function alertOperatingWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const today = `${value.year}-${value.month}-${value.day}`;
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 6); // Seven inclusive operating dates.
  return {today, sevenDaysAgo: start.toISOString().slice(0, 10)};
}

function toSeverity(priority: string | null | undefined): CurrentAlert["severity"] {
  if (priority === "high" || priority === "emergency") return "high";
  if (priority === "medium") return "medium";
  return "low";
}

export async function getCurrentAlerts(
  supabaseAdmin: SupabaseClient<Database>,
  orgId: string,
  now = new Date(),
): Promise<CurrentAlert[]> {
  const {today, sevenDaysAgo} = alertOperatingWindow(now);

  const [
    openAlertsRes,
    inventoryRes,
    ledgerRes,
    mortalityRes,
    dailyTodayRes,
    performanceRes,
    flocksRes,
    scheduleMissRes,
    warehousesRes,
  ] = await Promise.all([
    allAlertRows((from, to) => supabaseAdmin
      .from("alerts")
      .select("id, message, priority, category, created_at, triggered_at, triggered_value")
      .eq("org_id", orgId)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .order("id").range(from, to)).then(data => ({data, error: null})),
    allAlertRows((from, to) => supabaseAdmin
      .from("inventory_items")
      .select("id, name, unit, reorder_level, updated_at")
      .eq("org_id", orgId)
      .order("id").range(from, to)).then(data => ({data, error: null})),
    allAlertRows((from, to) => supabaseAdmin.rpc("operational_low_stock_balances", {p_org_id: orgId}).order("warehouse_id").order("item_id").range(from, to)).then(data => ({data, error: null})),
    allAlertRows((from, to) => supabaseAdmin
      .from("mortality_events")
      .select("flock_id, record_date, count")
      .eq("org_id", orgId)
      .gte("record_date", sevenDaysAgo)
      .lte("record_date", today).order("id").range(from, to)).then(data => ({data, error: null})),
    allAlertRows((from, to) => supabaseAdmin
      .from("daily_farm_records")
      .select("flock_id")
      .eq("org_id", orgId)
      .is("voided_at", null)
      .eq("record_date", today)
      .order("id").range(from, to)).then(data => ({data, error: null})),
    supabaseAdmin.rpc("operational_performance_warnings", {p_org_id: orgId, p_today: today}),
    allAlertRows((from, to) => supabaseAdmin
      .from("flocks")
      .select("id, farm_id, house_id, flock_code, current_count, status, placement_date, completed_at")
      .eq("org_id", orgId).order("id").range(from, to)).then(data => ({data, error: null})),
    allAlertRows((from, to) => supabaseAdmin
      .from("health_events")
      .select("id, flock_id, event_date, description, diagnosis, created_at")
      .eq("org_id", orgId)
      .is("voided_at", null)
      .lte("event_date", today)
      .like("description", "SCHEDULE_STATUS|%")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)).then(data => ({data, error: null})),
    allAlertRows((from, to) => supabaseAdmin.from("warehouses").select("id,name,farm_id").eq("org_id", orgId).eq("status", "active").order("id").range(from, to)).then(data => ({data, error: null}))
  ]);

  // A failed read is not evidence that a warning disappeared.
  if ([openAlertsRes, inventoryRes, ledgerRes, mortalityRes, dailyTodayRes, performanceRes, flocksRes, scheduleMissRes, warehousesRes].some(result => result.error)) {
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

  if (!Array.isArray(performanceRes.data)) throw new Error("Performance warnings could not be checked.");
  for (const warning of performanceRes.data as unknown as PerformanceWarning[]) {
    if (warning.state !== "active") continue;
    const params = new URLSearchParams({flock: warning.flock_id, details: "1", filter_farmId: warning.farm_id,
      filter_houseId: warning.house_id, filter_flockId: warning.flock_id});
    alerts.push({id: `performance-${warning.kind}-${warning.flock_id}`,
      title: `${warning.kind === "production" ? "Egg production below target" : "Mortality above target"}: ${warning.flock_code}`,
      severity: warning.severity, source: warning.kind === "production" ? "Production" : "Mortality",
      farmId: warning.farm_id, route: `/app/flocks?${params}`,
      context: `${warning.actual}% against ${warning.target}% age-specific target; ${warning.date_from} to ${warning.date_to}. Evidence: ${warning.evidence_days}/${warning.expected_days} days${warning.evidence_days < warning.expected_days ? " (partial coverage)" : ""}. Rates use recorded bird-days.`,
      createdAt: now.toISOString()});
  }

  const unique = new Map<string, CurrentAlert>();
  alerts.forEach((alert) => {
    if (!unique.has(alert.id)) unique.set(alert.id, alert);
  });

  return Array.from(unique.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
