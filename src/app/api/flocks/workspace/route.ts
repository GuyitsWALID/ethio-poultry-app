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
      .select("id,flock_code,farm_id,house_id,batch_id,intake_batch_id,flock_type,source,status,placement_date,initial_count,current_count,notes")
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

    return accessJson({ flocks, batches, intakeBatches });
  } catch (error: unknown) {
    return accessJson({ error: error instanceof Error ? error.message : "Unable to load flock and batch records." }, 500);
  }
}
