import {z} from "zod";
import {accessJson, getAccessContext, isAccessResponse} from "@/lib/access-context";
import {loadArchivedCorrectionContext} from "@/lib/flock-lifecycle/archived-corrections";
import {FlockLifecycleError} from "@/lib/flock-lifecycle/server";

export async function GET(request: Request) {
  const ctx = await getAccessContext({tenant: true});
  if (isAccessResponse(ctx)) return ctx;
  const params=new URL(request.url).searchParams;
  const id = z.uuid().safeParse(params.get("cycle_id"));
  if (!id.success) return accessJson({code: "UNAVAILABLE"}, 404);
  const options=z.object({cursor:z.string().max(2048).optional(),revision:z.string().max(200).optional(),recordIds:z.array(z.uuid()).max(500).optional()}).safeParse({cursor:params.get("cursor")??undefined,revision:params.get("revision")??undefined,recordIds:params.has("record_id")?params.getAll("record_id"):undefined});
  if(!options.success)return accessJson({code:"UNAVAILABLE"},400);
  try {return accessJson(await loadArchivedCorrectionContext(ctx, id.data,options.data));}
  catch (error) {return accessJson({code: error instanceof FlockLifecycleError ? error.code : "LOAD_FAILED"}, error instanceof FlockLifecycleError ? error.status : 500);}
}
