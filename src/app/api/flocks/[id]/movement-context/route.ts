import {z} from "zod";
import {accessJson, getAccessContext, isAccessResponse} from "@/lib/access-context";
import {loadMovementContext} from "@/lib/flock-lifecycle/cycles";
import {FlockLifecycleError} from "@/lib/flock-lifecycle/server";

export async function GET(_request: Request, route: {params: Promise<{id: string}>}) {
  const context = await getAccessContext({tenant: true});
  if (isAccessResponse(context)) return context;
  const {id} = await route.params;
  if (!z.uuid().safeParse(id).success) return accessJson({code: "UNAVAILABLE"}, 404);
  try {return accessJson(await loadMovementContext(context, id));}
  catch (error) {return accessJson({code: error instanceof FlockLifecycleError ? error.code : "LOAD_FAILED"}, error instanceof FlockLifecycleError ? error.status : 500);}
}
