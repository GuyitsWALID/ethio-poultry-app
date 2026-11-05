import { accessJson, getAccessContext, governanceAdmin, isAccessResponse } from "@/lib/access-context";

type Row = Record<string, unknown>;

async function assignedFarmIds(orgId: string, userId: string) {
  const now = new Date().toISOString();
  const { data, error } = await governanceAdmin
    .from("user_farm_access")
    .select("farm_id")
    .eq("org_id", orgId)
    .eq("profile_id", userId)
    .is("revoked_at", null)
    .lte("starts_at", now)
    .or(`expires_at.is.null,expires_at.gt.${now}`);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => String(row.farm_id));
}

export async function GET() {
  try {
    const context = await getAccessContext({ tenant: true });
    if (isAccessResponse(context)) return context;

    const allowedFarmIds = context.role === "farm_manager" && !context.supportSessionId
      ? await assignedFarmIds(context.orgId, context.userId)
      : null;
    const queryFarmIds = allowedFarmIds?.length ? allowedFarmIds : ["00000000-0000-0000-0000-000000000000"];

    let flockQuery = governanceAdmin
      .from("flocks")
      .select("id,flock_code,farm_id,house_id,batch_id,intake_batch_id,flock_type,source,status,placement_date,age_at_placement_days,initial_count,current_count,notes")
      .eq("org_id", context.orgId)
      .order("placement_date", { ascending: false })
      .limit(1000);
    let batchQuery = governanceAdmin
      .from("batches")
      .select("id,batch_code,branch_id,farm_id,house_id,placement_date,source,total_count,status,updated_at")
      .eq("org_id", context.orgId)
      .order("placement_date", { ascending: false })
      .limit(1000);

    if (allowedFarmIds !== null) {
      flockQuery = flockQuery.in("farm_id", queryFarmIds);
      batchQuery = batchQuery.in("farm_id", queryFarmIds);
    }

    const [flocksResult, batchesResult] = await Promise.all([flockQuery, batchQuery]);
    const firstError = flocksResult.error ?? batchesResult.error;
    if (firstError) return accessJson({ error: firstError.message }, 500);

    const flocks = (flocksResult.data ?? []) as Row[];
    if (flocks.length >= 1000 || (batchesResult.data?.length ?? 0) >= 1000) return accessJson({error: "SOURCE_LIMIT"}, 409);
    // Keep house-specific canonical IDs; the grouping is presentation metadata.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cycleDb = governanceAdmin as any;
    // Authorization follows each current flock. Return only that flock's linked
    // placement metadata, even when an approved move crossed farm boundaries.
    // This does not expose other batches or farms from the original location.
    const linkedBatchIds = [...new Set(flocks.map(row => row.batch_id).filter(Boolean))];
    const [linkedBatchesResult, movementsResult] = await Promise.all([
      linkedBatchIds.length ? cycleDb.from("batches").select("id,batch_code,farm_id,house_id,batch_cycle_id,placement_date,status").eq("org_id", context.orgId).in("id", linkedBatchIds).limit(1000) : {data: [], error: null},
      cycleDb.rpc("verified_flock_movements", {p_org: context.orgId}),
    ]);
    if (linkedBatchesResult.error || movementsResult.error) return accessJson({error: "Unable to load placement evidence."}, 500);
    if (linkedBatchesResult.data.length >= 1000 || movementsResult.data.length >= 10001) return accessJson({error: "SOURCE_LIMIT"}, 409);
    const linkedBatches = new Map<string, Row>((linkedBatchesResult.data as Row[]).map(row => [String(row.id), row]));
    const verifiedMovements = new Set((movementsResult.data as Row[]).map(row => row.flock_id));
    const linkedCycleIds = [...new Set((linkedBatchesResult.data as Row[]).map(row => row.batch_cycle_id).filter(Boolean))];
    let cycleQuery = cycleDb.from("batch_cycles").select("id,cycle_code,farm_id,status,completion_verified").eq("org_id", context.orgId).limit(1000);
    if (allowedFarmIds !== null) cycleQuery = cycleQuery.or(`farm_id.in.(${queryFarmIds.join(",")}),id.in.(${linkedCycleIds.length ? linkedCycleIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
    const [cyclesResult, membershipResult, clearancesResult] = await Promise.all([
      cycleQuery,
      batchesResult.data?.length ? cycleDb.from("batches").select("id,batch_cycle_id").eq("org_id", context.orgId).in("id", batchesResult.data.map(row => row.id)).limit(1000) : {data: [], error: null},
      flocks.length ? cycleDb.from("batch_cycle_clearances").select("flock_id").eq("org_id", context.orgId).in("flock_id", flocks.map(row => row.id)).limit(1000) : {data: [], error: null},
    ]);
    if (cyclesResult.error || membershipResult.error || clearancesResult.error) return accessJson({error: "Unable to load cycle evidence."}, 500);
    if ([cyclesResult, membershipResult, clearancesResult].some(result => result.data.length >= 1000)) return accessJson({error: "SOURCE_LIMIT"}, 409);
    const cycleMap = new Map<string, Row>((cyclesResult.data as Row[]).map(row => [String(row.id), row]));
    const membership = new Map<string, Row>((membershipResult.data as Row[]).map(row => [String(row.id), row]));
    const cleared = new Set((clearancesResult.data as Row[]).map(row => row.flock_id));
    for (const flock of flocks) {
      const placement = linkedBatches.get(String(flock.batch_id));
      const cycleId = placement?.batch_cycle_id ?? membership.get(String(flock.batch_id))?.batch_cycle_id;
      const cycle = cycleMap.get(String(cycleId));
      flock.batch_cycle_id = cycle?.id ?? null;
      flock.cycle_code = cycle?.cycle_code ?? null;
      flock.canonical_batch = placement ?? null;
      flock.verified_movement_chain = verifiedMovements.has(flock.id);
      if (cleared.has(flock.id)) flock.current_count = 0;
    }
    const intakeIds = [...new Set(flocks.map((row) => row.intake_batch_id).filter((id): id is string => typeof id === "string" && id.length > 0))];
    let intakeBatches: Row[] = [];
    if (intakeIds.length) {
      // Legacy intake rows remain readable for historical lineage. Some newer
      // installations do not have this compatibility table.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (governanceAdmin as any)
        .from("branch_intake_batches")
        .select("id,batch_code,source")
        .eq("org_id", context.orgId)
        .in("id", intakeIds);
      if (!result.error) intakeBatches = (result.data ?? []) as Row[];
    }

    const aggregate = new Map<string, { flockTotal: number; currentBirds: number }>();
    for (const flock of flocks) {
      if (!flock.batch_id) continue;
      const id = String(flock.batch_id);
      const current = aggregate.get(id) ?? { flockTotal: 0, currentBirds: 0 };
      current.flockTotal += 1;
      current.currentBirds += Number(flock.current_count ?? 0);
      aggregate.set(id, current);
    }
    const batches = ((batchesResult.data ?? []) as Row[]).map((batch) => {
      const totals = aggregate.get(String(batch.id)) ?? { flockTotal: 0, currentBirds: 0 };
      return {
        ...batch,
        flock_total: totals.flockTotal,
        total_chicks: totals.currentBirds,
        chicks_per_flock: totals.flockTotal ? Math.round(totals.currentBirds / totals.flockTotal) : 0,
      };
    });

    return accessJson({ flocks, batches, intakeBatches, cycles: [...cycleMap.values()] });
  } catch (error: unknown) {
    return accessJson({ error: error instanceof Error ? error.message : "Unable to load flock and batch records." }, 500);
  }
}
