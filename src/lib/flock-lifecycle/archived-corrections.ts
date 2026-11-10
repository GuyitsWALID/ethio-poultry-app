import "server-only";
import {canAccessFarm, governanceAdmin, type AccessContext} from "@/lib/access-context";
import {FlockLifecycleError} from "./server";
import {archivedBirdFields, archivedCycleCorrectionSchema, type ArchivedCorrectionContext} from "./cycle-contracts";
import type {GovernanceInput} from "@/lib/governance-workflow";
import {readReportQuery} from "@/lib/report-pagination";
import {z} from "zod";

// Isolate additions until the generated schema catalogue is refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = governanceAdmin as any;
export async function loadArchivedCorrectionContext(ctx: AccessContext, cycleId: string, options: {cursor?:string; recordIds?:string[]; revision?:string}={}): Promise<ArchivedCorrectionContext> {
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
  const dailyQuery=()=>db.from("daily_farm_records").select(`id,flock_id,record_date,${archivedBirdFields.join(",")}`).eq("org_id",ctx.orgId).in("flock_id",ids).is("voided_at",null);
  const [clearances, houses, closures, revision, departures, sales] = await Promise.all([
    db.from("batch_cycle_clearances").select("daily_record_id").eq("org_id", ctx.orgId).in("flock_id", ids).limit(1000),
    db.from("houses").select("id,name").eq("org_id", ctx.orgId).in("id", flocks.data.map((f: {house_id: string}) => f.house_id)).limit(1000),
    db.from("batch_cycle_closures").select("mode").eq("org_id", ctx.orgId).eq("cycle_id", cycleId).single(),
    db.rpc("archived_cycle_revision", {p_org: ctx.orgId, p_cycle: cycleId}),
    db.from("effective_cycle_dispositions").select("flock_id,kind,quantity,sale_id,reason,supporting_reference").eq("org_id",ctx.orgId).eq("cycle_id",cycleId).limit(501),
    db.rpc("archived_cycle_sale_choices",{p_org:ctx.orgId,p_cycle:cycleId}),
  ]);
  if ([clearances, houses, closures, revision, departures, sales].some(r => r.error)) throw new FlockLifecycleError("LOAD_FAILED", 500);
  if (closures.data.mode !== "close") throw new FlockLifecycleError("UNAVAILABLE", 404);
  if (departures.data.length>500 || sales.data.length>500) throw new FlockLifecycleError("SOURCE_LIMIT", 409);
  if(options.revision && options.revision!==revision.data)throw new FlockLifecycleError("SOURCE_CHANGED",409);
  let query=dailyQuery().order("record_date",{ascending:false}).order("id",{ascending:false});
  if(options.cursor){
    let cursor;
    try {cursor=z.object({cycle:z.uuid(),revision:z.string(),date:z.iso.date(),id:z.uuid()}).parse(JSON.parse(Buffer.from(options.cursor,"base64url").toString()));}
    catch {throw new FlockLifecycleError("UNAVAILABLE",400);}
    if(cursor.cycle!==cycleId || cursor.revision!==revision.data)throw new FlockLifecycleError("SOURCE_CHANGED",409);
    query=query.or(`record_date.lt.${cursor.date},and(record_date.eq.${cursor.date},id.lt.${cursor.id})`);
  }
  if(options.recordIds){
    const selected=z.array(z.uuid()).min(1).max(500).safeParse(options.recordIds);
    if(!selected.success)throw new FlockLifecycleError("UNAVAILABLE",400);
    query=query.in("id",selected.data);
  }
  const daily=await query.limit(options.recordIds?500:51);
  if(daily.error)throw new FlockLifecycleError("LOAD_FAILED",500);
  if(options.recordIds && new Set(options.recordIds).size!==daily.data.length)throw new FlockLifecycleError("UNAVAILABLE",404);
  const hasMore=!options.recordIds&&daily.data.length>50;
  const records=hasMore?daily.data.slice(0,50):daily.data;
  const finalIds=clearances.data.map((c:{daily_record_id:string})=>c.daily_record_id);
  const finalRows=finalIds.length?await dailyQuery().in("id",finalIds):{data:[],error:null};
  if(finalRows.error)throw new FlockLifecycleError("LOAD_FAILED",500);
  const dates=[...new Set(records.map((r:{record_date:string})=>r.record_date))];
  const eventRows=async(table:string,explanation:string)=> dates.length?(await readReportQuery<Record<string,unknown>>(()=>db.from(table).select(`id,flock_id,record_date,count,${explanation}`).eq("org_id",ctx.orgId).in("flock_id",ids).in("record_date",dates).order("id"))).data:[];
  const [deathRows,cullRows]=await Promise.all([eventRows("mortality_events","cause"),eventRows("flock_cull_events","reason")]);
  const saleChoices:ArchivedCorrectionContext["sales"]=sales.data.map((s:{id:string;label:string;revision:string;unit:string;head_count:number|null})=>({id:s.id,label:s.label,revision:s.revision,headCount:s.head_count,unit:s.unit}));
  const lossEvents:ArchivedCorrectionContext["lossEvents"]=[];
  for(const [kind,result,explanation] of [["death",deathRows,"cause"],["cull",cullRows,"reason"]] as const) for(const event of result){
    const record=records.find((d:{id:string;flock_id:string;record_date:string})=>d.flock_id===event.flock_id&&d.record_date===event.record_date);
    if(!record)continue;
    lossEvents.push({id:String(event.id),record_id:record.id,kind,count:Number(event.count),explanation:String(event[explanation]||"")});
  }
  const renderRecord=(d:Record<string,unknown>)=>{
    const flock = flocks.data.find((f: {id: string}) => f.id === d.flock_id);
    return {id: String(d.id), date: String(d.record_date), flock: String(flock.flock_code), house: String(houses.data.find((h: {id: string}) => h.id === flock.house_id)?.name ?? ""),
      final: finalIds.includes(d.id),...Object.fromEntries(archivedBirdFields.map(field=>[field,d[field]===null?null:Number(d[field])]))} as ArchivedCorrectionContext["records"][number];
  };
  const last=records.at(-1);
  // A source change during these bounded reads must not silently refresh a draft.
  const checked=await db.rpc("archived_cycle_revision",{p_org:ctx.orgId,p_cycle:cycleId});
  if(checked.error || checked.data!==revision.data)throw new FlockLifecycleError("SOURCE_CHANGED",409);
  return {cycle: {id: cycle.id, code: cycle.cycle_code, farmId: cycle.farm_id, revision: revision.data},
    nextCursor:hasMore?Buffer.from(JSON.stringify({cycle:cycleId,revision:revision.data,date:last.record_date,id:last.id})).toString("base64url"):null,
    finalRecords:finalRows.data.map(renderRecord),
    members:flocks.data.map((f:{id:string;flock_code:string})=>({id:f.id,label:f.flock_code})),sales:saleChoices,lossEvents,
    departures:departures.data.map((d:{flock_id:string;kind:string;quantity:number;sale_id:string;reason:string;supporting_reference:string})=>d.kind==="sale"?{kind:"sale",flock_id:d.flock_id,quantity:d.quantity,sale_id:d.sale_id,sale_revision:saleChoices.find(s=>s.id===d.sale_id)?.revision??"",supporting_reference:d.supporting_reference||undefined}:{kind:"other",flock_id:d.flock_id,quantity:d.quantity,reason:d.reason,supporting_reference:d.supporting_reference}),
    records: records.map(renderRecord)};
}

