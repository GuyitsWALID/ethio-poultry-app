import {z} from "zod";
import {accessJson, getAccessContext, isAccessResponse} from "@/lib/access-context";
import {FlockLifecycleError, loadFlockProfile} from "@/lib/flock-lifecycle/server";
import {profilePeriods, type ProfileDays} from "@/lib/flock-lifecycle/profile";

export async function GET(request: Request, route: {params: Promise<{id: string}>}) {
  const context = await getAccessContext({tenant: true});
  if (isAccessResponse(context)) return context;
  const {id} = await route.params;
  if (!z.uuid().safeParse(id).success) return accessJson({code: "UNAVAILABLE"}, 404);
  const raw = new URL(request.url).searchParams.get("days") ?? "30";
  if (!profilePeriods.some(days => String(days) === raw)) return accessJson({code: "INVALID_PERIOD"}, 400);
  try {return accessJson(await loadFlockProfile(context, id, Number(raw) as ProfileDays));}
  catch (error) {
    if (error instanceof FlockLifecycleError) return accessJson({code: error.code}, error.status);
    // Do not expose SQL, authorization configuration or source identifiers.
    return accessJson({code: "LOAD_FAILED"}, 500);
  }
}
