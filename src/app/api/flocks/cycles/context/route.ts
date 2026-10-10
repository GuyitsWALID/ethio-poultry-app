import {z} from "zod";
import {accessJson, getAccessContext, isAccessResponse} from "@/lib/access-context";
import {loadCycleContext, resolveCycleTarget} from "@/lib/flock-lifecycle/cycles";
import {FlockLifecycleError} from "@/lib/flock-lifecycle/server";

export async function GET(request: Request) {
  const ctx = await getAccessContext({tenant: true});
  if (isAccessResponse(ctx)) return ctx;
  const query = new URL(request.url).searchParams;
  const parsed = z.object({farm: z.uuid().nullable(), cycle: z.uuid().nullable(), batch: z.uuid().nullable(), date: z.iso.date().optional()}).safeParse({farm: query.get("farm_id"), cycle: query.get("cycle_id"), batch: query.get("batch_id"), date: query.get("date") ?? undefined});
  if (!parsed.success) return accessJson({code: "UNAVAILABLE"}, 404);
  try {
    const target = await resolveCycleTarget(ctx, {farmId: parsed.data.farm, cycleId: parsed.data.cycle, batchId: parsed.data.batch});
    return accessJson(await loadCycleContext(ctx, target.farmId, target.cycleId, parsed.data.date));
  }
  catch (error) {return accessJson({code: error instanceof FlockLifecycleError ? error.code : "LOAD_FAILED"}, error instanceof FlockLifecycleError ? error.status : 500);}
}