export async function prepareArchivedCorrection(ctx: AccessContext, input: GovernanceInput) {
  const parsed = archivedCycleCorrectionSchema.safeParse(input.proposed_values);
  if (!parsed.success) throw new Error("CYCLE_INVALID_FIELDS");
  const p = parsed.data, context = await loadArchivedCorrectionContext(ctx, p.cycle_id,{recordIds:p.records.map(r=>r.id),revision:p.expected_revision});
  if (input.farm_id !== context.cycle.farmId || p.expected_revision !== context.cycle.revision) throw new Error("CYCLE_SOURCE_CHANGED");
  if (p.records.some(row => !context.records.some(current => current.id === row.id))) throw new Error("CYCLE_INVALID_FIELDS");
  if(p.departures?.some(row=>!context.members.some(m=>m.id===row.flock_id)||(row.kind==="sale"&&!context.sales.some(s=>s.id===row.sale_id))))throw new Error("CYCLE_INVALID_FIELDS");
  return {...input, source_table: "batch_cycles", source_id: p.cycle_id, source_version: null,
    changed_fields: ["archived_bird_history"], proposed_values: p,
    correction_route: `/app/flocks?filter_page_tab=batches&farm_id=${context.cycle.farmId}&cycle=${p.cycle_id}`};
}
