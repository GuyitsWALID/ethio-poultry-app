import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import {getTranslations} from "next-intl/server";

import { addDays, authorizedFarmIds, percent } from "@/lib/farm-manager-dashboard";
import {
  dateRange, mortalityPerThousand, periodDirection, reconcileCauses, roundMortality, timeBand,
  type MortalityDailyInput, type MortalityDashboardResponse, type MortalityEventInput,
} from "@/lib/mortality-dashboard";
import { parseActiveRole } from "@/lib/permissions";
import { getAccessContext,isAccessResponse } from "@/lib/access-context";
import {reportTimestampBounds,validReportDate} from "@/lib/report-safety";
import {projectLocationFlocks, reportRowInLocations, selectReportLocations, type ReportLocation} from "@/lib/report-locations";
import {ReportEvidenceError,selectEvidenceScope} from "@/lib/report-evidence";
import {expectedRecordsForPeriod,type AnalyticsFlock} from "@/lib/operational-analytics";

type Row = Record<string, unknown>;
type DbError = { message: string } | null;
const json = (value: unknown, status = 200) => Response.json(value, { status, headers:{"Cache-Control":"private, no-store"} });

async function allRows<T>(load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: DbError }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await load(from, from + 999);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if(rows.length>100000)throw new Error("REPORT_TOO_LARGE");
    if (page.length < 1000) return rows;
  }
}

function addisDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function ageWeeks(flock: Row, asOf: string) {
  const placement = String(flock.placement_date ?? asOf);
  const days = Math.max(0, Math.floor((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${placement}T00:00:00Z`)) / 86400000) + Number(flock.age_at_placement_days ?? 0));
  return Math.floor(days / 7) + 1;
}

export async function GET(request: NextRequest) {
  const t = await getTranslations("MortalityEvidence");
  try {
    const access=await getAccessContext({tenant:true});if(isAccessResponse(access))return access;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return json({ error: t("configuration") }, 500);
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const orgId=access.orgId;const role=parseActiveRole(access.role);const user={id:access.userId};if((!role||!["farm_manager","ceo"].includes(role))&&!access.supportSessionId)return json({error:t("access")},403);

    const [farms, houses, flocks, farmAccess] = await Promise.all([
      allRows<Row>((a, b) => db.from("farms").select("id,name,branch_id").eq("org_id", orgId).order("id").range(a, b)),
      allRows<Row>((a, b) => db.from("houses").select("id,name,farm_id").eq("org_id", orgId).order("id").range(a, b)),
      allRows<Row>((a, b) => db.from("flocks").select("id,flock_code,flock_type,farm_id,house_id,batch_id,current_count,status,placement_date,age_at_placement_days,breed_id").eq("org_id", orgId).order("id").range(a, b)),
      role === "farm_manager" ? allRows<{ farm_id: string }>((a, b) => db.from("user_farm_access").select("farm_id").eq("org_id",orgId).eq("profile_id", user.id).is("revoked_at",null).lte("starts_at",new Date().toISOString()).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order("id").range(a, b)) : Promise.resolve([]),
    ]);
    const permittedFarmIds = role === "farm_manager"
      ? authorizedFarmIds(farms.map((row) => ({ id: String(row.id), branch_id: String(row.branch_id) })), [], farmAccess.map((row) => row.farm_id))
      : new Set(farms.map((row) => String(row.id)));
    const p = request.nextUrl.searchParams;
    const today = addisDate();
    const requestedTo = p.get("date_to") ?? today;
    const dateTo = requestedTo;
    if(!validReportDate(dateTo))return json({error:t("finalDate")},400);
    const requestedFrom = p.get("date_from") ?? addDays(dateTo, -29);
    const dateFrom = requestedFrom;
    try {reportTimestampBounds(dateFrom,dateTo);} catch {return json({error:t("range")},400);}
    const dates = dateRange(dateFrom, dateTo); const periodDays = dates.length;
    const previousTo = addDays(dateFrom, -1); const previousFrom = addDays(previousTo, -(periodDays - 1));
    const selectedBranch = p.get("branch_id") ?? ""; const selectedFarm = p.get("farm_id") ?? ""; const selectedHouse = p.get("house_id") ?? ""; const selectedFlock = p.get("flock_id") ?? ""; const selectedBatch = p.get("batch_id") ?? "";
    if (selectedFarm && !permittedFarmIds.has(selectedFarm)) return json({ error: t("outsideFarm") }, 403);
    const farmMap = new Map(farms.map((row) => [String(row.id), row]));
    const locations=await allRows<ReportLocation>((a,b)=>db.rpc("report_flock_locations",{p_org:orgId}).order("flock_id").order("from_at").order("house_id").range(a,b));
    const permittedFarms=farms.filter(row=>permittedFarmIds.has(String(row.id))).map(row=>({...row,org_id:orgId}));
    const locationFilter={branchId:selectedBranch,farmId:selectedFarm,houseId:selectedHouse,flockId:selectedFlock,batchId:selectedBatch};
    const selectedLocations=selectReportLocations(locations,flocks,permittedFarms,locationFilter);
    const projected=projectLocationFlocks(flocks.map(row=>({...row,org_id:orgId})),selectReportLocations(locations.filter(row=>row.verified),flocks,permittedFarms,{}));
    selectEvidenceScope(orgId,role==="farm_manager",permittedFarms,projected,{dateFrom,dateTo,...locationFilter},{houses:houses.map(row=>({...row,org_id:orgId}))});
    const clearances=await allRows<Row>((a,b)=>db.from("effective_cycle_clearances").select("flock_id,closure_id").eq("org_id",orgId).order("flock_id").range(a,b));
    const closures=await allRows<Row>((a,b)=>db.from("batch_cycle_closures").select("id,completed_at").eq("org_id",orgId).order("id").range(a,b));
    const completed=new Map(closures.map(row=>[row.id,new Date(Date.parse(String(row.completed_at))+3*3600000).toISOString().slice(0,10)]));
    const ends=new Map(clearances.map(row=>[row.flock_id,completed.get(row.closure_id)]));
    const activeFlocks=flocks.filter(row=>String(row.placement_date)<=dateTo&&(!ends.get(row.id)||ends.get(row.id)!>=previousFrom)&&selectedLocations.some(location=>location.flock_id===row.id)).map((row):Row=>{
      const location=selectedLocations.filter(location=>location.flock_id===row.id).at(-1)!;
      return {...row,farm_id:location.farm_id,house_id:location.house_id,current_count:ends.has(row.id)||row.house_id!==location.house_id?0:row.current_count};
    });
    const coverageFlocks=activeFlocks.map(row=>({id:String(row.id),placementDate:String(row.placement_date),completionDate:ends.get(row.id)??null,
      scopePeriods:selectedLocations.filter(location=>location.flock_id===row.id).map(location=>({from:location.from_date,to:location.to_date}))})) as AnalyticsFlock[];
    const expected=expectedRecordsForPeriod(coverageFlocks,dateFrom,dateTo);
    const houseMap = new Map(houses.map((row) => [String(row.id), row]));
    const farmsInView = [...permittedFarmIds].filter((id) => !selectedBranch || String(farmMap.get(id)?.branch_id ?? "") === selectedBranch);
    const scopeLabel = selectedFarm ? String(farmMap.get(selectedFarm)?.name ?? t("selectedFarm")) : farmsInView.length === 1 ? String(farmMap.get(farmsInView[0])?.name ?? t("assignedFarm")) : t("farms", {count: farmsInView.length});
    const flockIds = activeFlocks.map((row) => String(row.id));
    const base: MortalityDashboardResponse = { meta: { dateFrom, dateTo, previousFrom, previousTo, timezone: "Africa/Addis_Ababa", refreshedAt: new Date().toISOString(), scopeLabel, days: periodDays }, summary: { officialDeaths: null, mortalityPerThousand: null, previousDeaths: null, direction: "unavailable", changePct: null, affectedFlocks: 0, recordsComplete: 0, recordsExpected: periodDays * activeFlocks.length, unexplainedDeaths: 0, eventDeaths: 0, peakDate: null, peakDeaths: null }, trends: dates.map((date) => ({ date, deaths: null, mortalityPerThousand: null, rollingAverage: null, records: 0 })), fingerprint: { dates, flocks: [] }, comparisons: [], causes: [], timeBands: [], diagnoses: [], actions: [], events: [], dataTrust: { coveragePct: 0, eventReconciliationPct: null, notes: [t("noFlocks")] } };
    if (!flockIds.length) return json(base);
    const breedIds = [...new Set(activeFlocks.map((row) => String(row.breed_id ?? "")).filter(Boolean))];
    const [dailyRaw, eventRaw, standards] = await Promise.all([
      allRows<Row>((a, b) => db.from("daily_farm_records").select("id,flock_id,record_date,deaths,culls,other_removals,transfers_out,transfers_in,deaths_cause,opening_birds,closing_birds").eq("org_id", orgId).is("voided_at",null).in("flock_id", flockIds).gte("record_date", previousFrom).lte("record_date", dateTo).order("record_date").order("id").range(a, b)),
      allRows<Row>((a, b) => db.from("mortality_events").select("id,flock_id,record_date,count,cause,diagnosis,recorded_time,notes").eq("org_id", orgId).in("flock_id", flockIds).gte("record_date", dateFrom).lte("record_date", dateTo).order("record_date", { ascending: false }).order("id").range(a, b)),
      breedIds.length ? allRows<Row>((a, b) => db.from("breed_standards").select("breed_id,week_number,target_mortality_pct").eq("org_id", orgId).in("breed_id", breedIds).order("id").range(a, b)) : Promise.resolve([]),
    ]);
    const daily: MortalityDailyInput[] = dailyRaw.filter(row=>reportRowInLocations(row,selectedLocations)).map((row) => ({ flockId: String(row.flock_id), recordDate: String(row.record_date), deaths: row.deaths === null ? null : Number(row.deaths), culls:row.culls===null?null:Number(row.culls),otherRemovals:Number(row.other_removals??0),transfersOut:Number(row.transfers_out??0),transfersIn:Number(row.transfers_in??0),openingBirds: row.opening_birds === null ? null : Number(row.opening_birds), closingBirds: row.closing_birds === null ? null : Number(row.closing_birds), cause: row.deaths_cause === null ? null : String(row.deaths_cause) }));
    const events: MortalityEventInput[] = eventRaw.filter(row=>reportRowInLocations(row,selectedLocations)).map((row) => ({ id: String(row.id), flockId: String(row.flock_id), recordDate: String(row.record_date), count: Number(row.count ?? 0), cause: String(row.cause ?? "Unspecified"), diagnosis: row.diagnosis === null ? null : String(row.diagnosis), recordedTime: row.recorded_time === null ? null : String(row.recorded_time), notes: row.notes === null ? null : String(row.notes) }));
    const current = daily.filter((row) => row.recordDate >= dateFrom); const previous = daily.filter((row) => row.recordDate <= previousTo);
    const eventMap = new Map<string, MortalityEventInput[]>(); for (const event of events) { const key = `${event.flockId}:${event.recordDate}`; eventMap.set(key, [...(eventMap.get(key) ?? []), event]); }
    const causeMap = new Map<string, number>(); let unexplainedDeaths = 0;
    for (const row of current) for (const allocation of reconcileCauses(row, eventMap.get(`${row.flockId}:${row.recordDate}`) ?? [])) { causeMap.set(allocation.cause, (causeMap.get(allocation.cause) ?? 0) + allocation.deaths); if (allocation.source === "unexplained") unexplainedDeaths += allocation.deaths; }
    const currentKnown = current.filter((row) => row.deaths !== null); const previousKnown = previous.filter((row) => row.deaths !== null);
    const officialDeaths = currentKnown.length ? currentKnown.reduce((sum, row) => sum + (row.deaths ?? 0), 0) : null;
    const previousDeaths = previousKnown.length ? previousKnown.reduce((sum, row) => sum + (row.deaths ?? 0), 0) : null;
    const comparisonDirection = periodDirection(officialDeaths, previousDeaths);
    const dailyByDate = new Map(dates.map((date) => [date, current.filter((row) => row.recordDate === date)]));
    const trends = dates.map((date, index) => { const rows = dailyByDate.get(date) ?? []; const knownRows = rows.filter((row) => row.deaths !== null); const deaths = knownRows.length ? knownRows.reduce((sum, row) => sum + (row.deaths ?? 0), 0) : null; const window = dates.slice(Math.max(0, index - 6), index + 1).map((key) => (dailyByDate.get(key) ?? []).filter((row) => row.deaths !== null)).filter((set) => set.length); const values = window.map((set) => set.reduce((sum, row) => sum + (row.deaths ?? 0), 0)); return { date, deaths, mortalityPerThousand: mortalityPerThousand(rows), rollingAverage: values.length ? roundMortality(values.reduce((sum, value) => sum + value, 0) / values.length, 1) : null, records: knownRows.length }; });
    const totalForShares = [...causeMap.values()].reduce((sum, value) => sum + value, 0);
    const causes = [...causeMap.entries()].map(([cause, deaths]) => ({ cause, deaths: roundMortality(deaths, 1), sharePct: percent(deaths, totalForShares) ?? 0 })).sort((a, b) => b.deaths - a.deaths);
    const standardMap = new Map(standards.map((row) => [`${row.breed_id}:${row.week_number}`, row.target_mortality_pct === null ? null : Number(row.target_mortality_pct)]));
    const comparisons = activeFlocks.map((flock) => {
      const periodDays=expectedRecordsForPeriod(coverageFlocks.filter(row=>row.id===flock.id),dateFrom,dateTo);
      const id = String(flock.id); const rows = current.filter((row) => row.flockId === id); const prior = previous.filter((row) => row.flockId === id); const knownRows = rows.filter((row) => row.deaths !== null); const knownPrior = prior.filter((row) => row.deaths !== null); const deaths = knownRows.length ? knownRows.reduce((sum, row) => sum + (row.deaths ?? 0), 0) : null; const priorDeaths = knownPrior.length ? knownPrior.reduce((sum, row) => sum + (row.deaths ?? 0), 0) : null; const rate = mortalityPerThousand(rows); const weeklyRatePct = rate === null ? null : roundMortality(rate * .7, 3); const targetPct = standardMap.get(`${flock.breed_id}:${ageWeeks(flock, dateTo)}`) ?? null; const allocations = rows.flatMap((row) => reconcileCauses(row, eventMap.get(`${id}:${row.recordDate}`) ?? [])); const causesForFlock = new Map<string, number>(); for (const item of allocations) causesForFlock.set(item.cause, (causesForFlock.get(item.cause) ?? 0) + item.deaths); const leadingCause = [...causesForFlock.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; const unexplained = allocations.filter((row) => row.source === "unexplained").reduce((sum, row) => sum + row.deaths, 0); const coveragePct = percent(knownRows.length, periodDays) ?? 0; const direction = periodDirection(deaths, priorDeaths); const targetGapPct = weeklyRatePct !== null && targetPct !== null ? roundMortality(weeklyRatePct - targetPct, 3) : null; const status = coveragePct < 60 ? "insufficient_data" as const : targetGapPct !== null && targetGapPct > Math.max(targetPct ?? 0, .05) ? "critical" as const : (targetGapPct !== null && targetGapPct > 0) || (deaths ?? 0) > (priorDeaths ?? 0) * 1.5 || ((deaths ?? 0) > 0 && unexplained / (deaths ?? 1) > .25) ? "watch" as const : "stable" as const;
      return { id, code: String(flock.flock_code), farmName: String(farmMap.get(String(flock.farm_id))?.name ?? t("farm")), houseName: String(houseMap.get(String(flock.house_id))?.name ?? "House"), liveBirds: Number(flock.current_count ?? 0), deaths, mortalityPerThousand: rate, weeklyRatePct, targetPct, targetGapPct, previousDeaths: priorDeaths, direction: direction.direction, changePct: direction.changePct, leadingCause, unexplainedPct: deaths && deaths > 0 ? percent(unexplained, deaths) : null, deathDays: new Set(rows.filter((row) => (row.deaths ?? 0) > 0).map((row) => row.recordDate)).size, lastDeathDate: rows.filter((row) => (row.deaths ?? 0) > 0).map((row) => row.recordDate).sort().at(-1) ?? null, status, coveragePct };
    });
    const comparisonRank = { critical: 4, watch: 3, insufficient_data: 2, stable: 1 } as const;
    comparisons.sort((a, b) => comparisonRank[b.status] - comparisonRank[a.status] || (b.mortalityPerThousand ?? -1) - (a.mortalityPerThousand ?? -1));
    const fingerprint = { dates, flocks: comparisons.map((comparison) => ({ id: comparison.id, code: comparison.code, farmName: comparison.farmName, houseName: comparison.houseName, days: dates.map((date) => { const row = current.find((item) => item.flockId === comparison.id && item.recordDate === date); return { date, deaths: row ? row.deaths : null, mortalityPerThousand: row ? mortalityPerThousand([row]) : null }; }) })) };
    const timeMap = new Map<string, number>(); const diagnosisMap = new Map<string, number>(); for (const event of events) { const band = timeBand(event.recordedTime); timeMap.set(band, (timeMap.get(band) ?? 0) + event.count); if (event.diagnosis?.trim()) diagnosisMap.set(event.diagnosis.trim(), (diagnosisMap.get(event.diagnosis.trim()) ?? 0) + event.count); }
    const actions: MortalityDashboardResponse["actions"] = [];
    for (const flock of comparisons) { if (flock.status === "critical") actions.push({ id: `critical:${flock.id}`, severity: "critical", title: t("investigate", {flock: flock.code}), explanation: t("criticalDetail", {count: flock.deaths ?? 0, rate: flock.weeklyRatePct ?? t("unavailable"), target: flock.targetPct !== null ? t("againstTarget", {percent: flock.targetPct}) : ""}), route: "/app/health", flockCode: flock.code }); else if (flock.status === "watch") actions.push({ id: `watch:${flock.id}`, severity: "warning", title: t("review", {flock: flock.code}), explanation: t("watchDetail", {days: flock.deathDays, cause: flock.leadingCause ?? t("notEstablished")}), route: "/app/health", flockCode: flock.code }); if (flock.coveragePct < 80) actions.push({ id: `coverage:${flock.id}`, severity: "data", title: t("completeRecords", {flock: flock.code}), explanation: t("coverageDetail", {percent: flock.coveragePct ?? t("unavailable")}), route: "/app/daily-records", flockCode: flock.code }); if ((flock.unexplainedPct ?? 0) > 20) actions.push({ id: `cause:${flock.id}`, severity: "data", title: t("recordCauses", {flock: flock.code}), explanation: t("unexplainedDetail", {percent: flock.unexplainedPct ?? t("unavailable")}), route: "/app/daily-records", flockCode: flock.code }); }
    const peak = [...trends].filter((row) => row.deaths !== null).sort((a, b) => (b.deaths ?? 0) - (a.deaths ?? 0))[0]; const eventDeaths = events.reduce((sum, event) => sum + event.count, 0); const coveragePct = percent(currentKnown.length, expected) ?? 0; const reconciliationPct = officialDeaths && officialDeaths > 0 ? Math.min(100, percent(Math.min(eventDeaths, officialDeaths), officialDeaths) ?? 0) : null;
    const notes = [...(coveragePct < 100 ? [t("missing", {count: expected - currentKnown.length})] : []), ...(eventDeaths !== (officialDeaths ?? 0) ? [t("difference", {events: eventDeaths, records: officialDeaths ?? t("unavailable")})] : []), ...(causes.length === 0 && (officialDeaths ?? 0) > 0 ? [t("noCauses")] : [])];
    const actionRank = { critical: 3, warning: 2, data: 1 } as const;
    actions.sort((a, b) => actionRank[b.severity] - actionRank[a.severity]);
    const response: MortalityDashboardResponse = { meta: base.meta, summary: { officialDeaths, mortalityPerThousand: mortalityPerThousand(current), previousDeaths, direction: comparisonDirection.direction, changePct: comparisonDirection.changePct, affectedFlocks: comparisons.filter((row) => (row.deaths ?? 0) > 0).length, recordsComplete: currentKnown.length, recordsExpected: periodDays * activeFlocks.length, unexplainedDeaths: roundMortality(unexplainedDeaths, 1), eventDeaths, peakDate: peak?.date ?? null, peakDeaths: peak?.deaths ?? null }, trends, fingerprint, comparisons, causes, timeBands: ["Overnight", "Morning", "Afternoon", "Evening", "Unknown"].map((band) => ({ band: t((band) as Parameters<typeof t>[0]), deaths: timeMap.get(band) ?? 0 })), diagnoses: [...diagnosisMap.entries()].map(([diagnosis, deaths]) => ({ diagnosis, deaths })).sort((a, b) => b.deaths - a.deaths), actions: actions.slice(0, 20), events: events.slice(0, 100).map((event) => { const flock = comparisons.find((item) => item.id === event.flockId); return { id: event.id, date: event.recordDate, time: event.recordedTime, flockCode: flock?.code ?? event.flockId, farmName: flock?.farmName ?? t("farm"), cause: event.cause, diagnosis: event.diagnosis, count: event.count, notes: event.notes }; }), dataTrust: { coveragePct, eventReconciliationPct: reconciliationPct, notes: notes.length ? notes : [t("reconciled")] } };
    response.summary.recordsExpected=expected;
    response.summary.culls=current.length&&current.every(row=>row.culls!==null&&row.culls!==undefined)?current.reduce((sum,row)=>sum+(row.culls??0),0):null;
    response.summary.birdLosses=officialDeaths!==null&&response.summary.culls!==null?officialDeaths+response.summary.culls:null;
    const unverifiedArchives=new Set(activeFlocks.filter(row=>!["active","quarantined"].includes(String(row.status))&&!ends.get(row.id)).map(row=>String(row.id)));
    if(unverifiedArchives.size){
      response.dataTrust.coveragePct=null;
      response.dataTrust.notes.push(t("archived"));
      for(const row of response.comparisons)if(unverifiedArchives.has(row.id)){row.coveragePct=null;row.status="insufficient_data";}
    }
    if(selectedLocations.some(row=>row.starts_with_move))response.dataTrust.notes.push(t("movement"));
    return json(response);
  } catch (error: unknown) {
    if(error instanceof ReportEvidenceError)return json({error:error.code},error.status);
    return json({ error: error instanceof Error ? error.message : t("loadFailed") }, 500);
  }
}
