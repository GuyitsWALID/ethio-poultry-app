import {getAccessContext, isAccessResponse, accessJson} from "@/lib/access-context";
import {eggSourceOptions} from "@/lib/egg-sale-sources.server";
import {historyUuid, validHistoryDate} from "@/lib/history/contracts";

export async function GET(request: Request) {
  const ctx = await getAccessContext({tenant: true}); if (isAccessResponse(ctx)) return ctx;
  const params = new URL(request.url).searchParams, farm = params.get("farm_id") ?? "", date = params.get("date") ?? "";
  if (!historyUuid.test(farm) || !validHistoryDate(date)) return accessJson({error: "EGG_SOURCE_INVALID"}, 400);
  if (!["ceo", "farm_manager"].includes(ctx.role)) return accessJson({error: "EGG_SOURCE_ACCESS_DENIED"}, 403);
  try {return accessJson({flocks: await eggSourceOptions(ctx, farm, date)});}
  catch (error) {return accessJson({error: error instanceof Error && error.message === "EGG_SOURCE_ACCESS_DENIED" ? error.message : "EGG_SOURCE_LOAD_FAILED"}, error instanceof Error && error.message === "EGG_SOURCE_ACCESS_DENIED" ? 403 : 503);}
}
