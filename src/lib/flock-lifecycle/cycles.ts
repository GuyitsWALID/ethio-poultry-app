import "server-only";
import {canAccessFarm, governanceAdmin, type AccessContext} from "@/lib/access-context";
import {addisOperatingDate, FlockLifecycleError} from "./server";
import {createCycleSchema, closeCycleSchema, wholeFlockMoveSchema, type CycleContext, type MovementContext} from "./cycle-contracts";
import type {GovernanceInput} from "@/lib/governance-workflow";
import {hasTaskEvidence} from "@/lib/today-workspace/task-evidence";
import {cycleSubmissionIdentity} from "./submission-identity";

// New schema is isolated here until the generated database catalogue is refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = governanceAdmin as any;
type Row = Record<string, unknown>;
const rows = (value: {data: Row[] | null; error: unknown}): Row[] => {
  if (value.error || !value.data) throw new FlockLifecycleError("LOAD_FAILED", 500);
  if (value.data.length >= 1000) throw new FlockLifecycleError("SOURCE_LIMIT", 409);
  return value.data;
};
async function token(name: string, args: Record<string, unknown>): Promise<string> {
  const result = await db.rpc(name, args);
  if (result.error || typeof result.data !== "string") throw new FlockLifecycleError("LOAD_FAILED", 500);
  return result.data;
}

