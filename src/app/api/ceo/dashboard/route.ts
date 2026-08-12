import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import { calculateProduction, previousPeriod, round, summarizeSales, type ExecutiveDailyRow } from "@/lib/executive-dashboard";
import { getAccessContext,isAccessResponse } from "@/lib/access-context";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "https://unconfigured.invalid",
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "unconfigured-service-role-key",
  { auth: { autoRefreshToken: false, persistSession: false } }
);
type DbError = { message: string } | null;
async function allRows<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: DbError }>) {
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await load(from, from + 999);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    result.push(...page);
    if (page.length < 1000) return result;
  }
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const addisDate = () => { const parts = new Intl.DateTimeFormat("en", { timeZone:"Africa/Addis_Ababa", year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date()); const value = Object.fromEntries(parts.map(part => [part.type,part.value])); return `${value.year}-${value.month}-${value.day}`; };
const dayDifference = (from: string, to: string) => Math.max(0, Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000));
const statusRank = (status: string) => ({ critical:0, watch:1, data_gap:2, on_track:3 }[status as "critical" | "watch" | "data_gap" | "on_track"] ?? 4);
const matches = (row: { branch_id?: string | null; farm_id?: string | null; house_id?: string | null; flock_id?: string | null; batch_id?: string | null }, scope: Record<string, string>) =>
  (!scope.branch_id || row.branch_id === scope.branch_id) && (!scope.farm_id || row.farm_id === scope.farm_id) && (!scope.house_id || row.house_id === scope.house_id) && (!scope.flock_id || row.flock_id === scope.flock_id) && (!scope.batch_id || row.batch_id === scope.batch_id);

