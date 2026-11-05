import {getAccessContext, isAccessResponse} from "@/lib/access-context";
import {HistoryError} from "@/lib/history/contracts";
import {historyDetail} from "@/lib/history/server";

export async function GET(_request: Request, context: {params: Promise<{kind: string; id: string}>}) {
  const headers = {"Cache-Control": "private, no-store", Vary: "Cookie"};
  const ctx = await getAccessContext({tenant: true});
  if (isAccessResponse(ctx)) {ctx.headers.set("Cache-Control", headers["Cache-Control"]); return ctx;}
  const {kind, id} = await context.params;
  try {return Response.json(await historyDetail(ctx, kind, id), {headers});}
  catch (error) {
    const code = error instanceof HistoryError ? error.code : "LOAD_FAILED";
    if (!(error instanceof HistoryError) || error.status >= 500) console.error("history.detail_failed", {code, actorId: ctx.userId, orgId: ctx.orgId, kind});
    return Response.json({code}, {status: error instanceof HistoryError ? error.status : 503, headers});
  }
}
