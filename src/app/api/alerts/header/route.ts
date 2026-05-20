import { createClient } from "@supabase/supabase-js";

import { createClient as createAuthedClient } from "@/utils/supabase/server";
import type { Database } from "@/types/supabase";

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

type HeaderAlert = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
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

export async function GET() {
  try {
    const supabase = await createAuthedClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return new Response(JSON.stringify({ alerts: [] }), { status: 200 });

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.org_id) return new Response(JSON.stringify({ alerts: [] }), { status: 200 });

    const orgId = profile.org_id;
    const alerts: HeaderAlert[] = [];

    const today = new Date().toISOString().slice(0, 10);

    const [openAlertsRes, inventoryRes, ledgerRes, mortalityRes, dailyRes, scheduleMissRes] = await Promise.all([
      supabaseAdmin
        .from("alerts")
        .select("id, message, priority, created_at")
        .eq("org_id", orgId)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(10),
      supabaseAdmin
        .from("inventory_items")
        .select("id, name, reorder_level, updated_at")
        .eq("org_id", orgId)
        .limit(300),
      supabaseAdmin
        .from("stock_ledger")
        .select("item_id, quantity, transaction_type")
        .eq("org_id", orgId)
        .limit(2000),
      supabaseAdmin
        .from("mortality_events")
        .select("record_date, count")
        .eq("org_id", orgId)
        .gte("record_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
      supabaseAdmin
        .from("daily_farm_records")
        .select("record_date")
        .eq("org_id", orgId)
        .eq("record_date", today)
        .limit(1),
      supabaseAdmin
        .from("health_events")
        .select("id, event_date, description, diagnosis")
        .eq("org_id", orgId)
        .like("description", "SCHEDULE_STATUS|%|missed|%")
        .order("event_date", { ascending: false })
        .limit(20),
    ]);

    (openAlertsRes.data ?? []).forEach((row) => {
      alerts.push({
        id: `db-${row.id}`,
        title: row.message,
        severity: row.priority === "high" ? "high" : row.priority === "medium" ? "medium" : "low",
        route: "/app/ceo",
        createdAt: row.created_at,
      });
    });

    const inventoryItems = (inventoryRes.data ?? []) as InventoryItem[];
    const stockRows = (ledgerRes.data ?? []) as StockLedgerRow[];
    const stockByItem = new Map<string, number>();
    stockRows.forEach((row) => {
      const isOut = row.transaction_type === "issue" || row.transaction_type === "transfer_out";
      const signedQty = isOut ? -row.quantity : row.quantity;
      stockByItem.set(row.item_id, (stockByItem.get(row.item_id) ?? 0) + signedQty);
    });

    const lowStockItems = inventoryItems.filter((item) => {
      if (item.reorder_level === null) return false;
      const available = stockByItem.get(item.id) ?? 0;
      return available <= item.reorder_level;
    });
    lowStockItems.slice(0, 3).forEach((item) => {
      alerts.push({
        id: `inv-${item.id}`,
        title: `Low inventory: ${item.name}`,
        severity: "high",
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
        route: "/app/mortality",
        createdAt: new Date().toISOString(),
      });
    }

    if ((dailyRes.data ?? []).length === 0) {
      alerts.push({
        id: "daily-missing",
        title: "Daily records missing for today",
        severity: "medium",
        route: "/app/daily-records",
        createdAt: new Date().toISOString(),
      });
    }

    const missedSchedules = scheduleMissRes.data ?? [];
    if (missedSchedules.length > 0) {
      alerts.push({
        id: "schedule-missed",
        title: `${missedSchedules.length} missed schedule alert(s)`,
        severity: "medium",
        route: "/app/health",
        createdAt: missedSchedules[0].event_date,
      });
    }

    const unique = new Map<string, HeaderAlert>();
    alerts.forEach((alert) => {
      if (!unique.has(alert.id)) unique.set(alert.id, alert);
    });

    const finalAlerts = Array.from(unique.values())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 15);

    return new Response(JSON.stringify({ alerts: finalAlerts }), { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
