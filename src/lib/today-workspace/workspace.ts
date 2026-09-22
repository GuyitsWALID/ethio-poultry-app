import type {AccessContext} from "@/lib/access-context";
import {ageOnDate} from "../farm-manager-dashboard.ts";

import {
  TODAY_SCHEMA_VERSION,
  type TodayFlockContext,
  type TodayTask,
  type TodayWorkspace,
} from "./contracts.ts";

type Row = Record<string, unknown>;

export class TodayWorkspaceError extends Error {
  readonly code: "ROLE_NOT_ALLOWED" | "ASSIGNMENT_REQUIRED" | "FEATURE_DISABLED" | "INVALID_PAYLOAD" | "SOURCE_NOT_FOUND" | "INTERNAL_ERROR";
  readonly status: number;

  constructor(
    code: "ROLE_NOT_ALLOWED" | "ASSIGNMENT_REQUIRED" | "FEATURE_DISABLED" | "INVALID_PAYLOAD" | "SOURCE_NOT_FOUND" | "INTERNAL_ERROR",
    message: string,
    status: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export type TodayWorkspaceSelection = {farmId: string; workDate: string};

export type TodayWorkspaceData = {
  organization: {todayWorkspaceEnabled: boolean};
  profile: {preferredLocale: "en" | "am"};
  farm: {id: string; name: string};
  operatingDay: {status: "open" | "closed" | "locked"; revision: string};
  flocks: Array<{
    id: string;
    code: string;
    type: string;
    batchLabel: string | null;
    houseLabel: string;
    placementDate: string;
    ageAtPlacementDays: number | null;
    currentCount: number;
    dailyRecord: null | {
      id: string;
      openingBirds: number | null;
      closingBirds: number | null;
      deaths: number | null;
      normalEggs: number | null;
      brokenEggs: number | null;
      dirtyEggs: number | null;
      totalEggs: number | null;
      waterLiters: number | null;
      revision: string;
    };
    previousClosingBirds: number | null;
    feedClosed: boolean;
    feedRevision: string;
    hasHealthOrDeathActivity: boolean;
    hasRoutineSupplyUsage: boolean;
    healthFingerprint: string;
    suppliesFingerprint: string;
    healthAttestationFingerprint: string | null;
    suppliesAttestationFingerprint: string | null;
  }>;
  assignedActionCount: number;
};

function task(input: TodayTask): TodayTask {
  return input;
}

export function deriveTodayWorkspace(
  data: TodayWorkspaceData,
  selection: TodayWorkspaceSelection,
  canEdit: boolean,
): TodayWorkspace {
  const flocks: TodayFlockContext[] = data.flocks.map((flock) => {
    const layer = flock.type === "layer" || flock.type === "parent_stock";
    const daily = flock.dailyRecord;
    const healthConfirmed = flock.hasHealthOrDeathActivity
      || flock.healthAttestationFingerprint === flock.healthFingerprint;
    const suppliesConfirmed = flock.hasRoutineSupplyUsage
      || flock.suppliesAttestationFingerprint === flock.suppliesFingerprint;
    const eggsAndWaterComplete = Boolean(
      daily
      && daily.waterLiters !== null
      && (!layer || (
        daily.normalEggs !== null
        && daily.brokenEggs !== null
        && daily.dirtyEggs !== null
        && daily.totalEggs !== null
      )),
    );
    const tasks: TodayTask[] = [
      task({
        code: "birds", required: true, applicable: true,
        state: daily ? "complete" : "not_started",
        sourceRef: daily ? `daily_farm_records/${daily.id}` : undefined,
        resourceRevision: daily?.revision,
      }),
      task({
        code: "feeding", required: true, applicable: true,
        state: flock.feedClosed ? "complete" : "not_started",
        sourceRef: `feed_days/${flock.id}:${selection.workDate}`,
        resourceRevision: flock.feedRevision,
      }),
      task({
        code: "eggs_water", required: true, applicable: true,
        state: eggsAndWaterComplete ? "complete" : "not_started",
        sourceRef: daily ? `daily_farm_records/${daily.id}` : undefined,
        resourceRevision: daily?.revision,
      }),
      task({
        code: "health_deaths", required: true, applicable: true,
        state: healthConfirmed ? "complete" : "not_started",
        sourceFingerprint: flock.healthFingerprint,
      }),
      task({
        code: "routine_supplies", required: true, applicable: true,
        state: suppliesConfirmed ? "complete" : "not_started",
        sourceFingerprint: flock.suppliesFingerprint,
      }),
    ];
    return {
      id: flock.id,
      code: flock.code,
      type: flock.type,
      batchLabel: flock.batchLabel,
      houseLabel: flock.houseLabel,
      ageDays: ageOnDate(flock.placementDate, flock.ageAtPlacementDays, selection.workDate),
      openingBirds: daily?.openingBirds ?? flock.previousClosingBirds ?? flock.currentCount,
      previousClosingBirds: flock.previousClosingBirds,
      tasks,
    };
  });

  const requiredTasks = flocks.flatMap((flock) => flock.tasks).filter((item) => item.required && item.applicable);
  const readyToFinish = requiredTasks.every((item) => item.state === "complete");
  const noActiveFlock = flocks.length === 0;
  const farmTasks: TodayTask[] = [
    task({code: "stock", required: false, applicable: true, state: "not_started"}),
    task({code: "sales", required: false, applicable: true, state: "not_started"}),
    task({code: "expenses", required: false, applicable: true, state: "not_started"}),
    task({
      code: "assigned_fixes", required: false, applicable: data.assignedActionCount > 0,
      state: data.assignedActionCount > 0 ? "needs_attention" : "complete",
    }),
    task({
      code: "review_finish", required: true, applicable: true,
      state: data.operatingDay.status === "closed"
        ? "complete"
        : data.operatingDay.status === "locked"
          ? "needs_attention"
          : readyToFinish || noActiveFlock ? "not_started" : "needs_attention",
      resourceRevision: data.operatingDay.revision,
    }),
  ];

  return {
    schemaVersion: TODAY_SCHEMA_VERSION,
    timezone: "Africa/Addis_Ababa",
    farm: data.farm,
    workDate: selection.workDate,
    locale: data.profile.preferredLocale,
    operatingDay: data.operatingDay,
    flocks,
    farmTasks,
    capabilities: {
      canEdit,
      canFinish: canEdit && data.operatingDay.status === "open" && (readyToFinish || noActiveFlock),
      offlineAuthorizedUntil: `${selection.workDate}T20:59:59.999Z`,
    },
  };
}

function asNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function expectData<T>(value: {data: T | null; error: {message: string} | null}, label: string): T {
  if (value.error) throw new TodayWorkspaceError("INTERNAL_ERROR", `${label}: ${value.error.message}`, 500);
  if (value.data === null) throw new TodayWorkspaceError("SOURCE_NOT_FOUND", `${label} was not found.`, 404);
  return value.data;
}

export async function loadTodayWorkspace(
  context: AccessContext,
  selection: TodayWorkspaceSelection,
): Promise<TodayWorkspace> {
  const {canAccessFarm, governanceAdmin} = await import("@/lib/access-context");
  if (context.role !== "farm_manager" && !context.supportSessionId) {
    throw new TodayWorkspaceError("ROLE_NOT_ALLOWED", "The Today workspace is for Farm Managers.", 403);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selection.workDate)) {
    throw new TodayWorkspaceError("INVALID_PAYLOAD", "Choose a valid work date.", 400);
  }
  if (!(await canAccessFarm(context, selection.farmId))) {
    throw new TodayWorkspaceError("ASSIGNMENT_REQUIRED", "An active farm assignment is required.", 403);
  }

  const [organizationResult, profileResult, farmResult] = await Promise.all([
    governanceAdmin.from("organizations").select("today_workspace_enabled").eq("id", context.orgId).maybeSingle(),
    governanceAdmin.from("profiles").select("preferred_locale").eq("id", context.userId).maybeSingle(),
    governanceAdmin.from("farms").select("id,name").eq("org_id", context.orgId).eq("id", selection.farmId).maybeSingle(),
  ]);
  const organization = expectData(organizationResult, "Organization");
  const profile = expectData(profileResult, "Profile");
  const farm = expectData(farmResult, "Farm");
  if (!organization.today_workspace_enabled) {
    throw new TodayWorkspaceError("FEATURE_DISABLED", "The Today workspace is not enabled for this organization.", 404);
  }

  const flocksResult = await governanceAdmin.from("flocks")
    .select("id,flock_code,flock_type,batch_id,house_id,placement_date,age_at_placement_days,current_count")
    .eq("org_id", context.orgId)
    .eq("farm_id", selection.farmId)
    .eq("status", "active")
    .lte("placement_date", selection.workDate)
    .order("flock_code");
  if (flocksResult.error) throw new TodayWorkspaceError("INTERNAL_ERROR", flocksResult.error.message, 500);
  const flockRows = (flocksResult.data ?? []) as Row[];
  const flockIds = flockRows.map((row) => String(row.id));
  const houseIds = [...new Set(flockRows.map((row) => String(row.house_id)).filter(Boolean))];
  const batchIds = [...new Set(flockRows.map((row) => String(row.batch_id ?? "")).filter(Boolean))];

  const empty = Promise.resolve({data: [] as Row[], error: null});
  const [houses, batches, daily, previousDaily, closures, mortality, health, supplies, attestations, actions, operatingDay, operatingRevision] = await Promise.all([
    houseIds.length ? governanceAdmin.from("houses").select("id,name").eq("org_id", context.orgId).in("id", houseIds) : empty,
    batchIds.length ? governanceAdmin.from("batches").select("id,batch_number").eq("org_id", context.orgId).in("id", batchIds) : empty,
    flockIds.length ? governanceAdmin.from("daily_farm_records").select("id,flock_id,opening_birds,closing_birds,deaths,normal_eggs,broken_eggs,dirty_eggs,total_eggs,water_consumed_liters,updated_at").eq("org_id", context.orgId).in("flock_id", flockIds).eq("record_date", selection.workDate).is("voided_at", null) : empty,
    flockIds.length ? governanceAdmin.from("daily_farm_records").select("id,flock_id,closing_birds,record_date").eq("org_id", context.orgId).in("flock_id", flockIds).lt("record_date", selection.workDate).is("voided_at", null).order("record_date", {ascending: false}) : empty,
    flockIds.length ? governanceAdmin.from("feed_day_closures").select("id,flock_id,status,updated_at").eq("org_id", context.orgId).in("flock_id", flockIds).eq("record_date", selection.workDate) : empty,
    flockIds.length ? governanceAdmin.from("mortality_events").select("id,flock_id").eq("org_id", context.orgId).in("flock_id", flockIds).eq("record_date", selection.workDate) : empty,
    flockIds.length ? governanceAdmin.from("health_events").select("id,flock_id").eq("org_id", context.orgId).in("flock_id", flockIds).eq("event_date", selection.workDate).is("voided_at", null) : empty,
    flockIds.length ? governanceAdmin.from("stock_ledger").select("id,flock_id").eq("org_id", context.orgId).in("flock_id", flockIds).eq("farm_id", selection.farmId).eq("transaction_date", selection.workDate).eq("source_kind", "daily_record_usage") : empty,
    governanceAdmin.from("daily_task_attestations").select("flock_id,task_code,source_fingerprint").eq("org_id", context.orgId).eq("farm_id", selection.farmId).eq("work_date", selection.workDate).is("superseded_at", null),
    governanceAdmin.from("operational_actions").select("id").eq("org_id", context.orgId).eq("farm_id", selection.farmId).eq("owner_id", context.userId).not("status", "in", "(resolved)") ,
    governanceAdmin.from("farm_operating_days").select("status").eq("org_id", context.orgId).eq("farm_id", selection.farmId).eq("operating_date", selection.workDate).maybeSingle(),
    governanceAdmin.rpc("today_resource_revision", {p_resource_type: "operating_day", p_resource_id: selection.farmId, p_work_date: selection.workDate}),
  ]);
  const firstError = [houses, batches, daily, previousDaily, closures, mortality, health, supplies, attestations, actions, operatingDay, operatingRevision]
    .map((result) => result.error).find(Boolean);
  if (firstError) throw new TodayWorkspaceError("INTERNAL_ERROR", firstError.message, 500);

  const houseById = new Map((houses.data ?? []).map((row: Row) => [String(row.id), String(row.name)]));
  const batchById = new Map((batches.data ?? []).map((row: Row) => [String(row.id), String(row.batch_number)]));
  const dailyByFlock = new Map((daily.data ?? []).map((row: Row) => [String(row.flock_id), row]));
  const previousByFlock = new Map<string, Row>();
  for (const row of (previousDaily.data ?? []) as Row[]) {
    const flockId = String(row.flock_id);
    if (!previousByFlock.has(flockId)) previousByFlock.set(flockId, row);
  }
  const closureByFlock = new Map((closures.data ?? []).map((row: Row) => [String(row.flock_id), row]));
  const mortalityFlocks = new Set((mortality.data ?? []).map((row: Row) => String(row.flock_id)));
  const healthFlocks = new Set((health.data ?? []).map((row: Row) => String(row.flock_id)));
  const supplyFlocks = new Set((supplies.data ?? []).map((row: Row) => String(row.flock_id)));
  const attestationByKey = new Map((attestations.data ?? []).map((row: Row) => [`${row.flock_id}:${row.task_code}`, String(row.source_fingerprint)]));

  const fingerprintPairs = await Promise.all(flockIds.flatMap((flockId) => ["health_deaths", "routine_supplies"].map(async (taskCode) => {
    const result = await governanceAdmin.rpc("today_source_fingerprint", {
      p_farm_id: selection.farmId,
      p_flock_id: flockId,
      p_work_date: selection.workDate,
      p_task_code: taskCode,
    });
    if (result.error) throw new TodayWorkspaceError("INTERNAL_ERROR", result.error.message, 500);
    return [`${flockId}:${taskCode}`, String(result.data)] as const;
  })));
  const fingerprints = new Map(fingerprintPairs);
  const dailyRevisionPairs = await Promise.all([...dailyByFlock.entries()].map(async ([flockId, record]) => {
    const result = await governanceAdmin.rpc("today_resource_revision", {
      p_resource_type: "daily_record",
      p_resource_id: String(record.id),
      p_work_date: null,
    });
    if (result.error) throw new TodayWorkspaceError("INTERNAL_ERROR", result.error.message, 500);
    return [flockId, String(result.data)] as const;
  }));
  const feedRevisionPairs = await Promise.all(flockIds.map(async (flockId) => {
    const result = await governanceAdmin.rpc("today_resource_revision", {
      p_resource_type: "feed_day",
      p_resource_id: flockId,
      p_work_date: selection.workDate,
    });
    if (result.error) throw new TodayWorkspaceError("INTERNAL_ERROR", result.error.message, 500);
    return [flockId, String(result.data)] as const;
  }));
  const dailyRevisions = new Map(dailyRevisionPairs);
  const feedRevisions = new Map(feedRevisionPairs);

  const data: TodayWorkspaceData = {
    organization: {todayWorkspaceEnabled: Boolean(organization.today_workspace_enabled)},
    profile: {preferredLocale: profile.preferred_locale === "am" ? "am" : "en"},
    farm: {id: String(farm.id), name: String(farm.name)},
    operatingDay: {
      status: (operatingDay.data?.status ?? "open") as "open" | "closed" | "locked",
      revision: String(operatingRevision.data),
    },
    flocks: flockRows.map((row) => {
      const id = String(row.id);
      const record = dailyByFlock.get(id);
      const closure = closureByFlock.get(id);
      return {
        id,
        code: String(row.flock_code),
        type: String(row.flock_type),
        batchLabel: row.batch_id ? batchById.get(String(row.batch_id)) ?? null : null,
        houseLabel: houseById.get(String(row.house_id)) ?? "Assigned house",
        placementDate: String(row.placement_date),
        ageAtPlacementDays: asNumber(row.age_at_placement_days),
        currentCount: Number(row.current_count ?? 0),
        dailyRecord: record ? {
          id: String(record.id),
          openingBirds: asNumber(record.opening_birds),
          closingBirds: asNumber(record.closing_birds),
          deaths: asNumber(record.deaths),
          normalEggs: asNumber(record.normal_eggs),
          brokenEggs: asNumber(record.broken_eggs),
          dirtyEggs: asNumber(record.dirty_eggs),
          totalEggs: asNumber(record.total_eggs),
          waterLiters: asNumber(record.water_consumed_liters),
          revision: dailyRevisions.get(id) ?? "",
        } : null,
        previousClosingBirds: asNumber(previousByFlock.get(id)?.closing_birds),
        feedClosed: closure?.status === "closed",
        feedRevision: feedRevisions.get(id) ?? "",
        hasHealthOrDeathActivity: mortalityFlocks.has(id) || healthFlocks.has(id) || Number(record?.deaths ?? 0) > 0,
        hasRoutineSupplyUsage: supplyFlocks.has(id),
        healthFingerprint: fingerprints.get(`${id}:health_deaths`) ?? "",
        suppliesFingerprint: fingerprints.get(`${id}:routine_supplies`) ?? "",
        healthAttestationFingerprint: attestationByKey.get(`${id}:health_deaths`) ?? null,
        suppliesAttestationFingerprint: attestationByKey.get(`${id}:routine_supplies`) ?? null,
      };
    }),
    assignedActionCount: actions.data?.length ?? 0,
  };
  return deriveTodayWorkspace(data, selection, context.role === "farm_manager");
}
