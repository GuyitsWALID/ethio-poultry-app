import "server-only";
import {canAccessFarm, governanceAdmin, type AccessContext} from "@/lib/access-context";
import {FlockLifecycleError} from "./server";
import {archivedBirdFields, archivedCycleCorrectionSchema, type ArchivedCorrectionContext} from "./cycle-contracts";
import type {GovernanceInput} from "@/lib/governance-workflow";

// Isolate additions until the generated schema catalogue is refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = governanceAdmin as any;
export async function loadArchivedCorrectionContext(ctx: AccessContext, cycleId: string): Promise<ArchivedCorrectionContext> {
  if (!["farm_manager", "ceo"].includes(ctx.role) || ctx.supportSessionId) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const {data: cycle, error} = await db.from("batch_cycles").select("id,cycle_code,farm_id,status,completion_verified").eq("org_id", ctx.orgId).eq("id", cycleId).maybeSingle();
  if (error) throw new FlockLifecycleError("LOAD_FAILED", 500);
  if (!cycle || cycle.status !== "archived" || !cycle.completion_verified || !(await canAccessFarm(ctx, cycle.farm_id))) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const batches = await db.from("batches").select("id").eq("org_id", ctx.orgId).eq("batch_cycle_id", cycleId).limit(1000);
  if (batches.error || !batches.data?.length || batches.data.length >= 1000) throw new FlockLifecycleError("LOAD_FAILED", 500);
  const flocks = await db.from("flocks").select("id,flock_code,house_id,farm_id").eq("org_id", ctx.orgId).in("batch_id", batches.data.map((b: {id: string}) => b.id)).limit(1000);
  if (flocks.error || !flocks.data?.length || flocks.data.length >= 1000) throw new FlockLifecycleError("LOAD_FAILED", 500);
  for (const flock of flocks.data) if (!(await canAccessFarm(ctx, flock.farm_id))) throw new FlockLifecycleError("UNAVAILABLE", 404);
  const ids = flocks.data.map((f: {id: string}) => f.id);
  const [daily, clearances, houses, closures, revision, deaths, culls, departures, sales] = await Promise.all([
    db.from("daily_farm_records").select(`id,flock_id,record_date,${archivedBirdFields.join(",")}`).eq("org_id", ctx.orgId).in("flock_id", ids).is("voided_at", null).order("record_date", {ascending: false}).limit(501),
    db.from("batch_cycle_clearances").select("daily_record_id").eq("org_id", ctx.orgId).in("flock_id", ids).limit(1000),
    db.from("houses").select("id,name").eq("org_id", ctx.orgId).in("id", flocks.data.map((f: {house_id: string}) => f.house_id)).limit(1000),
    db.from("batch_cycle_closures").select("mode").eq("org_id", ctx.orgId).eq("cycle_id", cycleId).single(),
    db.rpc("archived_cycle_revision", {p_org: ctx.orgId, p_cycle: cycleId}),
    db.from("mortality_events").select("id,flock_id,record_date,count,cause").eq("org_id",ctx.orgId).in("flock_id",ids).limit(1001),
    db.from("flock_cull_events").select("id,flock_id,record_date,count,reason").eq("org_id",ctx.orgId).in("flock_id",ids).limit(1001),
    db.from("effective_cycle_dispositions").select("flock_id,kind,quantity,sale_id,reason,supporting_reference").eq("org_id",ctx.orgId).eq("cycle_id",cycleId).limit(501),
    db.rpc("archived_cycle_sale_choices",{p_org:ctx.orgId,p_cycle:cycleId}),
  ]);
  if ([daily, clearances, houses, closures, revision, deaths, culls, departures, sales].some(r => r.error)) throw new FlockLifecycleError("LOAD_FAILED", 500);
  if (closures.data.mode !== "close") throw new FlockLifecycleError("UNAVAILABLE", 404);
  if (daily.data.length > 500 || deaths.data.length>1000 || culls.data.length>1000 || departures.data.length>500 || sales.data.length>500) throw new FlockLifecycleError("SOURCE_LIMIT", 409);
  const saleChoices:ArchivedCorrectionContext["sales"]=sales.data.map((s:{id:string;label:string;revision:string;unit:string;head_count:number|null})=>({id:s.id,label:s.label,revision:s.revision,headCount:s.head_count,unit:s.unit}));
  const lossEvents:ArchivedCorrectionContext["lossEvents"]=[];
  for(const [kind,result,explanation] of [["death",deaths,"cause"],["cull",culls,"reason"]] as const) for(const event of result.data){
    const record=daily.data.find((d:{id:string;flock_id:string;record_date:string})=>d.flock_id===event.flock_id&&d.record_date===event.record_date);
    if(!record)throw new FlockLifecycleError("SOURCE_LIMIT",409);
    lossEvents.push({id:event.id,record_id:record.id,kind,count:event.count,explanation:event[explanation]||""});
  }
  return {cycle: {id: cycle.id, code: cycle.cycle_code, farmId: cycle.farm_id, revision: revision.data},
    members:flocks.data.map((f:{id:string;flock_code:string})=>({id:f.id,label:f.flock_code})),sales:saleChoices,lossEvents,
    departures:departures.data.map((d:{flock_id:string;kind:string;quantity:number;sale_id:string;reason:string;supporting_reference:string})=>d.kind==="sale"?{kind:"sale",flock_id:d.flock_id,quantity:d.quantity,sale_id:d.sale_id,sale_revision:saleChoices.find(s=>s.id===d.sale_id)?.revision??"",supporting_reference:d.supporting_reference||undefined}:{kind:"other",flock_id:d.flock_id,quantity:d.quantity,reason:d.reason,supporting_reference:d.supporting_reference}),
    records: daily.data.map((d: Record<string, unknown>) => {
      const flock = flocks.data.find((f: {id: string}) => f.id === d.flock_id);
      return {id: String(d.id), date: String(d.record_date), flock: String(flock.flock_code), house: String(houses.data.find((h: {id: string}) => h.id === flock.house_id)?.name ?? ""),
        final: clearances.data.some((e: {daily_record_id: string}) => e.daily_record_id === d.id),
        ...Object.fromEntries(archivedBirdFields.map(field => [field, d[field] === null ? null : Number(d[field])]))} as ArchivedCorrectionContext["records"][number];
    })};
}

export async function prepareArchivedCorrection(ctx: AccessContext, input: GovernanceInput) {
  const parsed = archivedCycleCorrectionSchema.safeParse(input.proposed_values);
  if (!parsed.success) throw new Error("CYCLE_INVALID_FIELDS");
  const p = parsed.data, context = await loadArchivedCorrectionContext(ctx, p.cycle_id);
  if (input.farm_id !== context.cycle.farmId || p.expected_revision !== context.cycle.revision) throw new Error("CYCLE_SOURCE_CHANGED");
  if (p.records.some(row => !context.records.some(current => current.id === row.id))) throw new Error("CYCLE_INVALID_FIELDS");
  if(p.departures?.some(row=>!context.members.some(m=>m.id===row.flock_id)||(row.kind==="sale"&&!context.sales.some(s=>s.id===row.sale_id))))throw new Error("CYCLE_INVALID_FIELDS");
  return {...input, source_table: "batch_cycles", source_id: p.cycle_id, source_version: null,
    changed_fields: ["archived_bird_history"], proposed_values: p,
    correction_route: `/app/flocks?filter_page_tab=batches&farm_id=${context.cycle.farmId}&cycle=${p.cycle_id}`};
}
