import {getAccessContext, isAccessResponse} from "@/lib/access-context";
import {HistoryError, parseHistoryInput} from "@/lib/history/contracts";
import {listHistory} from "@/lib/history/server";

export async function GET(request: Request) {
  const headers = {"Cache-Control": "private, no-store", Vary: "Cookie"};
  const ctx = await getAccessContext({tenant: true});
  if (isAccessResponse(ctx)) {ctx.headers.set("Cache-Control", headers["Cache-Control"]); return ctx;}
  const query = new URL(request.url).searchParams;
  try {return Response.json(await listHistory(ctx, parseHistoryInput(query), query.get("cursor")), {headers});}
  catch (error) {
    const code = error instanceof HistoryError ? error.code : "LOAD_FAILED";
    if (!(error instanceof HistoryError) || error.status >= 500) console.error("history.read_failed", {code, actorId: ctx.userId, orgId: ctx.orgId, category: query.get("category")});
    return Response.json({code}, {status: error instanceof HistoryError ? error.status : 503, headers});
  }
}
