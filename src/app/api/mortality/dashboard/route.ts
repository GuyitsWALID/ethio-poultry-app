import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import { addDays, authorizedFarmIds, percent } from "@/lib/farm-manager-dashboard";
import {
  dateRange, mortalityPerThousand, periodDirection, reconcileCauses, roundMortality, timeBand,
  type MortalityDailyInput, type MortalityDashboardResponse, type MortalityEventInput,
} from "@/lib/mortality-dashboard";
import { createClient as createAuthedClient } from "@/utils/supabase/server";

type Row = Record<string, unknown>;
type DbError = { message: string } | null;
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
  try {
    const auth = await createAuthedClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return json({ error: "Supabase server configuration is missing." }, 500);
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: profile } = await db.from("profiles").select("org_id,role").eq("id", user.id).maybeSingle();
    if (!profile?.org_id) return json({ error: "Organization access is required." }, 403);
    const orgId = String(profile.org_id); const role = String(profile.role ?? "");
    const allowedRoles = new Set(["farm_manager", "ceo", "system_admin", "super_admin"]);
    if (!allowedRoles.has(role)) return json({ error: "Management access is required." }, 403);

    const [farms, houses, flocks, branchAccess, farmAccess] = await Promise.all([
      allRows<Row>((a, b) => db.from("farms").select("id,name,branch_id").eq("org_id", orgId).range(a, b)),
      allRows<Row>((a, b) => db.from("houses").select("id,name,farm_id").eq("org_id", orgId).range(a, b)),
      allRows<Row>((a, b) => db.from("flocks").select("id,flock_code,flock_type,farm_id,house_id,batch_id,current_count,status,placement_date,age_at_placement_days,breed_id").eq("org_id", orgId).range(a, b)),
      role === "farm_manager" ? allRows<{ branch_id: string }>((a, b) => db.from("user_branch_access").select("branch_id").eq("profile_id", user.id).range(a, b)) : Promise.resolve([]),
      role === "farm_manager" ? allRows<{ farm_id: string }>((a, b) => db.from("user_farm_access").select("farm_id").eq("profile_id", user.id).range(a, b)) : Promise.resolve([]),
    ]);
    const permittedFarmIds = role === "farm_manager"
      ? authorizedFarmIds(farms.map((row) => ({ id: String(row.id), branch_id: String(row.branch_id) })), branchAccess.map((row) => row.branch_id), farmAccess.map((row) => row.farm_id))
      : new Set(farms.map((row) => String(row.id)));
    const p = request.nextUrl.searchParams;
    const today = addisDate();
    const requestedTo = p.get("date_to") ?? today;
    const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(requestedTo) && requestedTo <= today ? requestedTo : today;
    const requestedFrom = p.get("date_from") ?? addDays(dateTo, -29);
    const unclampedFrom = /^\d{4}-\d{2}-\d{2}$/.test(requestedFrom) && requestedFrom <= dateTo ? requestedFrom : addDays(dateTo, -29);
    const dateFrom = unclampedFrom < addDays(dateTo, -179) ? addDays(dateTo, -179) : unclampedFrom;
    const dates = dateRange(dateFrom, dateTo); const periodDays = dates.length;
    const previousTo = addDays(dateFrom, -1); const previousFrom = addDays(previousTo, -(periodDays - 1));
    const selectedBranch = p.get("branch_id") ?? ""; const selectedFarm = p.get("farm_id") ?? ""; const selectedHouse = p.get("house_id") ?? ""; const selectedFlock = p.get("flock_id") ?? ""; const selectedBatch = p.get("batch_id") ?? "";
    if (selectedFarm && !permittedFarmIds.has(selectedFarm)) return json({ error: "The selected farm is outside your assigned scope." }, 403);
    const farmMap = new Map(farms.map((row) => [String(row.id), row]));
    const activeFlocks = flocks.filter((flock) => String(flock.status) === "active" && permittedFarmIds.has(String(flock.farm_id))
      && (!selectedBranch || String(farmMap.get(String(flock.farm_id))?.branch_id ?? "") === selectedBranch)
      && (!selectedFarm || String(flock.farm_id) === selectedFarm) && (!selectedHouse || String(flock.house_id) === selectedHouse)
      && (!selectedFlock || String(flock.id) === selectedFlock) && (!selectedBatch || String(flock.batch_id ?? "") === selectedBatch));
    const houseMap = new Map(houses.map((row) => [String(row.id), row]));
    const farmsInView = [...permittedFarmIds].filter((id) => !selectedBranch || String(farmMap.get(id)?.branch_id ?? "") === selectedBranch);
    const scopeLabel = selectedFarm ? String(farmMap.get(selectedFarm)?.name ?? "Selected farm") : farmsInView.length === 1 ? String(farmMap.get(farmsInView[0])?.name ?? "Assigned farm") : `${farmsInView.length} assigned farms`;
    const flockIds = activeFlocks.map((row) => String(row.id));
    const base: MortalityDashboardResponse = { meta: { dateFrom, dateTo, previousFrom, previousTo, timezone: "Africa/Addis_Ababa", refreshedAt: new Date().toISOString(), scopeLabel, days: periodDays }, summary: { officialDeaths: null, mortalityPerThousand: null, previousDeaths: null, direction: "unavailable", changePct: null, affectedFlocks: 0, recordsComplete: 0, recordsExpected: periodDays * activeFlocks.length, unexplainedDeaths: 0, eventDeaths: 0, peakDate: null, peakDeaths: null }, trends: dates.map((date) => ({ date, deaths: null, mortalityPerThousand: null, rollingAverage: null, records: 0 })), fingerprint: { dates, flocks: [] }, comparisons: [], causes: [], timeBands: [], diagnoses: [], actions: [], events: [], dataTrust: { coveragePct: 0, eventReconciliationPct: null, notes: ["No active flocks are available in this scope."] } };
    if (!flockIds.length) return json(base);
    const breedIds = [...new Set(activeFlocks.map((row) => String(row.breed_id ?? "")).filter(Boolean))];
    const [dailyRaw, eventRaw, standards] = await Promise.all([
      allRows<Row>((a, b) => db.from("daily_farm_records").select("flock_id,record_date,deaths,deaths_cause,opening_birds,closing_birds").eq("org_id", orgId).in("flock_id", flockIds).gte("record_date", previousFrom).lte("record_date", dateTo).range(a, b)),
      allRows<Row>((a, b) => db.from("mortality_events").select("id,flock_id,record_date,count,cause,diagnosis,recorded_time,notes").eq("org_id", orgId).in("flock_id", flockIds).gte("record_date", dateFrom).lte("record_date", dateTo).order("record_date", { ascending: false }).range(a, b)),
      breedIds.length ? allRows<Row>((a, b) => db.from("breed_standards").select("breed_id,week_number,target_mortality_pct").eq("org_id", orgId).in("breed_id", breedIds).range(a, b)) : Promise.resolve([]),
    ]);
    const daily: MortalityDailyInput[] = dailyRaw.map((row) => ({ flockId: String(row.flock_id), recordDate: String(row.record_date), deaths: row.deaths === null ? null : Number(row.deaths), openingBirds: row.opening_birds === null ? null : Number(row.opening_birds), closingBirds: row.closing_birds === null ? null : Number(row.closing_birds), cause: row.deaths_cause === null ? null : String(row.deaths_cause) }));
    const events: MortalityEventInput[] = eventRaw.map((row) => ({ id: String(row.id), flockId: String(row.flock_id), recordDate: String(row.record_date), count: Number(row.count ?? 0), cause: String(row.cause ?? "Unspecified"), diagnosis: row.diagnosis === null ? null : String(row.diagnosis), recordedTime: row.recorded_time === null ? null : String(row.recorded_time), notes: row.notes === null ? null : String(row.notes) }));
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
      const id = String(flock.id); const rows = current.filter((row) => row.flockId === id); const prior = previous.filter((row) => row.flockId === id); const knownRows = rows.filter((row) => row.deaths !== null); const knownPrior = prior.filter((row) => row.deaths !== null); const deaths = knownRows.length ? knownRows.reduce((sum, row) => sum + (row.deaths ?? 0), 0) : null; const priorDeaths = knownPrior.length ? knownPrior.reduce((sum, row) => sum + (row.deaths ?? 0), 0) : null; const rate = mortalityPerThousand(rows); const weeklyRatePct = rate === null ? null : roundMortality(rate * .7, 3); const targetPct = standardMap.get(`${flock.breed_id}:${ageWeeks(flock, dateTo)}`) ?? null; const allocations = rows.flatMap((row) => reconcileCauses(row, eventMap.get(`${id}:${row.recordDate}`) ?? [])); const causesForFlock = new Map<string, number>(); for (const item of allocations) causesForFlock.set(item.cause, (causesForFlock.get(item.cause) ?? 0) + item.deaths); const leadingCause = [...causesForFlock.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; const unexplained = allocations.filter((row) => row.source === "unexplained").reduce((sum, row) => sum + row.deaths, 0); const coveragePct = percent(knownRows.length, periodDays) ?? 0; const direction = periodDirection(deaths, priorDeaths); const targetGapPct = weeklyRatePct !== null && targetPct !== null ? roundMortality(weeklyRatePct - targetPct, 3) : null; const status = coveragePct < 60 ? "insufficient_data" as const : targetGapPct !== null && targetGapPct > Math.max(targetPct ?? 0, .05) ? "critical" as const : (targetGapPct !== null && targetGapPct > 0) || (deaths ?? 0) > (priorDeaths ?? 0) * 1.5 || ((deaths ?? 0) > 0 && unexplained / (deaths ?? 1) > .25) ? "watch" as const : "stable" as const;
      return { id, code: String(flock.flock_code), farmName: String(farmMap.get(String(flock.farm_id))?.name ?? "Farm"), houseName: String(houseMap.get(String(flock.house_id))?.name ?? "House"), liveBirds: Number(flock.current_count ?? 0), deaths, mortalityPerThousand: rate, weeklyRatePct, targetPct, targetGapPct, previousDeaths: priorDeaths, direction: direction.direction, changePct: direction.changePct, leadingCause, unexplainedPct: deaths && deaths > 0 ? percent(unexplained, deaths) : null, deathDays: new Set(rows.filter((row) => (row.deaths ?? 0) > 0).map((row) => row.recordDate)).size, lastDeathDate: rows.filter((row) => (row.deaths ?? 0) > 0).map((row) => row.recordDate).sort().at(-1) ?? null, status, coveragePct };
    });
    const comparisonRank = { critical: 4, watch: 3, insufficient_data: 2, stable: 1 } as const;
    comparisons.sort((a, b) => comparisonRank[b.status] - comparisonRank[a.status] || (b.mortalityPerThousand ?? -1) - (a.mortalityPerThousand ?? -1));
    const fingerprint = { dates, flocks: comparisons.map((comparison) => ({ id: comparison.id, code: comparison.code, farmName: comparison.farmName, houseName: comparison.houseName, days: dates.map((date) => { const row = current.find((item) => item.flockId === comparison.id && item.recordDate === date); return { date, deaths: row ? row.deaths : null, mortalityPerThousand: row ? mortalityPerThousand([row]) : null }; }) })) };
    const timeMap = new Map<string, number>(); const diagnosisMap = new Map<string, number>(); for (const event of events) { const band = timeBand(event.recordedTime); timeMap.set(band, (timeMap.get(band) ?? 0) + event.count); if (event.diagnosis?.trim()) diagnosisMap.set(event.diagnosis.trim(), (diagnosisMap.get(event.diagnosis.trim()) ?? 0) + event.count); }
    const actions: MortalityDashboardResponse["actions"] = [];
    for (const flock of comparisons) { if (flock.status === "critical") actions.push({ id: `critical:${flock.id}`, severity: "critical", title: `Investigate ${flock.code} mortality now`, explanation: `${flock.deaths ?? 0} deaths; weekly-equivalent mortality is ${flock.weeklyRatePct ?? "unavailable"}%${flock.targetPct !== null ? ` against ${flock.targetPct}% target` : ""}.`, route: "/app/health", flockCode: flock.code }); else if (flock.status === "watch") actions.push({ id: `watch:${flock.id}`, severity: "warning", title: `Review the pattern in ${flock.code}`, explanation: `${flock.deathDays} mortality day(s); leading cause ${flock.leadingCause ?? "not established"}.`, route: "/app/health", flockCode: flock.code }); if (flock.coveragePct < 80) actions.push({ id: `coverage:${flock.id}`, severity: "data", title: `Complete ${flock.code} Daily Records`, explanation: `Only ${flock.coveragePct}% of flock-days are available for this analysis.`, route: "/app/daily-records", flockCode: flock.code }); if ((flock.unexplainedPct ?? 0) > 20) actions.push({ id: `cause:${flock.id}`, severity: "data", title: `Record causes for ${flock.code}`, explanation: `${flock.unexplainedPct}% of recorded deaths remain unexplained.`, route: "/app/daily-records", flockCode: flock.code }); }
    const peak = [...trends].filter((row) => row.deaths !== null).sort((a, b) => (b.deaths ?? 0) - (a.deaths ?? 0))[0]; const eventDeaths = events.reduce((sum, event) => sum + event.count, 0); const coveragePct = percent(currentKnown.length, periodDays * activeFlocks.length) ?? 0; const reconciliationPct = officialDeaths && officialDeaths > 0 ? Math.min(100, percent(Math.min(eventDeaths, officialDeaths), officialDeaths) ?? 0) : null;
    const notes = [...(coveragePct < 100 ? [`${periodDays * activeFlocks.length - currentKnown.length} expected flock-day mortality value(s) are missing.`] : []), ...(eventDeaths !== (officialDeaths ?? 0) ? [`Detailed mortality events total ${eventDeaths}; official Daily Records total ${officialDeaths ?? "unavailable"}. Daily Records remain authoritative.`] : []), ...(causes.length === 0 && (officialDeaths ?? 0) > 0 ? ["Deaths exist without usable cause information."] : [])];
    const actionRank = { critical: 3, warning: 2, data: 1 } as const;
    actions.sort((a, b) => actionRank[b.severity] - actionRank[a.severity]);
    const response: MortalityDashboardResponse = { meta: base.meta, summary: { officialDeaths, mortalityPerThousand: mortalityPerThousand(current), previousDeaths, direction: comparisonDirection.direction, changePct: comparisonDirection.changePct, affectedFlocks: comparisons.filter((row) => (row.deaths ?? 0) > 0).length, recordsComplete: currentKnown.length, recordsExpected: periodDays * activeFlocks.length, unexplainedDeaths: roundMortality(unexplainedDeaths, 1), eventDeaths, peakDate: peak?.date ?? null, peakDeaths: peak?.deaths ?? null }, trends, fingerprint, comparisons, causes, timeBands: ["Overnight", "Morning", "Afternoon", "Evening", "Unknown"].map((band) => ({ band, deaths: timeMap.get(band) ?? 0 })), diagnoses: [...diagnosisMap.entries()].map(([diagnosis, deaths]) => ({ diagnosis, deaths })).sort((a, b) => b.deaths - a.deaths), actions: actions.slice(0, 20), events: events.slice(0, 100).map((event) => { const flock = comparisons.find((item) => item.id === event.flockId); return { id: event.id, date: event.recordDate, time: event.recordedTime, flockCode: flock?.code ?? event.flockId, farmName: flock?.farmName ?? "Farm", cause: event.cause, diagnosis: event.diagnosis, count: event.count, notes: event.notes }; }), dataTrust: { coveragePct, eventReconciliationPct: reconciliationPct, notes: notes.length ? notes : ["Daily Records and detailed mortality events reconcile for the selected period."] } };
    return json(response);
  } catch (error: unknown) {
    return json({ error: error instanceof Error ? error.message : "Could not load mortality analysis." }, 500);
  }
}
