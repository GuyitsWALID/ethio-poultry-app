import "server-only";
import {managerWarehouseAccess} from "@/lib/warehouse-access";
import {reportOperatingDate, reportTimestampBounds, reportWarehouseAllowed} from "@/lib/report-safety";
import {readReportQuery} from "@/lib/report-pagination";
import {selectEvidenceScope, ReportEvidenceError} from "@/lib/report-evidence";
import {projectLocationFlocks, reportRowInLocations, selectReportLocations, type ReportLocation} from "@/lib/report-locations";
import {reportResources, type ReportResources} from "@/lib/report-snapshot";

import {
  applySalesFilters,
  type SalesContext,
  hasScopedAccess,
  json,
  periodKey,
  supabaseAdmin,
  type DailySalesRecord,
} from "@/lib/sales";
import {
  buildTierSummary,
  missingCostBasis,
  round,
  unitPricePerEgg,
  type EggCostBasis,
  reportSaleCost,
} from "@/lib/profitability";

type AggregateRow = {
  label: string;
  revenue: number;
  paid: number;
  balanceDue: number;
  quantity: number;
  quantityByUnit: Map<string,number>;
  estimatedCost: number | null;
  estimatedProfit: number | null;
  paidProfitMargin: number | null;
};

function emptyAggregate(label: string): AggregateRow {
  return {
    label,
    revenue: 0,
    paid: 0,
    balanceDue: 0,
    quantity: 0,
    quantityByUnit: new Map(),
    estimatedCost: 0,
    estimatedProfit: 0,
    paidProfitMargin: null,
  };
}

function aggregateByPeriod(
  records: DailySalesRecord[],
  period: "day" | "week" | "month" | "quarter",
  costForRecord: (record: DailySalesRecord) => number | null
) {
  const map = new Map<string, AggregateRow>();
  records.forEach((record) => {
    const key = periodKey(record.sale_date, period);
    const current = map.get(key) ?? emptyAggregate(key);
    const cost = costForRecord(record);
    current.revenue += record.gross_amount;
    current.paid += record.paid_amount;
    current.balanceDue += record.balance_due;
    current.quantity += record.quantity;
    current.quantityByUnit.set(record.unit,(current.quantityByUnit.get(record.unit)??0)+record.quantity);
    current.estimatedCost = cost===null||current.estimatedCost===null?null:current.estimatedCost+cost;
    current.estimatedProfit = cost===null||current.estimatedProfit===null?null:current.estimatedProfit+record.gross_amount-cost;
    current.paidProfitMargin = current.paid > 0 && current.balanceDue===0 && current.estimatedCost!==null ? round(((current.paid - current.estimatedCost) / current.paid) * 100) : null;
    map.set(key, current);
  });

  return Array.from(map.values())
    .sort((a, b) => (a.label < b.label ? -1 : 1))
    .map(({quantityByUnit,...row}) => ({
      ...row,
      revenue: round(row.revenue),
      paid: round(row.paid),
      balanceDue: round(row.balanceDue),
      quantity: quantityByUnit.size<=1?round(row.quantity):null,
      quantityByUnit:[...quantityByUnit].map(([unit,quantity])=>({unit,quantity:round(quantity)})),
      estimatedCost: row.estimatedCost===null?null:round(row.estimatedCost),
      estimatedProfit: row.estimatedProfit===null?null:round(row.estimatedProfit),
    }));
}