export async function GET(request: NextRequest) {
  try {
    const access=await getAccessContext({tenant:true});if(isAccessResponse(access))return access;if(access.role!=="ceo"&&!access.supportSessionId)return json({error:"Executive access required"},403);const profile={org_id:access.orgId};
    const p = request.nextUrl.searchParams;
    const today = addisDate();
    const dateTo = p.get("date_to") ?? today;
    const dateFrom = p.get("date_from") ?? `${dateTo.slice(0, 8)}01`;
    if (dateFrom > dateTo) return json({ error: "date_from must not be after date_to" }, 400);
    const previous = previousPeriod(dateFrom, dateTo);
    const scope = { branch_id: p.get("branch_id") ?? "", farm_id: p.get("farm_id") ?? "", house_id: p.get("house_id") ?? "", flock_id: p.get("flock_id") ?? "", batch_id: p.get("batch_id") ?? "" };

    const [branches, farms, houses, batches, flocks, daily, priorDaily, liveDaily, feedClosures, sales, priorSales, stock, items, costs, leads, orders, targets, vaccines] = await Promise.all([
      allRows<Record<string, unknown>>((a,b) => admin.from("branches").select("id,name").eq("org_id", profile.org_id).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("farms").select("id,name,branch_id,capacity_birds").eq("org_id", profile.org_id).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("houses").select("id,name,farm_id,branch_id,capacity").eq("org_id", profile.org_id).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("batches").select("id,batch_code,branch_id,farm_id,house_id,placement_date,age_at_placement_days,total_count,source,status").eq("org_id", profile.org_id).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("flocks").select("id,flock_code,flock_type,farm_id,house_id,batch_id,initial_count,current_count,status,breed_id").eq("org_id", profile.org_id).range(a,b)),
      allRows<ExecutiveDailyRow>((a,b) => admin.from("daily_farm_records").select("record_date,flock_id,opening_birds,closing_birds,deaths,total_eggs,normal_eggs,broken_eggs,dirty_eggs,feed_intake_grams,feed_leftover_grams,average_egg_weight_g,water_consumed_liters,updated_at").eq("org_id", profile.org_id).is("voided_at",null).gte("record_date",dateFrom).lte("record_date",dateTo).range(a,b)),
      allRows<ExecutiveDailyRow>((a,b) => admin.from("daily_farm_records").select("record_date,flock_id,opening_birds,closing_birds,deaths,total_eggs,normal_eggs,broken_eggs,dirty_eggs,feed_intake_grams,feed_leftover_grams,average_egg_weight_g,water_consumed_liters,updated_at").eq("org_id", profile.org_id).is("voided_at",null).gte("record_date",previous.dateFrom).lte("record_date",previous.dateTo).range(a,b)),
      allRows<ExecutiveDailyRow>((a,b) => admin.from("daily_farm_records").select("record_date,flock_id,opening_birds,closing_birds,deaths,total_eggs,normal_eggs,broken_eggs,dirty_eggs,feed_intake_grams,feed_leftover_grams,average_egg_weight_g,water_consumed_liters,updated_at").eq("org_id", profile.org_id).is("voided_at",null).eq("record_date",today).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("feed_day_closures").select("flock_id,batch_id,record_date,status").eq("org_id", profile.org_id).eq("record_date",today).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("daily_sales_records").select("sale_date,gross_amount,paid_amount,balance_due,product_category,branch_id,farm_id,house_id,flock_id,batch_id").eq("org_id", profile.org_id).is("voided_at",null).gte("sale_date",dateFrom).lte("sale_date",dateTo).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("daily_sales_records").select("sale_date,gross_amount,paid_amount,balance_due,product_category,branch_id,farm_id,house_id,flock_id,batch_id").eq("org_id", profile.org_id).is("voided_at",null).gte("sale_date",previous.dateFrom).lte("sale_date",previous.dateTo).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("stock_ledger").select("item_id,quantity,transaction_type,unit_cost,transaction_date,branch_id,farm_id,house_id,flock_id,batch_id,expiry_date").eq("org_id",profile.org_id).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("inventory_items").select("id,name,category,reorder_level,unit").eq("org_id",profile.org_id).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("cost_entries").select("amount,entry_date,branch_id,farm_id,house_id,flock_id,batch_id").eq("org_id",profile.org_id).gte("entry_date",dateFrom).lte("entry_date",dateTo).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("leads").select("id,pipeline_stage,last_activity,created_at").eq("org_id",profile.org_id).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("sales_orders").select("id,total,balance_due,status,order_date,created_at").eq("org_id",profile.org_id).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("management_targets").select("scope_type,scope_id,period_month,revenue_target_etb,operating_margin_target_pct,cash_collection_target_pct").eq("org_id",profile.org_id).range(a,b)),
      allRows<Record<string, unknown>>((a,b) => admin.from("vaccination_events").select("id,event_date,flock_id").eq("org_id",profile.org_id).gte("event_date",dateFrom).lte("event_date",dateTo).range(a,b)),
    ]);
    const farmById = new Map(farms.map(row => [String(row.id), row]));
    const branchById = new Map(branches.map(row => [String(row.id), row]));
    const houseById = new Map(houses.map(row => [String(row.id), row]));
    const scopedFlocks = flocks.filter(row => {
      const farm = farmById.get(String(row.farm_id));
      return matches({ branch_id: String(farm?.branch_id ?? ""), farm_id: String(row.farm_id), house_id: String(row.house_id), flock_id: String(row.id), batch_id: String(row.batch_id ?? "") }, scope);
    });
    const flockIds = new Set(scopedFlocks.map(row => String(row.id)));
    const currentDaily = daily.filter(row => flockIds.has(row.flock_id));
    const comparisonDaily = priorDaily.filter(row => flockIds.has(row.flock_id));
    const production = calculateProduction(currentDaily);
    const priorProduction = calculateProduction(comparisonDaily);
    const scopedSales = sales.filter(row => matches(row as never, scope));
    const scopedPriorSales = priorSales.filter(row => matches(row as never, scope));
    const financials = summarizeSales(scopedSales as never);
    const priorFinancials = summarizeSales(scopedPriorSales as never);
    const scopedStock = stock.filter(row => matches(row as never, scope));
    const periodStockCost = scopedStock.filter(row => String(row.transaction_date) >= dateFrom && String(row.transaction_date) <= dateTo && ["issue","transfer_out"].includes(String(row.transaction_type))).reduce((sum,row) => sum + Number(row.quantity ?? 0) * Number(row.unit_cost ?? 0), 0);
    const manualCost = costs.filter(row => matches(row as never, scope)).reduce((sum,row) => sum + Number(row.amount ?? 0), 0);
    const estimatedCost = round(periodStockCost + manualCost);
    const profit = round(financials.revenue - estimatedCost);
    const margin = financials.revenue > 0 ? round((profit / financials.revenue) * 100) : null;
    const balanceByItem = new Map<string, number>();
    scopedStock.forEach(row => {
      const sign = ["issue","transfer_out"].includes(String(row.transaction_type)) ? -1 : 1;
      balanceByItem.set(String(row.item_id), (balanceByItem.get(String(row.item_id)) ?? 0) + sign * Number(row.quantity ?? 0));
    });
    const lowStock = items.filter(row => row.reorder_level !== null && (balanceByItem.get(String(row.id)) ?? 0) <= Number(row.reorder_level));
    const activeFlocks = scopedFlocks.filter(row => row.status === "active");
    const liveBirds = activeFlocks.reduce((sum,row) => sum + Number(row.current_count ?? 0), 0);
    const scopedFarmIds = new Set(activeFlocks.map(row => String(row.farm_id)));
    const scopedHouseIds = new Set(activeFlocks.map(row => String(row.house_id)));
    const capacity = farms.filter(row => scopedFarmIds.has(String(row.id))).reduce((sum,row) => sum + Number(row.capacity_birds ?? 0), 0);
    const activeFlockIds = new Set(activeFlocks.map(row => String(row.id)));
    const scopedLiveDaily = liveDaily.filter(row => activeFlockIds.has(String(row.flock_id)));
    const liveRecordByFlock = new Map(scopedLiveDaily.map(row => [String(row.flock_id), row]));
    const closedFlockIds = new Set(feedClosures.filter(row => String(row.status) === "closed" && activeFlockIds.has(String(row.flock_id))).map(row => String(row.flock_id)));
    const farmPulse = Array.from(scopedFarmIds).map(id => {
      const farm = farmById.get(id);
      const farmFlocks = activeFlocks.filter(row => String(row.farm_id) === id);
      const farmFlockIds = new Set(farmFlocks.map(row => String(row.id)));
      const farmRows = scopedLiveDaily.filter(row => farmFlockIds.has(String(row.flock_id)));
      const dailyPulse = calculateProduction(farmRows);
      const recordsComplete = farmFlocks.filter(row => liveRecordByFlock.has(String(row.id))).length;
      const feedClosed = farmFlocks.filter(row => closedFlockIds.has(String(row.id))).length;
      const farmHouses = houses.filter(row => String(row.farm_id) === id);
      const operatingHouses = new Set(farmFlocks.map(row => String(row.house_id))).size;
      const farmBirds = farmFlocks.reduce((sum,row) => sum + Number(row.current_count ?? 0), 0);
      const farmCapacity = Number(farm?.capacity_birds ?? 0) || farmHouses.reduce((sum,row) => sum + Number(row.capacity ?? 0), 0);
      const utilization = farmCapacity > 0 ? round((farmBirds / farmCapacity) * 100) : null;
      const mortalityCritical = dailyPulse.mortality !== null && dailyPulse.mortality >= 2;
      const productionWatch = dailyPulse.hdep !== null && dailyPulse.hdep < 60;
      const hasDataGap = recordsComplete < farmFlocks.length || feedClosed < farmFlocks.length;
      const status = mortalityCritical || (utilization !== null && utilization > 100) ? "critical" : productionWatch ? "watch" : hasDataGap ? "data_gap" : "on_track";
      const missingRecords = farmFlocks.length - recordsComplete;
      const openFeedDays = farmFlocks.length - feedClosed;
      const nextAction = mortalityCritical ? "Review mortality exception" : missingRecords > 0 ? `${missingRecords} flock record${missingRecords === 1 ? "" : "s"} outstanding` : openFeedDays > 0 ? `${openFeedDays} feed closure${openFeedDays === 1 ? "" : "s"} outstanding` : productionWatch ? "Review laying performance" : "View farm status";
      const actionRoute = mortalityCritical ? "/app/mortality" : missingRecords > 0 ? "/app/daily-records" : openFeedDays > 0 ? "/app/feed" : `/app/farms/${id}`;
      return { id, name:String(farm?.name ?? "Unknown farm"), branchName:String(branchById.get(String(farm?.branch_id))?.name ?? "Unassigned branch"), status, liveBirds:farmBirds, activeFlocks:farmFlocks.length, operatingHouses, totalHouses:farmHouses.length, capacityUtilization:utilization, recordsComplete, recordsExpected:farmFlocks.length, feedClosed, feedExpected:farmFlocks.length, eggs:dailyPulse.eggs, hdep:dailyPulse.hdep, mortality:dailyPulse.mortality, feedPerBirdGrams:dailyPulse.feedPerBirdGrams, latestRecordAt:dailyPulse.latestAt, nextAction, actionRoute };
    }).sort((a,b) => statusRank(a.status) - statusRank(b.status));
    const scopedBatchIds = new Set(activeFlocks.map(row => String(row.batch_id ?? "")).filter(Boolean));
    const activeBatches = batches.filter(row => scopedBatchIds.has(String(row.id)) && matches({ branch_id:String(row.branch_id), farm_id:String(row.farm_id), house_id:String(row.house_id), batch_id:String(row.id) }, scope));
    const batchPulse = activeBatches.map(batch => {
      const id = String(batch.id);
      const batchFlocks = activeFlocks.filter(row => String(row.batch_id) === id);
      const batchFlockIds = new Set(batchFlocks.map(row => String(row.id)));
      const batchRows = scopedLiveDaily.filter(row => batchFlockIds.has(String(row.flock_id)));
      const dailyPulse = calculateProduction(batchRows);
      const liveBirds = batchFlocks.reduce((sum,row) => sum + Number(row.current_count ?? 0), 0);
      const initialBirds = Number(batch.total_count ?? 0) || batchFlocks.reduce((sum,row) => sum + Number(row.initial_count ?? 0), 0);
      const recordsComplete = batchFlocks.filter(row => liveRecordByFlock.has(String(row.id))).length;
      const feedClosed = batchFlocks.filter(row => closedFlockIds.has(String(row.id))).length;
      const missingRecords = batchFlocks.length - recordsComplete;
      const openFeedDays = batchFlocks.length - feedClosed;
      const mortalityCritical = dailyPulse.mortality !== null && dailyPulse.mortality >= 2;
      const status = mortalityCritical ? "critical" : missingRecords > 0 || openFeedDays > 0 ? "data_gap" : dailyPulse.hdep !== null && dailyPulse.hdep < 60 ? "watch" : "on_track";
      const layerMode = batchFlocks.some(row => ["layer","parent_stock"].includes(String(row.flock_type)));
      const nextAction = mortalityCritical ? "Mortality exception requires review" : missingRecords > 0 ? `${missingRecords} flock record${missingRecords === 1 ? "" : "s"} not recorded` : openFeedDays > 0 ? `${openFeedDays} feeding day${openFeedDays === 1 ? "" : "s"} still open` : status === "watch" ? "Production requires review" : "Cycle evidence is current";
      return { id, code:String(batch.batch_code), source:String(batch.source).replaceAll("_"," "), status, placementDate:String(batch.placement_date), ageDays:dayDifference(String(batch.placement_date),today) + Number(batch.age_at_placement_days ?? 0), farmName:String(farmById.get(String(batch.farm_id))?.name ?? "Unknown farm"), houseName:String(houseById.get(String(batch.house_id))?.name ?? "Unknown house"), flocks:batchFlocks.length, liveBirds, initialBirds, retentionPct:initialBirds > 0 ? round((liveBirds / initialBirds) * 100) : null, recordsComplete, recordsExpected:batchFlocks.length, feedClosed, feedExpected:batchFlocks.length, primaryLabel:layerMode ? "Today's HDEP" : "Feed / bird", primaryValue:layerMode ? dailyPulse.hdep : dailyPulse.feedPerBirdGrams, primaryUnit:layerMode ? "%" : " g", mortality:dailyPulse.mortality, nextAction, actionRoute:mortalityCritical ? "/app/mortality" : missingRecords > 0 ? "/app/daily-records" : openFeedDays > 0 ? "/app/feed" : "/app/batches" };
    }).sort((a,b) => statusRank(a.status) - statusRank(b.status));
    const nowMs = Date.now();
    const staleLeads = leads.filter(row => !["closed","lost"].includes(String(row.pipeline_stage)) && nowMs - new Date(String(row.last_activity ?? row.created_at)).getTime() > 7 * 86400000).length;
    const wonLeads = leads.filter(row => ["delivered","closed"].includes(String(row.pipeline_stage))).length;
    const openOrders = orders.filter(row => !["completed","cancelled"].includes(String(row.status)));
    const pipelineValue = round(openOrders.reduce((sum,row) => sum + Number(row.total ?? 0), 0));
    const monthKey = `${dateTo.slice(0,7)}-01`;
    const target = targets.filter(row => String(row.period_month) === monthKey).sort((a,b) => Number(Boolean(b.scope_id)) - Number(Boolean(a.scope_id))).find(row => !row.scope_id || row.scope_id === scope.farm_id || row.scope_id === scope.branch_id);
    const revenueTarget = target?.revenue_target_etb === null || target?.revenue_target_etb === undefined ? null : Number(target.revenue_target_etb);
    const expectedRecords = Math.max(1, flockIds.size * (Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1));
    const recordCoverage = round(Math.min(100, (currentDaily.length / expectedRecords) * 100));
    const alerts = [
      ...lowStock.slice(0,5).map(row => ({ severity:"high", title:`Low stock: ${row.name}`, context:`${balanceByItem.get(String(row.id)) ?? 0} ${row.unit ?? "units"} on hand`, route:"/app/inventory" })),
      ...(production.mortality !== null && production.mortality >= 2 ? [{ severity:"high", title:`Mortality is ${production.mortality}%`, context:"Review affected flock records and causes.", route:"/app/mortality" }] : []),
      ...(recordCoverage < 90 ? [{ severity:"medium", title:`Daily record coverage is ${recordCoverage}%`, context:`${currentDaily.length} of ${expectedRecords} expected flock-days recorded.`, route:"/app/daily-records" }] : []),
      ...(production.layerFcr === null && production.eggs > 0 ? [{ severity:"low", title:"Layer FCR unavailable", context:"Record average egg weight to calculate feed conversion.", route:"/app/daily-records" }] : []),
      ...(staleLeads > 0 ? [{ severity:"medium", title:`${staleLeads} stale commercial lead(s)`, context:"No activity recorded for more than seven days.", route:"/app/crm" }] : []),
    ];
    const farmRanking = Array.from(scopedFarmIds).map(id => {
      const revenue = scopedSales.filter(row => row.farm_id === id).reduce((sum,row) => sum + Number(row.gross_amount ?? 0),0);
      const cost = costs.filter(row => row.farm_id === id).reduce((sum,row) => sum + Number(row.amount ?? 0),0);
      return { id, label: String(farmById.get(id)?.name ?? "Unknown farm"), revenue:round(revenue), cost:round(cost), profit:round(revenue-cost), margin: revenue > 0 ? round(((revenue-cost)/revenue)*100) : null };
    }).sort((a,b)=>b.profit-a.profit);
    return json({
      meta:{ dateFrom,dateTo,previous,scope,refreshedAt:new Date().toISOString(),liveAsOf:today,recordCoverage,calculationCompleteness:production.completeness,latestRecordAt:production.latestAt,financialStatus: estimatedCost > 0 ? "estimate" : "unavailable" },
      live:{ farms:farmPulse, batches:batchPulse, recordsComplete:farmPulse.reduce((sum,row)=>sum+row.recordsComplete,0), recordsExpected:activeFlocks.length, feedClosed:farmPulse.reduce((sum,row)=>sum+row.feedClosed,0), feedExpected:activeFlocks.length, farmsNeedingAttention:farmPulse.filter(row=>row.status!=="on_track").length, batchesNeedingAttention:batchPulse.filter(row=>row.status!=="on_track").length },
      scorecard:{ revenue:{value:financials.revenue,previous:priorFinancials.revenue,target:revenueTarget,confidence:"actual"}, profit:{value:estimatedCost>0?profit:null,previous:null,target:null,confidence:estimatedCost>0?"estimate":"unavailable"}, collection:{value:financials.collectionRate,previous:priorFinancials.collectionRate,target:target?.cash_collection_target_pct??null,confidence:"actual"}, hdep:{value:production.hdep,previous:priorProduction.hdep,target:null,confidence:production.hdep===null?"unavailable":"actual"}, mortality:{value:production.mortality,previous:priorProduction.mortality,target:null,confidence:production.mortality===null?"unavailable":"actual"}, actions:{value:alerts.length,previous:null,target:0,confidence:"actual"} },
      operations:{...production,liveBirds,activeFlocks:activeFlocks.length,activeFarms:scopedFarmIds.size,activeHouses:scopedHouseIds.size,capacityUtilization:capacity>0?round((liveBirds/capacity)*100):null,upcomingVaccinations:vaccines.filter(row=>flockIds.has(String(row.flock_id))).length},
      financials:{...financials,estimatedCost,profit:estimatedCost>0?profit:null,margin,confidence:estimatedCost>0?"estimate":"unavailable"},
      commercial:{companyWide:true,totalLeads:leads.length,staleLeads,conversionRate:leads.length?round((wonLeads/leads.length)*100):null,openOrders:openOrders.length,pipelineValue},
      rankings:{farms:farmRanking}, alerts
    });
  } catch (error: unknown) { return json({ error:error instanceof Error?error.message:"Unknown error" },500); }
}
