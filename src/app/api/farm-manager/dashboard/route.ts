import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import {
  addDays,
  authorizedFarmIds,
  buildFlockComparison,
  percent,
  round,
  summarizeDaily,
  type BreedTarget,
  type FarmManagerDashboardResponse,
  type FlockComparison,
  type FlockType,
  type ManagerAction,
  type ManagerDailyRow,
  type WeightSample,
} from "@/lib/farm-manager-dashboard";
import { createClient as createAuthedClient } from "@/utils/supabase/server";

type DbError = { message: string } | null;
type Row = Record<string, unknown>;

const json = (value: unknown, status = 200) => Response.json(value, { status });

async function allRows<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: DbError }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await load(from, from + 999);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

function addisDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function severityRank(value: ManagerAction["severity"]) {
  return { high: 4, medium: 3, pending: 2, low: 1 }[value];
}

function emptyResponse(asOf: string, scopeLabel: string): FarmManagerDashboardResponse {
  return {
    meta: { asOf, timezone: "Africa/Addis_Ababa", refreshedAt: new Date().toISOString(), scopeLabel, trailingFrom: addDays(asOf, -6), baselineFrom: addDays(asOf, -7), targetCoveragePct: 0, latestRecordAt: null },
    summary: { liveBirds: 0, activeFlocks: 0, todayEggs: null, marketableEggs: null, feedPerBirdGrams: null, mortalityRate: null, recordsComplete: 0, recordsExpected: 0, feedDaysClosed: 0, feedDaysExpected: 0 },
    farmGroups: [], trends: [], actions: [],
    operationalCosts: { feedCost7d: null, feedCostPerEgg: null, feedCostPerGrowingBirdDay: null, lowStockCount: 0, confidence: "unavailable" },
    dataTrust: { recordCoveragePct: 0, feedClosurePct: 0, targetCoveragePct: 0, notes: ["No active flocks are available in this scope."] },
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await createAuthedClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return json({ error: "Supabase server configuration is missing." }, 500);
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: profile } = await admin.from("profiles").select("org_id,role").eq("id", user.id).maybeSingle();
    if (!profile?.org_id || String(profile.role) !== "farm_manager") return json({ error: "Farm manager access required." }, 403);
    const orgId = profile.org_id;

    const [farms, houses, flocks, branchAccess, farmAccess] = await Promise.all([
      allRows<Row>((a, b) => admin.from("farms").select("id,name,branch_id").eq("org_id", orgId).range(a, b)),
      allRows<Row>((a, b) => admin.from("houses").select("id,name,farm_id").eq("org_id", orgId).range(a, b)),
      allRows<Row>((a, b) => admin.from("flocks").select("id,flock_code,flock_type,farm_id,house_id,batch_id,current_count,status,placement_date,age_at_placement_days,breed_id").eq("org_id", orgId).range(a, b)),
      allRows<{ branch_id: string }>((a, b) => admin.from("user_branch_access").select("branch_id").eq("profile_id", user.id).range(a, b)),
      allRows<{ farm_id: string }>((a, b) => admin.from("user_farm_access").select("farm_id").eq("profile_id", user.id).range(a, b)),
    ]);

    const permittedFarmIds = authorizedFarmIds(
      farms.map((row) => ({ id: String(row.id), branch_id: String(row.branch_id) })),
      branchAccess.map((row) => row.branch_id), farmAccess.map((row) => row.farm_id)
    );
    const p = request.nextUrl.searchParams;
    const requestedFarm = p.get("farm_id") ?? "";
    const requestedHouse = p.get("house_id") ?? "";
    const requestedFlock = p.get("flock_id") ?? "";
    const requestedBatch = p.get("batch_id") ?? "";
    if (requestedFarm && !permittedFarmIds.has(requestedFarm)) return json({ error: "The selected farm is outside your assigned scope." }, 403);

    const asOfParam = p.get("as_of") ?? "";
    const today = addisDate();
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfParam) && asOfParam <= today ? asOfParam : today;
    const farmById = new Map(farms.filter((row) => permittedFarmIds.has(String(row.id))).map((row) => [String(row.id), row]));
    const houseById = new Map(houses.map((row) => [String(row.id), row]));
    const activeFlocks = flocks.filter((row) => {
      if (String(row.status) !== "active" || !permittedFarmIds.has(String(row.farm_id))) return false;
      if (requestedFarm && String(row.farm_id) !== requestedFarm) return false;
      if (requestedHouse && String(row.house_id) !== requestedHouse) return false;
      if (requestedFlock && String(row.id) !== requestedFlock) return false;
      if (requestedBatch && String(row.batch_id ?? "") !== requestedBatch) return false;
      return true;
    });
    const scopeLabel = requestedFarm ? String(farmById.get(requestedFarm)?.name ?? "Selected farm") : farmById.size === 1 ? String([...farmById.values()][0]?.name ?? "Assigned farm") : `${farmById.size} assigned farms`;
    if (!activeFlocks.length) return json(emptyResponse(asOf, scopeLabel));

    const flockIds = activeFlocks.map((row) => String(row.id));
    const breedIds = [...new Set(activeFlocks.map((row) => String(row.breed_id ?? "")).filter(Boolean))];
    const from = addDays(asOf, -7);
    const yesterday = addDays(asOf, -1);
    const next14 = addDays(asOf, 14);

    const [dailyRows, closures, standards, weights, settingsRes, inventoryItems, stockRows, vaccinations, weightTasks] = await Promise.all([
      allRows<ManagerDailyRow>((a, b) => admin.from("daily_farm_records").select("record_date,flock_id,opening_birds,closing_birds,deaths,total_eggs,normal_eggs,broken_eggs,dirty_eggs,feed_intake_grams,updated_at").eq("org_id", orgId).in("flock_id", flockIds).gte("record_date", from).lte("record_date", asOf).range(a, b)),
      allRows<Row>((a, b) => admin.from("feed_day_closures").select("flock_id,record_date,status").eq("org_id", orgId).in("flock_id", flockIds).gte("record_date", yesterday).lte("record_date", asOf).range(a, b)),
      breedIds.length ? allRows<Row>((a, b) => admin.from("breed_standards").select("breed_id,week_number,target_hdep_pct,target_mortality_pct,target_feed_g,target_weight_g").eq("org_id", orgId).in("breed_id", breedIds).range(a, b)) : Promise.resolve([]),
      allRows<Row>((a, b) => admin.from("weight_records").select("flock_id,record_date,average_weight_g,uniformity_pct").eq("org_id", orgId).in("flock_id", flockIds).lte("record_date", asOf).order("record_date", { ascending: false }).range(a, b)),
      admin.from("feed_control_settings").select("warning_variance_pct,critical_variance_pct").eq("org_id", orgId).maybeSingle(),
      allRows<Row>((a, b) => admin.from("inventory_items").select("id,name,category,reorder_level,unit").eq("org_id", orgId).range(a, b)),
      allRows<Row>((a, b) => admin.from("stock_ledger").select("item_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,flock_id").eq("org_id", orgId).range(a, b)),
      allRows<Row>((a, b) => admin.from("vaccination_events").select("id,event_date,flock_id,vaccine_name").eq("org_id", orgId).in("flock_id", flockIds).gte("event_date", asOf).lte("event_date", next14).range(a, b)),
      allRows<Row>((a, b) => admin.from("batch_weight_check_tasks").select("id,flock_id,due_date,status").eq("org_id", orgId).in("flock_id", flockIds).neq("status", "completed").lte("due_date", next14).range(a, b)),
    ]);

    const closureKeys = new Set(closures.filter((row) => row.status === "closed").map((row) => `${row.flock_id}:${row.record_date}`));
    const settings = settingsRes.data;
    const warningVariancePct = Number(settings?.warning_variance_pct ?? 5);
    const criticalVariancePct = Number(settings?.critical_variance_pct ?? 10);
    const standardsByBreed = new Map<string, BreedTarget[]>();
    for (const row of standards) {
      const key = String(row.breed_id);
      const current = standardsByBreed.get(key) ?? [];
      current.push({ week_number: Number(row.week_number), target_hdep_pct: row.target_hdep_pct === null ? null : Number(row.target_hdep_pct), target_mortality_pct: row.target_mortality_pct === null ? null : Number(row.target_mortality_pct), target_feed_g: row.target_feed_g === null ? null : Number(row.target_feed_g), target_weight_g: row.target_weight_g === null ? null : Number(row.target_weight_g) });
      standardsByBreed.set(key, current);
    }
    const weightsByFlock = new Map<string, WeightSample[]>();
    for (const row of weights) {
      const key = String(row.flock_id); const current = weightsByFlock.get(key) ?? [];
      current.push({ record_date: String(row.record_date), average_weight_g: row.average_weight_g === null ? null : Number(row.average_weight_g), uniformity_pct: row.uniformity_pct === null ? null : Number(row.uniformity_pct) });
      weightsByFlock.set(key, current);
    }
    const dailyByFlock = new Map<string, ManagerDailyRow[]>();
    for (const row of dailyRows) { const current = dailyByFlock.get(row.flock_id) ?? []; current.push(row); dailyByFlock.set(row.flock_id, current); }

    const comparisons: FlockComparison[] = activeFlocks.map((row) => {
      const id = String(row.id); const farm = farmById.get(String(row.farm_id)); const house = houseById.get(String(row.house_id));
      return buildFlockComparison({
        flock: { id, code: String(row.flock_code), type: String(row.flock_type) as FlockType, farmId: String(row.farm_id), farmName: String(farm?.name ?? "Unknown farm"), houseId: String(row.house_id), houseName: String(house?.name ?? "Unknown house"), placementDate: String(row.placement_date), ageAtPlacementDays: row.age_at_placement_days === null ? null : Number(row.age_at_placement_days), liveBirds: Number(row.current_count ?? 0) },
        asOf, dailyRows: dailyByFlock.get(id) ?? [], targets: standardsByBreed.get(String(row.breed_id ?? "")) ?? [],
        weights: weightsByFlock.get(id) ?? [], feedClosed: closureKeys.has(`${id}:${asOf}`), warningVariancePct, criticalVariancePct,
      });
    });
    comparisons.sort((a, b) => b.attentionScore - a.attentionScore || a.code.localeCompare(b.code));

    const todayRows = dailyRows.filter((row) => row.record_date === asOf);
    const todaySummary = summarizeDaily(todayRows);
    const recordsComplete = new Set(todayRows.map((row) => row.flock_id)).size;
    const feedDaysClosed = activeFlocks.filter((row) => closureKeys.has(`${row.id}:${asOf}`)).length;
    const normalValues = todayRows.filter((row) => row.normal_eggs !== null);
    const farmGroups = [...new Set(comparisons.map((row) => row.farmId))].map((farmId) => {
      const group = comparisons.filter((row) => row.farmId === farmId);
      const groupRecords = group.filter((row) => row.hasTodayRecord).length;
      const groupClosed = group.filter((row) => row.feedClosed).length;
      return { id: farmId, name: group[0]?.farmName ?? "Unknown farm", liveBirds: group.reduce((sum, row) => sum + row.liveBirds, 0), recordCoveragePct: percent(groupRecords, group.length) ?? 0, feedClosurePct: percent(groupClosed, group.length) ?? 0, attentionCount: group.filter((row) => row.status === "critical" || row.status === "watch").length, flocks: group };
    }).sort((a, b) => b.attentionCount - a.attentionCount || a.name.localeCompare(b.name));

    const trends = Array.from({ length: 7 }, (_, index) => addDays(asOf, index - 6)).map((date) => {
      const rows = dailyRows.filter((row) => row.record_date === date);
      const layerIds = new Set(activeFlocks.filter((row) => ["layer", "parent_stock"].includes(String(row.flock_type))).map((row) => String(row.id)));
      const layerSummary = summarizeDaily(rows.filter((row) => layerIds.has(row.flock_id)));
      const allSummary = summarizeDaily(rows);
      return { date, eggs: layerSummary.eggs, hdep: layerSummary.hdep, feedPerBirdGrams: allSummary.feedPerBirdGrams, mortality: allSummary.mortality };
    });

    const actions: ManagerAction[] = [];
    for (const comparison of comparisons) {
      if (!comparison.hasTodayRecord) actions.push({ id: `record:${comparison.id}`, severity: "pending", title: `Complete ${comparison.code} Daily Record`, context: `${comparison.farmName} · ${comparison.houseName}`, route: "/app/daily-records", farmName: comparison.farmName, flockCode: comparison.code });
      if (!comparison.feedClosed) actions.push({ id: `feed:${comparison.id}`, severity: "pending", title: `Close ${comparison.code} feeding day`, context: "Today’s feed remains operationally open.", route: "/app/feeding-log", farmName: comparison.farmName, flockCode: comparison.code });
      if (comparison.status === "critical" || comparison.status === "watch") actions.push({ id: `performance:${comparison.id}`, severity: comparison.status === "critical" ? "high" : "medium", title: comparison.nextAction, context: `${comparison.code} · ${comparison.metricLabel} ${comparison.actual ?? "unavailable"}${comparison.unit}`, route: comparison.actionRoute, farmName: comparison.farmName, flockCode: comparison.code });
      const placedBeforeYesterday = String(activeFlocks.find((row) => String(row.id) === comparison.id)?.placement_date ?? asOf) <= yesterday;
      if (placedBeforeYesterday && !(dailyByFlock.get(comparison.id) ?? []).some((row) => row.record_date === yesterday)) actions.push({ id: `overdue-record:${comparison.id}`, severity: "high", title: `Yesterday’s ${comparison.code} record is missing`, context: "Complete the overdue flock-day record before relying on trends.", route: "/app/daily-records", farmName: comparison.farmName, flockCode: comparison.code });
      if (placedBeforeYesterday && !closureKeys.has(`${comparison.id}:${yesterday}`)) actions.push({ id: `overdue-feed:${comparison.id}`, severity: "high", title: `Yesterday’s ${comparison.code} feeding is not closed`, context: "Feed and inventory totals are not finalized.", route: "/app/feeding-log", farmName: comparison.farmName, flockCode: comparison.code });
    }
    for (const row of vaccinations) {
      const comparison = comparisons.find((item) => item.id === String(row.flock_id));
      actions.push({ id: `vaccine:${row.id}`, severity: String(row.event_date) === asOf ? "medium" : "low", title: `${row.vaccine_name} for ${comparison?.code ?? "flock"}`, context: `Due ${row.event_date}`, route: "/app/health", farmName: comparison?.farmName, flockCode: comparison?.code });
    }
    for (const row of weightTasks) {
      const comparison = comparisons.find((item) => item.id === String(row.flock_id));
      actions.push({ id: `weight:${row.id}`, severity: String(row.due_date) < asOf ? "high" : "pending", title: `Weight check for ${comparison?.code ?? "flock"}`, context: `${String(row.due_date) < asOf ? "Overdue" : "Due"} ${row.due_date}`, route: "/app/feeding-log", farmName: comparison?.farmName, flockCode: comparison?.code });
    }

    const scopedFarmIds = new Set(activeFlocks.map((row) => String(row.farm_id)));
    const scopedBranchIds = new Set([...scopedFarmIds].map((id) => String(farmById.get(id)?.branch_id ?? "")));
    const scopedLedger = stockRows.filter((row) => {
      if (row.flock_id && flockIds.includes(String(row.flock_id))) return true;
      if (row.farm_id && scopedFarmIds.has(String(row.farm_id))) return true;
      return Boolean(row.branch_id && scopedBranchIds.has(String(row.branch_id)));
    });
    const balanceByItem = new Map<string, number>();
    for (const row of scopedLedger) {
      const quantity = Number(row.quantity ?? 0); const type = String(row.transaction_type);
      const delta = ["issue", "transfer_out"].includes(type) ? -Math.abs(quantity) : type === "adjustment" ? quantity : Math.abs(quantity);
      balanceByItem.set(String(row.item_id), (balanceByItem.get(String(row.item_id)) ?? 0) + delta);
    }
    const lowStock = inventoryItems.filter((row) => row.reorder_level !== null && (balanceByItem.get(String(row.id)) ?? 0) <= Number(row.reorder_level));
    for (const row of lowStock.slice(0, 5)) actions.push({ id: `stock:${row.id}`, severity: "high", title: `Low stock: ${row.name}`, context: `${round(balanceByItem.get(String(row.id)) ?? 0)} ${row.unit ?? "units"} available in assigned scope.`, route: "/app/inventory" });
    actions.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.title.localeCompare(b.title));

    const feedItemIds = new Set(inventoryItems.filter((row) => row.category === "feed").map((row) => String(row.id)));
    const trailingFrom = addDays(asOf, -6);
    const feedIssues7d = scopedLedger.filter((row) => feedItemIds.has(String(row.item_id)) && ["issue", "transfer_out"].includes(String(row.transaction_type)) && String(row.transaction_date) >= trailingFrom && String(row.transaction_date) <= asOf);
    const feedCost7d = feedIssues7d.length ? round(feedIssues7d.reduce((sum, row) => sum + Number(row.quantity ?? 0) * Number(row.unit_cost ?? 0), 0)) : null;
    const trailingRows = dailyRows.filter((row) => row.record_date >= trailingFrom);
    const layerIds = new Set(activeFlocks.filter((row) => ["layer", "parent_stock"].includes(String(row.flock_type))).map((row) => String(row.id)));
    const growingIds = new Set(activeFlocks.filter((row) => ["broiler", "rearing"].includes(String(row.flock_type))).map((row) => String(row.id)));
    const issueCost = (row: Record<string, unknown>) => Number(row.quantity ?? 0) * Number(row.unit_cost ?? 0);
    const layerFeedIssues = feedIssues7d.filter((row) => layerIds.has(String(row.flock_id ?? "")));
    const growingFeedIssues = feedIssues7d.filter((row) => growingIds.has(String(row.flock_id ?? "")));
    const layerFeedCost7d = layerFeedIssues.length ? layerFeedIssues.reduce((sum, row) => sum + issueCost(row), 0) : null;
    const growingFeedCost7d = growingFeedIssues.length ? growingFeedIssues.reduce((sum, row) => sum + issueCost(row), 0) : null;
    const layerEggs = trailingRows.filter((row) => layerIds.has(row.flock_id)).reduce((sum, row) => sum + (row.total_eggs ?? 0), 0);
    const growingBirdDays = trailingRows.filter((row) => growingIds.has(row.flock_id)).reduce((sum, row) => sum + (row.opening_birds ?? row.closing_birds ?? 0), 0);
    const targetCoveragePct = percent(comparisons.filter((row) => row.targetAvailable).length, comparisons.length) ?? 0;
    const recordCoveragePct = percent(recordsComplete, activeFlocks.length) ?? 0;
    const feedClosurePct = percent(feedDaysClosed, activeFlocks.length) ?? 0;
    const notes = [
      ...(recordsComplete < activeFlocks.length ? [`${activeFlocks.length - recordsComplete} flock(s) still need today’s Daily Record.`] : []),
      ...(feedDaysClosed < activeFlocks.length ? [`${activeFlocks.length - feedDaysClosed} feeding day(s) are still open.`] : []),
      ...(targetCoveragePct < 100 ? [`Breed/age targets are available for ${targetCoveragePct}% of active flocks.`] : []),
    ];

    const response: FarmManagerDashboardResponse = {
      meta: { asOf, timezone: "Africa/Addis_Ababa", refreshedAt: new Date().toISOString(), scopeLabel, trailingFrom, baselineFrom: from, targetCoveragePct, latestRecordAt: dailyRows.map((row) => row.updated_at).sort().at(-1) ?? null },
      summary: { liveBirds: comparisons.reduce((sum, row) => sum + row.liveBirds, 0), activeFlocks: comparisons.length, todayEggs: todaySummary.eggs, marketableEggs: normalValues.length ? normalValues.reduce((sum, row) => sum + (row.normal_eggs ?? 0), 0) : null, feedPerBirdGrams: todaySummary.feedPerBirdGrams, mortalityRate: todaySummary.mortality, recordsComplete, recordsExpected: activeFlocks.length, feedDaysClosed, feedDaysExpected: activeFlocks.length },
      farmGroups, trends, actions: actions.slice(0, 30),
      operationalCosts: { feedCost7d, feedCostPerEgg: layerFeedCost7d !== null && layerEggs > 0 ? round(layerFeedCost7d / layerEggs, 4) : null, feedCostPerGrowingBirdDay: growingFeedCost7d !== null && growingBirdDays > 0 ? round(growingFeedCost7d / growingBirdDays, 4) : null, lowStockCount: lowStock.length, confidence: feedCost7d !== null ? "actual" : "unavailable" },
      dataTrust: { recordCoveragePct, feedClosurePct, targetCoveragePct, notes: notes.length ? notes : ["Today’s operational data is complete for the selected scope."] },
    };
    return json(response);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Could not load the Farm Manager dashboard." }, 500);
  }
}
