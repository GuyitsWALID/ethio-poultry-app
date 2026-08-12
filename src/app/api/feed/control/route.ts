import { addisDate, calculateFeedPerBirdDay, calculateGrowthFcr, calculateInventoryCover, calculateLayerFcr, dateDays, feedAdmin, feedJson, getFeedContext, resolveFeedBatch, roundFeed, statusFromVariance } from "@/lib/feed-control";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;
type SourceResult = { data: Row[]; error: string | null };
type DbResult = { data: unknown; error: { message: string } | null };
type PagedQuery = { range: (from: number, to: number) => PromiseLike<DbResult> };

async function source(query: PagedQuery): Promise<SourceResult> {
  const pageSize = 1000; const data: Row[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await query.range(from, from + pageSize - 1);
    if (result.error) return { data, error: result.error.message };
    const page = Array.isArray(result.data) ? result.data as Row[] : [];
    data.push(...page);
    if (page.length < pageSize) return { data, error: null };
  }
}

const number = (value: unknown) => typeof value === "number" ? value : Number(value ?? 0);
const nullable = (value: number, valid: boolean) => valid && Number.isFinite(value) ? roundFeed(value) : null;

export async function GET(request: Request) {
  const ctx = await getFeedContext();
  if (ctx instanceof Response) return ctx;
  const url = new URL(request.url);
  const batchId = url.searchParams.get("batch_id");
  if (!batchId) return feedJson({ error: "Select a batch to open Feed Control." }, 400);
  const resolved = await resolveFeedBatch(ctx, batchId);
  if (!resolved.batch) return feedJson({ error: resolved.error }, 403);

  const today = addisDate();
  const dateTo = url.searchParams.get("date_to") ?? today;
  const requestedFrom = url.searchParams.get("date_from");
  const dateFrom = requestedFrom ?? new Date(Date.parse(`${dateTo}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  if (dateFrom > dateTo || dateDays(dateFrom, dateTo) > 370) return feedJson({ error: "Use a valid reporting period of 371 days or less." }, 400);
  const sourceFrom = dateFrom < today ? dateFrom : today;
  const sourceTo = dateTo > today ? dateTo : today;

  const db = feedAdmin;
  const org = ctx.orgId;
  const [flocksS, templatesS, schedulesS, sessionsS, closuresS, dailyS, weightsS, tasksS, itemsS, warehousesS, ledgerS, settingsS, standardsS, executionsS] = await Promise.all([
    source(db.from("flocks").select("id,flock_code,flock_type,breed_id,current_count,initial_count,placement_date,age_at_placement_days,farm_id,house_id,status").eq("org_id", org).eq("batch_id", batchId).eq("status", "active")),
    source(db.from("batch_feed_templates").select("id,name,source_type,is_active,created_at,batch_feed_template_rows(*),batch_feed_template_milestones(*)").eq("org_id", org).eq("batch_id", batchId).order("created_at", { ascending: false })),
    source(db.from("feeding_schedules").select("*").eq("org_id", org).eq("batch_id", batchId).gte("schedule_date", sourceFrom).lte("schedule_date", sourceTo).order("schedule_date")),
    source(db.from("feeding_session_records").select("*").eq("org_id", org).is("voided_at",null).eq("batch_id", batchId).gte("record_date", sourceFrom).lte("record_date", sourceTo).order("record_date")),
    source(db.from("feed_day_closures").select("*").eq("org_id", org).eq("batch_id", batchId).gte("record_date", sourceFrom).lte("record_date", sourceTo)),
    Promise.resolve<SourceResult>({ data: [], error: null }),
    Promise.resolve<SourceResult>({ data: [], error: null }),
    source(db.from("batch_weight_check_tasks").select("*,batch_feed_template_rows(age_day_start,age_day_end,target_weight_min_g,target_weight_max_g)").eq("org_id", org).eq("batch_id", batchId).order("due_date")),
    source(db.from("inventory_items").select("id,name,unit,unit_cost,reorder_level").eq("org_id", org).eq("category", "feed").order("name")),
    source(db.from("warehouses").select("id,name,branch_id,type").eq("org_id", org).eq("branch_id", resolved.batch.branch_id).order("name")),
    source(db.from("stock_ledger").select("item_id,warehouse_id,quantity,transaction_type,unit_cost,transaction_date").eq("org_id", org).lte("transaction_date", sourceTo)),
    source(db.from("feed_control_settings").select("warning_variance_pct,critical_variance_pct").eq("org_id", org)),
    source(db.from("breed_standards").select("breed_id,week_number,target_feed_g,target_weight_g").eq("org_id", org).order("week_number")),
    source(db.from("feed_milestone_executions").select("*").eq("org_id", org)),
  ]);

  const flockIds = flocksS.data.map((row) => String(row.id));
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
  if (flocksS.error) return feedJson({ error: flocksS.error, meta: { sources: sourceStatuses } }, 500);

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

  const todayFlocks = flocksS.data.map((flock) => {
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

  let actualFeed = 0; let plannedFeed = 0; let birdDays = 0; let coveredDays = 0; let coveredFlockDays = 0; let expectedFlockDays = 0; let eggMassKg = 0; let legacyDays = 0;
  const trend = [] as Row[];
  for (let offset = 0; offset <= dateDays(dateFrom, dateTo); offset += 1) {
    const date = new Date(Date.parse(`${dateFrom}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
    const schedule = schedulesS.data.find((row) => row.schedule_date === date);
    let dayActual = 0; let dayBirds = 0; let isCovered = false; let isLegacy = false;
    for (const flock of flocksS.data) {
      const eligible = date >= String(flock.placement_date) && date <= today;
      if (eligible) expectedFlockDays += 1;
      const closed = closures.get(`${flock.id}:${date}`)?.status === "closed";
      const rows = sessionsS.data.filter((row) => row.flock_id === flock.id && row.record_date === date);
      const daily = dailyByKey.get(`${flock.id}:${date}`);
      if (closed && rows.length) { dayActual += rows.reduce((sum, row) => sum + number(row.actual_feed_kg), 0); isCovered = true; if (eligible) coveredFlockDays += 1; }
      else if (daily && (daily.feed_intake_grams !== null || daily.feed_intake_quantity !== null)) { dayActual += daily.feed_intake_grams !== null ? number(daily.feed_intake_grams) / 1000 : number(daily.feed_intake_quantity); isCovered = true; isLegacy = true; if (eligible) coveredFlockDays += 1; }
      if (daily?.opening_birds !== null && daily?.opening_birds !== undefined) dayBirds += number(daily.opening_birds);
      if (daily?.total_eggs && daily?.average_egg_weight_g) eggMassKg += number(daily.total_eggs) * number(daily.average_egg_weight_g) / 1000;
    }
    const dayPlan = schedule ? number(schedule.planned_feed_kg) : 0;
    actualFeed += dayActual; plannedFeed += dayPlan; birdDays += dayBirds;
    if (isCovered) coveredDays += 1; if (isLegacy) legacyDays += 1;
    trend.push({ date, plannedKg: roundFeed(dayPlan), actualKg: isCovered ? roundFeed(dayActual) : null, openingBirds: dayBirds || null, source: isLegacy ? "Legacy daily total" : isCovered ? "Closed sessions" : "Missing" });
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
  const itemCosts = new Map(itemsS.data.filter((item) => item.unit_cost !== null).map((item) => [String(item.id), number(item.unit_cost)]));
  const closedSessions = sessionsS.data.filter((row) => String(row.record_date) >= dateFrom && String(row.record_date) <= dateTo && closures.get(`${row.flock_id}:${row.record_date}`)?.status === "closed" && row.actual_feed_kg !== null);
  const costedFeedKg = closedSessions.filter((row) => row.feed_item_id && itemCosts.has(String(row.feed_item_id))).reduce((sum, row) => sum + number(row.actual_feed_kg), 0);
  const feedCostEtb = closedSessions.reduce((sum, row) => sum + number(row.actual_feed_kg) * (itemCosts.get(String(row.feed_item_id)) ?? 0), 0);
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
  const layerMetric = flockTypes.size === 1 && flockTypes.has("layer");
  let growthFcr: number | null = null;
  if (!layerMetric) {
    const usable = flocksS.data.map((flock) => weightsS.data.filter((row) => row.flock_id === flock.id && String(row.record_date) >= dateFrom && String(row.record_date) <= dateTo)).filter((rows) => rows.length >= 2);
    const gainKg = usable.reduce((sum, rows) => { const first = rows[0], last = rows.at(-1)!; return sum + Math.max(0, (number(last.average_weight_g) - number(first.average_weight_g)) * number(flocksS.data.find((f) => f.id === last.flock_id)?.current_count) / 1000); }, 0);
    const intervalFeed = usable.reduce((sum, rows) => {
      const first = rows[0]; const last = rows.at(-1)!; const flockId = String(last.flock_id); const start = String(first.record_date); const end = String(last.record_date);
      let flockFeed = 0;
      for (let offset = 0; offset <= dateDays(start, end); offset += 1) {
        const date = new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
        const sessionRows = sessionsS.data.filter((row) => row.flock_id === flockId && row.record_date === date);
        if (closures.get(`${flockId}:${date}`)?.status === "closed" && sessionRows.length) flockFeed += sessionRows.reduce((total, row) => total + number(row.actual_feed_kg), 0);
        else { const legacy = dailyByKey.get(`${flockId}:${date}`); if (legacy) flockFeed += legacy.feed_intake_grams !== null ? number(legacy.feed_intake_grams) / 1000 : number(legacy.feed_intake_quantity); }
      }
      return sum + flockFeed;
    }, 0);
    growthFcr = calculateGrowthFcr(intervalFeed, gainKg);
  }
  const applicableFcr = layerMetric ? calculateLayerFcr(actualFeed, eggMassKg) : growthFcr;
  const expectedDays = expectedFlockDays;
  const exceptions: Row[] = [];
  if (!activeTemplate) exceptions.push({ severity: "critical", title: "Feed template not configured", reason: "This batch has no active age-based ration and weight standard.", action: "Open template management" });
  else if (!currentTarget) exceptions.push({ severity: "critical", title: "Batch age is outside the active template", reason: `Age day ${ageToday} has no matching template row.`, action: "Extend template age ranges" });
  if (todayFlocks.some((flock) => flock.sessions.some((session: Row) => session.status !== "completed"))) exceptions.push({ severity: "warning", title: "Today’s feeding is incomplete", reason: "Complete each planned session before closing the day.", action: "Record today’s sessions" });
  if (coveredFlockDays < expectedDays) exceptions.push({ severity: "warning", title: `${expectedDays - coveredFlockDays} flock-days missing`, reason: "Coverage includes closed sessions and clearly labelled legacy daily totals only; pre-placement and future dates are excluded.", action: "Reconcile feed history" });
  if (inventoryCover !== null && inventoryCover < 7) exceptions.push({ severity: inventoryCover < 3 ? "critical" : "warning", title: "Feed cover is low", reason: `${inventoryCover} days of compatible stock remain at the current consumption rate.`, action: "Review Inventory" });

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
    meta: { batchId, today, dateFrom, dateTo, timezone: "Africa/Addis_Ababa", refreshedAt: new Date().toISOString(), sources: sourceStatuses, confidence: legacyDays ? "Estimate" : coveredDays ? "Actual" : "Unavailable" },
    batch: { ...resolved.batch, ageDays: ageToday, totalBirds, flockTypes: [...flockTypes] }, flocks: flocksS.data,
    today: { schedule: scheduleToday ?? null, flocks: todayFlocks },
    kpis: {
      planCompletion: { value: nullable(actualFeed / plannedFeed * 100, plannedFeed > 0), unit: "%", status: plannedFeed > 0 ? "In progress" : activeTemplate ? "Awaiting schedule" : "Not configured", reason: plannedFeed > 0 ? `${roundFeed(actualFeed)} kg recorded against ${roundFeed(plannedFeed)} kg planned.` : "No planned feed exists in the selected period." },
      feedVariance: { value: variancePct, unit: "%", ...statusFromVariance(variancePct, warning, critical), actualKg: roundFeed(actualFeed), plannedKg: roundFeed(plannedFeed) },
      feedPerBirdDay: { value: calculateFeedPerBirdDay(actualFeed, birdDays), unit: "g/bird/day", status: birdDays > 0 ? "Available" : "Unavailable", reason: birdDays > 0 ? `${birdDays.toLocaleString()} opening bird-days.` : "Opening birds are missing from daily records." },
      stockCover: { value: inventoryCover, unit: "days", status: inventoryCover === null ? "Unavailable" : inventoryCover < 7 ? "Review" : "Available", reason: inventoryCover === null ? "Stock or consumption history is missing." : `Based on ${trailingDays} covered consumption days.` },
      weight: { value: weightedWeight, unit: "g", variancePct: weightVariance, uniformityPct: weightedUniformity, sampleCount: sampleTotal, status: weightedWeight === null ? "Awaiting weight sample" : targetSamples === sampleTotal ? "Available" : "Unavailable", reason: weightedWeight === null ? "No weight sample is recorded." : targetSamples === sampleTotal ? `Sample-count weighted; each result is compared with its target at the sample’s actual age (${roundFeed(targetMid)} g weighted midpoint).` : "One or more samples has no target at its recorded age." },
      fcr: { value: applicableFcr, unit: "kg/kg", kind: layerMetric ? "Layer feed / egg mass" : "Growth feed / biomass gain", status: applicableFcr === null ? "Unavailable" : "Available", reason: applicableFcr === null ? layerMetric ? "Recorded average egg weights and egg output are required." : "Two valid weights and feed within the measurement interval are required." : "Calculated only from compatible production inputs." },
      coverage: { value: expectedDays ? roundFeed(coveredFlockDays / expectedDays * 100) : null, unit: "%", coveredDays: coveredFlockDays, expectedDays, legacyDays },
    },
    trends: { daily: trend }, inventory: { balances, totalOnHand: roundFeed(totalOnHand), estimatedValue: roundFeed(balances.reduce((sum, row) => sum + row.value, 0)) },
    financials: { feedCostEtb: costedFeedKg > 0 ? roundFeed(feedCostEtb) : null, costCoveragePct: nullable(costedFeedKg / actualFeed * 100, actualFeed > 0), leftoversKg: roundFeed(leftoversKg), leftoverPct: nullable(leftoversKg / actualFeed * 100, actualFeed > 0), confidence: legacyDays || costedFeedKg < actualFeed ? "Estimate" : costedFeedKg > 0 ? "Actual" : "Unavailable" },
    template: activeTemplate ? { ...activeTemplate, rows: templateRows, currentTarget } : null, templateVersions: templatesS.data.map((template) => ({ id: template.id, name: template.name, source_type: template.source_type, is_active: template.is_active, created_at: template.created_at })), suggestedRows,
    tasks, milestones, nextCheck: pendingTasks[0] ?? { displayStatus: "All checks complete" }, exceptions,
    settings: { warningVariancePct: warning, criticalVariancePct: critical },
    permissions: { canManage: ctx.canManage, canConfigure: false, canRecordWeight: ctx.role === "farm_manager" },
  });
}
