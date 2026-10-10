import {z} from "zod";
import {accessJson, getAccessContext, isAccessResponse} from "@/lib/access-context";
import {loadArchivedCorrectionContext} from "@/lib/flock-lifecycle/archived-corrections";
import {FlockLifecycleError} from "@/lib/flock-lifecycle/server";

export async function GET(request: Request) {
  const ctx = await getAccessContext({tenant: true});
  if (isAccessResponse(ctx)) return ctx;
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("cycle_id"));
  if (!id.success) return accessJson({code: "UNAVAILABLE"}, 404);
  try {return accessJson(await loadArchivedCorrectionContext(ctx, id.data));}
  catch (error) {return accessJson({code: error instanceof FlockLifecycleError ? error.code : "LOAD_FAILED"}, error instanceof FlockLifecycleError ? error.status : 500);}
}