export async function loadSalesAnalytics(ctx: SalesContext, params: URLSearchParams, captureResources?: (resources: ReportResources) => void) {
  try {
    if (!ctx.canView) return json({ error: "You do not have access to sales analytics." }, 403);

    const today = new Date();
    const todayDate = reportOperatingDate(today.toISOString())!;
    const defaultFrom = new Date(`${todayDate}T00:00:00Z`);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 89);
    const dateFrom = params.get("date_from") ?? defaultFrom.toISOString().slice(0, 10);
    const dateTo = params.get("date_to") ?? todayDate;
    let bounds: ReturnType<typeof reportTimestampBounds>;
    try { bounds = reportTimestampBounds(dateFrom, dateTo); }
    catch { return json({error: "Choose a valid report period of at most 366 days."}, 400); }
    const warehouseIds = ctx.role === "farm_manager" && !ctx.supportSessionId ? new Set((await managerWarehouseAccess(ctx.userId, ctx.orgId)).map(row => row.id)) : null;

    const [salesRes, dailyRes, batchRes, inventoryRes, stockRes, flockRes, farmRes, lockedPeriodsRes, costEntriesRes] = await Promise.all([
      readReportQuery(() => supabaseAdmin
        .from("daily_sales_records")
        .select("*")
        .eq("org_id", ctx.orgId)
        .is("voided_at",null)
        .gte("sale_date", dateFrom)
        .lte("sale_date", dateTo)
        .order("sale_date", { ascending: true })
        .order("id")),
      readReportQuery(() => supabaseAdmin
        .from("daily_farm_records")
        .select("record_date, flock_id, normal_eggs, broken_eggs, total_eggs, feed_intake_grams")
        .eq("org_id", ctx.orgId)
        .is("voided_at",null)
        .gte("record_date", dateFrom)
        .lte("record_date", dateTo)
        .order("record_date").order("id")),
      readReportQuery(() => supabaseAdmin
        .from("batches")
        .select("id, org_id, farm_id, house_id, batch_code, total_count, purchase_cost_per_bird, transport_cost, other_cost, total_batch_cost")
        .eq("org_id", ctx.orgId)
        .order("id")),
      readReportQuery(() => supabaseAdmin.from("inventory_items").select("id, category, unit_cost").eq("org_id", ctx.orgId).order("id")),
      readReportQuery(() => supabaseAdmin
        .from("stock_ledger")
        .select("item_id, quantity, transaction_type, unit_cost, transaction_date, branch_id, farm_id, house_id, flock_id, batch_id, warehouse_id")
        .eq("org_id", ctx.orgId)
        .in("transaction_type", ["issue", "return"])
        .gte("transaction_date", bounds.start)
        .lt("transaction_date", bounds.end)
        .order("transaction_date").order("id")),
      readReportQuery(() => supabaseAdmin.from("flocks").select("id, org_id, flock_code, flock_type, farm_id, house_id, batch_id").eq("org_id", ctx.orgId).order("id")),
      readReportQuery(() => supabaseAdmin.from("farms").select("id, org_id, name, branch_id").eq("org_id", ctx.orgId).order("id")),
      readReportQuery(() => supabaseAdmin
        .from("monthly_cost_periods")
        .select("*")
        .eq("org_id", ctx.orgId)
        .eq("status", "locked")
        .lte("period_start", dateTo)
        .gte("period_end", dateFrom)
        .order("period_start", { ascending: false })
        .order("id")),
      readReportQuery(() => supabaseAdmin
        .from("cost_entries")
        .select("amount, category, entry_date, branch_id, farm_id, house_id, flock_id, batch_id, warehouse_id")
        .eq("org_id", ctx.orgId)
        .gte("entry_date", dateFrom)
        .lte("entry_date", dateTo)
        .order("entry_date").order("id")),
    ]);

    const scopedSales = ((salesRes.data ?? []) as DailySalesRecord[]).filter((record) => hasScopedAccess(ctx, record));
    const records = applySalesFilters(scopedSales, params);
    const requestedScope = {
      branch_id: params.get("branch_id"),
      farm_id: params.get("farm_id"),
      house_id: params.get("house_id"),
      flock_id: params.get("flock_id"),
      batch_id: params.get("batch_id"),
    };
    const houses = requestedScope.house_id ? (await readReportQuery(() => supabaseAdmin.from("houses").select("id,org_id,farm_id").eq("org_id", ctx.orgId).eq("id", requestedScope.house_id!).order("id"))).data : undefined;
    const locations = (await readReportQuery<ReportLocation>(()=>supabaseAdmin.rpc("report_flock_locations",{p_org:ctx.orgId}).order("flock_id").order("from_at").order("house_id"))).data;
    const permittedFarms = farmRes.data.filter(row => hasScopedAccess(ctx,{farm_id:row.id}));
    const locationFilter={branchId:requestedScope.branch_id??undefined,farmId:requestedScope.farm_id??undefined,houseId:requestedScope.house_id??undefined,flockId:requestedScope.flock_id??undefined,batchId:requestedScope.batch_id??undefined};
    const selectedLocations=selectReportLocations(locations,flockRes.data,permittedFarms,locationFilter);
    const periodFlockIds=new Set(selectedLocations.filter(row=>row.from_date<=dateTo&&(!row.to_date||row.to_date>=dateFrom)).map(row=>row.flock_id));
    const eggFlockIds=new Set(flockRes.data.filter(row=>periodFlockIds.has(row.id)&&["layer","parent_stock"].includes(row.flock_type)).map(row=>row.id));
    const mixedProduction=flockRes.data.some(row=>periodFlockIds.has(row.id)&&!["layer","parent_stock"].includes(row.flock_type));
    selectEvidenceScope(ctx.orgId, ctx.role === "farm_manager" && !ctx.supportSessionId,
      permittedFarms, projectLocationFlocks(flockRes.data,selectReportLocations(locations.filter(row=>row.verified),flockRes.data,permittedFarms,{})),
      {dateFrom, dateTo, branchId: requestedScope.branch_id ?? undefined, farmId: requestedScope.farm_id ?? undefined, houseId: requestedScope.house_id ?? undefined, flockId: requestedScope.flock_id ?? undefined, batchId: requestedScope.batch_id ?? undefined}, {houses, batches: batchRes.data});
    const scopedBatchIds = new Set(records.map((record) => record.batch_id).filter(Boolean) as string[]);
    const scopeMatches = (row: {
      branch_id?: string | null;
      farm_id?: string | null;
      house_id?: string | null;
      flock_id?: string | null;
      batch_id?: string | null;
    }) => {
      return (Object.entries(requestedScope) as Array<[keyof typeof requestedScope, string | null]>).every(
        ([key, value]) => !value || row[key] === value
      );
    };
    const lockedScopeMatches = (row: {
      branch_id?: string | null;
      farm_id?: string | null;
      house_id?: string | null;
      flock_id?: string | null;
      batch_id?: string | null;
    }) => (Object.entries(requestedScope) as Array<[keyof typeof requestedScope, string | null]>).every(
      ([key, value]) => value ? row[key] === value : !row[key]
    );
    const inventoryCategoryByItem = new Map((inventoryRes.data ?? []).map((item) => [item.id, String(item.category)]));
    const costedInventoryItemIds = new Set(
      (inventoryRes.data ?? [])
        .filter((item) => ["feed", "medicine", "vaccine", "vitamin", "supplement", "packaging"].includes(item.category))
        .map((item) => item.id)
    );
    const issuedInventoryCostByCategory = new Map<string, number>();
    let incompleteConsumptionCosts=false;
    (stockRes.data ?? []).forEach((row) => {
      if (!reportWarehouseAllowed(row.warehouse_id, warehouseIds) || !hasScopedAccess(ctx, row)) return;
      if (!costedInventoryItemIds.has(row.item_id)) return;
      if ((row.transaction_type !== "issue" && row.transaction_type !== "return") || !scopeMatches(row)) return;
      if(row.flock_id&&!eggFlockIds.has(row.flock_id))return;
      const category = inventoryCategoryByItem.get(row.item_id) ?? "";
      if(row.unit_cost===null||row.unit_cost===undefined||!Number.isFinite(Number(row.unit_cost))){incompleteConsumptionCosts=true;return;}
      const consumptionDelta = row.quantity * row.unit_cost * (row.transaction_type === "return" ? -1 : 1);
      issuedInventoryCostByCategory.set(category, (issuedInventoryCostByCategory.get(category) ?? 0) + consumptionDelta);
    });
    const normalEggs = (dailyRes.data ?? []).reduce((sum, row) => {
      if (!eggFlockIds.has(row.flock_id)||!reportRowInLocations(row,selectedLocations)) return sum;
      return sum + (row.normal_eggs ?? 0);
    }, 0);
    const brokenEggs = (dailyRes.data ?? []).reduce((sum, row) => {
      if (!eggFlockIds.has(row.flock_id)||!reportRowInLocations(row,selectedLocations)) return sum;
      return sum + (row.broken_eggs ?? 0);
    }, 0);
    const inventoryCostCategories = new Set(["feed", "medicine", "vaccine", "vitamin", "supplement", "packaging"]);
    const manualInventoryCostByCategory = new Map<string, number>();
    let overheadCost = 0;
    (costEntriesRes.data ?? []).filter(row => scopeMatches(row) && hasScopedAccess(ctx, row) && (!row.warehouse_id || reportWarehouseAllowed(row.warehouse_id, warehouseIds))).forEach((row) => {
      const category = String(row.category);
      if (inventoryCostCategories.has(category)) {
        manualInventoryCostByCategory.set(category, (manualInventoryCostByCategory.get(category) ?? 0) + (row.amount ?? 0));
      } else {
        overheadCost += row.amount ?? 0;
      }
    });
    let issuedInventoryCost = 0;
    let excludedDuplicateCost = 0;
    inventoryCostCategories.forEach((category) => {
      const issued = issuedInventoryCostByCategory.get(category) ?? 0;
      const manual = manualInventoryCostByCategory.get(category) ?? 0;
      issuedInventoryCost += issued > 0 ? issued : manual;
      if (issued > 0) excludedDuplicateCost += manual;
    });

    const lockedPeriod = (lockedPeriodsRes.data ?? [])
      .filter(()=>warehouseIds===null)
      .filter(row=>row.period_start<=dateFrom&&row.period_end>=dateTo)
      .filter(row => hasScopedAccess(ctx, row))
      .filter(lockedScopeMatches)
      .sort((a, b) => {
        const specificity =
          Number(Boolean(b.flock_id)) +
          Number(Boolean(b.batch_id)) +
          Number(Boolean(b.house_id)) +
          Number(Boolean(b.farm_id)) +
          Number(Boolean(b.branch_id)) -
          (Number(Boolean(a.flock_id)) +
            Number(Boolean(a.batch_id)) +
            Number(Boolean(a.house_id)) +
            Number(Boolean(a.farm_id)) +
            Number(Boolean(a.branch_id)));
        if (specificity !== 0) return specificity;
        return a.period_start < b.period_start ? 1 : -1;
      })[0];
    const rollingAbsorbedCost = issuedInventoryCost + overheadCost;
    const costBasis: EggCostBasis = lockedPeriod?.base_cost_per_egg
      ? {
          status: "locked",
          baseCostPerEgg: Number(lockedPeriod.base_cost_per_egg),
          targetMarginPerEgg: Number(lockedPeriod.target_margin_per_egg ?? 0),
          targetPricePerEgg: Number(lockedPeriod.base_cost_per_egg) + Number(lockedPeriod.target_margin_per_egg ?? 0),
          normalEggs: Number(lockedPeriod.total_normal_eggs ?? 0),
          brokenEggs: Number(lockedPeriod.total_broken_eggs ?? 0),
          absorbedCost:
            Number(lockedPeriod.direct_inventory_cost ?? 0) + Number(lockedPeriod.overhead_cost ?? 0) ||
            Number(lockedPeriod.total_absorbed_cost ?? 0),
          sourceLabel: `Locked ${lockedPeriod.period_start} to ${lockedPeriod.period_end}`,
          missingCostReasons: [],
        }
      : !mixedProduction && !incompleteConsumptionCosts && (dailyRes.data??[]).filter(row=>eggFlockIds.has(row.flock_id)&&reportRowInLocations(row,selectedLocations)).every(row=>row.normal_eggs!==null) && normalEggs > 0 && issuedInventoryCost > 0
        ? {
            status: "rolling_estimate",
            baseCostPerEgg: rollingAbsorbedCost / normalEggs,
            targetMarginPerEgg: Math.max((rollingAbsorbedCost / normalEggs) * 0.1, 0.5),
            targetPricePerEgg: rollingAbsorbedCost / normalEggs + Math.max((rollingAbsorbedCost / normalEggs) * 0.1, 0.5),
            normalEggs,
            brokenEggs,
            absorbedCost: rollingAbsorbedCost,
            sourceLabel: "Rolling estimate",
            missingCostReasons: [],
          }
        : missingCostBasis("Egg pricing guidance needs normal-egg production plus issued or manually entered inventory consumption costs.");
    const costPerEgg = costBasis.baseCostPerEgg;

    const costPerBirdByBatch = new Map<string, number>();
    (batchRes.data ?? []).forEach((batch) => {
      if(!hasScopedAccess(ctx,batch))return;
      if (scopedBatchIds.size && !scopedBatchIds.has(batch.id)) return;
      const birdCount = batch.total_count ?? 0;
      const fallback =
        (batch.purchase_cost_per_bird ?? 0) * birdCount + (batch.transport_cost ?? 0) + (batch.other_cost ?? 0);
      const totalCost = batch.total_batch_cost ?? (batch.purchase_cost_per_bird===null?null:fallback);
      if (birdCount > 0 && totalCost!==null && totalCost >= 0) costPerBirdByBatch.set(batch.id, totalCost / birdCount);
    });

    const costForRecord = (record: DailySalesRecord) => reportSaleCost(record,costPerEgg,costPerBirdByBatch);

    const totalRevenue = records.reduce((sum, record) => sum + record.gross_amount, 0);
    const totalPaid = records.reduce((sum, record) => sum + record.paid_amount, 0);
    const totalBalance = records.reduce((sum, record) => sum + record.balance_due, 0);
    const totalQuantity = records.reduce((sum, record) => sum + record.quantity, 0);
    const costs=records.map(costForRecord);
    const estimatedCost = costs.some(cost=>cost===null)?null:costs.reduce<number>((sum,cost)=>sum+(cost??0),0);
    const estimatedProfit = estimatedCost===null?null:totalRevenue-estimatedCost;
    const eggRecords = records.filter((record) => record.product_category === "egg");
    const belowTargetCount = eggRecords.filter((record) => {
      if (!costBasis.targetPricePerEgg) return false;
      return unitPricePerEgg(record) < costBasis.targetPricePerEgg;
    }).length;
    const belowBreakEvenCount = eggRecords.filter((record) => {
      if (!costBasis.baseCostPerEgg) return false;
      return unitPricePerEgg(record) < costBasis.baseCostPerEgg;
    }).length;
    const missingCostReasons = [
      ...costBasis.missingCostReasons,
      costBasis.status === "rolling_estimate" && records.some((record) => record.product_category === "egg")
        ? "Egg margin is using rolling cost because no locked monthly cost period exists for this range."
        : null,
      costBasis.status === "missing" && records.some((record) => record.product_category === "egg")
        ? "Egg margin is unavailable because normal egg totals or absorbed costs are incomplete."
        : null,
      records.some((record) => record.product_category === "bird" && costForRecord(record)===null)
        ? "Bird margin is unavailable because a recorded head count or authorized batch acquisition cost is missing."
        : null,
      excludedDuplicateCost > 0
        ? `${round(excludedDuplicateCost)} in manual inventory costs was excluded because issued stock already provides that category cost.`
        : null,
    ].filter(Boolean);

    const productMix = Array.from(
      records.reduce((map, record) => {
        const current = map.get(record.product_category) ?? { label: record.product_category, revenue: 0, quantity: 0 };
        current.revenue += record.gross_amount;
        current.quantity += record.quantity;
        map.set(record.product_category, current);
        return map;
      }, new Map<string, { label: string; revenue: number; quantity: number }>())
    ).map(([, value]) => ({ ...value, revenue: round(value.revenue), quantity: round(value.quantity) }));

    const flockNames = new Map((flockRes.data ?? []).map((flock) => [flock.id, flock.flock_code]));
    const farmNames = new Map((farmRes.data ?? []).map((farm) => [farm.id, farm.name]));
    const contribution = Array.from(
      records.reduce((map, record) => {
        const id = record.batch_id ?? record.flock_id ?? record.farm_id ?? "unassigned";
        const label =
          (record.flock_id && flockNames.get(record.flock_id)) ||
          (record.farm_id && farmNames.get(record.farm_id)) ||
          "Unassigned";
        const current = map.get(id) ?? { id, label, revenue: 0, quantity: 0 };
        current.revenue += record.gross_amount;
        current.quantity += record.quantity;
        map.set(id, current);
        return map;
      }, new Map<string, { id: string; label: string; revenue: number; quantity: number }>())
    )
      .map(([, value]) => ({ ...value, revenue: round(value.revenue), quantity: round(value.quantity) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const usedCosts = (costEntriesRes.data ?? []).filter(row => scopeMatches(row) && hasScopedAccess(ctx, row) && (!row.warehouse_id || reportWarehouseAllowed(row.warehouse_id, warehouseIds)));
    const usedStock = (stockRes.data ?? []).filter(row => reportWarehouseAllowed(row.warehouse_id, warehouseIds) && hasScopedAccess(ctx, row) && scopeMatches(row) && costedInventoryItemIds.has(row.item_id) && (!row.flock_id || eggFlockIds.has(row.flock_id)));
    const resources = reportResources(permittedFarms.filter(row => !requestedScope.farm_id || row.id === requestedScope.farm_id).map(row => row.id), [...usedStock, ...usedCosts.filter(row => row.warehouse_id)]);
    if (lockedPeriod) resources.complete = false;
    captureResources?.(resources);
    return json({
      filters: { dateFrom, dateTo },
      kpis: {
        records: records.length,
        todayRevenue: round(records.filter((record) => record.sale_date === todayDate).reduce((sum, record) => sum + record.gross_amount, 0)),
        revenue: round(totalRevenue),
        paid: round(totalPaid),
        balanceDue: round(totalBalance),
        quantity: new Set(records.map(row=>row.unit)).size<=1?round(totalQuantity):null,
        quantityByUnit:[...new Set(records.map(row=>row.unit))].map(unit=>({unit,quantity:round(records.filter(row=>row.unit===unit).reduce((sum,row)=>sum+row.quantity,0))})),
        averageSellingPrice: totalQuantity > 0 && new Set(records.map(row=>row.unit)).size===1 ? round(totalRevenue / totalQuantity) : null,
        estimatedCost: estimatedCost===null?null:round(estimatedCost),
        estimatedProfit: estimatedProfit===null?null:round(estimatedProfit),
        actualPaidMargin: totalPaid > 0 && totalBalance===0 && estimatedCost!==null ? round(((totalPaid - estimatedCost) / totalPaid) * 100) : null,
        marginStatus: estimatedCost===null?"unavailable":costBasis.status === "locked" && !missingCostReasons.length ? "tracked" : "estimated",
        costBasisStatus: costBasis.status,
        breakEvenPricePerEgg: costBasis.baseCostPerEgg === null ? null : round(costBasis.baseCostPerEgg, 4),
        targetPricePerEgg: costBasis.targetPricePerEgg === null ? null : round(costBasis.targetPricePerEgg, 4),
        targetMarginPerEgg: round(costBasis.targetMarginPerEgg, 4),
        normalEggs: costBasis.normalEggs,
        brokenEggs: costBasis.brokenEggs,
        absorbedCost: round(costBasis.absorbedCost),
        costBasisSource: costBasis.sourceLabel,
        belowTargetCount,
        belowBreakEvenCount,
        missingCostReasons,
      },
      pricingGuidance: {
        costBasis: {
          ...costBasis,
          baseCostPerEgg: costBasis.baseCostPerEgg === null ? null : round(costBasis.baseCostPerEgg, 4),
          targetPricePerEgg: costBasis.targetPricePerEgg === null ? null : round(costBasis.targetPricePerEgg, 4),
          targetMarginPerEgg: round(costBasis.targetMarginPerEgg, 4),
          absorbedCost: round(costBasis.absorbedCost),
        },
        tierSummary: buildTierSummary(records, costBasis),
        warnings: [
          belowBreakEvenCount > 0 ? `${belowBreakEvenCount} egg sale(s) are below break-even.` : null,
          belowTargetCount > 0 ? `${belowTargetCount} egg sale(s) are below target margin.` : null,
          costBasis.status === "rolling_estimate" ? "Pricing guidance is advisory until the monthly cost period is locked." : null,
        ].filter(Boolean),
      },
      charts: {
        daily: aggregateByPeriod(records, "day", costForRecord).map((row) => ({ ...row })),
        weekly: aggregateByPeriod(records, "week", costForRecord),
        monthly: aggregateByPeriod(records, "month", costForRecord),
        quarterly: aggregateByPeriod(records, "quarter", costForRecord),
        productMix,
        contribution,
        salesTiers: buildTierSummary(records, costBasis),
      },
    });
  } catch (error: unknown) {
    if (error instanceof ReportEvidenceError) return json({error: error.code}, error.status);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
}
