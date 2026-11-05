import { addisDate, calculateFeedPerBirdDay, calculateInventoryCover, dateDays, feedAdmin, feedJson, getFeedContext, resolveFeedBatch, roundFeed, statusFromVariance } from "@/lib/feed-control";
import {getTranslations} from "next-intl/server";
import {calculateReportFcr} from "@/lib/feed-calculations";
import {managerWarehouseAccess} from "@/lib/warehouse-access";
import {reportConsumptionCost,reportTimestampBounds,validReportDate} from "@/lib/report-safety";
import {readReportQuery} from "@/lib/report-pagination";
import type {ReportLocation} from "@/lib/report-locations";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type SourceResult = { data: Row[]; error: string | null };
type DbResult = { data: unknown; error: { message: string } | null };
type PagedQuery = { range: (from: number, to: number) => PromiseLike<DbResult>; order: (column:string)=>PagedQuery };

async function source(query: PagedQuery): Promise<SourceResult> {
  query=query.order("id");
  const pageSize = 1000; const data: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await query.range(from, from + pageSize - 1);
    if (result.error) return { data, error: result.error.message };
    const page = Array.isArray(result.data) ? result.data as Row[] : [];
    data.push(...page);
    if(data.length>100000)return {data:[],error:"REPORT_TOO_LARGE"};
    if (page.length < pageSize) return { data, error: null };
  }
}

const number = (value: unknown) => typeof value === "number" ? value : Number(value ?? 0);
const nullable = (value: number, valid: boolean) => valid && Number.isFinite(value) ? roundFeed(value) : null;