export async function loadMovementContext(ctx: AccessContext, flockId: string): Promise<MovementContext> {
  if (ctx.role !== "farm_manager") throw new FlockLifecycleError("UNAVAILABLE", 404);
  const result = await db.from("flocks").select("id,flock_code,farm_id,house_id,batch_id,current_count,status,completed_at").eq("org_id", ctx.orgId).eq("id", flockId).maybeSingle();
  if (result.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
  const flock = result.data;
  if (!flock || !(await canAccessFarm(ctx, flock.farm_id))) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const chain = await db.rpc("valid_flock_movement_chain", {p_org: ctx.orgId, p_flock: flockId});
  if (chain.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
  const batch = flock.batch_id ? await db.from("batches").select("batch_cycle_id").eq("id", flock.batch_id).eq("org_id", ctx.orgId).maybeSingle() : {data: null, error: null};
  if (batch.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
  return {flock: {id: flock.id, code: flock.flock_code, farmId: flock.farm_id, houseId: flock.house_id,
    birds: flock.current_count, revision: await token("lifecycle_flock_revision", {p_org: ctx.orgId, p_flock: flockId}),
    eligible: Boolean(batch.data?.batch_cycle_id && chain.data === true && ["active", "quarantined"].includes(flock.status) && !flock.completed_at && flock.current_count > 0)}};
}

export async function cycleSubmissionHash(input: GovernanceInput): Promise<string> {
  const bytes = new TextEncoder().encode(cycleSubmissionIdentity(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function recoverCycleSubmission(ctx: AccessContext, input: GovernanceInput, hash: string) {
  if (!input.idempotency_key) return null;
  if (ctx.role !== "farm_manager" || !input.farm_id || !(await canAccessFarm(ctx, input.farm_id))) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const result = await db.from("governance_requests").select("*").eq("org_id", ctx.orgId).eq("requested_by", ctx.userId).eq("idempotency_key", input.idempotency_key).maybeSingle();
  if (result.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
  if (!result.data) return null;
  if (result.data.context_snapshot?.cycle_submission_hash !== hash) throw new Error("CYCLE_REQUEST_ID_REUSED");
  return result.data;
}

export async function resolveCycleTarget(ctx: AccessContext, target: {farmId: string | null; cycleId: string | null; batchId: string | null}) {
  let {farmId, cycleId} = target;
  if (target.batchId) {
    const result = await db.from("batches").select("farm_id,batch_cycle_id").eq("org_id", ctx.orgId).eq("id", target.batchId).maybeSingle();
    if (result.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
    if (!result.data?.batch_cycle_id || (farmId && farmId !== result.data.farm_id) || (cycleId && cycleId !== result.data.batch_cycle_id)) throw new FlockLifecycleError("UNAVAILABLE", 404);
    farmId = result.data.farm_id; cycleId = result.data.batch_cycle_id;
  }
  if (cycleId) {
    const result = await db.from("batch_cycles").select("farm_id").eq("org_id", ctx.orgId).eq("id", cycleId).maybeSingle();
    if (result.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
    if (!result.data || (farmId && farmId !== result.data.farm_id)) throw new FlockLifecycleError("UNAVAILABLE", 404);
    farmId = result.data.farm_id;
  }
  if (!farmId || !(await canAccessFarm(ctx, farmId))) throw new FlockLifecycleError("UNAVAILABLE", 404);
  return {farmId, cycleId};
}

export async function loadCycleContext(ctx: AccessContext, farmId: string, cycleId: string | null, day = addisOperatingDate()): Promise<CycleContext> {
  if ((ctx.role !== "farm_manager" && ctx.role !== "ceo" && !ctx.supportSessionId) || !(await canAccessFarm(ctx, farmId))) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const farmResult = await db.from("farms").select("id,name").eq("id", farmId).eq("org_id", ctx.orgId).maybeSingle();
  if (farmResult.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
  if (!farmResult.data) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const [houseResult, flockResult, batchResult, clearanceResult, cycleResult, breedResult, saleResult, allCyclesResult, moveResult] = await Promise.all([
    db.from("houses").select("id,name,farm_id").eq("org_id", ctx.orgId).order("name").limit(1000),
    db.from("flocks").select("id,flock_code,house_id,batch_id,current_count,status,farm_id,flock_type").eq("org_id", ctx.orgId).limit(1000),
    db.from("batches").select("id,batch_code,batch_cycle_id").eq("org_id", ctx.orgId).limit(1000),
    db.from("batch_cycle_clearances").select("flock_id,house_id").eq("org_id", ctx.orgId).limit(1000),
    cycleId ? db.from("batch_cycles").select("id,cycle_code,status,legacy_singleton,completion_verified,farm_id,updated_at").eq("org_id", ctx.orgId).eq("farm_id", farmId).eq("id", cycleId).maybeSingle() : Promise.resolve({data: null, error: null}),
    db.from("breeds").select("id,name").eq("org_id", ctx.orgId).order("name").limit(1000),
    db.from("daily_sales_records").select("id,product_label,sale_date,unit,quantity,flock_id,batch_id,farm_id").eq("org_id", ctx.orgId).eq("product_category", "bird").is("voided_at", null).lte("sale_date", day).order("sale_date", {ascending: false}).limit(1000),
    db.from("batch_cycles").select("id,cycle_code,status,completion_verified,farm_id").eq("org_id", ctx.orgId).order("placement_date", {ascending: false}).limit(1000),
    db.from("flock_transfers").select("flock_id,from_house_id").eq("org_id", ctx.orgId).limit(1000),
  ]);
  const houses = rows(houseResult), flocks = rows(flockResult), batches = rows(batchResult), clearances = rows(clearanceResult), breeds = rows(breedResult), allSales = rows(saleResult), moves = rows(moveResult), allCycles = rows(allCyclesResult);
  if (cycleResult.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
  if (cycleId && !cycleResult.data) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const cycle = cycleResult.data;
  const memberBatches = new Map(batches.filter(row => row.batch_cycle_id === cycleId).map(row => [String(row.id), row]));
  const members = cycleId ? flocks.filter(row => memberBatches.has(String(row.batch_id))) : [];
  const memberFarms = new Set([farmId, ...members.map(row => String(row.farm_id))]);
  for (const memberFarm of memberFarms) if (!(await canAccessFarm(ctx, memberFarm))) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const sales = allSales.filter(row => memberFarms.has(String(row.farm_id)));
  const ids = members.map(row => String(row.id));
  const empty = {data: [], error: null};
  const [dailyResult, feedResult, allocationsResult, attestationResult, healthResult, mortalityResult, suppliesResult, confirmationsResult] = await Promise.all([
    ids.length ? db.from("daily_farm_records").select("flock_id,opening_birds,closing_birds,deaths,culls,transfers_in,transfers_out,other_removals,normal_eggs,broken_eggs,dirty_eggs,total_eggs,water_consumed_liters").eq("org_id", ctx.orgId).in("flock_id", ids).eq("record_date", day).is("voided_at", null).limit(1000) : empty,
    ids.length ? db.from("feed_day_closures").select("flock_id,status").eq("org_id", ctx.orgId).in("flock_id", ids).eq("record_date", day).limit(1000) : empty,
    sales.length ? db.from("effective_cycle_dispositions").select("sale_id,quantity").eq("org_id", ctx.orgId).in("sale_id", sales.map(row => row.id)).limit(1000) : empty,
    sales.length ? db.from("bird_sale_head_count_attestations").select("sale_id,head_count").eq("org_id", ctx.orgId).in("sale_id", sales.map(row => row.id)).limit(1000) : empty,
    ids.length ? db.from("health_events").select("flock_id").eq("org_id", ctx.orgId).in("flock_id", ids).eq("event_date", day).is("voided_at", null).limit(1000) : empty,
    ids.length ? db.from("mortality_events").select("flock_id").eq("org_id", ctx.orgId).in("flock_id", ids).eq("record_date", day).limit(1000) : empty,
    ids.length ? db.from("stock_ledger").select("flock_id").eq("org_id", ctx.orgId).in("flock_id", ids).eq("transaction_date", day).eq("source_kind", "daily_record_usage").limit(1000) : empty,
    ids.length ? db.from("daily_task_attestations").select("flock_id,task_code,source_fingerprint").eq("org_id", ctx.orgId).in("flock_id", ids).eq("work_date", day).is("superseded_at", null).limit(1000) : empty,
  ]);
  const daily = rows(dailyResult), feeds = rows(feedResult), allocations = rows(allocationsResult), attestations = rows(attestationResult);
  const health = rows(healthResult), mortality = rows(mortalityResult), supplies = rows(suppliesResult), confirmations = rows(confirmationsResult);
  const fingerprints = new Map(await Promise.all(ids.flatMap(flockId => ["health_deaths", "routine_supplies"].map(async taskCode => [
    `${flockId}:${taskCode}`, await token("today_source_fingerprint", {p_farm_id: members.find(row => row.id === flockId)!.farm_id, p_flock_id: flockId, p_work_date: day, p_task_code: taskCode}),
  ] as const))));
  const cleared = new Set(clearances.map(row => row.flock_id));
  return {
    farm: {id: farmId, name: String(farmResult.data.name)}, day,
    cycles: allCycles.filter(row => row.farm_id === farmId).map(row => ({id: String(row.id), code: String(row.cycle_code), status: String(row.status), completionVerified: Boolean(row.completion_verified)})),
    cycle: cycle ? {id: String(cycle.id), code: String(cycle.cycle_code), status: String(cycle.status), legacy: Boolean(cycle.legacy_singleton), completionVerified: Boolean(cycle.completion_verified), revision: await token("lifecycle_cycle_revision", {p_org: ctx.orgId, p_cycle: cycleId, p_day: day})} : null,
    houses: await Promise.all(houses.filter(row => row.farm_id === farmId).map(async house => {
      const present = flocks.filter(row => row.house_id === house.id);
      const occupied = present.some(row => row.status === "active" || row.status === "quarantined");
      const departed = moves.filter(row => row.from_house_id === house.id).map(row => flocks.find(flock => flock.id === row.flock_id));
      const unverified = present.some(row => !cleared.has(row.id)) || departed.some(row => !row || !allCycles.find(c => c.id === batches.find(b => b.id === row.batch_id)?.batch_cycle_id)?.completion_verified);
      return {id: String(house.id), name: String(house.name), eligible: !occupied && !unverified, blocker: occupied ? "OCCUPIED" as const : unverified ? "COMPLETION_UNVERIFIED" as const : null, revision: await token("lifecycle_house_revision", {p_org: ctx.orgId, p_house: house.id})};
    })),
    members: members.map(member => {
      const record = daily.find(row => row.flock_id === member.id), layer = member.flock_type === "layer" || member.flock_type === "parent_stock";
      const complete = Boolean(record && ["opening_birds", "closing_birds", "deaths", "culls", "water_consumed_liters", ...(layer ? ["normal_eggs", "broken_eggs", "dirty_eggs", "total_eggs"] : [])].every(field => record[field] !== null));
      const expected = record ? Number(record.opening_birds) + Number(record.transfers_in ?? 0) - Number(record.deaths) - Number(record.culls) - Number(record.transfers_out ?? 0) - Number(record.other_removals ?? 0) : null;
      const confirmed = (taskCode: string, hasActivity: boolean) => hasTaskEvidence({hasActivity, sourceFingerprint: fingerprints.get(`${member.id}:${taskCode}`) ?? "", attestationFingerprint: String(confirmations.find(row => row.flock_id === member.id && row.task_code === taskCode)?.source_fingerprint ?? "") || null});
      return {id: String(member.id), code: String(member.flock_code), house: String(houses.find(row => row.id === member.house_id)?.name ?? ""), batch: String(memberBatches.get(String(member.batch_id))?.batch_code ?? ""), currentBirds: Number(member.current_count), finalRecord: complete, feedClosed: feeds.some(row => row.flock_id === member.id && row.status === "closed"), balanced: complete && record?.closing_birds === expected && record?.closing_birds === member.current_count,
        healthConfirmed: confirmed("health_deaths", Number(record?.deaths ?? 0) + Number(record?.culls ?? 0) > 0 || health.some(row => row.flock_id === member.id) || mortality.some(row => row.flock_id === member.id)),
        suppliesConfirmed: confirmed("routine_supplies", supplies.some(row => row.flock_id === member.id)),
        finalValues: record ? {date: day, opening: record.opening_birds === null ? null : Number(record.opening_birds), deaths: record.deaths === null ? null : Number(record.deaths), culls: record.culls === null ? null : Number(record.culls), otherRemovals: Number(record.other_removals ?? 0), closing: record.closing_birds === null ? null : Number(record.closing_birds)} : null};
    }),
    sales: await Promise.all(sales.map(async sale => ({id: String(sale.id), label: String(sale.product_label), date: String(sale.sale_date), unit: String(sale.unit), quantity: Number(sale.quantity), headCount: String(sale.unit).trim().toLowerCase() === "bird" ? Number(sale.quantity) : Number(attestations.find(row => row.sale_id === sale.id)?.head_count ?? 0) || null, allocated: allocations.filter(row => row.sale_id === sale.id).reduce((sum, row) => sum + Number(row.quantity), 0), revision: await token("lifecycle_sale_revision", {p_sale: sale.id, p_org: ctx.orgId})}))),
    breeds: breeds.map(row => ({id: String(row.id), name: String(row.name)})),
  };
}

export async function prepareCycleProposal(ctx: AccessContext, input: GovernanceInput) {
  if (ctx.role !== "farm_manager") throw new FlockLifecycleError("UNAVAILABLE", 404);
  if (input.request_type === "flock_transfer") {
    const parsed = wholeFlockMoveSchema.safeParse(input.proposed_values);
    if (!parsed.success) throw new Error("Refresh the whole-flock count, actual movement time and destination for CEO review.");
    const p = parsed.data;
    const result = await db.from("flocks").select("id,farm_id,house_id,current_count,status").eq("org_id", ctx.orgId).eq("id", p.flock_id).maybeSingle();
    if (result.error) throw new FlockLifecycleError("LOAD_FAILED", 500);
    const flock = result.data;
    if (!flock || !(await canAccessFarm(ctx, flock.farm_id)) || !(await canAccessFarm(ctx, p.farm_id))) throw new FlockLifecycleError("UNAVAILABLE", 404);
    if (input.farm_id !== flock.farm_id || p.from_house_id !== flock.house_id || p.bird_count !== flock.current_count) throw new Error("CYCLE_SOURCE_CHANGED");
    const destination = await loadCycleContext(ctx, p.farm_id, null);
    const house = destination.houses.find(row => row.id === p.house_id);
    if (!house?.eligible || house.revision !== p.destination_revision || p.expected_revision !== await token("lifecycle_flock_revision", {p_org: ctx.orgId, p_flock: p.flock_id})) throw new Error("CYCLE_SOURCE_CHANGED");
    return {...input, farm_id: flock.farm_id, source_table: "flocks", source_id: p.flock_id, source_version: null, changed_fields: ["farm_id", "house_id", "approved_whole_flock_movement"], proposed_values: p, correction_route: `/app/flocks?flock=${p.flock_id}`};
  }
  if (input.request_type === "batch_cycle_create") {
    const parsed = createCycleSchema.safeParse(input.proposed_values);
    if (!parsed.success) throw new Error("CYCLE_INVALID_FIELDS");
    const p = parsed.data;
    const context = await loadCycleContext(ctx, p.farm_id, null);
    for (const placement of p.placements) {
      const house = context.houses.find(row => row.id === placement.house_id);
      if (!house?.eligible) throw new Error("CYCLE_HOUSE_UNAVAILABLE");
      if (house.revision !== placement.expected_revision) throw new Error("CYCLE_SOURCE_CHANGED");
    }
    return {...input, farm_id: p.farm_id, source_table: null, source_id: null, source_version: null, changed_fields: ["placements", "actual_placement"], proposed_values: p, correction_route: `/app/flocks?filter_page_tab=batches&farm_id=${p.farm_id}`};
  }
  const parsed = closeCycleSchema.safeParse(input.proposed_values);
  if (!parsed.success || !input.farm_id) throw new Error("CYCLE_INVALID_FIELDS");
  const p = parsed.data, parts = new Intl.DateTimeFormat("en-CA", {timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(new Date(p.completed_at));
  const part = (type: string) => parts.find(row => row.type === type)!.value;
  const context = await loadCycleContext(ctx, input.farm_id, p.cycle_id, `${part("year")}-${part("month")}-${part("day")}`);
  if (context.cycle?.revision !== p.expected_revision) throw new Error("CYCLE_SOURCE_CHANGED");
  if (p.dispositions.some(row => !context.members.some(member => member.id === row.flock_id))) throw new Error("CYCLE_INVALID_FIELDS");
  return {...input, source_table: "batch_cycles", source_id: p.cycle_id, source_version: null, changed_fields: ["completion", "dispositions", "final_records"], proposed_values: p, correction_route: `/app/flocks?filter_page_tab=batches&farm_id=${context.farm.id}&cycle=${p.cycle_id}`};
}