export async function GET(request: Request) {
  const t = await getTranslations("FeedEvidence");
  try {
  const ctx = await getFeedContext();
  if (ctx instanceof Response) return ctx;
  const url = new URL(request.url);
  const batchId = url.searchParams.get("batch_id");
  if (!batchId) return feedJson({ error: t("selectBatch") }, 400);
  const resolved = await resolveFeedBatch(ctx, batchId);
  if (!resolved.batch) return feedJson({ error: resolved.error }, 403);

  const today = addisDate();
  const dateTo = url.searchParams.get("date_to") ?? today;
  if(!validReportDate(dateTo))return feedJson({error:t("invalidFinalDate")},400);
  const requestedFrom = url.searchParams.get("date_from");
  const dateFrom = requestedFrom ?? new Date(Date.parse(`${dateTo}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  try{reportTimestampBounds(dateFrom,dateTo);}catch{return feedJson({error:t("invalidPeriod")},400);}
  const sourceFrom = dateFrom < today ? dateFrom : today;
  const sourceTo = dateTo > today ? dateTo : today;

  const db = feedAdmin;
  const org = ctx.orgId;
  if(url.searchParams.get("branch_id")&&url.searchParams.get("branch_id")!==resolved.batch.branch_id)return feedJson({error:t("scopeMismatch")},400);
  const [flocksS, templatesS, schedulesS, sessionsS, closuresS, dailyS, weightsS, tasksS, itemsS, warehousesS, ledgerS, settingsS, standardsS, executionsS] = await Promise.all([
    source(db.from("flocks").select("id,flock_code,flock_type,breed_id,current_count,initial_count,placement_date,age_at_placement_days,farm_id,house_id,status").eq("org_id", org).eq("batch_id", batchId).order("id")),
    source(db.from("batch_feed_templates").select("id,name,source_type,is_active,created_at,batch_feed_template_rows(*),batch_feed_template_milestones(*)").eq("org_id", org).eq("batch_id", batchId).order("created_at", { ascending: false })),
    source(db.from("feeding_schedules").select("*").eq("org_id", org).eq("batch_id", batchId).gte("schedule_date", sourceFrom).lte("schedule_date", sourceTo).order("schedule_date")),
    source(db.from("feeding_session_records").select("*").eq("org_id", org).is("voided_at",null).eq("batch_id", batchId).gte("record_date", sourceFrom).lte("record_date", sourceTo).order("record_date")),
    source(db.from("feed_day_closures").select("*").eq("org_id", org).eq("batch_id", batchId).gte("record_date", sourceFrom).lte("record_date", sourceTo)),
    Promise.resolve<SourceResult>({ data: [], error: null }),
    Promise.resolve<SourceResult>({ data: [], error: null }),
    source(db.from("batch_weight_check_tasks").select("*,batch_feed_template_rows(age_day_start,age_day_end,target_weight_min_g,target_weight_max_g)").eq("org_id", org).eq("batch_id", batchId).order("due_date")),
    source(db.from("inventory_items").select("id,name,unit,unit_cost,reorder_level").eq("org_id", org).eq("category", "feed").order("name")),
    source(db.from("warehouses").select("id,name,branch_id,type").eq("org_id", org).eq("branch_id", resolved.batch.branch_id).order("name")),
    source(db.from("stock_ledger").select("item_id,warehouse_id,flock_id,batch_id,source_kind,quantity,transaction_type,unit_cost,transaction_date").eq("org_id", org).lt("transaction_date", new Date(Date.parse(`${sourceTo}T00:00:00+03:00`)+86400000).toISOString()).order("transaction_date").order("id")),
    source(db.from("feed_control_settings").select("warning_variance_pct,critical_variance_pct").eq("org_id", org)),
    source(db.from("breed_standards").select("breed_id,week_number,target_feed_g,target_weight_g").eq("org_id", org).order("week_number")),
    source(db.from("feed_milestone_executions").select("*").eq("org_id", org)),
  ]);

  const flockIds = flocksS.data.map((row) => String(row.id));
  const [locationRows,clearanceRows,cycleRows]=await Promise.all([
    readReportQuery<ReportLocation>(()=>db.rpc("report_flock_locations" as never,{p_org:org} as never).order("flock_id").order("from_at").order("house_id")),
    readReportQuery<Row>(()=>db.from("effective_cycle_clearances").select("flock_id,closure_id").eq("org_id",org).order("flock_id")),
    readReportQuery<Row>(()=>db.from("batch_cycle_closures").select("id,completed_at").eq("org_id",org).order("id")),
  ]);
  const relevantLocations=locationRows.data.filter(row=>flockIds.includes(row.flock_id)&&row.from_date<=dateTo&&(!row.to_date||row.to_date>=dateFrom));
  if(relevantLocations.some(row=>!row.verified))return feedJson({error:"The flock movement history needs reviewed correction before reporting."},409);
  if(ctx.role==="farm_manager"&&!ctx.supportSessionId&&relevantLocations.some(row=>!ctx.allowedFarmIds.has(row.farm_id)))return feedJson({error:"This batch includes historical farm evidence outside your current assignments."},403);
  for(const [key,column] of [["farm_id","farm_id"],["house_id","house_id"],["flock_id","flock_id"]] as const){
    const requested=url.searchParams.get(key);
    if(requested&&relevantLocations.some(row=>row[column]!==requested))return feedJson({error:"Feed Control covers the complete batch. Select matching batch-level filters; narrower comparisons belong in Farm performance."},400);
  }
  const cycleEnds=new Map(cycleRows.data.map(row=>[String(row.id),new Date(Date.parse(String(row.completed_at))+3*3600000).toISOString().slice(0,10)]));
  const completed=new Map(clearanceRows.data.map(row=>[String(row.flock_id),cycleEnds.get(String(row.closure_id))]));
  const unverifiedArchive=flocksS.data.some(row=>!["active","quarantined"].includes(String(row.status))&&!completed.get(String(row.id)));
  const allowedStores=ctx.role==="farm_manager"&&!ctx.supportSessionId?new Set((await managerWarehouseAccess(ctx.userId,ctx.orgId)).map(row=>row.id)):null;
  if(allowedStores){
    if(sessionsS.data.some(row=>row.warehouse_id&&!allowedStores.has(String(row.warehouse_id))))return feedJson({error:"Shared-store permission is required to view this feeding evidence."},403);
    warehousesS.data=warehousesS.data.filter(row=>allowedStores.has(String(row.id)));
    ledgerS.data=ledgerS.data.filter(row=>allowedStores.has(String(row.warehouse_id)));
  }
  if (flockIds.length) {
    const [daily, weights] = await Promise.all([
      source(db.from("daily_farm_records").select("id,flock_id,record_date,opening_birds,closing_birds,feed_intake_grams,feed_intake_quantity,feed_leftover_grams,total_eggs,normal_eggs,broken_eggs,dirty_eggs,average_egg_weight_g").eq("org_id", org).is("voided_at",null).in("flock_id", flockIds).gte("record_date", sourceFrom).lte("record_date", sourceTo).order("record_date")),
      source(db.from("weight_records").select("*").eq("org_id", org).in("flock_id", flockIds).lte("record_date", sourceTo).order("record_date")),
    ]);
    dailyS.data = daily.data; dailyS.error = daily.error;
    weightsS.data = weights.data; weightsS.error = weights.error;
  }

  const sources = { flocks: flocksS, templates: templatesS, schedules: schedulesS, sessions: sessionsS, closures: closuresS, dailyRecords: dailyS, weights: weightsS, tasks: tasksS, inventory: itemsS, warehouses: warehousesS, stockLedger: ledgerS, settings: settingsS, breedStandards: standardsS, milestoneExecutions: executionsS };
  const sourceStatuses = Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, { status: value.error ? "failed" : "available", error: value.error }]));
  if (Object.values(sources).some(value=>value.error)) return feedJson({ error: t("loadFailed"), meta: { sources: sourceStatuses } }, 500);

  const settings = settingsS.data[0];
  const warning = number(settings?.warning_variance_pct || 5);
  const critical = number(settings?.critical_variance_pct || 10);
  const activeTemplate = templatesS.data.find((row) => row.is_active === true) ?? null;
  const templateRows = (activeTemplate?.batch_feed_template_rows as Row[] | undefined ?? []).sort((a, b) => number(a.age_day_start) - number(b.age_day_start));
  const ageToday = dateDays(resolved.batch.placement_date, today) + number(resolved.batch.age_at_placement_days);
  const currentTarget = templateRows.find((row) => ageToday >= number(row.age_day_start) && ageToday <= number(row.age_day_end)) ?? null;
  const scheduleToday = schedulesS.data.find((row) => row.schedule_date === today);
  const totalBirds = flocksS.data.reduce((sum, row) => sum + number(row.current_count), 0);
  const closures = new Map(closuresS.data.map((row) => [`${row.flock_id}:${row.record_date}`, row]));
  const dailyByKey = new Map(dailyS.data.map((row) => [`${row.flock_id}:${row.record_date}`, row]));

  const todayFlocks = flocksS.data.filter(row=>["active","quarantined"].includes(String(row.status))).map((flock) => {
    const flockSessions = sessionsS.data.filter((row) => row.flock_id === flock.id && row.record_date === today);
    const share = totalBirds > 0 ? number(flock.current_count) / totalBirds : 0;
    const planned = flockSessions.length ? flockSessions.reduce((sum, row) => sum + number(row.planned_feed_kg), 0)
      : scheduleToday ? number(scheduleToday.planned_feed_kg) * share
      : currentTarget ? number(flock.current_count) * number(currentTarget.feed_intake_recommended_g_per_head) / 1000 : 0;
    const actual = flockSessions.reduce((sum, row) => sum + number(row.actual_feed_kg), 0);
    const closure = closures.get(`${flock.id}:${today}`);
    const defaults = flockSessions.length ? flockSessions : [
      { id: null, session_name: "Morning", session_time: "07:00", planned_feed_kg: planned / 2, actual_feed_kg: null, feeders_count: 1, status: "planned", feed_item_id: null, warehouse_id: null, feed_type: scheduleToday?.feed_type ?? currentTarget?.feed_type_plan ?? null, notes: null },
      { id: null, session_name: "Afternoon", session_time: "15:30", planned_feed_kg: planned / 2, actual_feed_kg: null, feeders_count: 1, status: "planned", feed_item_id: null, warehouse_id: null, feed_type: scheduleToday?.feed_type ?? currentTarget?.feed_type_plan ?? null, notes: null },
    ];
    return { ...flock, plannedKg: roundFeed(planned), actualKg: roundFeed(actual), varianceKg: roundFeed(actual - planned), variancePct: nullable((actual - planned) / planned * 100, planned > 0), closeStatus: closure?.status ?? "open", sessions: defaults };
  });

  let actualFeed = 0; let plannedFeed = 0; let birdDays = 0; let coveredDays = 0; let coveredFlockDays = 0; let expectedFlockDays = 0; let legacyDays = 0;
  const trend = [] as Row[];
  for (let offset = 0; offset <= dateDays(dateFrom, dateTo); offset += 1) {
    const date = new Date(Date.parse(`${dateFrom}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
    const schedule = schedulesS.data.find((row) => row.schedule_date === date);
    let dayActual = 0; let dayBirds = 0; let isCovered = false; let isLegacy = false;
    for (const flock of flocksS.data) {
      const completion=completed.get(String(flock.id));
      const eligible = date >= String(flock.placement_date) && date <= today && (!completion||date<=completion);
      if (eligible) expectedFlockDays += 1;
      const closed = closures.get(`${flock.id}:${date}`)?.status === "closed";
      const rows = sessionsS.data.filter((row) => row.flock_id === flock.id && row.record_date === date);
      const daily = dailyByKey.get(`${flock.id}:${date}`);
      if (closed && rows.length) { dayActual += rows.reduce((sum, row) => sum + number(row.actual_feed_kg), 0); isCovered = true; if (eligible) coveredFlockDays += 1; }
      else if (daily && (daily.feed_intake_grams !== null || daily.feed_intake_quantity !== null)) { dayActual += daily.feed_intake_grams !== null ? number(daily.feed_intake_grams) / 1000 : number(daily.feed_intake_quantity); isCovered = true; isLegacy = true; if (eligible) coveredFlockDays += 1; }
      if (daily?.opening_birds !== null && daily?.opening_birds !== undefined) dayBirds += number(daily.opening_birds);
    }
    const dayPlan = schedule ? number(schedule.planned_feed_kg) : 0;
    actualFeed += dayActual; plannedFeed += dayPlan; birdDays += dayBirds;
    if (isCovered) coveredDays += 1; if (isLegacy) legacyDays += 1;
    trend.push({ date, plannedKg: roundFeed(dayPlan), actualKg: isCovered ? roundFeed(dayActual) : null, openingBirds: dayBirds || null, source: isLegacy ? "Legacy daily total" : isCovered ? "Closed sessions" : "Missing", sourceLabel: t((isLegacy ? "legacySource" : isCovered ? "closedSource" : "missingSource") as Parameters<typeof t>[0]) });
  }

  const movement = (type: unknown, quantity: unknown) => ["issue", "transfer_out"].includes(String(type)) ? -Math.abs(number(quantity)) : String(type) === "adjustment" ? number(quantity) : Math.abs(number(quantity));
  const compatibleItems = itemsS.data.filter((item) => ["kg", "kilogram", "kilograms"].includes(String(item.unit).toLowerCase()));
  const balances = compatibleItems.flatMap((item) => warehousesS.data.map((warehouse) => {
    const onHand = ledgerS.data.filter((row) => row.item_id === item.id && row.warehouse_id === warehouse.id).reduce((sum, row) => sum + movement(row.transaction_type, row.quantity), 0);
    return { itemId: item.id, itemName: item.name, unit: item.unit, unitCost: number(item.unit_cost), reorderLevel: number(item.reorder_level), warehouseId: warehouse.id, warehouseName: warehouse.name, onHand: roundFeed(onHand), value: roundFeed(onHand * number(item.unit_cost)) };
  }));
  const trailingDays = Math.max(1, Math.min(14, coveredDays));
  const totalOnHand = balances.reduce((sum, row) => sum + row.onHand, 0);
  const inventoryCover = calculateInventoryCover(totalOnHand, actualFeed, coveredDays);
  const costBounds=reportTimestampBounds(dateFrom,dateTo);
  const costRows=ledgerS.data.filter(row=>row.source_kind==="feed_day_close"&&flockIds.includes(String(row.flock_id))&&Date.parse(String(row.transaction_date))>=Date.parse(costBounds.start)&&Date.parse(String(row.transaction_date))<Date.parse(costBounds.end));
  const costedFeedKg=costRows.filter(row=>row.transaction_type==="issue"||row.transaction_type==="return").reduce((sum,row)=>sum+Math.abs(number(row.quantity))*(row.transaction_type==="return"?-1:1),0);
  const feedCostEtb=Math.abs(costedFeedKg-actualFeed)<.001?reportConsumptionCost(costRows):null;
  const leftoversKg = dailyS.data.filter((row) => String(row.record_date) >= dateFrom && String(row.record_date) <= dateTo).reduce((sum, row) => sum + number(row.feed_leftover_grams) / 1000, 0);

  const latestWeights = flocksS.data.map((flock) => weightsS.data.filter((row) => row.flock_id === flock.id).at(-1)).filter((row): row is Row => Boolean(row));
  const sampleTotal = latestWeights.reduce((sum, row) => sum + Math.max(1, number(row.sample_count)), 0);
  const weightedWeight = nullable(latestWeights.reduce((sum, row) => sum + number(row.average_weight_g) * Math.max(1, number(row.sample_count)), 0) / sampleTotal, sampleTotal > 0);
  const weightedUniformity = nullable(latestWeights.reduce((sum, row) => sum + number(row.uniformity_pct) * Math.max(1, number(row.sample_count)), 0) / sampleTotal, sampleTotal > 0 && latestWeights.every((row) => row.uniformity_pct !== null));
  let targetSamples = 0; let weightedTargetTotal = 0;
  for (const weight of latestWeights) {
    const flock = flocksS.data.find((row) => row.id === weight.flock_id); if (!flock) continue;
    const sampleAge = dateDays(String(flock.placement_date), String(weight.record_date)) + number(flock.age_at_placement_days);
    const target = templateRows.find((row) => sampleAge >= number(row.age_day_start) && sampleAge <= number(row.age_day_end));
    if (!target || target.target_weight_min_g === null || target.target_weight_max_g === null) continue;
    const count = Math.max(1, number(weight.sample_count)); targetSamples += count;
    weightedTargetTotal += (number(target.target_weight_min_g) + number(target.target_weight_max_g)) / 2 * count;
  }
  const targetMid = targetSamples ? weightedTargetTotal / targetSamples : 0;
  const weightVariance = nullable((number(weightedWeight) - targetMid) / targetMid * 100, weightedWeight !== null && targetMid > 0 && targetSamples === sampleTotal);
  const variancePct = nullable((actualFeed - plannedFeed) / plannedFeed * 100, plannedFeed > 0);
  const flockTypes = new Set(flocksS.data.map((row) => String(row.flock_type)));
  const layerMetric = [...flockTypes].every(type=>type==="layer"||type==="parent_stock");
  const reportFcr=calculateReportFcr(flocksS.data,dailyS.data.filter(row=>String(row.record_date)>=dateFrom&&String(row.record_date)<=dateTo),weightsS.data.filter(row=>String(row.record_date)>=dateFrom&&String(row.record_date)<=dateTo));
  const applicableFcr = reportFcr.mixed ? null : layerMetric ? reportFcr.layer : reportFcr.growth;
  const expectedDays = expectedFlockDays;
  const exceptions: Row[] = [];
  if (!activeTemplate) exceptions.push({ severity: "critical", title: t("noTemplateTitle"), reason: t("noTemplateReason"), action: t("openTemplates"), actionTarget: "template_management" });
  else if (!currentTarget) exceptions.push({ severity: "critical", title: t("outsideTemplate"), reason: t("ageReason", {age: ageToday}), action: t("extendTemplate"), actionTarget: "template_management" });
  if (todayFlocks.some((flock) => flock.sessions.some((session: Row) => session.status !== "completed"))) exceptions.push({ severity: "warning", title: t("feedingIncomplete"), reason: t("completeSessions"), action: t("recordSessions"), actionTarget: "today_sessions" });
  if (coveredFlockDays < expectedDays) exceptions.push({ severity: "warning", title: t("missingDays", {count: expectedDays - coveredFlockDays}), reason: t("coverageReason"), action: t("reconcile"), actionTarget: "feed_history" });
  if (inventoryCover !== null && inventoryCover < 7) exceptions.push({ severity: inventoryCover < 3 ? "critical" : "warning", title: t("stockLow"), reason: t("stockLowReason", {days: inventoryCover}), action: t("reviewStock") });

  const tasks = tasksS.data.map((task) => {
    const weight = weightsS.data.find((row) => row.id === task.weight_record_id); const target = task.batch_feed_template_rows as Row | null;
    const result = !weight || !target || target.target_weight_min_g === null || target.target_weight_max_g === null ? null : number(weight.average_weight_g) < number(target.target_weight_min_g) ? "Below target" : number(weight.average_weight_g) > number(target.target_weight_max_g) ? "Above target" : "On target";
    return { ...task, status: String(task.status), result, displayStatus: task.status === "completed" ? result ? `Complete · ${result}` : "Complete · result unavailable" : String(task.due_date) < today ? "Overdue" : "Scheduled" };
  });
  const pendingTasks = tasks.filter((task) => task.status !== "completed");
  const milestones = ((activeTemplate?.batch_feed_template_milestones as Row[] | undefined) ?? []).flatMap((milestone) => flocksS.data.map((flock) => {
    const dueDate = new Date(Date.parse(`${resolved.batch.placement_date}T00:00:00Z`) + (number(milestone.trigger_day) - number(resolved.batch.age_at_placement_days)) * 86_400_000).toISOString().slice(0, 10);
    const execution = executionsS.data.find((row) => row.milestone_id === milestone.id && row.flock_id === flock.id);
    return { ...milestone, flockId: flock.id, flockCode: flock.flock_code, dueDate, execution: execution ?? null, displayStatus: execution ? execution.status === "skipped" ? "Skipped" : "Complete" : dueDate < today ? "Overdue" : "Upcoming" };
  })).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const suggestedRows = standardsS.data.filter((row) => flocksS.data.some((flock) => flock.breed_id === row.breed_id)).map((row) => ({ week_number: number(row.week_number), age_day_start: number(row.week_number) * 7, age_day_end: number(row.week_number) * 7 + 6, feed_intake_std_g_per_head: row.target_feed_g, feed_intake_recommended_g_per_head: row.target_feed_g, target_weight_min_g: roundFeed(number(row.target_weight_g) * .95), target_weight_max_g: roundFeed(number(row.target_weight_g) * 1.05), feed_type_plan: number(row.week_number) < 7 ? "starter_feed" : number(row.week_number) < 18 ? "grower_pullet_feed" : layerMetric ? "layer_feed" : "broiler_feed", light_on_time: "06:00", light_off_time: "18:00" }));

  return feedJson({
    meta: { batchId, today, dateFrom, dateTo, timezone: "Africa/Addis_Ababa", refreshedAt: new Date().toISOString(), sources: sourceStatuses, confidence: legacyDays ? "Estimate" : coveredDays ? "Actual" : "Unavailable", confidenceLabel: legacyDays ? t("estimate") : coveredDays ? t("actual") : t("unavailable") },
    batch: { ...resolved.batch, ageDays: ageToday, totalBirds, flockTypes: [...flockTypes] }, flocks: flocksS.data,
    today: { schedule: scheduleToday ?? null, flocks: todayFlocks },
    kpis: {
      planCompletion: { value: nullable(actualFeed / plannedFeed * 100, plannedFeed > 0), unit: "%", status: plannedFeed > 0 ? t("inProgress") : activeTemplate ? t("awaitingSchedule") : t("notConfigured"), reason: plannedFeed > 0 ? t("planReason", {actual: roundFeed(actualFeed), planned: roundFeed(plannedFeed)}) : t("noPlan") },
      feedVariance: { value: variancePct, unit: "%", ...statusFromVariance(variancePct, warning, critical), label: t((`variance.${statusFromVariance(variancePct, warning, critical).tone}`) as Parameters<typeof t>[0]), actualKg: roundFeed(actualFeed), plannedKg: roundFeed(plannedFeed) },
      feedPerBirdDay: { value: calculateFeedPerBirdDay(actualFeed, birdDays), unit: "g/bird/day", status: birdDays > 0 ? t("available") : t("unavailable"), reason: birdDays > 0 ? t("birdDays", {count: birdDays}) : t("missingOpening") },
      stockCover: { value: inventoryCover, tone: inventoryCover === null ? "neutral" : inventoryCover < 7 ? "critical" : "good", unit: "days", status: inventoryCover === null ? t("unavailable") : inventoryCover < 7 ? t("review") : t("available"), reason: inventoryCover === null ? t("missingConsumption") : t("consumptionDays", {count: trailingDays}) },
      weight: { value: weightedWeight, unit: "g", variancePct: weightVariance, uniformityPct: weightedUniformity, sampleCount: sampleTotal, status: weightedWeight === null ? t("awaitingWeight") : targetSamples === sampleTotal ? t("available") : t("unavailable"), reason: weightedWeight === null ? t("noWeight") : targetSamples === sampleTotal ? t("weightReason", {target: roundFeed(targetMid)}) : t("missingTarget") },
      fcr: { value: applicableFcr, layer:reportFcr.layer,growth:reportFcr.growth, unit: "kg/kg", kind: reportFcr.mixed?t("mixedFcr"):layerMetric ? t("layerFcr") : t("growthFcr"), status: applicableFcr === null ? t("unavailable") : t("available"), reason: reportFcr.mixed?t("mixedFcrReason"):applicableFcr === null ? layerMetric ? t("missingLayerFcr") : t("missingGrowthFcr") : t("validFcr") },
      coverage: { value: !unverifiedArchive&&expectedDays ? roundFeed(coveredFlockDays / expectedDays * 100) : null, unit: "%", coveredDays: coveredFlockDays, expectedDays:unverifiedArchive?null:expectedDays, legacyDays,reason:unverifiedArchive?t("missingCompletion"):null },
    },
    trends: { daily: trend }, inventory: { balances, totalOnHand: roundFeed(totalOnHand), estimatedValue: roundFeed(balances.reduce((sum, row) => sum + row.value, 0)) },
    financials: { feedCostEtb: feedCostEtb !== null ? roundFeed(feedCostEtb) : null, costCoveragePct: nullable(costedFeedKg / actualFeed * 100, actualFeed > 0), leftoversKg: roundFeed(leftoversKg), leftoverPct: nullable(leftoversKg / actualFeed * 100, actualFeed > 0), confidence: feedCostEtb!==null?"Actual":"Unavailable", confidenceLabel: feedCostEtb!==null?t("actual"):t("unavailable") },
    template: activeTemplate ? { ...activeTemplate, rows: templateRows, currentTarget } : null, templateVersions: templatesS.data.map((template) => ({ id: template.id, name: template.name, source_type: template.source_type, is_active: template.is_active, created_at: template.created_at })), suggestedRows,
    tasks: tasks.map(task => ({...task, displayStatusLabel: task.status === "completed" ? task.result ? t("completeResult", {result: t((task.result === "Below target" ? "belowTarget" : task.result === "Above target" ? "aboveTarget" : "onTarget") as Parameters<typeof t>[0])}) : t("missingResult") : task.displayStatus === "Overdue" ? t("overdue") : t("scheduled")})), milestones: milestones.map(item => ({...item, displayStatusLabel: item.execution ? item.execution.status === "skipped" ? t("skipped") : t("complete") : item.displayStatus === "Overdue" ? t("overdue") : t("upcoming")})), nextCheck: pendingTasks[0] ?? { displayStatus: "All checks complete" }, exceptions,
    settings: { warningVariancePct: warning, criticalVariancePct: critical },
    permissions: { canManage: ctx.canManage, canConfigure: false, canRecordWeight: ctx.role === "farm_manager", templateChangeMode: !ctx.canManage ? "read_only" : ctx.supportSessionId ? "direct" : "governance" },
  });
  } catch {return feedJson({error:t("loadFailed")},500);}
}
